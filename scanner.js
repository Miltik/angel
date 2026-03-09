/**
 * Scanner - Network scanning and rooting (LEGACY COMPATIBILITY)
 * 
 * This module now re-exports from the new services architecture:
 * - /angel/services/network.js - Network scanning
 * - /angel/services/rooting.js - Root access and nuking
 * 
 * Existing imports will continue to work unchanged.
 */

// Re-export network functions
export {
    scanAll,
    getRootedServers,
    getUnrootedServers,
    getMoneyServers,
    getHackableServers,
    findPath,
} from "/angel/services/network.js";

// Re-export rooting functions
export {
    tryGainRoot,
    rootAll,
} from "/angel/services/rooting.js";

/** @param {NS} ns */
export async function main(ns) {
    // Import here to avoid circular dependencies in main
    const { scanAll } = await import("/angel/services/network.js");
    const servers = scanAll(ns);
    
    ns.tprint(`Found ${servers.length} servers in network:`);
    for (const server of servers) {
        const hasRoot = ns.hasRootAccess(server);
        const money = ns.getServerMaxMoney(server);
        const reqLevel = ns.getServerRequiredHackingLevel(server);
        ns.tprint(`  ${server} - Root: ${hasRoot}, Money: $${money}, Level: ${reqLevel}`);
    }
}
