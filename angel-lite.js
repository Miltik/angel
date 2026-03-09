/**
 * ANGEL-LITE - Bootstrap System for Post-BitNode Victory
 * 
 * Bridges the gap between BitNode win (8GB home RAM) and full Angel readiness.
 * Runs autonomously to generate money, purchase RAM upgrades, and automatically
 * transition to full ANGEL orchestrator when ready.
 * 
 * AUTO-RESTART: Angel is configured to restart with this script after augmentation
 * resets. If you already have sufficient RAM for core modules, it will immediately 
 * transition to full Angel. If you have less, it will bootstrap until ready, then 
 * transition. This ensures Angel never dies, regardless of post-reset RAM.
 * 
 * RAM REQUIREMENT: Dynamically calculated based on actual core module sizes.
 * Typically ranges from 25-40GB depending on which modules are present.
 * 
 * Usage:
 *   run angel-lite.js
 * 
 * Features:
 * - Runs on 8GB home RAM
 * - Self-contained (no module dependencies)
 * - Automatic RAM upgrades
 * - Network scanning and rooting
 * - Worker deployment across network
 * - Angel-ready detection and handoff
 * - Dynamic RAM requirement calculation
 * 
 * @param {NS} ns
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    // RAM thresholds (ANGEL_READY_RAM calculated dynamically)
    MAX_HOME_RAM: 1024,             // Stop upgrading at this point
    RAM_SAFETY_BUFFER: 5,           // Extra GB for worker threads and safety
    
    // Upgrade behavior
    UPGRADE_SAFETY_MULTIPLIER: 1.5, // Have 1.5x cost before buying (more aggressive)
    AUTO_UPGRADE_RAM: true,          // Automatically purchase RAM upgrades
    
    // Crime settings
    USE_CRIME: true,                 // Use crime for early money (if singularity available)
    CRIME_UNTIL_LEVEL: 50,           // Stop crime at level 50 (reach this much faster now)
    CRIME_CYCLE_TIME: 30000,         // Check crime every 30s (less frequent interruption)
    
    // Worker ratios (prep-focused)
    HACK_RATIO: 1,
    GROW_RATIO: 12,                  // More aggressive growth
    WEAKEN_RATIO: 8,                 // More weakening for prep
    
    // Prep phase settings
    PREP_THRESHOLD: 0.9,             // Prep until 90% optimal
    PREP_CHECK_INTERVAL: 5000,       // Check prep status every 5s
    
    // Timings (ms)
    ANGEL_CHECK_INTERVAL: 5000,     // Check every 5s
    UPGRADE_CHECK_INTERVAL: 5000,   // Check every 5s (more frequent)
    NETWORK_SCAN_INTERVAL: 30000,   // Scan every 30s
    WORKER_DEPLOY_INTERVAL: 30000,  // Redeploy every 30s (more responsive)
    DISPLAY_UPDATE_INTERVAL: 1000,  // Update display every 1s
    
    // Transition
    AUTO_TRANSITION: true,           // Automatically launch Angel
    REQUIRE_SYNC: true,              // Download Angel via sync.js if missing
};

// Worker script paths
const WORKER_SCRIPTS = {
    hack: "/lite-hack.js",
    grow: "/lite-grow.js",
    weaken: "/lite-weaken.js",
};

// Global state
let state = {
    rootedServers: [],
    currentTarget: "n00dles",
    deployedWorkers: 0,
    lastMoneyCheck: 0,
    lastMoney: 0,
    moneyRate: 0,
    hasSingularity: false,
    currentActivity: "initializing",
    prepProgress: 0,
    crimeIncome: 0,
    hackIncome: 0,
    crimeAutoStartUsed: false,          // One-shot guard: only auto-start crime once per script run
};

// ============================================
// MAIN ENTRY POINT
// ============================================

export async function main(ns) {
    ns.disableLog("ALL");
    ns.tail();
    
    printBanner(ns);
    
    // Check if Angel is already running
    if (ns.isRunning("/angel/angel.js", "home")) {
        ns.tprint("❌ Full ANGEL is already running!");
        ns.tprint("Angel-lite is not needed.");
        return;
    }
    
    // Initial setup
    deployWorkerScripts(ns);
    
    // Check for Singularity access
    state.hasSingularity = checkSingularityAccess(ns);
    if (state.hasSingularity) {
        ns.print("✓ Singularity access detected - crime automation enabled");
    }
    
    let lastAngelCheck = 0;
    let lastUpgradeCheck = 0;
    let lastNetworkScan = 0;
    let lastWorkerDeploy = 0;
    let lastCrimeCheck = 0;
    let lastPrepCheck = 0;
    let lastDisplay = 0;
    
    ns.print("🚀 Angel-lite bootstrap started");
    ns.print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Main loop
    while (true) {
        const now = Date.now();
        
        try {
            // Check for Angel readiness (every 5s)
            if (now - lastAngelCheck > CONFIG.ANGEL_CHECK_INTERVAL) {
                if (checkAngelReady(ns)) {
                    await transitionToAngel(ns);
                    return; // Exit if transition successful
                }
                lastAngelCheck = now;
            }
            
            // Attempt home RAM upgrade (every 5s)
            if (now - lastUpgradeCheck > CONFIG.UPGRADE_CHECK_INTERVAL) {
                await manageHomeUpgrade(ns);
                lastUpgradeCheck = now;
            }
            
            // Crime check (if enabled and singularity available)
            if (CONFIG.USE_CRIME && state.hasSingularity && now - lastCrimeCheck > CONFIG.CRIME_CYCLE_TIME) {
                await manageCrime(ns);
                lastCrimeCheck = now;
            }
            
            // Check prep status (every 5s)
            if (now - lastPrepCheck > CONFIG.PREP_CHECK_INTERVAL) {
                checkPrepStatus(ns);
                lastPrepCheck = now;
            }
            
            // Full network scan + rooting (every 30s)
            if (now - lastNetworkScan > CONFIG.NETWORK_SCAN_INTERVAL) {
                scanAndRoot(ns);
                lastNetworkScan = now;
            }
            
            // Redeploy workers (every 30s)
            if (now - lastWorkerDeploy > CONFIG.WORKER_DEPLOY_INTERVAL) {
                await deployHackingWorkers(ns);
                lastWorkerDeploy = now;
            }
            
            // Update display (every 1s)
            if (now - lastDisplay > CONFIG.DISPLAY_UPDATE_INTERVAL) {
                updateDisplay(ns);
                lastDisplay = now;
            }
            
        } catch (e) {
            ns.print(`❌ Error: ${e}`);
        }
        
        await ns.sleep(1000);
    }
}

// ============================================
// SINGULARITY ACCESS CHECK
// ============================================

function checkSingularityAccess(ns) {
    try {
        ns.singularity.getOwnedAugmentations();
        return true;
    } catch (e) {
        return false;
    }
}

// ============================================
// WORKER SCRIPT DEPLOYMENT
// ============================================

function deployWorkerScripts(ns) {
    // Write minimal worker scripts to disk
    const hackWorker = `export async function main(ns){const t=ns.args[0];while(true){await ns.hack(t);}}`;
    const growWorker = `export async function main(ns){const t=ns.args[0];while(true){await ns.grow(t);}}`;
    const weakenWorker = `export async function main(ns){const t=ns.args[0];while(true){await ns.weaken(t);}}`;
    
    ns.write(WORKER_SCRIPTS.hack, hackWorker, "w");
    ns.write(WORKER_SCRIPTS.grow, growWorker, "w");
    ns.write(WORKER_SCRIPTS.weaken, weakenWorker, "w");
    
    ns.print("✓ Worker scripts deployed");
}

// ============================================
// NETWORK SCANNING & ROOTING
// ============================================

function scanAndRoot(ns) {
    const allServers = scanNetwork(ns);
    const newlyRooted = [];
    
    for (const server of allServers) {
        if (server === "home") continue;
        if (ns.hasRootAccess(server)) continue;
        
        if (tryGainRoot(ns, server)) {
            newlyRooted.push(server);
        }
    }
    
    state.rootedServers = allServers.filter(s => ns.hasRootAccess(s));
    
    if (newlyRooted.length > 0) {
        ns.print(`✓ Rooted ${newlyRooted.length} new servers: ${newlyRooted.join(", ")}`);
    }
    
    return state.rootedServers;
}

function scanNetwork(ns) {
    const visited = new Set();
    const queue = ["home"];
    
    while (queue.length > 0) {
        const current = queue.shift();
        if (visited.has(current)) continue;
        visited.add(current);
        
        const neighbors = ns.scan(current);
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                queue.push(neighbor);
            }
        }
    }
    
    return Array.from(visited);
}

function tryGainRoot(ns, server) {
    if (ns.hasRootAccess(server)) return true;
    
    const reqLevel = ns.getServerRequiredHackingLevel(server);
    const playerLevel = ns.getHackingLevel();
    
    if (reqLevel > playerLevel) return false;
    
    // Open ports
    let portsOpened = 0;
    const reqPorts = ns.getServerNumPortsRequired(server);
    
    if (ns.fileExists("BruteSSH.exe", "home")) {
        ns.brutessh(server);
        portsOpened++;
    }
    if (ns.fileExists("FTPCrack.exe", "home")) {
        ns.ftpcrack(server);
        portsOpened++;
    }
    if (ns.fileExists("relaySMTP.exe", "home")) {
        ns.relaysmtp(server);
        portsOpened++;
    }
    if (ns.fileExists("HTTPWorm.exe", "home")) {
        ns.httpworm(server);
        portsOpened++;
    }
    if (ns.fileExists("SQLInject.exe", "home")) {
        ns.sqlinject(server);
        portsOpened++;
    }
    
    if (portsOpened >= reqPorts) {
        try {
            ns.nuke(server);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    return false;
}

// ============================================
// CRIME AUTOMATION
// ============================================

async function manageCrime(ns) {
    const hackLevel = ns.getHackingLevel();
    
    if (hackLevel >= CONFIG.CRIME_UNTIL_LEVEL) {
        state.currentActivity = "hacking";
        return;
    }
    
    try {
        const currentWork = ns.singularity.getCurrentWork();
        
        // If already doing crime, just track it
        if (currentWork && currentWork.type === "CRIME") {
            state.currentActivity = `crime: ${currentWork.crimeType}`;
            return; // Crime is running, never touch it again
        }
        
        // If player manually switched to something else, respect it
        if (currentWork && currentWork.type && currentWork.type !== "IDLE") {
            state.currentActivity = currentWork.type.toLowerCase();
            return;
        }
    } catch (e) {
        return;
    }
    
    // Player is idle and no crime running.
    // Hard guard: never auto-start another crime after the first auto-start.
    if (state.crimeAutoStartUsed) {
        return;
    }
    
    // First time: evaluate and start initial crime
    const crimes = [
        { name: "Shoplift", moneyPerSec: 15 },
        { name: "Rob Store", moneyPerSec: 60 },
        { name: "Mug", moneyPerSec: 45 },
        { name: "Larceny", moneyPerSec: 90 },
        { name: "Deal Drugs", moneyPerSec: 120 },
        { name: "Bond Forgery", moneyPerSec: 150 },
        { name: "Traffick Arms", moneyPerSec: 200 },
        { name: "Homicide", moneyPerSec: 250 },
        { name: "Grand Theft Auto", moneyPerSec: 300 },
        { name: "Kidnap", moneyPerSec: 350 },
        { name: "Assassination", moneyPerSec: 400 },
        { name: "Heist", moneyPerSec: 800 },
    ];
    
    let bestCrime = crimes[0];
    let bestScore = 0;
    
    for (const crime of crimes) {
        try {
            const chance = ns.singularity.getCrimeChance(crime.name);
            const score = crime.moneyPerSec * chance;
            if (score > bestScore) {
                bestScore = score;
                bestCrime = crime;
            }
        } catch (e) {
            // Not available
        }
    }
    
    try {
        ns.singularity.commitCrime(bestCrime.name);
        state.crimeAutoStartUsed = true;
        state.currentActivity = `crime: ${bestCrime.name}`;
    } catch (e) {
        state.currentActivity = "hacking";
    }
}

// ============================================
// PREP STATUS CHECKING
// ============================================

function checkPrepStatus(ns) {
    const target = state.currentTarget;
    if (!target) return;
    
    try {
        const server = ns.getServer(target);
        const minSec = server.minDifficulty;
        const maxMoney = server.moneyMax;
        const currentSec = server.hackDifficulty;
        const currentMoney = server.moneyAvailable;
        
        const secProgress = currentSec <= minSec * 1.1 ? 1 : (minSec / currentSec);
        const moneyProgress = maxMoney > 0 ? (currentMoney / maxMoney) : 1;
        
        state.prepProgress = Math.min(secProgress, moneyProgress) * 100;
    } catch (e) {
        state.prepProgress = 0;
    }
}

// ============================================
// TARGET SELECTION
// ============================================

function selectBestTarget(ns) {
    const rootedServers = state.rootedServers.filter(s => s !== "home");
    const hackLevel = ns.getHackingLevel();
    
    // Filter to hackable servers with money
    const candidates = rootedServers
        .filter(s => ns.getServerMaxMoney(s) > 0)
        .filter(s => ns.getServerRequiredHackingLevel(s) <= hackLevel)
        .map(s => {
            const maxMoney = ns.getServerMaxMoney(s);
            const minSec = ns.getServerMinSecurityLevel(s);
            const reqLevel = ns.getServerRequiredHackingLevel(s);
            const growthRate = ns.getServerGrowth(s);
            
            // Score based on money, growth rate, and inverse of security
            const score = (maxMoney * (growthRate / 100)) / Math.max(1, minSec);
            
            return {
                name: s,
                maxMoney,
                minSec,
                reqLevel,
                growthRate,
                score,
            };
        })
        .sort((a, b) => b.score - a.score);
    
    if (candidates.length === 0) {
        return "n00dles"; // Fallback
    }
    
    // Select top target
    const newTarget = candidates[0].name;
    
    // Only log if target changed
    if (newTarget !== state.currentTarget) {
        ns.print(`✓ New target: ${newTarget} (max: ${formatMoney(candidates[0].maxMoney)}, growth: ${candidates[0].growthRate})`);
    }
    
    state.currentTarget = newTarget;
    return newTarget;
}

// ============================================
// WORKER DEPLOYMENT
// ============================================

async function deployHackingWorkers(ns) {
    // Kill existing workers
    for (const server of state.rootedServers) {
        ns.killall(server, true);
    }
    
    // Select target
    const target = selectBestTarget(ns);
    
    // Calculate total available RAM
    let totalRam = 0;
    const serverRams = [];
    
    for (const server of state.rootedServers) {
        const maxRam = ns.getServerMaxRam(server);
        const usedRam = ns.getServerUsedRam(server);
        let availRam = maxRam - usedRam;
        
        // Reserve RAM on home for angel-lite
        if (server === "home") {
            availRam = Math.max(0, availRam - 8); // Reserve 8GB for angel-lite + singularity operations
        }
        
        if (availRam > 1.75) { // Minimum for one worker
            serverRams.push({ server, availRam });
            totalRam += availRam;
        }
    }
    
    if (totalRam < 2) {
        ns.print("⚠️  Insufficient RAM for workers");
        state.deployedWorkers = 0;
        return;
    }
    
    // Calculate worker distribution
    const hackRam = ns.getScriptRam(WORKER_SCRIPTS.hack);
    const growRam = ns.getScriptRam(WORKER_SCRIPTS.grow);
    const weakenRam = ns.getScriptRam(WORKER_SCRIPTS.weaken);
    
    const totalRatio = CONFIG.HACK_RATIO + CONFIG.GROW_RATIO + CONFIG.WEAKEN_RATIO;
    const avgRam = (hackRam * CONFIG.HACK_RATIO + growRam * CONFIG.GROW_RATIO + weakenRam * CONFIG.WEAKEN_RATIO) / totalRatio;
    
    const totalThreads = Math.floor(totalRam / avgRam);
    const hackThreads = Math.floor(totalThreads * CONFIG.HACK_RATIO / totalRatio);
    const growThreads = Math.floor(totalThreads * CONFIG.GROW_RATIO / totalRatio);
    const weakenThreads = Math.floor(totalThreads * CONFIG.WEAKEN_RATIO / totalRatio);
    
    // Deploy workers
    let deployed = 0;
    deployed += deployWorkerType(ns, serverRams, WORKER_SCRIPTS.hack, target, hackThreads);
    deployed += deployWorkerType(ns, serverRams, WORKER_SCRIPTS.grow, target, growThreads);
    deployed += deployWorkerType(ns, serverRams, WORKER_SCRIPTS.weaken, target, weakenThreads);
    
    state.deployedWorkers = deployed;
    ns.print(`✓ Deployed ${deployed} workers targeting ${target}`);
}

function deployWorkerType(ns, serverRams, script, target, threads) {
    const scriptRam = ns.getScriptRam(script);
    let remainingThreads = threads;
    let deployed = 0;
    
    for (const { server, availRam } of serverRams) {
        if (remainingThreads <= 0) break;
        
        const maxThreads = Math.floor(availRam / scriptRam);
        const threadsToRun = Math.min(maxThreads, remainingThreads);
        
        if (threadsToRun > 0) {
            try {
                ns.scp(script, server, "home");
                const pid = ns.exec(script, server, threadsToRun, target);
                if (pid > 0) {
                    deployed += threadsToRun;
                    remainingThreads -= threadsToRun;
                }
            } catch (e) {
                // Skip this server
            }
        }
    }
    
    return deployed;
}

// ============================================
// HOME RAM UPGRADE
// ============================================

async function manageHomeUpgrade(ns) {
    const currentRam = ns.getServerMaxRam("home");
    
    if (currentRam >= CONFIG.MAX_HOME_RAM) {
        return false;
    }
    
    // If we have singularity and auto-upgrade is enabled, buy upgrades
    if (!state.hasSingularity || !CONFIG.AUTO_UPGRADE_RAM) {
        return false;
    }
    
    try {
        const upgradeCost = ns.singularity.getUpgradeHomeRamCost();
        const money = ns.getServerMoneyAvailable("home");
        const safeThreshold = upgradeCost * CONFIG.UPGRADE_SAFETY_MULTIPLIER;
        
        if (money >= safeThreshold) {
            const success = ns.singularity.upgradeHomeRam();
            if (success) {
                const newRam = ns.getServerMaxRam("home");
                ns.print(`✓ RAM UPGRADED: ${currentRam}GB → ${newRam}GB`);
                ns.tprint(`✓ RAM UPGRADED: ${currentRam}GB → ${newRam}GB for ${formatMoney(upgradeCost)}`);
                return true;
            }
        }
    } catch (e) {
        // Upgrade not available or error
    }
    
    return false;
}

// ============================================
// ANGEL READINESS & TRANSITION
// ============================================

/**
 * Calculate the minimum RAM needed to run core ANGEL modules
 * Dynamically checks actual file sizes instead of using hardcoded values
 * @param {NS} ns
 * @returns {number} - Required RAM in GB
 */
function calculateAngelRamRequirement(ns) {
    const angelPath = "/angel/angel.js";
    
    // If Angel files don't exist yet, return conservative estimate
    if (!ns.fileExists(angelPath, "home")) {
        return 32; // Conservative estimate for full core Angel
    }
    
    let totalRam = 0;
    
    // Core orchestrator
    totalRam += ns.getScriptRam(angelPath, "home");
    
    // Core modules (required for Angel to function)
    const coreModules = [
        "/angel/modules/phase.js",
        "/angel/modules/programs.js",
        "/angel/modules/servers.js",
        "/angel/modules/factions.js",
        "/angel/modules/activities.js",
        "/angel/modules/crime.js",
        "/angel/modules/augments.js",
        "/angel/modules/hacking.js",
    ];
    
    // Services layer (shared infrastructure)
    const services = [
        "/angel/services/network.js",
        "/angel/services/rooting.js",
        "/angel/services/stats.js",
        "/angel/services/moduleRegistry.js",
        "/angel/services/events.js",
        "/angel/services/cache.js",
    ];
    
    // Supporting modules (needed by core modules)
    const supporting = [
        "/angel/modules/training.js",
        "/angel/modules/work.js",
        "/angel/modules/reset.js",
        "/angel/modules/history.js",
        "/angel/modules/metrics.js",
    ];
    
    // Calculate total for files that exist
    const allFiles = [...coreModules, ...services, ...supporting];
    let foundFiles = 0;
    
    for (const file of allFiles) {
        if (ns.fileExists(file, "home")) {
            totalRam += ns.getScriptRam(file, "home");
            foundFiles++;
        }
    }
    
    // Add safety buffer for worker threads and overhead
    totalRam += CONFIG.RAM_SAFETY_BUFFER;
    
    // If we found fewer than half the expected files, use estimate
    if (foundFiles < allFiles.length / 2) {
        return 32; // Files incomplete, use conservative estimate
    }
    
    return Math.ceil(totalRam);
}

function checkAngelReady(ns) {
    const homeRam = ns.getServerMaxRam("home");
    
    // Calculate required RAM dynamically
    const requiredRam = calculateAngelRamRequirement(ns);
    
    // Criteria:
    // 1. Home RAM >= required for core modules
    // 2. Either Angel files exist OR we have sync.js to download them
    
    const ramReady = homeRam >= requiredRam;
    const angelExists = ns.fileExists("/angel/angel.js", "home");
    const syncExists = ns.fileExists("/angel/sync.js", "home");
    
    return ramReady && (angelExists || syncExists);
}

async function transitionToAngel(ns) {
    ns.clearLog();
    ns.print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ns.print("    ANGEL-LITE → ANGEL TRANSITION    ");
    ns.print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    ns.tprint("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ns.tprint("    ANGEL-LITE → ANGEL TRANSITION    ");
    ns.tprint("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Stop all lite workers
    ns.print("Stopping all lite workers...");
    for (const server of state.rootedServers) {
        ns.killall(server, true);
    }
    await ns.sleep(500);
    
    // Download Angel if not present
    if (!ns.fileExists("/angel/angel.js", "home")) {
        ns.print("Downloading full ANGEL system...");
        ns.tprint("Downloading full ANGEL system via sync.js...");
        
        if (ns.fileExists("/angel/sync.js", "home")) {
            const pid = ns.exec("/angel/sync.js", "home");
            if (pid > 0) {
                ns.print("⏳ Waiting for sync to complete (30s)...");
                ns.tprint("⏳ Waiting for sync to complete...");
                await ns.sleep(30000);
            }
        } else {
            ns.print("❌ ERROR: Cannot find /angel/sync.js");
            ns.tprint("❌ ERROR: /angel/sync.js not found");
            ns.tprint("Please manually download Angel files");
            ns.tprint("Run: wget YOUR_REPO_URL/sync.js /angel/sync.js");
            ns.print("Angel-lite will continue running");
            return;
        }
    }
    
    // Verify Angel exists now
    if (!ns.fileExists("/angel/angel.js", "home")) {
        ns.print("❌ Angel files not found after sync");
        ns.tprint("❌ Angel files not available");
        ns.tprint("Angel-lite will continue running");
        return;
    }
    
    // Launch Angel
    ns.print("Launching full ANGEL orchestrator...");
    ns.tprint("🚀 Launching full ANGEL orchestrator...");
    
    const pid = ns.exec("/angel/start.js", "home");
    
    if (pid > 0) {
        ns.print("✓ ANGEL started successfully!");
        ns.tprint("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        ns.tprint("✓ ANGEL orchestrator started successfully!");
        ns.tprint("✓ Angel-lite shutting down...");
        ns.tprint("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        
        await ns.sleep(2000);
        ns.exit();
    } else {
        ns.print("✗ Failed to start ANGEL");
        ns.tprint("✗ Failed to start ANGEL (insufficient RAM?)");
        ns.tprint("Angel-lite will continue running");
    }
}

// ============================================
// DISPLAY & MONITORING
// ============================================

function updateDisplay(ns) {
    const homeRam = ns.getServerMaxRam("home");
    const money = ns.getServerMoneyAvailable("home");
    const hackLevel = ns.getHackingLevel();
    const requiredRam = calculateAngelRamRequirement(ns);
    
    // Calculate money rate
    const now = Date.now();
    if (state.lastMoneyCheck > 0) {
        const timeDiff = (now - state.lastMoneyCheck) / 1000; // seconds
        if (timeDiff > 0) {
            state.moneyRate = (money - state.lastMoney) / timeDiff;
        }
    }
    state.lastMoneyCheck = now;
    state.lastMoney = money;
    
    // Calculate progress (RAM only)
    const ramProgress = Math.min(100, (homeRam / requiredRam) * 100);
    const overallProgress = ramProgress;
    
    // Next upgrade info
    let upgradeCost = 0;
    let nextRam = homeRam * 2;
    let canAfford = false;
    
    if (state.hasSingularity) {
        try {
            upgradeCost = ns.singularity.getUpgradeHomeRamCost();
            canAfford = money >= upgradeCost * CONFIG.UPGRADE_SAFETY_MULTIPLIER;
        } catch (e) {
            // Can't get upgrade cost
        }
    }
    
    // Build display
    ns.clearLog();
    ns.print("╔════════════════════════════════════════════════════════════╗");
    ns.print("║              ANGEL-LITE BOOTSTRAP v1.1                     ║");
    ns.print("╚════════════════════════════════════════════════════════════╝");
    ns.print("");
    ns.print(`💰 Money:        ${formatMoney(money)}  (${state.moneyRate >= 0 ? "+" : ""}${formatMoney(state.moneyRate)}/sec)`);
    ns.print(`💾 Home RAM:     ${homeRam}GB / ${CONFIG.MAX_HOME_RAM}GB max`);
    ns.print(`💻 Hack Level:   ${hackLevel}`);
    ns.print(`🎯 Current:      ${state.currentActivity}`);
    ns.print("");
    ns.print(`🎯 Target:       ${state.currentTarget} (prep: ${state.prepProgress.toFixed(0)}%)`);
    ns.print(`🌐 Network:      ${state.rootedServers.length} servers rooted`);
    ns.print(`⚙️  Workers:      ${state.deployedWorkers} threads deployed`);
    
    if (state.hasSingularity) {
        ns.print(`🔓 Singularity:  Enabled (crime + auto-upgrade)`);
    }
    
    ns.print("");
    ns.print("📈 Progress to Angel:");
    ns.print(`  ${getProgressBar(overallProgress)}  ${overallProgress.toFixed(0)}%`);
    ns.print("");
    
    if (homeRam >= requiredRam) {
        ns.print("  ✓ Home RAM: Ready");
        ns.print("  ⏳ Transitioning to Angel...");
    } else {
        ns.print(`  ⏳ Home RAM: ${homeRam}GB / ${requiredRam}GB (core modules)`);
    }
    ns.print("");
    
    if (homeRam < CONFIG.MAX_HOME_RAM && state.hasSingularity) {
        const timeToUpgrade = canAfford ? "Ready now!" : 
            state.moneyRate > 0 ? formatTime((upgradeCost * CONFIG.UPGRADE_SAFETY_MULTIPLIER - money) / state.moneyRate) : "Unknown";
        const autoStatus = CONFIG.AUTO_UPGRADE_RAM && canAfford ? " [AUTO-BUY]" : "";
        ns.print(`Next upgrade: ${nextRam}GB RAM for ${formatMoney(upgradeCost)} ${canAfford ? "✓" : `(${timeToUpgrade})`}${autoStatus}`);
    } else if (homeRam < CONFIG.MAX_HOME_RAM) {
        ns.print(`Next upgrade: ${nextRam}GB RAM (buy via City → Purchase RAM)`);
    }
}

function getProgressBar(percent) {
    const filled = Math.floor(percent / 5);
    const empty = 20 - filled;
    return "[" + "█".repeat(filled) + "░".repeat(empty) + "]";
}

function formatMoney(num) {
    if (num >= 1e9) return "$" + (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return "$" + (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return "$" + (num / 1e3).toFixed(2) + "k";
    return "$" + num.toFixed(2);
}

function formatTime(seconds) {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    if (minutes < 60) return `${minutes}m ${secs}s`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}

function printBanner(ns) {
    ns.tprint("╔════════════════════════════════════════════════════════════╗");
    ns.tprint("║                                                            ║");
    ns.tprint("║                  ANGEL-LITE BOOTSTRAP                      ║");
    ns.tprint("║                       v1.0                                 ║");
    ns.tprint("║                                                            ║");
    ns.tprint("║  Post-BitNode bootstrap system for resource building      ║");
    ns.tprint("║  Automatically transitions to full ANGEL when ready       ║");
    ns.tprint("║                                                            ║");
    ns.tprint("╚════════════════════════════════════════════════════════════╝");
    ns.tprint("");
}
