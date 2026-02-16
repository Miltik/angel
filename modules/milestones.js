/**
 * Milestones/Game Orchestrator Module
 * Central coordinator that:
 * - Detects game phase based on player progress
 * - Broadcasts current phase to all modules
 * - Coordinates activity priorities
 * - Tracks progress toward daemon
 * - Triggers reset when augments reach threshold
 * 
 * @param {NS} ns
 */
import { config, PORTS } from "/angel/config.js";
import { createWindow } from "/angel/modules/uiManager.js";

const PHASE_PORT = 7;

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("milestones", "📚 Milestones & Orchestrator", 700, 500);
    ui.log("Game Orchestrator started - Coordinating toward w0r1d_d43m0n", "info");

    let lastNotify = 0;
    let currentPhase = 0;
    let phaseStableCount = 0; // Track phase stability for hysteresis
    let resetPending = false;

    while (true) {
        try {
            // Calculate current game phase with hysteresis to prevent oscillation
            const newPhase = calculateGamePhaseWithHysteresis(ns, currentPhase, phaseStableCount);
            if (newPhase !== currentPhase) {
                ns.print(`[Orchest] ⚡ PHASE TRANSITION: ${getPhaseInfo(currentPhase).name} → ${getPhaseInfo(newPhase).name}`);
                currentPhase = newPhase;
                phaseStableCount = 0;
            } else {
                phaseStableCount++; // Increase stability counter
            }

            // Broadcast phase to all modules
            ns.clearPort(PHASE_PORT);
            ns.writePort(PHASE_PORT, currentPhase);

            // Calculate desired activity based on phase
            const activity = calculateDesiredActivity(ns, currentPhase);
            ns.clearPort(PORTS.ACTIVITY_MODE);
            ns.writePort(PORTS.ACTIVITY_MODE, activity);

            // Print comprehensive status
            printStatus(ns, currentPhase, activity);

            // Check for augment threshold (reset trigger)
            if (config.augmentations.installOnThreshold && hasSingularityAccess(ns) && !resetPending) {
                const queued = getQueuedAugments(ns);
                const queuedCost = getQueuedCost(ns, queued);
                const queuedEnough = queued.length >= config.augmentations.minQueuedAugs;
                const costEnough = queuedCost >= config.augmentations.minQueuedCost;
                if (queuedEnough || costEnough) {
                    resetPending = true;
                    await triggerAugReset(ns, queued.length, queuedCost);
                    return;
                }
            }

            // Notify of daemon readiness (every 5 min)
            if (config.milestones.notifyDaemon) {
                const now = Date.now();
                if (now - lastNotify >= config.milestones.notifyInterval) {
                    const daemon = getDaemonStatus(ns);
                    if (daemon.ready) {
                        ns.print(`[Orchest] ✅ DAEMON READY: w0r1d_d43m0n requirements met (manual kill only)`);
                    } else {
                        const missing = [];
                        if (daemon.hackLevel < daemon.requiredLevel) missing.push(`Hacking +${daemon.requiredLevel - daemon.hackLevel}`);
                        if (!daemon.rooted) missing.push("Root w0r1d_d43m0n");
                        if (!daemon.programsOk) missing.push("Get all 5 programs");
                        ns.print(`[Orchest] Status: ${missing.join(", ")}`);
                    }
                    lastNotify = now;
                }
            }
        } catch (e) {
            ns.print(`[Orchest] Error: ${e}`);
        }

        await ns.sleep(config.milestones.loopDelay);
    }
}

/**
 * Calculate which game phase we're in based on player progress with hysteresis
 * Prevents oscillation by requiring different thresholds for upward vs downward transitions
 */
function calculateGamePhaseWithHysteresis(ns, currentPhase, stableCount) {
    const player = ns.getPlayer();
    const hackLevel = player.skills.hacking;
    const money = ns.getServerMoneyAvailable("home") + player.money;
    const stats = Math.min(player.skills.strength, player.skills.defense, player.skills.dexterity, player.skills.agility);
    const daemonReady = getDaemonStatus(ns).ready;
    const thresholds = config.gamePhases.thresholds;

    // If daemon ready, stay in phase 4
    if (daemonReady) return 4;

    // Phase 4: Late Game
    if (hackLevel >= thresholds.phase3to4.hackLevel && stats >= thresholds.phase3to4.stats) return 4;

    // Phase 3: Gang Phase (with hysteresis)
    const phase3UpThreshold = thresholds.phase2to3.money;
    const phase3DownThreshold = thresholds.phase2to3.money * 0.9; // 10% margin to prevent cycling
    if (currentPhase >= 3) {
        // Already in phase 3: require money to drop 10% below to downgrade
        if (hackLevel >= thresholds.phase2to3.hackLevel && money >= phase3DownThreshold) return 3;
    } else {
        // In phase 2: require full threshold to advance
        if (hackLevel >= thresholds.phase2to3.hackLevel && money >= phase3UpThreshold) return 3;
    }

    // Phase 2: Mid Game (with hysteresis)
    const phase2UpThreshold = thresholds.phase1to2.money;
    const phase2DownThreshold = thresholds.phase1to2.money * 0.9;
    if (currentPhase >= 2) {
        if (hackLevel >= thresholds.phase1to2.hackLevel && money >= phase2DownThreshold) return 2;
    } else {
        if (hackLevel >= thresholds.phase1to2.hackLevel && money >= phase2UpThreshold) return 2;
    }

    // Phase 1: Early Scaling (with hysteresis)
    const phase1UpThreshold = thresholds.phase0to1.money;
    const phase1DownThreshold = thresholds.phase0to1.money * 0.9;
    if (currentPhase >= 1) {
        if (hackLevel >= thresholds.phase0to1.hackLevel && money >= phase1DownThreshold) return 1;
    } else {
        if (hackLevel >= thresholds.phase0to1.hackLevel && money >= phase1UpThreshold) return 1;
    }

    // Phase 0: Bootstrap
    return 0;
}

/**
 * Get phase information
 */
function getPhaseInfo(phase) {
    if (phase === 0) return config.gamePhases.phase0;
    if (phase === 1) return config.gamePhases.phase1;
    if (phase === 2) return config.gamePhases.phase2;
    if (phase === 3) return config.gamePhases.phase3;
    if (phase === 4) return config.gamePhases.phase4;
    return { name: "Unknown", primaryActivity: "none" };
}

/**
 * Calculate desired activity based on current phase and priorities
 */
function calculateDesiredActivity(ns, phase) {
    const phaseInfo = getPhaseInfo(phase);
    const player = ns.getPlayer();

    // Phase-specific logic
    if (phase === 0) {
        const money = ns.getServerMoneyAvailable("home");
        if (money < 10000000) return "crime";
        return "none";
    }

    if (phase === 1) {
        if (needsTraining(ns)) return "training";
        return "factionWork";
    }

    if (phase === 2) {
        if (needsTraining(ns)) return "training";
        return "factionWork";
    }

    if (phase === 3) {
        if (needsTraining(ns)) return "training";
        return "none";
    }

    if (phase === 4) {
        return "none";
    }

    return "none";
}

/**
 * Check if player still needs training
 */
function needsTraining(ns) {
    const player = ns.getPlayer();
    const trainingTargets = config.training.targetStats;
    const hackTarget = config.training.targetHacking;

    if (player.skills.hacking < hackTarget) return true;
    if (player.skills.strength < trainingTargets.strength) return true;
    if (player.skills.defense < trainingTargets.defense) return true;
    if (player.skills.dexterity < trainingTargets.dexterity) return true;
    if (player.skills.agility < trainingTargets.agility) return true;

    return false;
}

/**
 * Get daemon readiness status
 */
function getDaemonStatus(ns) {
    const daemonServer = "w0r1d_d43m0n";
    const player = ns.getPlayer();
    const requiredLevel = 200;
    
    const hackLevel = player.skills.hacking;
    const hasAllPrograms = ns.fileExists("BruteSSH.exe", "home") &&
                          ns.fileExists("FTPCrack.exe", "home") &&
                          ns.fileExists("relaySMTP.exe", "home") &&
                          ns.fileExists("HTTPWorm.exe", "home") &&
                          ns.fileExists("SQLInject.exe", "home");
    
    // Try to check daemon access, handle error if daemon doesn't exist yet
    let rooted = false;
    try {
        rooted = ns.hasRootAccess(daemonServer);
    } catch (e) {
        // Daemon not yet accessible or hostname invalid
        rooted = false;
    }
    
    return {
        hackLevel,
        requiredLevel,
        rooted,
        programsOk: hasAllPrograms,
        ready: hackLevel >= requiredLevel && rooted && hasAllPrograms,
    };
}

/**
 * Get queued augmentations
 */
function getQueuedAugments(ns) {
    if (!hasSingularityAccess(ns)) return [];
    const owned = ns.singularity.getOwnedAugmentations(true);
    const installed = ns.singularity.getOwnedAugmentations(false);
    return owned.filter((aug) => !installed.includes(aug));
}

/**
 * Get total cost of queued augmentations
 */
function getQueuedCost(ns, queued) {
    if (!hasSingularityAccess(ns)) return 0;
    let total = 0;
    for (const aug of queued) {
        total += ns.singularity.getAugmentationPrice(aug);
    }
    return total;
}

/**
 * Check if singularity functions are available
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
 * Countdown and install augments, then restart automation
 */
async function triggerAugReset(ns, queuedCount, queuedCost) {
    const countdown = config.augmentations.resetCountdownSec ?? 10;
    const restartScript = config.augmentations.resetScript || "/angel/start.js";
    ns.tprint(`[Orchest] 🔄 RESET TRIGGER: ${queuedCount} augs queued (cost: $${queuedCost.toFixed(0)})`);
    ns.tprint(`[Orchest] Installing augments in ${countdown}s... (restart: ${restartScript})`);
    ns.print(`[Orchest] 🔄 RESET TRIGGER: ${queuedCount} augs queued (cost: $${queuedCost.toFixed(0)})`);
    
    for (let i = countdown; i > 0; i--) {
        ns.print(`[Orchest] Resetting in ${i}s...`);
        await ns.sleep(1000);
    }
    
    ns.print("[Orchest] Installing augmentations and restarting...");
    ns.singularity.installAugmentations(restartScript);
}

/**
 * Print comprehensive status
 */
function printStatus(ns, phase, activity) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home");
    const phaseInfo = getPhaseInfo(phase);
    const daemon = getDaemonStatus(ns);
    const queued = getQueuedAugments(ns);
    const trainingTargets = config.training?.targetStats || { strength: 60, defense: 60, dexterity: 60, agility: 60 };
    
    ns.print("[Orchest] ╔═══════════════════════════════════════╗");
    ns.print("[Orchest] ║     GAME ORCHESTRATOR STATUS        ║");
    ns.print("[Orchest] ╚═══════════════════════════════════════╝");
    
    const phaseEmoji = ["🌱", "📈", "🎯", "👾", "👑"][phase] || "❓";
    ns.print(`[Orchest] Phase: ${phaseEmoji} ${phaseInfo.name.toUpperCase()}`);
    ns.print(`[Orchest] Primary: ${phaseInfo.primaryActivity} | Current: ${activity || "idle"}`);
    
    ns.print(`[Orchest] Hacking: ${Math.floor(player.skills.hacking)} (target: ${phaseInfo.hackingTarget || "∞"})`);
    ns.print(`[Orchest] Stats: STR ${Math.floor(player.skills.strength)}/${trainingTargets.strength}, DEF ${Math.floor(player.skills.defense)}/${trainingTargets.defense}, DEX ${Math.floor(player.skills.dexterity)}/${trainingTargets.dexterity}, AGI ${Math.floor(player.skills.agility)}/${trainingTargets.agility}`);
    ns.print(`[Orchest] Money: $${formatMoney(money)} | Queued augs: ${queued.length}`);
    
    const daemonStatus = daemon.ready ? "✅ READY" : `⏳ ${daemon.hackLevel}/${daemon.requiredLevel}`;
    ns.print(`[Orchest] Daemon: ${daemonStatus}`);
    ns.print("[Orchest]");
}

/**
 * Format money for display
 */
function formatMoney(num) {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return `${num.toFixed(0)}`;
}
