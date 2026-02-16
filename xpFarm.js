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
import { createWindow } from "/angel/modules/uiManager.js";

// State tracking to prevent log spam
let lastState = {
    target: "",
    totalThreads: 0,
    usedServers: 0,
    deployed: 0,
    loopCount: 0,
};

export async function main(ns) {
    ns.disableLog("ALL");
    
    // Version check
    ns.tprint("⚡ XP Farm v2.0 (DOM UI) - Loading...");
    
    let ui;
    try {
        ui = createWindow("xpfarm", "⚡ XP Farm", 600, 400, ns);
        ns.tprint("✅ DOM UI initialized successfully");
    } catch (error) {
        ns.tprint(`❌ DOM UI failed: ${error.message}`);
        ns.tprint("Falling back to tail window...");
        ns.ui.openTail();
        ui = {
            log: (msg) => ns.print(msg),
        };
    }
    
    const flags = ns.flags([
        ["target", ""],
        ["reserve", 0],
        ["once", false],
        ["interval", 10000],
        ["clean", true],
    ]);
    
    const worker = "angel/workers/weaken.js";
    const reserveHome = Number(flags.reserve) || 0;
    const interval = Math.max(1000, Number(flags.interval) || 10000);
    const scriptRam = ns.getScriptRam(worker);
    
    if (scriptRam === 0) {
        ui.log("❌ Missing worker script: " + worker, "error");
        ns.tprint(`❌ XP Farm: Missing worker script: ${worker}`);
        return;
    }
    
    ui.log("⚡ ANGEL XP Farm Started", "success");
    ui.log(`📋 Reserve Home RAM: ${reserveHome}GB`, "info");
    ui.log(`⏱️ Update Interval: ${interval}ms`, "info");
    ui.log(`🔄 Clean Mode: ${flags.clean ? "ON" : "OFF"}`, "info");
    if (flags.target) {
        ui.log(`🎯 Target Locked: ${flags.target}`, "info");
    }
    ui.log("", "info");
    
    while (true) {
        lastState.loopCount++;
        const servers = getRunnableServers(ns);
        const target = flags.target || pickTarget(ns, servers);
        
        if (!target) {
            ui.log("❌ No valid XP target found", "error");
            ns.tprint("❌ XP Farm: No valid XP target found");
            return;
        }
        
        if (flags.clean) {
            stopWorkers(ns, servers, worker);
        }
        
        const deployed = await deployWorkers(ns, servers, worker);
        const { totalThreads, usedServers } = launchWeaken(ns, servers, target, worker, reserveHome);
        
        // Only log if something changed
        const changed = lastState.target !== target ||
                       lastState.totalThreads !== totalThreads ||
                       lastState.usedServers !== usedServers ||
                       lastState.deployed !== deployed;
        
        if (changed || lastState.loopCount % 10 === 0) {
            const player = ns.getPlayer();
            const targetServer = ns.getServer(target);
            
            let xpInfo = "";
            try {
                const xpGain = ns.formulas.hacking.hackExp(targetServer, player);
                xpInfo = `📊 XP/Thread: ${xpGain.toFixed(2)} | Total XP/tick: ${(xpGain * totalThreads).toFixed(2)}`;
            } catch (e) {
                xpInfo = `📊 XP formulas not available`;
            }
            
            ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
            ui.log(`🎯 Target: ${target} (Req Lvl ${targetServer.requiredHackingSkill})`, "success");
            ui.log(`👤 Player Level: ${player.skills.hacking}`, "info");
            ui.log(`🖥️ Active Servers: ${usedServers}/${servers.length}`, "success");
            ui.log(`⚡ Total Threads: ${totalThreads}`, "success");
            ui.log(`📦 Workers Deployed: ${deployed}`, "info");
            ui.log(xpInfo, "info");
            
            lastState.target = target;
            lastState.totalThreads = totalThreads;
            lastState.usedServers = usedServers;
            lastState.deployed = deployed;
        }
        
        if (flags.once) {
            ui.log("", "info");
            ui.log("✅ One-shot mode complete", "success");
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

function stopWorkers(ns, servers, worker) {
    for (const server of servers) {
        const processes = ns.ps(server);
        for (const proc of processes) {
            if (proc.filename === worker) {
                ns.kill(proc.pid);
            }
        }
    }
}
