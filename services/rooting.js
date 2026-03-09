/**
 * Rooting Service - Centralized server rooting logic
 * Handles port opening and gaining root access
 * 
 * Features:
 * - Port opening with available exploit programs
 * - Nuking servers
 * - Batch rooting operations
 * 
 * @module services/rooting
 */

import { log } from "/angel/utils.js";
import { getUnrootedServers } from "/angel/services/network.js";

/**
 * Check how many ports we can currently open
 * @param {NS} ns
 * @returns {number}
 */
export function getAvailablePortOpeners(ns) {
    let count = 0;
    
    if (ns.fileExists("BruteSSH.exe", "home")) count++;
    if (ns.fileExists("FTPCrack.exe", "home")) count++;
    if (ns.fileExists("relaySMTP.exe", "home")) count++;
    if (ns.fileExists("HTTPWorm.exe", "home")) count++;
    if (ns.fileExists("SQLInject.exe", "home")) count++;
    
    return count;
}

/**
 * Open all available ports on a server
 * @param {NS} ns
 * @param {string} server
 * @returns {number} - Number of ports opened
 */
export function openPorts(ns, server) {
    let openPorts = 0;
    
    if (ns.fileExists("BruteSSH.exe", "home")) {
        try {
            ns.brutessh(server);
            openPorts++;
        } catch (e) {
            // Already opened or failed
        }
    }
    
    if (ns.fileExists("FTPCrack.exe", "home")) {
        try {
            ns.ftpcrack(server);
            openPorts++;
        } catch (e) {
            // Already opened or failed
        }
    }
    
    if (ns.fileExists("relaySMTP.exe", "home")) {
        try {
            ns.relaysmtp(server);
            openPorts++;
        } catch (e) {
            // Already opened or failed
        }
    }
    
    if (ns.fileExists("HTTPWorm.exe", "home")) {
        try {
            ns.httpworm(server);
            openPorts++;
        } catch (e) {
            // Already opened or failed
        }
    }
    
    if (ns.fileExists("SQLInject.exe", "home")) {
        try {
            ns.sqlinject(server);
            openPorts++;
        } catch (e) {
            // Already opened or failed
        }
    }
    
    return openPorts;
}

/**
 * Attempt to gain root access on a server
 * @param {NS} ns
 * @param {string} server
 * @param {boolean} verbose - Whether to log results
 * @returns {boolean} - True if we got root
 */
export function tryGainRoot(ns, server, verbose = true) {
    // Already have root
    if (ns.hasRootAccess(server)) return true;
    
    // Try to open all ports
    const portsOpened = openPorts(ns, server);
    
    // Check if we can nuke
    const requiredPorts = ns.getServerNumPortsRequired(server);
    if (portsOpened >= requiredPorts) {
        try {
            ns.nuke(server);
            if (verbose) {
                log(ns, `Successfully rooted ${server}`, "INFO");
            }
            return true;
        } catch (e) {
            if (verbose) {
                log(ns, `Failed to nuke ${server}: ${e}`, "ERROR");
            }
            return false;
        }
    }
    
    return false;
}

/**
 * Try to root all servers in the network
 * @param {NS} ns
 * @param {boolean} verbose - Whether to log results
 * @returns {number} - Number of newly rooted servers
 */
export function rootAll(ns, verbose = true) {
    const unrooted = getUnrootedServers(ns, false); // Don't use cache for this
    let newlyRooted = 0;
    
    for (const server of unrooted) {
        // Skip home and purchased servers
        if (server === "home" || server.startsWith("angel-")) continue;
        
        if (tryGainRoot(ns, server, verbose)) {
            newlyRooted++;
        }
    }
    
    return newlyRooted;
}

/**
 * Check if we can root a specific server
 * @param {NS} ns
 * @param {string} server
 * @returns {boolean}
 */
export function canRoot(ns, server) {
    if (ns.hasRootAccess(server)) return true;
    
    const requiredPorts = ns.getServerNumPortsRequired(server);
    const availablePorts = getAvailablePortOpeners(ns);
    
    return availablePorts >= requiredPorts;
}

/**
 * Get rootable servers (servers we can root but haven't yet)
 * @param {NS} ns
 * @returns {string[]}
 */
export function getRootableServers(ns) {
    const unrooted = getUnrootedServers(ns, false);
    return unrooted.filter(server => canRoot(ns, server));
}

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("Rooting Service");
    ns.tprint(`Available port openers: ${getAvailablePortOpeners(ns)}`);
    
    const newlyRooted = rootAll(ns);
    ns.tprint(`Rooted ${newlyRooted} new servers`);
}
