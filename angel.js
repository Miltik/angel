/**
 * ANGEL - Automated Network Game Entity Logic
 * Main orchestrator for Bitburner automation
 * Modular system for SF1 and SF4 automations
 * 
 * @param {NS} ns
 */

import { config, SCRIPTS } from "/angel/config.js";
import { formatMoney, formatRam, formatNumber, log, deployFiles } from "/angel/utils.js";
import { scanAll, rootAll, getRootedServers, getHackableServers } from "/angel/scanner.js";
import { getTotalAvailableRam } from "/angel/modules/hacking.js";
import { getServerStats } from "/angel/modules/servers.js";

export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    
    // Print banner
    printBanner(ns);
    
    // Open tail window
    ns.ui.openTail();
    
    // Initialize
    await initialize(ns);
    
    // Main orchestration loop
    while (true) {
        try {
            await orchestrate(ns);
        } catch (e) {
            log(ns, `Orchestrator error: ${e}`, "ERROR");
        }
        
        await ns.sleep(config.orchestrator.loopDelay);
    }
}

/**
 * Print startup banner
 * @param {NS} ns
 */
function printBanner(ns) {
    ns.print("=======================================");
    ns.print("     ANGEL - Network Orchestrator     ");
    ns.print("   Automated Game Entity Logic v1.0   ");
    ns.print("=======================================");
    ns.print("");
}

/**
 * Initialize the orchestrator
 * @param {NS} ns
 */
async function initialize(ns) {
    log(ns, "Initializing ANGEL orchestrator...", "INFO");
    
    // Scan network
    const servers = scanAll(ns);
    log(ns, `Discovered ${servers.length} servers in network`, "INFO");
    
    // Try to root all servers
    const rooted = rootAll(ns);
    if (rooted > 0) {
        log(ns, `Successfully rooted ${rooted} servers`, "INFO");
    }
    
    // Deploy worker scripts to home
    const workerScripts = [
        SCRIPTS.hack,
        SCRIPTS.grow,
        SCRIPTS.weaken,
        SCRIPTS.share,
    ];
    
    log(ns, "Initialization complete", "INFO");
    log(ns, "", "INFO");
}

/**
 * Main orchestration logic
 * @param {NS} ns
 */
async function orchestrate(ns) {
    // Display status
    displayStatus(ns);
    
    // Check if modules are running, start if needed
    await ensureModulesRunning(ns);
}

/**
 * Display current status
 * @param {NS} ns
 */
function displayStatus(ns) {
    ns.clearLog();
    const money = ns.getServerMoneyAvailable("home");
    const player = ns.getPlayer();
    
    // Server stats
    const networkServers = scanAll(ns);
    const rootedServers = getRootedServers(ns);
    const hackableServers = getHackableServers(ns);
    const serverStats = getServerStats(ns);
    
    // RAM stats
    const totalRam = getTotalAvailableRam(ns);
    const homeRam = ns.getServerMaxRam("home");
    
    ns.print("┌─────────────────────────────────────┐");
    ns.print("│         ANGEL STATUS REPORT         │");
    ns.print("├─────────────────────────────────────┤");
    ns.print(`│ Money:    ${formatMoney(money).padEnd(24)}│`);
    ns.print(`│ Level:    ${player.skills.hacking.toString().padEnd(24)}│`);
    ns.print("├─────────────────────────────────────┤");
    ns.print(`│ Network:  ${networkServers.length.toString().padEnd(24)}│`);
    ns.print(`│ Rooted:   ${rootedServers.length.toString().padEnd(24)}│`);
    ns.print(`│ Hackable: ${hackableServers.length.toString().padEnd(24)}│`);
    ns.print("├─────────────────────────────────────┤");
    ns.print(`│ Purchased Servers: ${serverStats.count}/${serverStats.maxPossible}      │`);
    ns.print(`│ Total RAM: ${formatRam(serverStats.totalRam).padEnd(19)}│`);
    ns.print(`│ Available RAM: ${formatRam(totalRam).padEnd(15)}│`);
    ns.print("└─────────────────────────────────────┘");
    ns.print("");
}

/**
 * Ensure all enabled modules are running
 * @param {NS} ns
 */
async function ensureModulesRunning(ns) {
    // Start non-hacking modules first to ensure they have RAM
    
    // Programs module
    if (config.orchestrator.enablePrograms) {
        await ensureModuleRunning(ns, SCRIPTS.programs, "Programs & Backdoor");
        await ns.sleep(1500); // Stagger startup
    }
    
    // Server management module
    if (config.orchestrator.enableServerMgmt) {
        await ensureModuleRunning(ns, SCRIPTS.serverMgmt, "Server Management");
        await ns.sleep(1500);
    }
    
    // Faction module (if SF4 available)
    if (config.orchestrator.enableFactions) {
        await ensureModuleRunning(ns, SCRIPTS.factions, "Factions");
        await ns.sleep(1500);
    }
    
    // Augmentation module (if SF4 available)
    if (config.orchestrator.enableAugments) {
        await ensureModuleRunning(ns, SCRIPTS.augments, "Augmentations");
        await ns.sleep(1500);
    }

    // Training module (university/gym)
    if (config.orchestrator.enableTraining) {
        await ensureModuleRunning(ns, SCRIPTS.training, "Training");
        await ns.sleep(1500);
    }

    // Company work module
    if (config.orchestrator.enableCompany) {
        await ensureModuleRunning(ns, SCRIPTS.company, "Company Work");
        await ns.sleep(1500);
    }

    // Crime module
    if (config.orchestrator.enableCrime) {
        await ensureModuleRunning(ns, SCRIPTS.crime, "Crime");
        await ns.sleep(1500);
    }
    
    // Hacking module - start last as it consumes most RAM
    if (config.orchestrator.enableHacking) {
        await ensureModuleRunning(ns, SCRIPTS.hacking, "Hacking");
    }
}

/**
 * Ensure a specific module is running
 * @param {NS} ns
 * @param {string} script
 * @param {string} name
 */
async function ensureModuleRunning(ns, script, name) {
    // Check if script exists
    if (!ns.fileExists(script, "home")) {
        log(ns, `Module ${name} not found at ${script}`, "WARN");
        return;
    }
    
    // Check if already running
    if (ns.isRunning(script, "home")) {
        return;
    }
    
    // Check RAM requirements
    const scriptRam = ns.getScriptRam(script, "home");
    const availableRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
    
    if (scriptRam > availableRam) {
        log(ns, `Failed to start ${name} module: needs ${scriptRam.toFixed(2)}GB, have ${availableRam.toFixed(2)}GB`, "WARN");
        return;
    }
    
    // Try to start it
    const pid = ns.exec(script, "home");
    
    if (pid === 0) {
        log(ns, `Failed to start ${name} module: exec returned 0 (check for errors in module)`, "WARN");
    } else {
        log(ns, `Started ${name} module (PID: ${pid})`, "INFO");
    }
}

/**
 * Stop all angel modules
 * @param {NS} ns
 */
export function stopAll(ns) {
    log(ns, "Stopping all ANGEL modules...", "INFO");
    
    const modules = [
        SCRIPTS.hacking,
        SCRIPTS.serverMgmt,
        SCRIPTS.factions,
        SCRIPTS.augments,
    ];
    
    for (const module of modules) {
        if (ns.isRunning(module, "home")) {
            ns.kill(module, "home");
        }
    }
    
    // Kill all worker scripts
    const servers = getRootedServers(ns);
    for (const server of servers) {
        ns.killall(server);
    }
    
    log(ns, "All modules stopped", "INFO");
}

/**
 * Get overall system health
 * @param {NS} ns
 * @returns {object}
 */
export function getSystemHealth(ns) {
    const modules = [
        { name: "Hacking", script: SCRIPTS.hacking, enabled: config.orchestrator.enableHacking },
        { name: "Servers", script: SCRIPTS.serverMgmt, enabled: config.orchestrator.enableServerMgmt },
        { name: "Factions", script: SCRIPTS.factions, enabled: config.orchestrator.enableFactions },
        { name: "Augments", script: SCRIPTS.augments, enabled: config.orchestrator.enableAugments },
    ];
    
    const health = {
        allHealthy: true,
        modules: [],
    };
    
    for (const module of modules) {
        const running = ns.isRunning(module.script, "home");
        const healthy = !module.enabled || running;
        
        health.modules.push({
            name: module.name,
            enabled: module.enabled,
            running,
            healthy,
        });
        
        if (!healthy) {
            health.allHealthy = false;
        }
    }
    
    return health;
}
