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
    const availableTasks = tasks.filter((task) => task !== "Unassigned");
    if (members.length === 0) {
        ns.print("[Gang] No members to assign");
        return { info, members, tasks, assigned: {} };
    }

    if (availableTasks.length === 0) {
        ns.print("[Gang] No tasks available yet");
        return { info, members, tasks, assigned: {} };
    }

    const moneyTask = pickTask(availableTasks, info.isHacking
        ? [config.gang.moneyTask, "Money Laundering", "Cyberterrorism", "Fraud & Counterfeiting", "Identity Theft", "Phishing"]
        : [config.gang.moneyTask, "Human Trafficking", "Armed Robbery", "Strongarm Civilians", "Mug People"]
    );
    const wantedTask = pickTask(availableTasks, info.isHacking
        ? [config.gang.wantedTask, "Ethical Hacking", "Vigilante Justice"]
        : [config.gang.wantedTask, "Vigilante Justice", "Terrorism"]
    );
    const trainTask = pickTask(availableTasks, info.isHacking
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
        } else if (needsVigilante) {
            // Assign up to 25% of members to vigilante work when wanted is high
            const vigilanteCount = Math.ceil(members.length * 0.25);
            if (idx < vigilanteCount) {
                task = wantedTask;
            }
        } else if (info.wantedPenalty < 0.85) {
            // Even when not urgent, keep some members on wanted reduction when moderate
            const urgentVigilanteCount = Math.ceil(members.length * 0.15);
            if (idx < urgentVigilanteCount) {
                task = wantedTask;
            }
        }

        let ok = ns.gang.setMemberTask(name, task);
        if (!ok) {
            for (const fallback of availableTasks) {
                if (fallback === task) continue;
                ok = ns.gang.setMemberTask(name, fallback);
                if (ok) break;
            }
        }

        const updated = ns.gang.getMemberInformation(name);
        const actualTask = updated.task || "Unassigned";
        if (!ok) {
            ns.print(`[Gang] Failed to assign ${name} to ${task}`);
        }
        assigned[actualTask] = (assigned[actualTask] || 0) + 1;
    }

    return { info, members, tasks: availableTasks, assigned };
}

function printStatus(ns, summary) {
    const info = summary.info;
    const count = summary.members.length;
    const assigned = summary.assigned || {};

    ns.print("[Gang] ===== Status =====");
    ns.print(`[Gang] Members: ${count} | Type: ${info.isHacking ? "Hacking" : "Combat"}`);
    ns.print(`[Gang] Wanted Penalty: ${info.wantedPenalty.toFixed(3)} | Respect: ${Math.floor(info.respect)}`);
    ns.print(`[Gang] Money Gain: $${Math.floor(info.moneyGainRate * 5)}/s (approx)`);

    if (summary.tasks && summary.tasks.length > 0) {
        ns.print(`[Gang] Available Tasks: ${summary.tasks.join(", ")}`);
    }

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
