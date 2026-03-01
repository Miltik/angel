import { createWindow } from "/angel/modules/uiManager.js";
import { config } from "/angel/config.js";

const state = {
    loopCount: 0,
    totalFilesArchived: 0,
    lastSummary: "",
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const ui = createWindow("loot", "📚 Loot Collector", 620, 380, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("📚 Loot collector initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");

    const intervalMs = Number(config.loot?.loopDelayMs ?? 60000);

    while (true) {
        try {
            state.loopCount++;
            await collectLoot(ns, ui);
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
        : [".txt", ".cct"];

    const maxPerLoop = Math.max(1, Number(config.loot?.maxFilesPerLoop ?? 250));
    const archivePrefix = String(config.loot?.archivePrefix ?? "/angel/loot/");

    let scannedServers = 0;
    let candidates = 0;
    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    for (const server of servers) {
        if (!includeHome && server === "home") continue;
        if (server !== "home" && !ns.hasRootAccess(server)) continue;

        scannedServers++;
        const files = ns.ls(server);

        for (const file of files) {
            if (!isLootFile(file, lootExtensions)) continue;
            if (candidates >= maxPerLoop) break;

            candidates++;
            try {
                const sourceContent = ns.read(file, server);
                if (typeof sourceContent !== "string" || sourceContent === "") {
                    failed++;
                    if (state.loopCount === 1 && failed <= 5) {
                        ui.log(`⚠️  Cannot read ${file} on ${server} (unsupported type?)`, "warn");
                    }
                    continue;
                }

                const target = `${archivePrefix}${sanitize(server)}__${sanitize(file)}`;
                const existing = ns.read(target);

                if (existing === sourceContent) {
                    unchanged++;
                    continue;
                }

                ns.write(target, sourceContent, "w");
                updated++;
                state.totalFilesArchived++;
            } catch (e) {
                failed++;
                if (state.loopCount === 1 && failed <= 5) {
                    ui.log(`❌ Failed to copy ${file}: ${e.message || e}`, "error");
                }
            }
        }

        if (candidates >= maxPerLoop) break;
    }

    const summary = `Scanned ${scannedServers} servers | Candidates ${candidates} | Updated ${updated} | Unchanged ${unchanged} | Failed ${failed}`;
    if (summary !== state.lastSummary || state.loopCount % 10 === 0) {
        ui.log(`📦 ${summary}`, failed > 0 ? "warn" : "info");
        state.lastSummary = summary;
    }
}

function isLootFile(file, extensions) {
    if (!file || file.startsWith("/angel/")) return false;
    if (file.endsWith(".js") || file.endsWith(".exe")) return false;

    const lower = file.toLowerCase();
    for (const ext of extensions) {
        if (lower.endsWith(ext)) return true;
    }

    return false;
}

function sanitize(value) {
    return String(value || "")
        .replace(/[\\/:*?"<>|\s]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
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

function isScriptDeathError(message) {
    return message.includes("ScriptDeath") || message.includes("NS instance has already been killed");
}
