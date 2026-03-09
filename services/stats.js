/**
 * Stats Service - Centralized statistics collection
 * Provides consistent stat calculation across modules
 * 
 * Features:
 * - Server statistics (RAM, money, etc.)
 * - Player statistics
 * - Network statistics
 * - Money tracking and rate calculation
 * 
 * @module services/stats
 */

import { scanAllCached, getRootedServers, getPurchasedServers } from "/angel/services/network.js";

/**
 * Get comprehensive server statistics
 * @param {NS} ns
 * @returns {Object}
 */
export function getServerStats(ns) {
    const purchased = getPurchasedServers(ns);
    
    if (purchased.length === 0) {
        return {
            count: 0,
            maxPossible: ns.getPurchasedServerLimit(),
            totalRam: 0,
            minRam: 0,
            maxRam: 0,
            avgRam: 0,
        };
    }
    
    let totalRam = 0;
    let minRam = Infinity;
    let maxRam = 0;
    
    for (const server of purchased) {
        const ram = ns.getServerMaxRam(server);
        totalRam += ram;
        minRam = Math.min(minRam, ram);
        maxRam = Math.max(maxRam, ram);
    }
    
    return {
        count: purchased.length,
        maxPossible: ns.getPurchasedServerLimit(),
        totalRam,
        minRam: minRam === Infinity ? 0 : minRam,
        maxRam,
        avgRam: totalRam / purchased.length,
    };
}

/**
 * Get total available RAM across all rooted servers
 * @param {NS} ns
 * @param {number} reservedHomeRam - RAM to reserve on home
 * @returns {number}
 */
export function getTotalAvailableRam(ns, reservedHomeRam = 20) {
    const rooted = getRootedServers(ns, false); // Fresh data
    let totalRam = 0;
    
    for (const server of rooted) {
        const maxRam = ns.getServerMaxRam(server);
        const usedRam = ns.getServerUsedRam(server);
        
        let availableRam = maxRam - usedRam;
        
        // Reserve RAM on home server
        if (server === "home") {
            availableRam = Math.max(0, availableRam - reservedHomeRam);
        }
        
        totalRam += availableRam;
    }
    
    return totalRam;
}

/**
 * Get player skill statistics
 * @param {NS} ns
 * @returns {Object}
 */
export function getPlayerStats(ns) {
    const player = ns.getPlayer();
    
    return {
        hacking: player.skills.hacking,
        strength: player.skills.strength,
        defense: player.skills.defense,
        dexterity: player.skills.dexterity,
        agility: player.skills.agility,
        charisma: player.skills.charisma,
        intelligence: player.skills.intelligence,
        hackingExp: player.exp.hacking,
        strengthExp: player.exp.strength,
        defenseExp: player.exp.defense,
        dexterityExp: player.exp.dexterity,
        agilityExp: player.exp.agility,
        charismaExp: player.exp.charisma,
        intelligenceExp: player.exp.intelligence,
    };
}

/**
 * Get money statistics
 * @param {NS} ns
 * @returns {Object}
 */
export function getMoneyStats(ns) {
    const player = ns.getPlayer();
    const homeMoney = ns.getServerMoneyAvailable("home");
    const playerMoney = player.money;
    
    return {
        home: homeMoney,
        player: playerMoney,
        total: homeMoney + playerMoney,
    };
}

/**
 * Calculate money generation rate
 * @param {number} currentMoney
 * @param {number} previousMoney
 * @param {number} elapsedMs
 * @returns {number} Money per second
 */
export function calculateMoneyRate(currentMoney, previousMoney, elapsedMs) {
    if (elapsedMs <= 0) return 0;
    const diff = currentMoney - previousMoney;
    return (diff / elapsedMs) * 1000; // Convert to per second
}

/**
 * Calculate XP generation rate
 * @param {number} currentXp
 * @param {number} previousXp
 * @param {number} elapsedMs
 * @returns {number} XP per second
 */
export function calculateXpRate(currentXp, previousXp, elapsedMs) {
    if (elapsedMs <= 0) return 0;
    const diff = currentXp - previousXp;
    return (diff / elapsedMs) * 1000; // Convert to per second
}

/**
 * Get network statistics
 * @param {NS} ns
 * @returns {Object}
 */
export function getNetworkStats(ns) {
    const all = scanAllCached(ns);
    const rooted = getRootedServers(ns);
    const purchased = getPurchasedServers(ns);
    
    let totalMaxMoney = 0;
    let totalCurrentMoney = 0;
    let totalMaxRam = 0;
    let totalUsedRam = 0;
    
    for (const server of all) {
        totalMaxMoney += ns.getServerMaxMoney(server);
        totalCurrentMoney += ns.getServerMoneyAvailable(server);
        totalMaxRam += ns.getServerMaxRam(server);
        totalUsedRam += ns.getServerUsedRam(server);
    }
    
    return {
        totalServers: all.length,
        rootedServers: rooted.length,
        purchasedServers: purchased.length,
        totalMaxMoney,
        totalCurrentMoney,
        totalMaxRam,
        totalUsedRam,
        totalAvailableRam: totalMaxRam - totalUsedRam,
    };
}

/**
 * Get RAM usage breakdown by script
 * @param {NS} ns
 * @param {string} server
 * @returns {Array}
 */
export function getServerRamUsage(ns, server) {
    const processes = ns.ps(server);
    const ramUsage = [];
    
    for (const proc of processes) {
        ramUsage.push({
            script: proc.filename,
            threads: proc.threads,
            ram: proc.threads * ns.getScriptRam(proc.filename, server),
            args: proc.args,
        });
    }
    
    return ramUsage.sort((a, b) => b.ram - a.ram);
}

/**
 * Get home server statistics
 * @param {NS} ns
 * @returns {Object}
 */
export function getHomeStats(ns) {
    const maxRam = ns.getServerMaxRam("home");
    const usedRam = ns.getServerUsedRam("home");
    const cores = ns.getServer("home").cpuCores;
    
    return {
        maxRam,
        usedRam,
        freeRam: maxRam - usedRam,
        cores,
        ramUsagePercent: (usedRam / maxRam) * 100,
    };
}

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== Stats Service ===");
    ns.tprint("");
    
    ns.tprint("Server Stats:");
    ns.tprint(JSON.stringify(getServerStats(ns), null, 2));
    ns.tprint("");
    
    ns.tprint("Network Stats:");
    ns.tprint(JSON.stringify(getNetworkStats(ns), null, 2));
    ns.tprint("");
    
    ns.tprint("Home Stats:");
    ns.tprint(JSON.stringify(getHomeStats(ns), null, 2));
}
