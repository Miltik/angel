/**
 * Training Module - Gym and University automation
 * Handles stat training and skill development
 * 
 * Features:
 * - Automatic stat training (combat stats)
 * - University courses for hacking
 * - Smart training target selection
 * - Travel automation
 * 
 * @module modules/training
 */

import { config } from "/angel/config.js";
import { PORTS } from "/angel/config.js";

/**
 * Execute training based on current stat needs
 * @param {NS} ns
 * @param {Object} ui - UI window API
 * @returns {Promise<boolean>} - True if training was started
 */
export async function doTraining(ns, ui) {
    const targets = config.training?.targetStats || { strength: 60, defense: 60, dexterity: 60, agility: 60 };
    const player = ns.getPlayer();

    // Determine training target
    const target = selectTrainingTarget(ns, player, targets);

    if (!target) {
        return false; // No training needed
    }

    if (config.training?.autoTravel) {
        try {
            ns.singularity.travelToCity(config.training?.city || "Chongqing");
        } catch (e) {
            // Travel failed, continue anyway
        }
    }

    if (target.type === "university") {
        const success = ns.singularity.universityCourse(
            config.training?.university || "Rothman University",
            config.training?.course || "Algorithms",
            config.training?.focus || false
        );

        if (success && ui) {
            ui.log(`📚 Training hacking at ${config.training?.university || "University"}`, "info");
        }
        return success;
    } else {
        const success = ns.singularity.gymWorkout(
            config.training?.gym || "Powerhouse Gym",
            target.stat,
            config.training?.focus || false
        );

        if (success && ui) {
            ui.log(`💪 Training ${target.stat} at gym`, "info");
        }
        return success;
    }
}

/**
 * Select the best training target based on current stats
 * @param {NS} ns
 * @param {Object} player
 * @param {Object} targets - Target stat levels
 * @returns {Object|null} - Training target or null if none needed
 */
function selectTrainingTarget(ns, player, targets) {
    // Check hacking first
    if (player.skills.hacking < (config.training?.targetHacking || 75)) {
        return { type: "university" };
    }

    // Find lowest combat stat below target
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

    if (lowest) {
        return { type: "gym", stat: lowest.name };
    }

    return null; // All stats at target
}

/**
 * Check if training is needed
 * @param {NS} ns
 * @returns {boolean}
 */
export function needsTraining(ns) {
    const player = ns.getPlayer();
    const targets = config.training?.targetStats || { strength: 60, defense: 60, dexterity: 60, agility: 60 };

    if (player.skills.hacking < (config.training?.targetHacking || 75)) {
        return true;
    }

    return player.skills.strength < targets.strength ||
           player.skills.defense < targets.defense ||
           player.skills.dexterity < targets.dexterity ||
           player.skills.agility < targets.agility;
}

/**
 * Get training progress summary
 * @param {NS} ns
 * @returns {Object}
 */
export function getTrainingProgress(ns) {
    const player = ns.getPlayer();
    const targets = config.training?.targetStats || { strength: 60, defense: 60, dexterity: 60, agility: 60 };
    const hackTarget = config.training?.targetHacking || 75;

    return {
        hacking: {
            current: player.skills.hacking,
            target: hackTarget,
            complete: player.skills.hacking >= hackTarget,
        },
        strength: {
            current: player.skills.strength,
            target: targets.strength,
            complete: player.skills.strength >= targets.strength,
        },
        defense: {
            current: player.skills.defense,
            target: targets.defense,
            complete: player.skills.defense >= targets.defense,
        },
        dexterity: {
            current: player.skills.dexterity,
            target: targets.dexterity,
            complete: player.skills.dexterity >= targets.dexterity,
        },
        agility: {
            current: player.skills.agility,
            target: targets.agility,
            complete: player.skills.agility >= targets.agility,
        },
    };
}

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    while (true) {
        try {
            const modeRaw = ns.peek(PORTS.ACTIVITY_MODE);
            const mode = modeRaw === "NULL PORT DATA" ? "none" : String(modeRaw).toLowerCase();

            if (mode !== "training") {
                await ns.sleep(3000);
                continue;
            }

            // Only take action if we're not already in a training work type.
            const current = ns.singularity.getCurrentWork();
            const workType = String(current?.type || "").toUpperCase();
            const alreadyTraining = workType === "UNIVERSITY" || workType === "GYM" || workType === "CLASS";
            if (!alreadyTraining) {
                await doTraining(ns, null);
            }

            await ns.sleep(5000);
        } catch (e) {
            if (String(e).includes("ScriptDeath")) return;
            await ns.sleep(5000);
        }
    }
}
