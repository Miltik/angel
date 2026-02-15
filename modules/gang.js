/**
 * Gang automation module
 * @param {NS} ns
 */
import { config } from "/angel/config.js";

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.print("[Gang] Module started");

    while (true) {
        try {
            if (!ns.gang.inGang()) {
                ns.print("[Gang] Not in a gang yet - idle");
                await ns.sleep(60000);
                continue;
            }

            recruitMembers(ns);
            assignTasks(ns);
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
    const moneyTask = tasks.includes(config.gang.moneyTask) ? config.gang.moneyTask : tasks[0];
    const wantedTask = tasks.includes(config.gang.wantedTask) ? config.gang.wantedTask : tasks[0];

    let needsVigilante = info.wantedPenalty < config.gang.minWantedPenalty;

    for (let idx = 0; idx < members.length; idx++) {
        const name = members[idx];
        const m = ns.gang.getMemberInformation(name);

        if (m.str < config.gang.trainUntil || m.def < config.gang.trainUntil || m.dex < config.gang.trainUntil || m.agi < config.gang.trainUntil) {
            ns.gang.setMemberTask(name, "Train Combat");
            continue;
        }

        if (needsVigilante && idx === 0) {
            ns.gang.setMemberTask(name, wantedTask);
            continue;
        }

        ns.gang.setMemberTask(name, moneyTask);
    }
}
