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

const PHASE_PORT = 7;

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.print("[Orchest] Game Orchestrator started - Coordinating toward w0r1d_d43m0n");

    let lastNotify = 0;
    let currentPhase = 0;

    while (true) {
        try {
            // Calculate current game phase
            const newPhase = calculateGamePhase(ns);
            if (newPhase !== currentPhase) {
                ns.print(`[Orchest] ⚡ PHASE TRANSITION: ${getPhaseInfo(currentPhase).name} → ${getPhaseInfo(newPhase).name}`);
                currentPhase = newPhase;
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
            if (config.augmentations.installOnThreshold && hasSingularityAccess(ns)) {
                const queued = getQueuedAugments(ns);
                const queuedCost = getQueuedCost(ns, queued);
                if (queued.length >= config.augmentations.minQueuedAugs || queuedCost >= config.augmentations.minQueuedCost) {
                    ns.print(`[Orchest] 🔄 RESET TRIGGER: ${queued.length} augs queued (cost: $${queuedCost.toFixed(0)})`);
                    ns.print(`[Orchest] Installing augments and restarting...`);
                    ns.singularity.installAugmentations("/angel/angel.js");
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
 * Calculate which game phase we're in based on player progress
 */
function calculateGamePhase(ns) {
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

    // Phase 3: Gang Phase
    if (hackLevel >= thresholds.phase2to3.hackLevel && money >= thresholds.phase2to3.money) return 3;

    // Phase 2: Mid Game
    if (hackLevel >= thresholds.phase1to2.hackLevel && money >= thresholds.phase1to2.money) return 2;

    // Phase 1: Early Scaling
    if (hackLevel >= thresholds.phase0to1.hackLevel && money >= thresholds.phase0to1.money) return 1;

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
    const rooted = ns.hasRootAccess(daemonServer);
    
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
    const owned = ns.singularity.getOwnedAugmentations(false);
    const installed = ns.singularity.getOwnedAugmentations(true);
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
 * Print comprehensive status
 */
function printStatus(ns, phase, activity) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home");
    const phaseInfo = getPhaseInfo(phase);
    const daemon = getDaemonStatus(ns);
    const queued = getQueuedAugments(ns);
    
    ns.print("[Orchest] ╔═══════════════════════════════════════╗");
    ns.print("[Orchest] ║     GAME ORCHESTRATOR STATUS        ║");
    ns.print("[Orchest] ╚═══════════════════════════════════════╝");
    
    const phaseEmoji = ["🌱", "📈", "🎯", "👾", "👑"][phase] || "❓";
    ns.print(`[Orchest] Phase: ${phaseEmoji} ${phaseInfo.name.toUpperCase()}`);
    ns.print(`[Orchest] Primary: ${phaseInfo.primaryActivity} | Current: ${activity || "idle"}`);
    
    ns.print(`[Orchest] Hacking: ${Math.floor(player.skills.hacking)} (target: ${phaseInfo.hackingTarget || "∞"})`);
    ns.print(`[Orchest] Stats: STR ${Math.floor(player.skills.strength)}, DEF ${Math.floor(player.skills.defense)}, DEX ${Math.floor(player.skills.dexterity)}, AGI ${Math.floor(player.skills.agility)}`);
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
