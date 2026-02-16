/**
 * ANGEL XP Farm
 * Two modes:
 * - spare-home: friendly mode, uses only spare home RAM
 * - hyper: standalone aggressive mode, uses all rooted servers
 *
 * Usage:
 *   run /angel/xpFarm.js
 *   run /angel/xpFarm.js --mode spare-home --reserve 16 --minHomeFree 8
 *   run /angel/xpFarm.js --mode hyper
 *   run /angel/xpFarm.js --target foodnstuff
 *   run /angel/xpFarm.js --reserve 16 --once
 *
 * @param {NS} ns
 */

import { scanAll } from "/angel/scanner.js";
import { calcThreads, getAvailableRam } from "/angel/utils.js";
import { createWindow } from "/angel/modules/uiManager.js";

const XP_FARM_MARKER = "__angel_xpfarm__";

let lastState = {
    target: "",
    totalThreads: 0,
    usedServers: 0,
    deployed: 0,
    loopCount: 0,
};

export async function main(ns) {
    ns.disableLog("ALL");

    ns.tprint("⚡ XP Farm v3.0 - Loading...");

    let ui;
    try {
        ui = createWindow("xpfarm", "⚡ XP Farm", 600, 400, ns);
    } catch (error) {
        ns.tprint(`❌ DOM UI failed: ${error.message}`);
        ns.ui.openTail();
        ui = {
            log: (msg) => ns.print(msg),
        };
    }

    const flags = ns.flags([
        ["mode", "spare-home"],
        ["target", ""],
        ["reserve", 0],
        ["minHomeFree", 0],
        ["once", false],
        ["interval", 10000],
        ["clean", true],
    ]);

    const worker = "/angel/workers/weaken.js";
    const mode = String(flags.mode || "spare-home").toLowerCase() === "hyper" ? "hyper" : "spare-home";
    const reserveHome = Math.max(0, Number(flags.reserve) || 0);
    const minHomeFree = Math.max(0, Number(flags.minHomeFree) || 0);
    const interval = Math.max(1000, Number(flags.interval) || 10000);
    const hyperClean = String(flags.clean).toLowerCase() !== "false";

    const scriptRam = ns.getScriptRam(worker);
    if (scriptRam === 0) {
        ui.log("❌ Missing worker script: " + worker, "error");
        return;
    }

    ui.log("⚡ ANGEL XP Farm Started", "success");
    ui.log(`🧭 Mode: ${mode === "hyper" ? "Hyper (Standalone)" : "Spare-Home (Friendly)"}`, "info");
    ui.log(`📋 Reserve Home RAM: ${reserveHome}GB`, "info");
    if (mode === "spare-home") {
        ui.log(`🏠 Min Free Home RAM: ${minHomeFree}GB`, "info");
        ui.log("🔄 Clean Mode: Managed (XP Farm workers only)", "info");
    } else {
        ui.log(`🔄 Clean Mode: ${hyperClean ? "ON" : "OFF"}`, "info");
    }
    ui.log(`⏱️ Update Interval: ${interval}ms`, "info");
    if (flags.target) {
        ui.log(`🎯 Target Locked: ${flags.target}`, "info");
    }

    while (true) {
        lastState.loopCount++;

        const servers = mode === "hyper" ? getRunnableServers(ns) : ["home"];
        const target = flags.target || pickTarget(ns);

        if (!target) {
            ui.log("❌ No valid XP target found", "error");
            return;
        }

        if (mode === "spare-home") {
            // In friendly mode, keep existing workers alive to avoid thread thrashing.
            // Only reset workers if the selected target changed.
            if (lastState.target && lastState.target !== target) {
                stopWorkers(ns, ["home"], worker, "xpfarm-only");
            }
        } else if (hyperClean) {
            stopWorkers(ns, servers, worker, "all");
        }

        const deployed = mode === "hyper"
            ? await deployWorkers(ns, servers, worker)
            : 0;

        launchWeaken(ns, servers, target, worker, reserveHome, minHomeFree, mode);
        const { totalThreads, usedServers } = getActiveXPFarmStats(ns, servers, worker);

        const changed =
            lastState.target !== target ||
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
                xpInfo = "📊 XP formulas not available";
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

function pickTarget(ns) {
    const player = ns.getPlayer();
    const servers = getRunnableServers(ns);

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
            // ignore copy errors
        }
    }
    return deployed;
}

function launchWeaken(ns, servers, target, worker, reserveHome, minHomeFree, mode) {

    for (const server of servers) {
        const reserve = server === "home"
            ? Math.max(reserveHome, minHomeFree)
            : 0;

        const availableRam = getAvailableRam(ns, server, reserve);
        const threads = calcThreads(ns, worker, availableRam);
        if (threads <= 0) continue;

        const pid = ns.exec(worker, server, threads, target, XP_FARM_MARKER, mode);
        if (pid === 0) continue;
    }
}

function getActiveXPFarmStats(ns, servers, worker) {
    let totalThreads = 0;
    let usedServers = 0;

    for (const server of servers) {
        const processes = ns.ps(server).filter(proc => proc.filename === worker);
        let serverActive = false;
        for (const proc of processes) {
            const args = proc.args || [];
            const isXpFarmWorker = args.some(arg => String(arg) === XP_FARM_MARKER);
            if (!isXpFarmWorker) continue;
            totalThreads += proc.threads || 0;
            serverActive = true;
        }
        if (serverActive) {
            usedServers++;
        }
    }

    return { totalThreads, usedServers };
}

function stopWorkers(ns, servers, worker, strategy = "xpfarm-only") {
    for (const server of servers) {
        const processes = ns.ps(server);
        for (const proc of processes) {
            if (proc.filename !== worker) continue;

            if (strategy === "all") {
                ns.kill(proc.pid);
                continue;
            }

            const args = proc.args || [];
            const isXpFarmWorker = args.some(arg => String(arg) === XP_FARM_MARKER);
            if (isXpFarmWorker) {
                ns.kill(proc.pid);
            }
        }
    }
}
