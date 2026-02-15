/**
 * Company work automation module
 * @param {NS} ns
 */
import { config, PORTS } from "/angel/config.js";

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.print("[Company] Module started");

    if (!hasSingularityAccess(ns)) {
        ns.print("[Company] Singularity functions not available (need SF4)");
        while (true) {
            await ns.sleep(60000);
        }
    }

    const owner = "company";

    while (true) {
        try {
            const work = ns.singularity.getCurrentWork();
            if (work && work.type === "FACTION") {
                await ns.sleep(30000);
                continue;
            }

            const desired = getDesiredActivity(ns);
            if (desired !== "none" && desired !== "company") {
                releaseLock(ns, owner);
                await ns.sleep(30000);
                continue;
            }

            const money = ns.getServerMoneyAvailable("home");
            if (money >= config.company.onlyWhenMoneyBelow) {
                releaseLock(ns, owner);
                await ns.sleep(30000);
                continue;
            }

            if (!claimLock(ns, owner, 60000)) {
                await ns.sleep(5000);
                continue;
            }

            if (work && work.type && work.type !== "COMPANY") {
                await ns.sleep(5000);
                continue;
            }

            let job = getCurrentJob(ns);
            if (!job && config.company.autoApply) {
                job = tryApplyForJob(ns);
            }

            if (job) {
                ns.singularity.workForCompany(job.company, config.company.focus);
                ns.print(`[Company] Working at ${job.company} (${job.position})`);
            } else {
                ns.print("[Company] No job found - waiting");
            }

            await ns.sleep(60000);
        } catch (e) {
            ns.print(`[Company] Error: ${e}`);
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

function getCurrentJob(ns) {
    for (const company of config.company.preferredCompanies) {
        const position = ns.singularity.getCompanyPosition(company);
        if (position && position !== "Unemployed") {
            return { company, position };
        }
    }
    return null;
}

function tryApplyForJob(ns) {
    for (const company of config.company.preferredCompanies) {
        for (const field of config.company.preferredFields) {
            const success = ns.singularity.applyToCompany(company, field);
            if (success) {
                return { company, position: field };
            }
        }
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
