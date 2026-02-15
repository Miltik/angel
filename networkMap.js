/**
 * ANGEL Network Map
 * Real-time visualization of server network status
 * Shows rooting and backdoor progress
 * 
 * @param {NS} ns
 */

import { getScan } from "./utils.js";

const STATUS_COLORS = {
    "rooted": "✓",
    "backdoored": "★",
    "admin": "⚡",
    "targeting": "◆",
    "unrooted": "○",
};

const SERVER_TYPES = {
    "home": "HOME",
    "darkweb": "TOR",
    "player-server": "BUY",
    "company": "CORP",
    "faction": "FACT",
    "special": "SPEC",
};

export async function main(ns) {
    ns.disableLog("ALL");
    
    // Server configuration
    const factionServers = [
        "CSEC",
        "avmnite-02h",
        "I.I.I.I",
        "run4theh111z",
        "w0r1d_d43m0n",
    ];
    
    const companyServers = [
        "NWO",
        "Clarke Incorporated",
        "OmniTek Incorporated",
        "Blade Industries",
        "ECorp",
        "Bachman & Associates",
        "Four Sigma",
        "KuaiGong International",
        "Fulcrum Technologies",
        "MegaCorp",
        "ZeusCorp",
        "Aevum Police Headquarters",
        "RhoConstruction",
        "Alpha Enterprises",
        "SolarisSpaceCompany",
        "Galactic Cybersystems",
        "AeroCorp",
        "Watchdog Security",
        "Heliouse Electric",
        "VitaLife",
        "Icarus Microsystems",
        "Universal Energy",
        "Storm Technologies",
        "Synthetics",
        "CompuTek",
        "NetLynk",
        "FyreGlass",
        "Snowball Operations",
    ];
    
    // Track server info
    const serverInfo = new Map();
    
    while (true) {
        ns.clearLog();
        
        // Get all servers
        const allServers = getAllServersRecursive(ns, "home", serverInfo);
        
        // Display header
        ns.print("╔════════════════════════════════════════════════════════════════╗");
        ns.print("║              ANGEL NETWORK MAP                                 ║");
        ns.print("╚════════════════════════════════════════════════════════════════╝");
        ns.print("");
        
        // Display legend
        ns.print("Legend:");
        ns.print(`  ✓ = Rooted        ★ = Backdoored    ⚡ = Admin        ◆ = Targeting    ○ = Unrooted`);
        ns.print("");
        
        // Organize servers by type
        const root = serverInfo.get("home");
        if (root) {
            displayServerTree(ns, root, "", serverInfo, factionServers, companyServers);
        }
        
        // Display statistics
        ns.print("");
        ns.print("─────────────────────────────────────────────────────────────────");
        
        let rooted = 0;
        let backdoored = 0;
        let total = 0;
        
        serverInfo.forEach(info => {
            total++;
            if (info.hasRoot) rooted++;
            if (info.hasBackdoor) backdoored++;
        });
        
        ns.print(`Total Servers: ${total} | Rooted: ${rooted} | Backdoored: ${backdoored}`);
        ns.print("");
        
        await ns.sleep(2000); // Update every 2 seconds
    }
}

/**
 * Recursively get all servers from a starting point
 */
function getAllServersRecursive(ns, server, infoMap) {
    if (infoMap.has(server)) {
        return infoMap.get(server);
    }
    
    const serverData = {
        name: server,
        children: [],
        hasRoot: ns.hasRootAccess(server),
        hasBackdoor: ns.getServer(server).backdoorInstalled,
        canHack: canHackServer(ns, server),
        maxMoney: ns.getServerMaxMoney(server),
        currMoney: ns.getServerMoneyAvailable(server),
        minSecurity: ns.getServerMinSecurityLevel(server),
        currSecurity: ns.getServerSecurityLevel(server),
        requiredHackingLevel: ns.getServerRequiredHackingLevel(server),
    };
    
    infoMap.set(server, serverData);
    
    // Get child servers (servers this one connects to)
    const scan = getScan(ns, server);
    for (const child of scan) {
        if (child !== "home" && !infoMap.has(child)) {
            const childData = getAllServersRecursive(ns, child, infoMap);
            serverData.children.push(childData);
        }
    }
    
    return serverData;
}

/**
 * Display server tree with hierarchy
 */
function displayServerTree(ns, server, prefix, infoMap, factionServers, companyServers, depth = 0) {
    if (depth > 6) return; // Limit depth
    
    const isLastChild = !server.children || server.children.length === 0;
    const connector = "├─";
    const status = getServerStatus(server, factionServers, companyServers);
    
    // Color the output based on status
    let displayLine = prefix + connector + " " + status.icon + " " + server.name.padEnd(18);
    
    // Add threat level if hackable
    if (server.canHack && server.maxMoney > 0) {
        const hackLevel = "L" + server.requiredHackingLevel.toString().padStart(4);
        const moneyStr = formatMoney(server.currMoney) + " / " + formatMoney(server.maxMoney);
        displayLine += ` ${hackLevel}  ${moneyStr.padEnd(20)}`;
    } else if (server.name === "home") {
        displayLine += " HOME SERVER";
    } else if (factionServers.includes(server.name)) {
        displayLine += " FACTION SERVER";
    } else if (companyServers.includes(server.name)) {
        displayLine += " COMPANY SERVER";
    }
    
    ns.print(displayLine);
    
    // Display children in tree format
    if (server.children && server.children.length > 0) {
        const newPrefix = prefix + (isLastChild ? "   " : "│  ");
        for (let i = 0; i < server.children.length; i++) {
            displayServerTree(ns, server.children[i], newPrefix, infoMap, factionServers, companyServers, depth + 1);
        }
    }
}

/**
 * Get server status icon and type info
 */
function getServerStatus(server, factionServers, companyServers) {
    let icon = STATUS_COLORS.unrooted;
    let type = "UNK";
    
    if (server.name === "home") {
        icon = "⊕";
        type = SERVER_TYPES.home;
    } else if (factionServers.includes(server.name)) {
        if (server.hasBackdoor) {
            icon = STATUS_COLORS.backdoored;
        } else if (server.hasRoot) {
            icon = STATUS_COLORS.rooted;
        }
        type = SERVER_TYPES.faction;
    } else if (companyServers.includes(server.name)) {
        if (server.hasRoot) {
            icon = STATUS_COLORS.rooted;
        }
        type = SERVER_TYPES.company;
    } else if (server.name.startsWith("angel-") || server.name.startsWith("player-")) {
        icon = "⚙";
        type = SERVER_TYPES["player-server"];
    } else {
        if (server.hasBackdoor) {
            icon = STATUS_COLORS.backdoored;
        } else if (server.hasRoot) {
            icon = STATUS_COLORS.rooted;
        } else if (server.canHack) {
            icon = STATUS_COLORS.unrooted;
        }
    }
    
    return { icon, type };
}

/**
 * Check if server can be hacked
 */
function canHackServer(ns, server) {
    return ns.getServerMaxMoney(server) > 0;
}

/**
 * Format money for display
 */
function formatMoney(money) {
    const units = ["", "k", "m", "b", "t"];
    let amount = money;
    let unitIndex = 0;
    
    while (amount >= 1000 && unitIndex < units.length - 1) {
        amount /= 1000;
        unitIndex++;
    }
    
    return amount.toFixed(1) + units[unitIndex];
}
