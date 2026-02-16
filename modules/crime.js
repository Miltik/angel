/**
 * ANGEL Activity + Faction Module
 * Unified singularity automation: crime, training, faction, company work
 * + Faction reputation management and augment tracking
 * 
 * Phase-aware: Intelligent activity selection (P0-2)
 * Always-on: Faction invitations and rep tracking
 * 
 * @param {NS} ns
 */
import { config, PORTS } from "/angel/config.js";
import { formatMoney, log } from "/angel/utils.js";

const PHASE_PORT = 7;
const ACTIVITY_OWNER = "activity";
const ACTIVITY_LOCK_TTL = 180000;

/**
 * Read current game phase from orchestrator, with validation
 */
function readGamePhase(ns) {
    const phasePortData = ns.peek(PHASE_PORT);
    if (phasePortData === "NULL PORT DATA") {
        // No phase signal yet - estimate based on player state
        return estimatePhaseFromStats(ns);
    }
    
    const phase = parseInt(phasePortData) || 0;
    
    // SAFETY CHECK: If port says phase 3+ but player is clearly early game, override
    if (phase >= 3 && isEarlyGame(ns)) {
        ns.print(`[PHASE OVERRIDE] Port said phase ${phase} but player is early game - using phase 0`);
        return 0;
    }
    
    return phase;
}

/**
 * Estimate phase from player stats if no orchestrator signal
 */
function estimatePhaseFromStats(ns) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home") + player.money;
    
    // Bootstrap phase: < $10M
    if (money < 10000000) return 0;
    if (money < 100000000) return 1;
    if (money < 500000000) return 2;
    
    // Past bootstrap - likely in gang/hacking phases
    return 3;
}

/**
 * Check if character is clearly still early game
 */
function isEarlyGame(ns) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home") + player.money;
    const hack = player.skills.hacking;
    
    // Early game markers: Low money, low hacking
    return money < 100000000 && hack < 300;
}

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    log(ns, "🎭 Activity + Faction module started (P0-2 activity, all-phase factions)", "INFO");

    if (!hasSingularityAccess(ns)) {
        log(ns, "🎭 Singularity access not available - need SF4", "WARN");
        while (true) {
            await ns.sleep(60000);
        }
    }

    log(ns, "🎭 Singularity access confirmed", "SUCCESS");

    let loopCount = 0;
    while (true) {
        try {
            const gamePhase = readGamePhase(ns);
            loopCount++;

            // ALWAYS log every iteration for DEBUG
            ns.print(`[LOOP ${loopCount}] Phase: ${gamePhase}, Checking activity...`);

            // Faction management: ALWAYS ACTIVE (all phases)
            await manageFactions(ns);
            ns.print(`[LOOP ${loopCount}] After manageFactions`);

            // Activity work: ONLY PHASES 0-2
            if (gamePhase <= 2) {
                ns.print(`[LOOP ${loopCount}] Phase <= 2, calling processActivity`);
                await processActivity(ns, gamePhase);
                ns.print(`[LOOP ${loopCount}] After processActivity`);
            } else {
                // Phases 3+: Activity module sleeps (hacking focus)
                ns.print(`[LOOP ${loopCount}] Phase ${gamePhase} > 2, sleeping (hacking phase)`);
                await ns.sleep(30000);
            }

            ns.print(`[LOOP ${loopCount}] End of iteration, sleeping 5s`);
            await ns.sleep(5000);
        } catch (e) {
            log(ns, `🎭 Loop error: ${e}`, "ERROR");
            ns.print(`[LOOP ERROR] ${e}`);
            await ns.sleep(5000);
        }
    }
}

/**
 * FACTION MANAGEMENT: Always active
 * Tracks faction rep, handles invitations, displays status
 */
async function manageFactions(ns) {
    const player = ns.getPlayer();
    const currentFactions = player.factions;
    const invitations = ns.singularity.checkFactionInvitations();

    // Auto-join priority factions
    if (config.factions?.autoJoinFactions && invitations.length > 0) {
        const priorityFactions = config.factions.priorityFactions || [];
        for (const faction of invitations) {
            if (priorityFactions.includes(faction)) {
                ns.singularity.joinFaction(faction);
                log(ns, `🎭 Joined faction: ${faction}`, "SUCCESS");
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
        log(ns, `🎭 Factions: ${statusLines.join(" | ")}`, "DEBUG");
    }

    // Show pending invitations
    if (invitations.length > 0) {
        log(ns, `🎭 Pending invitations: ${invitations.join(", ")}`, "WARN");
    }
}

/**
 * ACTIVITY PROCESSING: Phases 0-2 only
 * Chooses and executes best activity (crime, training, faction, company)
 */
async function processActivity(ns, gamePhase) {
    // Check if already working on something
    const currentWork = ns.singularity.getCurrentWork();
    if (currentWork) {
        log(ns, `🎭 [P${gamePhase}] Current work: ${currentWork.type} (${currentWork.taskName || currentWork.factionName || ""})`, "DEBUG");
        return;
    }

    // Determine best activity for this phase
    const activity = chooseActivity(ns, gamePhase);
    log(ns, `🎭 [P${gamePhase}] Activity chosen: ${activity}`, "INFO");

    if (activity === "none") {
        log(ns, `🎭 [P${gamePhase}] No activity needed`, "DEBUG");
        return;
    }

    // Try to acquire activity lock (prevent conflicts)
    if (!claimLock(ns, ACTIVITY_OWNER, ACTIVITY_LOCK_TTL)) {
        log(ns, `🎭 [P${gamePhase}] Lock held by another module, skipping`, "DEBUG");
        return;
    }

    try {
        log(ns, `🎭 [P${gamePhase}] Starting: ${activity}`, "INFO");

        if (activity === "crime") {
            await doCrime(ns);
        } else if (activity === "training") {
            await doTraining(ns);
        } else if (activity === "faction") {
            await doFactionWork(ns);
        } else if (activity === "company") {
            await doCompanyWork(ns);
        }
    } catch (err) {
        log(ns, `🎭 Error during ${activity}: ${err}`, "ERROR");
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
async function doCrime(ns) {
    const crime = selectCrime(ns);
    if (!crime) {
        log(ns, `🎭 Crime: No suitable crime found`, "WARN");
        await ns.sleep(5000);
        return;
    }

    const stats = ns.singularity.getCrimeStats(crime);
    const duration = ns.singularity.commitCrime(crime, config.crime?.focus || "maximum");
    log(ns, `🎭 Crime: ${crime} | Duration: ${(duration / 1000).toFixed(1)}s | %: ${(ns.singularity.getCrimeChance(crime) * 100).toFixed(0)}%`, "INFO");
    await ns.sleep(duration + 500);
}

/**
 * Train stats or hacking
 */
async function doTraining(ns) {
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
        log(ns, `🎭 Training: All stats maxed - doing crime instead`, "DEBUG");
        await doCrime(ns);
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
        log(ns, `🎭 Training: Hacking at ${config.training?.university || "University"}`, "INFO");
    } else {
        ns.singularity.gymWorkout(
            config.training?.gym || "Powerhouse Gym",
            target.stat,
            config.training?.focus || "maximum"
        );
        log(ns, `🎭 Training: ${target.stat} at gym`, "INFO");
    }

    await ns.sleep(180000);
}

/**
 * Work for a faction
 */
async function doFactionWork(ns) {
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
        log(ns, `🎭 Faction: No valid factions - doing crime instead`, "DEBUG");
        await doCrime(ns);
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
        log(ns, `🎭 Faction: All factions satisfied - doing crime instead`, "DEBUG");
        await doCrime(ns);
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
    log(ns, `🎭 Faction: Working for ${bestFaction} (${workType}) | Rep needed: ${Math.floor(mostNeeded)}`, "INFO");

    await ns.sleep(180000);
}

/**
 * Work for a company
 */
async function doCompanyWork(ns) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home");
    const threshold = config.company?.onlyWhenMoneyBelow || 200000000;

    if (money >= threshold) {
        log(ns, `🎭 Company: Money above threshold (${formatMoney(money)}/${formatMoney(threshold)}) - doing crime instead`, "DEBUG");
        await doCrime(ns);
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
                log(ns, `🎭 Company: Working for ${company} | Money: ${formatMoney(money)}/${formatMoney(threshold)}`, "INFO");
                placed = true;
                break;
            }
        } catch (e) {}
    }

    if (!placed) {
        log(ns, `🎭 Company: No positions available - doing crime instead`, "WARN");
        await doCrime(ns);
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
