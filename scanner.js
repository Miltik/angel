import { log } from "/angel/utils.js";

/** @param {NS} ns */
export async function main(ns) {
    const servers = scanAll(ns);
    ns.tprint(`Found ${servers.length} servers in network:`);
    for (const server of servers) {
        const hasRoot = ns.hasRootAccess(server);
        const money = ns.getServerMaxMoney(server);
        const reqLevel = ns.getServerRequiredHackingLevel(server);
        ns.tprint(`  ${server} - Root: ${hasRoot}, Money: $${money}, Level: ${reqLevel}`);
    }
}

/**
 * Recursively scan the entire network
 * @param {NS} ns
 * @param {string} server - Starting server (default: "home")
 * @param {Set<string>} visited - Already visited servers
 * @returns {string[]}
 */
export function scanAll(ns, server = "home", visited = new Set()) {
    visited.add(server);
    
    const neighbors = ns.scan(server);
    for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
            scanAll(ns, neighbor, visited);
        }
    }
    
    return Array.from(visited);
}

/**
 * Get all servers we have root access to
 * @param {NS} ns
 * @returns {string[]}
 */
export function getRootedServers(ns) {
    const allServers = scanAll(ns);
    return allServers.filter(server => ns.hasRootAccess(server));
}

/**
 * Get all servers we don't have root access to yet
 * @param {NS} ns
 * @returns {string[]}
 */
export function getUnrootedServers(ns) {
    const allServers = scanAll(ns);
    return allServers.filter(server => !ns.hasRootAccess(server));
}

/**
 * Get all servers with money (potential hack targets)
 * @param {NS} ns
 * @returns {string[]}
 */
export function getMoneyServers(ns) {
    const allServers = scanAll(ns);
    return allServers.filter(server => {
        return ns.getServerMaxMoney(server) > 0 && 
               ns.hasRootAccess(server);
    });
}

/**
 * Get hackable servers (rooted, has money, within our level)
 * @param {NS} ns
 * @returns {string[]}
 */
export function getHackableServers(ns) {
    const player = ns.getPlayer();
    const moneyServers = getMoneyServers(ns);
    
    return moneyServers.filter(server => {
        return ns.getServerRequiredHackingLevel(server) <= player.skills.hacking;
    });
}

/**
 * Attempt to gain root access on a server
 * @param {NS} ns
 * @param {string} server
 * @returns {boolean} - True if we got root
 */
export function tryGainRoot(ns, server) {
    // Already have root
    if (ns.hasRootAccess(server)) return true;
    
    // Try to open all ports
    let openPorts = 0;
    
    if (ns.fileExists("BruteSSH.exe", "home")) {
        ns.brutessh(server);
        openPorts++;
    }
    
    if (ns.fileExists("FTPCrack.exe", "home")) {
        ns.ftpcrack(server);
        openPorts++;
    }
    
    if (ns.fileExists("relaySMTP.exe", "home")) {
        ns.relaysmtp(server);
        openPorts++;
    }
    
    if (ns.fileExists("HTTPWorm.exe", "home")) {
        ns.httpworm(server);
        openPorts++;
    }
    
    if (ns.fileExists("SQLInject.exe", "home")) {
        ns.sqlinject(server);
        openPorts++;
    }
    
    // Check if we can nuke
    const requiredPorts = ns.getServerNumPortsRequired(server);
    if (openPorts >= requiredPorts) {
        try {
            ns.nuke(server);
            log(ns, `Successfully rooted ${server}`, "INFO");
            return true;
        } catch (e) {
            log(ns, `Failed to nuke ${server}: ${e}`, "ERROR");
            return false;
        }
    }
    
    return false;
}

/**
 * Try to root all servers in the network
 * @param {NS} ns
 * @returns {number} - Number of newly rooted servers
 */
export function rootAll(ns) {
    const unrooted = getUnrootedServers(ns);
    let newlyRooted = 0;
    
    for (const server of unrooted) {
        // Skip home and purchased servers
        if (server === "home" || server.startsWith("angel-")) continue;
        
        if (tryGainRoot(ns, server)) {
            newlyRooted++;
        }
    }
    
    return newlyRooted;
}

/**
 * Find path from source to target server
 * @param {NS} ns
 * @param {string} target
 * @param {string} source
 * @returns {string[]} - Path of servers to connect through
 */
export function findPath(ns, target, source = "home") {
    if (target === source) return [target];
    
    const queue = [[source]];
    const visited = new Set([source]);
    
    while (queue.length > 0) {
        const path = queue.shift();
        const current = path[path.length - 1];
        
        const neighbors = ns.scan(current);
        for (const neighbor of neighbors) {
            if (visited.has(neighbor)) continue;
            
            const newPath = [...path, neighbor];
            if (neighbor === target) {
                return newPath;
            }
            
            visited.add(neighbor);
            queue.push(newPath);
        }
    }
    
    return [];
}
