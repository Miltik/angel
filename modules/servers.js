import { config } from "/angel/config.js";
import { formatMoney, formatRam, log } from "/angel/utils.js";
import { rootAll } from "/angel/scanner.js";

const PHASE_PORT = 7;

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    
    log(ns, "🖥 Server management module started - Phase-aware scaling", "INFO");
    
    while (true) {
        try {
            await serverLoop(ns);
        } catch (e) {
            log(ns, `Server management error: ${e}`, "ERROR");
        }
        await ns.sleep(10000); // Check every 10 seconds
    }
}

/**
 * Main server management loop
 * @param {NS} ns
 */
async function serverLoop(ns) {
    const phase = readGamePhase(ns);
    const ownedServers = ns.getPurchasedServers();
    let totalRam = 0;
    let minRam = Infinity;
    let maxRam = 0;
    
    for (const server of ownedServers) {
        const ram = ns.getServerMaxRam(server);
        totalRam += ram;
        minRam = Math.min(minRam, ram);
        maxRam = Math.max(maxRam, ram);
    }
    
    if (ownedServers.length > 0) {
        log(ns, `🖥 Servers: ${ownedServers.length}/${config.servers.maxServers} | RAM: ${formatRam(totalRam)} | Range: ${formatRam(minRam)}/${formatRam(maxRam)}`, "INFO");
    } else {
        log(ns, `🖥 No purchased servers yet (Phase ${phase})`, "INFO");
    }
    
    // Try to root new servers
    const newlyRooted = rootAll(ns);
    if (newlyRooted > 0) {
        log(ns, `🖥 Rooted ${newlyRooted} new servers`, "INFO");
    }
    
    // Buy/upgrade servers if enabled
    if (config.servers.autoBuyServers) {
        await manageServerPurchases(ns, phase);
    }
}

/**
 * Get phase-appropriate purchasing strategy
 */
function getPurchaseStrategy(phase) {
    switch(phase) {
        case 0: // Bootstrap
            return { minRam: 8, maxRam: 16, threshold: 0.2, aggressive: false };
        case 1: // Early Scaling
            return { minRam: 16, maxRam: 32, threshold: 0.15, aggressive: false };
        case 2: // Mid Game
            return { minRam: 64, maxRam: 256, threshold: 0.1, aggressive: true };
        case 3: // Gang Phase
            return { minRam: 512, maxRam: 2048, threshold: 0.05, aggressive: true };
        case 4: // Late Game
            return { minRam: 2048, maxRam: 1048576, threshold: 0.05, aggressive: true };
        default:
            return { minRam: 8, maxRam: 16, threshold: 0.2, aggressive: false };
    }
}

/**
 * Manage purchasing and upgrading servers
 * @param {NS} ns
 * @param {number} phase
 */
async function manageServerPurchases(ns, phase) {
    const money = ns.getServerMoneyAvailable("home");
    const ownedServers = ns.getPurchasedServers();
    const strategy = getPurchaseStrategy(phase);
    
    // If we have max servers, consider upgrading to next tier
    if (ownedServers.length >= config.servers.maxServers) {
        await upgradeServersToNextTier(ns, money, strategy);
        return;
    }
    
    // Buy new servers (with phase-appropriate RAM)
    await buyNewServerPhateAware(ns, money, strategy);
}

/**
 * Buy a new server with phase-appropriate RAM targeting
 * @param {NS} ns
 * @param {number} availableMoney
 * @param {object} strategy
 */
async function buyNewServerPhateAware(ns, availableMoney, strategy) {
    const ownedServers = ns.getPurchasedServers();
    if (ownedServers.length >= config.servers.maxServers) {
        return;
    }
    
    // Start with phase target and work backwards if can't afford
    let targetRam = strategy.minRam;
    let lastAffordable = strategy.minRam;
    
    // Find highest affordable RAM within phase constraints
    let ramLevel = strategy.minRam;
    while (ramLevel <= strategy.maxRam) {
        const cost = ns.getPurchasedServerCost(ramLevel);
        if (cost > availableMoney * strategy.threshold) {
            break;
        }
        lastAffordable = ramLevel;
        ramLevel *= 2;
    }
    
    targetRam = lastAffordable;
    
    if (targetRam < strategy.minRam) {
        const minCost = ns.getPurchasedServerCost(strategy.minRam);
        log(ns, `🖥 Phase ${strategy.name}: Need ${formatMoney(minCost - availableMoney)} more for ${formatRam(strategy.minRam)} server`, "INFO");
        return;
    }
    
    const cost = ns.getPurchasedServerCost(targetRam);
    
    // Check if we can afford it
    if (cost <= availableMoney * strategy.threshold) {
        const serverName = `${config.servers.serverPrefix}${ownedServers.length}`;
        const hostname = ns.purchaseServer(serverName, targetRam);
        
        if (hostname) {
            log(ns, `🖥 Purchased ${hostname}: ${formatRam(targetRam)} for ${formatMoney(cost)}`, "INFO");
        }
    }
}

/**
 * Upgrade existing servers to next tier within phase constraints
 * @param {NS} ns
 * @param {number} availableMoney
 * @param {object} strategy
 */
async function upgradeServersToNextTier(ns, availableMoney, strategy) {
    const ownedServers = ns.getPurchasedServers();
    
    // Find server with lowest RAM (that's below phase max)
    let lowestServer = null;
    let lowestRam = Infinity;
    
    for (const server of ownedServers) {
        const ram = ns.getServerMaxRam(server);
        if (ram < lowestRam && ram < strategy.maxRam) {
            lowestRam = ram;
            lowestServer = server;
        }
    }
    
    if (!lowestServer) {
        // All servers at phase max or beyond
        return;
    }
    
    // Calculate next tier (double the RAM)
    let targetRam = lowestRam * 2;
    
    // Cap at phase max or actual max config
    if (targetRam > strategy.maxRam) {
        targetRam = strategy.maxRam;
    }
    if (targetRam > config.servers.maxServerRam) {
        targetRam = config.servers.maxServerRam;
    }
    
    const cost = ns.getPurchasedServerCost(targetRam);
    
    // Upgrade if we can afford it
    if (cost <= availableMoney * strategy.threshold) {
        ns.killall(lowestServer);
        ns.deleteServer(lowestServer);
        
        const hostname = ns.purchaseServer(lowestServer, targetRam);
        
        if (hostname) {
            log(ns, `🖥 Upgraded ${lowestServer} from ${formatRam(lowestRam)} to ${formatRam(targetRam)} for ${formatMoney(cost)}`, "INFO");
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
