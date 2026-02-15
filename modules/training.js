/**
 * Training automation module (university + gym)
 * @param {NS} ns
 */
import { config, PORTS } from "/angel/config.js";

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.print("[Training] Module started");

    if (!hasSingularityAccess(ns)) {
        ns.print("[Training] Singularity functions not available (need SF4)");
        while (true) {
            await ns.sleep(60000);
        }
    }

    const owner = "training";

    while (true) {
        try {
            const work = ns.singularity.getCurrentWork();
            if (work && work.type === "FACTION") {
                await ns.sleep(30000);
                continue;
            }

            const desired = getDesiredActivity(ns);
            if (desired !== "none" && desired !== "training") {
                releaseLock(ns, owner);
                await ns.sleep(30000);
                continue;
            }

            const target = getTrainingTarget(ns);
            if (!target) {
                releaseLock(ns, owner);
                await ns.sleep(60000);
                continue;
            }

            if (!claimLock(ns, owner, 60000)) {
                await ns.sleep(5000);
                continue;
            }

            if (work && work.type && work.type !== "CLASS") {
                await ns.sleep(5000);
                continue;
            }

            if (config.training.autoTravel) {
                try {
                    ns.singularity.travelToCity(config.training.city);
                } catch (e) {
                    ns.print(`[Training] Travel failed: ${e}`);
                }
            }

            if (target.type === "hacking") {
                ns.singularity.universityCourse(
                    config.training.university,
                    config.training.course,
                    config.training.focus
                );
                ns.print(`[Training] Studying ${config.training.course} at ${config.training.university}`);
            } else if (target.type === "gym") {
                ns.singularity.gymWorkout(
                    config.training.gym,
                    target.stat,
                    config.training.focus
                );
                ns.print(`[Training] Training ${target.stat} at ${config.training.gym}`);
            }

            await ns.sleep(60000);
        } catch (e) {
            ns.print(`[Training] Error: ${e}`);
            await ns.sleep(5000);
        }
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

function getTrainingTarget(ns) {
    const player = ns.getPlayer();

    if (player.skills.hacking < config.training.targetHacking) {
        return { type: "hacking" };
    }

    const targets = config.training.targetStats;
    const stats = [
        { stat: "strength", value: player.skills.strength, target: targets.strength },
        { stat: "defense", value: player.skills.defense, target: targets.defense },
        { stat: "dexterity", value: player.skills.dexterity, target: targets.dexterity },
        { stat: "agility", value: player.skills.agility, target: targets.agility },
    ];

    let lowest = null;
    for (const s of stats) {
        if (s.value < s.target) {
            if (!lowest || s.value < lowest.value) {
                lowest = s;
            }
        }
    }

    if (lowest) {
        return { type: "gym", stat: lowest.stat };
    }

    return null;
}

function getLock(ns) {
    const raw = ns.peek(PORTS.ACTIVITY);
    if (raw === "NULL PORT DATA") return null;
    const parts = String(raw).split("|");
    if (parts.length < 2) return null;
    const expires = Number(parts[1]);
    if (Number.isNaN(expires)) return null;
    return { owner: parts[0], expires };
}

function claimLock(ns, owner, ttlMs) {
    const now = Date.now();
    const lock = getLock(ns);
    if (!lock || lock.expires <= now || lock.owner === owner) {
        ns.clearPort(PORTS.ACTIVITY);
        ns.writePort(PORTS.ACTIVITY, `${owner}|${now + ttlMs}`);
        return true;
    }
    return lock.owner === owner;
}

function releaseLock(ns, owner) {
    const lock = getLock(ns);
    if (lock && lock.owner === owner) {
        ns.clearPort(PORTS.ACTIVITY);
    }
}

function getDesiredActivity(ns) {
    const raw = ns.peek(PORTS.ACTIVITY_MODE);
    if (raw === "NULL PORT DATA") return "none";
    return String(raw);
}
