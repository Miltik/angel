// recursive-nuke.js
// Recursively scans the network and nukes all servers you can root.
// Usage: run recursive-nuke.js

/** @param {NS} ns */
export async function main(ns) {
    const visited = new Set();
    let rooted = 0;

    function tryNuke(server) {
        if (ns.hasRootAccess(server) || server === "home" || server.startsWith("angel-")) return false;
        let openPorts = 0;
        if (ns.fileExists("BruteSSH.exe", "home")) { ns.brutessh(server); openPorts++; }
        if (ns.fileExists("FTPCrack.exe", "home")) { ns.ftpcrack(server); openPorts++; }
        if (ns.fileExists("relaySMTP.exe", "home")) { ns.relaysmtp(server); openPorts++; }
        if (ns.fileExists("HTTPWorm.exe", "home")) { ns.httpworm(server); openPorts++; }
        if (ns.fileExists("SQLInject.exe", "home")) { ns.sqlinject(server); openPorts++; }
        if (openPorts >= ns.getServerNumPortsRequired(server)) {
            try { ns.nuke(server); return true; } catch { return false; }
        }
        return false;
    }

    function recurse(server) {
        visited.add(server);
        for (const neighbor of ns.scan(server)) {
            if (!visited.has(neighbor)) {
                if (tryNuke(neighbor)) rooted++;
                recurse(neighbor);
            }
        }
    }

    recurse("home");
    ns.tprint(`Recursive nuke complete. Rooted ${rooted} servers.`);
}
