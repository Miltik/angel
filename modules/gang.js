/**
 * Gang automation module - Intelligent member specialization with respect maximization
 * 
 * Strategy: Specialize members by role, maximize Territory Warfare for respect,
 * manage wanted level dynamically, and prevent task overlap conflicts.
 * 
 * @param {NS} ns
 */
import { config } from "/angel/config.js";

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.print("[Gang] Module started - Strategic lifecycle: Training → Respect Building → Sustainability");

    while (true) {
        try {
            if (!ns.gang.inGang()) {
                ns.print("[Gang] Not in a gang yet - idle");
                await ns.sleep(60000);
                continue;
            }

            recruitMembers(ns);
            const summary = assignTasks(ns);
            printStatus(ns, summary);
            await ns.sleep(30000);
        } catch (e) {
            ns.print(`[Gang] Error: ${e}`);
            await ns.sleep(5000);
        }
    }
}

function recruitMembers(ns) {
    while (ns.gang.canRecruitMember()) {
        const name = `angel-${Date.now()}`;
        ns.gang.recruitMember(name);
        ns.print(`[Gang] Recruited ${name}`);
    }
}

function assignTasks(ns) {
    const info = ns.gang.getGangInformation();
    const members = ns.gang.getMemberNames();
    const tasks = ns.gang.getTaskNames();
    const availableTasks = tasks.filter((task) => task !== "Unassigned");

    if (members.length === 0) {
        return { info, members, tasks: availableTasks, assigned: {}, phase: "no_members" };
    }
    if (availableTasks.length === 0) {
        ns.print("[Gang] WARNING: No tasks available!");
        return { info, members, tasks: availableTasks, assigned: {}, phase: "no_tasks" };
    }

    // Get member data for specialization
    const memberData = members.map(name => ({
        name,
        info: ns.gang.getMemberInformation(name),
    }));

    // Determine phase based on member training status
    const phase = getPhase(memberData, info.isHacking);

    // Build task pool
    const taskPool = getTaskPool(availableTasks, info, phase);
    
    // Debug: Print task pool
    ns.print(`[Gang] DEBUG: Available tasks (${availableTasks.length}): ${availableTasks.join(", ")}`);
    ns.print(`[Gang] DEBUG: Task pool -> TW:${taskPool.territoryWarfare}, Money:${taskPool.moneyTask}, Wanted:${taskPool.wantedReduction}, Train:${taskPool.trainCombat}`);

    // Assign members with role-based specialization
    const assigned = {};
    const roleAssignments = {};

    for (const member of memberData) {
        // Determine which role this member should have
        const role = assignRole(member, memberData, info, phase, taskPool);
        if (!roleAssignments[role]) roleAssignments[role] = [];
        roleAssignments[role].push(member.name);

        // Get task for this role
        const task = taskPool[role];
        if (!task) {
            ns.print(`[Gang] DEBUG: No task for role="${role}", available=${Object.keys(taskPool).map(k => `${k}:${taskPool[k]}`).join(", ")}`);
            continue;
        }

        // Assign task
        const ok = ns.gang.setMemberTask(member.name, task);
        if (!ok) {
            ns.print(`[Gang] DEBUG: setMemberTask failed for ${member.name}, task="${task}", trying fallback...`);
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
    
    // Verify actual assignments by reading back
    ns.print(`[Gang] DEBUG: Verifying actual member assignments...`);
    const actualAssignments = {};
    for (const name of members) {
        const m = ns.gang.getMemberInformation(name);
        const actualTask = m.task || "Unassigned";
        actualAssignments[actualTask] = (actualAssignments[actualTask] || 0) + 1;
    }
    ns.print(`[Gang] DEBUG: Actual tasks in game: ${JSON.stringify(actualAssignments)}`);

    return { info, members, tasks: availableTasks, assigned: actualAssignments, phase, roleAssignments };
}

/**
 * Determine which lifecycle phase the gang is in
 */
function getPhase(memberData, isHacking) {
    if (memberData.length === 0) return "training";
    
    // Count members that are combat-ready (all stats 40+)
    const trainUntil = 60;
    const readyForWarfare = memberData.filter(m => {
        const stats = [m.info.str, m.info.def, m.info.dex, m.info.agi];
        return stats.every(s => s >= trainUntil);
    }).length;
    
    const readyRatio = readyForWarfare / memberData.length;
    
    if (readyRatio < 0.3) return "training";           // Less than 30% ready: focus on training
    if (readyRatio < 0.8) return "transition";         // 30-80%: mix training and warfare
    return "respect_building";                         // 80%+: full respect maximization mode
}

/**
 * Build task pool for roles based on phase and conditions
 */
function getTaskPool(availableTasks, info, phase) {
    const isHacking = info.isHacking;
    const wantedPenalty = info.wantedPenalty;

    // Tasks by role
    const tasks = {
        // Warriors/Hackers who still need training
        trainCombat: findTask(availableTasks, isHacking
            ? ["Train Combat", "Train Hacking"]
            : ["Train Combat", "Train Hacking"]
        ),
        
        // Territory Warfare - primary respect builder (hacking gang)
        territoryWarfare: findTask(availableTasks, 
            ["Territory Warfare"]
        ),
        
        // Money earners - high income tasks
        moneyTask: findTask(availableTasks, isHacking
            ? ["Money Laundering", "Fraud & Counterfeiting", "Cyberterrorism", "Identity Theft"]
            : ["Human Trafficking", "Armed Robbery", "Strongarm Civilians", "Grand Theft Auto"]
        ),
        
        // Wanted management - use these when wanted is dangerous
        wantedReduction: findTask(availableTasks, isHacking
            ? ["Ethical Hacking", "Vigilante Justice"]
            : ["Vigilante Justice", "Terrorism"]
        ),
        
        // Secondary respect builders (for when not doing warfare)
        secondaryRespect: findTask(availableTasks, isHacking
            ? ["Cyberterrorism", "Plant Virus", "DDoS Attacks"]
            : ["Kidnapping", "Terrorism", "Assassinate"]
        ),
    };

    return tasks;
}

/**
 * Assign a role to a member based on their stats and gang needs
 * Returns the taskPool key that maps to the appropriate task
 */
function assignRole(member, allMembers, info, phase, taskPool) {
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

    // Count members by role to prevent overlap
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

    // Phase-specific role assignment
    switch (phase) {
        case "training":
            return "trainCombat";
            
        case "transition":
            // Mix builders and earners
            if (taskPool.territoryWarfare && Math.random() < 0.6) {
                return "territoryWarfare";
            }
            return "moneyTask";
            
        case "respect_building":
            // Maximize! Territory warfare first, then money earners
            if (taskPool.territoryWarfare && Math.random() < 0.75) {
                return "territoryWarfare";
            }
            if (wantedPenalty < 0.9 && taskPool.wantedReduction) {
                return "wantedReduction";
            }
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

function printStatus(ns, summary) {
    const info = summary.info;
    const count = summary.members.length;
    const assigned = summary.assigned || {};
    const phase = summary.phase || "unknown";
    const roles = summary.roleAssignments || {};

    ns.print("[Gang] ╔════════════════════════════════════╗");
    ns.print("[Gang] ║       GANG INTELLIGENCE CORE       ║");
    ns.print("[Gang] ╚════════════════════════════════════╝");
    
    // Phase indicator with animation
    const phaseEmoji = {
        "training": "🎓",
        "transition": "⚡",
        "respect_building": "👑",
        "no_members": "❌",
        "no_tasks": "⏸"
    }[phase] || "❓";
    
    ns.print(`[Gang] Phase: ${phaseEmoji} ${phase.toUpperCase()}`);
    ns.print(`[Gang] Members: ${count} | Type: ${info.isHacking ? "🖥 Hacking" : "⚔ Combat"}`);
    ns.print(`[Gang] Wanted: ${info.wantedPenalty.toFixed(3)} | Respect: ${Math.floor(info.respect)} | Power: ${info.power.toFixed(2)}`);
    ns.print(`[Gang] Money Gain: $${Math.floor(info.moneyGainRate * 5)}/s | Territory: ${info.territory.toFixed(1)}%`);
    
    // Available tasks
    if (summary.tasks && summary.tasks.length > 0) {
        ns.print(`[Gang] Available: ${summary.tasks.join(", ")}`);
    }
    
    // Role distribution - map taskPool keys to display names
    const roleNames = {
        "trainCombat": "📚 Training",
        "territoryWarfare": "⭐ Territory Warfare",
        "moneyTask": "💰 Money Tasks",
        "wantedReduction": "🛡️ Peacekeeping",
        "secondaryRespect": "🔥 Secondary Respect"
    };
    
    if (Object.keys(roles).length > 0) {
        ns.print(`[Gang] ───── Role Distribution ─────`);
        for (const [roleKey, members] of Object.entries(roles)) {
            const displayName = roleNames[roleKey] || roleKey;
            ns.print(`[Gang]   ${displayName}: ${members.length}`);
        }
    }
    
    // Task distribution summary
    const tasks = Object.keys(assigned);
    if (tasks.length > 0) {
        ns.print(`[Gang] ───── Task Distribution ─────`);
        tasks.forEach(task => {
            ns.print(`[Gang]   • ${task}: ${assigned[task]}`);
        });
    } else {
        ns.print("[Gang] No tasks assigned (tasks may be unavailable)");
    }
    ns.print("[Gang]");
    
    return;
}
