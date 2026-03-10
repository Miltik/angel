import { config, PORTS } from "/angel/config.js";
import { formatMoney } from "/angel/utils.js";
import { createWindow } from "/angel/modules/uiManager.js";
import { scanAllAugments, decodeScanResults } from "/angel/modules/augment-scanner.js";

// State tracking
let lastState = {
    lastMode: null,
    lastPurchaseTime: 0,
    totalPurchased: 0,
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("augments-worker", "💰 Augments Purchasing", 700, 400, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("💰 Augmentation purchasing worker initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    
    // Check if we have SF4 (Singularity access)
    if (!hasSingularityAccess(ns)) {
        ui.log("⚠️  Singularity access not available (need SF4) - worker idle", "warn");
        while (true) {
            await ns.sleep(60000);
        }
    }
    
    ui.log("✅ Singularity access confirmed - monitoring mode port", "success");
    
    while (true) {
        try {
            const mode = readAugmentMode(ns);
            
            // Log mode changes
            if (mode !== lastState.lastMode) {
                ui.log(`📡 Mode changed: ${lastState.lastMode || 'none'} → ${mode}`, "info");
                lastState.lastMode = mode;
            }
            
            // Execute based on mode
            switch (mode) {
                case "buy_all":
                    await executeBuyAll(ns, ui);
                    break;
                case "buy_priority":
                    await executeBuyPriority(ns, ui);
                    break;
                case "buy_boost":
                    await executeBuyBoost(ns, ui);
                    break;
                case "idle":
                default:
                    // Idle - do nothing
                    break;
            }
        } catch (e) {
            ui.log(`❌ Worker error: ${e}`, "error");
        }
        await ns.sleep(10000); // Check every 10 seconds
    }
}

/**
 * Read augment mode from coordinator
 * @param {NS} ns
 * @returns {string}
 */
function readAugmentMode(ns) {
    const modeData = ns.peek(PORTS.AUGMENT_MODE);
    if (modeData === "NULL PORT DATA") return "idle";
    return modeData || "idle";
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
 * Get scan results from port or do fresh scan
 * @param {NS} ns
 * @returns {Object}
 */
function getScanResults(ns) {
    try {
        const portData = ns.peek(PORTS.AUGMENTS_DATA);
        if (portData !== "NULL PORT DATA") {
            return decodeScanResults(portData);
        }
    } catch (e) {
        // Fall back to fresh scan
    }
    return scanAllAugments(ns);
}

/**
 * Execute BUY ALL mode - purchase all available augmentations
 * @param {NS} ns
 * @param {object} ui
 */
async function executeBuyAll(ns, ui) {
    const scanResults = getScanResults(ns);
    const available = scanResults?.available || [];
    let money = ns.getServerMoneyAvailable("home");
    let purchased = 0;
    
    // Filter out Neuroflux Governor unless it's the only aug available
    const nonNFG = available.filter(aug => aug.name !== "Neuroflux Governor");
    const augsToBuy = nonNFG.length > 0 ? nonNFG : available;
    
    // If only Neuroflux Governor available, show warning
    const nfgOnly = augsToBuy.length === 0 && available.length > 0;
    if (nfgOnly) {
        // Check queue threshold
        const installedCount = ns.singularity.getOwnedAugmentations(true).length;
        const queuedCount = ns.singularity.getOwnedAugmentations(false).length - installedCount;
        if (queuedCount < 15) {
            const needed = 15 - queuedCount;
            ui.log(`🔒 NFG GUARD: Holding purchases - need ${needed} more queued (${queuedCount}/15)`, "info");
            return;
        } else {
            ui.log(`✅ NFG THRESHOLD REACHED: Purchasing NFG (${queuedCount} queued)`, "success");
        }
    }
    
    for (const aug of augsToBuy) {
        if (money >= aug.price) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            if (success) {
                ui.log(`✅ Purchased ${aug.name} (${aug.faction}) for ${formatMoney(aug.price)}`, "success");
                money = ns.getServerMoneyAvailable("home");
                purchased++;
                lastState.totalPurchased++;
                lastState.lastPurchaseTime = Date.now();
            }
        }
    }
    
    if (purchased > 0) {
        ui.log(`🎉 Batch purchased ${purchased} augmentations (total: ${lastState.totalPurchased})`, "success");
    }
}

/**
 * Execute BUY PRIORITY mode - purchase priority augmentations only
 * @param {NS} ns
 * @param {object} ui
 */
async function executeBuyPriority(ns, ui) {
    const scanResults = getScanResults(ns);
    const priority = scanResults?.priority || [];
    let money = ns.getServerMoneyAvailable("home");
    let purchased = 0;
    
    // Debug logging
    if (priority.length === 0) {
        ui.log(`⚠️  No priority augments found in scan results`, "warn");
        return;
    }
    
    // Get phase info for spending limits
    const maxSpend = getPhaseMaxSpend(ns);
    const reserveMoney = config.augmentations.queueReserveMoney ?? 0;
    const spendBudget = Math.max(0, Math.min(maxSpend, money - reserveMoney));
    let spent = 0;
    
    ui.log(`💰 Budget: ${formatMoney(spendBudget)} | Priority augs: ${priority.length}`, "info");
    
    // Filter out NFG unless no other augs available
    const nonNFG = priority.filter(aug => aug.name !== "Neuroflux Governor");
    const priorityToBuy = nonNFG.length > 0 ? nonNFG : priority;
    
    for (const aug of priorityToBuy) {
        if (money >= aug.price && spent + aug.price <= spendBudget) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            if (success) {
                ui.log(`✅ Priority: ${aug.name} for ${formatMoney(aug.price)}`, "success");
                money = ns.getServerMoneyAvailable("home");
                purchased++;
                spent += aug.price;
                lastState.totalPurchased++;
                lastState.lastPurchaseTime = Date.now();
            } else {
                ui.log(`❌ Failed to purchase ${aug.name} from ${aug.faction}`, "error");
            }
        } else if (money < aug.price) {
            ui.log(`💸 Not enough money for ${aug.name}: need ${formatMoney(aug.price)}, have ${formatMoney(money)}`, "info");
        } else if (spent + aug.price > spendBudget) {
            ui.log(`🛑 Budget exceeded for ${aug.name}: would spend ${formatMoney(spent + aug.price)}, budget ${formatMoney(spendBudget)}`, "info");
        }
    }
    
    if (purchased > 0) {
        ui.log(`🎉 Purchased ${purchased} priority augmentations (total: ${lastState.totalPurchased})`, "success");
    } else {
        ui.log(`⏸️  No purchases made this cycle`, "info");
    }
}

/**
 * Execute BUY BOOST mode - purchase cheapest augmentations to boost queue
 * @param {NS} ns
 * @param {object} ui
 */
async function executeBuyBoost(ns, ui) {
    const scanResults = getScanResults(ns);
    const available = (scanResults?.available || []).slice(); // Clone array
    let money = ns.getServerMoneyAvailable("home");
    let purchased = 0;
    
    // Get phase info for spending limits
    const maxSpend = getPhaseMaxSpend(ns);
    const reserveMoney = config.augmentations.queueReserveMoney ?? 0;
    const multiplier = config.augmentations.aggressiveQueueSpendMultiplier ?? 1.5;
    const maxBoostSpend = Math.max(0, maxSpend * multiplier);
    const spendBudget = Math.max(0, Math.min(maxBoostSpend, money - reserveMoney));
    let spent = 0;
    
    // Filter out NFG unless no other augs available
    const nonNFG = available.filter(aug => aug.name !== "Neuroflux Governor");
    const nfgOnly = nonNFG.length === 0 && available.length > 0;
    
    // If only NFG available, check threshold
    if (nfgOnly) {
        const installedCount = ns.singularity.getOwnedAugmentations(true).length;
        const queuedCount = ns.singularity.getOwnedAugmentations(false).length - installedCount;
        if (queuedCount < 15) {
            const needed = 15 - queuedCount;
            ui.log(`🔒 NFG GUARD: Holding boost - need ${needed} more queued (${queuedCount}/15)`, "info");
            return;
        } else {
            ui.log(`✅ NFG THRESHOLD REACHED: Boosting with NFG (${queuedCount} queued)`, "success");
        }
    }
    
    const candidates = (nonNFG.length > 0 ? nonNFG : available).sort((a, b) => a.price - b.price);
    
    for (const aug of candidates) {
        if (money >= aug.price && spent + aug.price <= spendBudget) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            if (success) {
                ui.log(`✅ Queue boost: ${aug.name} for ${formatMoney(aug.price)}`, "success");
                money = ns.getServerMoneyAvailable("home");
                purchased++;
                spent += aug.price;
                lastState.totalPurchased++;
                lastState.lastPurchaseTime = Date.now();
            }
        }
    }
    
    if (purchased > 0) {
        ui.log(`🎉 Queue boosted ${purchased} augmentations (total: ${lastState.totalPurchased})`, "success");
    }
}

/**
 * Get phase-appropriate max spending limit
 * @param {NS} ns
 * @returns {number}
 */
function getPhaseMaxSpend(ns) {
    // Simple heuristic based on current money
    const money = ns.getServerMoneyAvailable("home");
    if (money < 10000000) return 1000000;
    if (money < 100000000) return 50000000;
    if (money < 500000000) return 200000000;
    if (money < 1000000000) return 500000000;
    return 1000000000;
}

/**
 * Purchase all affordable augmentations (exported for external use)
 * @param {NS} ns
 * @returns {number} - Number of augments purchased
 */
export function buyAllAffordable(ns) {
    if (!hasSingularityAccess(ns)) return 0;
    
    const scanResults = scanAllAugments(ns);
    const available = scanResults?.available || [];
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
    
    const scanResults = scanAllAugments(ns);
    const priority = scanResults?.priority || [];
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
    
    const scanResults = scanAllAugments(ns);
    const available = scanResults?.available || [];
    const priority = scanResults?.priority || [];
    
    ns.tprint("\n╔════════════════════════════════════════╗");
    ns.tprint("║     AUGMENTATION STATUS                ║");
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
