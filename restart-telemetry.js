/**
 * Restart Telemetry and Hacking Scripts
 * Run this in-game to pick up latest code changes
 * Usage: run /angel/restart-telemetry.js
 */

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    ns.tprint('🔄 Restarting Telemetry & Hacking...');
    ns.tprint('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Kill telemetry script
    const telemetryKilled = ns.scriptKill('/angel/telemetry/telemetry.js', 'home');
    if (telemetryKilled) {
        ns.tprint('✅ Killed telemetry.js');
    } else {
        ns.tprint('⚠️  telemetry.js was not running');
    }
    
    // Kill hacking script
    const hackingKilled = ns.scriptKill('/angel/modules/hacking.js', 'home');
    if (hackingKilled) {
        ns.tprint('✅ Killed hacking.js');
    } else {
        ns.tprint('⚠️  hacking.js was not running');
    }
    
    // Wait a moment for cleanup
    await ns.sleep(1000);
    
    // Restart telemetry
    const telemetryPid = ns.exec('/angel/telemetry/telemetry.js', 'home', 1);
    if (telemetryPid > 0) {
        ns.tprint('✅ Started telemetry.js (PID: ' + telemetryPid + ')');
    } else {
        ns.tprint('❌ Failed to start telemetry.js');
    }
    
    // Restart hacking
    const hackingPid = ns.exec('/angel/modules/hacking.js', 'home', 1);
    if (hackingPid > 0) {
        ns.tprint('✅ Started hacking.js (PID: ' + hackingPid + ')');
    } else {
        ns.tprint('❌ Failed to start hacking.js');
    }
    
    await ns.sleep(2000);
    
    ns.tprint('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    ns.tprint('🎯 Scripts restarted! Check logs for diagnostic output.');
    ns.tprint('   Look for 📊 Reported and 📥 Ingested messages');
    ns.tprint('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
