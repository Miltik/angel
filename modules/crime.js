import { config, PORTS } from "/angel/config.js";
import { createWindow } from "/angel/modules/uiManager.js";
import { TELEMETRY_PORT } from "/angel/ports.js";
const ACTIVITY_OWNER = "crime";
const ACTIVITY_LOCK_TTL = 180000;

const state = {
    loopCount: 0,
    lastCrime: null,
    lastReportTime: 0,
};

export async function main(ns) {
    ns.disableLog("ALL");

    const ui = createWindow("crime", "🔪 Crime Worker", 560, 320, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ui.log("🔪 Crime worker initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    while (true) {
        try {
            state.loopCount++;

            if (!hasSingularityAccess(ns)) {
                if (state.loopCount % 30 === 0) {
                    ui.log("⚠️ Singularity unavailable", "warn");
                }
                await ns.sleep(5000);
                continue;
            }

            const mode = readActivityMode(ns);
            if (mode !== "crime") {
                if (state.loopCount % 24 === 0) {
                    ui.log(`⏸️ Idle (mode=${mode})`, "info");
                }
                maybeReportTelemetry(ns, mode, null, 0, 0);
                await ns.sleep(5000);
                continue;
            }

            if (!claimLock(ns, ACTIVITY_OWNER, ACTIVITY_LOCK_TTL)) {
                await ns.sleep(2000);
                continue;
            }

            const best = getBestCrime(ns);
            const crime = best.crime || "Shoplift";
            const chance = Number(best.chance || 0);

            const duration = ns.singularity.commitCrime(crime, config.crime?.focus || "maximum");

            if (crime !== state.lastCrime || state.loopCount % 12 === 0) {
                ui.log(`🔪 ${crime} | ${(chance * 100).toFixed(0)}% | ${(duration / 1000).toFixed(1)}s`, "info");
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
    const data = ns.peek(PORTS.ACTIVITY_MODE);
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
    const raw = ns.peek(PORTS.ACTIVITY);
    if (raw === "NULL PORT DATA") return null;
    const parts = String(raw).split("|");
    if (parts.length < 2) return null;
    return { owner: parts[0], expires: Number(parts[1]) };
}

function claimLock(ns, owner, ttlMs) {
    const now = Date.now();
    const lock = getLock(ns);
    if (!lock || lock.expires <= now || lock.owner === owner) {
        ns.clearPort(PORTS.ACTIVITY);
        ns.writePort(PORTS.ACTIVITY, `${owner}|${now + ttlMs}`);
        return true;
    }
    return false;
}

function getBestCrime(ns) {
    const crimes = [
        "Shoplift",
        "Rob Store",
        "Mug someone",
        "Larceny",
        "Deal Drugs",
        "Bond Forgery",
        "Traffick illegal Arms",
        "Homicide",
        "Grand Theft Auto",
        "Kidnap",
        "Assassination",
        "Heist",
    ];

    const minSuccessChance = config.crime?.minSuccessChance || 0.25;
    let best = null;
    let fallback = null;

    for (const crime of crimes) {
        try {
            const stats = ns.singularity.getCrimeStats(crime);
            const chance = ns.singularity.getCrimeChance(crime);
            const score = (stats.money * chance) / Math.max(1, stats.time);
            const record = { crime, score, chance };

            if (!fallback || record.score > fallback.score) {
                fallback = record;
            }

            if (chance >= minSuccessChance && (!best || record.score > best.score)) {
                best = record;
            }
        } catch (e) {
            // unavailable crime label
        }
    }

    return best || fallback || { crime: "Shoplift", score: 0, chance: 1 };
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
