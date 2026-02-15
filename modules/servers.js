import { config } from "/angel/config.js";
import { formatMoney, formatRam, log } from "/angel/utils.js";
import { rootAll } from "/angel/scanner.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    
    log(ns, "Server management module started", "INFO");
    
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
        log(ns, `Servers: ${ownedServers.length}/${config.servers.maxServers} | Total RAM: ${formatRam(totalRam)} | Min/Max: ${formatRam(minRam)}/${formatRam(maxRam)}`, "INFO");
    }
    
    // Try to root new servers
    const newlyRooted = rootAll(ns);
    if (newlyRooted > 0) {
        log(ns, `Rooted ${newlyRooted} new servers`, "INFO");
    }
    
    // Buy/upgrade servers if enabled
    if (config.servers.autoBuyServers) {
        await manageServerPurchases(ns);
    }
}

/**
 * Manage purchasing and upgrading servers
 * @param {NS} ns
 */
async function manageServerPurchases(ns) {
    const money = ns.getServerMoneyAvailable("home");
    const ownedServers = ns.getPurchasedServers();
    
    // If we have max servers, consider upgrading
    if (ownedServers.length >= config.servers.maxServers) {
        await upgradeServers(ns, money);
        return;
    }
    
    // Buy new servers
    await buyNewServer(ns, money);
}

/**
 * Buy a new server
 * @param {NS} ns
 * @param {number} availableMoney
 */
async function buyNewServer(ns, availableMoney) {
    const ownedServers = ns.getPurchasedServers();
    if (ownedServers.length >= config.servers.maxServers) {
        return;
    }
    
    // Start with smallest RAM and work up to what we can afford
    let targetRam = 8; // Start with 8GB
    let lastAffordable = 8;
    
    // Find the highest RAM we can afford (powers of 2)
    while (targetRam <= config.servers.maxServerRam) {
        const cost = ns.getPurchasedServerCost(targetRam);
        if (cost > availableMoney * config.servers.purchaseThreshold) {
            break;
        }
        lastAffordable = targetRam;
        targetRam *= 2;
    }
    
    targetRam = lastAffordable;
    
    // Make sure we have at least 8GB to buy
    if (targetRam < 8) {
        const cost8gb = ns.getPurchasedServerCost(8);
        log(ns, `Need ${formatMoney(cost8gb - availableMoney)} more to buy first server`, "INFO");
        return;
    }
    
    const cost = ns.getPurchasedServerCost(targetRam);
    
    // Check if we can afford it with threshold
    if (cost <= availableMoney * config.servers.purchaseThreshold) {
        const serverName = `${config.servers.serverPrefix}${ownedServers.length}`;
        const hostname = ns.purchaseServer(serverName, targetRam);
        
        if (hostname) {
            log(ns, `Purchased ${hostname}: ${formatRam(targetRam)} for ${formatMoney(cost)}`, "INFO");
        }
    }
}

/**
 * Upgrade existing servers to higher RAM
 * @param {NS} ns
 * @param {number} availableMoney
 */
async function upgradeServers(ns, availableMoney) {
    const ownedServers = ns.getPurchasedServers();
    
    // Find server with lowest RAM
    let lowestServer = null;
    let lowestRam = Infinity;
    
    for (const server of ownedServers) {
        const ram = ns.getServerMaxRam(server);
        if (ram < lowestRam && ram < config.servers.maxServerRam) {
            lowestRam = ram;
            lowestServer = server;
        }
    }
    
    if (!lowestServer) {
        // All servers at max RAM
        return;
    }
    
    // Try to upgrade to next power of 2
    const targetRam = lowestRam * 2;
    
    // Don't exceed max configured RAM
    if (targetRam > config.servers.maxServerRam) {
        return;
    }
    
    const cost = ns.getPurchasedServerCost(targetRam);
    
    if (cost <= availableMoney * config.servers.purchaseThreshold) {
        // Delete old server
        ns.killall(lowestServer);
        ns.deleteServer(lowestServer);
        
        // Buy new upgraded server
        const hostname = ns.purchaseServer(lowestServer, targetRam);
        
        if (hostname) {
            log(ns, `Upgraded ${lowestServer} from ${formatRam(lowestRam)} to ${formatRam(targetRam)} for ${formatMoney(cost)}`, "INFO");
        }
    }
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
