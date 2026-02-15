/**
 * Milestone coordinator module
 * @param {NS} ns
 */
import { config, PORTS } from "/angel/config.js";

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.print("[Milestones] Module started");

    let lastNotify = 0;

    while (true) {
        try {
            const activity = chooseActivity(ns);
            setDesiredActivity(ns, activity);
            printStatus(ns, activity);

            if (config.milestones.notifyDaemon) {
                const now = Date.now();
                if (now - lastNotify >= config.milestones.notifyInterval) {
                    const daemon = getDaemonStatus(ns);
                    if (daemon.ready) {
                        ns.print("[Milestones] READY: w0r1d_d43m0n can be attempted (manual only)");
                        lastNotify = now;
                    }
                }
            }

            if (config.augmentations.installOnThreshold && hasSingularityAccess(ns)) {
                const queued = getQueuedAugments(ns);
                const queuedCost = getQueuedCost(ns, queued);
                if (queued.length >= config.augmentations.minQueuedAugs || queuedCost >= config.augmentations.minQueuedCost) {
                    ns.print(`[Milestones] Installing augments (queued=${queued.length}, cost=$${queuedCost.toFixed(0)})`);
                    ns.singularity.installAugmentations("/angel/angel.js");
                    return;
                }
            }
        } catch (e) {
            ns.print(`[Milestones] Error: ${e}`);
        }

        await ns.sleep(config.milestones.loopDelay);
    }
}

function chooseActivity(ns) {
    if (config.milestones.mode !== "balanced") {
        return "none";
    }

    if (needsTraining(ns)) return "training";
    if (needsCompany(ns)) return "company";
    if (needsCrime(ns)) return "crime";
    return "none";
}

function printStatus(ns, activity) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home");
    const trainingTargets = config.training.targetStats;
    const daemon = getDaemonStatus(ns);

    ns.print("[Milestones] ===== Status =====");
    ns.print(`[Milestones] Mode: ${config.milestones.mode} | Desired: ${activity}`);
    ns.print(`[Milestones] Money: $${money.toFixed(0)} | Crime<$${config.crime.onlyWhenMoneyBelow} | Company<$${config.company.onlyWhenMoneyBelow}`);
    ns.print(`[Milestones] Hacking: ${player.skills.hacking}/${config.training.targetHacking}`);
    ns.print(`[Milestones] Stats: STR ${player.skills.strength}/${trainingTargets.strength}, DEF ${player.skills.defense}/${trainingTargets.defense}, DEX ${player.skills.dexterity}/${trainingTargets.dexterity}, AGI ${player.skills.agility}/${trainingTargets.agility}`);
    ns.print(`[Milestones] Daemon: level ${daemon.hackLevel}/${daemon.requiredLevel}, root ${daemon.rooted}, programs ${daemon.programsOk}`);
}

function needsTraining(ns) {
    const player = ns.getPlayer();
    if (player.skills.hacking < config.training.targetHacking) return true;

    const targets = config.training.targetStats;
    return (
        player.skills.strength < targets.strength ||
        player.skills.defense < targets.defense ||
        player.skills.dexterity < targets.dexterity ||
        player.skills.agility < targets.agility
    );
}

function needsCompany(ns) {
    const money = ns.getServerMoneyAvailable("home");
    return money < config.company.onlyWhenMoneyBelow;
}

function needsCrime(ns) {
    const money = ns.getServerMoneyAvailable("home");
    return money < config.crime.onlyWhenMoneyBelow;
}

function setDesiredActivity(ns, activity) {
    const current = getDesiredActivity(ns);
    if (current === activity) return;
    ns.clearPort(PORTS.ACTIVITY_MODE);
    ns.writePort(PORTS.ACTIVITY_MODE, activity);
}

function getDesiredActivity(ns) {
    const raw = ns.peek(PORTS.ACTIVITY_MODE);
    if (raw === "NULL PORT DATA") return "none";
    return String(raw);
}

function getDaemonStatus(ns) {
    try {
        const server = ns.getServer("w0r1d_d43m0n");
        const player = ns.getPlayer();
        const required = ns.getServerRequiredHackingLevel("w0r1d_d43m0n");
        const programsOk = config.programs.priorityPrograms.every((prog) => ns.fileExists(prog, "home"));
        const rooted = ns.hasRootAccess("w0r1d_d43m0n");
        const ready = player.skills.hacking >= required && rooted && programsOk && server.exists === true;

        return {
            ready,
            hackLevel: player.skills.hacking,
            requiredLevel: required,
            rooted,
            programsOk,
        };
    } catch (e) {
        return {
            ready: false,
            hackLevel: 0,
            requiredLevel: 0,
            rooted: false,
            programsOk: false,
        };
    }
}

function hasSingularityAccess(ns) {
    try {
        ns.singularity.getCurrentWork();
        return true;
    } catch (e) {
        return false;
    }
}

function getQueuedAugments(ns) {
    const owned = ns.singularity.getOwnedAugmentations(false);
    const installed = ns.singularity.getOwnedAugmentations(true);
    return owned.filter((aug) => !installed.includes(aug));
}

function getQueuedCost(ns, queued) {
    let total = 0;
    for (const aug of queued) {
        total += ns.singularity.getAugmentationPrice(aug);
    }
    return total;
}
