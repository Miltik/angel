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
import { doFactionWork, shouldDoFactionWork } from "/angel/modules/work-faction.js";
import { doCompanyWork, shouldDoCompanyWork } from "/angel/modules/work-company.js";

export { doFactionWork, shouldDoFactionWork } from "/angel/modules/work-faction.js";
export { doCompanyWork, shouldDoCompanyWork } from "/angel/modules/work-company.js";


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
    ns.tprint("=== Work Module ===");
    ns.tprint("");
    
    const status = getCurrentWorkStatus(ns);
    if (status) {
        ns.tprint(`Current work: ${status.type}`);
        if (status.faction) ns.tprint(`  Faction: ${status.faction} (${status.workType})`);
        if (status.company) ns.tprint(`  Company: ${status.company}`);
        if (status.crime) ns.tprint(`  Crime: ${status.crime}`);
    } else {
        ns.tprint("Not currently working");
    }
    
    ns.tprint("");
    ns.tprint(`Should do faction work: ${shouldDoFactionWork(ns)}`);
    ns.tprint(`Should do company work: ${shouldDoCompanyWork(ns)}`);
}
