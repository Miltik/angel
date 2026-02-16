/**
 * ANGEL Network Map
 * Real-time visualization of server network status
 * Shows rooting and backdoor progress
 * 
 * @param {NS} ns
 */

/**
 * Get list of servers connected to a target
 * @param {NS} ns
 * @param {string} server - Server to scan from
 * @returns {string[]} List of connected servers
 */
function getScan(ns, server) {
    return ns.scan(server);
}

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
    const flags = ns.flags([
        ["rooted", false],
        ["unrooted", false],
        ["backdoored", false],
        ["hackable", false],
        ["pserv", false],
        ["maxDepth", 8],
    ]);
    const maxDepth = Number(flags.maxDepth) || 8;
    
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
    
    while (true) {
        ns.clearLog();
        const serverInfo = new Map();
        
        // Get all servers
        const rootServer = getAllServersRecursive(ns, "home", serverInfo);
        
        // Display header
        ns.print("╔════════════════════════════════════════════════════════════════╗");
        ns.print("║              ANGEL NETWORK MAP                                 ║");
        ns.print("╚════════════════════════════════════════════════════════════════╝");
        ns.print("");
        
        // Display legend
        ns.print("Legend:");
        ns.print(`  ✓ = Rooted        ★ = Backdoored    ⚡ = Admin        ◆ = Targeting    ○ = Unrooted`);
        ns.print("Filters:");
        ns.print(`  rooted=${flags.rooted} unrooted=${flags.unrooted} backdoored=${flags.backdoored} hackable=${flags.hackable} pserv=${flags.pserv}`);
        ns.print("");
        
        // Organize servers by type
        if (rootServer) {
            displayServerTree(ns, rootServer, "", serverInfo, factionServers, companyServers, flags, maxDepth, 0, true);
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
    const srv = ns.getServer(server);
    const serverData = {
        name: server,
        children: [],
        hasRoot: ns.hasRootAccess(server),
        hasBackdoor: srv.backdoorInstalled,
        isPurchased: srv.purchasedByPlayer,
        portsRequired: srv.numOpenPortsRequired,
        canHack: canHackServer(ns, server),
        maxMoney: ns.getServerMaxMoney(server),
        currMoney: ns.getServerMoneyAvailable(server),
        minSecurity: ns.getServerMinSecurityLevel(server),
        currSecurity: ns.getServerSecurityLevel(server),
        requiredHackingLevel: ns.getServerRequiredHackingLevel(server),
        growth: ns.getServerGrowth(server),
        maxRam: ns.getServerMaxRam(server),
        usedRam: ns.getServerUsedRam(server),
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
function displayServerTree(ns, server, prefix, infoMap, factionServers, companyServers, flags, maxDepth, depth = 0, isLast = true) {
    if (depth > maxDepth) return;
    
    const matches = matchesFilters(server, flags);
    const childCandidates = server.children || [];
    const renderChildren = childCandidates.filter(child => hasMatchingDescendant(child, flags, maxDepth, depth + 1));
    const shouldRender = matches || renderChildren.length > 0 || server.name === "home";
    if (!shouldRender) return;
    
    const status = getServerStatus(server, factionServers, companyServers);
    const connector = depth === 0 ? "" : (isLast ? "└─" : "├─");
    const linePrefix = depth === 0 ? "" : prefix + connector + " ";
    const typeTag = `[${status.type}]`;
    const nameCol = server.name.padEnd(18);
    
    let displayLine = `${linePrefix}${status.icon} ${nameCol} ${typeTag}`;
    
    if (server.canHack && server.maxMoney > 0) {
        const hackLevel = "L" + server.requiredHackingLevel.toString().padStart(4);
        const moneyStr = formatMoney(server.currMoney) + "/" + formatMoney(server.maxMoney);
        const moneyPct = formatPercent(server.currMoney, server.maxMoney).padStart(4);
        const secDelta = (server.currSecurity - server.minSecurity).toFixed(1).padStart(5);
        const growth = server.growth.toString().padStart(3);
        displayLine += ` ${hackLevel} $${moneyStr.padEnd(17)} ${moneyPct}% S+${secDelta} G${growth}`;
    } else if (server.maxRam > 0) {
        const ramStr = formatRam(server.usedRam) + "/" + formatRam(server.maxRam);
        displayLine += ` RAM ${ramStr}`;
    }
    
    ns.print(displayLine);
    
    if (renderChildren.length > 0) {
        const newPrefix = depth === 0 ? "" : prefix + (isLast ? "   " : "│  ");
        for (let i = 0; i < renderChildren.length; i++) {
            const child = renderChildren[i];
            const childIsLast = i === renderChildren.length - 1;
            displayServerTree(ns, child, newPrefix, infoMap, factionServers, companyServers, flags, maxDepth, depth + 1, childIsLast);
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
    } else if (server.isPurchased) {
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
 * Check if a server matches active filters
 */
function matchesFilters(server, flags) {
    const anyFilter = flags.rooted || flags.unrooted || flags.backdoored || flags.hackable || flags.pserv;
    if (!anyFilter) return true;
    
    const checks = [];
    if (flags.rooted) checks.push(server.hasRoot);
    if (flags.unrooted) checks.push(!server.hasRoot);
    if (flags.backdoored) checks.push(server.hasBackdoor);
    if (flags.hackable) checks.push(server.canHack);
    if (flags.pserv) checks.push(server.isPurchased);
    
    return checks.some(Boolean);
}

/**
 * Check if a server or its descendants match filters
 */
function hasMatchingDescendant(server, flags, maxDepth, depth) {
    if (depth > maxDepth) return false;
    if (matchesFilters(server, flags)) return true;
    if (!server.children || server.children.length === 0) return false;
    
    for (const child of server.children) {
        if (hasMatchingDescendant(child, flags, maxDepth, depth + 1)) {
            return true;
        }
    }
    
    return false;
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

/**
 * Format RAM values
 */
function formatRam(ram) {
    return formatMoney(ram) + "GB";
}

/**
 * Format percent with cap at 100
 */
function formatPercent(current, max) {
    if (max <= 0) return "0";
    const pct = Math.min(100, Math.floor((current / max) * 100));
    return pct.toString();
}
