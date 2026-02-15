/**
 * Crime/Training/Faction automation module
 * Phase-aware activity selector: automatically chooses crime, training, or faction work
 * based on game phase and player needs
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
    ns.print("[Activity] Module started - Intelligent phase-aware activity selector");

    if (!hasSingularityAccess(ns)) {
        ns.print("[Activity] Singularity functions not available (need SF4)");
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

            // Skip if faction work in progress (let factions.js handle it)
            const work = ns.singularity.getCurrentWork();
            if (work && work.type === "FACTION") {
                await ns.sleep(30000);
                continue;
            }

            // Choose best activity for this phase
            const activity = chooseActivity(ns, gamePhase);
            
            // Try to claim activity lock
            if (!claimLock(ns, owner, 180000)) {
                await ns.sleep(10000);
                continue;
            }

            // Execute activity
            switch (activity) {
                case "crime":
                    await doCrime(ns, owner);
                    break;
                case "training":
                    await doTraining(ns, owner);
                    break;
                case "faction":
                    await doFactionWork(ns, owner);
                    break;
                default:
                    releaseLock(ns, owner);
                    await ns.sleep(30000);
            }
            
            releaseLock(ns, owner);
        } catch (e) {
            ns.print(`[Activity] Error: ${e}`);
            await ns.sleep(5000);
        }
    }
}

function chooseActivity(ns, gamePhase) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home");
    const trainingTargets = config.training?.targetStats || { strength: 60, defense: 60, dexterity: 60, agility: 60 };
    
    const needsTraining = player.skills.hacking < config.training.targetHacking ||
                         player.skills.strength < trainingTargets.strength ||
                         player.skills.defense < trainingTargets.defense ||
                         player.skills.dexterity < trainingTargets.dexterity ||
                         player.skills.agility < trainingTargets.agility;
    
    // Phase 0: Get cash, then train
    if (gamePhase === 0) {
        if (money < 10000000) return "crime";
        if (needsTraining) return "training";
        return "crime";
    }
    
    // Phase 1: Train then faction
    if (gamePhase === 1) {
        if (needsTraining) return "training";
        return "faction";
    }
    
    // Phase 2: Faction primary, training if weak
    if (gamePhase === 2) {
        const allStatsGood = player.skills.strength >= trainingTargets.strength &&
                            player.skills.defense >= trainingTargets.defense &&
                            player.skills.dexterity >= trainingTargets.dexterity &&
                            player.skills.agility >= trainingTargets.agility;
        if (!allStatsGood) return "training";
        return "faction";
    }
    
    return "none";
}

async function doCrime(ns, owner) {
    const crime = chooseCrime(ns);
    if (!crime) {
        await ns.sleep(10000);
        return;
    }
    
    const duration = ns.singularity.commitCrime(crime, config.crime.focus);
    ns.print(`[Activity] Crime: ${crime} (${Math.round(duration / 1000)}s)`);
    await ns.sleep(duration + 200);
}

async function doTraining(ns, owner) {
    const trainingTargets = config.training?.targetStats || { strength: 60, defense: 60, dexterity: 60, agility: 60 };
    const player = ns.getPlayer();
    
    let target = null;
    if (player.skills.hacking < config.training.targetHacking) {
        target = { type: "hacking" };
    } else {
        const stats = [
            { stat: "strength", value: player.skills.strength, target: trainingTargets.strength },
            { stat: "defense", value: player.skills.defense, target: trainingTargets.defense },
            { stat: "dexterity", value: player.skills.dexterity, target: trainingTargets.dexterity },
            { stat: "agility", value: player.skills.agility, target: trainingTargets.agility },
        ];
        let lowest = null;
        for (const s of stats) {
            if (s.value < s.target && (!lowest || s.value < lowest.value)) {
                lowest = s;
            }
        }
        if (lowest) target = { type: "gym", stat: lowest.stat };
    }
    
    if (!target) {
        await ns.sleep(30000);
        return;
    }
    
    if (config.training.autoTravel) {
        try {
            ns.singularity.travelToCity(config.training.city);
        } catch (e) {}
    }
    
    if (target.type === "hacking") {
        ns.singularity.universityCourse(config.training.university, config.training.course, config.training.focus);
        ns.print(`[Activity] Training: Hacking`);
    } else {
        ns.singularity.gymWorkout(config.training.gym, target.stat, config.training.focus);
        ns.print(`[Activity] Training: ${target.stat}`);
    }
    await ns.sleep(180000);
}

async function doFactionWork(ns, owner) {
    const player = ns.getPlayer();
    const factions = player.factions.filter(f => f !== \"Bladeburners\");
    
    if (factions.length === 0) {
        await ns.sleep(30000);
        return;
    }
    
    const faction = factions[0];
    const work = ns.singularity.getCurrentWork();
    
    if (!work || work.type !== \"FACTION\" || work.factionName !== faction) {
        ns.singularity.workForFaction(faction, config.factions.workType || \"Hacking Contracts\");
        ns.print(`[Activity] Faction: Working for ${faction}`);
    }
    
    await ns.sleep(180000);
}

function chooseCrime(ns) {
    let bestCrime = null;
    let bestScore = 0;

    for (const crime of config.crime.crimes) {
        const stats = ns.singularity.getCrimeStats(crime);
        const chance = ns.singularity.getCrimeChance(crime);
        if (chance < config.crime.minSuccessChance) continue;
        const score = (stats.money * chance) / Math.max(1, stats.time);
        if (score > bestScore) {
            bestScore = score;
            bestCrime = crime;
        }
    }

    return bestCrime || config.crime.crimes[0];
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
    if (raw === \"NULL PORT DATA\") return null;
    const parts = String(raw).split(\"|\");
    if (parts.length < 2) return null;
    const expires = Number(parts[1]);
    if (Number.isNaN(expires)) return null;
    return { owner: parts[0], expires };
}

function claimLock(ns, owner, ttlMs) {
    const now = Date.now();
    const lock = getLock(ns);
    if (!lock || lock.expires <= now || lock.owner === owner) {
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

