/**
 * Gang automation module - Phase-aware intelligent member specialization
 * 
 * Strategy: Specialize members by role, maximize Territory Warfare for respect.
 * Phase determines intensity: P0-2 = 75% warfare, P3-4 = 90%+ warfare
 * Respects coordinate with hacking phase progression.
 * 
 * @param {NS} ns
 */
import { config } from "/angel/config.js";
import { formatMoney } from "/angel/utils.js";
import { createWindow } from "/angel/modules/uiManager.js";

const PHASE_PORT = 7;

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("gang", "👾 Gang Management", 700, 450, ns);
    ui.log("Gang module started - Phase-aware respect maximization with clash timing", "info");

    while (true) {
        try {
            if (!ns.gang.inGang()) {
                ui.log("Not in a gang yet - idle", "info");
                await ns.sleep(60000);
                continue;
            }

            recruitMembers(ns, ui);
            const summary = assignTasks(ns, ui);
            
            // NEW: Manage territory clashes  
            manageTerritoryclashes(ns, ui);
            
            printStatus(ns, summary, ui);
            await ns.sleep(30000);
        } catch (e) {
            ui.log(`Error: ${e}`, "error");
            await ns.sleep(5000);
        }
    }
}

/**
 * Read game phase from orchestrator port (port 7)
 */
function readGamePhase(ns) {
    const phasePortData = ns.peek(PHASE_PORT);
    if (phasePortData === "NULL PORT DATA") return 0;
    return parseInt(phasePortData) || 0;
}

/**
 * Get phase configuration
 */
function getPhaseConfig(phase) {
    const phaseKey = `phase${phase}`;
    return config.gamePhases[phaseKey] || config.gamePhases.phase0;
}

/**
 * Calculate warfare intensity based on global phase
 * Returns the target percentage of members to assign to Territory Warfare
 */
function getWarfareIntensity(globalPhase) {
    switch (globalPhase) {
        case 0: return 0.60;  // Bootstrap: moderate, build cash
        case 1: return 0.70;  // Early: ramp up
        case 2: return 0.75;  // Mid: steady
        case 3: return 0.85;  // Gang Phase: aggressive
        case 4: return 0.95;  // Late: maximum
        default: return 0.75;
    }
}

/**
 * Get respect target for current phase (when to install augments)
 */
function getRespectTarget(globalPhase) {
    switch (globalPhase) {
        case 0: return 50000;      // Bootstrap: minimal
        case 1: return 200000;     // Early: build some
        case 2: return 1000000;    // Mid: scale up
        case 3: return 5000000;    // Gang: aggressive
        case 4: return 50000000;   // Late: maximum
        default: return 100000;
    }
}

function recruitMembers(ns, ui) {
    while (ns.gang.canRecruitMember()) {
        const name = `angel-${Date.now()}`;
        ns.gang.recruitMember(name);
        ui.log(`Recruited ${name}`, "success");
    }
}

function assignTasks(ns, ui) {
    const globalPhase = readGamePhase(ns);
    const info = ns.gang.getGangInformation();
    const members = ns.gang.getMemberNames();
    const tasks = ns.gang.getTaskNames();
    const availableTasks = tasks.filter((task) => task !== "Unassigned");

    if (members.length === 0) {
        return { info, members, tasks: availableTasks, assigned: {}, phase: "no_members", globalPhase };
    }
    if (availableTasks.length === 0) {
        ui.log("WARNING: No tasks available!", "warn");
        return { info, members, tasks: availableTasks, assigned: {}, phase: "no_tasks", globalPhase };
    }

    // Get member data for specialization
    const memberData = members.map(name => ({
        name,
        info: ns.gang.getMemberInformation(name),
    }));

    // Determine gang lifecycle phase
    const gangPhase = getGangPhase(memberData, info.isHacking);

    // Build task pool
    const taskPool = getTaskPool(availableTasks, info, gangPhase);

    // Assign members with role-based specialization
    const assigned = {};
    const roleAssignments = {};

    for (const member of memberData) {
        // Determine which role this member should have
        const role = assignRole(ns, member, memberData, info, gangPhase, taskPool, globalPhase);
        if (!roleAssignments[role]) roleAssignments[role] = [];
        roleAssignments[role].push(member.name);

        // Get task for this role
        const task = taskPool[role];
        if (!task) continue;

        // Assign task
        const ok = ns.gang.setMemberTask(member.name, task);
        if (!ok) {
            // Fallback to any available task
            for (const fallback of availableTasks) {
                if (ns.gang.setMemberTask(member.name, fallback)) {
                    assigned[fallback] = (assigned[fallback] || 0) + 1;
                    break;
                }
            }
        } else {
            assigned[task] = (assigned[task] || 0) + 1;
        }
    }
    
    // Verify actual assignments by reading back from game state
    const actualAssignments = {};
    for (const name of members) {
        const m = ns.gang.getMemberInformation(name);
        const actualTask = m.task || "Unassigned";
        actualAssignments[actualTask] = (actualAssignments[actualTask] || 0) + 1;
    }

    return { info, members, tasks: availableTasks, assigned: actualAssignments, gangPhase, globalPhase, roleAssignments };
}

/**
 * Determine which lifecycle phase the gang is in
 * Independent of global phase (just member readiness)
 */
function getGangPhase(memberData, isHacking) {
    if (memberData.length === 0) return "training";
    
    // Count members that are combat-ready (all stats 40+)
    const trainUntil = 60;
    const readyForWarfare = memberData.filter(m => {
        const stats = [m.info.str, m.info.def, m.info.dex, m.info.agi];
        return stats.every(s => s >= trainUntil);
    }).length;
    
    const readyRatio = readyForWarfare / memberData.length;
    
    if (readyRatio < 0.3) return "training";           // Less than 30% ready
    if (readyRatio < 0.8) return "transition";         // 30-80%
    return "respect_building";                         // 80%+
}

/**
 * Build task pool for roles based on gang phase and gang type
 */
function getTaskPool(availableTasks, info, gangPhase) {
    const isHacking = info.isHacking;

    // Tasks by role
    const tasks = {
        // Warriors/Hackers who still need training
        trainCombat: findTask(availableTasks, isHacking
            ? ["Train Hacking"]
            : ["Train Combat", "Train Hacking"]
        ),
        
        // Territory Warfare - primary respect builder (most important)
        territoryWarfare: findTask(availableTasks, 
            ["Territory Warfare"]
        ),
        
        // Money earners - high income tasks
        moneyTask: findTask(availableTasks, isHacking
            ? ["Money Laundering", "Fraud & Counterfeiting", "Cyberterrorism", "Identity Theft"]
            : ["Human Trafficking", "Armed Robbery", "Strongarm Civilians", "Grand Theft Auto"]
        ),
        
        // Wanted management - use when wanted is too high
        wantedReduction: findTask(availableTasks, isHacking
            ? ["Ethical Hacking", "Vigilante Justice"]
            : ["Vigilante Justice", "Terrorism"]
        ),
        
        // Secondary respect builders
        secondaryRespect: findTask(availableTasks, isHacking
            ? ["Cyberterrorism", "Plant Virus", "DDoS Attacks"]
            : ["Kidnapping", "Terrorism", "Assassinate"]
        ),
    };

    return tasks;
}

/**
 * Assign a role to a member based on their stats, gang needs, and BOTH gang + global phases
 * Returns the taskPool key that maps to the appropriate task
 */
function assignRole(ns, member, allMembers, info, gangPhase, taskPool, globalPhase) {
    const m = member.info;
    const trainUntil = 60;
    const isHacking = info.isHacking;
    
    // Check if member still needs training
    const needsTraining = isHacking
        ? m.hack < trainUntil
        : (m.str < trainUntil || m.def < trainUntil || m.dex < trainUntil || m.agi < trainUntil);

    if (needsTraining && taskPool.trainCombat) {
        return "trainCombat";
    }

    // Count members and analyze wanted level
    const memberCount = allMembers.length;
    const wantedPenalty = info.wantedPenalty;
    
    // If wanted is critical, prioritize peacekeepers
    if (wantedPenalty < 0.8 && taskPool.wantedReduction) {
        const peacekeeperCount = Math.ceil(memberCount * 0.3);
        const peacekeepers = allMembers.filter(m2 => {
            const m2Info = m2.info;
            return !isHacking
                ? (m2Info.str >= trainUntil && m2Info.def >= trainUntil)
                : true;
        }).length;
        
        if (peacekeepers < peacekeeperCount) {
            return "wantedReduction";
        }
    }

    // PHASE-INTENSIFIED warfare assignment
    // Early phases: balance warfare with money/respect
    // Late phases: aggressive warfare focus
    const warfareIntensity = getWarfareIntensity(globalPhase);
    
    switch (gangPhase) {
        case "training":
            // All focus on training
            return "trainCombat";
            
        case "transition":
            // Mix of territory warfare and money tasks
            // Scale based on global phase
            if (taskPool.territoryWarfare && Math.random() < warfareIntensity) {
                return "territoryWarfare";
            }
            return "moneyTask";
            
        case "respect_building":
            // Primary: Territory Warfare (scaled by global phase)
            // Secondary: Handle wanted level
            // Fallback: Money tasks
            
            if (taskPool.territoryWarfare && Math.random() < warfareIntensity) {
                return "territoryWarfare";
            }
            
            // Check if wanted needs management
            if (wantedPenalty < 0.9 && taskPool.wantedReduction) {
                return "wantedReduction";
            }
            
            // Late phase: still do warfare or secondary respect builders
            if (globalPhase >= 3 && taskPool.secondaryRespect && Math.random() < 0.2) {
                return "secondaryRespect";
            }
            
            // Fallback to money/respect tasks
            return "moneyTask";
    }

    return "moneyTask";
}

/**
 * Helper to find best task from candidates
 */
function findTask(available, candidates) {
    for (const name of candidates) {
        if (available.includes(name)) return name;
    }
    return available.length > 0 ? available[0] : null;
}

/**
 * Manage territory clashes - smart timing for maximum gain
 * Enables clashes when power advantage is sufficient
 */
function manageTerritoryclashes(ns, ui) {
    if (!ns.gang.inGang()) return;
    
    try {
        const info = ns.gang.getGangInformation();
        const territory = info.territory || 50;
        const power = info.power || 1;
        
        // Check enemy gangs power levels
        const otherGangs = ns.gang.getOtherGangInformation();
        
        // Calculate if we should engage in clashes
        let shouldClash = false;
        let powerAdvantage = 0;
        
        // Find weakest gang(s) to target
        for (const [gangName, data] of Object.entries(otherGangs)) {
            const enemyPower = data.power || 0.5;
            const enemyTerritory = data.territory || 50;
            const advantage = power / (enemyPower + 0.1); // Avoid division by 0
            
            // If we have 1.2x power advantage, we should pursue
            if (advantage > 1.2) {
                powerAdvantage = Math.max(powerAdvantage, advantage);
                shouldClash = true;
            }
        }
        
        // Engage with territory warfare if:
        // 1. We have power advantage (1.2x+)
        // 2. We're not already at maximum territory (100%)
        // 3. Power is above minimum threshold  
        const shouldEngage = shouldClash && territory < 95 && power > 10;
        
        if (shouldEngage) {
            ns.gang.setTerritoryWarfareEngaged(true);
        } else if (territory >= 95) {
            // Already dominant, maintain
            ns.gang.setTerritoryWarfareEngaged(true);
        } else {
            // Not ready yet, focus on recruitment and training
            ns.gang.setTerritoryWarfareEngaged(false);
        }
    } catch (e) {
        // Silently fail if clash management not available
    }
}

function printStatus(ns, summary, ui) {
    const info = summary.info;
    const count = summary.members.length;
    const assigned = summary.assigned || {};
    const gangPhase = summary.gangPhase || "unknown";
    const globalPhase = summary.globalPhase || 0;
    const roles = summary.roleAssignments || {};
    
    // Calculate warfare intensity for this phase
    const intensity = Math.round(getWarfareIntensity(globalPhase) * 100);
    const respectTarget = getRespectTarget(globalPhase);

    ui.log(`[Phase ${globalPhase}] Gang ${info.isHacking ? "Hacking" : "Combat"} | Members: ${count}`, "info");
    ui.log(`Wanted: ${info.wantedPenalty.toFixed(3)} | Respect: ${Math.floor(info.respect)} (target: ${Math.floor(respectTarget)}) | Territory: ${info.territory.toFixed(1)}%`, "info");
    ui.log(`${gangPhase.toUpperCase()} | Warfare Intensity: ${intensity}% | Power: ${info.power.toFixed(2)} | $${Math.floor(info.moneyGainRate * 5)}/s`, "info");
    
    // Role distribution
    if (Object.keys(roles).length > 0) {
        const roleNames = {
            "trainCombat": "📚 Training",
            "territoryWarfare": "⭐ Warfare",
            "moneyTask": "💰 Money",
            "wantedReduction": "🛡️ Wanted",
            "secondaryRespect": "🔥 2ndary"
        };
        
        const roleDistribution = Object.entries(roles)
            .map(([roleKey, members]) => {
                const displayName = roleNames[roleKey] || roleKey;
                return `${displayName}:${members.length}`;
            })
            .join(" | ");
        
        ui.log(`Roles: ${roleDistribution}`, "debug");
    }
    
    return;
}
