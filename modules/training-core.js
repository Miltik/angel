/**
 * Training Core - Ultra-lightweight training worker
 * Executes gym and university training based on activity mode
 * Zero imports for minimum RAM footprint
 */

const ACTIVITY_MODE_PORT = 6;

export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("💪 Training worker initialized");

    while (true) {
        try {
            const modeRaw = ns.peek(ACTIVITY_MODE_PORT);
            const mode = modeRaw === "NULL PORT DATA" ? "none" : String(modeRaw).toLowerCase();

            if (mode !== "training") {
                await ns.sleep(3000);
                continue;
            }

            // Only take action if we're not already training
            const current = ns.singularity.getCurrentWork();
            const workType = String(current?.type || "").toUpperCase();
            const alreadyTraining = workType === "UNIVERSITY" || workType === "GYM" || workType === "CLASS";
            
            if (!alreadyTraining) {
                await doTrainingLite(ns);
            }

            await ns.sleep(5000);
        } catch (e) {
            if (String(e).includes("ScriptDeath")) return;
            await ns.sleep(5000);
        }
    }
}

/**
 * Lightweight training execution
 * @param {NS} ns
 */
async function doTrainingLite(ns) {
    try {
        const player = ns.getPlayer();
        
        // Default targets
        const targets = { strength: 60, defense: 60, dexterity: 60, agility: 60 };
        
        // Determine training target
        const target = selectTrainingTarget(ns, player, targets);
        
        if (!target) {
            ns.print("⏸️ All training targets met");
            return;
        }
        
        // Ensure in proper city (Sector-12 has good gym + university)
        const currentCity = player.city;
        if (currentCity !== "Sector-12" && currentCity !== "Volhaven") {
            try {
                ns.singularity.travelToCity("Sector-12");
            } catch (e) {
                // Travel failed, continue anyway
            }
        }
        
        let started = false;
        if (target.type === "gym") {
            started = ns.singularity.gymWorkout("Powerhouse Gym", target.stat, false);
            if (started) {
                ns.print(`💪 Training ${target.stat} at gym`);
            }
        } else if (target.type === "university") {
            started = ns.singularity.universityCourse("Rothman University", "Algorithms", false);
            if (started) {
                ns.print(`📚 Taking Algorithms course`);
            }
        }
    } catch (e) {
        ns.print(`⚠️ Training error: ${e}`);
    }
}

/**
 * Select best training target based on current stats
 * @param {NS} ns
 * @param {Object} player
 * @param {Object} targets
 * @returns {Object|null}
 */
function selectTrainingTarget(ns, player, targets) {
    const stats = [
        { name: "strength", value: player.skills.strength, target: targets.strength, type: "gym", stat: "str" },
        { name: "defense", value: player.skills.defense, target: targets.defense, type: "gym", stat: "def" },
        { name: "dexterity", value: player.skills.dexterity, target: targets.dexterity, type: "gym", stat: "dex" },
        { name: "agility", value: player.skills.agility, target: targets.agility, type: "gym", stat: "agi" },
    ];
    
    // Find stat furthest from target
    let needsTraining = stats.filter(s => s.value < s.target);
    if (needsTraining.length === 0) return null;
    
    // Train the lowest stat
    needsTraining.sort((a, b) => a.value - b.value);
    return needsTraining[0];
}
