import { config } from "/angel/config.js";

const CRIME_FACTIONS = [
    "Slum Snakes",
    "Tetrads",
    "Speakers for the Dead",
    "The Syndicate",
    "The Dark Army",
];

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
                if (ui) ui.log(`Joined priority faction: ${faction}`, "success");
            }
        }
    }

    if (config.factions?.autoJoinFactions && invitations.length > 0) {
        for (const faction of invitations) {
            if (joinedFactions.has(faction)) continue;
            const joined = ns.singularity.joinFaction(faction);
            if (joined) {
                joinedFactions.add(faction);
                if (ui) ui.log(`Joined faction: ${faction}`, "success");
            }
        }
    }

    const inviteStr = invitations.join(",");
    if (runtimeState && invitations.length > 0 && (inviteStr !== runtimeState.pendingInvites || runtimeState.loopCount % 24 === 0)) {
        if (ui) ui.log(`Pending invitations: ${invitations.join(", ")}`, "warn");
        runtimeState.pendingInvites = inviteStr;
    }

    return { joinedCount: joinedFactions.size, invitations };
}

export function getMissingCrimeFactions(player) {
    const joined = new Set(player.factions || []);
    return CRIME_FACTIONS.filter((faction) => !joined.has(faction));
}

export function hasSingularityAccess(ns) {
    try {
        ns.singularity.getCurrentWork();
        return true;
    } catch (e) {
        return false;
    }
}
