/**
 * ANGEL Dashboard - Factions Display Module
 * Extracted for RAM efficiency: handles all faction-related display logic
 * 
 * Reduces dashboard.js import coupling by centralizing faction display functions
 * 
 * @param {NS} ns
 */

import { config } from "/angel/config.js";
import { formatMoney } from "/angel/utils.js";

/**
 * Display faction status and opportunities
 * @param {object} ui - UI window
 * @param {NS} ns
 * @param {object} player - Player object
 */
export function displayFactionStatus(ui, ns, player) {
    try {
        const factions = player.factions || [];
        const invites = ns.singularity.checkFactionInvitations();
        
        if (factions.length === 0 && invites.length === 0) {
            ui.log(`🏛️  FACTIONS: None joined | No pending invitations`, "info");
            return;
        }
        
        // Sort factions by rep (highest first)
        const factionInfo = factions.map(f => ({
            name: f,
            rep: ns.singularity.getFactionRep(f),
            favor: ns.singularity.getFactionFavor(f)
        })).sort((a, b) => b.rep - a.rep);
        
        if (factionInfo.length > 0) {
            const top2 = factionInfo.slice(0, 2);
            const topRep = factionInfo[0];
            ui.log(`🏛️  FACTIONS: ${factions.length} joined | ${invites.length} invites | Top rep: ${topRep.name} (${formatMoney(topRep.rep)})`, "info");

            const topLine = top2
                .map(f => `${f.name}: ${formatMoney(f.rep)} (F${f.favor.toFixed(0)})`)
                .join(" | ");
            ui.log(`   Top: ${topLine}`, "info");

            if (factionInfo.length > 2) {
                ui.log(`   + ${factionInfo.length - 2} more joined factions`, "info");
            }
        }

        const grindCandidates = getFactionGrindCandidates(ns, factions).slice(0, 2);
        if (grindCandidates.length > 0) {
            const candidateLine = grindCandidates
                .map(c => `${c.name} (A${c.grindableCount} • ${formatMoney(c.grindableValue)} • Rep ${formatMoney(c.maxRepNeeded)})`)
                .join(" | ");
            ui.log(`   🎯 Grind Priority: ${candidateLine}`, "info");
        }

        const augGoal = getAugmentGoalSnapshot(ns);
        if (augGoal) {
            ui.log(`   🧬 Aug Goal: ${augGoal.name} @ ${augGoal.faction} | Rep ${formatMoney(augGoal.repShort)} | Money ${formatMoney(augGoal.moneyShort)}`, "info");
        }
        
        if (invites.length > 0) {
            ui.log(`   📨 Pending Invitations: ${invites.join(", ")}`, "info");
        }
    } catch (e) {
        // Singularity not available
    }
}

/**
 * Get factions with grindable augmentations, sorted by priority
 * @param {NS} ns
 * @param {Array} factions - List of faction names
 * @returns {Array}
 */
export function getFactionGrindCandidates(ns, factions) {
    const candidates = [];
    for (const faction of factions) {
        if (faction === "NiteSec") continue;

        const summary = getFactionOpportunitySummaryDashboard(ns, faction);
        if (summary.grindableCount <= 0) continue;

        candidates.push({
            name: faction,
            ...summary,
        });
    }

    candidates.sort((a, b) =>
        b.grindableCount - a.grindableCount ||
        b.grindableValue - a.grindableValue ||
        b.maxRepNeeded - a.maxRepNeeded
    );

    return candidates;
}

/**
 * Get augmentation opportunity summary for a faction (used both here and in augments display)
 * @param {NS} ns
 * @param {string} faction - Faction name
 * @returns {object}
 */
export function getFactionOpportunitySummaryDashboard(ns, faction) {
    const currentRep = ns.singularity.getFactionRep(faction);
    const augments = ns.singularity.getAugmentationsFromFaction(faction);
    const owned = new Set(ns.singularity.getOwnedAugmentations(true));

    let grindableCount = 0;
    let grindableValue = 0;
    let maxRepNeeded = 0;

    for (const aug of augments) {
        if (owned.has(aug)) continue;

        const repReq = ns.singularity.getAugmentationRepReq(aug);
        const repNeeded = Math.max(0, repReq - currentRep);
        if (repNeeded <= 0) continue;

        const price = ns.singularity.getAugmentationPrice(aug);
        grindableCount++;
        grindableValue += price;
        if (repNeeded > maxRepNeeded) {
            maxRepNeeded = repNeeded;
        }
    }

    return { grindableCount, grindableValue, maxRepNeeded };
}

/**
 * Get the closest-to-available augmentation across all factions
 * Used by both faction display and augmentation display
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
