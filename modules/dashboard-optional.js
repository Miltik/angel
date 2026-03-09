/**
 * ANGEL Dashboard - Optional Systems Module
 * Extracted for RAM efficiency: handles all optional/late-game systems
 * 
 * Includes: Gang, Bladeburner, Sleeves, Hacknet, Programs, Contracts, Loot, Formulas
 * 
 * @param {NS} ns
 */

import { formatMoney } from "/angel/utils.js";
import { scanAll } from "/angel/services/network.js";

/**
 * Display gang information (territory, members, respect, wanted level)
 * @param {object} ui - UI window
 * @param {NS} ns
 */
export function displayGangStatus(ui, ns) {
    try {
        const info = ns.gang.getGangInformation();
        const members = ns.gang.getMemberNames();
        const territory = (info.territory * 100).toFixed(1);
        
        ui.log(`👾 GANG: ${info.faction} | Members: ${members.length} | Territory: ${territory}% | Power: ${info.power.toFixed(2)}`, "info");
        ui.log(`   Respect: ${formatMoney(info.respect)} | Wanted: ${info.wantedLevel.toFixed(0)} (×${info.wantedPenalty.toFixed(2)})`, "info");
    } catch (e) {
        // Gang not available
    }
}

/**
 * Display bladeburner rank, stamina, and current action
 * @param {object} ui - UI window
 * @param {NS} ns
 */
export function displayBladeburnerStatus(ui, ns) {
    try {
        const rank = ns.bladeburner.getRank();
        const stamina = ns.bladeburner.getStamina();
        const maxStamina = stamina[1];
        const currentStamina = stamina[0];
        const staminaPct = (currentStamina / maxStamina * 100).toFixed(0);
        
        const currentAction = ns.bladeburner.getCurrentAction();
        let actionText = "Idle";
        if (currentAction && currentAction.type !== "Idle") {
            actionText = `${currentAction.name} (${currentAction.type})`;
        }
        
        const city = ns.bladeburner.getCity();
        const staminaBar = "▮".repeat(Math.floor(currentStamina / maxStamina * 20)) + 
                          "▯".repeat(20 - Math.floor(currentStamina / maxStamina * 20));
        
        ui.log(`🗡️  BLADEBURNER: Rank ${rank.toFixed(0)} | ${city}`, "info");
        ui.log(`   Action: ${actionText} | Stamina: ${staminaBar} ${staminaPct}%`, "info");
    } catch (e) {
        // Bladeburner not available
    }
}

/**
 * Display sleeve information (count, current tasks, sync status, shock)
 * @param {object} ui - UI window
 * @param {NS} ns
 */
export function displaySleevesStatus(ui, ns) {
    try {
        const numSleeves = ns.sleeve.getNumSleeves();
        if (numSleeves === 0) return;
        
        const sleeves = [];
        for (let i = 0; i < numSleeves; i++) {
            const task = ns.sleeve.getTask(i);
            const stats = ns.sleeve.getSleeve(i);
            
            let activity = "Idle";
            if (task) {
                if (task.type === "FACTION") {
                    activity = `${task.factionName} (${task.factionWorkType})`;
                } else if (task.type === "COMPANY") {
                    activity = `${task.companyName}`;
                } else if (task.type === "CRIME") {
                    activity = `Crime: ${task.crimeType}`;
                } else if (task.type === "CLASS") {
                    activity = `Study: ${task.classType}`;
                } else if (task.type === "SYNCHRO") {
                    activity = `Synchronizing`;
                } else if (task.type === "RECOVERY") {
                    activity = `Recovering ${stats.shock}%`;
                } else {
                    activity = task.type;
                }
            }
            
            sleeves.push({
                id: i,
                activity: activity,
                sync: Math.floor(stats.sync),
                shock: Math.floor(stats.shock)
            });
        }
        
        ui.log(`👥 SLEEVES (${numSleeves}):`, "info");
        for (const sleeve of sleeves) {
            const syncBar = "█".repeat(Math.floor(sleeve.sync / 5)) + "░".repeat(20 - Math.floor(sleeve.sync / 5));
            ui.log(`   #${sleeve.id}: ${sleeve.activity.padEnd(30)} | Sync: ${syncBar} ${sleeve.sync}% | Shock: ${sleeve.shock}%`, "info");
        }
    } catch (e) {
        // Sleeves not available
    }
}

/**
 * Display hacknet node production and totals
 * @param {object} ui - UI window
 * @param {NS} ns
 */
export function displayHacknetStatus(ui, ns) {
    try {
        const numNodes = ns.hacknet.numNodes();
        if (numNodes === 0) {
            ui.log(`🌐 HACKNET: No nodes purchased`, "info");
            return;
        }
        
        let totalProduction = 0;
        let totalValue = 0;
        
        for (let i = 0; i < numNodes; i++) {
            const node = ns.hacknet.getNodeStats(i);
            totalProduction += Number(node?.production || 0);
            totalValue += Number(node?.totalProduction || 0);
        }
        
        const productionPerSec = totalProduction;
        const productionPerHour = productionPerSec * 3600;
        
        ui.log(`🌐 HACKNET: ${numNodes} nodes | Production: ${formatMoney(productionPerSec)}/s (${formatMoney(productionPerHour)}/hr) | Total: ${formatMoney(totalValue)}`, "info");
    } catch (e) {
        // Hacknet error
    }
}

/**
 * Display program creation status and inventory
 * @param {object} ui - UI window
 * @param {NS} ns
 */
export function displayProgramsStatus(ui, ns) {
    try {
        // Check if creating a program
        const work = ns.singularity.getCurrentWork();
        if (work && work.type === "CREATE_PROGRAM") {
            const percent = work.cyclesWorked ? (work.cyclesWorked / 100).toFixed(1) : 0;
            const progressBar = "▮".repeat(Math.floor(percent / 5)) + "▯".repeat(20 - Math.floor(percent / 5));
            ui.log(`💾 PROGRAMS: Creating ${work.programName} ${progressBar} ${percent}%`, "info");
            return;
        }
        
        // List available programs to create
        const programs = [
            "BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe",
            "DeepscanV1.exe", "DeepscanV2.exe", "ServerProfiler.exe", "AutoLink.exe",
            "Formulas.exe"
        ];
        
        const owned = programs.filter(p => ns.fileExists(p, "home"));
        const missing = programs.filter(p => !ns.fileExists(p, "home"));
        
        if (missing.length === 0) {
            ui.log(`💾 PROGRAMS: All ${owned.length} programs owned ✓`, "info");
        } else {
            ui.log(`💾 PROGRAMS: ${owned.length}/${programs.length} owned | Missing: ${missing[0]}${missing.length > 1 ? ` +${missing.length - 1} more` : ''}`, "info");
        }
    } catch (e) {
        // Singularity not available
    }
}

/**
 * Display coding contracts pending on network
 * @param {object} ui - UI window
 * @param {NS} ns
 */
export function displayContractsStatus(ui, ns) {
    try {
        let contractCount = 0;
        
        // Scan all servers for contracts
        const servers = getAllServersForOptional(ns);
        for (const server of servers) {
            try {
                const contracts = ns.ls(server, ".cct");
                contractCount += contracts.length;
            } catch (e) {
                // Ignore inaccessible servers
            }
        }
        
        if (contractCount === 0) {
            ui.log(`📋 CONTRACTS: No pending contracts | ✅ Solving complete`, "info");
        } else {
            ui.log(`📋 CONTRACTS: ${contractCount} pending on network`, "info");
        }
    } catch (e) {
        ui.log(`📋 CONTRACTS: Error - ${e.message.substring(0, 30)}`, "warn");
    }
}

/**
 * Display loot archive status
 * @param {object} ui - UI window
 * @param {NS} ns
 */
export function displayLootStatus(ui, ns) {
    const lootFiles = ns.ls("home", "/angel/loot/").filter(file => file !== "/angel/loot/loot.txt");
    const seedExists = ns.fileExists("/angel/loot/loot.txt", "home");

    if (!seedExists && lootFiles.length === 0) {
        ui.log("📚 LOOT: Archive not initialized", "info");
        return;
    }

    ui.log(`📚 LOOT: ${lootFiles.length} archived files${seedExists ? " | seed ready" : ""}`, "info");
}

/**
 * Display Formulas.exe status
 * @param {object} ui - UI window
 * @param {NS} ns
 */
export function displayFormulasStatus(ui, ns) {
    try {
        const hasFormulas = ns.fileExists("Formulas.exe", "home");
        
        if (!hasFormulas) {
            ui.log(`📐 FORMULAS: Not yet acquired | Searching for hashes...`, "info");
        } else {
            ui.log(`📐 FORMULAS: ✅ Active | Farming optimizations...`, "success");
        }
    } catch (e) {
        ui.log(`📐 FORMULAS: Error - ${e.message.substring(0, 30)}`, "warn");
    }
}

/**
 * Check if player has Bladeburner access
 * @param {NS} ns
 * @returns {boolean}
 */
export function hasBladeburnerAccess(ns) {
    try {
        ns.bladeburner.inBladeburner();
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Get cached servers for optional systems (uses existing cache from metrics)
 * @param {NS} ns
 * @returns {Array<string>}
 */
function getAllServersForOptional(ns) {
    try {
        return scanAll(ns);
    } catch (e) {
        return [];
    }
}
