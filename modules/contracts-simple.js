/**
 * Simplified Contracts Module - Minimal version for testing
 * @param {NS} ns
 */
import { createWindow } from "/angel/modules/uiManager.js";
import { formatMoney } from "/angel/utils.js";

let lastState = {
    contractsSolved: 0,
    totalRewards: 0,
    loopCount: 0
};

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("contracts", "📋 Coding Contracts", 600, 350, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("📋 Contracts solver initialized (SIMPLIFIED VERSION)", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    
    ui.log("🔍 Starting network scan...", "info");
    
    while (true) {
        try {
            lastState.loopCount++;
            
            // Simple scan without solving
            const servers = getAllServers(ns);
            let contractCount = 0;
            
            for (const server of servers) {
                try {
                    const contracts = ns.ls(server, ".cct");
                    contractCount += contracts.length;
                    
                    if (contracts.length > 0) {
                        ui.log(`Found ${contracts.length} contracts on ${server}`, "info");
                    }
                } catch (e) {
                    // Skip inaccessible servers
                }
            }
            
            if (lastState.loopCount % 10 === 0) {
                ui.log(`📊 Scan complete | Total contracts: ${contractCount}`, "info");
            }
            
            await ns.sleep(30000);
        } catch (e) {
            ui.log(`❌ Error: ${e.message}`, "error");
            await ns.sleep(5000);
        }
    }
}

function getAllServers(ns, server = "home", visited = new Set()) {
    visited.add(server);
    const neighbors = ns.scan(server);
    for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
            getAllServers(ns, neighbor, visited);
        }
    }
    return Array.from(visited);
}
