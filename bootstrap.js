/**
 * BOOTSTRAP - Early Game Progression System
 * 
 * Bridges the gap from fresh BitNode (2GB home RAM) to Angel-Lite readiness (8GB RAM + $100M).
 * Self-contained and lightweight (~1-2GB RAM usage).
 * Automatically launches angel-lite.js when graduation criteria are met.
 * 
 * Usage:
 *   run bootstrap.js
 * 
 * Progression:
 *   bootstrap.js → [1-2 hours] → auto-launches angel-lite.js
 *   angel-lite.js → [until 64GB] → auto-launches angel.js
 *   angel.js → [full system]
 * 
 * @param {NS} ns
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    // Graduation criteria
    GRADUATION_RAM_GB: 8,
    GRADUATION_CASH: 100_000_000, // $100M
    
    // RAM upgrade behavior
    UPGRADE_SAFETY_MULTIPLIER: 3,  // Have 3x cost before buying
    MAX_HOME_RAM: 32,              // Stop at 32GB (angel-lite takes over)
    
    // Crime contracts
    CRIME_FOCUS: "fraud",          // Best early money
    CRIME_CHECK_INTERVAL: 5000,    // Check available crimes every 5s
    
    // Hacking targets (in order of preference)
    HACK_TARGETS: [
        "n00dles",
        "joesguns",
        "foodnstuff",
        "sigma-cosmetics",
        "nectar-net",
    ],
    
    // Timings
    NETWORK_SCAN_INTERVAL: 30000,
    WORKER_DEPLOY_INTERVAL: 60000,
    DISPLAY_UPDATE_INTERVAL: 1000,
    GRADUATION_CHECK_INTERVAL: 5000,
    
    // Display
    SHOW_TAIL: true,
};

// ============================================
// GLOBAL STATE
// ============================================

const state = {
    startTime: 0,
    rootedServers: [],
    currentTarget: "n00dles",
    deployedThreads: 0,
    lastMoneyCheck: 0,
    lastMoney: 0,
    moneyRate: 0,
    crimeInProgress: null,
};

// ============================================
// MAIN ENTRY POINT
// ============================================

export async function main(ns) {
    ns.disableLog("ALL");
    if (CONFIG.SHOW_TAIL) ns.tail();
    
    state.startTime = Date.now();
    printBanner(ns);
    
    // Check for conflicts
    if (ns.isRunning("/angel/angel.js", "home")) {
        ns.print("❌ Full ANGEL is already running!");
        ns.print("Bootstrap is not needed.");
        return;
    }
    
    if (ns.isRunning("/angel-lite.js", "home")) {
        ns.print("❌ Angel-Lite is already running!");
        ns.print("Bootstrap is not needed.");
        return;
    }
    
    // Initialize minimal workers
    deployWorkerScripts(ns);
    
    // Timing trackers
    let lastNetworkScan = 0;
    let lastWorkerDeploy = 0;
    let lastDisplay = 0;
    let lastGraduationCheck = 0;
    
    ns.print("🚀 Bootstrap started - targeting graduation in 1-2 hours");
    ns.print(`📊 Goal: ${CONFIG.GRADUATION_RAM_GB}GB RAM + $${(CONFIG.GRADUATION_CASH / 1_000_000).toFixed(0)}M`);
    ns.print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Main loop
    while (true) {
        const now = Date.now();
        
        try {
            // Check for graduation (every 5s)
            if (now - lastGraduationCheck > CONFIG.GRADUATION_CHECK_INTERVAL) {
                if (checkGraduation(ns)) {
                    await transitionToAngelLite(ns);
                    return;
                }
                lastGraduationCheck = now;
            }
            
            // Attempt home RAM upgrade (background, low priority)
            attemptHomeUpgrade(ns);
            
            // Network scan + rooting (every 30s)
            if (now - lastNetworkScan > CONFIG.NETWORK_SCAN_INTERVAL) {
                scanAndRoot(ns);
                lastNetworkScan = now;
            }
            
            // Deploy workers (every 60s)
            if (now - lastWorkerDeploy > CONFIG.WORKER_DEPLOY_INTERVAL) {
                deployWorkers(ns);
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
// WORKER SCRIPT DEPLOYMENT
// ============================================

function deployWorkerScripts(ns) {
    // Minimal worker scripts - no dependencies
    const hackWorker = `export async function main(ns){const t=ns.args[0];while(true){await ns.hack(t);}}`;
    const growWorker = `export async function main(ns){const t=ns.args[0];while(true){await ns.grow(t);}}`;
    const weakenWorker = `export async function main(ns){const t=ns.args[0];while(true){await ns.weaken(t);}}`;
    
    ns.write("/bootstrap-hack.js", hackWorker, "w");
    ns.write("/bootstrap-grow.js", growWorker, "w");
    ns.write("/bootstrap-weaken.js", weakenWorker, "w");
    
    ns.print("✓ Minimal worker scripts deployed");
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
// HOME RAM UPGRADE
// ============================================

function attemptHomeUpgrade(ns) {
    const currentRam = ns.getServerMaxRam("home");
    
    // Stop if we're at the bridge threshold
    if (currentRam >= CONFIG.MAX_HOME_RAM * 1_024 * 1_024 * 1_024) {
        return;
    }
    
    const upgradePrice = ns.singularity.getUpgradeHomeRamCost();
    const cash = ns.getPlayer().money;
    const safetyThreshold = upgradePrice * CONFIG.UPGRADE_SAFETY_MULTIPLIER;
    
    // Only upgrade if we have safety margin
    if (cash > safetyThreshold && cash > 10_000_000) {
        try {
            ns.singularity.upgradeHomeRam();
        } catch (e) {
            // Upgrade not available yet
        }
    }
}

// ============================================
// WORKER DEPLOYMENT
// ============================================

function deployWorkers(ns) {
    // Kill all existing workers
    ns.killall("home", true);
    
    // Select best target
    selectBestTarget(ns);
    const target = state.currentTarget;
    
    // Weaken target to minimum security first
    const minSec = ns.getServerMinSecurityLevel(target);
    const currentSec = ns.getServerSecurityLevel(target);
    
    if (currentSec > minSec + 1) {
        // Weaken is priority
        const weakenRam = ns.getScriptRam("/bootstrap-weaken.js", "home");
        const threads = Math.max(1, Math.floor((ns.getServerMaxRam("home") * 0.8) / weakenRam));
        ns.run("/bootstrap-weaken.js", threads, target);
        state.deployedThreads = threads;
    } else {
        // Target is weak enough, do grow + weaken
        const availableRam = ns.getServerMaxRam("home") * 0.8;
        const growRam = ns.getScriptRam("/bootstrap-grow.js", "home");
        const weakenRam = ns.getScriptRam("/bootstrap-weaken.js", "home");
        
        const growThreads = Math.max(1, Math.floor(availableRam * 0.7 / growRam));
        const weakenThreads = Math.max(1, Math.floor(availableRam * 0.3 / weakenRam));
        
        ns.run("/bootstrap-grow.js", growThreads, target);
        ns.run("/bootstrap-weaken.js", weakenThreads, target);
        
        state.deployedThreads = growThreads + weakenThreads;
    }
}

function selectBestTarget(ns) {
    const hackLevel = ns.getHackingLevel();
    
    // Try preferred targets first
    for (const target of CONFIG.HACK_TARGETS) {
        if (!ns.serverExists(target)) continue;
        if (ns.getServerRequiredHackingLevel(target) > hackLevel) continue;
        if (ns.getServerMaxMoney(target) === 0) continue;
        
        state.currentTarget = target;
        return target;
    }
    
    // Fallback: scan for any hackable money server
    const rootedServers = state.rootedServers.filter(s => s !== "home");
    const candidates = rootedServers
        .filter(s => ns.getServerMaxMoney(s) > 0)
        .filter(s => ns.getServerRequiredHackingLevel(s) <= hackLevel)
        .sort((a, b) => ns.getServerMaxMoney(b) - ns.getServerMaxMoney(a));
    
    if (candidates.length > 0) {
        state.currentTarget = candidates[0];
    }
    
    return state.currentTarget;
}

// ============================================
// GRADUATION CHECK
// ============================================

function checkGraduation(ns) {
    const ramGb = ns.getServerMaxRam("home") / 1_024 / 1_024 / 1_024;
    const cash = ns.getPlayer().money;
    
    const ramReady = ramGb >= CONFIG.GRADUATION_RAM_GB;
    const cashReady = cash >= CONFIG.GRADUATION_CASH;
    
    return ramReady && cashReady;
}

// ============================================
// TRANSITION TO ANGEL-LITE
// ============================================

async function transitionToAngelLite(ns) {
    ns.print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ns.print("🎓 GRADUATION CRITERIA MET!");
    
    const ramGb = (ns.getServerMaxRam("home") / 1_024 / 1_024 / 1_024).toFixed(1);
    const cash = ns.formatNumber(ns.getPlayer().money);
    ns.print(`✓ Home RAM: ${ramGb}GB`);
    ns.print(`✓ Cash: ${cash}`);
    
    const elapsed = formatElapsed(Date.now() - state.startTime);
    ns.print(`⏱️  Bootstrap time: ${elapsed}`);
    
    // Kill all workers
    ns.killall("home", true);
    
    // Check if angel-lite exists
    if (!ns.fileExists("/angel-lite.js", "home")) {
        ns.print("⚠️  angel-lite.js not found!");
        ns.print("📥 Ensure angel-lite.js is downloaded to home");
        ns.print("Then run: run /angel-lite.js");
        return;
    }
    
    ns.print("🚀 Launching Angel-Lite...");
    await ns.sleep(2000);
    
    try {
        ns.run("/angel-lite.js");
        ns.print("✓ Angel-Lite launched successfully");
    } catch (e) {
        ns.print(`❌ Failed to launch Angel-Lite: ${e}`);
        ns.print("You can launch manually: run /angel-lite.js");
    }
}

// ============================================
// DISPLAY & FORMATTING
// ============================================

function updateDisplay(ns) {
    const ramGb = (ns.getServerMaxRam("home") / 1_024 / 1_024 / 1_024).toFixed(2);
    const ramProgress = (ramGb / CONFIG.GRADUATION_RAM_GB * 100).toFixed(0);
    
    const cash = ns.getPlayer().money;
    const cashProgress = (cash / CONFIG.GRADUATION_CASH * 100).toFixed(0);
    
    const elapsed = formatElapsed(Date.now() - state.startTime);
    
    // Update money rate
    const now = Date.now();
    if (state.lastMoneyCheck === 0) {
        state.lastMoneyCheck = now;
        state.lastMoney = cash;
    } else {
        const delta = now - state.lastMoneyCheck;
        if (delta >= 1000) {
            state.moneyRate = (cash - state.lastMoney) / delta;
            state.lastMoneyCheck = now;
            state.lastMoney = cash;
        }
    }
    
    const rateStr = state.moneyRate > 0 ? `$${ns.formatNumber(state.moneyRate * 1000)}/s` : "calculating...";
    
    ns.clearLog();
    ns.print("═══════════════════════════════════════════════════════");
    ns.print("🎯 BOOTSTRAP PROGRESSION");
    ns.print("═══════════════════════════════════════════════════════");
    ns.print(`⏱️  Elapsed: ${elapsed}`);
    ns.print("");
    ns.print(`RAM: ${ramGb}GB / ${CONFIG.GRADUATION_RAM_GB}GB [${ramProgress}%]`);
    ns.print(`💰 Cash: ${ns.formatNumber(cash)} / ${ns.formatNumber(CONFIG.GRADUATION_CASH)} [${cashProgress}%]`);
    ns.print(`📈 Rate: ${rateStr}`);
    ns.print("");
    ns.print(`🎯 Target: ${state.currentTarget}`);
    ns.print(`📡 Rooted servers: ${state.rootedServers.length}`);
    ns.print(`⚙️  Active threads: ${state.deployedThreads}`);
    ns.print("");
    ns.print("🚀 On graduation → auto-launches Angel-Lite");
    ns.print("═══════════════════════════════════════════════════════");
}

function formatElapsed(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (hours > 0) {
        return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${seconds}s`;
    } else {
        return `${seconds}s`;
    }
}

function printBanner(ns) {
    ns.print("╔═══════════════════════════════════════════════════════╗");
    ns.print("║          🚀 ANGEL BOOTSTRAP SYSTEM 🚀                 ║");
    ns.print("║     Early Game Progression to Angel-Lite Ready         ║");
    ns.print("╚═══════════════════════════════════════════════════════╝");
    ns.print("");
}
