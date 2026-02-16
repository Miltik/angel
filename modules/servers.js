import { config } from "/angel/config.js";
import { formatMoney, formatRam } from "/angel/utils.js";
import { rootAll } from "/angel/scanner.js";
import { createWindow } from "/angel/modules/uiManager.js";

const PHASE_PORT = 7;

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("servers", "🖥️ Server Management", 700, 400, ns);
    ui.log("Server management module started - Phase-aware scaling", "info");
    
    while (true) {
        try {
            await serverLoop(ns, ui);
        } catch (e) {
            ui.log(`Server management error: ${e}`, "error");
        }
        await ns.sleep(15000); // Check every 15 seconds
    }
}

/**
 * Main server management loop
 * @param {NS} ns
 * @param {object} ui - UI window API
 */
async function serverLoop(ns, ui) {
    const phase = readGamePhase(ns);
    const phaseConfig = getPhaseConfig(phase);
    const ownedServers = ns.getPurchasedServers();
    const stats = getServerStats(ns);
    
    // Display server status
    if (ownedServers.length > 0) {
        ui.log(`[Phase ${phase}] Servers: ${stats.count}/${config.servers.maxServers} | RAM: ${formatRam(stats.totalRam)} | Range: ${formatRam(stats.minRam)}-${formatRam(stats.maxRam)}`, "info");
    } else {
        ui.log(`[Phase ${phase}] No servers yet. Target: ${formatRam(getTargetRamForPhase(phase))} per server`, "info");
    }
    
    // Try to root new servers
    const newlyRooted = rootAll(ns);
    if (newlyRooted > 0) {
        ui.log(`Rooted ${newlyRooted} new servers`, "success");
    }
    
    // Buy/upgrade servers if enabled
    if (config.servers.autoBuyServers) {
        await manageServerPurchases(ns, phase, phaseConfig, ui);
    }
}

/**
 * Get the phase configuration object from config
 * @param {number} phase
 */
function getPhaseConfig(phase) {
    const phaseKey = `phase${phase}`;
    return config.gamePhases[phaseKey] || config.gamePhases.phase0;
}

/**
 * Get target RAM for a given phase
 * @param {number} phase
 */
function getTargetRamForPhase(phase) {
    switch(phase) {
        case 0: return 8;
        case 1: return 16;
        case 2: return 64;
        case 3: return 512;
        case 4: return 1048576; // 1 PB
        default: return 8;
    }
}

/**
 * Get phase-appropriate purchasing strategy
 * @param {number} phase
 * @returns {object}
 */
function getPurchaseStrategy(phase) {
    const targetRam = getTargetRamForPhase(phase);
    const nextRam = phase < 4 ? getTargetRamForPhase(phase + 1) : 1048576;
    
    // Use phase spending config when available
    const phaseConfig = getPhaseConfig(phase);
    const threshold = phaseConfig.spending?.serverBuyThreshold || config.servers.purchaseThreshold;
    
    return {
        phase,
        targetRam,
        nextRam,
        threshold,
        maxRam: config.servers.maxServerRam,
    };
}

/**
 * Manage purchasing and upgrading servers
 * @param {NS} ns
 * @param {number} phase
 * @param {object} phaseConfig
 * @param {object} ui - UI window API
 */
async function manageServerPurchases(ns, phase, phaseConfig, ui) {
    const money = ns.getServerMoneyAvailable("home");
    const ownedServers = ns.getPurchasedServers();
    const strategy = getPurchaseStrategy(phase);
    
    // Decide: buy new server or upgrade existing?
    if (ownedServers.length < config.servers.maxServers) {
        // Buy new servers until we hit max
        await buyNewServer(ns, money, strategy, ui);
    } else {
        // All server slots filled - upgrade to next tier
        await upgradeServerCascade(ns, money, strategy, ui);
    }
}

/**
 * Buy a new server with phase-appropriate RAM
 * @param {NS} ns
 * @param {number} availableMoney
 * @param {object} strategy
 * @param {object} ui - UI window API
 */
async function buyNewServer(ns, availableMoney, strategy, ui) {
    const ownedServers = ns.getPurchasedServers();
    if (ownedServers.length >= config.servers.maxServers) {
        return;
    }
    
    // Try to buy server at target RAM for current phase
    // If can't afford, work down to what we can afford
    let buyRam = strategy.targetRam;
    const buyThreshold = availableMoney * strategy.threshold;
    
    // Try progressively smaller RAM sizes until we find one we can afford
    let ramToTry = strategy.targetRam;
    let affordableRam = null;
    
    while (ramToTry >= 2) {
        const cost = ns.getPurchasedServerCost(ramToTry);
        if (cost <= buyThreshold) {
            affordableRam = ramToTry;
            break;
        }
        ramToTry = Math.max(2, Math.floor(ramToTry / 2));
    }
    
    if (!affordableRam) {
        // Can't afford even 2GB server
        const minCost = ns.getPurchasedServerCost(2);
        const needed = minCost - availableMoney;
        ui.log(`Need ${formatMoney(needed)} more to buy 2GB server`, "info");
        return;
    }
    
    const cost = ns.getPurchasedServerCost(affordableRam);
    const serverName = `${config.servers.serverPrefix}${ownedServers.length}`;
    const hostname = ns.purchaseServer(serverName, affordableRam);
    
    if (hostname) {
        const status = affordableRam === strategy.targetRam ? "Purchased" : "Purchased (partial)";
        ui.log(`${status} ${hostname}: ${formatRam(affordableRam)} for ${formatMoney(cost)}`, "success");
    }
}

/**
 * Cascade upgrade servers to next tier
 * Find lowest RAM servers and upgrade them progressively
 * @param {NS} ns
 * @param {number} availableMoney
 * @param {object} strategy
 * @param {object} ui - UI window API
 */
async function upgradeServerCascade(ns, availableMoney, strategy, ui) {
    const ownedServers = ns.getPurchasedServers();
    
    // Sort by RAM to find bottlenecks
    const serversByRam = ownedServers
        .map(name => ({ name, ram: ns.getServerMaxRam(name) }))
        .sort((a, b) => a.ram - b.ram);
    
    // Find the lowest RAM server that's below our target for next phase
    const lowestServer = serversByRam.find(s => s.ram < strategy.nextRam);
    
    if (!lowestServer) {
        // All servers already at or above next phase target
        // Try to push toward max
        const maxRamServer = serversByRam[serversByRam.length - 1];
        if (maxRamServer.ram >= config.servers.maxServerRam) {
            ui.log(`All servers at maximum RAM (${formatRam(config.servers.maxServerRam)})`, "info");
            return;
        }
    }
    
    const targetServer = lowestServer || serversByRam[0];
    const currentRam = targetServer.ram;
    const nextRamLevel = Math.min(currentRam * 2, strategy.maxRam);
    const upgradeCost = ns.getPurchasedServerCost(nextRamLevel);
    const spendThreshold = availableMoney * strategy.threshold;
    
    if (upgradeCost <= spendThreshold) {
        // Kill the server, delete it, and recreate with more RAM
        ns.killall(targetServer.name);
        ns.deleteServer(targetServer.name);
        
        const hostname = ns.purchaseServer(targetServer.name, nextRamLevel);
        
        if (hostname) {
            ui.log(`Upgraded ${targetServer.name} from ${formatRam(currentRam)} to ${formatRam(nextRamLevel)} for ${formatMoney(upgradeCost)}`, "success");
        }
    }
}

/**
 * Read game phase from orchestrator port (port 7)
 */
function readGamePhase(ns) {
    const phasePortData = ns.peek(PHASE_PORT);
    if (phasePortData === "NULL PORT DATA") return 0;
    return parseInt(phasePortData) || 0;
}

/**
 * Get total RAM across all purchased servers
 * @param {NS} ns
 * @returns {number}
 */
export function getTotalPurchasedRam(ns) {
    const servers = ns.getPurchasedServers();
    let total = 0;
    
    for (const server of servers) {
        total += ns.getServerMaxRam(server);
    }
    
    return total;
}

/**
 * Get statistics about purchased servers
 * @param {NS} ns
 * @returns {object}
 */
export function getServerStats(ns) {
    const servers = ns.getPurchasedServers();
    const totalRam = getTotalPurchasedRam(ns);
    
    let minRam = Infinity;
    let maxRam = 0;
    
    for (const server of servers) {
        const ram = ns.getServerMaxRam(server);
        minRam = Math.min(minRam, ram);
        maxRam = Math.max(maxRam, ram);
    }
    
    return {
        count: servers.length,
        totalRam,
        minRam: minRam === Infinity ? 0 : minRam,
        maxRam,
        maxPossible: config.servers.maxServers,
    };
}
