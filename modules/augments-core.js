import { config, PORTS } from "/angel/config.js";
import { formatMoney } from "/angel/utils.js";
import { createWindow } from "/angel/modules/uiManager.js";
import { PHASE_PORT, TELEMETRY_PORT } from "/angel/ports.js";
import { 
    shouldInstallAugments as shouldInstallAugmentsFromReset, 
    getQueuedAugmentInfo,
    getInstalledAugmentInfo,
    detectReset 
} from "/angel/modules/reset.js";
import { scanAllAugments, encodeScanResults } from "/angel/modules/augment-scanner.js";

// State tracking
let lastState = {
    phase: null,
    availableCount: 0,
    queuedCount: 0,
    loopCount: 0,
    lastPurchaseLoop: -10,
    lastInstalledCount: 0,
    lastScanResults: null,
};

let telemetryState = {
    lastReportTime: 0,
    lastResetReportTime: 0
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("augments-core", "🧬 Augmentations Coordinator", 700, 500, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("🧬 Augmentation coordinator initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    
    // Check if we have SF4 (Singularity access)
    if (!hasSingularityAccess(ns)) {
        ui.log("⚠️  Singularity access not available (need SF4) - waiting...", "warn");
        setAugmentMode(ns, "idle");
        while (true) {
            await ns.sleep(60000);
        }
    }
    
    ui.log("✅ Singularity access confirmed", "success");
    ui.log("💡 NFG guard rails active: Only buy if no augs available (threshold: 15 for NFG-only)", "info");
    
    while (true) {
        try {
            await augmentCoordinatorLoop(ns, ui);
        } catch (e) {
            ui.log(`❌ Coordinator error: ${e}`, "error");
            setAugmentMode(ns, "idle");
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
 * Set augment mode for worker to execute
 * @param {NS} ns
 * @param {string} mode - "buy_all", "buy_priority", "buy_boost", or "idle"
 */
function setAugmentMode(ns, mode) {
    try {
        ns.clearPort(PORTS.AUGMENT_MODE);
        ns.writePort(PORTS.AUGMENT_MODE, mode);
    } catch (e) {
        ns.print(`❌ Failed to write augment mode: ${e}`);
    }
}

/**
 * Get available augmentations from scan results
 * @param {Object} scanResults
 * @returns {Array}
 */
function getAvailableAugments(scanResults) {
    return scanResults?.available || [];
}

/**
 * Get priority augmentations from scan results
 * @param {Object} scanResults
 * @returns {Array}
 */
function getPriorityAugments(scanResults) {
    return scanResults?.priority || [];
}

/**
 * Get smartest target augmentation from scan results
 * @param {Object} scanResults
 * @returns {Object | null}
 */
function getSmartTarget(scanResults) {
    return scanResults?.smartTarget || null;
}

/**
 * Main augmentation coordinator loop - decides what to do
 * @param {NS} ns
 * @param {object} ui - UI window API
 */
async function augmentCoordinatorLoop(ns, ui) {
    try {
        const phase = readGamePhase(ns);
        const strategy = getAugmentStrategy(phase);
        const money = ns.getServerMoneyAvailable("home");
        
        // Centralized scan - provides data for all purchasing decisions
        const scanResults = scanAllAugments(ns);
        lastState.lastScanResults = scanResults;
        
        // Broadcast scan results to port for other modules
        try {
            ns.clearPort(PORTS.AUGMENTS_DATA);
            ns.writePort(PORTS.AUGMENTS_DATA, encodeScanResults(scanResults));
        } catch (e) {
            // Ignore port write failures
        }
        
        const available = getAvailableAugments(scanResults);
        const priority = getPriorityAugments(scanResults);
        
        // Get queue status using reset module helpers
        const installedInfo = getInstalledAugmentInfo(ns);
        const queuedInfo = getQueuedAugmentInfo(ns);
        const installedCount = installedInfo.count;
        const queuedCount = queuedInfo.count;
        const queueBoostTarget = config.augmentations.aggressiveQueueTarget ?? 3;
        
        // Get smart target for display
        let smartTarget = getSmartTarget(scanResults);
        
        // Fallback if smart target calculation failed
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
        
        // Decide mode for worker
        let mode = "idle";
        
        if (available.length === 0) {
            if (statusChanged || lastState.loopCount % 10 === 0) {
                ui.log(`⏰ No augmentations available yet - waiting for faction rep`, "info");
            }
            mode = "idle";
        } else if (strategy.buyAll) {
            // Strategy: buyAll (phases 3-4)
            mode = "buy_all";
            ui.log(`💰 Mode: BUY ALL (${available.length} available)`, "info");
        } else if (priority.length > 0) {
            // Strategy: Priority focus (phases 0-2)
            mode = "buy_priority";
            ui.log(`🎯 Mode: BUY PRIORITY (${priority.length} priority augs)`, "info");
        } else if (queuedCount < queueBoostTarget) {
            // Queue boost mode
            mode = "buy_boost";
            ui.log(`⚡ Mode: QUEUE BOOST (${queuedCount}/${queueBoostTarget})`, "info");
        } else {
            mode = "idle";
            if (available.length > 0 && money < available[0].price) {
                const nextAug = available[0];
                const needed = nextAug.price - money;
                ui.log(`Next: ${nextAug.name} - Need ${formatMoney(needed)} more`, "info");
            }
        }
        
        // Write mode to port for worker
        setAugmentMode(ns, mode);
        
    } finally {
        reportAugmentsTelemetry(ns);
    }
}

function reportAugmentsTelemetry(ns) {
    try {
        const now = Date.now();
        let resetMetadata = null;
        
        // Get reset countdown data with specific target augmentation
        const phase = readGamePhase(ns);
        const strategy = getAugmentStrategy(phase);
        const currentMoney = ns.getServerMoneyAvailable("home");
        
        // Use cached scan results
        let targetAug = null;
        let targetAugCost = strategy.maxSpend;
        
        if (hasSingularityAccess(ns)) {
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

// Re-export reset functions for backward compatibility
export function shouldInstallAugments(ns, queuedCount = 0, queuedCost = 0, minQueuedAugs = 5) {
    return shouldInstallAugmentsFromReset(ns, queuedCount, queuedCost, minQueuedAugs);
}
