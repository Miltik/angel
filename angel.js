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

let backdoorState = {
    lastCheckTime: 0,
    lastRunTime: 0,
    lastHackLevel: 0,
    lastEligibleCount: 0,
};

let startupState = {
    startTs: Date.now(),
    coreReady: false,
    lastBlockedLog: 0,
    blockedCoreModules: [],
    lastDeferredLog: {},
};

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
    startupState.startTs = Date.now();

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
    const coreReady = await ensureModulesRunning(ns);

    if (!coreReady) {
        const now = Date.now();
        if (now - startupState.lastBlockedLog > 15000) {
            const blocked = startupState.blockedCoreModules.length > 0
                ? ` (blocked: ${startupState.blockedCoreModules.join(", ")})`
                : "";
            log(ns, `Core startup still pending; deferring optional backdoor automation until critical modules are running${blocked}`, "WARN");
            startupState.lastBlockedLog = now;
        }
        return;
    }

    startupState.coreReady = true;
    startupState.blockedCoreModules = [];

    // Opportunistic backdoor automation
    await maybeRunBackdoor(ns);
}

async function maybeRunBackdoor(ns) {
    if (!config.orchestrator.enableBackdoorAuto) return;

    // Backdoor automation needs singularity access
    try {
        ns.singularity.connect("home");
    } catch (e) {
        return;
    }

    const now = Date.now();
    const settings = config.backdoor || {};
    const checkIntervalMs = settings.checkIntervalMs ?? 60000;
    const minHackLevelDelta = settings.minHackLevelDelta ?? 25;
    const forceRunIntervalMs = settings.forceRunIntervalMs ?? 300000;

    if (now - backdoorState.lastCheckTime < checkIntervalMs) {
        return;
    }
    backdoorState.lastCheckTime = now;

    // Avoid duplicate launches while either launcher or runner is active
    if (ns.isRunning(SCRIPTS.backdoor, "home") || ns.isRunning("/angel/modules/backdoorRunner.js", "home")) {
        return;
    }

    const playerHack = ns.getPlayer().skills.hacking;
    const eligibleCount = countEligibleBackdoorTargets(ns);
    if (eligibleCount <= 0) {
        backdoorState.lastEligibleCount = 0;
        backdoorState.lastHackLevel = playerHack;
        return;
    }

    const unlockedMoreTargets = eligibleCount > backdoorState.lastEligibleCount;
    const gainedHackLevels = playerHack >= backdoorState.lastHackLevel + minHackLevelDelta;
    const forceDue = now - backdoorState.lastRunTime >= forceRunIntervalMs;

    if (!unlockedMoreTargets && !gainedHackLevels && !forceDue) {
        return;
    }

    const pid = ns.exec(SCRIPTS.backdoor, "home");
    if (pid !== 0) {
        log(ns, `Auto-backdoor triggered (eligible: ${eligibleCount}, hack: ${playerHack})`, "INFO");
        backdoorState.lastRunTime = now;
        backdoorState.lastHackLevel = playerHack;
        backdoorState.lastEligibleCount = eligibleCount;
    } else {
        log(ns, "Auto-backdoor trigger skipped (insufficient RAM)", "WARN");
    }
}

function countEligibleBackdoorTargets(ns) {
    const playerHack = ns.getPlayer().skills.hacking;
    const purchased = new Set(ns.getPurchasedServers());
    const servers = scanAll(ns);

    let count = 0;
    for (const server of servers) {
        if (server === "home") continue;
        if (purchased.has(server)) continue;

        const info = ns.getServer(server);
        if (!info.hasAdminRights) continue;
        if (info.backdoorInstalled) continue;
        if (info.requiredHackingSkill > playerHack) continue;

        count++;
    }

    return count;
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
    if (!startupState.coreReady) {
        const blocked = startupState.blockedCoreModules.length > 0
            ? startupState.blockedCoreModules.join(", ")
            : "initializing";
        ns.print(`Startup: waiting on core modules -> ${blocked}`);
    }
    ns.print("");
}

/**
 * Ensure all enabled modules are running
 * @param {NS} ns
 */
async function ensureModulesRunning(ns) {
    let coreReady = true;
    const blockedCoreModules = [];

    const startupReclaimOrder = [
        SCRIPTS.xpFarm,
        SCRIPTS.hacking,
        SCRIPTS.networkMap,
        SCRIPTS.dashboard,
        SCRIPTS.contracts,
        SCRIPTS.formulas,
        SCRIPTS.backdoor,
        "/angel/modules/backdoorRunner.js",
    ];

    // Start non-hacking modules first to ensure they have RAM
    
    // Programs module
    if (config.orchestrator.enablePrograms) {
        const started = await ensureModuleRunning(ns, SCRIPTS.programs, "Programs", [], {
            reclaimOnLowRam: true,
            reclaimOrder: startupReclaimOrder,
        });
        if (!started) blockedCoreModules.push("Programs");
        coreReady = coreReady && started;
        await ns.sleep(1500); // Stagger startup
    }
    
    // Server management module
    if (config.orchestrator.enableServerMgmt) {
        const started = await ensureModuleRunning(ns, SCRIPTS.serverMgmt, "Server Management");
        if (!started) blockedCoreModules.push("Server Management");
        coreReady = coreReady && started;
        await ns.sleep(1500);
    }
    
    // Faction module (if SF4 available)
    if (config.orchestrator.enableFactions) {
        await ensureModuleRunning(ns, SCRIPTS.factions, "Factions");
        await ns.sleep(1500);
    }
    
    // Augmentation module (if SF4 available)
    if (config.orchestrator.enableAugments) {
        const started = await ensureModuleRunning(ns, SCRIPTS.augments, "Augmentations");
        if (!started) blockedCoreModules.push("Augmentations");
        coreReady = coreReady && started;
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

    // Activities module (unified: crime, training, faction, company)
    if (config.orchestrator.enableActivities) {
        const started = await ensureModuleRunning(ns, SCRIPTS.activities, "Activities");
        if (!started) blockedCoreModules.push("Activities");
        coreReady = coreReady && started;
        await ns.sleep(1500);
    }

    // Hacknet module
    if (config.orchestrator.enableHacknet) {
        const started = await ensureModuleRunning(ns, SCRIPTS.hacknet, "Hacknet");
        if (!started) blockedCoreModules.push("Hacknet");
        coreReady = coreReady && started;
        await ns.sleep(1500);
    }

    // Stocks module
    if (config.orchestrator.enableStocks) {
        await ensureModuleRunning(ns, SCRIPTS.stocks, "Stocks");
        await ns.sleep(1500);
    }

    // Gang module
    if (config.orchestrator.enableGang) {
        await ensureModuleRunning(ns, SCRIPTS.gang, "Gang");
        await ns.sleep(1500);
    }

    // Bladeburner module
    if (config.orchestrator.enableBladeburner) {
        await ensureModuleRunning(ns, SCRIPTS.bladeburner, "Bladeburner");
        await ns.sleep(1500);
    }

    // Sleeves module
    if (config.orchestrator.enableSleeves) {
        await ensureModuleRunning(ns, SCRIPTS.sleeves, "Sleeves");
        await ns.sleep(1500);
    }
    
    startupState.blockedCoreModules = blockedCoreModules;

    if (!coreReady) {
        return false;
    }

    // Dashboard module - monitoring (optional, non-blocking)
    if (config.orchestrator.enableDashboard) {
        await ensureModuleRunning(ns, SCRIPTS.dashboard, "Dashboard");
        await ns.sleep(1500);
    }
    
    // Coding Contracts solver - low RAM
    if (config.orchestrator.enableContracts) {
        await ensureModuleRunning(ns, SCRIPTS.contracts, "Contracts");
        await ns.sleep(1500);
    }
    
    // Formulas.exe farming - low RAM
    if (config.orchestrator.enableFormulas) {
        await ensureModuleRunning(ns, SCRIPTS.formulas, "Formulas");
        await ns.sleep(1500);
    }
    
    // Network Map module - visualization
    if (config.orchestrator.enableNetworkMap) {
        await ensureModuleRunning(ns, SCRIPTS.networkMap, "Network Map");
        await ns.sleep(1500);
    }

    const startupElapsedMs = Math.max(0, Date.now() - (startupState.startTs || Date.now()));
    const hackingDelayMs = Number(config.orchestrator?.startupHackingDelayMs ?? 15000);
    const xpFarmDelayMs = Number(config.orchestrator?.startupXPFarmDelayMs ?? 30000);
    
    // Hacking module - start last as it consumes most RAM
    if (config.orchestrator.enableHacking) {
        if (startupElapsedMs >= hackingDelayMs) {
            await ensureModuleRunning(ns, SCRIPTS.hacking, "Hacking");
        } else if (shouldLogDeferredModule("hacking")) {
            const remainingSec = Math.ceil((hackingDelayMs - startupElapsedMs) / 1000);
            log(ns, `Deferring Hacking module startup for ${remainingSec}s to let core modules stabilize`, "INFO");
        }
    }

    // XP Farm module - optional, starts after core modules to use spare RAM
    if (config.orchestrator.enableXPFarm) {
        if (startupElapsedMs < xpFarmDelayMs) {
            if (shouldLogDeferredModule("xpFarm")) {
                const remainingSec = Math.ceil((xpFarmDelayMs - startupElapsedMs) / 1000);
                log(ns, `Deferring XP Farm startup for ${remainingSec}s to prioritize startup stability`, "INFO");
            }
            return true;
        }

        const xpMode = config.xpFarm?.mode || "spare-home";
        const homeRam = ns.getServerMaxRam("home");
        const weakenRam = ns.getScriptRam(SCRIPTS.weaken, "home") || 1.75;
        const maxSafeReserve = Math.max(0, homeRam - weakenRam);

        const configuredReserve = Number(config.xpFarm?.reserveHomeRam ?? 2);
        const configuredMinFree = Number(config.xpFarm?.minHomeFreeRamGb ?? 1);
        const effectiveReserve = Math.min(Math.max(0, configuredReserve), maxSafeReserve);
        const effectiveMinFree = Math.min(Math.max(0, configuredMinFree), maxSafeReserve);

        const xpArgs = [
            "--mode", xpMode,
            "--reserve", String(effectiveReserve),
            "--minHomeFree", String(effectiveMinFree),
            "--interval", String(config.xpFarm?.interval ?? 10000),
        ];

        if (config.xpFarm?.target) {
            xpArgs.push("--target", String(config.xpFarm.target));
        }

        if (xpMode === "hyper" && config.xpFarm?.cleanHyper === false) {
            xpArgs.push("--clean", "false");
        }

        await ensureModuleRunning(ns, SCRIPTS.xpFarm, "XP Farm", xpArgs);
    }

    return true;
}

function shouldLogDeferredModule(moduleKey) {
    const now = Date.now();
    const last = Number(startupState.lastDeferredLog[moduleKey] || 0);
    if (now - last < 15000) {
        return false;
    }
    startupState.lastDeferredLog[moduleKey] = now;
    return true;
}

/**
 * Ensure a specific module is running
 * @param {NS} ns
 * @param {string} script
 * @param {string} name
 */
async function ensureModuleRunning(ns, script, name, args = [], options = {}) {
    // Check if script exists
    if (!ns.fileExists(script, "home")) {
        log(ns, `Module ${name} not found at ${script}`, "WARN");
        return false;
    }
    
    const reclaimOnLowRam = Boolean(options?.reclaimOnLowRam);
    const reclaimOrder = Array.isArray(options?.reclaimOrder) ? options.reclaimOrder : [];

    // Check if already running
    if (ns.isRunning(script, "home")) {
        return true;
    }
    
    // Check RAM requirements
    const scriptRam = ns.getScriptRam(script, "home");
    let availableRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");

    if (scriptRam > availableRam && reclaimOnLowRam && reclaimOrder.length > 0) {
        const reclaimed = [];
        for (const reclaimScript of reclaimOrder) {
            if (availableRam >= scriptRam) break;
            if (reclaimScript === script) continue;
            if (!ns.isRunning(reclaimScript, "home")) continue;

            const killed = ns.kill(reclaimScript, "home");
            if (killed) {
                reclaimed.push(reclaimScript);
                await ns.sleep(50);
                availableRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
            }
        }

        if (reclaimed.length > 0) {
            log(ns, `Reclaimed RAM for ${name}: stopped ${reclaimed.join(", ")}`, "WARN");
        }
    }
    
    if (scriptRam > availableRam) {
        log(ns, `Failed to start ${name} module: needs ${scriptRam.toFixed(2)}GB, have ${availableRam.toFixed(2)}GB`, "WARN");
        return false;
    }
    
    // Try to start it
    const pid = ns.exec(script, "home", 1, ...args);
    
    if (pid === 0) {
        log(ns, `Failed to start ${name} module: exec returned 0 (check for errors in module)`, "WARN");
        return false;
    } else {
        log(ns, `Started ${name} module (PID: ${pid})`, "INFO");
        return true;
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
        SCRIPTS.programs,
        SCRIPTS.activities,
        SCRIPTS.training,
        SCRIPTS.company,
        SCRIPTS.hacknet,
        SCRIPTS.stocks,
        SCRIPTS.gang,
        SCRIPTS.bladeburner,
        SCRIPTS.sleeves,
        SCRIPTS.xpFarm,
        SCRIPTS.backdoor,
        "/angel/modules/backdoorRunner.js",
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
        { name: "Programs", script: SCRIPTS.programs, enabled: config.orchestrator.enablePrograms },
        { name: "Activities", script: SCRIPTS.activities, enabled: config.orchestrator.enableActivities },
        { name: "Training", script: SCRIPTS.training, enabled: config.orchestrator.enableTraining },
        { name: "Company", script: SCRIPTS.company, enabled: config.orchestrator.enableCompany },
        { name: "Hacknet", script: SCRIPTS.hacknet, enabled: config.orchestrator.enableHacknet },
        { name: "Stocks", script: SCRIPTS.stocks, enabled: config.orchestrator.enableStocks },
        { name: "Gang", script: SCRIPTS.gang, enabled: config.orchestrator.enableGang },
        { name: "Bladeburner", script: SCRIPTS.bladeburner, enabled: config.orchestrator.enableBladeburner },
        { name: "Sleeves", script: SCRIPTS.sleeves, enabled: config.orchestrator.enableSleeves },
        { name: "XP Farm", script: SCRIPTS.xpFarm, enabled: config.orchestrator.enableXPFarm },
        { name: "Backdoor", script: SCRIPTS.backdoor, enabled: config.orchestrator.enableBackdoorAuto },
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
