import { config, PORTS } from "/angel/config.js";
import { createWindow } from "/angel/modules/uiManager.js";
import { TELEMETRY_PORT } from "/angel/ports.js";
import {
    syncFactionMembership as syncFactionMembershipImpl,
    getMissingCrimeFactions as getMissingCrimeFactionsImpl,
    hasSingularityAccess as hasSingularityAccessImpl,
} from "/angel/modules/factions-membership.js";
import {
    getAugmentRepGoal as getAugmentRepGoalImpl,
    hasAnyViableFactionWork as hasAnyViableFactionWorkImpl,
    getFactionOpportunitySummary as getFactionOpportunitySummaryImpl,
} from "/angel/modules/factions-augments.js";

// Legacy-compatible explicit exports (avoid re-export syntax for Netscript parser compatibility)
export function syncFactionMembership(ns, ui, state) {
    return syncFactionMembershipImpl(ns, ui, state);
}

export function getMissingCrimeFactions(player) {
    return getMissingCrimeFactionsImpl(player);
}

export function hasSingularityAccess(ns) {
    return hasSingularityAccessImpl(ns);
}

export function getAugmentRepGoal(ns) {
    return getAugmentRepGoalImpl(ns);
}

export function hasAnyViableFactionWork(ns, player) {
    return hasAnyViableFactionWorkImpl(ns, player);
}

export function getFactionOpportunitySummary(ns, faction) {
    return getFactionOpportunitySummaryImpl(ns, faction);
}

const state = {
    loopCount: 0,
    pendingInvites: null,
    lastReportTime: 0,
};

export async function main(ns) {
    ns.disableLog("ALL");

    const ui = createWindow("factions", "🏛️ Factions", 680, 420, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ui.log("🏛️ Factions intelligence initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    if (!hasSingularityAccess(ns)) {
        ui.log("⚠️ Singularity access not available (need SF4)", "warn");
        while (true) await ns.sleep(60000);
    }

    while (true) {
        try {
            state.loopCount++;
            syncFactionMembership(ns, ui, state);

            const now = Date.now();
            if (now - state.lastReportTime >= 5000) {
                reportFactionsTelemetry(ns);
                state.lastReportTime = now;
            }

            await ns.sleep(5000);
        } catch (e) {
            if (String(e).includes("ScriptDeath")) return;
            await ns.sleep(5000);
        }
    }
}


function reportFactionsTelemetry(ns) {
    try {
        const player = ns.getPlayer();
        const invitations = ns.singularity.checkFactionInvitations();
        const augGoal = getAugmentRepGoal(ns);
        const missingCrime = getMissingCrimeFactions(player);

        try {
            const statePayload = JSON.stringify({
                ts: Date.now(),
                hasViableFactionWork: Boolean(augGoal && augGoal.repShort > 0),
                factionFocus: augGoal?.faction || "none",
                factionRepNeeded: Math.floor(augGoal?.repShort || 0),
                targetAugName: augGoal?.name || "none",
            });
            ns.clearPort(PORTS.FACTIONS);
            ns.writePort(PORTS.FACTIONS, statePayload);
        } catch (e) {
            // Ignore state broadcast failures.
        }

        const payload = JSON.stringify({
            module: "factions",
            timestamp: Date.now(),
            metrics: {
                joined: (player.factions || []).length,
                invites: invitations.length,
                missingCrimeFactions: missingCrime.length,
                factionFocus: augGoal?.faction || "none",
                factionRepNeeded: Math.floor(augGoal?.repShort || 0),
                targetAugName: augGoal?.name || "none",
                targetAugCost: Number(augGoal?.price || 0),
                targetMoneyNeeded: Number(augGoal?.moneyShort || 0),
            },
        });
        ns.tryWritePort(TELEMETRY_PORT, payload);
    } catch (e) {
        // Ignore telemetry write failures
    }
}

