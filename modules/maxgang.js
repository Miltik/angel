import { createWindow } from "/angel/modules/uiManager.js";
import { formatMoney } from "/angel/utils.js";

/**
 * Standalone aggressive gang manager.
 * Run manually when you want full control: it will recruit, train, ascend,
 * equip, assign tasks, and manage territory to maximize dominance.
 *
 * @param {NS} ns
 */
export async function main(ns) {
    ns.disableLog("ALL");
    // Runtime flags and simple standalone config (overrides via CLI args)
    const FLAGS = parseFlags(ns.args);

    const CONFIG = {
        maxSpendPerCycle: FLAGS['max-spend-per-cycle'] ?? Infinity,
        maxSpendPerMember: FLAGS['max-spend-per-member'] ?? Infinity,
        actionsPerLoop: FLAGS['actions-per-loop'] ?? 4,
        minEquipROI: FLAGS['min-equip-roi'] ?? 1e-7,
        ascendROIHighProducer: FLAGS['ascend-roi-high'] ?? 1.5,
        ascendROILowProducer: FLAGS['ascend-roi-low'] ?? 1.25,
        trainingCutoff: FLAGS['training-cutoff'] ?? 60,
        purchaseCooldownMs: FLAGS['purchase-cooldown-ms'] ?? 1000,
        telemetryFile: "angel/maxgang.log",
        dryRun: FLAGS['dry-run'] === true,
        verbose: FLAGS['verbose'] === true,
        noSpend: FLAGS['no-spend'] === true,
        allIn: FLAGS['all-in'] === true,
    };

    const ui = createWindow("maxgang", "👑 Max Gang Domination", 800, 520, ns);
    ui.log(`MaxGang: aggressive gang manager loaded (manual run only)`, "info");
    if (CONFIG.dryRun) ui.log("--dry-run enabled: no purchases or ascensions will be executed", "warn");

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
            await considerAscension(ns, ui, CONFIG);

            // Buy role-optimized equipment for members (batched)
            await buyEquipmentForAll(ns, ui, CONFIG);

            // Attempt to buy augmentations (standalone logic)
            await tryBuyAugments(ns, ui, CONFIG);

            // Assign optimal tasks with per-member scoring
            assignAllTasks(ns, ui, CONFIG);

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

async function considerAscension(ns, ui, CONFIG) {
    const members = ns.gang.getMemberNames();
    for (const name of members) {
        try {
            const result = ns.gang.getAscensionResult(name);
            if (!result) continue;

            const member = ns.gang.getMemberInformation(name);
            const roleScoreBefore = effectiveMemberScore(member, null);
            const roleScoreAfter = effectiveMemberScore(member, result);
            const roi = roleScoreAfter / Math.max(1e-6, roleScoreBefore);

            const gangInfo = ns.gang.getGangInformation();
            const moneyPerSec = gangInfo.moneyGainRate || 0;
            const memberShare = estimateMemberMoneyShare(ns, member, gangInfo);
            const highProducer = memberShare * moneyPerSec > 1e5;
            const requiredROI = highProducer ? CONFIG.ascendROIHighProducer : CONFIG.ascendROILowProducer;

            if ((roi >= requiredROI || Object.values(result).some(g => g >= 10)) && !CONFIG.dryRun) {
                ns.gang.ascendMember(name);
                ui.log(`Ascended ${name} (ROI ${roi.toFixed(2)}) -> +${Object.entries(result).map(([k,v])=>`${k}:${v.toFixed(2)}`).join(', ')}`,'success');
                await logAction(ns, CONFIG.telemetryFile, { action: 'ascend', member: name, roi, result });
                await ns.sleep(CONFIG.purchaseCooldownMs);
            } else if (CONFIG.verbose) {
                ui.log(`Skip ascend ${name} (ROI ${roi.toFixed(2)} < ${requiredROI})`, 'debug');
            }
        } catch (e) {
            // ignore
        }
    }
}

// =====================
// Augment purchases (standalone, simple)
// =====================

async function tryBuyAugments(ns, ui, CONFIG) {
    // Only operate if Singularity API available
    try {
        ns.singularity.getFactionRep; // may throw
    } catch (e) {
        if (CONFIG && CONFIG.verbose) ui.log('Singularity API not available; skipping aug buys', 'debug');
        return;
    }

    const player = ns.getPlayer();
    const owned = ns.singularity.getOwnedAugmentations(true);
    const priorities = [
        'BitWire',
        'Artificial Bio-neural Network Implant',
        'Artificial Synaptic Potentiation'
    ];

    const candidates = [];
    for (const faction of player.factions) {
        const augs = ns.singularity.getAugmentationsFromFaction(faction);
        const rep = ns.singularity.getFactionRep(faction);
        for (const aug of augs) {
            if (owned.includes(aug)) continue;
            const price = ns.singularity.getAugmentationPrice(aug);
            const repReq = ns.singularity.getAugmentationRepReq(aug);
            if (rep >= repReq) candidates.push({ name: aug, faction, price });
        }
    }

    // Prefer priority augs first
    candidates.sort((a,b) => {
        const ap = priorities.includes(a.name) ? 0 : 1;
        const bp = priorities.includes(b.name) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return a.price - b.price;
    });

    for (const c of candidates) {
        const money = ns.getServerMoneyAvailable('home');
        if (money < c.price) break;
        if (CONFIG.dryRun || CONFIG.noSpend) {
            ui.log(`[dry-run] Would purchase aug ${c.name} from ${c.faction} for ${formatMoney(c.price)}`, 'info');
        } else {
            const ok = ns.singularity.purchaseAugmentation(c.faction, c.name);
            if (ok) {
                ui.log(`Purchased augmentation ${c.name} from ${c.faction} for ${formatMoney(c.price)}`, 'success');
                await logAction(ns, CONFIG.telemetryFile, { action: 'aug-purchase', name: c.name, faction: c.faction, price: c.price });
                await ns.sleep(CONFIG.purchaseCooldownMs);
            }
        }
    }
}

// =====================
// Utility helpers
// =====================

function parseFlags(args) {
    const out = {};
    for (const a of args || []) {
        if (typeof a !== 'string') continue;
        if (a.startsWith('--')) {
            const eq = a.indexOf('=');
            if (eq === -1) out[a.slice(2)] = true;
            else {
                const k = a.slice(2, eq);
                const v = a.slice(eq+1);
                const num = Number(v);
                out[k] = isNaN(num) ? v : num;
            }
        }
    }
    return out;
}

function estimateEquipmentBenefit(role, stats, memberInfo) {
    // Use equipmentRoleBoost as proxy; scale to approximate contribution
    const boost = equipmentRoleBoost(stats, role);
    // Favor items that synergize with current weak stats
    return boost * 100;
}

function estimateMemberMoneyShare(ns, member, gangInfo) {
    const members = ns.gang.getMemberNames();
    let total = 0;
    const scores = {};
    for (const m of members) {
        const info = ns.gang.getMemberInformation(m);
        const score = effectiveMemberScore(info, null);
        scores[m] = score;
        total += score;
    }
    const myScore = scores[member.name || member] || effectiveMemberScore(member, null);
    return total > 0 ? myScore / total : 0;
}

async function logAction(ns, file, obj) {
    try {
        const line = JSON.stringify({ ts: Date.now(), ...obj }) + '\n';
        await ns.write(file, line, 'a');
    } catch (e) {
        // ignore
    }
}

async function buyEquipmentForAll(ns, ui, CONFIG) {
    const members = ns.gang.getMemberNames();
    // Build list of purchasable equipment
    let equipment = ns.gang.getEquipmentNames();

    // Prepare action counters and spend tracking for this cycle
    let cycleSpend = 0;
    let actions = 0;

    // Sort equipment by cost-benefit (we'll compute per-member)
    for (const member of members) {
        if (actions >= CONFIG.actionsPerLoop) break;
        const info = ns.gang.getMemberInformation(member);
        const role = determineRoleForMember(info);

        // Get list of candidate items not yet owned
        const candidates = equipment.filter(it => !info.upgrades.includes(it));

        // Score each candidate by marginal benefit / cost for this member
        const scored = [];
        for (const item of candidates) {
            try {
                const cost = ns.gang.getEquipmentCost(item);
                let stats = null;
                try { stats = ns.gang.getEquipmentStats(item); } catch (e) { stats = null; }
                const benefit = estimateEquipmentBenefit(role, stats || {}, info);
                const roi = benefit / Math.max(1, cost);
                scored.push({ item, cost, benefit, roi });
            } catch (e) { /* skip */ }
        }

        // Choose best candidate above threshold
        scored.sort((a,b) => b.roi - a.roi);
        for (const s of scored) {
            if (actions >= CONFIG.actionsPerLoop) break;
            if (cycleSpend + s.cost > CONFIG.maxSpendPerCycle && !CONFIG.allIn) break;
            if (s.cost > CONFIG.maxSpendPerMember && !CONFIG.allIn) continue;
            if (s.roi < CONFIG.minEquipROI) break;

            // Execute purchase
            if (CONFIG.noSpend || CONFIG.dryRun) {
                ui.log(`[dry-run] Would buy ${s.item} for ${member} (${formatMoney(s.cost)}) ROI:${s.roi.toExponential(2)}`,'info');
            } else {
                const ok = ns.gang.purchaseEquipment(member, s.item);
                if (ok) {
                    cycleSpend += s.cost;
                    actions++;
                    ui.log(`Bought ${s.item} for ${member} (${formatMoney(s.cost)}) ROI:${s.roi.toExponential(2)}`,'success');
                    await logAction(ns, CONFIG.telemetryFile, { action: 'buy', member, item: s.item, cost: s.cost, roi: s.roi });
                    await ns.sleep(CONFIG.purchaseCooldownMs);
                }
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
// (Legacy aug helper removed; use standalone tryBuyAugments above.)
