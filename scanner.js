/**
 * Scanner - Network scanning and rooting (LEGACY COMPATIBILITY)
 * 
 * This module now re-exports from the new services architecture:
 * - /angel/services/network.js - Network scanning
 * - /angel/services/rooting.js - Root access and nuking
 * 
 * Existing imports will continue to work unchanged.
 */

import {
    scanAll as networkScanAll,
    getRootedServers as networkGetRootedServers,
    getUnrootedServers as networkGetUnrootedServers,
    getMoneyServers as networkGetMoneyServers,
    getHackableServers as networkGetHackableServers,
    findPath as networkFindPath,
} from "/angel/services/network.js";

import {
    tryGainRoot as rootingTryGainRoot,
    rootAll as rootingRootAll,
} from "/angel/services/rooting.js";

// Legacy-compatible explicit exports (avoid re-export syntax for Netscript parser compatibility)
export function scanAll(ns, server = "home", visited = new Set()) {
    return networkScanAll(ns, server, visited);
}

export function getRootedServers(ns, useCache = true) {
    return networkGetRootedServers(ns, useCache);
}

export function getUnrootedServers(ns, useCache = true) {
    return networkGetUnrootedServers(ns, useCache);
}

export function getMoneyServers(ns, useCache = true) {
    return networkGetMoneyServers(ns, useCache);
}

export function getHackableServers(ns, useCache = true) {
    return networkGetHackableServers(ns, useCache);
}

export function findPath(ns, target, source = "home") {
    return networkFindPath(ns, target, source);
}

export function tryGainRoot(ns, server, verbose = true) {
    return rootingTryGainRoot(ns, server, verbose);
}

export function rootAll(ns, verbose = true) {
    return rootingRootAll(ns, verbose);
}

/** @param {NS} ns */
export async function main(ns) {
    const servers = networkScanAll(ns);
    
    ns.tprint(`Found ${servers.length} servers in network:`);
    for (const server of servers) {
        const hasRoot = ns.hasRootAccess(server);
        const money = ns.getServerMaxMoney(server);
        const reqLevel = ns.getServerRequiredHackingLevel(server);
        ns.tprint(`  ${server} - Root: ${hasRoot}, Money: $${money}, Level: ${reqLevel}`);
    }
}
