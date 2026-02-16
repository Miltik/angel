import { config } from "/angel/config.js";
import { formatNumber, formatMoney } from "/angel/utils.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    
    ns.print("🎭 Activity & Factions handling delegated to crime.js (merged module)");
    ns.print("This module kept for compatibility but all activity logic is in crime.js");
    
    // Check if we have SF4 (Singularity access)
    if (!hasSingularityAccess(ns)) {
        ns.print("Singularity functions not available (need SF4)");
        // Keep running but do nothing
        while (true) {
            await ns.sleep(60000);
        }
    }
    
    
    // This module is now delegated to crime.js
    while (true) {
        ns.print("Factions module idle - see crime.js for Activity + Factions handling");
        await ns.sleep(30000);


/**
 * Check if we have access to Singularity functions (SF4)
 * @param {NS} ns
 * @returns {boolean}
 */
function hasSingularityAccess(ns) {
    try {
        // Try to call a singularity function
        ns.singularity.getCurrentWork();
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Get total rep needed for all unowned augments in a faction
 * @param {NS} ns
 * @param {string} faction
 * @returns {number}
 */
function getRepNeeded(ns, faction) {
    const currentRep = ns.singularity.getFactionRep(faction);
    const augments = ns.singularity.getAugmentationsFromFaction(faction);
    
    let maxRepNeeded = 0;
    
    for (const aug of augments) {
        // Skip if we already own it
        if (ns.singularity.getOwnedAugmentations(true).includes(aug)) {
            continue;
        }
        
        const repReq = ns.singularity.getAugmentationRepReq(aug);
        
        if (repReq > currentRep) {
            maxRepNeeded = Math.max(maxRepNeeded, repReq - currentRep);
        }
    }
    
    return maxRepNeeded;
}

/**
 * Get all available augmentations we can purchase
 * @param {NS} ns
 * @returns {Array}
 */
export function getAvailableAugments(ns) {
    if (!hasSingularityAccess(ns)) return [];
    
    const player = ns.getPlayer();
    const owned = ns.singularity.getOwnedAugmentations(true);
    const available = [];
    
    for (const faction of player.factions) {
        const augments = ns.singularity.getAugmentationsFromFaction(faction);
        const factionRep = ns.singularity.getFactionRep(faction);
        
        for (const aug of augments) {
            if (owned.includes(aug)) continue;
            
            const repReq = ns.singularity.getAugmentationRepReq(aug);
            const price = ns.singularity.getAugmentationPrice(aug);
            
            if (factionRep >= repReq) {
                available.push({
                    name: aug,
                    faction,
                    price,
                    repReq,
                });
            }
        }
    }
    
    return available;
}

/**
 * Get priority augmentations from config
 * @param {NS} ns
 * @returns {Array}
 */
export function getPriorityAugments(ns) {
    const available = getAvailableAugments(ns);
    return available.filter(aug => 
        config.augmentations.augmentPriority.includes(aug.name)
    );
}

/**
 * Display faction status
 * @param {NS} ns
 */
export function displayFactionStatus(ns) {
    if (!hasSingularityAccess(ns)) {
        ns.tprint("Singularity functions not available");
        return;
    }
    
    const player = ns.getPlayer();
    const factions = player.factions;
    
    ns.tprint("\n=== FACTION STATUS ===");
    
    for (const faction of factions) {
        const rep = ns.singularity.getFactionRep(faction);
        const favor = ns.singularity.getFactionFavor(faction);
        
        ns.tprint(`${faction}: Rep ${formatNumber(rep)}, Favor ${formatNumber(favor)}`);
    }
    
    const invitations = ns.singularity.checkFactionInvitations();
    if (invitations.length > 0) {
        ns.tprint("\nPending invitations: " + invitations.join(", "));
    }
}
