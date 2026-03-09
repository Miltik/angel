/**
 * ANGEL Dashboard - Combat & Network Stats Module
 * Extracted for RAM efficiency: handles combat skills display and network metrics
 * 
 * @param {NS} ns
 */

/**
 * Display player combat skills (Strength, Defense, Dexterity, Agility)
 * @param {object} ui - UI window
 * @param {NS} ns
 */
export function displayNetworkStatus(ui, ns) {
    const player = ns.getPlayer();
    const stats = [
        {name: "Strength", val: player.skills.strength},
        {name: "Defense", val: player.skills.defense},
        {name: "Dexterity", val: player.skills.dexterity},
        {name: "Agility", val: player.skills.agility},
    ];
    
    const statLine = stats.map(s => `${s.name}: ${s.val.toString().padStart(4)}`).join(" | ");
    ui.log(`⚔️  COMBAT: ${statLine}`, "info");
}

/**
 * Display World Daemon status
 * @param {object} ui - UI window
 * @param {NS} ns
 */
export function displayWorldDaemonStatus(ui, ns) {
    const daemonHost = "w0r1d_d43m0n";
    const lockPort = 15;

    let requiredHack = 3000;
    let currentHack = 0;
    let rooted = false;
    let hasRedPill = false;
    let unlocked = false;

    try {
        requiredHack = Number(ns.getServerRequiredHackingLevel(daemonHost) || 3000);
    } catch (e) {}

    try {
        currentHack = Number(ns.getPlayer()?.skills?.hacking || 0);
    } catch (e) {}

    try {
        rooted = Boolean(ns.hasRootAccess(daemonHost));
    } catch (e) {}

    try {
        const installed = ns.singularity.getOwnedAugmentations(false) || [];
        const queued = ns.singularity.getOwnedAugmentations(true) || [];
        hasRedPill = installed.includes("The Red Pill") || queued.includes("The Red Pill");
    } catch (e) {}

    try {
        unlocked = ns.peek(lockPort) === "UNLOCK_DAEMON";
    } catch (e) {
        unlocked = false;
    }

    const ready = hasRedPill && rooted && currentHack >= requiredHack;
    const lockEmoji = unlocked ? "🔓" : "🔒";
    const readyEmoji = ready ? "✅" : "⏳";
    ui.log(`🌐 WORLD DAEMON: ${lockEmoji} LOCKED | ${readyEmoji} READY`, "info");
}
