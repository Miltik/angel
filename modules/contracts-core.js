/**
 * Contracts Core - Ultra-lightweight coordinator for Coding Contracts
 * Handles startup, IPC, and launches contracts-worker.js on a suitable server
 * No heavy imports or logic
 */

const CONTRACTS_WORKER = "/angel/modules/contracts-worker.js";

export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("📋 Contracts core initialized");

    // Find a server with enough RAM to run the worker
    const servers = ["home", ...ns.getPurchasedServers()];
    let target = servers.find(s => ns.getServerMaxRam(s) - ns.getServerUsedRam(s) > 64) || "home";

    // Check if worker is already running
    const running = ns.ps(target).some(p => p.filename === CONTRACTS_WORKER);
    if (!running) {
        const pid = ns.exec(CONTRACTS_WORKER, target, 1);
        if (pid === 0) {
            ns.print(`❌ Failed to start contracts-worker.js on ${target}`);
        } else {
            ns.print(`✅ Started contracts-worker.js on ${target} (PID: ${pid})`);
        }
    } else {
        ns.print(`ℹ️ contracts-worker.js already running on ${target}`);
    }

    // Coordinator loop: could add IPC/heartbeat logic here if needed
    while (true) {
        await ns.sleep(60000); // Sleep 1 min, just keep alive
    }
}
