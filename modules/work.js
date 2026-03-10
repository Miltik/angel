/**
 * Work Module - Company and Faction work automation
 * Handles employment and faction reputation grinding
 * 
 * Features:
 * - Faction work for augment reputation
 * - Company work for income
 * - Smart work type selection
 * - Automatic job application
 * 
 * @module modules/work
 */

import { config } from "/angel/config.js";
import { PORTS } from "/angel/config.js";
import {
    doFactionWork as doFactionWorkImpl,
    shouldDoFactionWork as shouldDoFactionWorkImpl,
} from "/angel/modules/work-faction.js";
import {
    doCompanyWork as doCompanyWorkImpl,
    shouldDoCompanyWork as shouldDoCompanyWorkImpl,
} from "/angel/modules/work-company.js";

export function doFactionWork(ns, ui = null, context = {}) {
    return doFactionWorkImpl(ns, ui, context);
}

export function shouldDoFactionWork(ns) {
    return shouldDoFactionWorkImpl(ns);
}

export function doCompanyWork(ns, ui = null, context = {}) {
    return doCompanyWorkImpl(ns, ui, context);
}

export function shouldDoCompanyWork(ns) {
    return shouldDoCompanyWorkImpl(ns);
}


/**
 * Get current work status
 * @param {NS} ns
 * @returns {Object|null}
 */
export function getCurrentWorkStatus(ns) {
    const currentWork = ns.singularity.getCurrentWork();
    if (!currentWork) return null;

    return {
        type: currentWork.type,
        faction: currentWork.factionName,
        company: currentWork.companyName,
        workType: currentWork.factionWorkType || currentWork.workType,
        crime: currentWork.crimeType,
    };
}

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    while (true) {
        try {
            const modeRaw = ns.peek(PORTS.ACTIVITY_MODE);
            const mode = modeRaw === "NULL PORT DATA" ? "none" : String(modeRaw).toLowerCase();
            const currentWork = ns.singularity.getCurrentWork();

            if (mode === "faction") {
                const alreadyFaction = String(currentWork?.type || "").toUpperCase() === "FACTION";
                if (!alreadyFaction) {
                    await doFactionWork(ns, null, {});
                }
            } else if (mode === "company") {
                const alreadyCompany = String(currentWork?.type || "").toUpperCase() === "COMPANY";
                if (!alreadyCompany) {
                    await doCompanyWork(ns, null, {});
                }
            }

            await ns.sleep(5000);
        } catch (e) {
            if (String(e).includes("ScriptDeath")) return;
            await ns.sleep(5000);
        }
    }
}
