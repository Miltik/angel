/**
 * ANGEL Dashboard - Augmentations & Reset Display Module
 * Extracted for RAM efficiency: handles all augmentation and reset-related display logic
 * 
 * Reduces dashboard.js import coupling by centralizing augmentation display functions
 * 
 * @param {NS} ns
 */

import { config } from "/angel/config.js";
import { formatMoney } from "/angel/utils.js";

/**
 * Display augmentation status and purchasing readiness
 * @param {object} ui - UI window
 * @param {NS} ns
 * @param {object} player - Player object
 */
export function displayAugmentationStatus(ui, ns, player) {
    try {
        const installed = ns.singularity.getOwnedAugmentations(false);
        const queued = ns.singularity.getOwnedAugmentations(true).filter(a => !installed.includes(a));

        ui.log(
            `🧬 AUGMENTATIONS: ${installed.length} installed | ${queued.length} queued | Next reset: ${
                isReadyForReset(ns) ? "🟢 READY" : "⏳ " + getResetTimeEstimate(ns)
            }`,
            "info"
        );

        if (queued.length > 0 && queued.length <= 3) {
            ui.log(`   Queued: ${queued.join(", ")}`, "info");
        } else if (queued.length > 3) {
            ui.log(`   Queued: ${queued.slice(0, 2).join(", ")} + ${queued.length - 2} more`, "info");
        }

        const aug = getAugmentGoalSnapshot(ns);
        if (aug) {
            const progress = getResetReadiness(ns);
            ui.log(`   Target: ${aug.name} @ ${aug.faction} | Progress: ${progress}%`, "info");
        }

        // Show upcoming reset time
        const resetData = loadResetState(ns);
        if (resetData && resetData.nextResetTime) {
            const timeUntil = resetData.nextResetTime - Date.now();
            if (timeUntil > 0 && timeUntil < 3600000) {
                const mins = Math.ceil(timeUntil / 60000);
                ui.log(`   ⏱️  Reset queued in ${mins} minute(s)`, "warning");
            }
        }
    } catch (e) {
        // Singularity not available
    }
}

/**
 * Display reset status including time until next reset and readiness
 * @param {object} ui - UI window
 * @param {NS} ns
 */
export function displayResetStatus(ui, ns) {
    try {
        const resetData = loadResetState(ns);
        if (!resetData) return;

        const lastReset = resetData.lastResetTime || 0;
        const nextReset = resetData.nextResetTime || 0;
        const timeSinceLast = Date.now() - lastReset;
        const hoursAgo = (timeSinceLast / 3600000).toFixed(1);

        if (nextReset > Date.now()) {
            const timeUntil = nextReset - Date.now();
            const minutesUntil = Math.ceil(timeUntil / 60000);
            ui.log(`↻ RESET: Queued in ${minutesUntil}m | Last: ${hoursAgo}h ago`, "warning");
        } else if (lastReset > 0) {
            ui.log(`↻ RESET: Last ${hoursAgo}h ago | Next: On demand`, "info");
        }
    } catch (e) {
        // State file not available
    }
}

/**
 * Get the closest-to-available augmentation across all factions
 * @param {NS} ns
 * @returns {object | null}
 */
export function getAugmentGoalSnapshot(ns) {
    try {
        const player = ns.getPlayer();
        const currentMoney = Number(ns.getServerMoneyAvailable("home") || 0);
        const owned = new Set(ns.singularity.getOwnedAugmentations(true));
        const priorityList = config.augmentations?.augmentPriority || [];
        const candidates = [];

        for (const faction of player.factions || []) {
            if (faction === "NiteSec") continue;

            const factionRep = Number(ns.singularity.getFactionRep(faction) || 0);
            const augments = ns.singularity.getAugmentationsFromFaction(faction) || [];

            for (const aug of augments) {
                if (owned.has(aug)) continue;
                if (!hasMetAugPrereqsDashboard(ns, aug, owned)) continue;

                const repReq = Number(ns.singularity.getAugmentationRepReq(aug) || 0);
                const price = Number(ns.singularity.getAugmentationPrice(aug) || 0);
                const repShort = Math.max(0, repReq - factionRep);
                const moneyShort = Math.max(0, price - currentMoney);
                const score = (moneyShort > 0 ? Math.log10(moneyShort + 1) : 0) + (repShort > 0 ? Math.log10(repShort + 1) : 0);
                const effective = Math.max(0, score - (priorityList.includes(aug) ? 0.15 : 0));

                candidates.push({ name: aug, faction, price, repReq, repShort, moneyShort, effective });
            }
        }

        if (candidates.length === 0) return null;

        candidates.sort((a, b) => {
            if (a.effective !== b.effective) return a.effective - b.effective;
            const aReady = a.repShort === 0 && a.moneyShort === 0;
            const bReady = b.repShort === 0 && b.moneyShort === 0;
            if (aReady !== bReady) return aReady ? -1 : 1;
            if (a.price !== b.price) return a.price - b.price;
            return a.name.localeCompare(b.name);
        });

        return candidates[0];
    } catch (e) {
        return null;
    }
}

/**
 * Check if augmentation prerequisites are met
 * @param {NS} ns
 * @param {string} augName
 * @param {Set} ownedSet
 * @returns {boolean}
 */
function hasMetAugPrereqsDashboard(ns, augName, ownedSet) {
    try {
        const prereqs = ns.singularity.getAugmentationPrereq(augName) || [];
        if (!Array.isArray(prereqs) || prereqs.length === 0) return true;
        return prereqs.every(prereq => ownedSet.has(prereq));
    } catch (e) {
        return true;
    }
}

/**
 * Check if the player is ready for a reset (sufficient money + augmentations queued)
 * @param {NS} ns
 * @returns {boolean}
 */
function isReadyForReset(ns) {
    try {
        const queued = ns.singularity.getOwnedAugmentations(true).filter(
            a => !ns.singularity.getOwnedAugmentations(false).includes(a)
        );
        if (queued.length === 0) return false;
        
        const minMoney = 1e6; // Need at least 1M for reset
        const currentMoney = ns.getServerMoneyAvailable("home");
        return currentMoney >= minMoney;
    } catch (e) {
        return false;
    }
}

/**
 * Get reset readiness percentage (money + rep progress toward next augmentation)
 * @param {NS} ns
 * @returns {number}
 */
function getResetReadiness(ns) {
    try {
        const aug = getAugmentGoalSnapshot(ns);
        if (!aug) return 100;
        
        const totalShortfall = aug.repShort + aug.moneyShort;
        if (totalShortfall <= 0) return 100;
        
        const totalNeeded = aug.repReq + aug.price;
        const progress = ((totalNeeded - totalShortfall) / totalNeeded) * 100;
        return Math.round(Math.max(0, Math.min(100, progress)));
    } catch (e) {
        return 0;
    }
}

/**
 * Get human-readable time until next reset
 * @param {NS} ns
 * @returns {string}
 */
function getResetTimeEstimate(ns) {
    try {
        const resetData = loadResetState(ns);
        if (!resetData || !resetData.nextResetTime) return "∞";
        
        const timeUntil = resetData.nextResetTime - Date.now();
        if (timeUntil <= 0) return "Now";
        
        const days = Math.floor(timeUntil / 86400000);
        const hours = Math.floor((timeUntil % 86400000) / 3600000);
        const minutes = Math.ceil((timeUntil % 3600000) / 60000);
        
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    } catch (e) {
        return "∞";
    }
}

/**
 * Load reset state from port-based storage
 * @param {NS} ns
 * @returns {object | null}
 */
function loadResetState(ns) {
    try {
        const storage = ns.getPortData(1); // ORCHESTRATOR port
        if (!storage || typeof storage !== 'object') return null;
        return storage.resetState || null;
    } catch (e) {
        return null;
    }
}
