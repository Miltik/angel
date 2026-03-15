/**
 * ANGEL Backdoor Module
 * Path-based backdoor installer with UI + telemetry.
 *
 * Run manually: run /angel/backdoor.js
 *
 * @param {NS} ns
 */

import { createWindow } from "/angel/modules/uiManager.js";

import { TELEMETRY_PORT } from "/angel/ports.js";

export async function main(ns) {
    ns.disableLog("ALL");

    const ui = createWindow("backdoor", "🛡️ Backdoor", 640, 420, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("🛡️ ANGEL Backdoor module initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");

    if (!hasSingularityAccess(ns)) {
        ui.log("⚠️ Singularity access not available (need SF4)", "warn");
        return;
    }

    const network = buildNetworkTree(ns);
    const candidates = getBackdoorCandidates(ns, network);

    if (candidates.length === 0) {
        ui.log("✅ No eligible servers need backdoor right now", "success");
        reportBackdoorTelemetry(ns, 0, 0);
        return;
    }

    ui.log(`🌐 Network scanned: ${network.nodes.length} servers`, "info");
    ui.log(`🎯 Eligible targets: ${candidates.length}`, "info");

    let attempted = 0;
    let completed = 0;
    let interrupted = false;

    for (const target of candidates) {
        attempted++;
        const path = getPathToTarget(target.name, network.parentMap);

        if (!connectPath(ns, path)) {
            ui.log(`✗ ${target.name}: connect path failed`, "warn");
            continue;
        }

        try {
            await ns.singularity.installBackdoor();
            completed++;
            ui.log(`✅ ${target.name} | req ${target.requiredHackingSkill}`, "success");
        } catch (e) {
            if (isScriptDeath(e)) {
                interrupted = true;
                break;
            }
            ui.log(`✗ ${target.name}: ${shortError(e)}`, "warn");
        } finally {
            if (!interrupted) {
                try {
                    ns.singularity.connect("home");
                } catch (e) {
                    if (isScriptDeath(e)) {
                        interrupted = true;
                    }
                }
            }
        }

        if (interrupted) {
            break;
        }
    }

    if (interrupted) {
        safeLog(ui, "⚠️ Backdoor module interrupted (ScriptDeath). Re-run /angel/backdoor.js to resume.", "warn");
        reportBackdoorTelemetry(ns, attempted, completed);
        return;
    }

    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log(`🏁 Backdoor complete | Installed: ${completed}/${attempted}`, "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");

    reportBackdoorTelemetry(ns, attempted, completed);
}

function isScriptDeath(error) {
    return String(error).includes("ScriptDeath");
}

function safeLog(ui, message, level = "info") {
    try {
        ui.log(message, level);
    } catch (e) {
        // Ignore logging failures when script is being terminated
    }
}

function hasSingularityAccess(ns) {
    // try {
    //     ns.singularity.connect("home");
    //     return true;
    // } catch (e) {
    //     return false;
    // }
    // Always return true for testing
    return true;
}

function buildNetworkTree(ns) {
    const parentMap = new Map();
    const visited = new Set(["home"]);
    const queue = ["home"];
    const nodes = [];

    parentMap.set("home", null);

    while (queue.length > 0) {
        const current = queue.shift();
        nodes.push(current);

        const neighbors = ns.scan(current);
        for (const neighbor of neighbors) {
            if (visited.has(neighbor)) continue;
            visited.add(neighbor);
            parentMap.set(neighbor, current);
            queue.push(neighbor);
        }
    }

    return { nodes, parentMap };
}

function getBackdoorCandidates(ns, network) {
    const playerHack = ns.getPlayer().skills.hacking;
    const purchased = new Set(ns.getPurchasedServers());

    const candidates = [];

    for (const server of network.nodes) {
        if (server === "home") continue;
        if (purchased.has(server)) continue;

        const info = ns.getServer(server);
        if (!info.hasAdminRights) continue;
        if (info.backdoorInstalled) continue;
        if (info.requiredHackingSkill > playerHack) continue;

        candidates.push({
            name: server,
            requiredHackingSkill: info.requiredHackingSkill,
        });
    }

    candidates.sort((a, b) => a.requiredHackingSkill - b.requiredHackingSkill || a.name.localeCompare(b.name));
    return candidates;
}

function getPathToTarget(target, parentMap) {
    const path = [];
    let current = target;

    while (current !== null && current !== undefined) {
        path.push(current);
        current = parentMap.get(current);
    }

    path.reverse();
    return path;
}

function connectPath(ns, path) {
    // Connect to "home" first
    if (!ns.singularity.connect("home")) return false;
    for (let i = 1; i < path.length; i++) {
        if (!ns.singularity.connect(path[i])) {
            return false;
        }
    }
    return true;
}

function shortError(error) {
    return String(error).replace(/\s+/g, " ").slice(0, 60);
}

function reportBackdoorTelemetry(ns, attempted, completed) {
    try {
        writeBackdoorMetrics(ns, { installed: completed, attempted });
    } catch (e) {
        ns.print(`❌ Backdoor telemetry error: ${e}`);
    }
}

function writeBackdoorMetrics(ns, metricsPayload) {
    try {
        const payload = JSON.stringify({
            module: "backdoor",
            timestamp: Date.now(),
            metrics: metricsPayload,
        });
        ns.tryWritePort(TELEMETRY_PORT, payload);
    } catch (e) {
        ns.print(`❌ Failed to write backdoor metrics: ${e}`);
    }
}
