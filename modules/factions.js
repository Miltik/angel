import { config } from "/angel/config.js";
import { formatNumber, formatMoney, log } from "/angel/utils.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    
    // Check if we have SF4 (Singularity access)
    if (!hasSingularityAccess(ns)) {
        log(ns, "Singularity functions not available (need SF4)", "WARN");
        log(ns, "Faction module will remain idle until SF4 is obtained", "INFO");
        // Keep running but do nothing
        while (true) {
            await ns.sleep(60000);
        }
    }
    
    log(ns, "Faction module started", "INFO");
    
    while (true) {
        try {
            await factionLoop(ns);
        } catch (e) {
            log(ns, `Faction management error: ${e}`, "ERROR");
        }
        await ns.sleep(30000); // Check every 30 seconds
    }
}

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
 * Main faction loop
 * @param {NS} ns
 */
async function factionLoop(ns) {
    const player = ns.getPlayer();
    const currentFactions = player.factions;
    
    // Get faction invitations
    const invitations = ns.singularity.checkFactionInvitations();
    
    // Display faction status
    if (currentFactions.length > 0) {
        log(ns, `═══ Factions (${currentFactions.length} joined) ═══`, "INFO");
        for (const faction of currentFactions) {
            const rep = ns.singularity.getFactionRep(faction);
            const repNeeded = getRepNeeded(ns, faction);
            const repStr = `Rep: ${formatNumber(rep)} / ${formatNumber(rep + repNeeded)}`;
            log(ns, `  • ${faction}: ${repStr}`, "INFO");
        }
    }
    
    // Show pending invitations
    if (invitations.length > 0) {
        log(ns, `Pending invitations: ${invitations.join(", ")}`, "WARN");
    }
    
    // Auto-join priority factions
    if (config.factions.autoJoinFactions) {
        for (const faction of invitations) {
            if (config.factions.priorityFactions.includes(faction)) {
                ns.singularity.joinFaction(faction);
                log(ns, `Joined faction: ${faction}`, "INFO");
            }
        }
    }
    
    // Work for faction rep if configured
    if (config.factions.workForFactionRep) {
        await workForBestFaction(ns);
    }
}

/**
 * Work for the faction that needs rep the most
 * @param {NS} ns
 */
async function workForBestFaction(ns) {
    const player = ns.getPlayer();
    const factions = player.factions;
    
    if (factions.length === 0) {
        log(ns, "Waiting for faction invitations...", "INFO");
        return;
    }
    
    // Check current work
    const currentWork = ns.singularity.getCurrentWork();
    if (currentWork && currentWork.type === "FACTION") {
        const progress = currentWork.cyclesPassed || 0;
        log(ns, `Currently working for ${currentWork.factionName} (progress: ${progress} cycles)`, "INFO");
        return;
    }
    
    // Find faction with best augments we can't afford yet
    let bestFaction = null;
    let bestScore = 0;
    
    for (const faction of factions) {
        // Check if this is a priority faction
        if (!config.factions.priorityFactions.includes(faction)) {
            continue;
        }
        
        const repNeeded = getRepNeeded(ns, faction);
        
        if (repNeeded > 0) {
            // Score based on priority (earlier in list = higher score)
            const priorityIndex = config.factions.priorityFactions.indexOf(faction);
            const score = (factions.length - priorityIndex) * repNeeded;
            
            if (score > bestScore) {
                bestScore = score;
                bestFaction = faction;
            }
        }
    }
    
    if (bestFaction) {
        // Start working for faction (hacking contracts are usually best)
        const success = ns.singularity.workForFaction(bestFaction, "hacking", false);
        
        if (success) {
            const repNeeded = getRepNeeded(ns, bestFaction);
            log(ns, `Working for ${bestFaction} (${formatNumber(repNeeded)} rep needed)`, "INFO");
        }
    } else {
        log(ns, "All priority factions have sufficient reputation", "INFO");
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
