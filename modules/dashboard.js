/**
 * ANGEL Monitoring Dashboard
 * Real-time visibility into game progression, automation status, and key metrics
 * 
 * Displays:
 * - Game phase and transition progress
 * - Money/XP generation rates
 * - Hacking efficiency metrics  
 * - Gang status and territory
 * - Augmentation queue and reset status
 * - Stock portfolio value
 * - Network and resource utilization
 * 
 * @param {NS} ns
 */
import { config } from "/angel/config.js";
import { formatMoney, log } from "/angel/utils.js";

const PHASE_PORT = 7;
let lastUpdate = 0;
let lastMoney = 0;
let lastXp = 0;

export async function main(ns) {
    ns.disableLog("ALL");
    
    log(ns, "📊 Dashboard monitoring started - Real-time metrics", "INFO");
    
    let loopCount = 0;
    while (true) {
        try {
            loopCount++;
            await updateDashboard(ns);
            
            // Update every 30 seconds for dashboard
            await ns.sleep(30000);
        } catch (e) {
            log(ns, `📊 Error: ${e}`, "ERROR");
            await ns.sleep(5000);
        }
    }
}

/**
 * Update and display dashboard metrics
 */
async function updateDashboard(ns) {
    const now = Date.now();
    const player = ns.getPlayer();
    const money = player.money + ns.getServerMoneyAvailable("home");
    const hacking = player.skills.hacking;
    
    // Calculate rates
    const timeDiff = (now - lastUpdate) / 1000; // seconds
    const moneyRate = timeDiff > 0 ? (money - lastMoney) / timeDiff : 0;
    const xpRate = timeDiff > 0 ? (hacking - lastXp) / timeDiff : 0;
    
    lastUpdate = now;
    lastMoney = money;
    lastXp = hacking;
    
    // Get current phase and progress
    const currentPhase = readGamePhase(ns);
    const phaseProgress = getPhaseProgress(ns, currentPhase);
    const nextPhase = currentPhase < 4 ? currentPhase + 1 : 4;
    
    // Display header
    ns.print("");
    ns.print("╔═══════════════════════════════════════════════════════════════╗");
    ns.print("║            ANGEL AUTOMATION DASHBOARD                         ║");
    ns.print("╚═══════════════════════════════════════════════════════════════╝");
    ns.print("");
    
    // Game Phase
    displayPhaseStatus(ns, currentPhase, phaseProgress, nextPhase);
    ns.print("");
    
    // Money and XP Rates
    displayEconomicsMetrics(ns, money, player, moneyRate, xpRate);
    ns.print("");
    
    // Hacking Status
    displayHackingStatus(ns, player);
    ns.print("");
    
    // Gang Status (if available)
    if (ns.gang.inGang && ns.gang.inGang()) {
        displayGangStatus(ns);
        ns.print("");
    }
    
    // Augmentation Status
    displayAugmentationStatus(ns, player);
    ns.print("");
    
    // Stock Status (if available)
    if (hasStockAccess(ns)) {
        displayStockStatus(ns);
        ns.print("");
    }
    
    // Network Status
    displayNetworkStatus(ns);
    ns.print("");
}

/**
 * Display game phase and transition progress
 */
function displayPhaseStatus(ns, currentPhase, progress, nextPhase) {
    const phaseNames = ["Bootstrap", "Early", "Mid-Game", "Gang", "Late"];
    const currentName = phaseNames[currentPhase] || "Unknown";
    const nextName = phaseNames[nextPhase] || "Complete";
    
    const progressBar = "█".repeat(Math.floor(progress * 20)) + 
                        "░".repeat(20 - Math.floor(progress * 20));
    
    ns.print(`💎 PHASE: ${currentName.padEnd(12)} [${progressBar}] ${(progress * 100).toFixed(1)}%`);
    ns.print(`   Next: ${nextName}`);
}

/**
 * Display money and XP generation rates
 */
function displayEconomicsMetrics(ns, money, player, moneyRate, xpRate) {
    const monthlyRate = moneyRate * 3600 * 24 * 30; // Scale to monthly
    const dailyRate = moneyRate * 3600 * 24;
    
    ns.print(`💰 MONEY: ${formatMoney(money).padEnd(15)} | Rate: ${formatMoney(moneyRate)}/s | Daily: ${formatMoney(dailyRate)}`);
    ns.print(`📖 XP: Level ${player.skills.hacking} | Rate: ${xpRate.toFixed(2)} XP/s`);
}

/**
 * Display hacking metrics
 */
function displayHackingStatus(ns, player) {
    const serverCount = countRootedServers(ns);
    const purchasedServers = countPurchasedServers(ns);
    const totalRam = calculateTotalRam(ns);
    const usedRam = calculateUsedRam(ns);
    
    const ramBar = "▮".repeat(Math.floor((usedRam / totalRam) * 20)) + 
                   "▯".repeat(20 - Math.floor((usedRam / totalRam) * 20));
    
    ns.print(`⚔️  HACKING: ${player.skills.hacking.toString().padStart(4)} (${(player.skills.hacking / 1000).toFixed(1)}k/1k)`);
    ns.print(`🖥️  NETWORK: ${serverCount} rooted | ${purchasedServers} purchased`);
    ns.print(`💾 RAM: ${ramBar} ${(usedRam / 1024).toFixed(1)}TB / ${(totalRam / 1024).toFixed(1)}TB`);
}

/**
 * Display gang status
 */
function displayGangStatus(ns) {
    try {
        const info = ns.gang.getGangInformation();
        const members = ns.gang.getMemberNames();
        const territory = (info.territory * 100).toFixed(1);
        
        ns.print(`👾 GANG: ${info.faction} | Members: ${members.length} | Territory: ${territory}% | Power: ${info.power.toFixed(2)}`);
        ns.print(`   Respect: ${formatMoney(info.respect)} | Wanted: ${info.wantedLevel.toFixed(0)} (×${info.wantedPenalty.toFixed(2)})`);
    } catch (e) {
        // Gang not available
    }
}

/**
 * Display augmentation queue status
 */
function displayAugmentationStatus(ns, player) {
    const ownedCount = player.augmentations.length;
    
    // Get queued augmentations
    let queuedCount = 0;
    try {
        // This is a workaround - check if singularity is available
        const purchased = ns.singularity.getOwnedAugmentations(true); // pending vs installed
        const installed = ns.singularity.getOwnedAugmentations(false); // all
        queuedCount = installed.length - purchased.length;
    } catch (e) {
        // Singularity not available
    }
    
    const queuedText = queuedCount > 0 ? `QUEUED: ${queuedCount}` : "No queue";
    const resetThreshold = config.augmentations?.minQueuedAugs || 7;
    const status = queuedCount >= resetThreshold ? "🔴 READY FOR RESET" : "⏳ Building queue";
    
    ns.print(`🧬 AUGMENTS: Installed ${ownedCount} | ${queuedText} | ${status} (threshold: ${resetThreshold})`);
}

/**
 * Display stock portfolio status
 */
function displayStockStatus(ns) {
    try {
        const symbols = ns.stock.getSymbols();
        let totalInvested = 0;
        let totalValue = 0;
        let holdings = 0;
        
        for (const sym of symbols) {
            const pos = ns.stock.getPosition(sym);
            if (pos[0] > 0) {
                holdings++;
                const invested = pos[0] * pos[1]; // shares × avg price
                const current = pos[0] * ns.stock.getBidPrice(sym); // current value
                totalInvested += invested;
                totalValue += current;
            }
        }
        
        const gain = totalValue - totalInvested;
        const gainPct = totalInvested > 0 ? (gain / totalInvested * 100) : 0;
        
        ns.print(`📈 STOCKS: ${holdings} holdings | Invested: ${formatMoney(totalInvested)} | Value: ${formatMoney(totalValue)} | Gain: ${formatMoney(gain)} (${gainPct.toFixed(1)}%)`);
    } catch (e) {
        // Stocks not available
    }
}

/**
 * Display network and resource utilization
 */
function displayNetworkStatus(ns) {
    const player = ns.getPlayer();
    const stats = [
        {name: "Strength", val: player.skills.strength},
        {name: "Defense", val: player.skills.defense},
        {name: "Dexterity", val: player.skills.dexterity},
        {name: "Agility", val: player.skills.agility},
    ];
    
    const statLine = stats.map(s => `${s.name}: ${s.val.toString().padStart(4)}`).join(" | ");
    ns.print(`⚔️  COMBAT: ${statLine}`);
}

/**
 * Get game phase progress (0.0 to 1.0)
 */
function getPhaseProgress(ns, currentPhase) {
    const player = ns.getPlayer();
    const money = player.money + ns.getServerMoneyAvailable("home");
    const hack = player.skills.hacking;
    const thresholds = config.gamePhases.thresholds || {};
    
    let progress = 0;
    
    if (currentPhase === 0) {
        // Bootstrap progress: money to 10M
        const target = thresholds.phase0to1?.money || 10000000;
        progress = Math.min(1, money / target);
    } else if (currentPhase === 1) {
        // Early progress: money to 100M, level to 200
        const moneyTarget = thresholds.phase1to2?.money || 100000000;
        const hackTarget = thresholds.phase1to2?.hackLevel || 200;
        progress = Math.min(1, Math.max(money / moneyTarget, hack / hackTarget));
    } else if (currentPhase === 2) {
        // Mid progress: money to 500M, level to 500
        const moneyTarget = thresholds.phase2to3?.money || 500000000;
        const hackTarget = thresholds.phase2to3?.hackLevel || 500;
        progress = Math.min(1, Math.max(money / moneyTarget, hack / hackTarget));
    } else if (currentPhase === 3) {
        // Gang progress: level to 800
        const hackTarget = thresholds.phase3to4?.hackLevel || 800;
        progress = Math.min(1, hack / hackTarget);
    } else {
        progress = 1.0;
    }
    
    return progress;
}

/**
 * Read game phase from orchestrator
 */
function readGamePhase(ns) {
    const phasePortData = ns.peek(PHASE_PORT);
    if (phasePortData === "NULL PORT DATA") return 0;
    return parseInt(phasePortData) || 0;
}

/**
 * Count rooted servers
 */
function countRootedServers(ns) {
    const all = scanAll(ns);
    return all.filter(s => ns.hasRootAccess(s)).length;
}

/**
 * Count purchased servers
 */
function countPurchasedServers(ns) {
    try {
        return ns.getPurchasedServers().length;
    } catch (e) {
        return 0;
    }
}

/**
 * Calculate total RAM available
 */
function calculateTotalRam(ns) {
    const all = scanAll(ns);
    let total = 0;
    for (const server of all) {
        if (ns.hasRootAccess(server)) {
            total += ns.getServerMaxRam(server);
        }
    }
    return total;
}

/**
 * Calculate used RAM
 */
function calculateUsedRam(ns) {
    const all = scanAll(ns);
    let total = 0;
    for (const server of all) {
        if (ns.hasRootAccess(server)) {
            total += ns.getServerUsedRam(server);
        }
    }
    return total;
}

/**
 * Scan all servers
 */
function scanAll(ns, server = "home", visited = new Set()) {
    visited.add(server);
    const neighbors = ns.scan(server);
    for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
            scanAll(ns, neighbor, visited);
        }
    }
    return Array.from(visited);
}

/**
 * Check stock access
 */
function hasStockAccess(ns) {
    try {
        return ns.stock.hasTIXAPIAccess && ns.stock.has4SDataTIXAPI && 
               ns.stock.hasTIXAPIAccess() && ns.stock.has4SDataTIXAPI();
    } catch (e) {
        return false;
    }
}
