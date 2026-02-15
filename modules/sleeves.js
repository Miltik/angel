/**
 * Sleeve automation module (phase-aware: active phases 3-4)
 * @param {NS} ns
 */
import { config } from "/angel/config.js";

const PHASE_PORT = 7; // Read game phase from orchestrator

/**
 * Read current game phase from orchestrator
 */
function readGamePhase(ns) {
    return parseInt(ns.peek(PHASE_PORT)) || 0;
}

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.print("[Sleeves] Module started");

    // Sleeves only active in phases 3-4 (late game)
    while (true) {
        const gamePhase = readGamePhase(ns);
        if (gamePhase < 3) {
            ns.print("[Sleeves] Waiting for phase 3+ to enable sleeves automation");
            await ns.sleep(60000);
            continue;
        }
        break;
    }

    if (!hasSleeves(ns)) {
        ns.print("[Sleeves] No sleeves unlocked yet");
        while (true) {
            await ns.sleep(60000);
        }
    }

    while (true) {
        try {
            const count = ns.sleeve.getNumSleeves();
            for (let i = 0; i < count; i++) {
                manageSleeve(ns, i);
            }
            await ns.sleep(30000);
        } catch (e) {
            ns.print(`[Sleeves] Error: ${e}`);
            await ns.sleep(5000);
        }
    }
}

function hasSleeves(ns) {
    try {
        return ns.sleeve.getNumSleeves() > 0;
    } catch (e) {
        return false;
    }
}

function manageSleeve(ns, i) {
    const info = ns.sleeve.getSleeveStats(i);
    const mode = config.sleeves.mode;

    if (config.sleeves.recoverShock && info.shock > config.sleeves.maxShock) {
        ns.sleeve.setToShockRecovery(i);
        ns.print(`[Sleeves] Sleeve ${i} recovering shock (${info.shock.toFixed(1)})`);
        return;
    }

    if (mode === "crime") {
        ns.sleeve.setToCommitCrime(i, config.sleeves.crime);
        return;
    }

    if (mode === "faction") {
        if (tryFactionWork(ns, i)) return;
        ns.sleeve.setToCommitCrime(i, config.sleeves.fallbackCrime);
        return;
    }

    if (mode === "training" || mode === "balanced") {
        if (info.hacking < config.sleeves.targetHacking) {
            ns.sleeve.setToUniversityCourse(i, config.sleeves.university, config.sleeves.course);
            return;
        }

        const stat = lowestCombatStat(info, config.sleeves.targetStats);
        if (stat) {
            ns.sleeve.setToGymWorkout(i, config.sleeves.gym, stat);
            return;
        }

        if (mode === "training") {
            ns.sleeve.setToCommitCrime(i, config.sleeves.fallbackCrime);
            return;
        }
    }

    ns.sleeve.setToCommitCrime(i, config.sleeves.crime);
}

function lowestCombatStat(info, targets) {
    const stats = [
        { name: "strength", value: info.strength, target: targets.strength },
        { name: "defense", value: info.defense, target: targets.defense },
        { name: "dexterity", value: info.dexterity, target: targets.dexterity },
        { name: "agility", value: info.agility, target: targets.agility },
    ];

    let lowest = null;
    for (const stat of stats) {
        if (stat.value < stat.target) {
            if (!lowest || stat.value < lowest.value) {
                lowest = stat;
            }
        }
    }

    return lowest ? lowest.name : null;
}

function tryFactionWork(ns, i) {
    const player = ns.getPlayer();
    for (const faction of config.sleeves.factionPriority) {
        if (!player.factions.includes(faction)) continue;
        const ok = ns.sleeve.setToFactionWork(i, faction, config.sleeves.factionWorkType);
        if (ok) {
            return true;
        }
    }
    return false;
}
