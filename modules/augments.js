import { config } from "/angel/config.js";
import { formatMoney } from "/angel/utils.js";
import { createWindow } from "/angel/modules/uiManager.js";

const PHASE_PORT = 7;

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("augments", "💊 Augmentations", 700, 500, ns);
    ui.log("Augmentation module started - Phase-aware cascading", "info");
    
    // Check if we have SF4 (Singularity access)
    if (!hasSingularityAccess(ns)) {
        ui.log("Singularity access not available (need SF4) - waiting...", "warn");
        while (true) {
            await ns.sleep(60000);
        }
    }
    
    while (true) {
        try {
            await augmentLoop(ns, ui);
        } catch (e) {
            ui.log(`Augmentation error: ${e}`, "error");
        }
        await ns.sleep(60000); // Check every minute
    }
}

/**
 * Read game phase from orchestrator port (port 7)
 */
function readGamePhase(ns) {
    const phasePortData = ns.peek(PHASE_PORT);
    if (phasePortData === "NULL PORT DATA") return 0;
    return parseInt(phasePortData) || 0;
}

/**
 * Get phase configuration object
 * @param {number} phase
 */
function getPhaseConfig(phase) {
    const phaseKey = `phase${phase}`;
    return config.gamePhases[phaseKey] || config.gamePhases.phase0;
}

/**
 * Get phase-appropriate augmentation strategy
 * @param {number} phase
 */
function getAugmentStrategy(phase) {
    const phaseConfig = getPhaseConfig(phase);
    const spendingConfig = phaseConfig.spending || {};
    
    // Strategy based on phase progression
    switch(phase) {
        case 0: // Bootstrap
            return {
                phase,
                maxSpend: 1000000,
                buyAll: false,
                strategy: "priority_only",
                threshold: 0.2,
            };
        case 1: // Early Scaling
            return {
                phase,
                maxSpend: spendingConfig.augmentsTargetCost || 50000000,
                buyAll: false,
                strategy: "priority_focus",
                threshold: 0.15,
            };
        case 2: // Mid Game
            return {
                phase,
                maxSpend: spendingConfig.augmentsTargetCost || 200000000,
                buyAll: false,
                strategy: "priority_aggressive",
                threshold: 0.1,
            };
        case 3: // Gang Phase
            return {
                phase,
                maxSpend: spendingConfig.augmentsTargetCost || 500000000,
                buyAll: true,
                strategy: "buy_all",
                threshold: 0.05,
            };
        case 4: // Late Game
            return {
                phase,
                maxSpend: spendingConfig.augmentsTargetCost || 1000000000,
                buyAll: true,
                strategy: "buy_all_unlimited",
                threshold: 0.01,
            };
        default:
            return {
                phase: 0,
                maxSpend: 1000000,
                buyAll: false,
                strategy: "priority_only",
                threshold: 0.2,
            };
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
 * Get available augmentations from joined factions
 * Filters by reputation requirement
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
 * Get priority augmentations from config
 * Uses augmentPriority list from config
 * @param {NS} ns
 * @param {Array} available
 * @returns {Array}
 */
function getPriorityAugmentsInline(ns, available) {
    const priorities = config.augmentations.augmentPriority || [];
    
    if (priorities.length === 0) {
        // Default fallback if config is empty
        const defaults = [
            "BitWire",
            "Artificial Bio-neural Network Implant",
            "Artificial Synaptic Potentiation",
        ];
        return available.filter(aug => defaults.includes(aug.name));
    }
    
    return available.filter(aug => priorities.includes(aug.name));
}

/**
 * Main augmentation loop - phase-aware cascading
 * @param {NS} ns
 * @param {object} ui - UI window API
 */
async function augmentLoop(ns, ui) {
    const phase = readGamePhase(ns);
    const strategy = getAugmentStrategy(phase);
    const money = ns.getServerMoneyAvailable("home");
    const available = getAvailableAugmentsInline(ns);
    
    // Get queue status
    const ownedCount = ns.singularity.getOwnedAugmentations(false).length;
    const installedCount = ns.singularity.getOwnedAugmentations(true).length;
    const queuedCount = ownedCount - installedCount;
    
    // Display status
    ui.log(`[Phase ${phase}] Money: ${formatMoney(money)} | Strategy: ${strategy.strategy} | Queued: ${queuedCount}`, "info");
    
    if (available.length === 0) {
        ui.log(`No augmentations available yet`, "info");
        return;
    }
    
    // Sort by price (cheapest first)
    available.sort((a, b) => a.price - b.price);
    
    // Strategy: buyAll (phases 3-4)
    if (strategy.buyAll) {
        await buyAllAvailable(ns, available, money, ui);
        return;
    }
    
    // Strategy: Priority focus (phases 0-2)
    const priority = getPriorityAugmentsInline(ns, available);
    if (priority.length > 0) {
        await buyPriorityAugments(ns, priority, money, strategy, ui);
        return;
    }
    
    // Fallback: Show next affordable aug
    if (available.length > 0 && money < available[0].price) {
        const nextAug = available[0];
        const needed = nextAug.price - money;
        ui.log(`Next: ${nextAug.name} - Need ${formatMoney(needed)} more`, "info");
    }
}

/**
 * Buy all available augmentations
 * @param {NS} ns
 * @param {Array} available
 * @param {number} initialMoney
 * @param {object} ui - UI window API
 */
async function buyAllAvailable(ns, available, initialMoney, ui) {
    let money = initialMoney;
    let purchased = 0;
    
    for (const aug of available) {
        if (money >= aug.price) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            if (success) {
                ui.log(`Purchased: ${aug.name} (${aug.faction}) for ${formatMoney(aug.price)}`, "success");
                money = ns.getServerMoneyAvailable("home");
                purchased++;
            }
        }
    }
    
    if (purchased > 0) {
        ui.log(`Batch purchased ${purchased} augmentations`, "success");
    }
}

/**
 * Buy priority augmentations
 * @param {NS} ns
 * @param {Array} priority
 * @param {number} initialMoney
 * @param {object} strategy
 * @param {object} ui - UI window API
 */
async function buyPriorityAugments(ns, priority, initialMoney, strategy, ui) {
    let money = initialMoney;
    let purchased = 0;
    const spendThreshold = initialMoney * strategy.threshold;
    
    for (const aug of priority) {
        if (money >= aug.price && money <= spendThreshold) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            if (success) {
                ui.log(`Purchased priority: ${aug.name} for ${formatMoney(aug.price)}`, "success");
                money = ns.getServerMoneyAvailable("home");
                purchased++;
            }
        }
    }
    
    if (purchased > 0) {
        ui.log(`Batch purchased ${purchased} priority augmentations`, "success");
    } else if (priority.length > 0 && money < priority[0].price) {
        const nextAug = priority[0];
        const needed = nextAug.price - money;
        ui.log(`Next priority: ${nextAug.name} - Need ${formatMoney(needed)} more`, "info");
    }
}

/**
 * Purchase all affordable augmentations (exported for external use)
 * @param {NS} ns
 * @returns {number} - Number of augments purchased
 */
export function buyAllAffordable(ns) {
    if (!hasSingularityAccess(ns)) return 0;
    
    const available = getAvailableAugmentsInline(ns);
    let purchased = 0;
    let money = ns.getServerMoneyAvailable("home");
    
    // Sort by price (cheapest first)
    available.sort((a, b) => a.price - b.price);
    
    for (const aug of available) {
        if (money >= aug.price) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            if (success) {
                money = ns.getServerMoneyAvailable("home");
                purchased++;
            }
        }
    }
    
    return purchased;
}

/**
 * Purchase priority augmentations only (exported for external use)
 * @param {NS} ns
 * @returns {number} - Number of augments purchased
 */
export function buyPriority(ns) {
    if (!hasSingularityAccess(ns)) return 0;
    
    const available = getAvailableAugmentsInline(ns);
    const priority = getPriorityAugmentsInline(ns, available);
    let purchased = 0;
    let money = ns.getServerMoneyAvailable("home");
    
    for (const aug of priority) {
        if (money >= aug.price) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            if (success) {
                money = ns.getServerMoneyAvailable("home");
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
    const phase = readGamePhase(ns);
    
    ns.tprint("\n╔════════════════════════════════════════╗");
    ns.tprint("║     AUGMENTATION STATUS (Phase " + phase + ")      ║");
    ns.tprint("╚════════════════════════════════════════╝\n");
    
    if (priority.length > 0) {
        ns.tprint("=== PRIORITY AUGMENTATIONS ===");
        for (const aug of priority) {
            ns.tprint(`${aug.name} (${aug.faction}): ${formatMoney(aug.price)}`);
        }
        ns.tprint("");
    }
    
    ns.tprint(`=== ALL AVAILABLE (${available.length}) ===`);
    for (const aug of available) {
        const isPriority = priority.some(p => p.name === aug.name);
        const marker = isPriority ? "[P]" : "";
        ns.tprint(`${marker} ${aug.name} (${aug.faction}): ${formatMoney(aug.price)}`);
    }
    
    ns.tprint("");
}

/**
 * Check if we should install augmentations
 * @param {NS} ns
 * @returns {boolean}
 */
export function shouldInstallAugments(ns) {
    if (!hasSingularityAccess(ns)) return false;
    
    const owned = ns.singularity.getOwnedAugmentations(false);
    const installed = ns.singularity.getOwnedAugmentations(true);
    
    // If we have more owned than installed, we have queued augments
    return owned.length > installed.length;
}

/**
 * Install augmentations and reset
 * @param {NS} ns
 */
export function installAugmentations(ns) {
    if (!hasSingularityAccess(ns)) return;
    
    if (shouldInstallAugments(ns)) {
        const queued = ns.singularity.getOwnedAugmentations(false).length - 
                      ns.singularity.getOwnedAugmentations(true).length;

        ns.singularity.installAugmentations("/angel/angel.js");
    }
}
