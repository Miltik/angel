/**
 * Quick start script for ANGEL
 * Stops any running instances and starts fresh
 * 
 * @param {NS} ns
 */

import { stopAll } from "/angel/angel.js";

export async function main(ns) {
    ensureLootArchiveSeed(ns);

    const shouldStop = ns.args[0] === "stop" || ns.args[0] === "--stop";
    const shouldRestart = ns.args[0] === "restart" || ns.args[0] === "--restart";
    
    if (shouldStop || shouldRestart) {
        ns.tprint("Stopping ANGEL...");
        stopAll(ns);
        
        if (shouldStop) {
            ns.tprint("✓ ANGEL stopped");
            return;
        }
    }
    
    // Check if already running
    if (ns.isRunning("/angel/angel.js", "home")) {
        ns.tprint("ANGEL is already running!");
        ns.tprint("Use 'run /angel/start.js restart' to restart");
        ns.tprint("Use 'run /angel/start.js stop' to stop");
        return;
    }
    
    // Start ANGEL
    ns.tprint("Starting ANGEL orchestrator...");
    const pid = ns.exec("/angel/angel.js", "home");
    
    if (pid === 0) {
        ns.tprint("✗ Failed to start ANGEL (insufficient RAM?)");
        
        const requiredRam = ns.getScriptRam("/angel/angel.js");
        const availableRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
        
        ns.tprint(`Required RAM: ${requiredRam.toFixed(2)}GB`);
        ns.tprint(`Available RAM: ${availableRam.toFixed(2)}GB`);
    } else {
        ns.tprint(`✓ ANGEL started (PID: ${pid})`);
    }
    
    // Check if telemetry is running
    if (!ns.isRunning("/angel/telemetry/telemetry.js", "home")) {
        ns.tprint("Starting Telemetry collector...");
        const telemetryPid = ns.exec("/angel/telemetry/telemetry.js", "home");
        
        if (telemetryPid === 0) {
            ns.tprint("✗ Failed to start Telemetry (insufficient RAM?)");
            const telemetryRam = ns.getScriptRam("/angel/telemetry/telemetry.js");
            const availableRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
            ns.tprint(`Required RAM: ${telemetryRam.toFixed(2)}GB`);
            ns.tprint(`Available RAM: ${availableRam.toFixed(2)}GB`);
        } else {
            ns.tprint(`✓ Telemetry started (PID: ${telemetryPid})`);
        }
    } else {
        ns.tprint("✓ Telemetry is already running");
    }
    
    ns.tprint("");
    ns.tprint("The orchestrator and telemetry are now running!");
    ns.tprint("Tail window will open automatically");
}

function ensureLootArchiveSeed(ns) {
    const seedPath = "/angel/loot/loot.txt";
    if (!ns.fileExists(seedPath, "home")) {
        ns.write(seedPath, "loot", "w");
        ns.tprint("Initialized /angel/loot/loot.txt");
    }
}
