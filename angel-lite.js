/**
 * ANGEL-LITE - Bootstrap System for Post-BitNode Victory
 * 
 * Bridges the gap between BitNode win (8GB home RAM) and full Angel readiness (64GB+).
 * Runs autonomously to generate money, purchase RAM upgrades, and automatically
 * transition to full ANGEL orchestrator when ready.
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
 * 
 * @param {NS} ns
 */

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    // RAM thresholds
    ANGEL_READY_RAM: 64,           // GB needed to run Angel
    MAX_HOME_RAM: 1024,             // Stop upgrading at this point
    ANGEL_READY_MONEY: 1000000,     // $1M for comfort margin
    
    // Upgrade behavior
    UPGRADE_SAFETY_MULTIPLIER: 2,   // Have 2x cost before buying
    
    // Worker ratios
    HACK_RATIO: 1,
    GROW_RATIO: 10,
    WEAKEN_RATIO: 5,
    
    // Timings (ms)
    ANGEL_CHECK_INTERVAL: 5000,     // Check every 5s
    UPGRADE_CHECK_INTERVAL: 10000,  // Check every 10s
    NETWORK_SCAN_INTERVAL: 30000,   // Scan every 30s
    WORKER_DEPLOY_INTERVAL: 60000,  // Redeploy every 60s
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
    
    let lastAngelCheck = 0;
    let lastUpgradeCheck = 0;
    let lastNetworkScan = 0;
    let lastWorkerDeploy = 0;
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
            
            // Attempt home RAM upgrade (every 10s)
            if (now - lastUpgradeCheck > CONFIG.UPGRADE_CHECK_INTERVAL) {
                await manageHomeUpgrade(ns);
                lastUpgradeCheck = now;
            }
            
            // Full network scan + rooting (every 30s)
            if (now - lastNetworkScan > CONFIG.NETWORK_SCAN_INTERVAL) {
                scanAndRoot(ns);
                lastNetworkScan = now;
            }
            
            // Redeploy workers (every 60s)
            if (now - lastWorkerDeploy > CONFIG.WORKER_DEPLOY_INTERVAL) {
                deployHackingWorkers(ns);
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
// TARGET SELECTION
// ============================================

function selectBestTarget(ns) {
    const rootedServers = state.rootedServers.filter(s => s !== "home");
    const hackLevel = ns.getHackingLevel();
    
    // Filter to hackable servers with money
    const candidates = rootedServers
        .filter(s => ns.getServerMaxMoney(s) > 0)
        .filter(s => ns.getServerRequiredHackingLevel(s) <= hackLevel)
        .map(s => ({
            name: s,
            maxMoney: ns.getServerMaxMoney(s),
            minSec: ns.getServerMinSecurityLevel(s),
            reqLevel: ns.getServerRequiredHackingLevel(s),
            score: ns.getServerMaxMoney(s) / Math.max(1, ns.getServerMinSecurityLevel(s)),
        }))
        .sort((a, b) => b.score - a.score);
    
    if (candidates.length === 0) {
        return "n00dles"; // Fallback
    }
    
    state.currentTarget = candidates[0].name;
    return candidates[0].name;
}

// ============================================
// WORKER DEPLOYMENT
// ============================================

function deployHackingWorkers(ns) {
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
            availRam = Math.max(0, availRam - 4); // Reserve 4GB
        }
        
        if (availRam > 1.75) { // Minimum for one worker
            serverRams.push({ server, availRam });
            totalRam += availRam;
        }
    }
    
    if (totalRam < 2) {
        ns.print("⚠️  Insufficient RAM for workers");
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
    
    const upgradeCost = ns.singularity.getUpgradeHomeRamCost();
    const money = ns.getServerMoneyAvailable("home");
    
    // Buy if we have 2x the cost (safety margin)
    if (money >= upgradeCost * CONFIG.UPGRADE_SAFETY_MULTIPLIER) {
        const success = ns.singularity.upgradeHomeRam();
        if (success) {
            const newRam = ns.getServerMaxRam("home");
            ns.print(`✓ Upgraded home RAM: ${currentRam}GB → ${newRam}GB`);
            ns.tprint(`✓ Home RAM upgraded to ${newRam}GB`);
            return true;
        }
    }
    
    return false;
}

// ============================================
// ANGEL READINESS & TRANSITION
// ============================================

function checkAngelReady(ns) {
    const homeRam = ns.getServerMaxRam("home");
    const money = ns.getServerMoneyAvailable("home");
    
    // Criteria:
    // 1. Home RAM >= 64GB
    // 2. Money >= $1M
    // 3. Either Angel files exist OR we have sync.js to download them
    
    const ramReady = homeRam >= CONFIG.ANGEL_READY_RAM;
    const moneyReady = money >= CONFIG.ANGEL_READY_MONEY;
    const angelExists = ns.fileExists("/angel/angel.js", "home");
    const syncExists = ns.fileExists("/angel/sync.js", "home");
    
    return ramReady && moneyReady && (angelExists || syncExists);
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
    
    // Calculate progress
    const ramProgress = Math.min(100, (homeRam / CONFIG.ANGEL_READY_RAM) * 100);
    const moneyProgress = Math.min(100, (money / CONFIG.ANGEL_READY_MONEY) * 100);
    const overallProgress = Math.min(100, (ramProgress + moneyProgress) / 2);
    
    // Next upgrade info
    const upgradeCost = ns.singularity.getUpgradeHomeRamCost();
    const nextRam = homeRam * 2;
    const canAfford = money >= upgradeCost * CONFIG.UPGRADE_SAFETY_MULTIPLIER;
    
    // Build display
    ns.clearLog();
    ns.print("╔════════════════════════════════════════════════════════════╗");
    ns.print("║              ANGEL-LITE BOOTSTRAP v1.0                     ║");
    ns.print("╚════════════════════════════════════════════════════════════╝");
    ns.print("");
    ns.print(`💰 Money:        ${formatMoney(money)}  (${state.moneyRate >= 0 ? "+" : ""}${formatMoney(state.moneyRate)}/sec)`);
    ns.print(`💾 Home RAM:     ${homeRam}GB / ${CONFIG.MAX_HOME_RAM}GB max`);
    ns.print(`🎯 Target:       ${state.currentTarget}`);
    ns.print(`🌐 Network:      ${state.rootedServers.length} servers rooted`);
    ns.print(`⚙️  Workers:      ${state.deployedWorkers} deployed`);
    ns.print(`💻 Hack Level:   ${hackLevel}`);
    ns.print("");
    ns.print("📈 Progress to Angel:");
    ns.print(`  ${getProgressBar(overallProgress)}  ${overallProgress.toFixed(0)}%`);
    ns.print("");
    
    if (homeRam >= CONFIG.ANGEL_READY_RAM && money >= CONFIG.ANGEL_READY_MONEY) {
        ns.print("  ✓ Home RAM: Ready");
        ns.print("  ✓ Money: Ready");
        ns.print("  ⏳ Transitioning to Angel...");
    } else {
        ns.print(`  ${homeRam >= CONFIG.ANGEL_READY_RAM ? "✓" : "⏳"} Home RAM: ${homeRam}GB / ${CONFIG.ANGEL_READY_RAM}GB`);
        ns.print(`  ${money >= CONFIG.ANGEL_READY_MONEY ? "✓" : "⏳"} Money: ${formatMoney(money)} / ${formatMoney(CONFIG.ANGEL_READY_MONEY)}`);
    }
    ns.print("");
    
    if (homeRam < CONFIG.MAX_HOME_RAM) {
        const timeToUpgrade = canAfford ? "Ready now!" : 
            state.moneyRate > 0 ? formatTime((upgradeCost * CONFIG.UPGRADE_SAFETY_MULTIPLIER - money) / state.moneyRate) : "Unknown";
        ns.print(`Next upgrade: ${nextRam}GB RAM for ${formatMoney(upgradeCost)} ${canAfford ? "✓" : `(${timeToUpgrade})`}`);
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
