/**
 * Dashboard Core - Ultra-lightweight coordinator for the Dashboard module
 * Handles startup, IPC, and launches dashboard-worker.js on a suitable server
 * No heavy imports or UI logic
 */

const DASHBOARD_WORKER = "/angel/modules/dashboard-worker.js";
const DASHBOARD_PORT = 23; // Arbitrary port for dashboard IPC

export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("📊 Dashboard core initialized");

    // Always run dashboard-worker.js on home to ensure UI is available
    let target = "home";

    // Check if worker is already running
    const running = ns.ps(target).some(p => p.filename === DASHBOARD_WORKER);
    if (!running) {
        const pid = ns.exec(DASHBOARD_WORKER, target, 1, DASHBOARD_PORT);
        if (pid === 0) {
            ns.print(`❌ Failed to start dashboard-worker.js on ${target}`);
        } else {
            ns.print(`✅ Started dashboard-worker.js on ${target} (PID: ${pid})`);
        }
    } else {
        ns.print(`ℹ️ dashboard-worker.js already running on ${target}`);
    }

    // Coordinator loop: could add IPC/heartbeat logic here if needed
    while (true) {
        await ns.sleep(60000); // Sleep 1 min, just keep alive
    }
}
