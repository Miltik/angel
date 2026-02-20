/**
 * early-hack.js
 * Standalone aggressive early-game hacking manager (single-file).
 * Usage from Bitburner terminal: `run early-hack.js [target] [hackPercent]`
 * - target: optional server name to focus (auto-selects best target if omitted)
 * - hackPercent: optional fraction to hack each cycle (0.1-0.9). Default 0.6
 *
 * Behavior:
 * - Writes minimal worker scripts to disk (`eh-hack.js`, `eh-grow.js`, `eh-weaken.js`).
 * - Scans the network, attempts to open ports and `NUKE` servers when possible.
 * - Chooses a high-value target and runs aggressive hack/grow/weaken cycles, distributing threads across all rooted hosts.
 */

export async function main(ns) {
    ns.disableLog("sleep");
    ns.disableLog("getServerSecurityLevel");
    ns.disableLog("getServerMoneyAvailable");

    const args = ns.args;
    const userTarget = args[0];
    const hackPercent = Math.min(0.9, Math.max(0.05, Number(args[1]) || 0.6));

    // Worker script names
    const hackWorker = 'eh-hack.js';
    const growWorker = 'eh-grow.js';
    const weakenWorker = 'eh-weaken.js';

    // Minimal worker scripts written at runtime so this file is standalone.
    const hackWorkerSrc = `/** eh-hack.js */ export async function main(ns){ const t=ns.args[0]; while(true){ await ns.hack(t); await ns.sleep(10);} }`;
    const growWorkerSrc = `/** eh-grow.js */ export async function main(ns){ const t=ns.args[0]; while(true){ await ns.grow(t); await ns.sleep(10);} }`;
    const weakenWorkerSrc = `/** eh-weaken.js */ export async function main(ns){ const t=ns.args[0]; while(true){ await ns.weaken(t); await ns.sleep(10);} }`;

    // Write worker scripts (overwrites if already present)
    ns.write(hackWorker, hackWorkerSrc, 'w');
    ns.write(growWorker, growWorkerSrc, 'w');
    ns.write(weakenWorker, weakenWorkerSrc, 'w');

    // Helpers
    function scanAll(start) {
        const seen = new Set();
        const stack = [start];
        while (stack.length) {
            const cur = stack.pop();
            if (seen.has(cur)) continue;
            seen.add(cur);
            const next = ns.scan(cur);
            for (const s of next) if (!seen.has(s)) stack.push(s);
        }
        return Array.from(seen);
    }

    async function tryRoot(host) {
        try {
            if (ns.hasRootAccess(host)) return true;
            if (ns.fileExists('BruteSSH.exe', 'home')) ns.brutessh(host);
            if (ns.fileExists('FTPCrack.exe', 'home')) ns.ftpcrack(host);
            if (ns.fileExists('relaySMTP.exe', 'home')) ns.relaysmtp(host);
            if (ns.fileExists('HTTPWorm.exe', 'home')) ns.httpworm(host);
            if (ns.fileExists('SQLInject.exe', 'home')) ns.sqlinject(host);
            if (ns.getServerNumPortsRequired(host) <= ns.getServer(host).openPortCount || ns.hasRootAccess(host)) {
                ns.nuke(host);
            }
        } catch (e) { }
        return ns.hasRootAccess(host);
    }

    function getUsableHosts() {
        const all = scanAll('home');
        const usable = [];
        for (const h of all) {
            try {
                if (h === 'home') { usable.push(h); continue; }
                if (ns.hasRootAccess(h)) usable.push(h);
            } catch (e) { }
        }
        return usable;
    }

    function availableThreadsOn(host, script) {
        const max = ns.getServerMaxRam(host);
        const used = ns.getServerUsedRam(host);
        const free = Math.max(0, max - used);
        const ramPer = ns.getScriptRam(script, 'home');
        return Math.floor(free / ramPer);
    }

    function totalAvailableThreads(script) {
        const hosts = getUsableHosts();
        let total = 0;
        for (const h of hosts) total += availableThreadsOn(h, script);
        return total;
    }

    function distributeAndExec(script, threads, target) {
        if (threads <= 0) return 0;
        const hosts = getUsableHosts().sort((a,b)=> (ns.getServerMaxRam(b)-ns.getServerMaxRam(a)));
        let remaining = threads;
        for (const h of hosts) {
            if (remaining <= 0) break;
            const can = availableThreadsOn(h, script);
            const t = Math.min(can, remaining);
            if (t <= 0) continue;
            ns.scp(script, h);
            ns.exec(script, h, t, target);
            remaining -= t;
        }
        return threads - remaining; // launched
    }

    // Nuke reachable servers when possible
    ns.tprint('early-hack: scanning network and attempting to gain root where possible...');
    const allServers = scanAll('home');
    for (const s of allServers) await tryRoot(s);

    // Choose a target if not provided
    let target = userTarget;
    if (!target) {
        let best = null;
        let bestMoney = 0;
        for (const s of allServers) {
            try {
                const max = ns.getServerMaxMoney(s);
                const minSec = ns.getServerMinSecurityLevel(s);
                if (max > 0 && ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel()) {
                    if (max > bestMoney && s !== 'home') { best = s; bestMoney = max; }
                }
            } catch (e) { }
        }
        if (!best) {
            ns.tprint('early-hack: no suitable target found (try again later)');
            return;
        }
        target = best;
    }

    ns.tprint(`early-hack: target=${target} hackPercent=${hackPercent}`);

    // Main loop: keep the target low-sec and high-money; run aggressive cycles
    while (true) {
        try {
            if (!ns.hasRootAccess(target)) {
                ns.tprint('early-hack: lost root to target; attempting to regain...');
                await tryRoot(target);
                if (!ns.hasRootAccess(target)) { await ns.sleep(60000); continue; }
            }

            const sec = ns.getServerSecurityLevel(target);
            const minSec = ns.getServerMinSecurityLevel(target);
            const money = ns.getServerMoneyAvailable(target);
            const maxMoney = ns.getServerMaxMoney(target);

            // If security too high, weaken
            if (sec > minSec + 0.5) {
                const secDiff = sec - minSec;
                const reducePerThread = ns.weakenAnalyze(1) || 0.05;
                const needed = Math.ceil(secDiff / reducePerThread);
                const avail = totalAvailableThreads(weakenWorker);
                const toLaunch = Math.max(0, Math.min(needed, avail));
                if (toLaunch <= 0) {
                    // Nothing can be launched right now; wait a short time and retry
                    await ns.sleep(5000);
                    continue;
                }
                const launched = distributeAndExec(weakenWorker, toLaunch, target);
                ns.print(`weaken: target=${target} needed=${needed} avail=${avail} launched=${launched}`);
                await ns.sleep(1000 + ns.getWeakenTime(target));
                continue;
            }

            // If money low, grow
            if (money < maxMoney * 0.85) {
                const mult = Math.min(100, maxMoney / Math.max(1, money));
                const growThreads = Math.ceil(ns.growthAnalyze(target, mult));
                const launched = distributeAndExec(growWorker, growThreads, target);
                ns.print(`grow: target=${target} growThreads=${growThreads} launched=${launched}`);
                await ns.sleep(500 + ns.getGrowTime(target));
                continue;
            }

            // Otherwise perform an aggressive hack cycle
            const perThread = ns.hackAnalyze(target);
            const hackThreads = Math.max(1, Math.ceil(hackPercent / perThread));
            const growThreads = Math.ceil(ns.growthAnalyze(target, 1 / (1 - hackPercent)));
            const hackSecInc = ns.hackAnalyzeSecurity(hackThreads);
            const growSecInc = ns.growthAnalyzeSecurity(growThreads);
            const totalSecInc = hackSecInc + growSecInc;
            const weakenThreads = Math.ceil(totalSecInc / ns.weakenAnalyze(1));

            // Cap threads to what is actually available so we don't stall forever.
            const availWeaken = totalAvailableThreads(weakenWorker);
            const availGrow = totalAvailableThreads(growWorker);
            const availHack = totalAvailableThreads(hackWorker);

            const wLaunch = Math.max(0, Math.min(weakenThreads, availWeaken));
            const gLaunch = Math.max(0, Math.min(growThreads, availGrow));
            const hLaunch = Math.max(0, Math.min(hackThreads, availHack));

            const l1 = distributeAndExec(weakenWorker, wLaunch, target);
            const l2 = distributeAndExec(growWorker, gLaunch, target);
            const l3 = distributeAndExec(hackWorker, hLaunch, target);

            ns.print(`cycle: hackThreads=${hackThreads} grow=${growThreads} weaken=${weakenThreads} launched=${l1+l2+l3}`);

            // Sleep until workers complete; use largest action time
            const sleepFor = Math.max(ns.getHackTime(target), ns.getGrowTime(target), ns.getWeakenTime(target)) + 200;
            await ns.sleep(sleepFor);
        } catch (e) {
            ns.tprint('early-hack: error: ' + String(e));
            await ns.sleep(5000);
        }
    }
}
