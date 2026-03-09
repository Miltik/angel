/**
 * Network Service - Centralized network scanning and server discovery
 * Eliminates redundant scanning logic across modules
 * 
 * Features:
 * - Recursive network traversal
 * - Server filtering (rooted, hackable, money servers)
 * - Centralized caching for performance
 * 
 * @module services/network
 */

import * as Cache from "/angel/services/cache.js";

// Cache configuration
const CACHE_TTL = 5000; // 5 seconds
const CACHE_NS = Cache.NAMESPACES.NETWORK;

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
 * Scan all servers with caching
 * @param {NS} ns
 * @param {boolean} useCache - Whether to use cached results
 * @returns {string[]}
 */
export function scanAllCached(ns, useCache = true) {
    if (!useCache) {
        const servers = scanAll(ns);
        Cache.set(CACHE_NS, "allServers", servers, CACHE_TTL);
        return servers;
    }
    
    return Cache.getOrCompute(CACHE_NS, "allServers", () => scanAll(ns), CACHE_TTL);
}

/**
 * Get all servers we have root access to
 * @param {NS} ns
 * @param {boolean} useCache - Whether to use cached results
 * @returns {string[]}
 */
export function getRootedServers(ns, useCache = true) {
    if (!useCache) {
        const allServers = scanAllCached(ns, false);
        const rooted = allServers.filter(server => ns.hasRootAccess(server));
        Cache.set(CACHE_NS, "rootedServers", rooted, CACHE_TTL);
        return rooted;
    }
    
    return Cache.getOrCompute(CACHE_NS, "rootedServers", () => {
        const allServers = scanAllCached(ns, true);
        return allServers.filter(server => ns.hasRootAccess(server));
    }, CACHE_TTL);
}

/**
 * Get all servers we don't have root access to yet
 * @param {NS} ns
 * @param {boolean} useCache - Whether to use cached results
 * @returns {string[]}
 */
export function getUnrootedServers(ns, useCache = true) {
    const allServers = scanAllCached(ns, useCache);
    return allServers.filter(server => !ns.hasRootAccess(server));
}

/**
 * Get all servers with money (potential hack targets)
 * @param {NS} ns
 * @param {boolean} useCache - Whether to use cached results
 * @returns {string[]}
 */
export function getMoneyServers(ns, useCache = true) {
    const allServers = scanAllCached(ns, useCache);
    return allServers.filter(server => {
        return ns.getServerMaxMoney(server) > 0 && 
               ns.hasRootAccess(server);
    });
}

/**
 * Get hackable servers (rooted, has money, within our level)
 * @param {NS} ns
 * @param {boolean} useCache - Whether to use cached results
 * @returns {string[]}
 */
export function getHackableServers(ns, useCache = true) {
    if (!useCache) {
        const player = ns.getPlayer();
        const moneyServers = getMoneyServers(ns, false);
        const hackable = moneyServers.filter(server => {
            return ns.getServerRequiredHackingLevel(server) <= player.skills.hacking;
        });
        Cache.set(CACHE_NS, "hackableServers", hackable, CACHE_TTL);
        return hackable;
    }
    
    return Cache.getOrCompute(CACHE_NS, "hackableServers", () => {
        const player = ns.getPlayer();
        const moneyServers = getMoneyServers(ns, true);
        return moneyServers.filter(server => {
            return ns.getServerRequiredHackingLevel(server) <= player.skills.hacking;
        });
    }, CACHE_TTL);
}

/**
 * Get purchased servers
 * @param {NS} ns
 * @returns {string[]}
 */
export function getPurchasedServers(ns) {
    return ns.getPurchasedServers();
}

/**
 * Get server count statistics
 * @param {NS} ns
 * @returns {Object}
 */
export function getServerCounts(ns) {
    const all = scanAllCached(ns);
    const rooted = getRootedServers(ns);
    const hackable = getHackableServers(ns);
    const purchased = getPurchasedServers(ns);
    
    return {
        total: all.length,
        rooted: rooted.length,
        unrooted: all.length - rooted.length,
        hackable: hackable.length,
        purchased: purchased.length,
    };
}

/**
 * Clear all caches (force refresh on next call)
 */
export function clearCache() {
    Cache.clear(CACHE_NS);
}

/**
 * Set cache TTL
 * @param {number} ttl - Time to live in milliseconds
 */
export function setCacheTTL(ttl) {
    CACHE_TTL = ttl;
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
