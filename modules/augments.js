import { config } from "/angel/config.js";
import { formatMoney } from "/angel/utils.js";
import { createWindow } from "/angel/modules/uiManager.js";

const PHASE_PORT = 7;
const TELEMETRY_PORT = 20;

// State tracking
let lastState = {
    phase: null,
    availableCount: 0,
    queuedCount: 0,
    loopCount: 0,
    lastPurchaseLoop: -10,
    lastInstalledCount: 0
};

let telemetryState = {
    lastReportTime: 0,
    lastResetReportTime: 0
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("augments", "🧬 Augmentations", 700, 500, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("🧬 Augmentation automation initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    
    // Check if we have SF4 (Singularity access)
    if (!hasSingularityAccess(ns)) {
        ui.log("⚠️  Singularity access not available (need SF4) - waiting...", "warn");
        while (true) {
            await ns.sleep(60000);
        }
    }
    
    ui.log("✅ Singularity access confirmed", "success");
    ui.log("💡 NFG guard rails active: Only buy if no augs available (threshold: 15 for NFG-only)", "info");
    
    while (true) {
        try {
            await augmentLoop(ns, ui);
        } catch (e) {
            ui.log(`❌ Augmentation error: ${e}`, "error");
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
 * Intelligent target selection - picks augmentation closest to being available
 * Considers both money and reputation gaps, normalizes them, and picks the lowest total gap
 * @param {NS} ns
 * @param {Array} priorityList - Priority augmentations to consider (or empty to consider all)
 * @returns {{name: string, faction: string, price: number, repReq: number, gapScore: number} | null}
 */
function selectSmartestTargetAug(ns, priorityList = []) {
    if (!hasSingularityAccess(ns)) return null;
    
    const player = ns.getPlayer();
    const currentMoney = ns.getServerMoneyAvailable("home");
    const owned = ns.singularity.getOwnedAugmentations(true);
    const candidates = [];

    // Gather ALL not-yet-owned augmentations
    for (const faction of player.factions) {
        const augments = ns.singularity.getAugmentationsFromFaction(faction);
        const factionRep = ns.singularity.getFactionRep(faction);

        for (const aug of augments) {
            if (owned.includes(aug)) continue;

            const repReq = ns.singularity.getAugmentationRepReq(aug);
            const price = ns.singularity.getAugmentationPrice(aug);

            // Filter by priority if priority list provided
            if (priorityList.length > 0 && !priorityList.includes(aug)) continue;

            // Calculate gaps (0 if already met, otherwise how much short)
            const moneyGap = Math.max(0, price - currentMoney);
            const repGap = Math.max(0, repReq - factionRep);

            // Normalize gaps using a logarithmic scale to balance money/rep importance
            const moneyGapScore = moneyGap > 0 ? Math.log10(moneyGap + 1) : 0;
            const repGapScore = repGap > 0 ? Math.log10(repGap + 1) : 0;

            // Composite gap score: lower is better (closer to available)
            const gapScore = moneyGapScore + repGapScore;

            candidates.push({
                name: aug,
                faction,
                price,
                repReq,
                moneyShort: moneyGap,
                repShort: repGap,
                gapScore
            });
        }
    }

    if (candidates.length === 0) return null;

    // Sort by gap score (ascending) and return the closest
    candidates.sort((a, b) => a.gapScore - b.gapScore);
    return candidates[0];
}

/**
 * Main augmentation loop - phase-aware cascading
 * @param {NS} ns
 * @param {object} ui - UI window API
 */
async function augmentLoop(ns, ui) {
    try {
        const phase = readGamePhase(ns);
        const strategy = getAugmentStrategy(phase);
        const money = ns.getServerMoneyAvailable("home");
        const available = getAvailableAugmentsInline(ns);
        
        // Get queue status
        const ownedCount = ns.singularity.getOwnedAugmentations(false).length;
        const installedCount = ns.singularity.getOwnedAugmentations(true).length;
        const queuedCount = ownedCount - installedCount;
        const queueBoostTarget = config.augmentations.aggressiveQueueTarget ?? 3;
        
        lastState.loopCount++;
        
        // Log status only on changes or every 5 loops (5 minutes)
        const statusChanged = phase !== lastState.phase || 
                             available.length !== lastState.availableCount ||
                             queuedCount !== lastState.queuedCount;
        
        if (statusChanged || lastState.loopCount % 5 === 0) {
            ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
            ui.log(`🧬 Phase ${phase} | 💰 ${formatMoney(money)} | 📋 Strategy: ${strategy.strategy}`, "info");
            ui.log(`📦 Available: ${available.length} | 🎯 Queued: ${queuedCount}`, "info");
        }
        
        lastState.phase = phase;
        lastState.availableCount = available.length;
        lastState.queuedCount = queuedCount;
        
        if (available.length === 0) {
            if (statusChanged || lastState.loopCount % 10 === 0) {
                ui.log(`⏰ No augmentations available yet - waiting for faction rep`, "info");
            }
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
            const purchasedPriority = await buyPriorityAugments(ns, priority, money, strategy, ui);
            if (purchasedPriority > 0) {
                return;
            }
        }

        // Queue boost mode: if queue is low, buy cheapest available to keep reset pipeline moving
        if (queuedCount < queueBoostTarget) {
            const boosted = await buyQueueBoostAugments(ns, available, money, strategy, ui);
            if (boosted > 0) {
                ui.log(`⚡ Queue boost active (${queuedCount}/${queueBoostTarget}) - purchased ${boosted}`, "success");
                return;
            }
        }
        
        // Fallback: Show next affordable aug
        if (available.length > 0 && money < available[0].price) {
            const nextAug = available[0];
            const needed = nextAug.price - money;
            ui.log(`Next: ${nextAug.name} - Need ${formatMoney(needed)} more`, "info");
        }
    } finally {
        reportAugmentsTelemetry(ns);
    }
}

/**
 * Buy all available augmentations
 * Guard rails: Skip Neuroflux Governor unless no other augs available
 * @param {NS} ns
 * @param {Array} available
 * @param {number} initialMoney
 * @param {object} ui - UI window API
 */
async function buyAllAvailable(ns, available, initialMoney, ui) {
    let money = initialMoney;
    let purchased = 0;
    
    // Filter out Neuroflux Governor unless it's the only aug available
    const nonNFG = available.filter(aug => aug.name !== "Neuroflux Governor");
    const augsToBuy = nonNFG.length > 0 ? nonNFG : available;
    
    // If only Neuroflux Governor available, raise threshold for buying
    const nfgOnly = augsToBuy.length === 0 && available.length > 0;
    if (nfgOnly) {
        ui.log(`⚠️  Only Neuroflux Governor available - raising NFG threshold to 15 queued`, "warn");
    }
    
    for (const aug of augsToBuy) {
        if (money >= aug.price) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            if (success) {
                ui.log(`✅ Purchased ${aug.name} (${aug.faction}) for ${formatMoney(aug.price)}`, "success");
                money = ns.getServerMoneyAvailable("home");
                purchased++;
                lastState.lastPurchaseLoop = lastState.loopCount;
            }
        }
    }
    
    if (purchased > 0) {
        ui.log(`🎉 Batch purchased ${purchased} augmentations`, "success");
    } else if (lastState.loopCount - lastState.lastPurchaseLoop > 5) {
        // No purchases in last 5 minutes, show next target
        const affordable = augsToBuy.filter(a => money >= a.price);
        if (affordable.length === 0 && augsToBuy.length > 0) {
            const nextAug = augsToBuy[0];
            const needed = nextAug.price - money;
            ui.log(`🎯 Next: ${nextAug.name} - Need ${formatMoney(needed)} more`, "info");
        }
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
    const reserveMoney = config.augmentations.queueReserveMoney ?? 0;
    const spendBudget = Math.max(0, Math.min(strategy.maxSpend, initialMoney - reserveMoney));
    let spent = 0;
    
    // Filter out NFG unless no other augs available
    const nonNFG = priority.filter(aug => aug.name !== "Neuroflux Governor");
    const priorityToBuy = nonNFG.length > 0 ? nonNFG : priority;
    
    for (const aug of priorityToBuy) {
        if (money >= aug.price && spent + aug.price <= spendBudget) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            if (success) {
                ui.log(`✅ Priority purchased: ${aug.name} for ${formatMoney(aug.price)}`, "success");
                money = ns.getServerMoneyAvailable("home");
                purchased++;
                spent += aug.price;
                lastState.lastPurchaseLoop = lastState.loopCount;
            }
        }
    }
    
    if (purchased > 0) {
        ui.log(`🎉 Batch purchased ${purchased} priority augmentations`, "success");
    } else if (lastState.loopCount - lastState.lastPurchaseLoop > 5) {
        // No purchases in last 5 minutes, show next target
        if (priority.length > 0 && money < priority[0].price) {
            const nextAug = priority[0];
            const needed = nextAug.price - money;
            ui.log(`🎯 Next priority: ${nextAug.name} - Need ${formatMoney(needed)} more`, "info");
        }
    }

    return purchased;
}

async function buyQueueBoostAugments(ns, available, initialMoney, strategy, ui) {
    let money = initialMoney;
    let purchased = 0;

    const reserveMoney = config.augmentations.queueReserveMoney ?? 0;
    const multiplier = config.augmentations.aggressiveQueueSpendMultiplier ?? 1.5;
    const maxBoostSpend = Math.max(0, strategy.maxSpend * multiplier);
    const spendBudget = Math.max(0, Math.min(maxBoostSpend, initialMoney - reserveMoney));
    let spent = 0;

    // Filter out NFG unless no other augs available
    const nonNFG = available.filter(aug => aug.name !== "Neuroflux Governor");
    const nfgOnly = nonNFG.length === 0 && available.length > 0;
    
    // If only NFG available, show warning message at higher threshold
    if (nfgOnly) {
        const queuedCount = ns.singularity.getOwnedAugmentations(true).length - ns.singularity.getOwnedAugmentations(false).length;
        if (queuedCount < 15) {
            ui.log(`⚠️  Only NFG available - waiting for queue to reach 15 augs (currently ${queuedCount})`, "warn");
            return 0; // Don't buy NFG until threshold is reached
        } else {
            ui.log(`💡 NFG threshold reached (15) - will now purchase Neuroflux Governors`, "info");
        }
    }
    
    const candidates = (nonNFG.length > 0 ? nonNFG : available).sort((a, b) => a.price - b.price);
    
    for (const aug of candidates) {
        if (money >= aug.price && spent + aug.price <= spendBudget) {
            const success = ns.singularity.purchaseAugmentation(aug.faction, aug.name);
            if (success) {
                ui.log(`✅ Queue boost purchased: ${aug.name} for ${formatMoney(aug.price)}`, "success");
                money = ns.getServerMoneyAvailable("home");
                purchased++;
                spent += aug.price;
                lastState.lastPurchaseLoop = lastState.loopCount;
            }
        }
    }

    return purchased;
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

        // Always restart with angel-lite.js for seamless post-reset continuity
        // Angel-lite will auto-transition to full Angel if RAM >= 64GB
        ns.singularity.installAugmentations("/angel/angel-lite.js");
    }
}
function reportAugmentsTelemetry(ns) {
    try {
        const now = Date.now();
        let ownedCount = 0;
        let installedCount = 0;
        let resetMetadata = null;
        
        // Get reset countdown data with specific target augmentation
        const phase = readGamePhase(ns);
        const strategy = getAugmentStrategy(phase);
        const currentMoney = ns.getServerMoneyAvailable("home");
        
        // Find the next target augmentation to track - use smart targeting
        let targetAug = null;
        let targetAugCost = strategy.maxSpend;
        
        if (hasSingularityAccess(ns)) {
            // Get priority list from config
            const priorityList = config.augmentations.augmentPriority || [];
            
            // Use smart targeting: picks aug closest to being available (lowest gap)
            const smartTarget = selectSmartestTargetAug(ns, priorityList);
            if (smartTarget) {
                targetAug = smartTarget;
                targetAugCost = targetAug.price;
            }
        }

        if (hasSingularityAccess(ns)) {
            const installedAugs = ns.singularity.getOwnedAugmentations(true);
            installedCount = installedAugs.length;
            ownedCount = ns.singularity.getOwnedAugmentations(false).length;
            
            // Detect reset: installed count dropped significantly (more than 2 augs)
            if (installedCount < lastState.lastInstalledCount - 2) {
                // Reset detected - calculate cost and rep for ALL installed augs
                let totalCost = 0;
                let totalRep = 0;
                
                for (const augName of installedAugs) {
                    try {
                        const stats = ns.singularity.getAugmentationStats(augName);
                        totalCost += stats.cost || 0;
                        totalRep += stats.repCost || 0;
                    } catch (e) {
                        // Skip if we can't get stats
                    }
                }
                
                resetMetadata = {
                    detectedAtResetTime: now,
                    totalAugmentsCost: totalCost,
                    totalAugmentsReputation: totalRep,
                    augmentsInstalledCount: installedCount
                };
            }
            
            lastState.lastInstalledCount = installedCount;
        }
        
        // Reset countdown data with specific augmentation target
        const resetCountdown = {
            phase: phase,
            currentMoney: currentMoney,
            targetAugName: targetAug?.name || "Unknown",
            targetAugCost: targetAugCost,
            moneyNeeded: Math.max(0, targetAugCost - currentMoney),
            progressPercent: Math.min(100, (currentMoney / targetAugCost) * 100)
        };
        
        const metricsPayload = {
            installed: installedCount,
            queued: ownedCount - installedCount,
            available: lastState.availableCount,
            loopCount: lastState.loopCount,
            ...(resetMetadata && { resetMetadata }),
            resetCountdown: resetCountdown
        };
        
        writeAugmentsMetrics(ns, metricsPayload);
        telemetryState.lastReportTime = now;
    } catch (e) {
        ns.print(`❌ Augments telemetry error: ${e}`);
    }
}

function writeAugmentsMetrics(ns, metricsPayload) {
    try {
        const payload = JSON.stringify({
            module: 'augments',
            timestamp: Date.now(),
            metrics: metricsPayload,
        });
        ns.tryWritePort(TELEMETRY_PORT, payload);
    } catch (e) {
        ns.print(`❌ Failed to write augments metrics: ${e}`);
    }
}