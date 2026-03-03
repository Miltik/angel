import { config } from "/angel/config.js";
import { createWindow } from "/angel/modules/uiManager.js";
import { TELEMETRY_PORT } from "/angel/ports.js";
const CRIME_FACTIONS = [
    "Slum Snakes",
    "Tetrads",
    "Speakers for the Dead",
    "The Syndicate",
    "The Dark Army",
];

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

export function syncFactionMembership(ns, ui, runtimeState = null) {
    const player = ns.getPlayer();
    const joinedFactions = new Set(player.factions || []);
    const invitations = ns.singularity.checkFactionInvitations();

    if (config.factions?.autoJoinFactions && invitations.length > 0) {
        const priorityFactions = config.factions.priorityFactions || [];
        for (const faction of invitations) {
            if (!priorityFactions.includes(faction) || joinedFactions.has(faction)) continue;
            const joined = ns.singularity.joinFaction(faction);
            if (joined) {
                joinedFactions.add(faction);
                if (ui) ui.log(`✅ Joined priority faction: ${faction}`, "success");
            }
        }
    }

    if (config.factions?.autoJoinFactions && invitations.length > 0) {
        for (const faction of invitations) {
            if (joinedFactions.has(faction)) continue;
            const joined = ns.singularity.joinFaction(faction);
            if (joined) {
                joinedFactions.add(faction);
                if (ui) ui.log(`✅ Joined faction: ${faction}`, "success");
            }
        }
    }

    const inviteStr = invitations.join(",");
    if (runtimeState && invitations.length > 0 && (inviteStr !== runtimeState.pendingInvites || runtimeState.loopCount % 24 === 0)) {
        if (ui) ui.log(`📬 Pending invitations: ${invitations.join(", ")}`, "warn");
        runtimeState.pendingInvites = inviteStr;
    }

    return { joinedCount: joinedFactions.size, invitations };
}

export function getMissingCrimeFactions(player) {
    const joined = new Set(player.factions || []);
    return CRIME_FACTIONS.filter(faction => !joined.has(faction));
}

function hasMetAugPrereqs(ns, augName, ownedSet) {
    try {
        const prereqs = ns.singularity.getAugmentationPrereq(augName) || [];
        if (!Array.isArray(prereqs) || prereqs.length === 0) return true;
        return prereqs.every(prereq => ownedSet.has(prereq));
    } catch (e) {
        return true;
    }
}

export function getAugmentRepGoal(ns) {
    try {
        const player = ns.getPlayer();
        const currentMoney = ns.getServerMoneyAvailable("home");
        const owned = ns.singularity.getOwnedAugmentations(true);
        const ownedSet = new Set(owned);
        const priorityList = config.augmentations?.augmentPriority || [];

        const candidates = [];
        for (const faction of player.factions || []) {
            if (faction === "NiteSec") continue;

            const factionRep = ns.singularity.getFactionRep(faction);
            const augments = ns.singularity.getAugmentationsFromFaction(faction) || [];

            for (const aug of augments) {
                if (ownedSet.has(aug)) continue;
                if (!hasMetAugPrereqs(ns, aug, ownedSet)) continue;

                const repReq = ns.singularity.getAugmentationRepReq(aug);
                const price = ns.singularity.getAugmentationPrice(aug);
                const repShort = Math.max(0, repReq - factionRep);
                const moneyShort = Math.max(0, price - currentMoney);

                const moneyGapScore = moneyShort > 0 ? Math.log10(moneyShort + 1) : 0;
                const repGapScore = repShort > 0 ? Math.log10(repShort + 1) : 0;
                const gapScore = moneyGapScore + repGapScore;
                const priorityBonus = priorityList.includes(aug) ? 0.15 : 0;
                const effectiveScore = Math.max(0, gapScore - priorityBonus);

                candidates.push({
                    name: aug,
                    faction,
                    repReq,
                    price,
                    repShort,
                    moneyShort,
                    effectiveScore,
                });
            }
        }

        if (candidates.length === 0) return null;

        candidates.sort((a, b) => {
            if (a.effectiveScore !== b.effectiveScore) return a.effectiveScore - b.effectiveScore;
            const aReady = a.moneyShort === 0 && a.repShort === 0;
            const bReady = b.moneyShort === 0 && b.repShort === 0;
            if (aReady !== bReady) return aReady ? -1 : 1;
            if (a.price !== b.price) return a.price - b.price;
            return a.name.localeCompare(b.name);
        });

        return candidates[0];
    } catch (e) {
        return null;
    }
}

export function hasAnyViableFactionWork(ns) {
    const augGoal = getAugmentRepGoal(ns);
    return Boolean(augGoal && augGoal.repShort > 0);
}

export function getFactionOpportunitySummary(ns, faction) {
    const currentRep = ns.singularity.getFactionRep(faction);
    const augments = ns.singularity.getAugmentationsFromFaction(faction);
    const owned = new Set(ns.singularity.getOwnedAugmentations(true));

    let grindableCount = 0;
    let grindableValue = 0;
    let maxRepNeeded = 0;

    for (const aug of augments) {
        if (owned.has(aug)) continue;

        const repReq = ns.singularity.getAugmentationRepReq(aug);
        const price = ns.singularity.getAugmentationPrice(aug);
        const repNeeded = Math.max(0, repReq - currentRep);

        if (repNeeded > 0) {
            grindableCount++;
            grindableValue += price;
            if (repNeeded > maxRepNeeded) {
                maxRepNeeded = repNeeded;
            }
        }
    }

    return { grindableCount, grindableValue, maxRepNeeded };
}

function reportFactionsTelemetry(ns) {
    try {
        const player = ns.getPlayer();
        const invitations = ns.singularity.checkFactionInvitations();
        const augGoal = getAugmentRepGoal(ns);
        const missingCrime = getMissingCrimeFactions(player);

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

function hasSingularityAccess(ns) {
    try {
        ns.singularity.getCurrentWork();
        return true;
    } catch (e) {
        return false;
    }
}
