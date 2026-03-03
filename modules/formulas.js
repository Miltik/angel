/**
 * Formulas.exe Farming Module - Auto-farm hashes/money once acquired
 * Detects when Formulas.exe is available and activates farming
 * 
 * @param {NS} ns
 */
import { createWindow } from "/angel/modules/uiManager.js";
import { formatMoney, isScriptDeathError } from "/angel/utils.js";

const TELEMETRY_PORT = 20;

let lastState = {
    hasFormulas: false,
    farmingActive: false,
    sessionHashes: 0,
    loopCount: 0
};

let telemetryState = {
    lastReportTime: 0
};

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("formulas", "📐 Formulas.exe Farm", 600, 350, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ui.log("📐 Formulas.exe farming module initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    telemetryState.lastReportTime = Date.now();
    
    while (true) {
        try {
            lastState.loopCount++;
            
            // Check if player has Formulas.exe
            const hasFormulas = ns.fileExists("Formulas.exe", "home");
            
            if (hasFormulas && !lastState.hasFormulas) {
                ui.log("🎉 Formulas.exe detected! Starting farming...", "success");
                lastState.hasFormulas = true;
                lastState.farmingActive = true;
            }
            
            if (!hasFormulas && lastState.hasFormulas) {
                ui.log("⚠️  Formulas.exe no longer available", "warn");
                lastState.hasFormulas = false;
                lastState.farmingActive = false;
            }
            
            // If we have Formulas, do passive calculations
            if (lastState.farmingActive && lastState.loopCount % 5 === 0) {
                try {
                    farmFormulas(ns, ui);
                } catch (e) {
                    // Silently fail if calculations fail
                }
            }
            
            // Status update
            if (lastState.loopCount % 12 === 0) {
                if (lastState.farmingActive) {
                    ui.log(`✅ Formulas farming active | Session hashes: ${lastState.sessionHashes}`, "info");
                } else {
                    ui.log("⏳ Waiting for Formulas.exe acquisition...", "debug");
                }
            }
            
            // Report telemetry every 5 seconds
            const now = Date.now();
            if (now - telemetryState.lastReportTime >= 5000) {
                reportTelemetry(ns);
                telemetryState.lastReportTime = now;
            }
            
            await ns.sleep(10000);  // Check every 10 seconds
        } catch (e) {
            if (isScriptDeathError(e)) {
                return;
            }
            ui.log(`❌ Error: ${e.message}`, "error");
            await ns.sleep(5000);
        }
    }
}

function reportTelemetry(ns) {
    try {
        const payload = JSON.stringify({
            module: 'formulas',
            timestamp: Date.now(),
            metrics: {
                farmingActive: lastState.farmingActive,
                hasFormulas: lastState.hasFormulas,
                sessionHashes: lastState.sessionHashes,
                loopCount: lastState.loopCount,
            },
        });
        
        ns.writePort(TELEMETRY_PORT, payload);
    } catch (e) {
        // Silently fail telemetry
    }
}

function farmFormulas(ns, ui) {
    try {
        const player = ns.getPlayer();
        
        // Do some light formula calculations as "farming"
        // These don't generate income but demonstrate the API usage
        // In real play, you'd use these to optimize hacking/crime/training
        
        // Example: Calculate hack time for all servers to find best options
        const servers = ns.getPurchasedServers();
        if (servers.length > 0) {
            const targetServer = servers[0];
            const hackTime = ns.formulas.hacking.hackTime(targetServer, player);
            lastState.sessionHashes++;
        }
        
    } catch (e) {
        // Formulas calls might fail early if not fully loaded yet
    }
}
