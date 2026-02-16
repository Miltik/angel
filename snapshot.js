/**
 * System Snapshot Tool - Capture all module outputs + dashboard to a file
 * Use: run /angel/snapshot.js
 * Output: angel_snapshot.txt with current state of all running modules
 * 
 * @param {NS} ns
 */

export async function main(ns) {
    ns.disableLog("ALL");
    
    ns.tprint("📸 Taking system snapshot...");
    
    try {
        let snapshot = "";
        snapshot += "╔════════════════════════════════════════════════════════════════╗\n";
        snapshot += "║                    ANGEL SYSTEM SNAPSHOT                       ║\n";
        snapshot += "╚════════════════════════════════════════════════════════════════╝\n";
        snapshot += `⏰ Timestamp: ${new Date().toLocaleString()}\n`;
        snapshot += `🎮 Server: ${ns.getHostname()}\n\n`;
        
        // Player Status
        snapshot += "┌─ PLAYER STATUS ────────────────────────────────┐\n";
        const player = ns.getPlayer();
        snapshot += `💰 Money: $${formatMoney(player.money)}\n`;
        snapshot += `💻 Hacking: ${player.skills.hacking}\n`;
        snapshot += `⚔️  Strength: ${player.skills.strength}\n`;
        snapshot += `🛡️  Defense: ${player.skills.defense}\n`;
        snapshot += `🏃 Dexterity: ${player.skills.dexterity}\n`;
        snapshot += `👻 Agility: ${player.skills.agility}\n`;
        snapshot += `📡 Charisma: ${player.skills.charisma}\n`;
        snapshot += `📚 Intelligence: ${player.skills.intelligence}\n`;
        snapshot += `└─────────────────────────────────────────────────┘\n\n`;
        
        // Home Server Status
        snapshot += "┌─ HOME SERVER ──────────────────────────────────┐\n";
        const homeRam = ns.getServerMaxRam("home");
        const homeUsedRam = ns.getServerUsedRam("home");
        const homeMoneyAvail = ns.getServerMoneyAvailable("home");
        snapshot += `💾 RAM: ${(homeUsedRam / 1024).toFixed(1)}GB / ${(homeRam / 1024).toFixed(1)}GB (${((homeUsedRam / homeRam) * 100).toFixed(1)}%)\n`;
        snapshot += `💰 Available: $${formatMoney(homeMoneyAvail)}\n`;
        snapshot += `└─────────────────────────────────────────────────┘\n\n`;
        
        // Network Status
        snapshot += "┌─ NETWORK STATUS ───────────────────────────────┐\n";
        const allServers = getAllServers(ns);
        const rooted = allServers.filter(s => ns.hasRootAccess(s));
        const purchased = ns.getPurchasedServers();
        snapshot += `🌐 Total Servers: ${allServers.length}\n`;
        snapshot += `✅ Rooted: ${rooted.length}\n`;
        snapshot += `🖥️  Purchased: ${purchased.length}\n`;
        
        let totalServerRam = 0;
        let usedServerRam = 0;
        for (const server of purchased) {
            totalServerRam += ns.getServerMaxRam(server);
            usedServerRam += ns.getServerUsedRam(server);
        }
        snapshot += `📊 Purchased RAM: ${(usedServerRam / 1024).toFixed(1)}GB / ${(totalServerRam / 1024).toFixed(1)}GB\n`;
        snapshot += `└─────────────────────────────────────────────────┘\n\n`;
        
        // Running Scripts Status
        snapshot += "┌─ RUNNING MODULES ──────────────────────────────┐\n";
        const runningModules = [
            { path: "/angel/modules/hacking.js", name: "💻 Hacking" },
            { path: "/angel/modules/servers.js", name: "🖥️  Server Management" },
            { path: "/angel/modules/augments.js", name: "🧬 Augmentation" },
            { path: "/angel/modules/programs.js", name: "💾 Programs" },
            { path: "/angel/modules/activities.js", name: "🎯 Activities" },
            { path: "/angel/modules/sleeves.js", name: "👥 Sleeves" },
            { path: "/angel/modules/stocks.js", name: "📈 Stocks" },
            { path: "/angel/modules/gang.js", name: "👾 Gang" },
            { path: "/angel/modules/bladeburner.js", name: "🗡️  Bladeburner" },
            { path: "/angel/modules/hacknet.js", name: "🌐 Hacknet" },
            { path: "/angel/modules/contracts.js", name: "📋 Contracts" },
            { path: "/angel/modules/formulas.js", name: "📐 Formulas" },
            { path: "/angel/xpFarm.js", name: "⚡ XP Farm" },
            { path: "/angel/networkMap.js", name: "🗺️  Network Map" },
            { path: "/angel/modules/dashboard.js", name: "📊 Dashboard" },
        ];
        
        for (const mod of runningModules) {
            const isRunning = ns.isRunning(mod.path, "home");
            const status = isRunning ? "✅" : "⏸️ ";
            snapshot += `${status} ${mod.name}\n`;
        }
        snapshot += `└─────────────────────────────────────────────────┘\n\n`;
        
        // Gang Status (if in gang)
        if (ns.gang.inGang()) {
            snapshot += "┌─ GANG STATUS ──────────────────────────────────┐\n";
            const gangInfo = ns.gang.getGangInformation();
            snapshot += `👾 Gang: ${gangInfo.faction}\n`;
            snapshot += `👥 Members: ${ns.gang.getMemberNames().length}\n`;
            snapshot += `💰 Money/s: $${formatMoney(gangInfo.moneyGainRate * 5)}\n`;
            snapshot += `💎 Respect: ${formatMoney(gangInfo.respect)}\n`;
            snapshot += `⚔️  Power: ${gangInfo.power.toFixed(2)}\n`;
            snapshot += `🗺️  Territory: ${(gangInfo.territory * 100).toFixed(1)}%\n`;
            snapshot += `⚠️  Wanted Level: ${(gangInfo.wantedPenalty * 100).toFixed(1)}%\n`;
            snapshot += `└─────────────────────────────────────────────────┘\n\n`;
        }
        
        // Faction Status
        snapshot += "┌─ FACTION STATUS ───────────────────────────────┐\n";
        const factions = player.factions || [];
        if (factions.length > 0) {
            const top = factions.slice(0, 5);
            for (const faction of top) {
                const rep = ns.singularity.getFactionRep(faction);
                const favor = ns.singularity.getFactionFavor(faction);
                snapshot += `🏛️  ${faction}: ${formatMoney(rep)} rep (Favor: ${favor})\n`;
            }
            if (factions.length > 5) snapshot += `... and ${factions.length - 5} more\n`;
        } else {
            snapshot += "No factions joined yet\n";
        }
        snapshot += `└─────────────────────────────────────────────────┘\n\n`;
        
        // Augmentation Status
        snapshot += "┌─ AUGMENTATION STATUS ──────────────────────────┐\n";
        const ownedAugs = player.augmentations ? player.augmentations.length : 0;
        snapshot += `🧬 Owned Augments: ${ownedAugs}\n`;
        try {
            const purchased = ns.singularity.getOwnedAugmentations(true);
            const installed = ns.singularity.getOwnedAugmentations(false);
            const queued = installed.length - purchased.length;
            snapshot += `📦 Queued: ${queued}\n`;
        } catch (e) {
            snapshot += `📦 Queued: Unknown\n`;
        }
        snapshot += `└─────────────────────────────────────────────────┘\n\n`;
        
        // Write to file
        ns.write("angel_snapshot.txt", snapshot, "w");
        
        ns.tprint("✅ Snapshot saved to: angel_snapshot.txt");
        ns.tprint(`📊 Size: ${snapshot.length} bytes`);
        
    } catch (e) {
        ns.tprint(`❌ Error: ${e.message}`);
    }
}

function formatMoney(n) {
    if (n >= 1e12) return (n / 1e12).toFixed(2) + "t";
    if (n >= 1e9) return (n / 1e9).toFixed(2) + "b";
    if (n >= 1e6) return (n / 1e6).toFixed(2) + "m";
    if (n >= 1e3) return (n / 1e3).toFixed(2) + "k";
    return n.toFixed(2);
}

function getAllServers(ns, server = "home", visited = new Set()) {
    visited.add(server);
    const neighbors = ns.scan(server);
    for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
            getAllServers(ns, neighbor, visited);
        }
    }
    return Array.from(visited);
}
