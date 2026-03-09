/**
 * Reset Module - Augmentation installation and reset decision logic
 * Handles when to reset and post-reset continuity
 * 
 * Features:
 * - Reset readiness detection
 * - Augmentation installation
 * - Reset metadata tracking
 * - Phase-aware reset policies
 * 
 * @module modules/reset
 */

import { config } from "/angel/config.js";
import { DAEMON_LOCK_PORT } from "/angel/ports.js";

/**
 * Check if we have queued augmentations ready to install
 * @param {NS} ns
 * @returns {boolean}
 */
export function hasQueuedAugments(ns) {
    try {
        const owned = ns.singularity.getOwnedAugmentations(false);
        const installed = ns.singularity.getOwnedAugmentations(true);
        return owned.length > installed.length;
    } catch (e) {
        return false;
    }
}

/**
 * Check if we should install augmentations
 * @param {NS} ns
 * @returns {boolean}
 */
export function shouldInstallAugments(ns) {
    return hasQueuedAugments(ns);
}

/**
 * Install augmentations and reset
 * Uses angel-lite.js for post-reset continuity
 * @param {NS} ns
 * @returns {boolean} - True if installation was triggered
 */
export function installAugmentations(ns) {
    try {
        if (!hasQueuedAugments(ns)) {
            return false;
        }

        // Check for daemon unlock
        let unlocked = false;
        try {
            unlocked = ns.peek(DAEMON_LOCK_PORT) === "UNLOCK_DAEMON";
        } catch (e) {
            unlocked = false;
        }

        if (!unlocked) {
            return false;
        }

        // Clear the unlock flag
        ns.readPort(DAEMON_LOCK_PORT);

        // Always restart with angel-lite.js for seamless post-reset continuity
        // Angel-lite will auto-transition to full Angel if RAM >= 64GB
        ns.singularity.installAugmentations("/angel/angel-lite.js");
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Get reset policy for current phase
 * @param {number} phase
 * @returns {Object}
 */
export function getResetPolicy(phase) {
    const phaseKey = `phase${phase}`;
    const resetConfig = config.augmentations?.resetPhaseTargets?.[phaseKey];
    
    if (resetConfig) {
        return {
            minQueuedAugs: resetConfig.minQueuedAugs,
            minQueuedCost: resetConfig.minQueuedCost,
            minQueuedFloor: resetConfig.minQueuedFloor || resetConfig.minQueuedAugs,
            minRunMinutes: resetConfig.minRunMinutes,
            stallMinutes: resetConfig.stallMinutes,
            highValueCost: resetConfig.highValueCost,
        };
    }
    
    // Default policy
    return {
        minQueuedAugs: config.augmentations?.minQueuedAugs || 10,
        minQueuedCost: config.augmentations?.minQueuedCost || 15000000000,
        minQueuedFloor: config.augmentations?.resetMinQueuedAugsFloor || 8,
        minRunMinutes: config.augmentations?.resetMinRunMinutes || 35,
        stallMinutes: config.augmentations?.resetStallMinutes || 12,
        highValueCost: config.augmentations?.resetHighValueCost || 60000000000,
    };
}

/**
 * Check if we should reset based on phase policy
 * @param {NS} ns
 * @param {number} phase
 * @param {Object} queuedInfo - Info about queued augments {count, totalCost, value}
 * @param {number} runAgeMinutes - Time since last reset in minutes
 * @param {number} stallMinutes - Time since last queue progress in minutes
 * @returns {Object} - {shouldReset: boolean, reason: string}
 */
export function shouldReset(ns, phase, queuedInfo, runAgeMinutes, stallMinutes) {
    const policy = getResetPolicy(phase);
    
    // Check daemon reset policy
    const daemonPolicy = config.augmentations?.daemonResetPolicy;
    if (daemonPolicy) {
        // If Red Pill is queued, reset immediately to install it
        if (daemonPolicy.resetImmediatelyOnQueuedRedPill) {
            try {
                const owned = ns.singularity.getOwnedAugmentations(false);
                if (owned.includes("The Red Pill")) {
                    return { shouldReset: true, reason: "Red Pill queued - immediate reset" };
                }
            } catch (e) {
                // Ignore
            }
        }
        
        // If daemon is ready, don't reset (hold until daemon run is attempted)
        if (daemonPolicy.preventResetWhenDaemonReady) {
            // TODO: Check if daemon requirements are met
            // For now, we'll skip this check
        }
    }
    
    // High-value override: if queue value exceeds threshold, reset immediately
    if (queuedInfo.totalCost >= policy.highValueCost) {
        return { shouldReset: true, reason: `High-value queue (${queuedInfo.totalCost})` };
    }
    
    // Minimum queue count check
    if (queuedInfo.count < policy.minQueuedFloor) {
        return { shouldReset: false, reason: `Queue too small (${queuedInfo.count} < ${policy.minQueuedFloor})` };
    }
    
    // Minimum run age check
    if (runAgeMinutes < policy.minRunMinutes) {
        return { shouldReset: false, reason: `Run too young (${runAgeMinutes.toFixed(1)}min < ${policy.minRunMinutes}min)` };
    }
    
    // Check if queue meets target
    const meetsTarget = queuedInfo.count >= policy.minQueuedAugs && 
                       queuedInfo.totalCost >= policy.minQueuedCost;
    
    if (!meetsTarget) {
        return { shouldReset: false, reason: `Target not met (${queuedInfo.count}/${policy.minQueuedAugs} augs, ${queuedInfo.totalCost}/${policy.minQueuedCost} cost)` };
    }
    
    // Check if queue has stalled
    if (config.augmentations?.resetRequireStall) {
        if (stallMinutes < policy.stallMinutes) {
            return { shouldReset: false, reason: `Queue still growing (stalled for ${stallMinutes.toFixed(1)}min < ${policy.stallMinutes}min)` };
        }
    }
    
    // All conditions met
    return { shouldReset: true, reason: `Ready (${queuedInfo.count} augs, ${queuedInfo.totalCost} cost, ${runAgeMinutes.toFixed(1)}min run, ${stallMinutes.toFixed(1)}min stalled)` };
}

/**
 * Get queued augmentation info
 * @param {NS} ns
 * @returns {Object} - {count: number, totalCost: number, names: string[]}
 */
export function getQueuedAugmentInfo(ns) {
    try {
        const owned = ns.singularity.getOwnedAugmentations(false);
        const installed = ns.singularity.getOwnedAugmentations(true);
        const queued = owned.filter(aug => !installed.includes(aug));
        
        let totalCost = 0;
        for (const augName of queued) {
            try {
                const price = ns.singularity.getAugmentationPrice(augName);
                totalCost += price;
            } catch (e) {
                // Skip if we can't get price
            }
        }
        
        return {
            count: queued.length,
            totalCost,
            names: queued,
        };
    } catch (e) {
        return {
            count: 0,
            totalCost: 0,
            names: [],
        };
    }
}

/**
 * Get installed augmentation info
 * @param {NS} ns
 * @returns {Object} - {count: number, totalCost: number, totalRep: number, names: string[]}
 */
export function getInstalledAugmentInfo(ns) {
    try {
        const installed = ns.singularity.getOwnedAugmentations(true);
        
        let totalCost = 0;
        let totalRep = 0;
        
        for (const augName of installed) {
            try {
                const stats = ns.singularity.getAugmentationStats(augName);
                totalCost += stats.cost || 0;
                totalRep += stats.repCost || 0;
            } catch (e) {
                // Skip if we can't get stats
            }
        }
        
        return {
            count: installed.length,
            totalCost,
            totalRep,
            names: installed,
        };
    } catch (e) {
        return {
            count: 0,
            totalCost: 0,
            totalRep: 0,
            names: [],
        };
    }
}

/**
 * Calculate run age in minutes since last reset
 * @param {NS} ns
 * @returns {number}
 */
export function getRunAgeMinutes(ns) {
    try {
        const resetInfo = ns.getResetInfo();
        const lastAugReset = Number(resetInfo?.lastAugReset || Date.now());
        const ageMs = Date.now() - lastAugReset;
        return ageMs / 60000;
    } catch (e) {
        return 0;
    }
}

/**
 * Detect if a reset just occurred
 * @param {number} currentInstalledCount
 * @param {number} previousInstalledCount
 * @returns {boolean}
 */
export function detectReset(currentInstalledCount, previousInstalledCount) {
    // Reset detected if installed count dropped by more than 2
    return currentInstalledCount < previousInstalledCount - 2;
}

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== Reset Module ===");
    ns.tprint("");
    
    ns.tprint(`Has queued augments: ${hasQueuedAugments(ns)}`);
    ns.tprint(`Should install: ${shouldInstallAugments(ns)}`);
    
    const queuedInfo = getQueuedAugmentInfo(ns);
    ns.tprint(`Queued: ${queuedInfo.count} augments (${queuedInfo.totalCost} total cost)`);
    
    const installedInfo = getInstalledAugmentInfo(ns);
    ns.tprint(`Installed: ${installedInfo.count} augments`);
    
    const runAge = getRunAgeMinutes(ns);
    ns.tprint(`Run age: ${runAge.toFixed(1)} minutes`);
    
    ns.tprint("");
    ns.tprint("Phase-specific policies:");
    for (let phase = 0; phase <= 4; phase++) {
        const policy = getResetPolicy(phase);
        ns.tprint(`  Phase ${phase}: ${policy.minQueuedAugs} augs, ${policy.minQueuedCost} cost, ${policy.minRunMinutes}min run, ${policy.stallMinutes}min stall`);
    }
}
