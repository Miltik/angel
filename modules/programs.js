import { config } from "/angel/config.js";
import { formatMoney, log } from "/angel/utils.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("[Programs] Module starting");
    
    try {
        ns.ui.openTail();
    } catch (e) {
        ns.print("[Programs] Warning: tail failed");
    }
    
    ns.print("[Programs] Entering main loop");
    
    let loopCount = 0;
    while (true) {
        loopCount++;
        try {
            ns.print(`[Programs] Loop ${loopCount}`);
            
            // Buy TOR if needed
            if (!hasTor(ns) && config.programs.autoBuyTor) {
                const money = ns.getServerMoneyAvailable("home");
                if (money >= 200000) {
                    try {
                        ns.singularity.purchaseTor();
                        ns.print("[Programs] Purchased TOR");
                    } catch (e) {
                        // Needs SF4
                    }
                }
            }
            
            // Programs
            await buyPrograms(ns);
            
            // Backdoors
            await doBackdoors(ns);
            
        } catch (e) {
            ns.print(`[Programs] Error: ${e}`);
        }
        
        await ns.sleep(30000);
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

async function buyPrograms(ns) {
    if (!config.programs.autoBuyPrograms) return;
    if (!hasTor(ns)) return;
    if (!config.programs.preferBuying) return;
    
    try {
        const programs = ["BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe"];
        for (const prog of programs) {
            if (ns.fileExists(prog, "home")) continue;
            
            const cost = ns.singularity.getDarkwebProgramCost(prog);
            const money = ns.getServerMoneyAvailable("home");
            
            if (money >= cost) {
                ns.singularity.purchaseProgram(prog);
                ns.print(`[Programs] Bought ${prog}`);
                await ns.sleep(100);
                return;
            }
        }
    } catch (e) {
        ns.print(`[Programs] Buy error: ${e}`);
    }
}

async function doBackdoors(ns) {
    if (!config.programs.autoBackdoor) return;
    
    try {
        const player = ns.getPlayer();
        const targets = [
            { name: "CSEC", level: 50 },
            { name: "avmnite-02h", level: 200 },
            { name: "I.I.I.I", level: 350 },
            { name: "run4theh111z", level: 500 },
        ];
        
        for (const target of targets) {
            if (player.skills.hacking < target.level) continue;
            
            const srv = ns.getServer(target.name);
            if (srv.backdoorInstalled) continue;
            if (!ns.hasRootAccess(target.name)) continue;
            
            // Connect
            const path = findPath(ns, target.name);
            for (const hop of path) {
                ns.singularity.connect(hop);
            }
            
            ns.singularity.installBackdoor();
            ns.singularity.connect("home");
            ns.print(`[Programs] Backdoored ${target.name}`);
            return;
        }
    } catch (e) {
        ns.print(`[Programs] Backdoor error: ${e}`);
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
