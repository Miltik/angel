import { createWindow } from "/angel/modules/uiManager.js";
import { config } from "/angel/config.js";
import { isScriptDeathError } from "/angel/utils.js";
import { TELEMETRY_PORT } from "/angel/ports.js";

const LOOT_VERSION = "2026-03-01-r4";

const state = {
    loopCount: 0,
    totalFilesArchived: 0,
    lastSummary: "",
};

// Telemetry tracking
const telemetryState = {
    lastReportTime: 0
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const ui = createWindow("loot", "📚 Loot Collector", 620, 380, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("📚 Loot collector initialized", "success");
    ui.log(`🧩 Version: ${LOOT_VERSION}`, "info");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");

    const intervalMs = Number(config.loot?.loopDelayMs ?? 60000);

    // Initialize telemetry
    telemetryState.lastReportTime = Date.now();

    while (true) {
        try {
            const loopStartTime = Date.now();
            state.loopCount++;
            await collectLoot(ns, ui);
            
            // Report telemetry every 5 seconds
            const timeSinceLastReport = Date.now() - telemetryState.lastReportTime;
            if (timeSinceLastReport >= 5000) {
                reportLootTelemetry(ns, state);
            }
        } catch (e) {
            const message = String(e?.message || e);
            if (isScriptDeathError(message)) return;
            ui.log(`❌ Error: ${message}`, "error");
        }

        await ns.sleep(intervalMs);
    }
}

async function collectLoot(ns, ui) {
    const servers = getAllServers(ns);
    const includeHome = Boolean(config.loot?.includeHome);
    const lootExtensions = Array.isArray(config.loot?.extensions)
        ? config.loot.extensions.map(ext => String(ext || "").toLowerCase())
        : [".lit", ".msg", ".txt"];

    const maxPerLoop = Math.max(1, Number(config.loot?.maxFilesPerLoop ?? 250));
    const archivePrefix = String(config.loot?.archivePrefix ?? "/angel/loot/");
    const manifestPath = "/angel/loot/loot-index.txt";

    let scannedServers = 0;
    let candidates = 0;
    let updated = 0;
    let unchanged = 0;
    let failed = 0;
    const manifestRows = [];

    if (state.loopCount === 1) {
        ui.log(`📚 Loot filters: ${lootExtensions.join(", ")}`, "info");
    }

    for (const server of servers) {
        if (!includeHome && server === "home") continue;
        if (server !== "home" && !ns.hasRootAccess(server)) continue;

        scannedServers++;
        const files = collectCandidateFiles(ns, server, lootExtensions);

        for (const file of files) {
            if (candidates >= maxPerLoop) break;

            candidates++;
            try {
                const markerPath = `${archivePrefix}${sanitize(server)}__${sanitize(file)}.txt`;

                if (ns.fileExists(markerPath, "home")) {
                    unchanged++;
                    manifestRows.push(`${server} | ${file} | archived`);
                    continue;
                }

                if (server === "home") {
                    writeLootMarker(ns, markerPath, server, file, "already-on-home");
                    updated++;
                    state.totalFilesArchived++;
                    manifestRows.push(`HOME | ${file} | marked`);
                    continue;
                }

                const copied = ns.scp(file, "home", server);
                if (!copied) {
                    failed++;
                    manifestRows.push(`${server} | ${file} | copy-failed`);
                    continue;
                }

                writeLootMarker(ns, markerPath, server, file, "copied-to-home");
                updated++;
                state.totalFilesArchived++;
                manifestRows.push(`${server} | ${file} | copied-and-marked`);
            } catch (e) {
                failed++;
                manifestRows.push(`${server} | ${file} | error: ${String(e?.message || e)}`);
                if (state.loopCount === 1 && failed <= 5) {
                    ui.log(`❌ Failed to copy ${file}: ${e.message || e}`, "error");
                }
            }
        }

        if (candidates >= maxPerLoop) break;
    }

    const summary = `Scanned ${scannedServers} servers | Candidates ${candidates} | Updated ${updated} | Unchanged ${unchanged} | Failed ${failed}`;
    writeManifest(ns, manifestPath, summary, manifestRows);
    if (summary !== state.lastSummary || state.loopCount % 10 === 0) {
        ui.log(`📦 ${summary}`, failed > 0 ? "warn" : "info");
        state.lastSummary = summary;
    }
}

function writeLootMarker(ns, markerPath, server, file, status) {
    const lines = [
        `status: ${status}`,
        `sourceServer: ${server}`,
        `sourceFile: ${file}`,
        `storedOnHomeAs: ${file}`,
        `timestamp: ${new Date().toISOString()}`,
    ];

    ns.write(markerPath, lines.join("\n"), "w");
}

function collectCandidateFiles(ns, server, extensions) {
    const unique = new Set();

    for (const ext of extensions) {
        const suffix = String(ext || "").toLowerCase();
        if (!suffix) continue;

        const matches = ns.ls(server, suffix);
        for (const file of matches) {
            if (!isLootFile(file, suffix)) continue;
            unique.add(file);
        }
    }

    return [...unique];
}

function isLootFile(file, extension) {
    if (!file || file.startsWith("/angel/")) return false;
    if (file.endsWith(".js") || file.endsWith(".exe")) return false;

    if (!extension) return false;
    return file.toLowerCase().endsWith(String(extension).toLowerCase());
}

function sanitize(value) {
    return String(value || "")
        .replace(/[\\/:*?"<>|\s]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
}

function writeManifest(ns, path, summary, rows) {
    const lines = [
        `ANGEL LOOT INDEX - ${new Date().toISOString()}`,
        summary,
        "",
    ];

    if (rows.length === 0) {
        lines.push("No loot candidates found in this pass.");
    } else {
        lines.push(...rows);
    }

    ns.write(path, lines.join("\n"), "w");
}

function getAllServers(ns) {
    const visited = new Set(["home"]);
    const queue = ["home"];

    while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = ns.scan(current);

        for (const neighbor of neighbors) {
            if (visited.has(neighbor)) continue;
            visited.add(neighbor);
            queue.push(neighbor);
        }
    }

    return [...visited];
}

function reportLootTelemetry(ns, stateData) {
    try {
        const now = Date.now();
        
        const metricsPayload = {
            filesArchived: stateData.totalFilesArchived,
            loopsRun: stateData.loopCount
        };
        
        writeLootMetrics(ns, metricsPayload);
        telemetryState.lastReportTime = now;
    } catch (e) {
        ns.print(`❌ Loot telemetry error: ${e}`);
    }
}

function writeLootMetrics(ns, metricsPayload) {
    try {
        const payload = JSON.stringify({
            module: 'loot',
            timestamp: Date.now(),
            metrics: metricsPayload,
        });
        ns.tryWritePort(TELEMETRY_PORT, payload);
    } catch (e) {
        ns.print(`❌ Failed to write loot metrics: ${e}`);
    }
}