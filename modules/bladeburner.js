/**
 * Bladeburner automation module
 * @param {NS} ns
 */
import { config } from "/angel/config.js";

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.print("[Bladeburner] Module started");

    while (true) {
        try {
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
