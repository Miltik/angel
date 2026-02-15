/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("Utils module - use as import only");
}

/**
 * Format numbers to human-readable format (1.5m, 2.3b, etc.)
 * @param {number} num - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string}
 */
export function formatNumber(num, decimals = 2) {
    if (num >= 1e12) return (num / 1e12).toFixed(decimals) + "t";
    if (num >= 1e9) return (num / 1e9).toFixed(decimals) + "b";
    if (num >= 1e6) return (num / 1e6).toFixed(decimals) + "m";
    if (num >= 1e3) return (num / 1e3).toFixed(decimals) + "k";
    return num.toFixed(decimals);
}

/**
 * Format money with $ sign
 * @param {number} money
 * @returns {string}
 */
export function formatMoney(money) {
    return "$" + formatNumber(money);
}

/**
 * Format RAM in GB
 * @param {number} ram - RAM in GB
 * @returns {string}
 */
export function formatRam(ram) {
    return formatNumber(ram) + "GB";
}

/**
 * Format time in ms to readable string
 * @param {number} ms - Time in milliseconds
 * @returns {string}
 */
export function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

/**
 * Calculate the optimal number of threads for a given RAM budget
 * @param {NS} ns
 * @param {string} script - Script path
 * @param {number} availableRam - Available RAM in GB
 * @returns {number}
 */
export function calcThreads(ns, script, availableRam) {
    const scriptRam = ns.getScriptRam(script);
    if (scriptRam === 0) return 0;
    return Math.floor(availableRam / scriptRam);
}

/**
 * Wait for a condition to be true
 * @param {Function} condition - Function that returns boolean
 * @param {number} timeout - Max wait time in ms
 * @param {number} checkInterval - How often to check in ms
 * @returns {Promise<boolean>}
 */
export async function waitFor(condition, timeout = 60000, checkInterval = 100) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (condition()) return true;
        await sleep(checkInterval);
    }
    return false;
}

/**
 * Sleep for ms
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get total RAM available on a server (excluding reserved)
 * @param {NS} ns
 * @param {string} server
 * @param {number} reserved - RAM to reserve
 * @returns {number}
 */
export function getAvailableRam(ns, server, reserved = 0) {
    const maxRam = ns.getServerMaxRam(server);
    const usedRam = ns.getServerUsedRam(server);
    const available = maxRam - usedRam - reserved;
    return Math.max(0, available);
}

/**
 * Check if we can run a script with given threads
 * @param {NS} ns
 * @param {string} script
 * @param {string} server
 * @param {number} threads
 * @param {number} reserved
 * @returns {boolean}
 */
export function canRunScript(ns, script, server, threads = 1, reserved = 0) {
    const scriptRam = ns.getScriptRam(script);
    const available = getAvailableRam(ns, server, reserved);
    return scriptRam * threads <= available;
}

/**
 * Get all purchased servers
 * @param {NS} ns
 * @returns {string[]}
 */
export function getPurchasedServers(ns) {
    return ns.getPurchasedServers();
}

/**
 * Check if a file exists on a server
 * @param {NS} ns
 * @param {string} file
 * @param {string} server
 * @returns {boolean}
 */
export function fileExists(ns, file, server = "home") {
    return ns.fileExists(file, server);
}

/**
 * Copy files to target server if they don't exist or are outdated
 * @param {NS} ns
 * @param {string[]} files - Files to copy
 * @param {string} target - Target server
 * @returns {Promise<boolean>}
 */
export async function deployFiles(ns, files, target) {
    try {
        await ns.scp(files, target, "home");
        return true;
    } catch (e) {
        ns.print(`ERROR: Failed to deploy files to ${target}: ${e}`);
        return false;
    }
}

/**
 * Log with timestamp
 * @param {NS} ns
 * @param {string} message
 * @param {string} level - INFO, WARN, ERROR
 */
export function log(ns, message, level = "INFO") {
    const timestamp = new Date().toLocaleTimeString();
    ns.print(`[${timestamp}] [${level}] ${message}`);
}

/**
 * Kill all scripts matching a pattern on a server
 * @param {NS} ns
 * @param {string} server
 * @param {string} pattern - Script name pattern
 */
export function killScripts(ns, server, pattern = "") {
    const scripts = ns.ps(server);
    for (const script of scripts) {
        if (pattern === "" || script.filename.includes(pattern)) {
            ns.kill(script.pid);
        }
    }
}

/**
 * Get best target server based on current hacking level
 * @param {NS} ns
 * @param {string[]} servers - List of servers to consider
 * @returns {string}
 */
export function getBestTarget(ns, servers) {
    const player = ns.getPlayer();
    
    let bestTarget = null;
    let bestScore = 0;
    
    for (const server of servers) {
        // Skip servers we can't hack
        if (ns.getServerRequiredHackingLevel(server) > player.skills.hacking) {
            continue;
        }
        
        // Skip servers with no money
        const maxMoney = ns.getServerMaxMoney(server);
        if (maxMoney === 0) continue;
        
        // Calculate simple score (money / security)
        const minSecurity = ns.getServerMinSecurityLevel(server);
        const score = maxMoney / minSecurity;
        
        if (score > bestScore) {
            bestScore = score;
            bestTarget = server;
        }
    }
    
    return bestTarget || servers[0];
}

/**
 * Get list of servers connected to a target
 * @param {NS} ns
 * @param {string} server - Server to scan from
 * @returns {string[]} List of connected servers
 */
export function getScan(ns, server) {
    return ns.scan(server);
}
