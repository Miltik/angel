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
    if (members.length === 0) {
        ns.print("[Gang] No members to assign");
        return { info, members, tasks, assigned: {} };
    }

    if (tasks.length === 0) {
        ns.print("[Gang] No tasks available yet");
        return { info, members, tasks, assigned: {} };
    }

    const moneyTask = pickTask(tasks, info.isHacking
        ? [config.gang.moneyTask, "Money Laundering", "Cyberterrorism", "Fraud & Counterfeiting", "Identity Theft", "Phishing"]
        : [config.gang.moneyTask, "Human Trafficking", "Armed Robbery", "Strongarm Civilians", "Mug People"]
    );
    const wantedTask = pickTask(tasks, info.isHacking
        ? [config.gang.wantedTask, "Ethical Hacking", "Vigilante Justice"]
        : [config.gang.wantedTask, "Vigilante Justice", "Terrorism"]
    );
    const trainTask = pickTask(tasks, info.isHacking
        ? ["Train Hacking", "Train Combat"]
        : ["Train Combat", "Train Hacking"]
    );

    const needsVigilante = info.wantedPenalty < config.gang.minWantedPenalty;

    const assigned = {};

    for (let idx = 0; idx < members.length; idx++) {
        const name = members[idx];
        const m = ns.gang.getMemberInformation(name);

        const needsTraining = info.isHacking
            ? m.hack < config.gang.trainUntil
            : m.str < config.gang.trainUntil || m.def < config.gang.trainUntil || m.dex < config.gang.trainUntil || m.agi < config.gang.trainUntil;

        let task = moneyTask;

        if (needsTraining) {
            task = trainTask;
        } else if (needsVigilante && idx === 0) {
            task = wantedTask;
        }

        let ok = ns.gang.setMemberTask(name, task);
        if (!ok && tasks.length > 0) {
            ok = ns.gang.setMemberTask(name, tasks[0]);
        }

        const updated = ns.gang.getMemberInformation(name);
        const actualTask = updated.task || "Unassigned";
        if (!ok) {
            ns.print(`[Gang] Failed to assign ${name} to ${task}`);
        }
        assigned[actualTask] = (assigned[actualTask] || 0) + 1;
    }

    return { info, members, tasks, assigned };
}

function printStatus(ns, summary) {
    const info = summary.info;
    const count = summary.members.length;
    const assigned = summary.assigned || {};

    ns.print("[Gang] ===== Status =====");
    ns.print(`[Gang] Members: ${count} | Type: ${info.isHacking ? "Hacking" : "Combat"}`);
    ns.print(`[Gang] Wanted Penalty: ${info.wantedPenalty.toFixed(3)} | Respect: ${Math.floor(info.respect)}`);
    ns.print(`[Gang] Money Gain: $${Math.floor(info.moneyGainRate * 5)}/s (approx)`);

    const tasks = Object.keys(assigned);
    if (tasks.length > 0) {
        const parts = tasks.map((task) => `${task}: ${assigned[task]}`);
        ns.print(`[Gang] Tasks: ${parts.join(" | ")}`);
    } else {
        ns.print("[Gang] Tasks: none assigned");
    }
}

function pickTask(available, candidates) {
    for (const name of candidates) {
        if (available.includes(name)) return name;
    }
    return available[0];
}
