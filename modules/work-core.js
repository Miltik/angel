/**
 * Work Core - Ultra-lightweight worker wrapper
 * Handles faction and company work based on activity mode
 * Zero imports for minimum RAM footprint
 */

const ACTIVITY_MODE_PORT = 6;
const FACTIONS_PORT = 4;

export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("💼 Work coordinator initialized");

    while (true) {
        try {
            const modeRaw = ns.peek(ACTIVITY_MODE_PORT);
            const mode = modeRaw === "NULL PORT DATA" ? "none" : String(modeRaw).toLowerCase();
            const currentWork = ns.singularity.getCurrentWork();

            if (mode === "faction") {
                const alreadyFaction = String(currentWork?.type || "").toUpperCase() === "FACTION";
                if (!alreadyFaction) {
                    await doFactionWorkLite(ns);
                }
            } else if (mode === "company") {
                const alreadyCompany = String(currentWork?.type || "").toUpperCase() === "COMPANY";
                if (!alreadyCompany) {
                    await doCompanyWorkLite(ns);
                }
            }

            await ns.sleep(5000);
        } catch (e) {
            if (String(e).includes("ScriptDeath")) return;
            await ns.sleep(5000);
        }
    }
}

/**
 * Lightweight faction work - no heavy imports
 * @param {NS} ns
 */
async function doFactionWorkLite(ns) {
    try {
        const player = ns.getPlayer();
        const factions = player.factions || [];
        
        if (factions.length === 0) return;

        // Read faction focus from factions port
        let targetFaction = null;
        try {
            const factionsData = ns.peek(FACTIONS_PORT);
            if (factionsData !== "NULL PORT DATA") {
                const parsed = JSON.parse(factionsData);
                targetFaction = parsed.factionFocus;
            }
        } catch (e) {
            // Ignore parse failures
        }

        // Fallback: use first faction
        const faction = targetFaction && factions.includes(targetFaction) ? targetFaction : factions[0];
        
        // Try field work first (best rep), fallback to hacking
        let started = ns.singularity.workForFaction(faction, "Field Work", false);
        if (!started) {
            started = ns.singularity.workForFaction(faction, "Hacking Contracts", false);
        }
        
        if (started) {
            ns.print(`💼 Started faction work: ${faction}`);
        }
    } catch (e) {
        ns.print(`⚠️ Faction work error: ${e}`);
    }
}

/**
 * Lightweight company work - no heavy imports
 * @param {NS} ns
 */
async function doCompanyWorkLite(ns) {
    try {
        const player = ns.getPlayer();
        const jobs = player.jobs || {};
        const companies = Object.keys(jobs);
        
        if (companies.length === 0) {
            // Try to get a job if none exists
            const targetCompanies = [
                "MegaCorp", "ECorp", "Blade Industries", 
                "NWO", "Clarke Incorporated", "OmniTek Incorporated"
            ];
            
            for (const company of targetCompanies) {
                const applied = ns.singularity.applyToCompany(company, "Software");
                if (applied) {
                    ns.print(`💼 Got job at: ${company}`);
                    break;
                }
            }
        }
        
        // Work at current company
        if (companies.length > 0) {
            const company = companies[0];
            const started = ns.singularity.workForCompany(company, false);
            if (started) {
                ns.print(`💼 Started company work: ${company}`);
            }
        }
    } catch (e) {
        ns.print(`⚠️ Company work error: ${e}`);
    }
}
