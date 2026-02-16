/**
 * Sleeve automation module (phase-aware: active in phases 3-4)
 * Delegates criminal/training work to sleeves while main character focuses on hacking
 * 
 * @param {NS} ns
 */
import { config } from "/angel/config.js";
import { createWindow } from "/angel/modules/uiManager.js";

const PHASE_PORT = 7;

// State tracking
let lastState = {
    phase: null,
    summary: null,
    loopCount: 0
};

/**
 * Read current game phase from orchestrator
 */
function readGamePhase(ns) {
    const phasePortData = ns.peek(PHASE_PORT);
    if (phasePortData === "NULL PORT DATA") return 0;
    return parseInt(phasePortData) || 0;
}

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("sleeves", "👨‍👨‍👧‍👦 Sleeves", 700, 400, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ui.log("👨‍👨‍👧‍👦 Sleeve automation initialized (P3+ gated)", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Wait for phase 3+ (when sleeves are needed for delegation work)
    while (true) {
        const gamePhase = readGamePhase(ns);
        if (gamePhase >= 3) break;
        if (lastState.loopCount % 4 === 0) {
            ui.log(`⏰ Waiting for phase 3+ (currently P${gamePhase})`, "info");
        }
        lastState.loopCount++;
        await ns.sleep(60000);
    }

    if (!hasSleeves(ns)) {
        ui.log("⚠️  No sleeves unlocked - entering idle mode", "warn");
        while (true) {
            await ns.sleep(60000);
        }
    }

    ui.log("✅ Sleeves active - starting automation", "success");

    while (true) {
        try {
            const gamePhase = readGamePhase(ns);
            if (gamePhase < 3) {
                if (lastState.phase !== "paused") {
                    ui.log("⏸️ Phase dropped below 3 - pausing automation", "warn");
                    lastState.phase = "paused";
                }
                await ns.sleep(60000);
                continue;
            }

            const count = ns.sleeve.getNumSleeves();
            let summary = { trained: 0, working: 0, recovering: 0 };
            
            for (let i = 0; i < count; i++) {
                const status = manageSleeve(ns, i, gamePhase);
                summary[status]++;
            }
            
            lastState.loopCount++;
            printStatus(ui, count, summary, gamePhase, lastState);
            await ns.sleep(30000);
        } catch (e) {
            ui.log(`❌ Error: ${e}`, "error");
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

/**
 * Manage a single sleeve - returns status category
 */
function manageSleeve(ns, i, gamePhase) {
    const info = ns.sleeve.getSleeveStats(i);
    const maxShock = config.sleeves.maxShock || 25;
    const targetStats = config.sleeves.targetStats || { strength: 100, defense: 100, dexterity: 100, agility: 100 };

    // Priority 1: Recover from shock
    if (info.shock > maxShock) {
        ns.sleeve.setToShockRecovery(i);
        return "recovering";
    }

    // Priority 2: Check if sleeves need training or work
    // Phase 3: Start heavy training
    // Phase 4: Transition to money work if trained
    const allTrained = info.strength >= targetStats.strength &&
                       info.defense >= targetStats.defense &&
                       info.dexterity >= targetStats.dexterity &&
                       info.agility >= targetStats.agility;

    if (!allTrained && gamePhase <= 3) {
        // Phase 3 or below: prioritize training
        if (info.hacking < (config.sleeves.targetHacking || 100)) {
            ns.sleeve.setToUniversityCourse(i, config.sleeves.university || "Rothman University", "Algorithms");
            return "trained";
        }

        // Train lowest combat stat
        const stat = lowestCombatStat(info, targetStats);
        if (stat) {
            const gym = config.sleeves.gym || "Powerhouse Gym";
            ns.sleeve.setToGymWorkout(i, gym, stat);
            return "trained";
        }
    }

    // Priority 3: Faction work if available
    if (tryFactionWork(ns, i)) {
        return "working";
    }

    // Fallback: Crime work
    const crime = config.sleeves.fallbackCrime || "Mug someone";
    ns.sleeve.setToCommitCrime(i, crime);
    return "working";
}

/**
 * Find the lowest combat stat below target
 */
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

/**
 * Try to assign faction work
 */
function tryFactionWork(ns, i) {
    const player = ns.getPlayer();
    const factionPriority = config.sleeves.factionPriority || ["CyberSec", "NiteSec"];
    
    for (const faction of factionPriority) {
        if (!player.factions.includes(faction)) continue;
        const ok = ns.sleeve.setToFactionWork(i, faction, "Hacking Contracts");
        if (ok) {
            return true;
        }
    }
    return false;
}

/**
 * Display sleeve status (only on changes or periodically)
 */
function printStatus(ui, count, summary, gamePhase, lastState) {
    const summaryStr = `${summary.trained}-${summary.working}-${summary.recovering}`;
    
    // Log if status changed, phase changed, or every 10 loops (5 minutes)
    if (summaryStr !== lastState.summary || 
        gamePhase !== lastState.phase || 
        lastState.loopCount % 10 === 0) {
        
        ui.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, "info");
        ui.log(`👨‍👨‍👧‍👦 Phase ${gamePhase} | ${count} Sleeves Active`, "info");
        ui.log(`📚 Training: ${summary.trained} | 💼 Working: ${summary.working} | 🏥 Recovering: ${summary.recovering}`, "info");
        
        lastState.summary = summaryStr;
        lastState.phase = gamePhase;
    }
}
