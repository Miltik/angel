
// recursive-nuke.js
// Crawls all servers and attempts to root them using ANGEL's scanner.js utilities.
// Usage: run recursive-nuke.js

import { scanAll, tryGainRoot } from "/angel/scanner.js";

/** @param {NS} ns */
export async function main(ns) {
    const servers = scanAll(ns);
    let rooted = 0;

    for (const server of servers) {
        // Skip home and purchased servers
        if (server === "home" || server.startsWith("angel-")) continue;
        if (tryGainRoot(ns, server)) rooted++;
    }

    ns.tprint(`Recursive nuke complete. Rooted ${rooted} servers.`);
}
