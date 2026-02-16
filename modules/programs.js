import { createWindow } from "/angel/modules/uiManager.js";

// State tracking to avoid log spam
let lastState = {
    hasTor: false,
    ownedPrograms: [],
    lastLoggedStatus: null,
    loopCount: 0
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("programs", "💾 Programs & Backdoors", 600, 350, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ui.log("💾 Programs & Backdoors module initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    while (true) {
        lastState.loopCount++;
        try {
            // Ensure we're always at home
            const homeConn = await connectToHome(ns);
            if (!homeConn && lastState.loopCount % 10 === 0) {
                ui.log("⚠️  Failed to connect to home", "warn");
            }
            
            // Buy TOR and Programs
            const allDone = await phaseBuyPrograms(ns, ui);
            if (allDone && lastState.lastLoggedStatus !== "complete") {
                ui.log("✅ All programs acquired - entering idle mode", "success");
                lastState.lastLoggedStatus = "complete";
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
        const currentHasTor = hasTor(ns);
        if (!currentHasTor) {
            const money = ns.getServerMoneyAvailable("home");
            
            // Only log TOR status change or periodically
            if (!lastState.hasTor || lastState.loopCount % 10 === 0) {
                if (money >= 200000) {
                    ui.log("🎯 TOR available for purchase ($200k)", "info");
                } else {
                    ui.log(`💰 Saving for TOR: $${(money / 1000).toFixed(0)}k / $200k`, "debug");
                }
            }
            
            if (money >= 200000) {
                try {
                    ns.singularity.purchaseTor();
                    await ns.sleep(2000);  // Give it time to process
                    
                    // Verify TOR was actually purchased
                    if (hasTor(ns)) {
                        ui.log("✅ Purchased TOR successfully", "success");
                        lastState.hasTor = true;
                    } else {
                        ui.log("⚠️  TOR purchase verification failed", "warn");
                    }
                } catch (e) {
                    ui.log(`❌ TOR purchase failed: ${e}`, "error");
                }
            }
            lastState.hasTor = false;
            return false; // Still need TOR, wait for next loop
        }
        
        // Buy programs (autoBuyPrograms default: true, preferBuying default: true)
        if (hasTor(ns)) {
            lastState.hasTor = true;
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
            
            let ownedCount = 0;
            let nextTarget = null;
            
            for (const prog of programs) {
                if (ns.fileExists(prog, "home")) {
                    ownedCount++;
                    // Only log when program list changes
                    if (!lastState.ownedPrograms.includes(prog)) {
                        lastState.ownedPrograms.push(prog);
                    }
                    continue;
                }
                
                if (!nextTarget) nextTarget = prog;
                
                try {
                    const cost = ns.singularity.getDarkwebProgramCost(prog);
                    const money = ns.getServerMoneyAvailable("home");
                    
                    if (cost <= 0) {
                        if (lastState.loopCount % 20 === 0) {
                            ui.log(`⚠️  ${prog} not available on darkweb`, "warn");
                        }
                        continue;
                    }

                    if (money >= cost) {
                        const purchased = ns.singularity.purchaseProgram(prog);
                        if (purchased) {
                            ui.log(`✅ Purchased ${prog} for $${(cost / 1000000).toFixed(2)}M`, "success");
                            lastState.ownedPrograms.push(prog);
                            ownedCount++;
                        } else {
                            ui.log(`❌ Failed to purchase ${prog}`, "warn");
                        }
                        await ns.sleep(500);
                        return false; // Keep buying more
                    } else {
                        // Only log save progress periodically
                        if (lastState.loopCount % 10 === 0) {
                            ui.log(`💰 Saving for ${prog}: $${(money / 1000000).toFixed(2)}M / $${(cost / 1000000).toFixed(2)}M`, "info");
                        }
                        return false; // Still need money
                    }
                } catch (e) {
                    ui.log(`❌ Error buying ${prog}: ${e}`, "error");
                }
            }
            
            // Log completion status periodically
            if (ownedCount === programs.length && lastState.lastLoggedStatus !== "all_programs") {
                ui.log(`✅ All ${programs.length} programs acquired!`, "success");
                lastState.lastLoggedStatus = "all_programs";
            } else if (lastState.loopCount % 10 === 0 && ownedCount < programs.length) {
                ui.log(`📦 Programs: ${ownedCount}/${programs.length} | Next: ${nextTarget}`, "info");
            }
            
            return ownedCount === programs.length; // All programs done
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
