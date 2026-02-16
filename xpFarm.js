/**
 * ANGEL XP Farm
 * Hyper-aggressive hacking XP farming across all rooted servers
 * 
 * Usage:
 *   run /angel/xpFarm.js
 *   run /angel/xpFarm.js --target foodnstuff
 *   run /angel/xpFarm.js --reserve 16 --once
 * 
 * @param {NS} ns
 */

import { scanAll } from "/angel/scanner.js";
import { calcThreads, getAvailableRam } from "/angel/utils.js";

export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    
    try {
        ns.ui.openTail();
    } catch (e) {
        ns.print("[XP Farm] Warning: tail failed");
    }
    
    const flags = ns.flags([
        ["target", ""],
        ["reserve", 0],
        ["once", false],
        ["interval", 10000],
    ]);
    
    const worker = "angel/workers/weaken.js";
    const reserveHome = Number(flags.reserve) || 0;
    const interval = Math.max(1000, Number(flags.interval) || 10000);
    const scriptRam = ns.getScriptRam(worker);
    
    if (scriptRam === 0) {
        ns.tprint(`ERROR: Missing worker script: ${worker}`);
        return;
    }
    
    ns.tprint("╔════════════════════════════════════════╗");
    ns.tprint("║        ANGEL XP FARM                   ║");
    ns.tprint("╚════════════════════════════════════════╝");
    ns.tprint("");
    
    while (true) {
        const servers = getRunnableServers(ns);
        const target = flags.target || pickTarget(ns, servers);
        
        if (!target) {
            ns.tprint("ERROR: No valid XP target found.");
            return;
        }
        
        const deployed = await deployWorkers(ns, servers, worker);
        const { totalThreads, usedServers } = launchWeaken(ns, servers, target, worker, reserveHome);
        
        ns.print(`Target: ${target} | Servers: ${usedServers} | Threads: ${totalThreads} | Deployed: ${deployed}`);
        
        if (flags.once) {
            break;
        }
        
        await ns.sleep(interval);
    }
}

function getRunnableServers(ns) {
    const all = scanAll(ns);
    const rooted = all.filter(server => ns.hasRootAccess(server));
    return rooted.filter(server => ns.getServerMaxRam(server) > 0);
}

function pickTarget(ns, servers) {
    const player = ns.getPlayer();
    let best = "";
    let bestLevel = -1;
    
    for (const server of servers) {
        if (server === "home") continue;
        const srv = ns.getServer(server);
        if (srv.purchasedByPlayer) continue;
        if (srv.serverGrowth <= 0) continue;
        if (srv.requiredHackingSkill > player.skills.hacking) continue;
        if (srv.requiredHackingSkill > bestLevel) {
            bestLevel = srv.requiredHackingSkill;
            best = server;
        }
    }
    
    return best || "n00dles";
}

async function deployWorkers(ns, servers, worker) {
    let deployed = 0;
    for (const server of servers) {
        if (server === "home") continue;
        try {
            await ns.scp(worker, server, "home");
            deployed++;
        } catch (e) {
            // Ignore copy errors
        }
    }
    return deployed;
}

function launchWeaken(ns, servers, target, worker, reserveHome) {
    let totalThreads = 0;
    let usedServers = 0;
    
    for (const server of servers) {
        const reserve = server === "home" ? reserveHome : 0;
        const availableRam = getAvailableRam(ns, server, reserve);
        const threads = calcThreads(ns, worker, availableRam);
        if (threads <= 0) continue;
        
        const pid = ns.exec(worker, server, threads, target);
        if (pid !== 0) {
            totalThreads += threads;
            usedServers++;
        }
    }
    
    return { totalThreads, usedServers };
}
