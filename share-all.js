// share-all.js
// Share all free RAM from rooted servers to the current working faction
// Usage: Run this script with the Bitburner NS API

/**
 * @param {NS} ns
 */
export async function main(ns) {
    // Get the current working faction
    const faction = ns.getPlayer().currentWorkFactionName;
    if (!faction) {
        ns.tprint("ERROR: You are not currently working for any faction.");
        return;
    }
    ns.tprint(`Sharing RAM to faction: ${faction}`);

    // Get all rooted servers
    const allServers = ns.scan("home");
    let rootedServers = ["home"];
    let queue = ["home"];
    while (queue.length > 0) {
        const server = queue.pop();
        const neighbors = ns.scan(server);
        for (const neighbor of neighbors) {
            if (!rootedServers.includes(neighbor)) {
                rootedServers.push(neighbor);
                queue.push(neighbor);
            }
        }
    }
    rootedServers = rootedServers.filter(s => ns.hasRootAccess(s));

    // Script name and RAM usage
    const shareScript = "share.js";
    const shareRam = ns.getScriptRam(shareScript);
    if (shareRam === 0) {
        ns.tprint(`ERROR: Script ${shareScript} not found or has 0 RAM usage.`);
        return;
    }

    // Share on all rooted servers
    for (const server of rootedServers) {
        // Skip home if you want
        if (server === "home") continue;
        const maxRam = ns.getServerMaxRam(server);
        const usedRam = ns.getServerUsedRam(server);
        const freeRam = maxRam - usedRam;
        const threads = Math.floor(freeRam / shareRam);
        if (threads > 0) {
            if (!ns.scriptRunning(shareScript, server)) {
                ns.scp(shareScript, server);
            }
            ns.exec(shareScript, server, threads);
            ns.tprint(`Launched ${threads} threads of ${shareScript} on ${server}`);
        }
    }
    ns.tprint("All available RAM is now sharing to your current faction.");
}
