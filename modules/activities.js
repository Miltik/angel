/**
 * ANGEL Activities Module
 * Unified activity automation: crime, training, faction, company work
 * + Faction reputation management and augment tracking
 * 
 * Phase-aware dual-mode operation:
 * - P0-2: Active activity selection (crime/training/faction/company)
 * - P3+: Filler crime when lock is free (statpadding between other activities)
 * - Always: Faction tracking and auto-join
 * 
 * @param {NS} ns
 */
import { config, PORTS } from "/angel/config.js";
import { formatMoney } from "/angel/utils.js";
import { createWindow } from "/angel/modules/uiManager.js";

const PHASE_PORT = 7;
const ACTIVITY_OWNER = "activity";
const ACTIVITY_LOCK_TTL = 180000;

/**
 * Read current game phase from orchestrator, with validation
 * CRIME MODULE: Hardcoded to determine phase locally, ignore port 7 for early game
 */
function readGamePhase(ns) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home") + player.money;
    const hack = player.skills.hacking;
    
    // CRIME MODULE PHASE LOGIC (overrides port 7):
    // P0: Bootstrap - money < $10M
    if (money < 10000000) {
        return 0;
    }
    
    // P1: Early - money $10M-$100M OR hacking < 200
    if (money < 100000000 || hack < 200) {
        return 1;
    }
    
    // P2: Mid - money $100M-$500M
    if (money < 500000000) {
        return 2;
    }
    
    // P3+: Late - money > $500M (hacking focused, crime module idles)
    return 3;
}

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("activities", "🎭 Activities", 700, 450, ns);
    ui.log("Activities module started (P0-2 active, P3+ filler, all-phase factions)", "info");

    if (!hasSingularityAccess(ns)) {
        ui.log("Singularity access not available - need SF4", "warn");
        while (true) {
            await ns.sleep(60000);
        }
    }

    ui.log("Singularity access confirmed", "success");

    let loopCount = 0;
    while (true) {
        try {
            const gamePhase = readGamePhase(ns);
            loopCount++;

            // Show phase every 12 loops (~60 seconds)
            if (loopCount % 12 === 1) {
                const player = ns.getPlayer();
                const money = ns.getServerMoneyAvailable("home") + player.money;
                ui.log(`--- Phase: ${gamePhase} (Money: $${(money / 1e9).toFixed(2)}B) ---`, "info");
            }

            // Faction management: ALWAYS ACTIVE (all phases)
            await manageFactions(ns, ui);

            // Activity work: PHASES 0-2 (active), PHASES 3+ (filler only)
            if (gamePhase <= 2) {
                // P0-2: Active crime/training/faction/company
                await processActivity(ns, gamePhase, ui);
            } else if (gamePhase >= 3) {
                // P3+: Crime only as filler when activity lock is free
                // This allows padding stats during idle moments without blocking other activities
                await processFillerCrime(ns, gamePhase, ui);
            }

            await ns.sleep(5000);
        } catch (e) {
            ui.log(`Loop error: ${e}`, "error");
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
    const currentFactions = player.factions;
    const invitations = ns.singularity.checkFactionInvitations();

    // Auto-join priority factions
    if (config.factions?.autoJoinFactions && invitations.length > 0) {
        const priorityFactions = config.factions.priorityFactions || [];
        for (const faction of invitations) {
            if (priorityFactions.includes(faction)) {
                ns.singularity.joinFaction(faction);
                ui.log(`Joined faction: ${faction}`, "success");
            }
        }
    }

    // Display faction status and pending work
    if (currentFactions.length > 0) {
        const statusLines = [];
        for (const faction of currentFactions) {
            const rep = ns.singularity.getFactionRep(faction);
            const repNeeded = getRepNeeded(ns, faction);
            statusLines.push(`${faction}:${Math.floor(rep)}/${Math.floor(repNeeded)}`);
        }
        ui.log(`Factions: ${statusLines.join(" | ")}`, "debug");
    }

    // Show pending invitations
    if (invitations.length > 0) {
        ui.log(`Pending invitations: ${invitations.join(", ")}`, "warn");
    }

    // Check current work to see if faction work is happening
    const currentWork = ns.singularity.getCurrentWork();
    if (currentWork && currentWork.type === "FACTION") {
        ui.log(`[Ongoing] Faction work: ${currentWork.factionName} (${currentWork.workType})`, "debug");
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
        // Display what's in progress and why we're skipping
        if (currentWork.type === "CRIME") {
            const crime = currentWork.crimeType;
            const chance = ns.singularity.getCrimeChance(crime);
            ui.log(`[P${gamePhase}] Crime in progress: ${crime} (${(chance * 100).toFixed(1)}%)`, "info");
        } else if (currentWork.type === "FACTION") {
            ui.log(`[P${gamePhase}] Faction work: ${currentWork.factionName} (${currentWork.workType})`, "info");
        } else if (currentWork.type === "COMPANY") {
            ui.log(`[P${gamePhase}] Company work: ${currentWork.companyName}`, "info");
        } else if (currentWork.type === "UNIVERSITY" || currentWork.type === "GYM") {
            ui.log(`[P${gamePhase}] Training: ${currentWork.type}`, "info");
        } else {
            ui.log(`[P${gamePhase}] Activity in progress: ${currentWork.type}`, "debug");
        }
        return;
    }

    // Determine best activity for this phase
    const activity = chooseActivity(ns, gamePhase);

    if (activity === "none") {
        ui.log(`[P${gamePhase}] No activity chosen`, "debug");
        return;
    }

    // Try to acquire activity lock (prevent conflicts)
    if (!claimLock(ns, ACTIVITY_OWNER, ACTIVITY_LOCK_TTL)) {
        ui.log(`[P${gamePhase}] Activity lock held, skipping`, "debug");
        return;
    }

    try {
        ui.log(`[P${gamePhase}] Starting: ${activity}`, "info");

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
        ui.log(`Error during ${activity}: ${err}`, "error");
    }

    releaseLock(ns, ACTIVITY_OWNER);
}

/**
 * FILLER CRIME: Phases 3+ only
 * Do brief crimes when activity lock is free (statpadding only)
 */
async function processFillerCrime(ns, gamePhase, ui) {
    // Check if already working on something
    const currentWork = ns.singularity.getCurrentWork();
    if (currentWork) {
        if (currentWork.type === "CRIME") {
            // Display current crime progress
            const crime = currentWork.crimeType;
            const chance = ns.singularity.getCrimeChance(crime);
            ui.log(`[P${gamePhase}] Crime in progress: ${crime} (${(chance * 100).toFixed(1)}%)`, "info");
        } else {
            ui.log(`[P${gamePhase}] Activity in progress: ${currentWork.type}`, "debug");
        }
        return; // Already working on something, skip
    }

    // Try to acquire activity lock (only if free - don't wait)
    if (!claimLock(ns, ACTIVITY_OWNER, ACTIVITY_LOCK_TTL)) {
        ui.log(`[P${gamePhase}] Filler skipped: Lock held`, "debug");
        // Lock held by another module (faction work, etc), skip
        return;
    }

    try {
        ui.log(`[P${gamePhase}] Filler: Committing crime`, "info");
        // Do a quick crime for stat padding
        await doCrime(ns, ui);
    } catch (err) {
        ui.log(`Error during filler crime: ${err}`, "error");
    }

    releaseLock(ns, ACTIVITY_OWNER);
}

/**
 * Choose best activity based on phase and player state
 */
function chooseActivity(ns, gamePhase) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home");
    const targets = config.training?.targetStats || { strength: 60, defense: 60, dexterity: 60, agility: 60 };

    const needsTraining = 
        player.skills.hacking < (config.training?.targetHacking || 75) ||
        player.skills.strength < targets.strength ||
        player.skills.defense < targets.defense ||
        player.skills.dexterity < targets.dexterity ||
        player.skills.agility < targets.agility;

    // Check if any faction actually has viable work (not just gang-only like Nitesec)
    const hasViableFactionWork = hasAnyViableFactionWork(ns);

    // Phase 0: Bootstrap - prioritize cash, then training
    if (gamePhase === 0) {
        if (money < 10000000) return "crime";
        if (needsTraining) return "training";
        return "crime";
    }

    // Phase 1: Early - prioritize faction if work available, training, then company
    if (gamePhase === 1) {
        if (needsTraining) return "training";
        const companyThreshold = config.company?.onlyWhenMoneyBelow || 200000000;
        if (money < companyThreshold) return "company";
        if (hasViableFactionWork) return "faction";
        return "crime";  // Fallback: crime for money/stats if no faction work
    }

    // Phase 2: Mid - faction primary if available, company/training backup, else crime
    if (gamePhase === 2) {
        const allTrained = 
            player.skills.strength >= targets.strength &&
            player.skills.defense >= targets.defense &&
            player.skills.dexterity >= targets.dexterity &&
            player.skills.agility >= targets.agility;

        if (!allTrained) return "training";
        const companyThreshold = config.company?.onlyWhenMoneyBelow || 200000000;
        if (money < companyThreshold) return "company";
        if (hasViableFactionWork) return "faction";
        return "crime";  // Fallback: crime if no faction work available
    }

    return "none";
}

/**
 * Check if any faction has actual unowned augments to grind for
 */
function hasAnyViableFactionWork(ns) {
    const player = ns.getPlayer();
    const owned = ns.singularity.getOwnedAugmentations(true);

    for (const faction of player.factions) {
        // Skip gang-only factions (Netburners, NiteSec - can't gain rep from work)
        if (faction === "NiteSec" || faction === "Netburners" || faction === "Bladeburners") {
            continue;
        }

        const augments = ns.singularity.getAugmentationsFromFaction(faction);
        
        // Check if ANY augment in this faction is unowned
        for (const aug of augments) {
            if (!owned.includes(aug)) {
                return true;  // Found at least one unowned augment
            }
        }
    }

    return false;  // No faction has viable work
}

/**
 * Commit a crime and wait for completion
 */
async function doCrime(ns, ui) {
    const crime = selectCrime(ns);
    if (!crime) {
        ui.log(`Crime: No suitable crime found`, "warn");
        await ns.sleep(5000);
        return;
    }

    const stats = ns.singularity.getCrimeStats(crime);
    const duration = ns.singularity.commitCrime(crime, config.crime?.focus || "maximum");
    ui.log(`Crime: ${crime} | Duration: ${(duration / 1000).toFixed(1)}s | %: ${(ns.singularity.getCrimeChance(crime) * 100).toFixed(0)}%`, "info");
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
        ui.log(`Training: All stats maxed - doing crime instead`, "debug");
        await doCrime(ns, ui);
        return;
    }

    if (config.training?.autoTravel) {
        try {
            ns.singularity.travelToCity(config.training?.city || "Chongqing");
        } catch (e) {}
    }

    if (target.type === "university") {
        ns.singularity.universityCourse(
            config.training?.university || "Rothman University",
            config.training?.course || "Algorithms",
            config.training?.focus || "maximum"
        );
        ui.log(`Training: Hacking at ${config.training?.university || "University"}`, "info");
    } else {
        ns.singularity.gymWorkout(
            config.training?.gym || "Powerhouse Gym",
            target.stat,
            config.training?.focus || "maximum"
        );
        ui.log(`Training: ${target.stat} at gym`, "info");
    }

    await ns.sleep(180000);
}

/**
 * Work for a faction
 */
async function doFactionWork(ns, ui) {
    const player = ns.getPlayer();
    const owned = ns.singularity.getOwnedAugmentations(true);

    // Filter to factions with actual unowned augments
    const factions = player.factions.filter(f => {
        if (f === "NiteSec" || f === "Netburners" || f === "Bladeburners") {
            return false;  // Skip gang-only factions
        }
        const augments = ns.singularity.getAugmentationsFromFaction(f);
        return augments.some(aug => !owned.includes(aug));  // Must have unowned augs
    });

    if (factions.length === 0) {
        ui.log(`Faction: No valid factions - doing crime instead`, "debug");
        await doCrime(ns, ui);
        return;
    }

    // Find faction with most rep needed
    let bestFaction = null;
    let mostNeeded = 0;

    for (const faction of factions) {
        const repNeeded = getRepNeeded(ns, faction);
        if (repNeeded > mostNeeded) {
            mostNeeded = repNeeded;
            bestFaction = faction;
        }
    }

    if (!bestFaction || mostNeeded <= 0) {
        ui.log(`Faction: All factions satisfied - doing crime instead`, "debug");
        await doCrime(ns, ui);
        return;
    }

    const currentWork = ns.singularity.getCurrentWork();
    if (currentWork && currentWork.type === "FACTION" && currentWork.factionName === bestFaction) {
        // Already working on best faction
        await ns.sleep(180000);
        return;
    }

    const workType = config.factions?.workType || "Hacking Contracts";
    ns.singularity.workForFaction(bestFaction, workType);
    ui.log(`Faction: Working for ${bestFaction} (${workType}) | Rep needed: ${Math.floor(mostNeeded)}`, "info");

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
        ui.log(`Company: Money above threshold (${formatMoney(money)}/${formatMoney(threshold)}) - doing crime instead`, "debug");
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
                ui.log(`Company: Working for ${company} | Money: ${formatMoney(money)}/${formatMoney(threshold)}`, "info");
                placed = true;
                break;
            }
        } catch (e) {}
    }

    if (!placed) {
        ui.log(`Company: No positions available - doing crime instead`, "warn");
        await doCrime(ns, ui);
        return;
    }

    await ns.sleep(180000);
}

/**
 * Select best crime based on profitability and success chance
 */
function selectCrime(ns) {
    let best = null;
    let bestScore = 0;

    const crimes = config.crime?.crimes || ["Shoplift", "Rob Store", "Mug Someone", "Larceny"];

    for (const crime of crimes) {
        try {
            const stats = ns.singularity.getCrimeStats(crime);
            const chance = ns.singularity.getCrimeChance(crime);

            if (chance < (config.crime?.minSuccessChance || 0.5)) continue;

            const score = (stats.money * chance) / Math.max(1, stats.time);
            if (score > bestScore) {
                bestScore = score;
                best = crime;
            }
        } catch (e) {}
    }

    return best || crimes[0];
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

function releaseLock(ns, owner) {
    const lock = getLock(ns);
    if (lock && lock.owner === owner) {
        ns.clearPort(PORTS.ACTIVITY);
    }
}
