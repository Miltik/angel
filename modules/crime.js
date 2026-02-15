/**
 * Crime automation module
 * @param {NS} ns
 */
import { config, PORTS } from "/angel/config.js";

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.print("[Crime] Module started");

    if (!hasSingularityAccess(ns)) {
        ns.print("[Crime] Singularity functions not available (need SF4)");
        while (true) {
            await ns.sleep(60000);
        }
    }

    const owner = "crime";

    while (true) {
        try {
            const work = ns.singularity.getCurrentWork();
            if (work && work.type === "FACTION") {
                await ns.sleep(30000);
                continue;
            }

            if (!shouldRunCrime(ns)) {
                releaseLock(ns, owner);
                await ns.sleep(30000);
                continue;
            }

            if (!claimLock(ns, owner, 60000)) {
                await ns.sleep(5000);
                continue;
            }

            if (work && work.type && work.type !== "CRIME") {
                await ns.sleep(5000);
                continue;
            }

            const crime = chooseCrime(ns);
            if (!crime) {
                await ns.sleep(10000);
                continue;
            }

            const duration = ns.singularity.commitCrime(crime, config.crime.focus);
            ns.print(`[Crime] Committed ${crime} (${Math.round(duration / 1000)}s)`);
            claimLock(ns, owner, duration + 5000);
            await ns.sleep(duration + 200);
        } catch (e) {
            ns.print(`[Crime] Error: ${e}`);
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

function shouldRunCrime(ns) {
    const money = ns.getServerMoneyAvailable("home");
    return money < config.crime.onlyWhenMoneyBelow;
}

function chooseCrime(ns) {
    let bestCrime = null;
    let bestScore = 0;

    for (const crime of config.crime.crimes) {
        const stats = ns.singularity.getCrimeStats(crime);
        const chance = ns.singularity.getCrimeChance(crime);
        if (chance < config.crime.minSuccessChance) continue;
        const score = (stats.money * chance) / Math.max(1, stats.time);
        if (score > bestScore) {
            bestScore = score;
            bestCrime = crime;
        }
    }

    if (!bestCrime && config.crime.crimes.length > 0) {
        return config.crime.crimes[0];
    }

    return bestCrime;
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
