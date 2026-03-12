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
import { getTotalAvailableRam, getServerStats } from "/angel/services/stats.js";
import { DAEMON_LOCK_PORT, PHASE_PORT } from "/angel/ports.js";
import * as Registry from "/angel/services/moduleRegistry.js";
import * as Events from "/angel/services/events.js";

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
    lastModuleIssueLog: {},
};

let remoteModuleState = {
    syncedHosts: new Set(),
};

export async function main(ns) {
    ns.disableLog("ALL");
    ns.clearLog();
    
    // Print banner
    printBanner(ns);
    
    // Open tail window
    ns.ui.openTail();
    
    // Initialize
    log(ns, "[DEBUG] Calling initialize()", "DEBUG");
    await initialize(ns);
    log(ns, "[DEBUG] Initialization complete", "DEBUG");

    // Main orchestration loop
    let loopCount = 0;
    while (true) {
        try {
            log(ns, `[DEBUG] Orchestrator loop start #${loopCount}` , "DEBUG");
            await orchestrate(ns);
            log(ns, `[DEBUG] Orchestrator loop end #${loopCount}` , "DEBUG");
        } catch (e) {
            log(ns, `[DEBUG] Orchestrator error: ${e}` , "ERROR");
        }
        loopCount++;
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

    // Initialize module registry from config
    Registry.clearRegistry();
    Registry.initializeFromConfig(ns);
    const moduleCount = Registry.getAllModules().size;
    log(ns, `Module registry initialized with ${moduleCount} modules`, "INFO");

    ensureLootArchiveSeed(ns);
    
    // Scan network
    const servers = scanAll(ns);
    log(ns, `Discovered ${servers.length} servers in network`, "INFO");
    
    // Try to root all servers
    const rooted = rootAll(ns);
    if (rooted > 0) {
        log(ns, `Successfully rooted ${rooted} servers`, "INFO");
        Events.publish("server.rooted.batch", {
            count: rooted,
            total: servers.length
        }, { source: "orchestrator" });
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

function ensureLootArchiveSeed(ns) {
    const seedPath = "/angel/loot/loot.txt";
    if (!ns.fileExists(seedPath, "home")) {
        ns.write(seedPath, "loot", "w");
        log(ns, "Initialized loot archive at /angel/loot/loot.txt", "INFO");
    }
}

/**
 * Main orchestration logic
 * @param {NS} ns
 */
async function orchestrate(ns) {
    // Check for commands from remote backend
    await checkBackendCommands(ns);

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

    // Avoid duplicate launches while backdoor module is active
    if (ns.isRunning(SCRIPTS.backdoor, "home")) {
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
    const homeFreeRam = Math.max(0, homeRam - ns.getServerUsedRam("home"));
    
    // Registry health
    const health = Registry.getHealthSummary(ns);
    
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
    ns.print(`│ Net Free RAM: ${formatRam(totalRam).padEnd(14)}│`);
    ns.print(`Home Free RAM: ${formatRam(homeFreeRam)} / ${formatRam(homeRam)}`);
    ns.print("├─────────────────────────────────────┤");
    ns.print(`│ Modules: ${health.running}/${health.enabled} running      │`);
    if (health.error > 0) {
        ns.print(`│ Errors: ${health.error}                         │`);
    }
    if (health.unhealthy.length > 0) {
        ns.print(`│ Unhealthy: ${health.unhealthy.slice(0, 2).join(", ")}...│`);
    }
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
        SCRIPTS.loot,
        SCRIPTS.contracts,
        SCRIPTS.formulas,
        SCRIPTS.backdoor,
    ];

    const currentPhase = getCurrentPhaseFromPort(ns);

    // Start non-hacking modules first to ensure they have RAM
    
    // Programs module
    if (config.orchestrator.enablePrograms) {
        log(ns, "[DEBUG] Launching Programs module", "DEBUG");
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
        log(ns, "[DEBUG] Launching Server Management module", "DEBUG");
        const started = await ensureModuleRunning(ns, SCRIPTS.serverMgmt, "Server Management");
        if (!started) blockedCoreModules.push("Server Management");
        coreReady = coreReady && started;
        await ns.sleep(1500);
    }
    
    // Augmentation module (if SF4 available)
    if (config.orchestrator.enableAugments) {
        log(ns, "[DEBUG] Launching Augmentations module", "DEBUG");
        const started = await ensureModuleRunning(ns, SCRIPTS.augments, "Augmentations");
        if (!started) blockedCoreModules.push("Augmentations");
        coreReady = coreReady && started;
        await ns.sleep(1500);

        log(ns, "[DEBUG] Launching Augments Worker module", "DEBUG");
        // Augments worker (executes purchasing decisions from augments-core)
        const startedAugmentsWorker = await ensureModuleRunning(ns, SCRIPTS.augmentsWorker, "Augments Worker");
        if (!startedAugmentsWorker) blockedCoreModules.push("Augments Worker");
        coreReady = coreReady && startedAugmentsWorker;
        await ns.sleep(1000);
    }
    
    // Phase tracker module (single source of truth for game phase)
    if (config.orchestrator.enablePhase) {
        log(ns, "[DEBUG] Launching Phase Tracker module", "DEBUG");
        const startedPhase = await ensureModuleRunning(ns, SCRIPTS.phase, "Phase Tracker");
        if (!startedPhase) blockedCoreModules.push("Phase Tracker");
        coreReady = coreReady && startedPhase;
        await ns.sleep(1500);
    }

    // Factions module (unlock + faction intelligence)
    if (config.orchestrator.enableFactions) {
        log(ns, "[DEBUG] Launching Factions module", "DEBUG");
        const started = await ensureModuleRunning(ns, SCRIPTS.factions, "Factions");
        if (!started) blockedCoreModules.push("Factions");
        coreReady = coreReady && started;
        await ns.sleep(1500);
    }
    
    // Activities module (coordinator: training, faction, company + mode signaling)
    if (config.orchestrator.enableActivities) {
        log(ns, "[DEBUG] Launching Activities module", "DEBUG");
        const started = await ensureModuleRunning(ns, SCRIPTS.activities, "Activities");
        if (!started) blockedCoreModules.push("Activities");
        coreReady = coreReady && started;
        await ns.sleep(1500);
    }

    // Training worker (executes training mode decisions from activities-core)
    log(ns, "[DEBUG] Launching Training module", "DEBUG");
    const startedTraining = await ensureModuleRunning(ns, SCRIPTS.training, "Training");
    if (!startedTraining) blockedCoreModules.push("Training");
    coreReady = coreReady && startedTraining;
    await ns.sleep(1000);

    // Work worker (executes faction/company mode decisions from activities-core)
    log(ns, "[DEBUG] Launching Work module", "DEBUG");
    const startedWork = await ensureModuleRunning(ns, SCRIPTS.work, "Work");
    if (!startedWork) blockedCoreModules.push("Work");
    coreReady = coreReady && startedWork;
    await ns.sleep(1000);

    // Crime module (dedicated worker, driven by activity mode)
    if (config.orchestrator.enableCrime) {
        log(ns, "[DEBUG] Launching Crime module", "DEBUG");
        const started = await ensureModuleRunning(ns, SCRIPTS.crime, "Crime");
        if (!started) blockedCoreModules.push("Crime");
        coreReady = coreReady && started;
        await ns.sleep(1500);
    }

    // Hacknet module
    if (config.orchestrator.enableHacknet) {
        log(ns, "[DEBUG] Launching Hacknet module", "DEBUG");
        const started = await ensureModuleRunning(ns, SCRIPTS.hacknet, "Hacknet");
        if (!started) blockedCoreModules.push("Hacknet");
        coreReady = coreReady && started;
        await ns.sleep(1500);
    }

    // Stocks module
    if (config.orchestrator.enableStocks) {
        log(ns, "[DEBUG] Launching Stocks module", "DEBUG");
        if (currentPhase >= 3) {
            await ensureModuleRunning(ns, SCRIPTS.stocks, "Stocks");
            await ns.sleep(1500);
        } else if (shouldLogDeferredModule("stocks-phase")) {
            log(ns, `Deferring Stocks module until phase 3 (current: ${currentPhase})`, "INFO");
        }
    }

    // Gang module (run immediately, not phase-gated)
    if (config.orchestrator.enableGang) {
        log(ns, "[DEBUG] Launching Gang module", "DEBUG");
        await ensureModuleRunning(ns, SCRIPTS.gang, "Gang");
        await ns.sleep(1500);
    }

    // Bladeburner module
    if (config.orchestrator.enableBladeburner) {
        if (currentPhase >= 4) {
            await ensureModuleRunning(ns, SCRIPTS.bladeburner, "Bladeburner");
            await ns.sleep(1500);
        } else if (shouldLogDeferredModule("bladeburner-phase")) {
            log(ns, `Deferring Bladeburner module until phase 4 (current: ${currentPhase})`, "INFO");
        }
    }

    // Sleeves module
    if (config.orchestrator.enableSleeves) {
        if (currentPhase >= 3) {
            await ensureModuleRunning(ns, SCRIPTS.sleeves, "Sleeves");
            await ns.sleep(1500);
        } else if (shouldLogDeferredModule("sleeves-phase")) {
            log(ns, `Deferring Sleeves module until phase 3 (current: ${currentPhase})`, "INFO");
        }
    }

    startupState.blockedCoreModules = blockedCoreModules;

    if (!coreReady) {
        return false;
    }

    // Dashboard module - monitoring (optional, non-blocking)
    if (config.orchestrator.enableDashboard) {
        await ensureModuleRunning(ns, SCRIPTS.dashboard, "Dashboard", [], {
            deferIfInsufficientRam: true,
            lowRamLogIntervalMs: 45000,
        });
        await ns.sleep(1500);
    }
    
    // Telemetry module - analytics (optional, non-blocking)
    if (config.telemetry?.enabled) {
        await ensureModuleRunning(ns, SCRIPTS.telemetry, "Telemetry", [], {
            deferIfInsufficientRam: true,
            lowRamLogIntervalMs: 60000,
        });
        await ns.sleep(1000);
    }

    // UI Launcher module - optional, non-blocking
    if (config.orchestrator.enableUILauncher) {
        await ensureModuleRunning(ns, SCRIPTS.uiLauncher, "UI Launcher", [], {
            deferIfInsufficientRam: true,
            lowRamLogIntervalMs: 45000,
        });
        await ns.sleep(1000);
    }
    
    // Formulas.exe farming - low RAM
    if (config.orchestrator.enableFormulas) {
        await ensureModuleRunning(ns, SCRIPTS.formulas, "Formulas", [], {
            deferIfInsufficientRam: true,
            lowRamLogIntervalMs: 45000,
        });
        await ns.sleep(1500);
    }
    
    // Network Map module - visualization
    if (config.orchestrator.enableNetworkMap) {
        await ensureModuleRunning(ns, SCRIPTS.networkMap, "Network Map", [], {
            deferIfInsufficientRam: true,
            lowRamLogIntervalMs: 45000,
        });
        await ns.sleep(1500);
    }

    const startupElapsedMs = Math.max(0, Date.now() - (startupState.startTs || Date.now()));
    const corporationDelayMs = Number(config.orchestrator?.startupCorporationDelayMs ?? 35000);
    const hackingDelayMs = Number(config.orchestrator?.startupHackingDelayMs ?? 45000);
    const xpFarmDelayMs = Number(config.orchestrator?.startupXPFarmDelayMs ?? 55000);
    const workerDelayMs = Number(config.orchestrator?.startupWorkerDelayMs ?? 90000);
    
    // Corporation module - starts first after core setup (before hacking RAM spike)
    if (config.orchestrator.enableCorporation) {
        if (startupElapsedMs >= corporationDelayMs) {
            if (currentPhase >= 3) {
                await ensureModuleRunning(ns, SCRIPTS.corporation, "Corporation", [], {
                    deferIfInsufficientRam: true,
                    lowRamLogIntervalMs: 45000,
                });
            } else if (shouldLogDeferredModule("corporation-phase")) {
                log(ns, `Deferring Corporation module until phase 3 (current: ${currentPhase})`, "INFO");
            }
        } else if (shouldLogDeferredModule("corporation")) {
            const remainingSec = Math.ceil((corporationDelayMs - startupElapsedMs) / 1000);
            log(ns, `Deferring Corporation module startup for ${remainingSec}s to prioritize core stability`, "INFO");
        }
    }

    // Coding Contracts solver - prioritize before worker-heavy modules
    if (config.orchestrator.enableContracts) {
        await ensureModuleRunning(ns, SCRIPTS.contracts, "Contracts", [], {
            deferIfInsufficientRam: true,
            lowRamLogIntervalMs: 45000,
        });
        await ns.sleep(1500);
    }

    // Loot collector - prioritize before worker-heavy modules
    if (config.orchestrator.enableLoot) {
        await ensureModuleRunning(ns, SCRIPTS.loot, "Loot", [], {
            deferIfInsufficientRam: true,
            lowRamLogIntervalMs: 45000,
        });
        await ns.sleep(1500);
    }

    // Hacking module - starts only after all utility modules have had launch window
    if (config.orchestrator.enableHacking) {
        const effectiveHackingDelayMs = Math.max(hackingDelayMs, workerDelayMs);
        if (startupElapsedMs >= effectiveHackingDelayMs) {
            await ensureModuleRunning(ns, SCRIPTS.hacking, "Hacking", [], {
                deferIfInsufficientRam: true,
                lowRamLogIntervalMs: 45000,
            });
        } else if (shouldLogDeferredModule("hacking")) {
            const remainingSec = Math.ceil((effectiveHackingDelayMs - startupElapsedMs) / 1000);
            log(ns, `Deferring Hacking module startup for ${remainingSec}s to let all modules stabilize first`, "INFO");
        }
    }

    // XP Farm module - starts after hacking (or after same delay when hacking disabled)
    if (config.orchestrator.enableXPFarm) {
        const effectiveXPFarmDelayMs = Math.max(xpFarmDelayMs, workerDelayMs + 10000);
        if (startupElapsedMs >= effectiveXPFarmDelayMs) {
            if (config.orchestrator.enableHacking && !ns.isRunning(SCRIPTS.hacking, "home")) {
                logThrottled(ns, "xpFarm-wait-hacking", "Deferring XP Farm startup until Hacking module is active", "INFO", 45000);
            } else {
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

                await ensureModuleRunning(ns, SCRIPTS.xpFarm, "XP Farm", xpArgs, {
                    deferIfInsufficientRam: true,
                    lowRamLogIntervalMs: 45000,
                });
            }
        } else if (shouldLogDeferredModule("xpFarm")) {
            const remainingSec = Math.ceil((effectiveXPFarmDelayMs - startupElapsedMs) / 1000);
            log(ns, `Deferring XP Farm startup for ${remainingSec}s to prioritize startup stability`, "INFO");
        }
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
        Registry.recordModuleError(name, `File not found: ${script}`);
        Events.publish(`module.${name}.error`, {
            error: "File not found",
            script
        }, { source: "orchestrator" });
        return false;
    }
    
    const reclaimOnLowRam = Boolean(options?.reclaimOnLowRam);
    const reclaimOrder = Array.isArray(options?.reclaimOrder) ? options.reclaimOrder : [];
    const deferIfInsufficientRam = Boolean(options?.deferIfInsufficientRam);
    const lowRamLogIntervalMs = Number(options?.lowRamLogIntervalMs ?? 30000);
    const allowRemoteStaging = Boolean(config.orchestrator?.enableRemoteModuleStaging ?? true);
    const migrateToHomeWhenPossible = Boolean(config.orchestrator?.migrateModulesToHomeWhenPossible ?? true);
    const remoteReserveRamGb = Number(config.orchestrator?.remoteModuleReserveRamGb ?? 8);
    const reclaimHomeWorkersForCore = Boolean(config.orchestrator?.reclaimHomeWorkersForCore ?? true);

    const registryModule = Registry.getModule(name);
    const trackedHost = registryModule?.host || "home";

    // Check if already running on tracked host (or discover if moved)
    if (ns.isRunning(script, trackedHost, ...args)) {
        // Update registry state if not already marked as running
        const module = Registry.getModule(name);
        if (module && module.state !== Registry.ModuleState.RUNNING) {
            Registry.updateModuleState(name, Registry.ModuleState.RUNNING, module.pid, trackedHost);
            Events.publish(`module.${name}.start`, {
                script,
                recovered: true
            }, { source: "orchestrator" });
        }

        // If running remotely, try to migrate back to home once home can host it.
        if (trackedHost !== "home" && migrateToHomeWhenPossible) {
            const scriptRam = ns.getScriptRam(script, "home");
            const homeFreeRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
            if (scriptRam <= homeFreeRam && ns.fileExists(script, "home")) {
                const newPid = ns.exec(script, "home", 1, ...args);
                if (newPid !== 0) {
                    if (module?.pid) {
                        ns.kill(module.pid);
                    } else {
                        ns.kill(script, trackedHost, ...args);
                    }
                    Registry.updateModuleState(name, Registry.ModuleState.RUNNING, newPid, "home");
                    log(ns, `Migrated ${name} module from ${trackedHost} to home (PID: ${newPid})`, "INFO");
                }
            }
        }
        return true;
    }

    // Discover if script is running on another rooted host and adopt it.
    const discoveredHost = findRunningHost(ns, script, args);
    if (discoveredHost) {
        const discoveredPid = findScriptPid(ns, discoveredHost, script, args);
        Registry.updateModuleState(name, Registry.ModuleState.RUNNING, discoveredPid, discoveredHost);
        return true;
    }
    
    // Check RAM requirements
    const scriptRam = ns.getScriptRam(script, "home");
    let availableRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");

    const homeMaxRam = ns.getServerMaxRam("home");

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
            Events.publish("system.ram.reclaim", {
                target: name,
                reclaimed
            }, { source: "orchestrator" });
        }
    }

    // If module can fit on home in theory, reclaim worker RAM first before offloading.
    // This preserves the strategy: keep core orchestration on home when possible,
    // and use network RAM for workers.
    if (
        scriptRam > availableRam &&
        reclaimHomeWorkersForCore &&
        scriptRam <= homeMaxRam
    ) {
        const reclaimedGb = reclaimHomeWorkerRam(ns);
        if (reclaimedGb > 0) {
            availableRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
            log(ns, `Reclaimed ${reclaimedGb.toFixed(2)}GB on home for ${name}`, "WARN");
        }
    }
    
    let targetHost = "home";

    if (scriptRam > availableRam) {
        if (allowRemoteStaging) {
            const remoteHost = pickRemoteModuleHost(ns, scriptRam, remoteReserveRamGb);
            if (remoteHost) {
                const syncOk = await ensureAngelFilesOnHost(ns, remoteHost);
                if (syncOk) {
                    targetHost = remoteHost;
                }
            }
        }

        if (targetHost === "home") {
            const impossibleOnCurrentHome = scriptRam > homeMaxRam;
            const detail = impossibleOnCurrentHome
                ? `${name} requires ${scriptRam.toFixed(2)}GB, but home max is ${homeMaxRam.toFixed(2)}GB`
                : `${name} needs ${scriptRam.toFixed(2)}GB, have ${availableRam.toFixed(2)}GB free on home`;

            if (deferIfInsufficientRam) {
                logThrottled(ns, `module-lowram-${name}`, `Deferring ${name} startup: ${detail}`, "INFO", lowRamLogIntervalMs);
            } else {
                logThrottled(ns, `module-lowram-${name}`, `Failed to start ${name} module: ${detail}`, "WARN", lowRamLogIntervalMs);
            }
            
            // Update registry state
            Registry.updateModuleState(name, Registry.ModuleState.STOPPED, null, "home");
            return false;
        }
    }
    
    // Try to start it
    Registry.updateModuleState(name, Registry.ModuleState.STARTING, null, targetHost);
    const pid = ns.exec(script, targetHost, 1, ...args);
    
    if (pid === 0) {
        if (targetHost === "home" && allowRemoteStaging) {
            // Fallback path: even if RAM calc looked fine (or was 0 due parser ambiguity),
            // attempt remote staging once before declaring failure.
            const remoteHost = pickRemoteModuleHost(ns, Math.max(1, scriptRam), remoteReserveRamGb);
            if (remoteHost) {
                const syncOk = await ensureAngelFilesOnHost(ns, remoteHost);
                if (syncOk) {
                    const remotePid = ns.exec(script, remoteHost, 1, ...args);
                    if (remotePid !== 0) {
                        log(ns, `Started ${name} module on ${remoteHost} via fallback (PID: ${remotePid})`, "INFO");
                        Registry.updateModuleState(name, Registry.ModuleState.RUNNING, remotePid, remoteHost);
                        Events.publish(`module.${name}.start`, {
                            script,
                            pid: remotePid,
                            args,
                            host: remoteHost,
                            fallback: true,
                        }, { source: "orchestrator" });
                        return true;
                    }
                    logThrottled(ns, `module-remote-exec-${name}`, `Remote fallback failed for ${name} on ${remoteHost}: exec returned 0`, "WARN", lowRamLogIntervalMs);
                } else {
                    logThrottled(ns, `module-remote-sync-${name}`, `Remote fallback sync failed for ${name} to ${remoteHost}`, "WARN", lowRamLogIntervalMs);
                }
            } else {
                logThrottled(ns, `module-remote-host-${name}`, `No remote host available for ${name} fallback`, "WARN", lowRamLogIntervalMs);
            }
        }

        const missingDeps = getMissingImportDependencies(ns, script);
        if (missingDeps.length > 0) {
            log(ns, `Failed to start ${name}: missing dependency files: ${missingDeps.slice(0, 3).join(", ")}${missingDeps.length > 3 ? "..." : ""}`, "WARN");
        }

        log(ns, `Failed to start ${name} module on ${targetHost}: exec returned 0 (check for errors in module)`, "WARN");
        Registry.recordModuleError(name, "exec() returned 0");
        Events.publish(`module.${name}.error`, {
            error: "exec() returned 0",
            script,
            host: targetHost
        }, { source: "orchestrator" });
        return false;
    } else {
        log(ns, `Started ${name} module on ${targetHost} (PID: ${pid})`, "INFO");
        Registry.updateModuleState(name, Registry.ModuleState.RUNNING, pid, targetHost);
        Events.publish(`module.${name}.start`, {
            script,
            pid,
            args,
            host: targetHost
        }, { source: "orchestrator" });
        return true;
    }
}

function pickRemoteModuleHost(ns, requiredRam, reserveRam = 8) {
    const rooted = getRootedServers(ns).filter(s => s !== "home");
    if (rooted.length === 0) return null;

    // Prioritize rooted servers purely by effective free RAM.
    // This works better early-game when purchased servers do not exist yet.
    const ordered = rooted.sort((a, b) => {
        const aEffective = (ns.getServerMaxRam(a) - ns.getServerUsedRam(a)) - reserveRam;
        const bEffective = (ns.getServerMaxRam(b) - ns.getServerUsedRam(b)) - reserveRam;

        if (bEffective !== aEffective) return bEffective - aEffective;

        // Tie-breaker: prefer larger max RAM host.
        const aMax = ns.getServerMaxRam(a);
        const bMax = ns.getServerMaxRam(b);
        return bMax - aMax;
    });

    for (const host of ordered) {
        const maxRam = ns.getServerMaxRam(host);
        if (maxRam <= 0) continue;
        const freeRam = maxRam - ns.getServerUsedRam(host) - reserveRam;
        if (freeRam >= requiredRam) {
            return host;
        }
    }

    return null;
}

async function ensureAngelFilesOnHost(ns, host) {
    if (host === "home") return true;

    if (remoteModuleState.syncedHosts.has(host)) {
        return true;
    }

    try {
        const filesAbs = ns.ls("home", "/angel/") || [];
        const filesRel = ns.ls("home", "angel/") || [];
        const files = Array.from(new Set([...filesAbs, ...filesRel]));
        if (!files || files.length === 0) return false;

        const ok = await deployFiles(ns, files, host);
        if (ok) {
            remoteModuleState.syncedHosts.add(host);
        }
        return ok;
    } catch (e) {
        return false;
    }
}

function findRunningHost(ns, script, args = []) {
    const candidates = ["home", ...getRootedServers(ns).filter(s => s !== "home")];
    for (const host of candidates) {
        if (ns.isRunning(script, host, ...args)) {
            return host;
        }
    }
    return null;
}

function findScriptPid(ns, host, script, args = []) {
    const processes = ns.ps(host);
    for (const process of processes) {
        if (process.filename !== script) continue;
        if (JSON.stringify(process.args || []) !== JSON.stringify(args || [])) continue;
        return Number(process.pid || 0) || null;
    }
    return null;
}

function logThrottled(ns, key, message, level = "INFO", intervalMs = 30000) {
    const now = Date.now();
    const last = Number(startupState.lastModuleIssueLog[key] || 0);
    if (now - last < intervalMs) {
        return;
    }
    startupState.lastModuleIssueLog[key] = now;
    log(ns, message, level);
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
        SCRIPTS.augments,
        SCRIPTS.programs,
        SCRIPTS.factions,
        SCRIPTS.activities,
        SCRIPTS.crime,
        SCRIPTS.hacknet,
        SCRIPTS.stocks,
        SCRIPTS.gang,
        SCRIPTS.bladeburner,
        SCRIPTS.sleeves,
        SCRIPTS.corporation,
        SCRIPTS.uiLauncher,
        SCRIPTS.xpFarm,
        SCRIPTS.loot,
        SCRIPTS.backdoor,
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
        { name: "Augments", script: SCRIPTS.augments, enabled: config.orchestrator.enableAugments },
        { name: "Augments Worker", script: SCRIPTS.augmentsWorker, enabled: config.orchestrator.enableAugments },
        { name: "Programs", script: SCRIPTS.programs, enabled: config.orchestrator.enablePrograms },
        { name: "Factions", script: SCRIPTS.factions, enabled: config.orchestrator.enableFactions },
        { name: "Activities", script: SCRIPTS.activities, enabled: config.orchestrator.enableActivities },
        { name: "Training", script: SCRIPTS.training, enabled: config.orchestrator.enableActivities },
        { name: "Work", script: SCRIPTS.work, enabled: config.orchestrator.enableActivities },
        { name: "Hacknet", script: SCRIPTS.hacknet, enabled: config.orchestrator.enableHacknet },
        { name: "Stocks", script: SCRIPTS.stocks, enabled: config.orchestrator.enableStocks },
        { name: "Gang", script: SCRIPTS.gang, enabled: config.orchestrator.enableGang },
        { name: "Bladeburner", script: SCRIPTS.bladeburner, enabled: config.orchestrator.enableBladeburner },
        { name: "Sleeves", script: SCRIPTS.sleeves, enabled: config.orchestrator.enableSleeves },
        { name: "Corporation", script: SCRIPTS.corporation, enabled: config.orchestrator.enableCorporation },
        { name: "UI Launcher", script: SCRIPTS.uiLauncher, enabled: config.orchestrator.enableUILauncher },
        { name: "XP Farm", script: SCRIPTS.xpFarm, enabled: config.orchestrator.enableXPFarm },
        { name: "Loot", script: SCRIPTS.loot, enabled: config.orchestrator.enableLoot },
        { name: "Backdoor", script: SCRIPTS.backdoor, enabled: config.orchestrator.enableBackdoorAuto },
        { name: "Crime", script: SCRIPTS.crime, enabled: config.orchestrator.enableCrime },
    ];
    
    const health = {
        allHealthy: true,
        modules: [],
    };
    
    for (const module of modules) {
        const registryName = module.name.toLowerCase() === "servers" ? "servers" : module.name.toLowerCase();
        let running = false;
        let host = "home";

        const reg = Registry.getModule(registryName)
            || Array.from(Registry.getAllModules().values()).find(m => m.path === module.script);
        if (reg) {
            host = reg.host || "home";
            running = ns.isRunning(module.script, host);
        } else {
            running = ns.isRunning(module.script, "home");
        }

        const healthy = !module.enabled || running;
        
        health.modules.push({
            name: module.name,
            enabled: module.enabled,
            running,
            healthy,
            host,
        });
        
        if (!healthy) {
            health.allHealthy = false;
        }
    }
    
    return health;
}
/**
 * Check for commands from remote backend and execute them
 * @param {NS} ns
 */
let lastCommandCheck = 0;
async function checkBackendCommands(ns) {
    try {
        const backendConfig = config.remoteBackend || {};
        if (!backendConfig.enabled) return;

        const now = Date.now();
        if (now - lastCommandCheck < (backendConfig.commandCheckIntervalMs || 30000)) {
            return;
        }
        lastCommandCheck = now;

        const backendUrl = backendConfig.url || 'http://localhost:3000';
        await syncDaemonUnlockSignal(ns, backendUrl);
        const response = await fetch(`${backendUrl}/api/commands`);
        
        if (!response.ok) return;

        const data = await response.json();
        const commands = data.commands || [];

        for (const cmd of commands) {
            await executeBackendCommand(ns, cmd);
        }
    } catch (error) {
        // Silently fail - don't disrupt orchestration
    }
}

async function syncDaemonUnlockSignal(ns, backendUrl) {
    try {
        const response = await fetch(`${backendUrl}/api/daemon-unlock-status`);
        if (!response.ok) return;

        const data = await response.json();
        if (data?.success !== true || data?.unlocked !== true) return;

        try {
            ns.clearPort(DAEMON_LOCK_PORT);
            ns.writePort(DAEMON_LOCK_PORT, 'UNLOCK_DAEMON');
            log(ns, '🔓 Daemon manual unlock signal synchronized to lock port', 'INFO');
        } catch (portError) {
            log(ns, `Failed to write daemon unlock signal: ${portError}`, 'WARN');
        }
    } catch (error) {
        // Silently fail - command polling must continue
    }
}

/**
 * Execute a command from the backend
 * @param {NS} ns
 * @param {Object} cmd Command object with id, type, parameters
 */
async function executeBackendCommand(ns, cmd) {
    try {
        const backendUrl = config.remoteBackend?.url || 'http://localhost:3000';

        switch (cmd.type) {
            case 'pause':
                log(ns, '⏸️ PAUSE command received from backend', 'INFO');
                // Set a flag that modules check periodically
                ns.write('/angel/paused', 'true', 'w');
                await markCommandExecuted(backendUrl, cmd.id, { status: 'paused' });
                break;

            case 'resume':
                log(ns, '▶️ RESUME command received from backend', 'INFO');
                ns.rm('/angel/paused');
                await markCommandExecuted(backendUrl, cmd.id, { status: 'resumed' });
                break;

            case 'report':
                log(ns, '📊 REPORT command received from backend', 'INFO');
                const pid = ns.exec(SCRIPTS.telemetryReport, 'home');
                await markCommandExecuted(backendUrl, cmd.id, { 
                    status: 'executing',
                    reportPid: pid 
                });
                break;

            case 'runModule':
                const moduleName = String(cmd.parameters?.module || '');
                const runScript = resolveModuleScript(moduleName);
                if (moduleName && runScript) {
                    log(ns, `▶️ Running module: ${moduleName}`, 'INFO');
                    const pid = ns.exec(runScript, 'home');
                    await markCommandExecuted(backendUrl, cmd.id, {
                        status: 'executing',
                        modulePid: pid
                    });
                } else {
                    await markCommandExecuted(backendUrl, cmd.id, {
                        status: 'failed',
                        error: `Unknown module: ${moduleName}`
                    });
                }
                break;

            case 'stopModule':
                const stopModuleName = String(cmd.parameters?.module || '');
                const stopScript = resolveModuleScript(stopModuleName);
                if (stopModuleName && stopScript) {
                    log(ns, `⏹️ Stopping module: ${stopModuleName}`, 'INFO');
                    const stopped = ns.kill(stopScript, 'home');
                    await markCommandExecuted(backendUrl, cmd.id, {
                        status: stopped ? 'stopped' : 'not-running',
                        module: stopModuleName,
                    });
                } else {
                    await markCommandExecuted(backendUrl, cmd.id, {
                        status: 'failed',
                        error: `Unknown module: ${stopModuleName}`
                    });
                }
                break;

            default:
                log(ns, `⚠️ Unknown backend command: ${cmd.type}`, 'WARN');
                await markCommandExecuted(backendUrl, cmd.id, {
                    status: 'failed',
                    error: `Unknown command type: ${cmd.type}`
                });
        }
    } catch (error) {
        // Log but don't crash
        log(ns, `Command execution error: ${error.message}`, 'ERROR');
    }
}

/**
 * Mark a command as executed in the backend
 * @param {string} backendUrl
 * @param {number} commandId
 * @param {Object} result
 */
async function markCommandExecuted(backendUrl, commandId, result) {
    try {
        await fetch(`${backendUrl}/api/commands/${commandId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: 'executed',
                result: result
            })
        });
    } catch (error) {
        // Silently fail - don't disrupt if backend is unavailable
    }
}

function resolveModuleScript(moduleName) {
    const normalized = String(moduleName || '').toLowerCase();
    const moduleScriptMap = {
        activities: SCRIPTS.activities,
        augments: SCRIPTS.augments,
        backdoor: SCRIPTS.backdoor,
        backdoorrunner: SCRIPTS.backdoor,
        bladeburner: SCRIPTS.bladeburner,
        contracts: SCRIPTS.contracts,
        corporation: SCRIPTS.corporation,
        factions: SCRIPTS.factions,
        formulas: SCRIPTS.formulas,
        gang: SCRIPTS.gang,
        hacking: SCRIPTS.hacking,
        hacknet: SCRIPTS.hacknet,
        loot: SCRIPTS.loot,
        phase: SCRIPTS.phase,
        programs: SCRIPTS.programs,
        servers: SCRIPTS.serverMgmt,
        sleeves: SCRIPTS.sleeves,
        stocks: SCRIPTS.stocks,
        xpfarm: SCRIPTS.xpFarm,
    };

    if (moduleScriptMap[normalized]) {
        return moduleScriptMap[normalized];
    }

    if (SCRIPTS[moduleName]) {
        return SCRIPTS[moduleName];
    }

    return null;
}

function getCurrentPhaseFromPort(ns) {
    const raw = ns.peek(PHASE_PORT);
    if (raw === "NULL PORT DATA") {
        return 0;
    }
    const phase = Number.parseInt(String(raw), 10);
    return Number.isFinite(phase) ? phase : 0;
}

function getMissingImportDependencies(ns, entryFile) {
    const visited = new Set();
    const missing = new Set();

    function walk(filePath) {
        const normalized = normalizeAngelPath(filePath);
        if (visited.has(normalized)) return;
        visited.add(normalized);

        const resolved = resolveExistingAngelFile(ns, normalized);
        if (!resolved) {
            missing.add(normalized);
            return;
        }

        const content = String(ns.read(resolved) || "");
        if (!content) return;

        const importRegex = /from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const raw = match[1] || match[2];
            if (!raw) continue;
            if (!raw.startsWith("/angel/") && !raw.startsWith("angel/") && !raw.startsWith("./") && !raw.startsWith("../")) continue;

            const dep = resolveAngelImportPath(resolved, raw);
            if (!dep.endsWith(".js")) continue;
            walk(dep);
        }
    }

    walk(entryFile);
    return Array.from(missing).sort();
}

function resolveAngelImportPath(baseFile, rawImport) {
    if (rawImport.startsWith("/angel/") || rawImport.startsWith("angel/")) {
        return normalizeAngelPath(rawImport);
    }

    const baseParts = normalizeAngelPath(baseFile).split("/");
    baseParts.pop();
    const relParts = rawImport.split("/");

    for (const part of relParts) {
        if (!part || part === ".") continue;
        if (part === "..") {
            if (baseParts.length > 0) baseParts.pop();
        } else {
            baseParts.push(part);
        }
    }

    return normalizeAngelPath(baseParts.join("/"));
}

function resolveExistingAngelFile(ns, path) {
    const normalized = normalizeAngelPath(path);
    const alternate = normalized.startsWith("/") ? normalized.slice(1) : null;

    if (ns.fileExists(normalized, "home")) return normalized;
    if (alternate && ns.fileExists(alternate, "home")) return alternate;
    return null;
}

function normalizeAngelPath(path) {
    const raw = String(path || "").replace(/\\/g, "/").trim();
    if (raw.startsWith("angel/")) return `/${raw}`;
    if (raw.startsWith("/")) return raw;
    return `/${raw}`;
}

function reclaimHomeWorkerRam(ns) {
    const workerScripts = new Set([
        SCRIPTS.hack,
        SCRIPTS.grow,
        SCRIPTS.weaken,
        SCRIPTS.share,
        "/lite-hack.js",
        "/lite-grow.js",
        "/lite-weaken.js",
    ]);

    const before = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
    const procs = ns.ps("home");

    for (const proc of procs) {
        const filename = String(proc.filename || "");
        const isWorker = workerScripts.has(filename)
            || filename.endsWith("/workers/hack.js")
            || filename.endsWith("/workers/grow.js")
            || filename.endsWith("/workers/weaken.js")
            || filename.endsWith("/workers/share.js");

        if (isWorker) {
            ns.kill(proc.pid);
        }
    }

    const after = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
    return Math.max(0, after - before);
}