import { createWindow } from "/angel/modules/uiManager.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    
    // Create DOM window for output
    const ui = createWindow("hacking", "🖥 Hacking Module", 700, 500);
    ui.log("Phase-aware dynamic targeting initialized");
    ui.log("Waiting for other modules to initialize...", "info");
    
    // Wait 5 seconds to let other modules start up first
    await ns.sleep(5000);
    
    ui.log("Beginning hacking operations", "success");
    
    while (true) {
        try {
            await hackingLoop(ns, ui);
        } catch (e) {
            ui.log(`Hacking loop error: ${e}`, "error");
        }
        await ns.sleep(200); // batchDelay
    }
}

/**
 * Main hacking loop - phase-aware
 * @param {NS} ns
 * @param {object} ui - UI window API
 */
async function hackingLoop(ns, ui) {
    // Read current game phase from orchestrator
    const currentPhase = readGamePhase(ns);
    
    // Get best target based on phase
    const targets = getHackableServersInline(ns);
    if (targets.length === 0) {
        ui.log("No hackable targets found", "warn");
        await ns.sleep(5000);
        return;
    }
    
    const target = selectTargetByPhase(ns, targets, currentPhase);
    const targetInfo = analyzeTarget(ns, target);
    
    ui.log(`Target: ${target} | Money: ${formatMoneyInline(targetInfo.currentMoney)}/${formatMoneyInline(targetInfo.maxMoney)} | Security: ${targetInfo.currentSecurity.toFixed(2)}/${targetInfo.minSecurity}`);
    
    // Prepare target (weaken to min security, grow to max money)
    if (!isTargetPrepped(ns, target)) {
        await prepTarget(ns, target, ui);
        return;
    }
    
    // Execute hack/grow/weaken cycle
    await executeHackCycle(ns, target, ui);
}

/**
 * Read game phase from orchestrator port (port 7)
 */
function readGamePhase(ns) {
    const phasePortData = ns.peek(7);
    if (phasePortData === "NULL PORT DATA") return 0;
    return parseInt(phasePortData) || 0;
}

/**
 * Select target based on phase and profitability
 * Adapts server selection to current game phase
 * Early phases: Prefer easy money with low prep overhead
 * Late phases: Maximize pure money/time ratio
 */
function selectTargetByPhase(ns, targets, phase) {
    const player = ns.getPlayer();
    
    // Phase 0: Bootstrap - prioritize SPEED (easiest farms)
    if (phase === 0) {
        const bootstrapOrder = ["n00dles", "foodnstuff", "sigma-cosmetics", "joesguns", "nectar-net"];
        for (const server of bootstrapOrder) {
            if (targets.includes(server)) return server;
        }
    }
    
    // Phase 1: Early scaling - prioritize medium-difficulty with good money
    if (phase === 1) {
        const earlyServers = ["foodnstuff", "joesguns", "nectar-net", "hong-fang-tea"];
        const available = earlyServers.filter(s => targets.includes(s));
        if (available.length > 0) {
            // Pick highest money among available
            return available.reduce((best, curr) => {
                const bestMoney = ns.getServerMaxMoney(best);
                const currMoney = ns.getServerMaxMoney(curr);
                return currMoney > bestMoney ? curr : best;
            });
        }
    }
    
    // Phase 2: Mid-game expansion
    if (phase === 2) {
        const midServers = ["hong-fang-tea", "harakiri-sushi", "iron-gym", "phantasy", "summit"];
        const available = midServers.filter(s => targets.includes(s));
        if (available.length > 0) {
            // Score by max money to security ratio (faster farming)
            return available.reduce((best, curr) => {
                const bestScore = ns.getServerMaxMoney(best) / (ns.getServerMinSecurityLevel(best) + 1);
                const currScore = ns.getServerMaxMoney(curr) / (ns.getServerMinSecurityLevel(curr) + 1);
                return currScore > bestScore ? curr : best;
            });
        }
    }
    
    // Phase 3+: Late game - pure profitability with consideration for growth potential
    return selectBestTargetLateGame(ns, targets);
}

/**
 * Calculate target score based on profitability (money/time ratio)
 * Considers: money, security, growth potential
 * Higher score = better target
 */
function calculateProfitabilityScore(ns, server) {
    const maxMoney = ns.getServerMaxMoney(server);
    if (maxMoney <= 0) return 0;
    
    const minSecurity = ns.getServerMinSecurityLevel(server);
    const growthRate = ns.getServerGrowth(server);
    const requiredHacking = ns.getServerRequiredHackingLevel(server);
    const player = ns.getPlayer();
    
    // Base score: money available
    let score = maxMoney;
    
    // Security penalty (lower security = faster prep)
    score *= Math.pow(0.9, minSecurity);
    
    // Growth bonus (higher growth = faster recovery after hack)
    score *= Math.pow(1.05, Math.min(growthRate, 100));
    
    // Avoid overkill penalty: if we're WAY over-leveled, reduce score
    if (requiredHacking < player.skills.hacking * 0.2) {
        score *= 0.4; // Diminishing returns on trivial servers
    } else if (requiredHacking < player.skills.hacking * 0.5) {
        score *= 0.7; // Still less efficient than challenging targets
    }
    
    return score;
}

/**
 * Late-game target selection with consideration for batch timing
 * Picks high-money targets that compress well for HGW batching
 */
function selectBestTargetLateGame(ns, servers) {
    let bestTarget = null;
    let bestScore = 0;
    
    for (const server of servers) {
        const score = calculateProfitabilityScore(ns, server);
        if (score > bestScore) {
            bestScore = score;
            bestTarget = server;
        }
    }
    
    return bestTarget || servers[0];
}

/**
 * Analyze a target server
 * @param {NS} ns
 * @param {string} target
 * @returns {object}
 */
function analyzeTarget(ns, target) {
    return {
        maxMoney: ns.getServerMaxMoney(target),
        currentMoney: ns.getServerMoneyAvailable(target),
        minSecurity: ns.getServerMinSecurityLevel(target),
        currentSecurity: ns.getServerSecurityLevel(target),
        growthRate: ns.getServerGrowth(target),
        requiredLevel: ns.getServerRequiredHackingLevel(target),
    };
}

/**
 * Check if target is prepped (at min security and max money)
 * @param {NS} ns
 * @param {string} target
 * @returns {boolean}
 */
function isTargetPrepped(ns, target) {
    const info = analyzeTarget(ns, target);
    const securityOk = info.currentSecurity <= info.minSecurity + 5; // targetSecurityThreshold
    const moneyOk = info.currentMoney >= info.maxMoney * 0.75; // targetMoneyThreshold
    return securityOk && moneyOk;
}

/**
 * Prepare target (weaken + grow)
 * @param {NS} ns
 * @param {string} target
 * @param {object} ui - UI window API
 */
async function prepTarget(ns, target, ui) {
    ui.log(`Prepping target: ${target}`, "info");
    
    const info = analyzeTarget(ns, target);
    
    // Weaken if security is too high (using 5 as threshold, from config)
    if (info.currentSecurity > info.minSecurity + 5) {
        await distributeWeaken(ns, target, ui);
    }
    
    // Grow if money is too low (using 0.75 as threshold, from config)
    if (info.currentMoney < info.maxMoney * 0.75) {
        await distributeGrow(ns, target, ui);
    }
}

/**
 * Execute a hack cycle
 * @param {NS} ns
 * @param {string} target
 * @param {object} ui - UI window API
 */
async function executeHackCycle(ns, target, ui) {
    // Simple strategy: hack a bit, then grow/weaken to recover
    await distributeHack(ns, target, ui);
    await ns.sleep(100);
    await distributeGrow(ns, target, ui);
    await ns.sleep(100);
    await distributeWeaken(ns, target, ui);
}

/**
 * Distribute hack operations across available servers
 * @param {NS} ns
 * @param {string} target
 * @param {object} ui - UI window API
 */
async function distributeHack(ns, target, ui) {
    await distributeOperation(ns, target, "hack", ui);
}

/**
 * Distribute grow operations across available servers
 * @param {NS} ns
 * @param {string} target
 * @param {object} ui - UI window API
 */
async function distributeGrow(ns, target, ui) {
    await distributeOperation(ns, target, "grow", ui);
}

/**
 * Distribute weaken operations across available servers
 * @param {NS} ns
 * @param {string} target
 * @param {object} ui - UI window API
 */
async function distributeWeaken(ns, target, ui) {
    await distributeOperation(ns, target, "weaken", ui);
}

/**
 * Distribute an operation across all available servers
 * @param {NS} ns
 * @param {string} target
 * @param {string} script
 * @param {object} ui - UI window API
 */
async function distributeOperation(ns, target, script, ui) {
    const servers = getRootedServersInline(ns);
    
    // Determine script path
    let scriptPath;
    if (script === "hack") scriptPath = "/angel/workers/hack.js";
    else if (script === "grow") scriptPath = "/angel/workers/grow.js";
    else if (script === "weaken") scriptPath = "/angel/workers/weaken.js";
    else scriptPath = script;
    
    const scriptRam = ns.getScriptRam(scriptPath);
    
    if (scriptRam === 0) {
        ui.log(`Script ${scriptPath} not found`, "error");
        return;
    }
    
    // Check if we have enough total available RAM (leave 30% buffer for other modules)
    const totalAvailable = getTotalAvailableRamInline(ns);
    const usageLimit = totalAvailable * 0.60; // Only use 60% of total available
    
    if (usageLimit < scriptRam) {
        ui.log(`Not enough available RAM for operation (need ${scriptRam.toFixed(2)}GB, limit is ${usageLimit.toFixed(2)}GB)`, "warn");
        return;
    }
    
    let totalThreads = 0;
    let usedRam = 0;
    
    for (const server of servers) {
        // Deploy script to server
        try {
            await ns.scp(scriptPath, server, "home");
        } catch (e) {
            ui.log(`Failed to deploy to ${server}: ${e}`, "debug");
            continue;
        }
        
        // Calculate available RAM (reserve 20GB on home)
        const reserved = server === "home" ? 20 : 0; // reservedHomeRam
        const availableRam = getAvailableRamInline(ns, server, reserved);
        const threads = Math.floor(availableRam / scriptRam);
        
        if (threads > 0 && usedRam + (threads * scriptRam) <= usageLimit) {
            ns.exec(scriptPath, server, threads, target);
            totalThreads += threads;
            usedRam += threads * scriptRam;
        }
    }
    
    if (totalThreads > 0) {
        ui.log(`Launched ${script} on ${target} with ${totalThreads} threads (${usedRam.toFixed(2)}GB)`, "success");
    }
}

/**
 * Get total available RAM across all servers
 * @param {NS} ns
 * @returns {number}
 */
export function getTotalAvailableRam(ns) {
    const servers = getRootedServersInline(ns);
    let total = 0;
    
    for (const server of servers) {
        const reserved = server === "home" ? 20 : 0; // reservedHomeRam
        total += getAvailableRamInline(ns, server, reserved);
    }
    
    return total;
}

// ========================================
// INLINE HELPER FUNCTIONS (no imports)
// ========================================

/**
 * Format money with $ sign (inline, no imports)
 */
function formatMoneyInline(money) {
    if (money >= 1e12) return `$${(money / 1e12).toFixed(2)}t`;
    if (money >= 1e9) return `$${(money / 1e9).toFixed(2)}b`;
    if (money >= 1e6) return `$${(money / 1e6).toFixed(2)}m`;
    if (money >= 1e3) return `$${(money / 1e3).toFixed(2)}k`;
    return `$${money.toFixed(0)}`;
}

/**
 * Get total RAM available across all servers (inline)
 */
function getTotalAvailableRamInline(ns) {
    const servers = getRootedServersInline(ns);
    let total = 0;
    
    for (const server of servers) {
        const reserved = server === "home" ? 20 : 0;
        total += getAvailableRamInline(ns, server, reserved);
    }
    
    return total;
}

/**
 * Get available RAM on a server (inline, no imports)
 */
function getAvailableRamInline(ns, server, reserved = 0) {
    const maxRam = ns.getServerMaxRam(server);
    const usedRam = ns.getServerUsedRam(server);
    const available = maxRam - usedRam - reserved;
    return Math.max(0, available);
}

/**
 * Recursively scan the entire network (inline, no imports)
 */
function scanAllInline(ns, server = "home", visited = new Set()) {
    visited.add(server);
    
    const neighbors = ns.scan(server);
    for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
            scanAllInline(ns, neighbor, visited);
        }
    }
    
    return Array.from(visited);
}

/**
 * Get all servers we have root access to (inline)
 */
function getRootedServersInline(ns) {
    const allServers = scanAllInline(ns);
    return allServers.filter(server => ns.hasRootAccess(server));
}

/**
 * Get all servers with money (potential hack targets) (inline)
 */
function getMoneyServersInline(ns) {
    const allServers = scanAllInline(ns);
    return allServers.filter(server => {
        return ns.getServerMaxMoney(server) > 0 && 
               ns.hasRootAccess(server);
    });
}

/**
 * Get hackable servers (rooted, has money, within our level) (inline)
 */
function getHackableServersInline(ns) {
    const player = ns.getPlayer();
    const moneyServers = getMoneyServersInline(ns);
    
    return moneyServers.filter(server => {
        return ns.getServerRequiredHackingLevel(server) <= player.skills.hacking;
    });
}

/**
 * Get best target by profitability (money gain per hack)
 */
function getBestTargetByProfitInline(ns, servers) {
    return selectBestTargetLateGame(ns, servers);
}
