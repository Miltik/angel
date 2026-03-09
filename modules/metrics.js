/**
 * Metrics Module - Data collection and calculation
 * Provides reusable metric gathering functions for dashboard and other modules
 * 
 * Features:
 * - Server and network metrics
 * - Income breakdown and rates
 * - Player statistics
 * - Phase progress tracking
 * 
 * @module modules/metrics
 */

import { config } from "/angel/config.js";
import { formatMoney } from "/angel/utils.js";
import { scanAll } from "/angel/services/network.js";

/**
 * Get income breakdown from game sources
 * @param {NS} ns
 * @param {Object} lastMoneySources - Previous money sources for rate calculation
 * @param {number} lastMoneySourceUpdate - Last update timestamp
 * @returns {Object} - {mode: string, entries: Array, lastSources: Object, lastUpdate: number}
 */
export function getIncomeBreakdown(ns, lastMoneySources = null, lastMoneySourceUpdate = 0) {
    try {
        const moneySources = ns.getMoneySources();
        const sinceInstall = moneySources?.sinceInstall;
        if (!sinceInstall || typeof sinceInstall !== "object") {
            return { mode: "none", entries: [], lastSources: null, lastUpdate: 0 };
        }

        const now = Date.now();
        if (lastMoneySources && lastMoneySourceUpdate > 0) {
            const elapsedSeconds = Math.max(0.001, (now - lastMoneySourceUpdate) / 1000);
            const liveEntries = [];

            for (const [key, currentValue] of Object.entries(sinceInstall)) {
                if (key === "total" || typeof currentValue !== "number") continue;
                const previousValue = lastMoneySources[key] || 0;
                const deltaPerSecond = (currentValue - previousValue) / elapsedSeconds;
                if (deltaPerSecond > 0) {
                    liveEntries.push({
                        key,
                        label: formatIncomeSourceLabel(key),
                        value: deltaPerSecond
                    });
                }
            }

            liveEntries.sort((a, b) => b.value - a.value);
            return { 
                mode: "live", 
                entries: liveEntries,
                lastSources: { ...sinceInstall },
                lastUpdate: now
            };
        }

        const totalEntries = [];
        for (const [key, value] of Object.entries(sinceInstall)) {
            if (key === "total" || typeof value !== "number" || value <= 0) continue;
            totalEntries.push({
                key,
                label: formatIncomeSourceLabel(key),
                value
            });
        }

        totalEntries.sort((a, b) => b.value - a.value);
        return { 
            mode: "total", 
            entries: totalEntries,
            lastSources: { ...sinceInstall },
            lastUpdate: now
        };
    } catch (e) {
        return { mode: "none", entries: [], lastSources: null, lastUpdate: 0 };
    }
}

/**
 * Format income source key to human-readable label
 * @param {string} sourceKey
 * @returns {string}
 */
export function formatIncomeSourceLabel(sourceKey) {
    const labels = {
        hacking: "Hacking",
        hacknet: "Hacknet",
        servers: "Servers",
        stock: "Stocks",
        gang: "Gang",
        bladeburner: "Bladeburner",
        codingcontract: "Contracts",
        crime: "Crime",
        work: "Work",
        class: "Class",
        sleeves: "Sleeves",
        corporation: "Corporation",
        other: "Other"
    };

    if (labels[sourceKey]) return labels[sourceKey];
    return sourceKey
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, c => c.toUpperCase());
}

/**
 * Get phase goal summary for next phase
 * @param {NS} ns
 * @param {Object} player
 * @param {number} currentPhase
 * @param {number} nextPhase
 * @returns {string}
 */
export function getPhaseGoalSummary(ns, player, currentPhase, nextPhase) {
    const thresholds = config.gamePhases?.thresholds || {};
    const hackLevel = Number(player?.skills?.hacking || 0);
    const money = Number(player?.money || 0) + Number(ns.getServerMoneyAvailable("home") || 0);
    const minCombat = Math.min(
        Number(player?.skills?.strength || 0),
        Number(player?.skills?.defense || 0),
        Number(player?.skills?.dexterity || 0),
        Number(player?.skills?.agility || 0)
    );

    if (nextPhase === 1) {
        const t = thresholds.phase0to1 || { hackLevel: 75, money: 10000000 };
        const hackNeed = Math.max(0, t.hackLevel - hackLevel);
        const moneyNeed = Math.max(0, t.money - money);
        return `Hack +${Math.ceil(hackNeed)}, Money +${formatMoney(moneyNeed)}`;
    }

    if (nextPhase === 2) {
        const t = thresholds.phase1to2 || { hackLevel: 200, money: 100000000 };
        const hackNeed = Math.max(0, t.hackLevel - hackLevel);
        const moneyNeed = Math.max(0, t.money - money);
        return `Hack +${Math.ceil(hackNeed)}, Money +${formatMoney(moneyNeed)}`;
    }

    if (nextPhase === 3) {
        const t = thresholds.phase2to3 || { hackLevel: 500, money: 500000000 };
        const hackNeed = Math.max(0, t.hackLevel - hackLevel);
        const moneyNeed = Math.max(0, t.money - money);
        return `Hack +${Math.ceil(hackNeed)}, Money +${formatMoney(moneyNeed)}`;
    }

    if (nextPhase === 4 || currentPhase === 4) {
        const t = thresholds.phase3to4 || { hackLevel: 800, stats: 70 };
        const hackNeed = Math.max(0, t.hackLevel - hackLevel);
        const statNeed = Math.max(0, t.stats - minCombat);
        return `Hack +${Math.ceil(hackNeed)}, Combat mins +${Math.ceil(statNeed)}`;
    }

    return "Maintain daemon prep systems";
}

/**
 * Count rooted servers
 * @param {NS} ns
 * @returns {number}
 */
export function countRootedServers(ns) {
    const all = scanAll(ns);
    return all.filter(server => ns.hasRootAccess(server)).length;
}

/**
 * Count backdoored servers
 * @param {NS} ns
 * @returns {number}
 */
export function countBackdooredServers(ns) {
    const all = scanAll(ns);
    let count = 0;
    for (const server of all) {
        try {
            const serverObj = ns.getServer(server);
            if (serverObj.backdoorInstalled) count++;
        } catch (e) {
            // Skip
        }
    }
    return count;
}

/**
 * Count purchased servers
 * @param {NS} ns
 * @returns {number}
 */
export function countPurchasedServers(ns) {
    return ns.getPurchasedServers().length;
}

/**
 * Calculate total RAM across all servers
 * @param {NS} ns
 * @returns {number}
 */
export function calculateTotalRam(ns) {
    const all = scanAll(ns);
    let total = 0;
    for (const server of all) {
        total += ns.getServerMaxRam(server);
    }
    return total;
}

/**
 * Calculate used RAM across all servers
 * @param {NS} ns
 * @returns {number}
 */
export function calculateUsedRam(ns) {
    const all = scanAll(ns);
    let total = 0;
    for (const server of all) {
        total += ns.getServerUsedRam(server);
    }
    return total;
}

/**
 * Get hacking XP from player
 * @param {Object} player
 * @returns {number}
 */
export function getHackingExp(player) {
    return player?.exp?.hacking || 0;
}

/**
 * Calculate money rate (money/sec)
 * @param {number} currentMoney
 * @param {number} lastMoney
 * @param {number} elapsedMs
 * @returns {number}
 */
export function calculateMoneyRate(currentMoney, lastMoney, elapsedMs) {
    if (elapsedMs <= 0) return 0;
    return ((currentMoney - lastMoney) / elapsedMs) * 1000;
}

/**
 * Calculate XP rate (xp/sec)
 * @param {number} currentXp
 * @param {number} lastXp
 * @param {number} elapsedMs
 * @returns {number}
 */
export function calculateXpRate(currentXp, lastXp, elapsedMs) {
    if (elapsedMs <= 0) return 0;
    return ((currentXp - lastXp) / elapsedMs) * 1000;
}

/**
 * Format phase label
 * @param {string} value
 * @returns {string}
 */
export function formatPhaseLabel(value) {
    return String(value || "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/^./, c => c.toUpperCase());
}

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== Metrics Module ===");
    ns.tprint("");
    
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home") + player.money;
    
    ns.tprint("Network Metrics:");
    ns.tprint(`  Rooted servers: ${countRootedServers(ns)}`);
    ns.tprint(`  Backdoored servers: ${countBackdooredServers(ns)}`);
    ns.tprint(`  Purchased servers: ${countPurchasedServers(ns)}`);
    ns.tprint(`  Total RAM: ${calculateTotalRam(ns).toFixed(0)} GB`);
    ns.tprint(`  Used RAM: ${calculateUsedRam(ns).toFixed(0)} GB`);
    
    ns.tprint("");
    ns.tprint("Income Breakdown:");
    const income = getIncomeBreakdown(ns);
    ns.tprint(`  Mode: ${income.mode}`);
    for (const entry of income.entries.slice(0, 5)) {
        ns.tprint(`    ${entry.label}: ${formatMoney(entry.value)}`);
    }
    
    ns.tprint("");
    ns.tprint("Phase Goals:");
    for (let phase = 0; phase < 4; phase++) {
        const goal = getPhaseGoalSummary(ns, player, phase, phase + 1);
        ns.tprint(`  Phase ${phase} -> ${phase + 1}: ${goal}`);
    }
}
