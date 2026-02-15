/**
 * ANGEL Activity Module
 * Unified singularity automation: crime, training, faction, company work
 * Intelligently selects best activity for current game phase
 * @param {NS} ns
 */
import { config, PORTS } from "/angel/config.js";

const PHASE_PORT = 7;

function readGamePhase(ns) {
    return parseInt(ns.peek(PHASE_PORT)) || 0;
}

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.print("[Activity] Unified activity module started (crime/training/faction/company)");

    if (!hasSingularityAccess(ns)) {
        ns.print("[Activity] Singularity functions not available - need SF4");
        while (true) {
            await ns.sleep(60000);
        }
    }

    const owner = "activity";

    while (true) {
        try {
            const gamePhase = readGamePhase(ns);
            
            // Only active in phases 0-2
            if (gamePhase >= 3) {
                await ns.sleep(30000);
                continue;
            }

            // Skip if faction work in progress (factions.js handles it)
            const work = ns.singularity.getCurrentWork();
            if (work && work.type === "FACTION") {
                await ns.sleep(30000);
                continue;
            }

            // Determine best activity for this phase
            const activity = chooseActivity(ns, gamePhase);
            
            // Try to acquire lock
            if (!claimLock(ns, owner, 180000)) {
                await ns.sleep(10000);
                continue;
            }

            // Execute activity
            try {
                if (activity === "crime") {
                    await doCrime(ns);
                } else if (activity === "training") {
                    await doTraining(ns);
                } else if (activity === "faction") {
                    await doFactionWork(ns);
                } else if (activity === "company") {
                    await doCompanyWork(ns);
                } else {
                    await ns.sleep(30000);
                }
            } catch (err) {
                ns.print(`[Activity] Error during ${activity}: ${err}`);
                await ns.sleep(5000);
            }

            releaseLock(ns, owner);
        } catch (e) {
            ns.print(`[Activity] Loop error: ${e}`);
            await ns.sleep(5000);
        }
    }
}

function chooseActivity(ns, gamePhase) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home");
    const targets = config.training?.targetStats || { strength: 60, defense: 60, dexterity: 60, agility: 60 };
    
    const needsTraining = player.skills.hacking < config.training.targetHacking ||
                         player.skills.strength < targets.strength ||
                         player.skills.defense < targets.defense ||
                         player.skills.dexterity < targets.dexterity ||
                         player.skills.agility < targets.agility;
    
    if (gamePhase === 0) {
        // Phase 0: Bootstrap - prioritize cash, then train
        if (money < 10000000) return "crime";
        if (needsTraining) return "training";
        return "crime";
    }
    
    if (gamePhase === 1) {
        // Phase 1: Early - prioritize faction, training backup
        if (needsTraining) return "training";
        if (money < config.company?.onlyWhenMoneyBelow) return "company";
        return "faction";
    }
    
    if (gamePhase === 2) {
        // Phase 2: Mid - faction primary, company/training backup
        const allGood = player.skills.strength >= targets.strength &&
                       player.skills.defense >= targets.defense &&
                       player.skills.dexterity >= targets.dexterity &&
                       player.skills.agility >= targets.agility;
        
        if (!allGood) return "training";
        if (money < config.company?.onlyWhenMoneyBelow) return "company";
        return "faction";
    }
    
    return "none";
}

async function doCrime(ns) {
    const crime = selectCrime(ns);
    if (!crime) {
        await ns.sleep(5000);
        return;
    }
    
    const stats = ns.singularity.getCrimeStats(crime);
    const duration = ns.singularity.commitCrime(crime, config.crime?.focus || "maximum");
    ns.print(`[Activity] Crime: ${crime} for ${Math.round(duration / 1000)}s`);
    await ns.sleep(duration + 500);
}

async function doTraining(ns) {
    const targets = config.training?.targetStats || { strength: 60, defense: 60, dexterity: 60, agility: 60 };
    const player = ns.getPlayer();
    
    // Determine training target
    let target = null;
    if (player.skills.hacking < config.training?.targetHacking) {
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
        await ns.sleep(30000);
        return;
    }
    
    if (config.training?.autoTravel) {
        try {
            ns.singularity.travelToCity(config.training?.city || "Chongqing");
        } catch (e) {}
    }
    
    if (target.type === "university") {
        ns.singularity.universityCourse(
            config.training?.university || "Noodle Bar",
            config.training?.course || "Data Structures",
            config.training?.focus || "maximum"
        );
        ns.print("[Activity] Training: Hacking at university");
    } else {
        ns.singularity.gymWorkout(
            config.training?.gym || "Powerhouse Gym",
            target.stat,
            config.training?.focus || "maximum"
        );
        ns.print(`[Activity] Training: ${target.stat} at gym`);
    }
    
    await ns.sleep(180000);
}

async function doFactionWork(ns) {
    const player = ns.getPlayer();
    const factions = player.factions.filter(f => f !== "Bladeburners");
    
    if (factions.length === 0) {
        await ns.sleep(30000);
        return;
    }
    
    const faction = factions[0];
    const work = ns.singularity.getCurrentWork();
    
    if (!work || work.type !== "FACTION" || work.factionName !== faction) {
        const workType = config.factions?.workType || "Hacking Contracts";
        ns.singularity.workForFaction(faction, workType);
        ns.print(`[Activity] Faction: ${faction} (${workType})`);
    }
    
    await ns.sleep(180000);
}

async function doCompanyWork(ns) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home");
    
    if (money >= config.company?.onlyWhenMoneyBelow) {
        await ns.sleep(30000);
        return;
    }
    
    const work = ns.singularity.getCurrentWork();
    if (work && work.type === "COMPANY") {
        // Already working for company
        await ns.sleep(180000);
        return;
    }
    
    if (config.training?.autoTravel) {
        try {
            ns.singularity.travelToCity("Chongqing");
        } catch (e) {}
    }
    
    // Find a company with a job
    const companies = ["ECorp", "MegaCorp", "Bachman & Associates", "Blade Industries", "NWO"];
    let placed = false;
    
    for (const company of companies) {
        try {
            const success = ns.singularity.workForCompany(company, config.company?.focus || "maximum");
            if (success) {
                ns.print(`[Activity] Company: Working for ${company}`);
                placed = true;
                break;
            }
        } catch (e) {}
    }
    
    if (!placed) {
        ns.print("[Activity] No company work available");
    }
    
    await ns.sleep(180000);
}

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

function hasSingularityAccess(ns) {
    try {
        ns.singularity.getCurrentWork();
        return true;
    } catch (e) {
        return false;
    }
}

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

function releaseLock(ns, station) {
    const lock = getLock(ns);
    if (lock && lock.owner === station) {
        ns.clearPort(PORTS.ACTIVITY);
    }
}
