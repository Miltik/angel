import { config } from "/angel/config.js";
import { getAugmentRepGoal } from "/angel/modules/factions-augments.js";

export async function doFactionWork(ns, ui) {
    const player = ns.getPlayer();
    const augGoal = getAugmentRepGoal(ns);

    if (!augGoal || augGoal.repShort <= 0) {
        return false;
    }

    if (!(player.factions || []).includes(augGoal.faction)) {
        return false;
    }

    const currentWork = ns.singularity.getCurrentWork();
    if (currentWork && currentWork.type === "FACTION" && currentWork.factionName === augGoal.faction) {
        return true;
    }

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
            // Try next work type.
        }
    }

    if (started && ui) {
        const repRemaining = Math.ceil(augGoal.repShort);
        ui.log(`Working for ${augGoal.faction} (${selectedWorkType}) | ${repRemaining} rep needed`, "info");
    }

    return started;
}

export function shouldDoFactionWork(ns) {
    const augGoal = getAugmentRepGoal(ns);
    if (!augGoal || augGoal.repShort <= 0) {
        return false;
    }

    const player = ns.getPlayer();
    return (player.factions || []).includes(augGoal.faction);
}
