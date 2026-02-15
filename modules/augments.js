/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    
    // Check if we have SF4 (Singularity access)
    if (!hasSingularityAccess(ns)) {
        ns.print("Singularity functions not available (need SF4)");
        ns.print("Augmentation module will remain idle until SF4 is obtained");
        // Keep running but do nothing
        while (true) {
            await ns.sleep(60000);
        }
    }
    
    ns.print("Augmentation module started");
    
    while (true) {
        try {
            await augmentLoop(ns);
        } catch (e) {
            ns.print(`Augmentation management error: ${e}`);
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
 * Inline format money (remove imports)
 * @param {number} amount
 * @returns {string}
 */
function formatMoney(amount) {
    if (amount >= 1e12) return `$${(amount / 1e12).toFixed(2)}t`;
    if (amount >= 1e9) return `$${(amount / 1e9).toFixed(2)}b`;
    if (amount >= 1e6) return `$${(amount / 1e6).toFixed(2)}m`;
    if (amount >= 1e3) return `$${(amount / 1e3).toFixed(2)}k`;
    return `$${amount.toFixed(0)}`;
}

/**
 * Get available augmentations from joined factions
 * @param {NS} ns
 * @returns {Array}
 */
function getAvailableAugmentsInline(ns) {
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
 * Get priority augmentations (those in augmentPriority config)
 * @param {NS} ns
 * @param {Array} available
 * @returns {Array}
 */
function getPriorityAugmentsInline(ns, available) {
    // Priority list hardcoded (removing config dependency)
    const priorities = [
        "BitWire",
        "Artificial Bio-neural Network Implant",
        "Artificial Synaptic Potentiation",
    ];
    
    return available.filter(aug => priorities.includes(aug.name));
}

/**
 * Main augmentation loop
 * @param {NS} ns
 */
async function augmentLoop(ns) {
    const money = ns.getServerMoneyAvailable("home");
    const available = getAvailableAugmentsInline(ns);
    const priority = getPriorityAugmentsInline(ns, available);
    
    // Show status
    const ownedCount = ns.singularity.getOwnedAugmentations(true).length;
    ns.print(`═══ Augmentations ═══`);
    ns.print(`Money: ${formatMoney(money)} | Owned: ${ownedCount}`);
    
    if (available.length === 0) {
        ns.print(`No augmentations available yet`);
        return;
    }
    
    // Show all available augmentations
    ns.print(`Available augments:`);
    for (const aug of available.slice(0, 5)) {
        const affordable = money >= aug.price ? "✓" : "✗";
        ns.print(`  ${affordable} ${aug.name} (${aug.faction}): ${formatMoney(aug.price)}`);
    }
    if (available.length > 5) {
        ns.print(`  ... and ${available.length - 5} more`);
    }
    
    // Try to buy priority augments first
    let boughtCount = 0;
    for (const aug of priority) {
        if (money >= aug.price) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            
            if (success) {
                ns.print(`Purchased: ${aug.name} (${aug.faction}) for ${formatMoney(aug.price)}`);
                boughtCount++;
                money = ns.getServerMoneyAvailable("home");
            }
        }
    }
    
    if (boughtCount === 0 && priority.length > 0) {
        const nextAug = priority[0];
        const needed = nextAug.price - money;
        ns.print(`Next: ${nextAug.name} - Need ${formatMoney(needed)} more`);
    }
}

/**
 * Purchase all affordable augmentations
 * @param {NS} ns
 * @returns {number} - Number of augments purchased
 */
export function buyAllAffordable(ns) {
    if (!hasSingularityAccess(ns)) return 0;
    
    const available = getAvailableAugmentsInline(ns);
    let purchased = 0;
    
    // Sort by price (cheapest first for now)
    available.sort((a, b) => a.price - b.price);
    
    for (const aug of available) {
        const money = ns.getServerMoneyAvailable("home");
        
        if (money >= aug.price) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            
            if (success) {
                ns.print(`Purchased: ${aug.name} from ${aug.faction}`);
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
    
    const available = getAvailableAugmentsInline(ns);
    const priority = getPriorityAugmentsInline(ns, available);
    let purchased = 0;
    
    for (const aug of priority) {
        const money = ns.getServerMoneyAvailable("home");
        
        if (money >= aug.price) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            
            if (success) {
                ns.print(`Purchased priority augment: ${aug.name}`);
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
    
    const available = getAvailableAugmentsInline(ns);
    const priority = getPriorityAugmentsInline(ns, available);
    
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
        ns.print("Installing augmentations and resetting...");
        ns.singularity.installAugmentations("/angel/angel.js");
    }
}
