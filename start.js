/**
 * Quick start script for ANGEL
 * Stops any running instances and starts fresh
 * 
 * @param {NS} ns
 */

import { stopAll } from "/angel/angel.js";

export async function main(ns) {
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
        ns.tprint("");
        ns.tprint("The orchestrator is now running!");
        ns.tprint("Use 'tail /angel/angel.js' to view status");
    }
}
