/**
 * ANGEL Network Map
 * Real-time visualization of server network status
 * Shows rooting and backdoor progress
 * 
 * @param {NS} ns
 */
import { createWindow } from "/angel/modules/uiManager.js";

// State tracking
let lastState = {
    totalServers: 0,
    rootedServers: 0,
    backdooredServers: 0,
    loopCount: 0
};

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
    "rooted": "✅",
    "backdoored": "⭐",
    "admin": "⚡",
    "targeting": "🎯",
    "unrooted": "⭕",
};

const SERVER_TYPES = {
    "home": "🏠",
    "darkweb": "🌐",
    "player-server": "💾",
    "company": "🏢",
    "faction": "🎖️",
    "special": "⚙️",
};

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("netmap", "🗺️ Network Map", 1000, 700, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ui.log("🗺️ Network map initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
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
        lastState.loopCount++;
        ui.clear();
        const serverInfo = new Map();
        
        // Get all servers
        const rootServer = getAllServersRecursive(ns, "home", serverInfo);
        
        // Display header with visual separator
        ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        ui.log("🗺️  NETWORK MAP", "info");
        ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        ui.log("");
        
        // Display legend with emoji
        ui.log("📋 Legend:", "info");
        ui.log(`  ✅ = Rooted    ⭐ = Backdoored    ⚡ = Admin    🎯 = Targeting    ⭕ = Unrooted`);
        ui.log(`  🏠 = Home      🏢 = Company       🎖️ = Faction  💾 = Purchased`);
        
        if (flags.rooted || flags.unrooted || flags.backdoored || flags.hackable || flags.pserv) {
            ui.log("");
            ui.log("🔍 Filters Active:", "info");
            const activeFilters = [];
            if (flags.rooted) activeFilters.push("rooted");
            if (flags.unrooted) activeFilters.push("unrooted");
            if (flags.backdoored) activeFilters.push("backdoored");
            if (flags.hackable) activeFilters.push("hackable");
            if (flags.pserv) activeFilters.push("purchased");
            ui.log(`  ${activeFilters.join(", ")}`);
        }
        
        ui.log("");
        ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        ui.log("");
        
        // Organize servers by type
        if (rootServer) {
            displayServerTree(ns, ui, rootServer, "", serverInfo, factionServers, companyServers, flags, maxDepth, 0, true);
        }
        
        // Display statistics
        ui.log("");
        ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        
        let rooted = 0;
        let backdoored = 0;
        let total = 0;
        
        serverInfo.forEach(info => {
            total++;
            if (info.hasRoot) rooted++;
            if (info.hasBackdoor) backdoored++;
        });
        
        // Only log stats if changed or every 15 loops (~30 seconds)
        if (total !== lastState.totalServers || 
            rooted !== lastState.rootedServers || 
            backdoored !== lastState.backdooredServers ||
            lastState.loopCount % 15 === 0) {
            
            ui.log(`📊 Total: ${total} servers | ✅ Rooted: ${rooted} | ⭐ Backdoored: ${backdoored}`, "info");
            const rootPct = total > 0 ? ((rooted / total) * 100).toFixed(1) : 0;
            const backdoorPct = total > 0 ? ((backdoored / total) * 100).toFixed(1) : 0;
            ui.log(`📈 Progress: ${rootPct}% rooted, ${backdoorPct}% backdoored`, "info");
            
            lastState.totalServers = total;
            lastState.rootedServers = rooted;
            lastState.backdooredServers = backdoored;
        }
        
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
function displayServerTree(ns, ui, server, prefix, infoMap, factionServers, companyServers, flags, maxDepth, depth = 0, isLast = true) {
    if (depth > maxDepth) return;
    
    const matches = matchesFilters(server, flags);
    const childCandidates = server.children || [];
    const renderChildren = childCandidates.filter(child => hasMatchingDescendant(child, flags, maxDepth, depth + 1));
    const shouldRender = matches || renderChildren.length > 0 || server.name === "home";
    if (!shouldRender) return;
    
    const status = getServerStatus(server, factionServers, companyServers);
    const connector = depth === 0 ? "" : (isLast ? "└─" : "├─");
    const linePrefix = depth === 0 ? "" : prefix + connector + " ";
    const typeTag = status.type;
    const nameCol = server.name.padEnd(20);
    
    let displayLine = `${linePrefix}${status.icon} ${nameCol} ${typeTag}`;
    
    if (server.canHack && server.maxMoney > 0) {
        const hackLevel = "L" + server.requiredHackingLevel.toString().padStart(4);
        const moneyStr = formatMoney(server.currMoney) + "/" + formatMoney(server.maxMoney);
        const moneyPct = formatPercent(server.currMoney, server.maxMoney).padStart(4);
        const secDelta = (server.currSecurity - server.minSecurity).toFixed(1).padStart(5);
        const growth = server.growth.toString().padStart(3);
        displayLine += ` ${hackLevel} 💰${moneyStr.padEnd(17)} ${moneyPct}% 🔒+${secDelta} 📈${growth}`;
    } else if (server.maxRam > 0) {
        const ramStr = formatRam(server.usedRam) + "/" + formatRam(server.maxRam);
        displayLine += ` 💾 ${ramStr}`;
    }
    
    ui.log(displayLine);
    
    if (renderChildren.length > 0) {
        const newPrefix = depth === 0 ? "" : prefix + (isLast ? "   " : "│  ");
        for (let i = 0; i < renderChildren.length; i++) {
            const child = renderChildren[i];
            const childIsLast = i === renderChildren.length - 1;
            displayServerTree(ns, ui, child, newPrefix, infoMap, factionServers, companyServers, flags, maxDepth, depth + 1, childIsLast);
        }
    }
}

/**
 * Get server status icon and type info
 */
function getServerStatus(server, factionServers, companyServers) {
    let icon = STATUS_COLORS.unrooted;
    let type = "❓";
    
    if (server.name === "home") {
        icon = "🏠";
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
        icon = "💾";
        type = SERVER_TYPES["player-server"];
    } else {
        if (server.hasBackdoor) {
            icon = STATUS_COLORS.backdoored;
        } else if (server.hasRoot) {
            icon = STATUS_COLORS.rooted;
        } else if (server.canHack) {
            icon = STATUS_COLORS.unrooted;
        }
        type = "⚙️";
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
