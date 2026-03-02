/**
 * ANGEL RAM Calculator
 * Shows total RAM usage for each module and overall system
 * 
 * Run: run /angel/angel-ram.js
 * 
 * @param {NS} ns
 */

export async function main(ns) {
    ns.disableLog("ALL");
    
    // Module list from config
    const modules = {
        core: [
            { name: "angel.js", path: "/angel/angel.js" },
            { name: "config.js", path: "/angel/config.js" },
            { name: "utils.js", path: "/angel/utils.js" },
            { name: "scanner.js", path: "/angel/scanner.js" },
        ],
        active: [
            { name: "programs", path: "/angel/modules/programs.js" },
            { name: "servers", path: "/angel/modules/servers.js" },
            { name: "augments", path: "/angel/modules/augments.js" },
            { name: "factions", path: "/angel/modules/activities.js" },
            { name: "training", path: "/angel/modules/activities.js" },
            { name: "activities", path: "/angel/modules/activities.js" },
            { name: "hacknet", path: "/angel/modules/hacknet.js" },
            { name: "stocks", path: "/angel/modules/stocks.js" },
            { name: "gang", path: "/angel/modules/gang.js" },
            { name: "bladeburner", path: "/angel/modules/bladeburner.js" },
            { name: "sleeves", path: "/angel/modules/sleeves.js" },
            { name: "hacking", path: "/angel/modules/hacking.js" },
            { name: "dashboard", path: "/angel/modules/dashboard.js" },
            { name: "contracts", path: "/angel/modules/contracts.js" },
            { name: "formulas", path: "/angel/modules/formulas.js" },
            { name: "networkMap", path: "/angel/modules/networkMap.js" },
        ],
        workers: [
            { name: "hack.js", path: "/angel/workers/hack.js" },
            { name: "grow.js", path: "/angel/workers/grow.js" },
            { name: "weaken.js", path: "/angel/workers/weaken.js" },
            { name: "share.js", path: "/angel/workers/share.js" },
        ],
        tools: [
            { name: "xpFarm", path: "/angel/modules/xpFarm.js" },
            { name: "snapshot", path: "/angel/snapshot.js" },
            { name: "backdoor", path: "/angel/modules/backdoor.js" },
            { name: "networkMap", path: "/angel/modules/networkMap.js" },
        ]
    };
    
    ns.tprint("╔════════════════════════════════════════════════════╗");
    ns.tprint("║       ANGEL RAM USAGE CALCULATOR                   ║");
    ns.tprint("╚════════════════════════════════════════════════════╝");
    ns.tprint("");
    
    const home = ns.getServer("home");
    const maxRam = home.maxRam;
    const usedRam = home.ramUsed;
    const availRam = maxRam - usedRam;
    
    ns.tprint(`📊 HOME SERVER: ${formatRam(maxRam)} total`);
    ns.tprint(`   Currently used: ${formatRam(usedRam)} (${((usedRam / maxRam) * 100).toFixed(1)}%)`);
    ns.tprint(`   Available: ${formatRam(availRam)} (${((availRam / maxRam) * 100).toFixed(1)}%)`);
    ns.tprint("");
    
    let totalModuleRam = 0;
    let totalCoreRam = 0;
    let totalWorkerRam = 0;
    
    // Core modules
    ns.tprint("📁 CORE FILES:");
    for (const mod of modules.core) {
        let ram = 0;
        try {
            if (ns.fileExists(mod.path, "home")) {
                ram = ns.getScriptRam(mod.path, "home");
            }
        } catch (e) { }
        totalCoreRam += ram;
        ns.tprint(`   ${mod.name.padEnd(25)} ${formatRam(ram)}`);
    }
    ns.tprint(`   ${"TOTAL CORE".padEnd(25)} ${formatRam(totalCoreRam)}`);
    ns.tprint("");
    
    // Worker scripts
    ns.tprint("⚙️  WORKER SCRIPTS:");
    for (const mod of modules.workers) {
        let ram = 0;
        try {
            if (ns.fileExists(mod.path, "home")) {
                ram = ns.getScriptRam(mod.path, "home");
            }
        } catch (e) { }
        totalWorkerRam += ram;
        ns.tprint(`   ${mod.name.padEnd(25)} ${formatRam(ram)}`);
    }
    ns.tprint(`   ${"TOTAL WORKERS (per thread)".padEnd(25)} ${formatRam(totalWorkerRam)}`);
    ns.tprint("");
    
    // Active modules
    ns.tprint("🟢 ACTIVE MODULES (running continuously):");
    let activeList = [];
    let uniquePaths = new Set();
    
    for (const mod of modules.active) {
        if (!uniquePaths.has(mod.path)) {
            uniquePaths.add(mod.path);
            let ram = 0;
            try {
                if (ns.fileExists(mod.path, "home")) {
                    ram = ns.getScriptRam(mod.path, "home");
                }
            } catch (e) { }
            totalModuleRam += ram;
            activeList.push({ name: mod.name, ram });
        }
    }
    
    // Sort by RAM descending
    activeList.sort((a, b) => b.ram - a.ram);
    for (const mod of activeList) {
        ns.tprint(`   ${mod.name.padEnd(25)} ${formatRam(mod.ram)}`);
    }
    ns.tprint(`   ${"TOTAL MODULES".padEnd(25)} ${formatRam(totalModuleRam)}`);
    ns.tprint("");
    
    // Summary
    const estimatedRunning = totalCoreRam + totalModuleRam + (totalWorkerRam * 4); // Assume 4 worker threads
    const percentOfHome = (estimatedRunning / maxRam) * 100;
    
    ns.tprint("╔════════════════════════════════════════════════════╗");
    ns.tprint("║                SUMMARY                             ║");
    ns.tprint("╚════════════════════════════════════════════════════╝");
    ns.tprint("");
    ns.tprint(`Core scripts:           ${formatRam(totalCoreRam)}`);
    ns.tprint(`Active modules:         ${formatRam(totalModuleRam)}`);
    ns.tprint(`Workers (4 threads):    ${formatRam(totalWorkerRam * 4)}`);
    ns.tprint(`─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─`);
    ns.tprint(`ESTIMATED TOTAL:        ${formatRam(estimatedRunning)} (${percentOfHome.toFixed(1)}% of ${formatRam(maxRam)})`);
    ns.tprint("");
    
    if (estimatedRunning > maxRam) {
        ns.tprint("⚠️  WARNING: Estimated usage EXCEEDS home RAM!");
        ns.tprint(`   Need ${formatRam(estimatedRunning - maxRam)} more RAM`);
    } else {
        ns.tprint(`✓ Fits comfortably (${formatRam(maxRam - estimatedRunning)} headroom)`);
    }
    ns.tprint("");
}

function formatRam(ram) {
    if (ram === 0) return "0.00 GB";
    if (ram < 1) return `${(ram * 1000).toFixed(2)} MB`;
    return `${ram.toFixed(2)} GB`;
}
