/**
 * Company work automation module - DEPRECATED
 * Handling delegated to crime.js (merged Activity + Factions module)
 * @param {NS} ns
 */
import { config, PORTS } from "/angel/config.js";

export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("🏢 Company work handling delegated to crime.js (merged Activity module)");
    ns.print("This module kept for compatibility but all activity logic is in crime.js");

    if (!hasSingularityAccess(ns)) {
        ns.print("Singularity functions not available (need SF4)");
        while (true) {
            await ns.sleep(60000);
        }
    }

    // This module is now delegated to crime.js
    while (true) {
        ns.print("Company module idle - see crime.js for Activity + Factions handling");
        await ns.sleep(30000);
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
