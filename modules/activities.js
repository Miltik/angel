/**
 * ANGEL Activities Module
 * Player-work coordinator: training, faction, company orchestration
 * + Faction reputation management and augment-goal alignment
 * + Signals desired activity mode for dedicated workers (crime module)
 * 
 * Phase-aware dual-mode operation:
 * - P0-2: Active activity selection (training/faction/company/crime fallback)
 * - P3+: Filler crime fallback when no higher-priority work is needed
 * - Always: Faction tracking and auto-join
 * 
 * @param {NS} ns
 */
import { config, PORTS } from "/angel/config.js";
import { formatMoney } from "/angel/utils.js";
import { createWindow } from "/angel/modules/uiManager.js";
import {
    syncFactionMembership,
    getMissingCrimeFactions,
    getAugmentRepGoal,
    hasAnyViableFactionWork,
    getFactionOpportunitySummary,
} from "/angel/modules/factions.js";

const PHASE_PORT = 7;
const TELEMETRY_PORT = 20;
const ACTIVITY_OWNER = "activity";
const ACTIVITY_LOCK_TTL = 180000;
const CRIME_SCRIPT = "/angel/modules/crime.js";
const DAEMON_LOCK_PORT = 15;

// State tracking
let lastState = {
    phase: null,
    currentActivity: null,
    currentCrime: null,
    currentFaction: null,
    loopCount: 0,
    lastActivityChange: -10,
    pendingInvites: null,
    plannedActivity: null,
    lastTraining: null,
    lastFaction: null,
    lastCompany: null
};

// Telemetry tracking
const telemetryState = {
    lastReportTime: 0
};

const resetState = {
    lastQueuedCount: 0,
    lastQueuedCost: 0,
    lastProgressTs: 0,
    lastReasonLogTs: 0,
    pending: false,
};

/**
 * Read current game phase from PHASE_PORT (broadcasted by phase module)
 */
function readGamePhase(ns) {
    const phasePortData = ns.peek(PHASE_PORT);
    if (phasePortData === "NULL PORT DATA") return 0;
    return parseInt(phasePortData) || 0;
}

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("activities", "� Activities", 700, 450, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ui.log("🎯 Activities automation initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (!hasSingularityAccess(ns)) {
        ui.log("⚠️  Singularity access not available (need SF4) - waiting...", "warn");
        while (true) {
            await ns.sleep(60000);
        }
    }

    ui.log("✅ Singularity access confirmed", "success");

    // Initialize telemetry
    telemetryState.lastReportTime = Date.now();

    while (true) {
        try {
            const loopStartTime = Date.now();
            const gamePhase = readGamePhase(ns);
            lastState.loopCount++;

            // Show phase transition or status every 12 loops (~60 seconds)
            if (gamePhase !== lastState.phase) {
                const player = ns.getPlayer();
                const money = ns.getServerMoneyAvailable("home") + player.money;
                ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                ui.log(`📊 Phase ${gamePhase} | 💰 ${formatMoney(money)}`, "info");
                lastState.phase = gamePhase;
            } else if (lastState.loopCount % 12 === 1) {
                const player = ns.getPlayer();
                const money = ns.getServerMoneyAvailable("home") + player.money;
                ui.log(`📊 P${gamePhase} status | 💰 ${formatMoney(money)}`, "info");
            }

            // Faction management: ALWAYS ACTIVE (all phases)
            syncFactionMembership(ns, ui, lastState);

            // Activity work: ALL PHASES
            // Priority: Faction work for augments > training > company > crime
            await processActivity(ns, gamePhase, ui);

            // Reset orchestration belongs to coordinator (not dashboard)
            await maybeTriggerCoordinatorReset(ns, ui, gamePhase);

            // Report telemetry every 5 seconds
            const timeSinceLastReport = Date.now() - telemetryState.lastReportTime;
            if (timeSinceLastReport >= 5000) {
                reportActivitiesTelemetry(ns);
                telemetryState.lastReportTime = Date.now();
            }

            await ns.sleep(5000);
        } catch (e) {
            if (String(e).includes("ScriptDeath")) {
                return;
            }
            ui.log(`❌ Loop error: ${e}`, "error");
            await ns.sleep(5000);
        }
    }
}

/**
 * ACTIVITY PROCESSING: Phases 0-2 only
 * Chooses and executes best activity (crime, training, faction, company)
 */
async function processActivity(ns, gamePhase, ui) {
    // Check if already working on something
    const currentWork = ns.singularity.getCurrentWork();
    if (currentWork) {
        const shouldForceFaction = config.factions?.workForFactionRep !== false && hasAnyViableFactionWork(ns);
        const isLowerPriorityWork = currentWork.type === "CRIME" ||
                                    currentWork.type === "COMPANY" ||
                                    currentWork.type === "UNIVERSITY" ||
                                    currentWork.type === "GYM" ||
                                    currentWork.type === "CLASS";

        // Preempt lower-priority work when faction rep is available/needed
        if (shouldForceFaction && isLowerPriorityWork) {
            ns.singularity.stopAction();
            setActivityMode(ns, "faction");
            ui.log(`🔁 Switching from ${currentWork.type} to faction rep grind`, "info");
        } else {
            setActivityMode(ns, desiredModeFromWork(currentWork));
            // Display what's in progress (only on change or periodically)
            const activityKey = `${currentWork.type}-${currentWork.crimeType || currentWork.factionName || currentWork.companyName || ""}`;
            const shouldLog = activityKey !== lastState.currentActivity || lastState.loopCount % 12 === 0;
        
            if (shouldLog) {
                if (currentWork.type === "CRIME") {
                    const crime = currentWork.crimeType;
                    const chance = ns.singularity.getCrimeChance(crime);
                    ui.log(`🔪 Crime in progress: ${crime} (${(chance * 100).toFixed(1)}% success)`, "info");
                } else if (currentWork.type === "FACTION") {
                    const workType = currentWork.factionWorkType || currentWork.workType || "Unknown";
                    ui.log(`🤝 Faction work: ${currentWork.factionName} (${workType})`, "info");
                } else if (currentWork.type === "COMPANY") {
                    ui.log(`💼 Company work: ${currentWork.companyName}`, "info");
                } else if (currentWork.type === "UNIVERSITY" || currentWork.type === "GYM" || currentWork.type === "CLASS") {
                    ui.log(`📚 Training: ${currentWork.type}`, "info");
                }
                lastState.currentActivity = activityKey;
            }
            return;
        }
    }

    // Determine best activity for this phase
    const activity = chooseActivity(ns, gamePhase);

    if (activity === "none") {
        setActivityMode(ns, "none");
        return;
    }

    // Try to acquire activity lock (prevent conflicts)
    if (!claimLock(ns, ACTIVITY_OWNER, ACTIVITY_LOCK_TTL)) {
        return;
    }

    try {
        setActivityMode(ns, activity);

        // Only log when activity changes
        if (activity !== lastState.plannedActivity || lastState.loopCount - lastState.lastActivityChange > 12) {
            const activityEmoji = {
                "crime": "🔪",
                "training": "📚",
                "faction": "🤝",
                "company": "💼"
            };
            ui.log(`${activityEmoji[activity] || "🎯"} Starting: ${activity}`, "info");
            lastState.plannedActivity = activity;
            lastState.lastActivityChange = lastState.loopCount;
        }

        if (activity === "crime") {
            await doCrime(ns, ui);
        } else if (activity === "training") {
            await doTraining(ns, ui);
        } else if (activity === "faction") {
            await doFactionWork(ns, ui);
        } else if (activity === "company") {
            await doCompanyWork(ns, ui);
        }
    } catch (err) {
        if (String(err).includes("ScriptDeath")) {
            return;
        }
        ui.log(`❌ Error during ${activity}: ${err}`, "error");
    }

    releaseLock(ns, ACTIVITY_OWNER);
}

/**
 * Choose best activity based on phase and player state
 * PRIORITY: Faction work (when augments need rep) > Training (when stats low) > Company (when money low) > Crime
 */
function chooseActivity(ns, gamePhase) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home");
    const targets = config.training?.targetStats || { strength: 60, defense: 60, dexterity: 60, agility: 60 };
    const missingCrimeFactions = getMissingCrimeFactions(player);
    const lateCrimeMoneyCap = config.activities?.lateCrimeMoneyCap ?? 100000000;
    const forceCrimeUnlockUntilPhase = config.activities?.forceCrimeFactionUnlockUntilPhase ?? 2;

    // Force crime grind until crime factions are unlocked
    if (missingCrimeFactions.length > 0 && gamePhase <= forceCrimeUnlockUntilPhase) {
        return "crime";
    }

    const needsTraining = 
        player.skills.hacking < (config.training?.targetHacking || 75) ||
        player.skills.strength < targets.strength ||
        player.skills.defense < targets.defense ||
        player.skills.dexterity < targets.dexterity ||
        player.skills.agility < targets.agility;

    // Check if any faction actually has viable work (not just gang-only like Nitesec)
    const hasViableFactionWork = config.factions?.workForFactionRep !== false && hasAnyViableFactionWork(ns);

    // ALWAYS prioritize faction work if we have augments that need rep (all phases)
    if (hasViableFactionWork) {
        return "faction";
    }

    // Phase 0: Bootstrap - prioritize cash, then training
    if (gamePhase === 0) {
        if (money < 10000000) return "crime";
        if (needsTraining) return "training";
        return "crime";
    }

    // Phase 1: Early - training, then company
    if (gamePhase === 1) {
        if (needsTraining) return "training";
        const companyThreshold = config.company?.onlyWhenMoneyBelow || 200000000;
        if (money < companyThreshold) return "company";
        return "crime";
    }

    // Late-game focus: rep + hacking progression, avoid crime unless cash-starved
    if (gamePhase >= 3) {
        if (needsTraining) return "training";
        if (money < lateCrimeMoneyCap) return "crime";
        return "none";
    }

    // Phase 2+: Training if needed, otherwise crime for stats/money
    const allTrained = 
        player.skills.strength >= targets.strength &&
        player.skills.defense >= targets.defense &&
        player.skills.dexterity >= targets.dexterity &&
        player.skills.agility >= targets.agility &&
        player.skills.hacking >= (config.training?.targetHacking || 75);

    if (!allTrained) return "training";
    
    // All stats trained, no faction work needed - crime for money
    return "crime";
}

/**
 * Commit a crime and wait for completion
 */
async function doCrime(ns, ui) {
    setActivityMode(ns, "crime");

    // Dedicated crime worker should always execute crimes now
    if (!ns.isRunning(CRIME_SCRIPT, "home")) {
        const pid = ns.exec(CRIME_SCRIPT, "home");
        if (pid === 0 && lastState.loopCount % 12 === 0) {
            ui.log(`⚠️ Crime mode requested but crime worker is not running`, "warn");
        }
    }

    if (lastState.loopCount % 24 === 0) {
        ui.log(`🔪 Delegated to crime worker`, "info");
    }

    await ns.sleep(5000);
}

/**
 * Train stats or hacking
 */
async function doTraining(ns, ui) {
    const targets = config.training?.targetStats || { strength: 60, defense: 60, dexterity: 60, agility: 60 };
    const player = ns.getPlayer();

    // Determine training target
    let target = null;
    if (player.skills.hacking < (config.training?.targetHacking || 75)) {
        target = { type: "university" };
    } else {
        const stats = [
            { name: "strength", val: player.skills.strength, target: targets.strength },
            { name: "defense", val: player.skills.defense, target: targets.defense },
            { name: "dexterity", val: player.skills.dexterity, target: targets.dexterity },
            { name: "agility", val: player.skills.agility, target: targets.agility },
        ];
        let lowest = null;
        for (const s of stats) {
            if (s.val < s.target && (!lowest || s.val < lowest.val)) {
                lowest = s;
            }
        }
        if (lowest) target = { type: "gym", stat: lowest.name };
    }

    if (!target) {
        await doCrime(ns, ui);
        return;
    }

    if (config.training?.autoTravel) {
        try {
            ns.singularity.travelToCity(config.training?.city || "Chongqing");
        } catch (e) {}
    }

    // Only log if training changed
    const trainingKey = `${target.type}-${target.stat || "hacking"}`;
    if (trainingKey !== lastState.lastTraining || lastState.loopCount - lastState.lastActivityChange > 12) {
        if (target.type === "university") {
            ns.singularity.universityCourse(
                config.training?.university || "Rothman University",
                config.training?.course || "Algorithms",
                config.training?.focus || "maximum"
            );
            ui.log(`📚 Training hacking at ${config.training?.university || "University"}`, "info");
        } else {
            ns.singularity.gymWorkout(
                config.training?.gym || "Powerhouse Gym",
                target.stat,
                config.training?.focus || "maximum"
            );
            ui.log(`💪 Training ${target.stat} at gym`, "info");
        }
        lastState.lastTraining = trainingKey;
        lastState.lastActivityChange = lastState.loopCount;
    }

    await ns.sleep(180000);
}

/**
 * Work for a faction
 */
async function doFactionWork(ns, ui) {
    const player = ns.getPlayer();
    const augGoal = getAugmentRepGoal(ns);

    if (augGoal && augGoal.repShort > 0 && (player.factions || []).includes(augGoal.faction)) {
        const currentWork = ns.singularity.getCurrentWork();
        if (currentWork && currentWork.type === "FACTION" && currentWork.factionName === augGoal.faction) {
            await ns.sleep(180000);
            return;
        }

        const configuredWorkType = config.factions?.workType || "Hacking Contracts";
        const workTypes = [configuredWorkType, "Hacking Contracts", "Field Work", "Security Work"];
        let started = false;
        let selectedWorkType = configuredWorkType;

        for (const workType of [...new Set(workTypes)]) {
            try {
                if (ns.singularity.workForFaction(augGoal.faction, workType, config.factions?.focus || false)) {
                    started = true;
                    selectedWorkType = workType;
                    break;
                }
            } catch (e) {
                // Try next work type
            }
        }

        if (started) {
            const factionKey = `${augGoal.faction}-${selectedWorkType}`;
            if (factionKey !== lastState.lastFaction || lastState.loopCount - lastState.lastActivityChange > 12) {
                ui.log(`🎯 Aug goal faction: ${augGoal.faction} (${selectedWorkType}) | Target: ${augGoal.name} | Rep needed: ${Math.floor(augGoal.repShort)}`, "info");
                lastState.lastFaction = factionKey;
                lastState.lastActivityChange = lastState.loopCount;
            }

            await ns.sleep(180000);
            return;
        }
    }

    // Filter to factions with actual rep-needed augment opportunities (excluding NiteSec)
    const factions = player.factions.filter(f => {
        if (f === "NiteSec") return false;
        const summary = getFactionOpportunitySummary(ns, f);
        return summary.grindableCount > 0;
    });

    if (factions.length === 0) {
        await doCrime(ns, ui);
        return;
    }

    // Find faction with best opportunity: most grindable augs, then highest total value
    let bestFaction = null;
    let bestSummary = null;

    for (const faction of factions) {
        const summary = getFactionOpportunitySummary(ns, faction);
        if (!bestSummary) {
            bestSummary = summary;
            bestFaction = faction;
            continue;
        }

        const isBetter =
            summary.grindableCount > bestSummary.grindableCount ||
            (summary.grindableCount === bestSummary.grindableCount && summary.grindableValue > bestSummary.grindableValue) ||
            (summary.grindableCount === bestSummary.grindableCount && summary.grindableValue === bestSummary.grindableValue && summary.maxRepNeeded > bestSummary.maxRepNeeded);

        if (isBetter) {
            bestSummary = summary;
            bestFaction = faction;
        }
    }

    if (!bestFaction || !bestSummary || bestSummary.grindableCount <= 0) {
        await doCrime(ns, ui);
        return;
    }

    const currentWork = ns.singularity.getCurrentWork();
    if (currentWork && currentWork.type === "FACTION" && currentWork.factionName === bestFaction) {
        // Already working on best faction
        await ns.sleep(180000);
        return;
    }

    const configuredWorkType = config.factions?.workType || "Hacking Contracts";
    const workTypes = [configuredWorkType, "Hacking Contracts", "Field Work", "Security Work"];
    let started = false;
    let selectedWorkType = configuredWorkType;

    for (const workType of [...new Set(workTypes)]) {
        try {
            if (ns.singularity.workForFaction(bestFaction, workType, config.factions?.focus || false)) {
                started = true;
                selectedWorkType = workType;
                break;
            }
        } catch (e) {
            // Try next work type
        }
    }

    if (!started) {
        if (lastState.loopCount % 12 === 0) {
            ui.log(`⚠️ Could not start faction work for ${bestFaction} (all work types unavailable)`, "warn");
        }
        await doCrime(ns, ui);
        return;
    }

    // Only log if faction/work type changed or periodic heartbeat
    const factionKey = `${bestFaction}-${selectedWorkType}`;
    if (factionKey !== lastState.lastFaction || lastState.loopCount - lastState.lastActivityChange > 12) {
        ui.log(`🤝 Working for ${bestFaction} (${selectedWorkType}) | Augs: ${bestSummary.grindableCount} | Value: ${formatMoney(bestSummary.grindableValue)} | Rep needed: ${Math.floor(bestSummary.maxRepNeeded)}`, "info");
        lastState.lastFaction = factionKey;
        lastState.lastActivityChange = lastState.loopCount;
    }

    await ns.sleep(180000);
}

/**
 * Work for a company
 */
async function doCompanyWork(ns, ui) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home");
    const threshold = config.company?.onlyWhenMoneyBelow || 200000000;

    if (money >= threshold) {
        await doCrime(ns, ui);
        return;
    }

    const currentWork = ns.singularity.getCurrentWork();
    if (currentWork && currentWork.type === "COMPANY") {
        // Already working
        await ns.sleep(180000);
        return;
    }

    if (config.training?.autoTravel) {
        try {
            ns.singularity.travelToCity(config.training?.city || "Chongqing");
        } catch (e) {}
    }

    // Find a company with a job
    const companies = ["ECorp", "MegaCorp", "Bachman & Associates", "Blade Industries", "NWO"];
    let placed = false;

    for (const company of companies) {
        try {
            const success = ns.singularity.workForCompany(company, config.company?.focus || "maximum");
            if (success) {
                // Only log if company changed
                if (company !== lastState.lastCompany || lastState.loopCount - lastState.lastActivityChange > 12) {
                    ui.log(`💼 Working for ${company} | ${formatMoney(money)}/${formatMoney(threshold)}`, "info");
                    lastState.lastCompany = company;
                    lastState.lastActivityChange = lastState.loopCount;
                }
                placed = true;
                break;
            }
        } catch (e) {}
    }

    if (!placed) {
        if (lastState.loopCount % 24 === 0) {
            ui.log(`⚠️  No positions available - doing crime instead`, "warn");
        }
        await doCrime(ns, ui);
        return;
    }

    await ns.sleep(180000);
}

function getBestCrime(ns) {
    const crimes = [
        "Shoplift",
        "Rob Store",
        "Mug someone",
        "Larceny",
        "Deal Drugs",
        "Bond Forgery",
        "Traffick illegal Arms",
        "Homicide",
        "Grand Theft Auto",
        "Kidnap",
        "Assassination",
        "Heist",
    ];

    const minSuccessChance = config.crime?.minSuccessChance || 0.25;
    let best = null;
    let fallback = null;

    for (const crime of crimes) {
        try {
            const stats = ns.singularity.getCrimeStats(crime);
            const chance = ns.singularity.getCrimeChance(crime);
            const score = (stats.money * chance) / Math.max(1, stats.time);
            const record = { crime, score, chance };

            if (!fallback || record.score > fallback.score) {
                fallback = record;
            }

            if (chance >= minSuccessChance && (!best || record.score > best.score)) {
                best = record;
            }
        } catch (e) {
            // unavailable crime label
        }
    }

    return best || fallback || { crime: "Shoplift", score: 0, chance: 1 };
}

/**
 * Get total rep needed for unowned augments in a faction
 */
function getRepNeeded(ns, faction) {
    const currentRep = ns.singularity.getFactionRep(faction);
    const augments = ns.singularity.getAugmentationsFromFaction(faction);

    let maxRepNeeded = 0;

    for (const aug of augments) {
        if (ns.singularity.getOwnedAugmentations(true).includes(aug)) {
            continue;
        }

        const repReq = ns.singularity.getAugmentationRepReq(aug);
        if (repReq > currentRep) {
            maxRepNeeded = Math.max(maxRepNeeded, repReq - currentRep);
        }
    }

    return maxRepNeeded;
}

/**
 * Check singularity access
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
 * Lock management for activity synchronization
 */
function getLock(ns) {
    const raw = ns.peek(PORTS.ACTIVITY);
    if (raw === "NULL PORT DATA") return null;
    const parts = String(raw).split("|");
    if (parts.length < 2) return null;
    return { owner: parts[0], expires: Number(parts[1]) };
}

function claimLock(ns, owner, ttlMs) {
    const now = Date.now();
    const lock = getLock(ns);
    if (!lock || lock.expires <= now) {
        ns.clearPort(PORTS.ACTIVITY);
        ns.writePort(PORTS.ACTIVITY, `${owner}|${now + ttlMs}`);
        return true;
    }
    return false;
}

function setActivityMode(ns, activity) {
    try {
        ns.clearPort(PORTS.ACTIVITY_MODE);
        ns.writePort(PORTS.ACTIVITY_MODE, String(activity || "none").toLowerCase());
    } catch (e) {
        // Ignore mode signaling failures
    }
}

function desiredModeFromWork(work) {
    const type = String(work?.type || "").toUpperCase();
    if (type === "CRIME") return "crime";
    if (type === "FACTION") return "faction";
    if (type === "COMPANY") return "company";
    if (type === "UNIVERSITY" || type === "GYM" || type === "CLASS") return "training";
    return "none";
}

function updateResetProgressState(queuedCount, queuedCost, now) {
    if (resetState.lastProgressTs === 0) {
        resetState.lastProgressTs = now;
    }

    const countImproved = queuedCount > resetState.lastQueuedCount;
    const costImproved = queuedCost > resetState.lastQueuedCost * 1.02;
    if (countImproved || costImproved) {
        resetState.lastProgressTs = now;
    }

    resetState.lastQueuedCount = queuedCount;
    resetState.lastQueuedCost = queuedCost;
}

function getQueuedAugmentsForReset(ns) {
    const owned = ns.singularity.getOwnedAugmentations(true);
    const installed = ns.singularity.getOwnedAugmentations(false);
    return owned.filter((aug) => !installed.includes(aug));
}

function getQueuedCostForReset(ns, queued) {
    let total = 0;
    for (const aug of queued) {
        total += Number(ns.singularity.getAugmentationPrice(aug) || 0);
    }
    return total;
}

function getDaemonPrepStatusForReset(ns) {
    try {
        const player = ns.getPlayer();
        const hackLevel = Number(player?.skills?.hacking || 0);
        const daemonHost = "w0r1d_d43m0n";
        const requiredHack = Number(ns.getServerRequiredHackingLevel(daemonHost) || 3000);
        const rooted = ns.hasRootAccess(daemonHost);

        const owned = ns.singularity.getOwnedAugmentations(true);
        const installed = ns.singularity.getOwnedAugmentations(false);
        const hasRedPillQueued = owned.includes("The Red Pill") && !installed.includes("The Red Pill");
        const hasRedPillInstalled = installed.includes("The Red Pill");

        return {
            hackLevel,
            requiredHack,
            rooted,
            hasRedPillQueued,
            hasRedPillInstalled,
            ready: hasRedPillInstalled && rooted && hackLevel >= requiredHack,
        };
    } catch (e) {
        return {
            hackLevel: 0,
            requiredHack: 3000,
            rooted: false,
            hasRedPillQueued: false,
            hasRedPillInstalled: false,
            ready: false,
        };
    }
}

function shouldTriggerAdaptiveReset(ns, phase, queuedCount, queuedCost, now) {
    const augCfg = config.augmentations || {};
    const normalizedPhase = Math.max(0, Math.min(4, Number(phase || 0)));
    const phaseKey = `phase${normalizedPhase}`;
    const phaseTargets = augCfg.resetPhaseTargets?.[phaseKey] || {};

    const minQueuedAugs = phaseTargets.minQueuedAugs ?? augCfg.minQueuedAugs ?? 7;
    const minQueuedCost = phaseTargets.minQueuedCost ?? augCfg.minQueuedCost ?? 0;
    const minQueuedFloor = phaseTargets.minQueuedFloor ?? augCfg.resetMinQueuedAugsFloor ?? Math.min(minQueuedAugs, 5);
    const highValueCost = phaseTargets.highValueCost ?? augCfg.resetHighValueCost ?? (minQueuedCost * 3);
    const minRunMinutes = phaseTargets.minRunMinutes ?? augCfg.resetMinRunMinutes ?? 20;
    const stallMinutes = phaseTargets.stallMinutes ?? augCfg.resetStallMinutes ?? 8;
    const requireStall = augCfg.resetRequireStall !== false;
    const daemonPolicy = augCfg.daemonResetPolicy || {};

    const daemon = getDaemonPrepStatusForReset(ns);
    if (daemon.hasRedPillQueued && daemonPolicy.resetImmediatelyOnQueuedRedPill !== false) {
        return { shouldReset: true, reason: "The Red Pill is queued; resetting immediately for daemon progression" };
    }

    if (daemonPolicy.preventResetWhenDaemonReady !== false && daemon.ready) {
        return { shouldReset: false, reason: "daemon-ready state reached; holding reset to finish run" };
    }

    const meetsBaseThreshold = queuedCount >= minQueuedAugs || queuedCost >= minQueuedCost;
    if (!meetsBaseThreshold) {
        return { shouldReset: false, reason: `base threshold not met (${queuedCount}/${minQueuedAugs} augs)` };
    }

    if (queuedCount < minQueuedFloor && queuedCost < highValueCost) {
        return { shouldReset: false, reason: `queued augs below floor (${queuedCount}/${minQueuedFloor})` };
    }

    const resetInfo = ns.getResetInfo();
    const runDurationMs = Math.max(0, now - Number(resetInfo?.lastAugReset || now));
    const minRunMs = Math.max(0, minRunMinutes) * 60 * 1000;
    if (runDurationMs < minRunMs && queuedCost < highValueCost) {
        const minsLeft = Math.ceil((minRunMs - runDurationMs) / 60000);
        return { shouldReset: false, reason: `run too fresh (${minsLeft}m until minimum runtime)` };
    }

    if (requireStall && queuedCost < highValueCost) {
        const stallMs = Math.max(0, stallMinutes) * 60 * 1000;
        const stalledFor = now - resetState.lastProgressTs;
        if (stalledFor < stallMs) {
            const minsLeft = Math.ceil((stallMs - stalledFor) / 60000);
            return { shouldReset: false, reason: `queue still improving (${minsLeft}m until stall window)` };
        }
    }

    if (queuedCost >= highValueCost) {
        return { shouldReset: true, reason: `high-value queue reached (${formatMoney(queuedCost)})` };
    }

    return { shouldReset: true, reason: `threshold met after runtime/stall checks (${queuedCount} augs)` };
}

async function triggerCoordinatorReset(ns, ui, queuedCount, queuedCost) {
    const countdown = config.augmentations?.resetCountdownSec ?? 10;
    const restartScript = config.augmentations?.resetScript || "/angel/angel-lite.js";
    ui.log(`🔄 RESET TRIGGER: ${queuedCount} augs queued (cost: ${formatMoney(queuedCost)})`, "warn");
    ui.log(`🚫 DAEMON ADVANCEMENT PROTECTION: Awaiting manual unlock...`, "warn");

    while (true) {
        try {
            const portData = ns.peek(DAEMON_LOCK_PORT);
            if (portData === "UNLOCK_DAEMON") {
                ns.readPort(DAEMON_LOCK_PORT);
                ui.log(`✅ DAEMON UNLOCK SIGNAL RECEIVED - Proceeding`, "success");
                break;
            }
        } catch (e) {
            // keep waiting
        }

        await ns.sleep(30000);
    }

    for (let i = countdown; i > 0; i--) {
        ui.log(`Resetting in ${i}s...`, "warn");
        await ns.sleep(1000);
    }

    ns.singularity.installAugmentations(restartScript);
}

async function maybeTriggerCoordinatorReset(ns, ui, phase) {
    if (!hasSingularityAccess(ns)) return;
    if (config.augmentations?.installOnThreshold === false) return;
    if (resetState.pending) return;

    const now = Date.now();
    const queued = getQueuedAugmentsForReset(ns);
    const queuedCost = getQueuedCostForReset(ns, queued);
    updateResetProgressState(queued.length, queuedCost, now);

    const decision = shouldTriggerAdaptiveReset(ns, phase, queued.length, queuedCost, now);
    if (!decision.shouldReset) {
        if (decision.reason && now - resetState.lastReasonLogTs > 60000) {
            ui.log(`🧠 RESET GATE: Waiting - ${decision.reason}`, "info");
            resetState.lastReasonLogTs = now;
        }
        return;
    }

    resetState.pending = true;
    try {
        await triggerCoordinatorReset(ns, ui, queued.length, queuedCost);
    } finally {
        resetState.pending = false;
    }
}

function reportActivitiesTelemetry(ns) {
    try {
        const now = Date.now();
        const player = ns.getPlayer();
        const phase = readGamePhase(ns);
        const currentWork = ns.singularity.getCurrentWork();
        const lock = getLock(ns);
        const bestCrime = getBestCrime(ns);

        const trainingTargets = config.training?.targetStats || { strength: 60, defense: 60, dexterity: 60, agility: 60 };
        const targetHacking = config.training?.targetHacking || 75;
        const minCombat = Math.min(player.skills.strength, player.skills.defense, player.skills.dexterity, player.skills.agility);
        const combatGap = Math.max(
            0,
            trainingTargets.strength - player.skills.strength,
            trainingTargets.defense - player.skills.defense,
            trainingTargets.dexterity - player.skills.dexterity,
            trainingTargets.agility - player.skills.agility
        );
        const hackingGap = Math.max(0, targetHacking - player.skills.hacking);

        let liveWorkType = "idle";
        let liveTarget = "none";
        if (currentWork) {
            liveWorkType = String(currentWork.type || "working").toLowerCase();
            liveTarget = String(
                currentWork.crimeType ||
                currentWork.factionName ||
                currentWork.companyName ||
                currentWork.classType ||
                currentWork.location ||
                "active"
            );
        }

        const augGoal = getAugmentRepGoal(ns);
        const factionFocus = augGoal?.faction || "none";
        const factionRepNeeded = Math.floor(augGoal?.repShort || 0);
        const daemon = getDaemonPrepStatusForReset(ns);
        let daemonUnlockSignal = false;
        try {
            daemonUnlockSignal = ns.peek(DAEMON_LOCK_PORT) === "UNLOCK_DAEMON";
        } catch (e) {
            daemonUnlockSignal = false;
        }
        
        const metricsPayload = {
            currentActivity: lastState.currentActivity || "idle",
            plannedActivity: lastState.plannedActivity || "none",
            phase,
            liveWorkType,
            liveTarget,
            lockOwner: lock?.owner || "none",
            lockTtlSec: lock?.expires ? Math.max(0, Math.floor((lock.expires - now) / 1000)) : 0,
            factionFocus,
            factionRepNeeded,
            bestCrime: bestCrime?.crime || "Shoplift",
            bestCrimeChance: Number(bestCrime?.chance || 0),
            daemonReady: Boolean(daemon?.ready),
            daemonLocked: !daemonUnlockSignal,
            daemonRequiredHack: Number(daemon?.requiredHack || 0),
            daemonCurrentHack: Number(daemon?.hackLevel || 0),
            daemonRooted: Boolean(daemon?.rooted),
            daemonHasRedPill: Boolean(daemon?.hasRedPillInstalled || daemon?.hasRedPillQueued),
            minCombat,
            hacking: Number(player.skills.hacking || 0),
            combatGap,
            hackingGap,
            loopCount: lastState.loopCount,
            stats: minCombat
        };
        
        writeActivitiesMetrics(ns, metricsPayload);
        telemetryState.lastReportTime = now;
    } catch (e) {
        ns.print(`❌ Activities telemetry error: ${e}`);
    }
}

function writeActivitiesMetrics(ns, metricsPayload) {
    try {
        const payload = JSON.stringify({
            module: 'activities',
            timestamp: Date.now(),
            metrics: metricsPayload,
        });
        ns.writePort(TELEMETRY_PORT, payload);
    } catch (e) {
        ns.print(`❌ Failed to write activities metrics: ${e}`);
    }
}

function releaseLock(ns, owner) {
    const lock = getLock(ns);
    if (lock && lock.owner === owner) {
        ns.clearPort(PORTS.ACTIVITY);
    }
}
