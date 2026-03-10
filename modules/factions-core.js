/**
 * Factions Core - Ultra-lightweight coordinator
 * Monitors faction state and broadcasts to port for other modules
 * Zero imports for minimum RAM footprint
 */

const FACTIONS_PORT = 4;
const TELEMETRY_PORT = 20;

export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("🏛️ Factions coordinator initialized");

    // Check for SF4
    if (!hasSingularityAccess(ns)) {
        ns.print("⚠️ Singularity access not available (need SF4)");
        while (true) await ns.sleep(60000);
    }

    while (true) {
        try {
            reportFactionsTelemetry(ns);
            await ns.sleep(5000);
        } catch (e) {
            if (String(e).includes("ScriptDeath")) return;
            await ns.sleep(5000);
        }
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

function reportFactionsTelemetry(ns) {
    try {
        const player = ns.getPlayer();
        const invitations = ns.singularity.checkFactionInvitations();
        
        // Simple state broadcast - just current factions
        try {
            const statePayload = JSON.stringify({
                ts: Date.now(),
                factions: player.factions || [],
                invites: invitations.length,
            });
            ns.clearPort(FACTIONS_PORT);
            ns.writePort(FACTIONS_PORT, statePayload);
        } catch (e) {
            // Ignore state broadcast failures
        }

        const payload = JSON.stringify({
            module: "factions",
            timestamp: Date.now(),
            metrics: {
                joined: (player.factions || []).length,
                invites: invitations.length,
            },
        });
        ns.tryWritePort(TELEMETRY_PORT, payload);
    } catch (e) {
        // Ignore telemetry write failures
    }
}
