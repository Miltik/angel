/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("[Programs] Starting module");
    
    try {
        ns.ui.openTail();
    } catch (e) {
        ns.print("[Programs] Warning: tail failed");
    }
    
    let loopCount = 0;
    
    while (true) {
        loopCount++;
        try {
            // Ensure we're always at home
            const homeConn = await connectToHome(ns);
            if (!homeConn) ns.print("[Programs] WARNING: Failed to connect to home!");
            
            ns.print(`[Programs] Loop ${loopCount}`);
            
            // Buy TOR and Programs
            const allDone = await phaseBuyPrograms(ns);
            if (allDone) {
                ns.print("[Programs] Program acquisition complete. Idle mode.");
            }
            
        } catch (e) {
            ns.print(`[Programs] Error: ${e}`);
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
            ns.print(`[Programs] Connection failed! Still at: ${current}`);
            return false;
        }
        return true;
    } catch (e) {
        ns.print(`[Programs] Connect home error: ${e}`);
        return false;
    }
}

async function phaseBuyPrograms(ns) {
    ns.print("[Programs] Phase: Buying programs");
    
    try {
        // Buy TOR if needed (autoBuyTor default: true)
        if (!hasTor(ns)) {
            const money = ns.getServerMoneyAvailable("home");
            if (money >= 200000) {
                try {
                    ns.singularity.purchaseTor();
                    ns.print("[Programs] Purchased TOR");
                    await ns.sleep(1000);
                } catch (e) {
                    ns.print(`[Programs] TOR purchase failed: ${e}`);
                }
            } else {
                ns.print(`[Programs] Need $${(200000 - money).toLocaleString()} more for TOR`);
                return false; // Still need TOR
            }
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
                    ns.print(`[Programs] Already have ${prog}`);
                    continue;
                }
                
                try {
                    const cost = ns.singularity.getDarkwebProgramCost(prog);
                    const money = ns.getServerMoneyAvailable("home");
                    
                    if (cost <= 0) {
                        ns.print(`[Programs] ${prog} not available on darkweb (cost: ${cost})`);
                        continue;
                    }

                    if (money >= cost) {
                        const purchased = ns.singularity.purchaseProgram(prog);
                        if (purchased) {
                            ns.print(`[Programs] Bought ${prog} for $${cost.toLocaleString()}`);
                        } else {
                            ns.print(`[Programs] Failed to buy ${prog} (cost: $${cost.toLocaleString()})`);
                        }
                        await ns.sleep(500);
                        return false; // Keep buying more
                    } else {
                        ns.print(`[Programs] Need $${(cost - money).toLocaleString()} for ${prog}`);
                        return false; // Still need money
                    }
                } catch (e) {
                    ns.print(`[Programs] Error buying ${prog}: ${e}`);
                }
            }
            
            ns.print("[Programs] All programs acquired!");
            return true; // All programs done
        }
        
        return false; // Still need TOR
        
    } catch (e) {
        ns.print(`[Programs] Phase error: ${e}`);
        return false;
    }
}

function hasTor(ns) {
    try {
        ns.singularity.getDarkwebPrograms();
        return true;
    } catch (e) {
        return false;
    }
}
