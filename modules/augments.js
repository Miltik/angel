import { config, PORTS } from "/angel/config.js";
import { formatMoney } from "/angel/utils.js";
import { createWindow } from "/angel/modules/uiManager.js";
import { PHASE_PORT, TELEMETRY_PORT, DAEMON_LOCK_PORT } from "/angel/ports.js";
import { 
    shouldInstallAugments as shouldInstallAugmentsFromReset, 
    installAugmentations as installAugmentationsFromReset, 
    getQueuedAugmentInfo,
    getInstalledAugmentInfo,
    detectReset 
} from "/angel/modules/reset.js";
import { scanAllAugments, encodeScanResults, decodeScanResults } from "/angel/modules/augment-scanner.js";

// State tracking
let lastState = {
    phase: null,
    availableCount: 0,
    queuedCount: 0,
    loopCount: 0,
    lastPurchaseLoop: -10,
    lastInstalledCount: 0,
    lastScanResults: null,  // Cache latest scan results
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
 * Get available augmentations - now uses cached scan results
 * @param {Object} scanResults - Cached results from augment-scanner
 * @returns {Array}
 */
function getAvailableAugmentsInline(scanResults) {
    return scanResults?.available || [];
}

/**
 * Get priority augmentations - now uses cached scan results
 * Uses augmentPriority list from config
 * @param {Object} scanResults - Cached results from augment-scanner
 * @returns {Array}
 */
function getPriorityAugmentsInline(scanResults) {
    return scanResults?.priority || [];
}

/**
 * Get smartest target augmentation - now uses cached scan results
 * Picks augmentation closest to being available (lowest combined gap score)
 * @param {Object} scanResults - Cached results from augment-scanner
 * @returns {Object | null}
 */
function selectSmartestTargetAug(scanResults) {
    return scanResults?.smartTarget || null;
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
        
        // Centralized scan - replaces two nested loop scans with one pass
        const scanResults = scanAllAugments(ns);
        lastState.lastScanResults = scanResults;
        
        // Broadcast scan results to port for other modules
        try {
            ns.clearPort(PORTS.AUGMENTS_DATA);
            ns.writePort(PORTS.AUGMENTS_DATA, encodeScanResults(scanResults));
        } catch (e) {
            // Ignore port write failures
        }
        
        const available = getAvailableAugmentsInline(scanResults);
        
        // Get queue status
        const ownedCount = ns.singularity.getOwnedAugmentations(false).length;
        const installedCount = ns.singularity.getOwnedAugmentations(true).length;
        const queuedCount = ownedCount - installedCount;
        const queueBoostTarget = config.augmentations.aggressiveQueueTarget ?? 3;
        
        // Get smart target for display
        let smartTarget = selectSmartestTargetAug(scanResults);
        
        // Fallback if smart target calculation somehow failed (shouldn't happen with scanner)
        if (!smartTarget && available.length > 0) {
            const fallback = available[0];
            smartTarget = {
                name: fallback.name,
                faction: fallback.faction,
                price: fallback.price,
                repReq: fallback.repReq,
                moneyShort: Math.max(0, fallback.price - money),
                repShort: 0
            };
        }
        
        lastState.loopCount++;
        
        // Log status only on changes or every 5 loops (5 minutes)
        const statusChanged = phase !== lastState.phase || 
                             available.length !== lastState.availableCount ||
                             queuedCount !== lastState.queuedCount;
        
        if (statusChanged || lastState.loopCount % 5 === 0) {
            ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
            ui.log(`🧬 Phase ${phase} | 💰 ${formatMoney(money)} | 📋 Strategy: ${strategy.strategy}`, "info");
            ui.log(`📦 Available: ${available.length} | 🎯 Queued: ${queuedCount}`, "info");
            
            // Show smart target with gap analysis
            if (smartTarget) {
                try {
                    const moneyPercent = Math.min(100, (money / smartTarget.price) * 100);
                    const factionRep = ns.singularity.getFactionRep(smartTarget.faction);
                    const repPercent = Math.min(100, (factionRep / smartTarget.repReq) * 100);
                    const moneyBar = `${'█'.repeat(Math.floor(moneyPercent / 10))}${'░'.repeat(10 - Math.floor(moneyPercent / 10))}`;
                    const repBar = `${'█'.repeat(Math.floor(repPercent / 10))}${'░'.repeat(10 - Math.floor(repPercent / 10))}`;
                    
                    const moneyShort = Math.max(0, smartTarget.price - money);
                    const repShort = Math.max(0, smartTarget.repReq - factionRep);
                    const moneyShortLabel = moneyShort > 0 ? `(+${formatMoney(moneyShort)})` : "(ready)";
                    const repShortLabel = repShort > 0 ? `(+${(repShort / 1000).toFixed(0)}k rep)` : "(ready)";
                    
                    ui.log(`🎯 TARGET: ${smartTarget.name} (${smartTarget.faction})`, "info");
                    ui.log(`   💰 Money: [${moneyBar}] ${moneyPercent.toFixed(1)}% ${moneyShortLabel}`, "info");
                    ui.log(`   ⭐ Rep:   [${repBar}] ${repPercent.toFixed(1)}% ${repShortLabel}`, "info");
                } catch (e) {
                    // Silently skip display if calculation fails
                }
            }
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
        const priority = getPriorityAugmentsInline(scanResults);
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
        ui.log(`🔒 NEUROFLUX GUARD: No other augments available`, "warn");
        ui.log(`⚠️  Will only buy NFG if queue reaches 15 (acts as filler when all else bought)`, "warn");
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
        const installedCount = ns.singularity.getOwnedAugmentations(true).length;
        const queuedCount = ns.singularity.getOwnedAugmentations(false).length - installedCount;
        if (queuedCount < 15) {
            const needed = 15 - queuedCount;
            ui.log(`🔒 NEUROFLUX GUARD: Holding NFG purchases - need ${needed} more augs queued (${queuedCount}/15)`, "info");
            return 0; // Don't buy NFG until threshold is reached
        } else {
            ui.log(`✅ NFG THRESHOLD REACHED: Unlocking Neuroflux Governor purchases (${queuedCount} queued)`, "success");
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
    
    const scanResults = scanAllAugments(ns);
    const available = getAvailableAugmentsInline(scanResults);
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
    const priority = getPriorityAugmentsInline(scanResults);
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
    const available = getAvailableAugmentsInline(scanResults);
    const priority = getPriorityAugmentsInline(scanResults);
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

// Re-export reset functions for backward compatibility
// Legacy-compatible explicit exports (avoid re-export syntax for Netscript parser compatibility)
export function shouldInstallAugments(ns, queuedCount = 0, queuedCost = 0, minQueuedAugs = 5) {
    return shouldInstallAugmentsFromReset(ns, queuedCount, queuedCost, minQueuedAugs);
}

export function installAugmentations(ns) {
    return installAugmentationsFromReset(ns);
}

// Note: Full reset decision logic available in /angel/modules/reset.js

function reportAugmentsTelemetry(ns) {
    try {
        const now = Date.now();
        let resetMetadata = null;
        
        // Get reset countdown data with specific target augmentation
        const phase = readGamePhase(ns);
        const strategy = getAugmentStrategy(phase);
        const currentMoney = ns.getServerMoneyAvailable("home");
        
        // Use cached scan results or do a fresh scan if needed
        let targetAug = null;
        let targetAugCost = strategy.maxSpend;
        
        if (hasSingularityAccess(ns)) {
            // Use cached smart target if available and fresh
            const scanResults = lastState.lastScanResults;
            if (scanResults && scanResults.smartTarget) {
                targetAug = scanResults.smartTarget;
                targetAugCost = targetAug.price;
            }
        }

        let ownedCount = 0;
        let installedCount = 0;
        
        if (hasSingularityAccess(ns)) {
            // Use reset module for installed info
            const installedInfo = getInstalledAugmentInfo(ns);
            installedCount = installedInfo.count;
            
            // Get queued info
            const queuedInfo = getQueuedAugmentInfo(ns);
            ownedCount = installedCount + queuedInfo.count;
            
            // Detect reset using reset module
            if (detectReset(installedCount, lastState.lastInstalledCount)) {
                resetMetadata = {
                    detectedAtResetTime: now,
                    totalAugmentsCost: installedInfo.totalCost,
                    totalAugmentsReputation: installedInfo.totalRep,
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
            targetAugFaction: targetAug?.faction || "Unknown",
            targetAugCost: targetAugCost,
            moneyNeeded: Math.max(0, targetAugCost - currentMoney),
            repNeeded: targetAug?.repShort || 0,
            progressPercent: Math.min(100, (currentMoney / targetAugCost) * 100),
            repPercent: targetAug?.repReq ? Math.min(100, (ns.singularity.getFactionRep(targetAug.faction) / targetAug.repReq) * 100) : 0
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