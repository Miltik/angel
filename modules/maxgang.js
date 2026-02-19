import { createWindow } from "/angel/modules/uiManager.js";
import { formatMoney } from "/angel/utils.js";
import { buyPriority, buyAllAffordable } from "/angel/modules/augments.js";

/**
 * Standalone aggressive gang manager.
 * Run manually when you want full control: it will recruit, train, ascend,
 * equip, assign tasks, and manage territory to maximize dominance.
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog("ALL");
    const ui = createWindow("maxgang", "👑 Max Gang Domination", 800, 520, ns);
    ui.log("MaxGang: aggressive gang manager loaded (manual run only)", "info");

    while (true) {
        try {
            if (!ns.gang.inGang()) {
                ui.log("Not in a gang — idle", "warn");
                await ns.sleep(60000);
                continue;
            }

            // Recruit available members
            recruitAll(ns, ui);


            // Ascend members using ROI modeling
            await considerAscension(ns, ui);

            // Buy role-optimized equipment for members
            buyEquipmentForAll(ns, ui);

            // Assign optimal tasks with per-member scoring
            assignAllTasks(ns, ui);

            // Manage territory warfare engagement
            manageWarfare(ns, ui);

            // Summary
            printSummary(ns, ui);

            await ns.sleep(20000);
        } catch (e) {
            ui.log(`Error in maxgang: ${e}`,'error');
            await ns.sleep(5000);
        }
    }
}

function recruitAll(ns, ui) {
    while (ns.gang.canRecruitMember()) {
        const name = `max-${Date.now()}`;
        ns.gang.recruitMember(name);
        ui.log(`Recruited ${name}`, "success");
    }
}

async function considerAscension(ns, ui) {
    const members = ns.gang.getMemberNames();
    for (const name of members) {
        try {
            const result = ns.gang.getAscensionResult(name);
            if (!result) continue;
            // ROI modeling: estimate effective stat before/after for role
            const member = ns.gang.getMemberInformation(name);
            const roleScoreBefore = effectiveMemberScore(member, null);
            const roleScoreAfter = effectiveMemberScore(member, result);
            const roi = roleScoreAfter / Math.max(1e-6, roleScoreBefore);

            // Dynamic threshold: require at least 1.25x improvement OR absolute gains
            if (roi >= 1.25 || Object.values(result).some(g => g >= 10)) {
                const asc = ns.gang.ascendMember(name);
                ui.log(`Ascended ${name} (ROI ${roi.toFixed(2)}) -> +${Object.entries(result).map(([k,v])=>`${k}:${v.toFixed(2)}`).join(', ')}`,'success');
                await ns.sleep(120);
            }
        } catch (e) {
            // ignore
        }
    }
}

function buyEquipmentForAll(ns, ui) {
    const members = ns.gang.getMemberNames();
    if (members.length === 0) return;
    // Build list of purchasable equipment
    let equipment = ns.gang.getEquipmentNames();
    equipment.sort((a,b) => ns.gang.getEquipmentCost(a) - ns.gang.getEquipmentCost(b));

    for (const member of members) {
        const info = ns.gang.getMemberInformation(member);
        // Determine role preference based on member stats
        const role = determineRoleForMember(info);

        for (const item of equipment) {
            try {
                if (info.upgrades.includes(item)) continue;
                const cost = ns.gang.getEquipmentCost(item);

                // Try to read equipment stats; some API versions support this
                let stats = null;
                try { stats = ns.gang.getEquipmentStats(item); } catch (e) { stats = null; }

                // If stats available, prefer items that boost role-relevant stats
                if (stats) {
                    const boost = equipmentRoleBoost(stats, role);
                    if (boost <= 0) continue; // skip gear that doesn't help the role
                }

                // Purchase (no reserve — running manually with full access)
                const ok = ns.gang.purchaseEquipment(member, item);
                if (ok) ui.log(`Bought ${item} for ${member} (${formatMoney(cost)})`,'debug');
            } catch (e) {
                // ignore failures
            }
        }
    }
}

function assignAllTasks(ns, ui) {
    const info = ns.gang.getGangInformation();
    const members = ns.gang.getMemberNames();
    const tasks = ns.gang.getTaskNames().filter(t => t !== 'Unassigned');
    if (members.length === 0 || tasks.length === 0) return;

    // Build per-member scoring for all tasks and pick best
    const taskPool = tasks;

    for (const member of members) {
        const m = ns.gang.getMemberInformation(member);

        // If training required (very low stat), enforce training
        const needsHeavyTrain = (m.str < 40 || m.def < 40 || m.agi < 40 || m.dex < 40 || m.hack < 40);
        if (needsHeavyTrain && tasks.includes('Train Combat')) {
            ns.gang.setMemberTask(member, 'Train Combat');
            continue;
        }

        // Score tasks
        let best = null;
        let bestScore = -Infinity;
        for (const task of taskPool) {
            const score = scoreTaskForMember(ns, m, task, info);
            if (score > bestScore) {
                bestScore = score;
                best = task;
            }
        }

        if (best) ns.gang.setMemberTask(member, best);
    }
}

/** Score how well a task fits a member given current gang state */
function scoreTaskForMember(ns, memberInfo, task, gangInfo) {
    // Heuristic mapping of tasks to which stats they leverage and goals
    const stat = pickStatForTask(task);
    let statValue = memberInfo[stat] || 0;

    // Base score is the stat value
    let score = statValue;

    // Boost for tasks that address current gang needs
    if (task === 'Vigilante Justice') {
        // If wanted penalty low, prioritize
        if (gangInfo.wantedPenalty < 0.95) score *= 1.6;
        else score *= 0.9;
    }

    if (task === 'Territory Warfare') {
        // Only consider warfare if we have power advantage vs somebody
        const other = ns.gang.getOtherGangInformation();
        let bestAdv = 0;
        for (const v of Object.values(other)) {
            const adv = gangInfo.power / (v.power + 0.1);
            bestAdv = Math.max(bestAdv, adv);
        }
        score *= Math.max(0.5, Math.min(2, bestAdv));
    }

    // Slight randomness to avoid lockstep
    score *= (0.95 + Math.random() * 0.1);
    return score;

}

function pickStatForTask(task) {
    const hackTasks = ['Train Hacking','Hack','Cyberterrorism','Fraudulent Counterfeiting'];
    const combatTasks = ['Train Combat','Human Trafficking','Trafficking','Armed Robbery','Strongarm Civilians','Kidnapping','Terrorism','Assassinate'];
    const dexTasks = ['Strongarm Civilians','Assassinate'];

    if (hackTasks.includes(task)) return 'hack';
    if (dexTasks.includes(task)) return 'dex';
    if (combatTasks.includes(task)) return 'str';
    if (task === 'Vigilante Justice') return 'def';
    if (task === 'Territory Warfare') return 'power';
    return 'str';
}

function shouldPrioritizeMoney(info) {
    // If gang money gain rate is low or territory small, prefer money
    if (info.moneyGainRate < 1e5) return true;
    if (info.territory < 30) return true;
    // If respect is low vs target, favor respect
    if (info.respect < 1e6) return false;
    return true;
}

function chooseTasks(ns, available, candidates) {
    const chosen = [];
    for (const c of candidates) if (available.includes(c)) chosen.push(c);
    return chosen.length ? chosen : available.slice(0, Math.min(3, available.length));
}

function manageWarfare(ns, ui) {
    try {
        const info = ns.gang.getGangInformation();
        const other = ns.gang.getOtherGangInformation();
        // Choose best enemy target: prefer gangs with high territory but low power
        let bestTarget = null;
        let bestScore = 0;
        for (const [name, data] of Object.entries(other)) {
            const powerAdv = info.power / (data.power + 0.1);
            const score = data.territory * Math.max(0.1, powerAdv);
            if (score > bestScore) {
                bestScore = score;
                bestTarget = { name, data, powerAdv };
            }
        }

        // Engage when best target exists and advantage >=1.15 or we're dominant
        if ((bestTarget && bestTarget.powerAdv >= 1.15 && info.territory < 95) || info.territory >= 95) {
            ns.gang.setTerritoryWarfareEngaged(true);
            ui.log(`Engaging warfare vs ${bestTarget ? bestTarget.name : 'opponents'} (adv ${bestTarget ? bestTarget.powerAdv.toFixed(2) : 'N/A'})`, 'info');
        } else {
            ns.gang.setTerritoryWarfareEngaged(false);
        }
    } catch (e) { /* ignore */ }
}

function printSummary(ns, ui) {
    const info = ns.gang.getGangInformation();
    const members = ns.gang.getMemberNames().length;
    ui.log(`Members: ${members} | Money/s: ${formatMoney(info.moneyGainRate)} | Respect: ${formatMoney(info.respect)} | Territory: ${info.territory.toFixed(1)}%`, 'info');
}

// =====================
// Helper utilities
// =====================

function effectiveMemberScore(member, ascResult) {
    // Compute an aggregate effective stat score; if ascResult provided, apply multipliers
    const stats = ['str','def','dex','agi','hack'];
    let total = 0;
    for (const s of stats) {
        const base = member[s] || 0;
        const mult = ascResult && ascResult[s] ? ascResult[s] : 1;
        total += base * mult;
    }
    return total;
}

function determineRoleForMember(memberInfo) {
    // Choose role by highest stat among core stats
    const stats = { str: memberInfo.str, def: memberInfo.def, dex: memberInfo.dex, agi: memberInfo.agi, hack: memberInfo.hack };
    const sorted = Object.entries(stats).sort((a,b) => b[1] - a[1]);
    const top = sorted[0][0];
    if (top === 'hack') return 'hacker';
    if (top === 'def' || top === 'str') return 'fighter';
    return 'general';
}

function equipmentRoleBoost(stats, role) {
    // Simple heuristic: sum boosts to relevant stats
    let boost = 0;
    if (role === 'hacker') boost += (stats.hacking_exp || 0) + (stats.hacking_chance || 0);
    if (role === 'fighter') boost += (stats.str || 0) + (stats.def || 0) + (stats.agi || 0) + (stats.dex || 0);
    if (role === 'general') boost += (stats.str || 0) + (stats.hack || 0);
    return boost;
}

// Periodically attempt augmentation purchases (uses augment module helpers)
async function tryBuyAugments(ns, ui) {
    try {
        // Buy priority augs first
        const bought = buyPriority(ns);
        if (bought > 0) ui.log(`Purchased ${bought} priority augment(s) via augments module`, 'success');
        else {
            // If nothing high-priority, consider buying all affordable
            const all = buyAllAffordable(ns);
            if (all > 0) ui.log(`Purchased ${all} affordable augment(s) via augments module`, 'success');
        }
    } catch (e) {
        // ignore if singularity not available
    }
}
