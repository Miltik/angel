import { config } from "/angel/config.js";
import { formatMoney, log } from "/angel/utils.js";
import { getAvailableAugments, getPriorityAugments } from "/angel/modules/factions.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.tail();
    
    // Check if we have SF4 (Singularity access)
    if (!hasSingularityAccess(ns)) {
        log(ns, "Singularity functions not available (need SF4)", "WARN");
        return;
    }
    
    log(ns, "Augmentation module started", "INFO");
    
    while (true) {
        try {
            await augmentLoop(ns);
        } catch (e) {
            log(ns, `Augmentation management error: ${e}`, "ERROR");
        }
        await ns.sleep(60000); // Check every minute
    }
}

/**
 * Check if we have access to Singularity functions (SF4)
 * @param {NS} ns
 * @returns {boolean}
 */
function hasSingularityAccess(ns) {
    try {
        ns.singularity.getCurrentWork();
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Main augmentation loop
 * @param {NS} ns
 */
async function augmentLoop(ns) {
    // Only buy if enabled
    if (!config.augmentations.autoBuyAugments) {
        return;
    }
    
    const money = ns.getServerMoneyAvailable("home");
    const available = getAvailableAugments(ns);
    const priority = getPriorityAugments(ns);
    
    // Try to buy priority augments first
    for (const aug of priority) {
        if (money >= aug.price) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            
            if (success) {
                log(ns, `Purchased augmentation: ${aug.name} from ${aug.faction} for ${formatMoney(aug.price)}`, "INFO");
            }
        }
    }
}

/**
 * Purchase all affordable augmentations
 * @param {NS} ns
 * @returns {number} - Number of augments purchased
 */
export function buyAllAffordable(ns) {
    if (!hasSingularityAccess(ns)) return 0;
    
    const available = getAvailableAugments(ns);
    let purchased = 0;
    
    // Sort by price (cheapest first for now)
    available.sort((a, b) => a.price - b.price);
    
    for (const aug of available) {
        const money = ns.getServerMoneyAvailable("home");
        
        if (money >= aug.price) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            
            if (success) {
                log(ns, `Purchased: ${aug.name} from ${aug.faction}`, "INFO");
                purchased++;
            }
        }
    }
    
    return purchased;
}

/**
 * Purchase priority augmentations only
 * @param {NS} ns
 * @returns {number} - Number of augments purchased
 */
export function buyPriority(ns) {
    if (!hasSingularityAccess(ns)) return 0;
    
    const priority = getPriorityAugments(ns);
    let purchased = 0;
    
    for (const aug of priority) {
        const money = ns.getServerMoneyAvailable("home");
        
        if (money >= aug.price) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            
            if (success) {
                log(ns, `Purchased priority augment: ${aug.name}`, "INFO");
                purchased++;
            }
        }
    }
    
    return purchased;
}

/**
 * Display available augmentations
 * @param {NS} ns
 */
export function displayAugments(ns) {
    if (!hasSingularityAccess(ns)) {
        ns.tprint("Singularity functions not available");
        return;
    }
    
    const available = getAvailableAugments(ns);
    const priority = getPriorityAugments(ns);
    
    ns.tprint("\n=== PRIORITY AUGMENTATIONS ===");
    for (const aug of priority) {
        ns.tprint(`${aug.name} (${aug.faction}): ${formatMoney(aug.price)}`);
    }
    
    ns.tprint(`\n=== ALL AVAILABLE (${available.length}) ===`);
    for (const aug of available) {
        const isPriority = priority.some(p => p.name === aug.name);
        const marker = isPriority ? "[P]" : "";
        ns.tprint(`${marker} ${aug.name} (${aug.faction}): ${formatMoney(aug.price)}`);
    }
}

/**
 * Check if we should install augmentations (and reset)
 * @param {NS} ns
 * @returns {boolean}
 */
export function shouldInstallAugments(ns) {
    if (!hasSingularityAccess(ns)) return false;
    
    const owned = ns.singularity.getOwnedAugmentations(false);
    const installed = ns.singularity.getOwnedAugmentations(true);
    
    // If we have purchased augments that aren't installed
    return owned.length < installed.length;
}

/**
 * Install augmentations and reset
 * @param {NS} ns
 */
export function installAugmentations(ns) {
    if (!hasSingularityAccess(ns)) return;
    
    if (shouldInstallAugments(ns)) {
        log(ns, "Installing augmentations and resetting...", "INFO");
        ns.singularity.installAugmentations("/angel/angel.js");
    }
}
