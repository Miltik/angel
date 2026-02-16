/**
 * ANGEL Backdoor Script
 * Simple recursive crawler that backdoors all reachable servers
 * 
 * Run manually: run /angel/backdoor.js
 * 
 * @param {NS} ns
 */

export async function main(ns) {
    ns.disableLog("ALL");
    
    ns.tprint("╔════════════════════════════════════════╗");
    ns.tprint("║     ANGEL Backdoor Crawler             ║");
    ns.tprint("╚════════════════════════════════════════╝");
    ns.tprint("");
    
    const visited = new Set();
    let backdoored = 0;
    let attempted = 0;
    
    async function crawl(server, parent = null) {
        if (visited.has(server)) return;
        visited.add(server);
        
        if (parent) {
            const connected = ns.singularity.connect(server);
            if (!connected) {
                ns.tprint(`✗ ${server}: connect failed`);
                return;
            }
        }
        
        if (server !== "home") {
            const srv = ns.getServer(server);
            const isPServer = ns.getPurchasedServers().includes(server);
            const canBackdoor = srv.backdoorInstalled !== undefined;
            const hackLevelOk = ns.getPlayer().skills.hacking >= srv.requiredHackingSkill;
            
            if (!isPServer && canBackdoor && srv.hasAdminRights && !srv.backdoorInstalled && hackLevelOk) {
                attempted++;
                try {
                    await ns.singularity.installBackdoor();
                    backdoored++;
                    ns.tprint(`✓ ${server}`);
                } catch (e) {
                    ns.tprint(`✗ ${server}: ${String(e).substring(0, 40)}`);
                }
            }
        }
        
        let adjacent = [];
        try {
            adjacent = ns.scan(server);
        } catch (e) {
            ns.tprint(`! Failed to scan ${server}: ${String(e).substring(0, 30)}`);
        }
        
        for (const next of adjacent) {
            if (next !== parent) {
                await crawl(next, server);
            }
        }
        
        if (parent) {
            ns.singularity.connect(parent);
        }
    }
    
    ns.tprint("Starting recursive crawler from home...");
    ns.tprint("─────────────────────────────────────────");
    await crawl("home");
    
    ns.tprint("─────────────────────────────────────────");
    ns.tprint("");
    ns.tprint("╔════════════════════════════════════════╗");
    ns.tprint("║        BACKDOOR COMPLETE               ║");
    ns.tprint("╚════════════════════════════════════════╝");
    ns.tprint("");
    ns.tprint(`✓ Backdoored: ${backdoored}`);
    ns.tprint(`- Attempted: ${attempted}`);
    ns.tprint("");
}
