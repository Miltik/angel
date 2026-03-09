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
import { formatMoney } from "/angel/utils.js";
import { getAugmentRepGoal } from "/angel/modules/factions.js";

/**
 * Work for a faction to gain reputation
 * @param {NS} ns
 * @param {Object} ui - UI window API
 * @returns {Promise<boolean>} - True if faction work was started
 */
export async function doFactionWork(ns, ui) {
    const player = ns.getPlayer();
    const augGoal = getAugmentRepGoal(ns);

    if (!augGoal || augGoal.repShort <= 0) {
        return false; // No faction work needed
    }

    if (!(player.factions || []).includes(augGoal.faction)) {
        return false; // Not a member of target faction
    }

    // Check if already working for this faction
    const currentWork = ns.singularity.getCurrentWork();
    if (currentWork && currentWork.type === "FACTION" && currentWork.factionName === augGoal.faction) {
        return true; // Already doing faction work
    }

    // Try different work types
    const configuredWorkType = config.factions?.workType || "Hacking Contracts";
    const workTypes = [configuredWorkType, "Hacking Contracts", "Field Work", "Security Work"];
    let started = false;
    let selectedWorkType = configuredWorkType;

    for (const workType of [...new Set(workTypes)]) {
        try {
            if (ns.singularity.workForFaction(augGoal.faction, workType, config.factions?.focus || false)) {
                started = true;
                selectedWorkType = workType;
                break;
            }
        } catch (e) {
            // Work type not available, try next
        }
    }

    if (started && ui) {
        const repRemaining = Math.ceil(augGoal.repShort);
        ui.log(`🤝 Working for ${augGoal.faction} (${selectedWorkType}) | ${repRemaining} rep needed`, "info");
    }

    return started;
}

/**
 * Work for a company to earn money
 * @param {NS} ns
 * @param {Object} ui - UI window API
 * @returns {Promise<boolean>} - True if company work was started
 */
export async function doCompanyWork(ns, ui) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home");
    const threshold = config.company?.onlyWhenMoneyBelow || 200000000;

    // Only work for company if money is below threshold
    if (money >= threshold) {
        return false;
    }

    // Check if already working
    const currentWork = ns.singularity.getCurrentWork();
    if (currentWork && currentWork.type === "COMPANY") {
        return true; // Already working
    }

    // Travel to work city if configured
    if (config.training?.autoTravel) {
        try {
            ns.singularity.travelToCity(config.training?.city || "Chongqing");
        } catch (e) {
            // Travel failed, continue anyway
        }
    }

    // Try to get a job at various companies
    const companies = ["ECorp", "MegaCorp", "Bachman & Associates", "Blade Industries", "NWO"];
    let placed = false;
    let selectedCompany = null;

    for (const company of companies) {
        try {
            const success = ns.singularity.workForCompany(company, config.company?.focus || false);
            if (success) {
                placed = true;
                selectedCompany = company;
                break;
            }
        } catch (e) {
            // Job not available, try next
        }
    }

    if (placed && ui) {
        ui.log(`💼 Working for ${selectedCompany} | ${formatMoney(money)}/${formatMoney(threshold)}`, "info");
    }

    return placed;
}

/**
 * Check if faction work is available and needed
 * @param {NS} ns
 * @returns {boolean}
 */
export function shouldDoFactionWork(ns) {
    const augGoal = getAugmentRepGoal(ns);
    if (!augGoal || augGoal.repShort <= 0) {
        return false;
    }

    const player = ns.getPlayer();
    return (player.factions || []).includes(augGoal.faction);
}

/**
 * Check if company work is available and needed
 * @param {NS} ns
 * @returns {boolean}
 */
export function shouldDoCompanyWork(ns) {
    const money = ns.getServerMoneyAvailable("home");
    const threshold = config.company?.onlyWhenMoneyBelow || 200000000;
    return money < threshold;
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
