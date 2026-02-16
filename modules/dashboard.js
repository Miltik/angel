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
import { formatMoney } from "/angel/utils.js";
import { createWindow } from "/angel/modules/uiManager.js";

const PHASE_PORT = 7;
let lastUpdate = 0;
let lastMoney = 0;
let lastXp = 0;

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("dashboard", "📊 Dashboard", 900, 600);
    ui.log("Dashboard monitoring started - Real-time metrics", "info");
    
    let loopCount = 0;
    while (true) {
        try {
            loopCount++;
            await updateDashboard(ns, ui);
            
            // Update every 30 seconds for dashboard
            await ns.sleep(30000);
        } catch (e) {
            ui.log(`Error: ${e}`, "error");
            await ns.sleep(5000);
        }
    }
}

/**
 * Update and display dashboard metrics
 */
async function updateDashboard(ns, ui) {
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
    
    try {
        // Display header
        ui.clear();
        ui.log("╔═══════════════════════════════════════════════════════════════╗", "info");
        ui.log("║            ANGEL AUTOMATION DASHBOARD                         ║", "info");
        ui.log("╚═══════════════════════════════════════════════════════════════╝", "info");
        ui.log("", "info");
        
        // Game Phase
        displayPhaseStatus(ui, currentPhase, phaseProgress, nextPhase);
        ui.log("", "info");
        
        // Money and XP Rates
        displayEconomicsMetrics(ui, money, player, moneyRate, xpRate);
        ui.log("", "info");
        
        // Hacking Status
        displayHackingStatus(ui, player, ns);
        ui.log("", "info");
        
        // Gang Status (if available)
        if (ns.gang.inGang && ns.gang.inGang()) {
            try {
                displayGangStatus(ui, ns);
                ui.log("", "info");
            } catch (e) {
                ui.log(`Gang display error: ${e}`, "debug");
            }
        }
        
        // Augmentation Status
        try {
            displayAugmentationStatus(ui, ns, player);
            ui.log("", "info");
        } catch (e) {
            ui.log(`Augment display error: ${e}`, "debug");
        }
        
        // Stock Status (if available)
        if (hasStockAccess(ns)) {
            try {
                displayStockStatus(ui, ns);
                ui.log("", "info");
            } catch (e) {
                ui.log(`Stock display error: ${e}`, "debug");
            }
        }
        
        // Network Status
        try {
            displayNetworkStatus(ui, ns);
            ui.log("", "info");
        } catch (e) {
            ui.log(`Network display error: ${e}`, "debug");
        }
    } catch (e) {
        ui.log(`Dashboard update error: ${e.message || e}`, "error");
        throw e;
    }
}

/**
 * Display game phase and transition progress
 */
function displayPhaseStatus(ui, currentPhase, progress, nextPhase) {
    const phaseNames = ["Bootstrap", "Early", "Mid-Game", "Gang", "Late"];
    const currentName = phaseNames[currentPhase] || "Unknown";
    const nextName = phaseNames[nextPhase] || "Complete";
    
    const progressBar = "█".repeat(Math.floor(progress * 20)) + 
                        "░".repeat(20 - Math.floor(progress * 20));
    
    ui.log(`💎 PHASE: ${currentName.padEnd(12)} [${progressBar}] ${(progress * 100).toFixed(1)}%`, "info");
    ui.log(`   Next: ${nextName}`, "info");
}

/**
 * Display money and XP generation rates
 */
function displayEconomicsMetrics(ui, money, player, moneyRate, xpRate) {
    const monthlyRate = moneyRate * 3600 * 24 * 30; // Scale to monthly
    const dailyRate = moneyRate * 3600 * 24;
    
    ui.log(`💰 MONEY: ${formatMoney(money).padEnd(15)} | Rate: ${formatMoney(moneyRate)}/s | Daily: ${formatMoney(dailyRate)}`, "info");
    ui.log(`📖 XP: Level ${player.skills.hacking} | Rate: ${xpRate.toFixed(2)} XP/s`, "info");
}

/**
 * Display hacking metrics
 */
function displayHackingStatus(ui, player, ns) {
    const serverCount = countRootedServers(ns);
    const purchasedServers = countPurchasedServers(ns);
    const totalRam = calculateTotalRam(ns);
    const usedRam = calculateUsedRam(ns);
    
    const ramBar = "▮".repeat(Math.floor((usedRam / totalRam) * 20)) + 
                   "▯".repeat(20 - Math.floor((usedRam / totalRam) * 20));
    
    ui.log(`⚔️  HACKING: ${player.skills.hacking.toString().padStart(4)} (${(player.skills.hacking / 1000).toFixed(1)}k/1k)`, "info");
    ui.log(`🖥️  NETWORK: ${serverCount} rooted | ${purchasedServers} purchased`, "info");
    ui.log(`💾 RAM: ${ramBar} ${(usedRam / 1024).toFixed(1)}TB / ${(totalRam / 1024).toFixed(1)}TB`, "info");
}

/**
 * Display gang status
 */
function displayGangStatus(ui, ns) {
    try {
        const info = ns.gang.getGangInformation();
        const members = ns.gang.getMemberNames();
        const territory = (info.territory * 100).toFixed(1);
        
        ui.log(`👾 GANG: ${info.faction} | Members: ${members.length} | Territory: ${territory}% | Power: ${info.power.toFixed(2)}`, "info");
        ui.log(`   Respect: ${formatMoney(info.respect)} | Wanted: ${info.wantedLevel.toFixed(0)} (×${info.wantedPenalty.toFixed(2)})`, "info");
    } catch (e) {
        // Gang not available
    }
}

/**
 * Display augmentation queue status
 */
function displayAugmentationStatus(ui, ns, player) {
    const ownedCount = player.augmentations ? player.augmentations.length : 0;
    
    // Get queued augmentations
    let queuedCount = 0;
    try {
        // This is a workaround - check if singularity is available
        const purchased = ns.singularity.getOwnedAugmentations(true); // pending vs installed
        const installed = ns.singularity.getOwnedAugmentations(false); // all
        
        // Safety check - ensure we have arrays
        if (Array.isArray(purchased) && Array.isArray(installed)) {
            queuedCount = installed.length - purchased.length;
        }
    } catch (e) {
        // Singularity not available or error getting augs
    }
    
    const queuedText = queuedCount > 0 ? `QUEUED: ${queuedCount}` : "No queue";
    const resetThreshold = config.augmentations?.minQueuedAugs || 7;
    const status = queuedCount >= resetThreshold ? "🔴 READY FOR RESET" : "⏳ Building queue";
    
    ui.log(`🧬 AUGMENTS: Installed ${ownedCount} | ${queuedText} | ${status} (threshold: ${resetThreshold})`, "info");
}

/**
 * Display stock portfolio status
 */
function displayStockStatus(ui, ns) {
    try {
        const symbols = ns.stock.getSymbols();
        
        // Safety check for symbols
        if (!symbols || !Array.isArray(symbols)) {
            return;
        }
        
        let totalInvested = 0;
        let totalValue = 0;
        let holdings = 0;
        
        for (const sym of symbols) {
            const pos = ns.stock.getPosition(sym);
            if (pos && pos[0] > 0) {
                holdings++;
                const invested = pos[0] * pos[1]; // shares × avg price
                const current = pos[0] * ns.stock.getBidPrice(sym); // current value
                totalInvested += invested;
                totalValue += current;
            }
        }
        
        const gain = totalValue - totalInvested;
        const gainPct = totalInvested > 0 ? (gain / totalInvested * 100) : 0;
        
        ui.log(`📈 STOCKS: ${holdings} holdings | Invested: ${formatMoney(totalInvested)} | Value: ${formatMoney(totalValue)} | Gain: ${formatMoney(gain)} (${gainPct.toFixed(1)}%)`, "info");
    } catch (e) {
        // Stocks not available
    }
}

/**
 * Display network and resource utilization
 */
function displayNetworkStatus(ui, ns) {
    const player = ns.getPlayer();
    const stats = [
        {name: "Strength", val: player.skills.strength},
        {name: "Defense", val: player.skills.defense},
        {name: "Dexterity", val: player.skills.dexterity},
        {name: "Agility", val: player.skills.agility},
    ];
    
    const statLine = stats.map(s => `${s.name}: ${s.val.toString().padStart(4)}`).join(" | ");
    ui.log(`⚔️  COMBAT: ${statLine}`, "info");
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
    try {
        const all = scanAll(ns);
        if (!all || !Array.isArray(all)) return 0;
        return all.filter(s => ns.hasRootAccess(s)).length;
    } catch (e) {
        return 0;
    }
}

/**
 * Count purchased servers
 */
function countPurchasedServers(ns) {
    try {
        const purchased = ns.getPurchasedServers();
        return purchased && Array.isArray(purchased) ? purchased.length : 0;
    } catch (e) {
        return 0;
    }
}

/**
 * Calculate total RAM available
 */
function calculateTotalRam(ns) {
    try {
        const all = scanAll(ns);
        if (!all || !Array.isArray(all)) return 0;
        let total = 0;
        for (const server of all) {
            if (ns.hasRootAccess(server)) {
                total += ns.getServerMaxRam(server);
            }
        }
        return total;
    } catch (e) {
        return 0;
    }
}

/**
 * Calculate used RAM
 */
function calculateUsedRam(ns) {
    try {
        const all = scanAll(ns);
        if (!all || !Array.isArray(all)) return 0;
        let total = 0;
        for (const server of all) {
            if (ns.hasRootAccess(server)) {
                total += ns.getServerUsedRam(server);
            }
        }
        return total;
    } catch (e) {
        return 0;
    }
}

/**
 * Scan all servers
 */
function scanAll(ns, server = "home", visited = new Set()) {
    try {
        visited.add(server);
        const neighbors = ns.scan(server);
        
        // Safety check for neighbors
        if (!neighbors || !Array.isArray(neighbors)) {
            return Array.from(visited);
        }
        
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                scanAll(ns, neighbor, visited);
            }
        }
    } catch (e) {
        // Scan failed, return what we have
    }
    
    return Array.from(visited);
}

/**
 * Check stock access
 */
function hasStockAccess(ns) {
    try {
        return ns.stock && ns.stock.hasTIXAPIAccess && ns.stock.has4SDataTIXAPI && 
               ns.stock.hasTIXAPIAccess() && ns.stock.has4SDataTIXAPI();
    } catch (e) {
        return false;
    }
}
