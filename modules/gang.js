/**
 * Gang automation module - Money & Faction Rep focused
 * 
 * Strategy: Dynamic role assignment to maximize money/rep while maintaining
 * wanted level in the optimal range (0.95-0.99 penalty = best balance).
 * Automatically scales up/down wanted reduction members based on current wanted penalty.
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
            if (isScriptDeathError(e)) {
                return;
            }
            ui.log(`Error: ${e}`, "error");
            await ns.sleep(5000);
        }
    }
}

function isScriptDeathError(error) {
    const message = String(error || "");
    return message.includes("ScriptDeath") || message.includes("NS instance has already been killed");
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
 * Calculate optimal number of members to assign to wanted reduction
 * Based on current wanted level and desired penalty range (0.95-0.99)
 * 
 * Penalty < 0.95: add more wanted reducers (wanted is too high)
 * Penalty 0.95-0.99: maintain current (optimal range)
 * Penalty > 0.99: reduce wanted reducers, shift to money (penalty is minimal)
 */
function getOptimalWantedReducers(memberCount, currentPenalty) {
    const MIN_PENALTY = 0.95;  // If penalty drops below 0.95, it's too punishing
    const OPTIMAL_MIN = 0.98;  // Sweet spot: minimal but manageable wanted
    
    if (currentPenalty < MIN_PENALTY) {
        // Wanted is VERY high, need aggressive reduction
        return Math.ceil(memberCount * 0.4);  // 40% on vigilante
    } else if (currentPenalty < OPTIMAL_MIN) {
        // Wanted is moderately high, still too much
        return Math.ceil(memberCount * 0.25); // 25% on vigilante
    } else if (currentPenalty < 0.999) {
        // In optimal range, minimal maintenance
        return Math.ceil(memberCount * 0.15); // 15% on vigilante
    } else {
        // Penalty nearly 1.0, wanted is negligible
        return Math.max(1, Math.floor(memberCount * 0.08)); // Just 1-2 members
    }
}

/**
 * Calculate warfare intensity based on global phase
 * Now money-focused: only do warfare if we have surplus members
 */
function getWarfareIntensity(globalPhase) {
    // Warfare is now secondary - minimal focus
    switch (globalPhase) {
        case 0: return 0.05;   // Bootstrap: focus on money
        case 1: return 0.08;   // Early: minimal warfare
        case 2: return 0.10;   // Mid: still money focused
        case 3: return 0.15;   // Gang Phase: slight warfare for respect
        case 4: return 0.20;   // Late: can afford some warfare
        default: return 0.10;
    }
}

/**
 * Get respect target for current phase
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
    const wantedEmergency = isWantedEmergency(info);
    const optimalReducers = getOptimalWantedReducers(members.length, info.wantedPenalty);

    // Assign members with role-based specialization
    const assigned = {};
    const roleAssignments = {};
    let reducersAssigned = 0;

    for (const member of memberData) {
        // Determine which role this member should have
        const role = assignRole(ns, member, info, taskPool, globalPhase, reducersAssigned, optimalReducers, wantedEmergency);
        if (!roleAssignments[role]) roleAssignments[role] = [];
        roleAssignments[role].push(member.name);
        if (role === "wantedReduction") reducersAssigned++;

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

    return { info, members, tasks: availableTasks, assigned: actualAssignments, gangPhase, globalPhase, roleAssignments, wantedEmergency };
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
 * MONEY/REP FOCUSED: Trafficking tasks are primary
 */
function getTaskPool(availableTasks, info, gangPhase) {
    const isHacking = info.isHacking;

    // Tasks by role - money generation is now primary
    const tasks = {
        // Warriors/Hackers who still need training
        trainCombat: findTask(availableTasks, isHacking
            ? ["Train Hacking"]
            : ["Train Combat", "Train Hacking"]
        ),
        
        // Money earners - PRIMARY focus, highest income
        moneyTask: findTask(availableTasks, isHacking
            ? ["Money Laundering", "Fraudulent Counterfeiting", "Cyberterrorism", "Identity Theft"]
            : ["Human Trafficking", "Trafficking", "Armed Robbery", "Strongarm Civilians"]
        ),
        
        // Wanted management - CRITICAL for maintaining penalty in optimal range
        wantedReduction: findTask(availableTasks, isHacking
            ? ["Ethical Hacking", "Vigilante Justice"]
            : ["Vigilante Justice", "Assault"]
        ),
        
        // Secondary money/respect - only if we have surplus members
        secondaryRespect: findTask(availableTasks, isHacking
            ? ["Cyberterrorism", "Plant Virus", "DDoS Attacks"]
            : ["Kidnapping", "Terrorism", "Assassinate"]
        ),
        
        // Territory Warfare - minimal, only if power > enemies
        territoryWarfare: findTask(availableTasks, 
            ["Territory Warfare"]
        ),
    };

    return tasks;
}

/**
 * Assign a role to a member based on dynamic wanted management and money optimization
 * 
 * Priority:
 * 1. Still in training? → Train
 * 2. Need wanted reduction? → Vigilante (dynamically scaled)
 * 3. Otherwise → Money task (primary focus)
 * 4. Surplus members → Small group on warfare only if power advantage exists
 */
function assignRole(ns, member, info, taskPool, globalPhase, reducersAssigned, optimalReducers, wantedEmergency) {
    const m = member.info;
    const trainUntil = 60;
    const isHacking = info.isHacking;
    
    // 1. Check if member still needs training
    const needsTraining = isHacking
        ? m.hack < trainUntil
        : (m.str < trainUntil || m.def < trainUntil || m.dex < trainUntil || m.agi < trainUntil);

    if (needsTraining && taskPool.trainCombat) {
        return "trainCombat";
    }

    // Emergency mode: force all non-training members onto wanted reduction
    if (wantedEmergency && taskPool.wantedReduction) {
        return "wantedReduction";
    }

    // 2. DYNAMICALLY calculate how many members should be on wanted reduction
    // This is the KEY NEW FEATURE - adapts to current wanted level
    // If we haven't reached optimal reducer count, assign to vigilante
    if (reducersAssigned < optimalReducers && taskPool.wantedReduction) {
        return "wantedReduction";
    }

    // 3. PRIMARY STRATEGY: Money generation
    if (taskPool.moneyTask) {
        return "moneyTask";
    }

    // 4. Fallback to secondary respect if money unavailable
    if (taskPool.secondaryRespect) {
        return "secondaryRespect";
    }
    
    // 5. Only do warfare if:
    //    - We've covered training, wanted reduction, and money
    //    - Global phase allows it
    //    - We have power advantage
    const warfareIntensity = getWarfareIntensity(globalPhase);
    if (taskPool.territoryWarfare && Math.random() < warfareIntensity) {
        // Only enable if conditions are met
        const otherGangs = ns.gang.getOtherGangInformation();
        let powerAdvantage = false;
        for (const [gangName, data] of Object.entries(otherGangs)) {
            const advantage = info.power / (data.power + 0.1);
            if (advantage > 1.1) {
                powerAdvantage = true;
                break;
            }
        }
        
        if (powerAdvantage) {
            return "territoryWarfare";
        }
    }

    // Fallback
    return "moneyTask";
}

function isWantedEmergency(info) {
    const threshold = config.gang.emergencyWantedPenalty ?? config.gang.criticalWantedPenalty ?? 0.9;
    return info.wantedPenalty < threshold;
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

        if (isWantedEmergency(info)) {
            ns.gang.setTerritoryWarfareEngaged(false);
            return;
        }
        
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
    const wantedEmergency = summary.wantedEmergency || false;
    
    // Calculate optimal wanted reducers for this state
    const optimalReducers = getOptimalWantedReducers(count, info.wantedPenalty);
    
    // Money per second calculation
    const moneyPerSec = Math.floor(info.moneyGainRate * 5);
    
    // Determine if wanted level is in good range
    const wantedStatus = wantedEmergency ? "🚨 EMERGENCY" :
                         info.wantedPenalty > 0.98 ? "✓ OPTIMAL" : 
                         info.wantedPenalty > 0.95 ? "⚠️ ACTIVE" : 
                         "🔴 CRITICAL";

    ui.log(`💰 GANG: ${info.isHacking ? "Hackers" : "Combat"} | Members: ${count} | Money: ${formatMoney(moneyPerSec)}/s`, "info");
    ui.log(`Wanted: ${(info.wantedPenalty * 100).toFixed(1)}% ${wantedStatus} | Respect: ${formatMoney(info.respect)} | Territory: ${info.territory.toFixed(1)}%`, "info");
    ui.log(`Power: ${info.power.toFixed(2)} | Gang Phase: ${gangPhase} | Optimal Peacekeepers: ${optimalReducers}/${count}`, "info");
    
    // Role distribution
    if (Object.keys(roles).length > 0) {
        const roleNames = {
            "trainCombat": "📚 Training",
            "territoryWarfare": "⭐ Warfare",
            "moneyTask": "💰 Money",
            "wantedReduction": "🛡️ Peacekeepers",
            "secondaryRespect": "🔥 Respect"
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
