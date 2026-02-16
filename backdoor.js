/**
 * ANGEL Backdoor Script
 * Self-contained network crawler that backdoors all hackable servers
 * 
 * Run manually: run /angel/backdoor.js
 * Or let the programs module handle it automatically
 * 
 * @param {NS} ns
 */

export async function main(ns) {
    ns.disableLog("ALL");
    
    ns.tprint("╔════════════════════════════════════════╗");
    ns.tprint("║     ANGEL Backdoor Crawler             ║");
    ns.tprint("╚════════════════════════════════════════╝");
    ns.tprint("");
    
    // Scan all servers
    ns.tprint("Scanning network...");
    const allServers = scanNetwork(ns);
    ns.tprint(`Found ${allServers.length} servers`);
    ns.tprint("");
    
    // Filter to servers we can backdoor
    const hackableServers = allServers.filter(server => {
        // Skip home and purchased servers - can't backdoor own servers
        if (server === "home") return false;
        
        const srv = ns.getServer(server);
        if (srv.purchasedByPlayer) return false; // Skip player-owned servers
        
        // Can backdoor if: rooted AND has backdoor capability AND not already backdoored
        return srv.hasAdminRights && srv.backdoorInstalled === false;
    });
    
    ns.tprint(`${hackableServers.length} servers ready for backdoor`);
    ns.tprint("");
    
    if (hackableServers.length === 0) {
        ns.tprint("✓ All servers already backdoored!");
        return;
    }
    
    // Backdoor each server
    ns.tprint("Installing backdoors...");
    ns.tprint("─────────────────────────────────────────");
    
    let successful = 0;
    let failed = 0;
    
    for (const server of hackableServers) {
        try {
            // Check if we have the required hack level
            const srv = ns.getServer(server);
            if (ns.getPlayer().skills.hacking < srv.requiredHackingSkill) {
                ns.tprint(`✗ ${server} - Hacking level too low (need ${srv.requiredHackingSkill}, have ${ns.getPlayer().skills.hacking})`);
                failed++;
                continue;
            }
            
            // Travel to server and backdoor
            await ns.singularity.connect(server);
            await ns.singularity.installBackdoor();
            ns.tprint(`✓ ${server}`);
            successful++;
            
            // Small delay between backdoors
            await ns.sleep(100);
        } catch (e) {
            ns.tprint(`✗ ${server} - ${e}`);
            failed++;
        }
    }
    
    // Return home
    try {
        await ns.singularity.connect("home");
    } catch (e) {}
    
    ns.tprint("─────────────────────────────────────────");
    ns.tprint("");
    ns.tprint("╔════════════════════════════════════════╗");
    ns.tprint("║        BACKDOOR COMPLETE               ║");
    ns.tprint("╚════════════════════════════════════════╝");
    ns.tprint("");
    ns.tprint(`✓ Successful: ${successful}`);
    ns.tprint(`✗ Failed: ${failed}`);
    ns.tprint("");
}

/**
 * Scan entire network and return all server hostnames
 */
function scanNetwork(ns) {
    const servers = [];
    const visited = new Set();
    const queue = ["home"];
    
    while (queue.length > 0) {
        const server = queue.shift();
        if (visited.has(server)) continue;
        
        visited.add(server);
        servers.push(server);
        
        // Get all connected servers
        const connected = ns.scan(server);
        for (const next of connected) {
            if (!visited.has(next)) {
                queue.push(next);
            }
        }
    }
    
    return servers;
}
