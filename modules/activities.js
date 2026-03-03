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

const PHASE_PORT = 7;
const TELEMETRY_PORT = 20;
const ACTIVITY_OWNER = "activity";
const ACTIVITY_LOCK_TTL = 180000;
const CRIME_SCRIPT = "/angel/modules/crime.js";
const CRIME_FACTIONS = [
    "Slum Snakes",
    "Tetrads",
    "Speakers for the Dead",
    "The Syndicate",
    "The Dark Army",
];

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
    lastCrimeStarted: null,
    lastTraining: null,
    lastFaction: null,
    lastCompany: null
};

// Telemetry tracking
const telemetryState = {
    lastReportTime: 0
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
            await manageFactions(ns, ui);

            // Activity work: ALL PHASES
            // Priority: Faction work for augments > training > company > crime
            await processActivity(ns, gamePhase, ui);

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
 * FACTION MANAGEMENT: Always active
 * Tracks faction rep, handles invitations, displays status
 */
async function manageFactions(ns, ui) {
    const player = ns.getPlayer();
    const joinedFactions = new Set(player.factions || []);
    const invitations = ns.singularity.checkFactionInvitations();

    // Auto-join priority factions first
    if (config.factions?.autoJoinFactions && invitations.length > 0) {
        const priorityFactions = config.factions.priorityFactions || [];
        for (const faction of invitations) {
            if (priorityFactions.includes(faction) && !joinedFactions.has(faction)) {
                const joined = ns.singularity.joinFaction(faction);
                if (joined) {
                    joinedFactions.add(faction);
                    ui.log(`✅ Joined priority faction: ${faction}`, "success");
                }
            }
        }
    }

    // Auto-join all remaining invitations (including backdoor-unlocked factions)
    if (config.factions?.autoJoinFactions && invitations.length > 0) {
        for (const faction of invitations) {
            if (joinedFactions.has(faction)) continue;

            const joined = ns.singularity.joinFaction(faction);
            if (joined) {
                joinedFactions.add(faction);
                ui.log(`✅ Joined faction: ${faction}`, "success");
            }
        }
    }

    // Show pending invitations (only on change or periodically)
    const inviteStr = invitations.join(",");
    if (invitations.length > 0 && (inviteStr !== lastState.pendingInvites || lastState.loopCount % 24 === 0)) {
        ui.log(`📬 Pending invitations: ${invitations.join(", ")}`, "warn");
        lastState.pendingInvites = inviteStr;
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
            if (currentWork.type === "CRIME") {
                const bestCrime = getBestCrime(ns);
                const currentCrime = String(currentWork.crimeType || "");
                const currentScore = getCrimeExpectedValue(ns, currentCrime);
                const shouldUpgradeCrime =
                    bestCrime.crime &&
                    currentCrime &&
                    bestCrime.crime !== currentCrime &&
                    bestCrime.score > currentScore * 1.1;

                if (shouldUpgradeCrime) {
                    ns.singularity.stopAction();
                    ui.log(`🔁 Upgrading crime: ${currentCrime} → ${bestCrime.crime}`, "info");
                } else {
                    const activityKey = `${currentWork.type}-${currentWork.crimeType || currentWork.factionName || currentWork.companyName || ""}`;
                    const shouldLog = activityKey !== lastState.currentActivity || lastState.loopCount % 12 === 0;
                    if (shouldLog) {
                        const chance = ns.singularity.getCrimeChance(currentCrime);
                        ui.log(`🔪 Crime in progress: ${currentCrime} (${(chance * 100).toFixed(1)}% success)`, "info");
                        lastState.currentActivity = activityKey;
                    }
                    return;
                }
            }

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

function getMissingCrimeFactions(player) {
    const joined = new Set(player.factions || []);
    return CRIME_FACTIONS.filter(faction => !joined.has(faction));
}

function hasMetAugPrereqs(ns, augName, ownedSet) {
    try {
        const prereqs = ns.singularity.getAugmentationPrereq(augName) || [];
        if (!Array.isArray(prereqs) || prereqs.length === 0) return true;
        return prereqs.every(prereq => ownedSet.has(prereq));
    } catch (e) {
        return true;
    }
}

function getAugmentRepGoal(ns) {
    try {
        const player = ns.getPlayer();
        const currentMoney = ns.getServerMoneyAvailable("home");
        const owned = ns.singularity.getOwnedAugmentations(true);
        const ownedSet = new Set(owned);
        const priorityList = config.augmentations?.augmentPriority || [];

        const candidates = [];
        for (const faction of player.factions || []) {
            if (faction === "NiteSec") continue;

            const factionRep = ns.singularity.getFactionRep(faction);
            const augments = ns.singularity.getAugmentationsFromFaction(faction) || [];

            for (const aug of augments) {
                if (ownedSet.has(aug)) continue;
                if (!hasMetAugPrereqs(ns, aug, ownedSet)) continue;

                const repReq = ns.singularity.getAugmentationRepReq(aug);
                const price = ns.singularity.getAugmentationPrice(aug);
                const repShort = Math.max(0, repReq - factionRep);
                const moneyShort = Math.max(0, price - currentMoney);

                const moneyGapScore = moneyShort > 0 ? Math.log10(moneyShort + 1) : 0;
                const repGapScore = repShort > 0 ? Math.log10(repShort + 1) : 0;
                const gapScore = moneyGapScore + repGapScore;
                const priorityBonus = priorityList.includes(aug) ? 0.15 : 0;
                const effectiveScore = Math.max(0, gapScore - priorityBonus);

                candidates.push({
                    name: aug,
                    faction,
                    repReq,
                    price,
                    repShort,
                    moneyShort,
                    effectiveScore,
                });
            }
        }

        if (candidates.length === 0) return null;

        candidates.sort((a, b) => {
            if (a.effectiveScore !== b.effectiveScore) return a.effectiveScore - b.effectiveScore;

            const aReady = a.moneyShort === 0 && a.repShort === 0;
            const bReady = b.moneyShort === 0 && b.repShort === 0;
            if (aReady !== bReady) return aReady ? -1 : 1;

            if (a.price !== b.price) return a.price - b.price;
            return a.name.localeCompare(b.name);
        });

        return candidates[0];
    } catch (e) {
        return null;
    }
}

/**
 * Check if any faction has actual unowned augments to grind for
 */
function hasAnyViableFactionWork(ns) {
    const augGoal = getAugmentRepGoal(ns);
    if (augGoal && augGoal.repShort > 0) {
        return true;
    }

    const player = ns.getPlayer();

    for (const faction of player.factions) {
        if (faction === "NiteSec") {
            continue;
        }
        const summary = getFactionOpportunitySummary(ns, faction);
        if (summary.grindableCount > 0) {
            return true;
        }
    }

    return false;  // No faction has viable work
}

/**
 * Commit a crime and wait for completion
 */
async function doCrime(ns, ui) {
    setActivityMode(ns, "crime");

    // Preferred path: dedicated crime worker handles execution
    if (ns.isRunning(CRIME_SCRIPT, "home")) {
        if (lastState.loopCount % 24 === 0) {
            ui.log(`🔪 Delegated to crime worker`, "info");
        }
        await ns.sleep(5000);
        return;
    }

    // Fallback path: local crime execution if worker is unavailable
    const crime = selectCrime(ns);
    if (!crime) {
        if (lastState.loopCount % 24 === 0) {
            ui.log(`⚠️  No suitable crime found`, "warn");
        }
        await ns.sleep(5000);
        return;
    }

    const duration = ns.singularity.commitCrime(crime, config.crime?.focus || "maximum");
    const chance = ns.singularity.getCrimeChance(crime);
    
    // Only log if crime changed or periodically
    if (crime !== lastState.lastCrimeStarted || lastState.loopCount - lastState.lastActivityChange > 12) {
        ui.log(`🔪 Starting ${crime} | ${(duration / 1000).toFixed(1)}s | ${(chance * 100).toFixed(0)}% success`, "info");
        lastState.lastCrimeStarted = crime;
        lastState.lastActivityChange = lastState.loopCount;
    }
    await ns.sleep(duration + 500);
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

/**
 * Select best crime by expected value (money/time × success chance)
 */
function selectCrime(ns) {
    return getBestCrime(ns).crime || "Shoplift";
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

function getCrimeExpectedValue(ns, crime) {
    try {
        if (!crime) return 0;
        const stats = ns.singularity.getCrimeStats(crime);
        const chance = ns.singularity.getCrimeChance(crime);
        return (stats.money * chance) / Math.max(1, stats.time);
    } catch (e) {
        return 0;
    }
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

function getFactionOpportunitySummary(ns, faction) {
    const currentRep = ns.singularity.getFactionRep(faction);
    const augments = ns.singularity.getAugmentationsFromFaction(faction);
    const owned = new Set(ns.singularity.getOwnedAugmentations(true));

    let grindableCount = 0;
    let grindableValue = 0;
    let maxRepNeeded = 0;

    for (const aug of augments) {
        if (owned.has(aug)) continue;

        const repReq = ns.singularity.getAugmentationRepReq(aug);
        const price = ns.singularity.getAugmentationPrice(aug);
        const repNeeded = Math.max(0, repReq - currentRep);

        if (repNeeded > 0) {
            grindableCount++;
            grindableValue += price;
            if (repNeeded > maxRepNeeded) {
                maxRepNeeded = repNeeded;
            }
        }
    }

    return { grindableCount, grindableValue, maxRepNeeded };
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
