import { config } from "/angel/config.js";
import { formatMoney, log } from "/angel/utils.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("[Programs] Starting module");
    
    try {
        ns.ui.openTail();
    } catch (e) {
        ns.print("[Programs] Warning: tail failed");
    }
    
    let modeToggle = 0; // 0 = buying programs, 1 = backdoors
    let loopCount = 0;
    
    while (true) {
        loopCount++;
        try {
            // Ensure we're always at home
            try {
                ns.singularity.connect("home");
            } catch (e) {
                // Ignored
            }
            
            ns.print(`[Programs] Loop ${loopCount}`);
            
            // Phase 1: Buy TOR and Programs
            if (modeToggle === 0) {
                const allDone = await phaseBuyPrograms(ns);
                if (allDone) {
                    modeToggle = 1; // Switch to backdoor phase
                    ns.print("[Programs] Program acquisition complete, moving to backdoors");
                }
            } 
            // Phase 2: Backdoor servers
            else if (modeToggle === 1) {
                await phaseBackdoors(ns);
            }
            
        } catch (e) {
            ns.print(`[Programs] Error: ${e}`);
        }
        
        // Always return home before sleeping
        try {
            ns.singularity.connect("home");
        } catch (e) {
            // Ignore
        }
        
        await ns.sleep(30000);
    }
}

async function phaseBuyPrograms(ns) {
    ns.print("[Programs] Phase: Buying programs");
    
    try {
        // Buy TOR if needed
        if (!hasTor(ns) && config.programs.autoBuyTor) {
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
        
        // Buy programs
        if (config.programs.autoBuyPrograms && hasTor(ns) && config.programs.preferBuying) {
            const programs = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"];
            
            for (const prog of programs) {
                if (ns.fileExists(prog, "home")) {
                    ns.print(`[Programs] Already have ${prog}`);
                    continue;
                }
                
                try {
                    const cost = ns.singularity.getDarkwebProgramCost(prog);
                    const money = ns.getServerMoneyAvailable("home");
                    
                    if (money >= cost) {
                        ns.singularity.purchaseProgram(prog);
                        ns.print(`[Programs] Bought ${prog} for $${cost.toLocaleString()}`);
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
        
        return true; // Programs disabled or complete
        
    } catch (e) {
        ns.print(`[Programs] Phase error: ${e}`);
        return false;
    }
}

async function phaseBackdoors(ns) {
    if (!config.programs.autoBackdoor) {
        return;
    }
    
    ns.print("[Programs] Phase: Installing backdoors");
    
    try {
        const player = ns.getPlayer();
        const targets = [
            { name: "CSEC", level: 50 },
            { name: "avmnite-02h", level: 200 },
            { name: "I.I.I.I", level: 350 },
            { name: "run4theh111z", level: 500 },
        ];
        
        for (const target of targets) {
            try {
                if (player.skills.hacking < target.level) {
                    ns.print(`[Programs] Not high enough level for ${target.name} (need ${target.level})`);
                    continue;
                }
                
                const srv = ns.getServer(target.name);
                if (srv.backdoorInstalled) {
                    ns.print(`[Programs] Already backdoored ${target.name}`);
                    continue;
                }
                
                if (!ns.hasRootAccess(target.name)) {
                    ns.print(`[Programs] No root on ${target.name}`);
                    continue;
                }
                
                ns.print(`[Programs] Backdooring ${target.name}...`);
                
                // Connect
                const path = findPath(ns, target.name);
                for (const hop of path) {
                    ns.singularity.connect(hop);
                    await ns.sleep(100);
                }
                
                // Install
                ns.singularity.installBackdoor();
                await ns.sleep(1000);
                
                ns.print(`[Programs] ✓ Backdoored ${target.name}`);
                
                // Return home before returning
                ns.singularity.connect("home");
                await ns.sleep(100);
                
                return; // Do one per cycle
            } catch (e) {
                ns.print(`[Programs] Error on ${target.name}: ${e}`);
                try {
                    ns.singularity.connect("home");
                } catch (e2) {
                    // Ignore
                }
            }
        }
    } catch (e) {
        ns.print(`[Programs] Backdoor phase error: ${e}`);
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

function findPath(ns, target) {
    const path = [];
    const visited = new Set();
    
    function dfs(server) {
        if (visited.has(server)) return false;
        visited.add(server);
        
        if (server === target) {
            path.push(server);
            return true;
        }
        
        const connected = ns.scan(server);
        for (const next of connected) {
            if (dfs(next)) {
                path.push(server);
                return true;
            }
        }
        
        return false;
    }
    
    dfs("home");
    return path.reverse();
}
