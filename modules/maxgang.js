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

            // Ascend members aggressively when beneficial
            await considerAscension(ns, ui);

            // Buy equipment for members
            buyEquipmentForAll(ns, ui);

            // Assign optimal tasks (money/respect/training/warfare)
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

            // If any stat gain is >= 1.5x (50% increase) or absolute gain >= 10,
            // consider ascending to get long-term dominance.
            const shouldAscend = Object.values(result).some(gain => gain >= 1.5 || gain >= 10);
            if (shouldAscend) {
                const asc = ns.gang.ascendMember(name);
                ui.log(`Ascended ${name} -> +${Object.entries(result).map(([k,v])=>`${k}:${v.toFixed(2)}`).join(', ')}`,'success');
                // Small delay to avoid spamming game
                await ns.sleep(100);
            }
        } catch (e) {
            // ignore
        }
    }
}

function buyEquipmentForAll(ns, ui) {
    const members = ns.gang.getMemberNames();
    if (members.length === 0) return;

    // Build list of purchasable equipment (sorted by price ascending)
    let equipment = ns.gang.getEquipmentNames();
    equipment.sort((a,b) => ns.gang.getEquipmentCost(a) - ns.gang.getEquipmentCost(b));

    // Reserve some cash to avoid draining empire (10% of money)
    const money = ns.getServerMoneyAvailable('home');
    const reserve = Math.max(0, money * 0.10);

    for (const member of members) {
        for (const item of equipment) {
            try {
                const cost = ns.gang.getEquipmentCost(item);
                if (ns.gang.getMemberInformation(member).upgrades.includes(item)) continue;
                if (ns.getServerMoneyAvailable('home') - cost < reserve) break;
                const ok = ns.gang.purchaseEquipment(member, item);
                if (ok) ui.log(`Bought ${item} for ${member} (${formatMoney(cost)})`,'debug');
            } catch (e) { break; }
        }
    }
}

function assignAllTasks(ns, ui) {
    const info = ns.gang.getGangInformation();
    const members = ns.gang.getMemberNames();
    const tasks = ns.gang.getTaskNames().filter(t => t !== 'Unassigned');
    if (members.length === 0 || tasks.length === 0) return;

    // Prioritize money and respect depending on current state
    const wantMoney = shouldPrioritizeMoney(info);
    const wantRespect = !wantMoney;

    // Determine best tasks
    const moneyTasks = chooseTasks(ns, tasks, ['Human Trafficking','Trafficking','Fraudulent Counterfeiting','Cyberterrorism','Armed Robbery','Strongarm Civilians']);
    const respectTasks = chooseTasks(ns, tasks, ['Vigilante Justice','Terrorism','Assassinate','Kidnapping']);
    const trainTasks = chooseTasks(ns, tasks, ['Train Combat','Train Hacking','Train Charisma']);
    const warfareTask = tasks.includes('Territory Warfare') ? 'Territory Warfare' : null;

    // Simple distribution: ensure wanted management, then money/respect, then train
    let idx = 0;
    for (const member of members) {
        const m = ns.gang.getMemberInformation(member);
        // If stats low, train
        const needsTrain = (m.str < 60 || m.def < 60 || m.agi < 60 || m.dex < 60 || m.hack < 60);
        if (needsTrain && trainTasks.length) {
            ns.gang.setMemberTask(member, trainTasks[0]);
            continue;
        }

        // Ensure wanted reduction if penalty too low
        if (info.wantedPenalty < 0.95 && tasks.includes('Vigilante Justice')) {
            ns.gang.setMemberTask(member, 'Vigilante Justice');
            continue;
        }

        // Assign money or respect
        if (wantMoney && moneyTasks.length) ns.gang.setMemberTask(member, moneyTasks[idx % moneyTasks.length]);
        else if (wantRespect && respectTasks.length) ns.gang.setMemberTask(member, respectTasks[idx % respectTasks.length]);
        else if (warfareTask && Math.random() < 0.12) ns.gang.setMemberTask(member, warfareTask);
        else if (moneyTasks.length) ns.gang.setMemberTask(member, moneyTasks[idx % moneyTasks.length]);

        idx++;
    }
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
        let powerAdv = 0;
        for (const [k,v] of Object.entries(other)) {
            const adv = info.power / (v.power + 0.1);
            powerAdv = Math.max(powerAdv, adv);
        }

        if (powerAdv > 1.25 && info.territory < 95) {
            ns.gang.setTerritoryWarfareEngaged(true);
            ui.log('Engaging territory warfare (power advantage)', 'info');
        } else if (info.territory >= 95) {
            ns.gang.setTerritoryWarfareEngaged(true);
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
