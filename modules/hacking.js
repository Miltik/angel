import { config, SCRIPTS } from "/angel/config.js";
import { formatMoney, formatNumber, log, getAvailableRam, deployFiles, getBestTarget } from "/angel/utils.js";
import { getRootedServers, getHackableServers } from "/angel/scanner.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.tail();
    
    log(ns, "Hacking module started", "INFO");
    
    while (true) {
        try {
            await hackingLoop(ns);
        } catch (e) {
            log(ns, `Hacking loop error: ${e}`, "ERROR");
        }
        await ns.sleep(config.hacking.batchDelay);
    }
}

/**
 * Main hacking loop
 * @param {NS} ns
 */
async function hackingLoop(ns) {
    // Get best target
    const targets = getHackableServers(ns);
    if (targets.length === 0) {
        log(ns, "No hackable targets found", "WARN");
        await ns.sleep(5000);
        return;
    }
    
    const target = getBestTarget(ns, targets);
    const targetInfo = analyzeTarget(ns, target);
    
    log(ns, `Target: ${target} | Money: ${formatMoney(targetInfo.currentMoney)}/${formatMoney(targetInfo.maxMoney)} | Security: ${targetInfo.currentSecurity.toFixed(2)}/${targetInfo.minSecurity}`, "INFO");
    
    // Prepare target (weaken to min security, grow to max money)
    if (!isTargetPrepped(ns, target)) {
        await prepTarget(ns, target);
        return;
    }
    
    // Execute hack/grow/weaken cycle
    await executeHackCycle(ns, target);
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
    const securityOk = info.currentSecurity <= info.minSecurity + config.hacking.targetSecurityThreshold;
    const moneyOk = info.currentMoney >= info.maxMoney * config.hacking.targetMoneyThreshold;
    return securityOk && moneyOk;
}

/**
 * Prepare target (weaken + grow)
 * @param {NS} ns
 * @param {string} target
 */
async function prepTarget(ns, target) {
    log(ns, `Prepping target: ${target}`, "INFO");
    
    const info = analyzeTarget(ns, target);
    
    // Weaken if security is too high
    if (info.currentSecurity > info.minSecurity + config.hacking.targetSecurityThreshold) {
        await distributeWeaken(ns, target);
    }
    
    // Grow if money is too low
    if (info.currentMoney < info.maxMoney * config.hacking.targetMoneyThreshold) {
        await distributeGrow(ns, target);
    }
}

/**
 * Execute a hack cycle
 * @param {NS} ns
 * @param {string} target
 */
async function executeHackCycle(ns, target) {
    // Simple strategy: hack a bit, then grow/weaken to recover
    await distributeHack(ns, target);
    await ns.sleep(100);
    await distributeGrow(ns, target);
    await ns.sleep(100);
    await distributeWeaken(ns, target);
}

/**
 * Distribute hack operations across available servers
 * @param {NS} ns
 * @param {string} target
 */
async function distributeHack(ns, target) {
    await distributeOperation(ns, target, SCRIPTS.hack);
}

/**
 * Distribute grow operations across available servers
 * @param {NS} ns
 * @param {string} target
 */
async function distributeGrow(ns, target) {
    await distributeOperation(ns, target, SCRIPTS.grow);
}

/**
 * Distribute weaken operations across available servers
 * @param {NS} ns
 * @param {string} target
 */
async function distributeWeaken(ns, target) {
    await distributeOperation(ns, target, SCRIPTS.weaken);
}

/**
 * Distribute an operation across all available servers
 * @param {NS} ns
 * @param {string} target
 * @param {string} script
 */
async function distributeOperation(ns, target, script) {
    const servers = getRootedServers(ns);
    const scriptRam = ns.getScriptRam(script);
    
    if (scriptRam === 0) {
        log(ns, `Script ${script} not found`, "ERROR");
        return;
    }
    
    let totalThreads = 0;
    
    for (const server of servers) {
        // Deploy script to server
        await deployFiles(ns, [script], server);
        
        // Calculate available RAM (reserve some on home)
        const reserved = server === "home" ? config.hacking.reservedHomeRam : 0;
        const availableRam = getAvailableRam(ns, server, reserved);
        const threads = Math.floor(availableRam / scriptRam);
        
        if (threads > 0) {
            ns.exec(script, server, threads, target);
            totalThreads += threads;
        }
    }
    
    if (totalThreads > 0) {
        const operation = script.split("/").pop().replace(".js", "");
        log(ns, `Launched ${operation} on ${target} with ${totalThreads} threads`, "INFO");
    }
}

/**
 * Get total available RAM across all servers
 * @param {NS} ns
 * @returns {number}
 */
export function getTotalAvailableRam(ns) {
    const servers = getRootedServers(ns);
    let total = 0;
    
    for (const server of servers) {
        const reserved = server === "home" ? config.hacking.reservedHomeRam : 0;
        total += getAvailableRam(ns, server, reserved);
    }
    
    return total;
}
