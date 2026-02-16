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
    
    const ui = createWindow("netmap", "🗺️ Network Map", 1200, 800, ns);
    
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
    
    // Add custom CSS for visual map
    addMapStyles(ui);
    
    while (true) {
        lastState.loopCount++;
        const serverInfo = new Map();
        
        // Get all servers and organize by depth
        const serversByDepth = [];
        scanNetworkByDepth(ns, "home", serverInfo, serversByDepth, 0, maxDepth, new Set());
        
        // Build HTML for visual map
        let html = '<div class="network-map">';
        
        // Stats header
        let rooted = 0;
        let backdoored = 0;
        let total = 0;
        
        serverInfo.forEach(info => {
            total++;
            if (info.hasRoot) rooted++;
            if (info.hasBackdoor) backdoored++;
        });
        
        const rootPct = total > 0 ? ((rooted / total) * 100).toFixed(0) : 0;
        const backdoorPct = total > 0 ? ((backdoored / total) * 100).toFixed(0) : 0;
        
        html += `<div class="stats-header">`;
        html += `<div class="stat-box">📊 ${total} Servers</div>`;
        html += `<div class="stat-box">✅ ${rooted} Rooted (${rootPct}%)</div>`;
        html += `<div class="stat-box">⭐ ${backdoored} Backdoored (${backdoorPct}%)</div>`;
        html += `</div>`;
        
        // Legend
        html += `<div class="legend">`;
        html += `<span class="legend-item">🏠 Home</span>`;
        html += `<span class="legend-item">🎖️ Faction</span>`;
        html += `<span class="legend-item">🏢 Company</span>`;
        html += `<span class="legend-item">💾 Purchased</span>`;
        html += `<span class="legend-item">✅ Rooted</span>`;
        html += `<span class="legend-item">⭐ Backdoored</span>`;
        html += `</div>`;
        
        // Display servers by depth (layers)
        for (let depth = 0; depth < serversByDepth.length && depth <= maxDepth; depth++) {
            if (!serversByDepth[depth] || serversByDepth[depth].length === 0) continue;
            
            const servers = serversByDepth[depth];
            html += `<div class="depth-layer">`;
            html += `<div class="depth-label">Layer ${depth}</div>`;
            html += `<div class="server-grid">`;
            
            for (const serverName of servers) {
                const info = serverInfo.get(serverName);
                if (!info) continue;
                
                // Apply filters
                if (!matchesFilters(info, flags)) continue;
                
                const serverType = getServerType(serverName, factionServers, companyServers, info);
                const statusClass = getStatusClass(info);
                const icon = getServerIcon(serverName, factionServers, companyServers, info);
                
                html += `<div class="server-card ${statusClass} ${serverType}">`;
                html += `<div class="server-icon">${icon}</div>`;
                html += `<div class="server-name">${serverName}</div>`;
                
                if (info.canHack && info.maxMoney > 0) {
                    const moneyPct = info.maxMoney > 0 ? Math.floor((info.currMoney / info.maxMoney) * 100) : 0;
                    html += `<div class="server-stats">`;
                    html += `<div class="stat">L${info.requiredHackingLevel}</div>`;
                    html += `<div class="stat">💰${moneyPct}%</div>`;
                    html += `<div class="stat">📈${info.growth}</div>`;
                    html += `</div>`;
                } else if (info.maxRam > 0) {
                    html += `<div class="server-stats">`;
                    html += `<div class="stat">💾${formatRam(info.maxRam)}</div>`;
                    html += `</div>`;
                }
                
                html += `</div>`;
            }
            
            html += `</div></div>`;
        }
        
        html += '</div>';
        
        // Update the window content
        ui.update(html);
        
        lastState.totalServers = total;
        lastState.rootedServers = rooted;
        lastState.backdooredServers = backdoored;
        
        await ns.sleep(2000); // Update every 2 seconds
    }
}

/**
 * Add CSS styles for visual map (only done once)
 */
let stylesAdded = false;
function addMapStyles(ui) {
    if (stylesAdded) return;
    stylesAdded = true;
    
    // Check if we can inject a style tag into the document
    try {
        const existingStyle = document.getElementById("networkMapStyles");
        if (existingStyle) return;
        
        const style = document.createElement("style");
        style.id = "networkMapStyles";
        style.textContent = `
            .stats-header {
                display: flex;
                gap: 15px;
                margin-bottom: 15px;
                padding: 10px;
                background: rgba(0, 255, 0, 0.05);
                border: 1px solid rgba(0, 255, 0, 0.3);
                border-radius: 4px;
            }
            .stat-box {
                padding: 5px 10px;
                background: rgba(0, 255, 0, 0.1);
                border-radius: 3px;
                font-weight: bold;
            }
            .legend {
                display: flex;
                gap: 15px;
                margin-bottom: 15px;
                padding: 8px;
                background: rgba(0, 255, 0, 0.05);
                border: 1px solid rgba(0, 255, 0, 0.2);
                border-radius: 4px;
                font-size: 10px;
            }
            .legend-item {
                padding: 2px 6px;
            }
            .depth-layer {
                margin-bottom: 20px;
            }
            .depth-label {
                font-weight: bold;
                margin-bottom: 8px;
                padding: 5px 10px;
                background: rgba(0, 255, 0, 0.15);
                border-left: 3px solid #0f0;
                display: inline-block;
            }
            .server-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                gap: 8px;
                margin-top: 8px;
            }
            .server-card {
                border: 1px solid rgba(0, 255, 0, 0.3);
                border-radius: 4px;
                padding: 8px;
                background: rgba(0, 0, 0, 0.3);
                transition: all 0.2s;
                cursor: pointer;
            }
            .server-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 255, 0, 0.2);
                border-color: rgba(0, 255, 0, 0.6);
            }
            .server-card.backdoored {
                border-color: #ffd700;
                background: rgba(255, 215, 0, 0.1);
            }
            .server-card.rooted {
                border-color: #00ff00;
                background: rgba(0, 255, 0, 0.08);
            }
            .server-card.unrooted {
                border-color: #ff4444;
                background: rgba(255, 68, 68, 0.05);
            }
            .server-card.home-type {
                border: 2px solid #00ffff;
                background: rgba(0, 255, 255, 0.1);
            }
            .server-card.faction-type {
                border-color: #ff00ff;
                background: rgba(255, 0, 255, 0.08);
            }
            .server-icon {
                font-size: 20px;
                text-align: center;
                margin-bottom: 5px;
            }
            .server-name {
                font-size: 10px;
                text-align: center;
                margin-bottom: 5px;
                font-weight: bold;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .server-stats {
                display: flex;
                justify-content: space-around;
                font-size: 9px;
                margin-top: 5px;
                padding-top: 5px;
                border-top: 1px solid rgba(0, 255, 0, 0.2);
            }
            .stat {
                padding: 2px 4px;
                background: rgba(0, 255, 0, 0.1);
                border-radius: 2px;
            }
        `;
        document.head.appendChild(style);
    } catch (e) {
        // Silently fail if DOM not available
    }
}

/**
 * Scan network and organize servers by depth
 */
function scanNetworkByDepth(ns, server, infoMap, byDepth, depth, maxDepth, visited) {
    if (depth > maxDepth || visited.has(server)) return;
    visited.add(server);
    
    // Ensure depth array exists
    if (!byDepth[depth]) byDepth[depth] = [];
    byDepth[depth].push(server);
    
    // Get server info
    const srv = ns.getServer(server);
    const serverData = {
        name: server,
        depth: depth,
        hasRoot: ns.hasRootAccess(server),
        hasBackdoor: srv.backdoorInstalled,
        isPurchased: srv.purchasedByPlayer,
        portsRequired: srv.numOpenPortsRequired,
        canHack: ns.getServerMaxMoney(server) > 0,
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
    
    // Scan children
    const connections = ns.scan(server);
    for (const child of connections) {
        if (!visited.has(child)) {
            scanNetworkByDepth(ns, child, infoMap, byDepth, depth + 1, maxDepth, visited);
        }
    }
}

/**
 * Get server type class name
 */
function getServerType(serverName, factionServers, companyServers, info) {
    if (serverName === "home") return "home-type";
    if (factionServers.includes(serverName)) return "faction-type";
    if (companyServers.includes(serverName)) return "company-type";
    if (info.isPurchased) return "purchased-type";
    return "regular-type";
}

/**
 * Get server status class
 */
function getStatusClass(info) {
    if (info.hasBackdoor) return "backdoored";
    if (info.hasRoot) return "rooted";
    return "unrooted";
}

/**
 * Get server icon
 */
function getServerIcon(serverName, factionServers, companyServers, info) {
    if (serverName === "home") return "🏠";
    if (factionServers.includes(serverName)) {
        if (info.hasBackdoor) return "⭐";
        return "🎖️";
    }
    if (companyServers.includes(serverName)) return "🏢";
    if (info.isPurchased) return "💾";
    if (info.hasBackdoor) return "⭐";
    if (info.hasRoot) return "✅";
    return "⭕";
}

/**
 * Check if server matches active filters
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
 * Format RAM values
 */
function formatRam(ram) {
    if (ram >= 1000) return (ram / 1000).toFixed(0) + "T";
    return ram.toFixed(0) + "G";
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
