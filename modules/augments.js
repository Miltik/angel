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
    
    ns.print("💊 Augmentation module started - Phase-aware aggressive buying");
    
    while (true) {
        try {
            await augmentLoop(ns);
        } catch (e) {
            ns.print(`💊 Augmentation management error: ${e}`);
        }
        await ns.sleep(60000); // Check every minute
    }
}

/**
 * Read game phase from orchestrator port (port 7)
 */
function readGamePhase(ns) {
    const phasePortData = ns.peek(7);
    if (phasePortData === "NULL PORT DATA") return 0;
    return parseInt(phasePortData) || 0;
}

/**
 * Get phase-appropriate spending strategy
 */
function getAugmentStrategy(phase) {
    switch(phase) {
        case 0: // Bootstrap - very conservative
            return { maxSpend: 1000000, buyAll: false, aggressive: false };
        case 1: // Early Scaling - moderate
            return { maxSpend: 50000000, buyAll: false, aggressive: false };
        case 2: // Mid Game - increasing spending
            return { maxSpend: 200000000, buyAll: false, aggressive: true };
        case 3: // Gang Phase - very aggressive
            return { maxSpend: 500000000, buyAll: true, aggressive: true };
        case 4: // Late Game - maximum
            return { maxSpend: 1000000000, buyAll: true, aggressive: true };
        default:
            return { maxSpend: 1000000, buyAll: false, aggressive: false };
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
 * Main augmentation loop - phase-aware
 * @param {NS} ns
 */
async function augmentLoop(ns) {
    const phase = readGamePhase(ns);
    const strategy = getAugmentStrategy(phase);
    const money = ns.getServerMoneyAvailable("home");
    const available = getAvailableAugmentsInline(ns);
    
    // Show status
    const ownedCount = ns.singularity.getOwnedAugmentations(false).length;
    const installedCount = ns.singularity.getOwnedAugmentations(true).length;
    const queuedCount = ownedCount - installedCount;
    
    ns.print(`💊 Phase ${phase} | Money: ${formatMoney(money)} | Queued: ${queuedCount}`);
    
    if (available.length === 0) {
        ns.print(`💊 No augmentations available yet`);
        return;
    }
    
    // Sort augments by price (cheapest first for priority buying)
    available.sort((a, b) => a.price - b.price);
    
    // Phase 3-4: Buy ALL available augmentations
    if (strategy.buyAll) {
        for (const aug of available) {
            if (money >= aug.price) {
                const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
                if (success) {
                    ns.print(`💊 Purchased: ${aug.name} (${aug.faction}) ${formatMoney(aug.price)}`);
                    money = ns.getServerMoneyAvailable("home");
                }
            }
        }
        return;
    }
    
    // Phase 0-2: Buy priority augments only
    const priority = getPriorityAugmentsInline(ns, available);
    for (const aug of priority) {
        if (money >= aug.price && money < strategy.maxSpend) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            if (success) {
                ns.print(`💊 Purchased priority: ${aug.name} ${formatMoney(aug.price)}`);
                money = ns.getServerMoneyAvailable("home");
            }
        }
    }
    
    // Show next augment info
    if (available.length > 0 && !(money >= available[0].price)) {
        const nextAug = available[0];
        const needed = nextAug.price - money;
        ns.print(`💊 Next: ${nextAug.name} - Need ${formatMoney(needed)} more`);
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
