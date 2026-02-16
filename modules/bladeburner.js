/**
 * Bladeburner automation module (phase-aware: active in phase 4 only)
 * Final-stage content: contracts, operations, and black ops
 * 
 * @param {NS} ns
 */
import { config } from "/angel/config.js";
import { createWindow } from "/angel/modules/uiManager.js";
import { log } from "/angel/utils.js";

const PHASE_PORT = 7;

/**
 * Read current game phase from orchestrator
 */
function readGamePhase(ns) {
    const phasePortData = ns.peek(PHASE_PORT);
    if (phasePortData === "NULL PORT DATA") return 0;
    return parseInt(phasePortData) || 0;
}

/**
 * Get phase config
 */
function getPhaseConfig(phase) {
    const phaseKey = `phase${phase}`;
    return config.gamePhases[phaseKey] || config.gamePhases.phase0;
}

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("bladeburner", "⚔️ Bladeburner", 700, 400, ns);
    ui.log("Bladeburner module started - Phase-gated (P4 only)", "info");

    // Wait for phase 4 (very late game, close to daemon)
    while (true) {
        const gamePhase = readGamePhase(ns);
        if (gamePhase >= 4) break;
        ui.log(`Waiting for phase 4 (currently P${gamePhase})`, "info");
        await ns.sleep(60000);
    }

    if (!ns.bladeburner.inBladeburner()) {
        ui.log("⚔️  Not in Bladeburner yet - idle", "warn");
        while (true) {
            await ns.sleep(60000);
        }
    }

    ui.log("⚔️  Bladeburner active", "success");

    while (true) {
        try {
            const gamePhase = readGamePhase(ns);
            if (gamePhase < 4) {
                ui.log("⚔️  Phase dropped below 4 - pausing", "warn");
                await ns.sleep(60000);
                continue;
            }

            const action = chooseAction(ns);
            if (action) {
                const success = ns.bladeburner.startAction(action.type, action.name);
                if (success) {
                    ui.log(`⚔️  Started ${action.type}: ${action.name} (Success: ${(action.chance * 100).toFixed(1)}%)`, "debug");
                }
            }

            const stats = ns.bladeburner.getStamina();
            const staminaRatio = stats[0] / stats[1];
            if (staminaRatio < 0.5) {
                ui.log(`⚔️  Stamina low (${(staminaRatio * 100).toFixed(0)}%) - resting`, "info");
            }

            await ns.sleep(config.bladeburner.loopDelay || 30000);
        } catch (e) {
            ui.log(`⚔️  Error: ${e}`, "error");
            await ns.sleep(5000);
        }
    }
}

/**
 * Choose the best action based on stamina and success chance
 */
function chooseAction(ns) {
    const stamina = ns.bladeburner.getStamina();
    const staminaRatio = stamina[0] / stamina[1];
    const staminaThreshold = config.bladeburner.staminaThreshold || 0.5;
    
    // If stamina is low, rest or do field analysis
    if (staminaRatio < staminaThreshold) {
        return {
            type: "General",
            name: "Field Analysis",
            chance: 1.0
        };
    }

    // Try contracts (high reward)
    const contracts = config.bladeburner.contracts || ["Assassination", "Bounty Hunter"];
    const minSuccessChance = config.bladeburner.minSuccessChance || 0.6;
    
    for (const name of contracts) {
        try {
            const chance = ns.bladeburner.getActionEstimatedSuccessChance("Contract", name);
            if (chance[0] >= minSuccessChance) {
                return {
                    type: "Contract",
                    name,
                    chance: chance[0]
                };
            }
        } catch (e) {
            // Contract not available or error
        }
    }

    // Try operations (medium reward)
    const operations = config.bladeburner.operations || ["Investigation", "Undercover Operation"];
    for (const name of operations) {
        try {
            const chance = ns.bladeburner.getActionEstimatedSuccessChance("Operation", name);
            if (chance[0] >= minSuccessChance * 0.8) {  // Slightly lower threshold for ops
                return {
                    type: "Operation",
                    name,
                    chance: chance[0]
                };
            }
        } catch (e) {
            // Operation not available
        }
    }

    // Fallback: Training or field analysis
    return {
        type: "General",
        name: "Training",
        chance: 1.0
    };
}
