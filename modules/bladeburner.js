/**
 * Bladeburner automation module (phase-aware: active phase 4 only)
 * @param {NS} ns
 */
import { config } from "/angel/config.js";

const PHASE_PORT = 7; // Read game phase from orchestrator

/**
 * Read current game phase from orchestrator
 */
function readGamePhase(ns) {
    return parseInt(ns.peek(PHASE_PORT)) || 0;
}

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.print("[Bladeburner] Module started");

    while (true) {
        try {
            // Bladeburner only active in phase 4 (very late game)
            const gamePhase = readGamePhase(ns);
            if (gamePhase < 4) {
                ns.print("[Bladeburner] Waiting for phase 4 to enable Bladeburner");
                await ns.sleep(60000);
                continue;
            }

            if (!ns.bladeburner.inBladeburner()) {
                ns.print("[Bladeburner] Not in Bladeburner - idle");
                await ns.sleep(60000);
                continue;
            }

            const action = chooseAction(ns);
            if (action) {
                ns.bladeburner.startAction(action.type, action.name);
                ns.print(`[Bladeburner] ${action.type}: ${action.name}`);
            }

            await ns.sleep(config.bladeburner.loopDelay);
        } catch (e) {
            ns.print(`[Bladeburner] Error: ${e}`);
            await ns.sleep(5000);
        }
    }
}

function chooseAction(ns) {
    const stamina = ns.bladeburner.getStamina();
    if (stamina[0] < stamina[1] * config.bladeburner.staminaThreshold) {
        return { type: "General", name: "Field Analysis" };
    }

    for (const name of config.bladeburner.contracts) {
        const chance = ns.bladeburner.getActionEstimatedSuccessChance("Contract", name);
        if (chance[0] >= config.bladeburner.minSuccessChance) {
            return { type: "Contract", name };
        }
    }

    return { type: "General", name: "Training" };
}
