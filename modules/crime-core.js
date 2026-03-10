/**
 * Crime Core - Ultra-lightweight crime worker
 * Executes crime activities based on activity mode
 * Minimal imports for minimum RAM footprint
 */

const ACTIVITY_PORT = 5;
const ACTIVITY_MODE_PORT = 6;
const TELEMETRY_PORT = 20;
const ACTIVITY_OWNER = "crime";
const ACTIVITY_LOCK_TTL = 180000;
const CRIME_WORKER_PORT = 21;
const CRIME_RESULT_PORT = 22;
let cmdId = 0;

const state = {
    loopCount: 0,
    lastCrime: null,
    lastReportTime: 0,
    crimeStartedForMode: false,
};

export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("🔪 Crime coordinator initialized");

    while (true) {
        try {
            state.loopCount++;

            const mode = readActivityMode(ns);
            if (mode !== "crime") {
                // Reset one-shot guard when leaving crime mode
                state.crimeStartedForMode = false;
                if (state.loopCount % 24 === 0) {
                    ns.print(`⏸️ Idle (mode=${mode})`);
                }
                maybeReportTelemetry(ns, mode, null, 0, 0);
                await ns.sleep(5000);
                continue;
            }

            if (!claimLock(ns, ACTIVITY_OWNER, ACTIVITY_LOCK_TTL)) {
                await ns.sleep(2000);
                continue;
            }

            // Only send commands to worker, never call singularity API directly
            if (state.crimeStartedForMode) {
                // Query current work from worker
                const work = await sendWorkerCmd(ns, { action: "getCurrentWork" });
                let currentCrime = state.lastCrime;
                if (work && work.type === "CRIME") {
                    currentCrime = work.crimeType || currentCrime;
                }
                maybeReportTelemetry(ns, mode, currentCrime || "none", 0, 0);
                await ns.sleep(2000);
                continue;
            }

            // Get best crime from worker
            const best = await getBestCrimeWorker(ns);
            const crime = best.crime || "Shoplift";
            const chance = Number(best.chance || 0);

            // Commit crime via worker
            const duration = await sendWorkerCmd(ns, { action: "commitCrime", crime });
            state.crimeStartedForMode = true;

            if (crime !== state.lastCrime || state.loopCount % 12 === 0) {
                ns.print(`🔪 ${crime} | ${(chance * 100).toFixed(0)}% | ${(Number(duration) / 1000).toFixed(1)}s`);
                state.lastCrime = crime;
            }

            maybeReportTelemetry(ns, mode, crime, chance, duration);
            await ns.sleep(Math.max(1000, Number(duration || 0) + 250));
        } catch (e) {
            if (String(e).includes("ScriptDeath")) return;
            await ns.sleep(2000);
        }
    }
}

function readActivityMode(ns) {
    const data = ns.peek(ACTIVITY_MODE_PORT);
    if (data === "NULL PORT DATA") return "none";
    return String(data || "none").toLowerCase();
}

function hasSingularityAccess(ns) {
    try {
        ns.singularity.getCurrentWork();
        return true;
    } catch (e) {
        return false;
    }
}

function getLock(ns) {
    const raw = ns.peek(ACTIVITY_PORT);
    if (raw === "NULL PORT DATA") return null;
    const parts = String(raw).split("|");
    if (parts.length < 2) return null;
    return { owner: parts[0], expires: Number(parts[1]) };
}

function claimLock(ns, owner, ttlMs) {
    const now = Date.now();
    const lock = getLock(ns);
    if (!lock || lock.expires <= now || lock.owner === owner) {
        ns.clearPort(ACTIVITY_PORT);
        ns.writePort(ACTIVITY_PORT, `${owner}|${now + ttlMs}`);
        return true;
    }
    return false;
}

async function getBestCrimeWorker(ns) {
    // List of crimes and baseMps must be duplicated here for scoring
    const crimes = [
        { name: "Shoplift", baseMps: 15 },
        { name: "Rob Store", baseMps: 40 },
        { name: "Mug someone", baseMps: 60 },
        { name: "Larceny", baseMps: 130 },
        { name: "Deal Drugs", baseMps: 200 },
        { name: "Bond Forgery", baseMps: 300 },
        { name: "Traffick illegal Arms", baseMps: 500 },
        { name: "Homicide", baseMps: 450 },
        { name: "Grand Theft Auto", baseMps: 700 },
        { name: "Kidnap", baseMps: 900 },
        { name: "Assassination", baseMps: 1300 },
        { name: "Heist", baseMps: 1800 },
    ];
    const minSuccessChance = 0.25;
    let best = null;
    let fallback = null;
    for (const crime of crimes) {
        const chance = await sendWorkerCmd(ns, { action: "getCrimeChance", crime: crime.name });
        const score = crime.baseMps * chance;
        const record = { crime: crime.name, score, chance };
        if (!fallback || record.score > fallback.score) {
            fallback = record;
        }
        if (chance >= minSuccessChance && (!best || record.score > best.score)) {
            best = record;
        }
    }
    return best || fallback || { crime: "Shoplift", score: 0, chance: 1 };
}
// Send a command to the crime worker and wait for result
async function sendWorkerCmd(ns, cmd) {
    cmdId++;
    const fullCmd = { ...cmd, id: cmdId };
    ns.writePort(CRIME_WORKER_PORT, JSON.stringify(fullCmd));
    // Wait for result with matching id
    for (let i = 0; i < 100; ++i) {
        const data = ns.readPort(CRIME_RESULT_PORT);
        if (data !== "NULL PORT DATA") {
            try {
                const msg = JSON.parse(data);
                if (msg.id === cmdId && msg.action === cmd.action) {
                    return msg.result;
                }
            } catch (e) {}
        }
        await ns.sleep(10);
    }
    return null;
}

function maybeReportTelemetry(ns, mode, crime, chance, durationMs) {
    const now = Date.now();
    if (now - state.lastReportTime < 5000) return;

    state.lastReportTime = now;

    try {
        const payload = JSON.stringify({
            module: "crime",
            timestamp: Date.now(),
            metrics: {
                mode,
                currentCrime: crime || "none",
                successChance: Number(chance || 0),
                durationMs: Number(durationMs || 0),
                loopCount: state.loopCount,
            },
        });
        ns.tryWritePort(TELEMETRY_PORT, payload);
    } catch (e) {
        // Ignore telemetry failures
    }
}
