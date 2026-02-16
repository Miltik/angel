import { createWindow } from "/angel/modules/uiManager.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("programs", "💾 Programs", 600, 350, ns);
    ui.log("Programs module started", "info");
    
    let loopCount = 0;
    
    while (true) {
        loopCount++;
        try {
            // Ensure we're always at home
            const homeConn = await connectToHome(ns);
            if (!homeConn) ui.log("WARNING: Failed to connect to home!", "warn");
            
            ui.log(`Loop ${loopCount}`, "debug");
            
            // Buy TOR and Programs
            const allDone = await phaseBuyPrograms(ns, ui);
            if (allDone) {
                ui.log("Program acquisition complete. Idle mode.", "success");
            }
            
        } catch (e) {
            ui.log(`Error: ${e}`, "error");
            await connectToHome(ns);
        }
        
        // Always return home before sleeping
        await connectToHome(ns);
        
        await ns.sleep(30000);
    }
}

// Helper to safely connect to home with verification
async function connectToHome(ns) {
    try {
        ns.singularity.connect("home");
        await ns.sleep(50);
        // Verify we actually connected to home
        const current = ns.singularity.getCurrentServer ? ns.singularity.getCurrentServer() : "home";
        if (current !== "home") {
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

async function phaseBuyPrograms(ns, ui) {
    
    try {
        // Buy TOR if needed (autoBuyTor default: true)
        if (!hasTor(ns)) {
            const money = ns.getServerMoneyAvailable("home");
            ui.log(`TOR not available. Money: $${money.toLocaleString()}`, "info");
            
            if (money >= 200000) {
                try {
                    ns.singularity.purchaseTor();
                    await ns.sleep(2000);  // Give it time to process
                    
                    // Verify TOR was actually purchased
                    if (hasTor(ns)) {
                        ui.log("Purchased TOR successfully", "success");
                    } else {
                        ui.log("TOR purchase completed but verification failed", "warn");
                    }
                } catch (e) {
                    ui.log(`TOR purchase failed: ${e}`, "error");
                }
            } else {
                ui.log(`Need $${(200000 - money).toLocaleString()} more for TOR`, "info");
            }
            return false; // Still need TOR, wait for next loop
        }
        
        // Buy programs (autoBuyPrograms default: true, preferBuying default: true)
        if (hasTor(ns)) {
            const programs = [
                "BruteSSH.exe",
                "FTPCrack.exe",
                "relaySMTP.exe",
                "HTTPWorm.exe",
                "SQLInject.exe",
                "AutoLink.exe",
                "DeepscanV1.exe",
                "ServerProfiler.exe",
            ];
            
            for (const prog of programs) {
                if (ns.fileExists(prog, "home")) {
                    ui.log(`Already have ${prog}`, "debug");
                    continue;
                }
                
                try {
                    const cost = ns.singularity.getDarkwebProgramCost(prog);
                    const money = ns.getServerMoneyAvailable("home");
                    
                    if (cost <= 0) {
                        ui.log(`${prog} not available on darkweb (cost: ${cost})`, "warn");
                        continue;
                    }

                    if (money >= cost) {
                        const purchased = ns.singularity.purchaseProgram(prog);
                        if (purchased) {
                            ui.log(`Bought ${prog} for $${cost.toLocaleString()}`, "success");
                        } else {
                            ui.log(`Failed to buy ${prog} (cost: $${cost.toLocaleString()})`, "warn");
                        }
                        await ns.sleep(500);
                        return false; // Keep buying more
                    } else {
                        ui.log(`Need $${(cost - money).toLocaleString()} for ${prog}`, "info");
                        return false; // Still need money
                    }
                } catch (e) {
                    ui.log(`Error buying ${prog}: ${e}`, "error");
                }
            }
            
            ui.log("All programs acquired!", "success");
            return true; // All programs done
        }
        
        return false; // Still need TOR
        
    } catch (e) {
        ui.log(`Phase error: ${e}`, "error");
        return false;
    }
}

function hasTor(ns) {
    try {
        // getDarkwebPrograms() returns an array if TOR is available
        // Throws an error if TOR is not purchased
        const programs = ns.singularity.getDarkwebPrograms();
        return Array.isArray(programs) && programs.length > 0;
    } catch (e) {
        return false;
    }
}
