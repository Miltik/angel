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
const XP_FARM_SCRIPT = "/angel/xpFarm.js";
const XP_FARM_WORKER = "/angel/workers/weaken.js";
const XP_FARM_MARKER = "__angel_xpfarm__";
let lastUpdate = 0;
let lastMoney = 0;
let lastXp = 0;
let lastMoneySources = null;
let lastMoneySourceUpdate = 0;

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("dashboard", "📊 Comprehensive Dashboard", 1000, 800, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("📊 Comprehensive dashboard monitoring initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    
    let loopCount = 0;
    while (true) {
        try {
            loopCount++;
            await updateDashboard(ns, ui);
            
            // Update every 2 seconds for real-time monitoring
            await ns.sleep(2000);
        } catch (e) {
            ui.log(`❌ Error: ${e}`, "error");
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
        ui.log("╔═══════════════════════════════════════════════════════════════════════════════╗", "info");
        ui.log("║                     🏆 ANGEL COMPREHENSIVE DASHBOARD 🏆                       ║", "info");
        ui.log("╚═══════════════════════════════════════════════════════════════════════════════╝", "info");
        ui.log("", "info");
        
        // Game Phase
        displayPhaseStatus(ui, currentPhase, phaseProgress, nextPhase);
        ui.log("", "info");
        
        // Money and XP Rates
        displayEconomicsMetrics(ui, ns, money, player, moneyRate, xpRate);
        ui.log("", "info");
        
        // Hacking Status
        displayHackingStatus(ui, player, ns);
        displayXPFarmStatus(ui, ns);
        ui.log("", "info");
        
        // Current Activity (what player is doing right now)
        try {
            displayCurrentActivity(ui, ns);
            ui.log("", "info");
        } catch (e) {
            // Singularity not available
        }
        
        // Faction Status
        try {
            displayFactionStatus(ui, ns, player);
            ui.log("", "info");
        } catch (e) {
            // Singularity not available
        }
        
        // Sleeves Status
        try {
            displaySleevesStatus(ui, ns);
            ui.log("", "info");
        } catch (e) {
            // Sleeves not available
        }
        
        // Gang Status (if available)
        if (ns.gang.inGang && ns.gang.inGang()) {
            try {
                displayGangStatus(ui, ns);
                ui.log("", "info");
            } catch (e) {
                // Gang not available
            }
        }
        
        // Bladeburner Status (if available)
        try {
            if (hasBladeburnerAccess(ns)) {
                displayBladeburnerStatus(ui, ns);
                ui.log("", "info");
            }
        } catch (e) {
            // Bladeburner not available
        }
        
        // Augmentation Status
        try {
            displayAugmentationStatus(ui, ns, player);
            ui.log("", "info");
        } catch (e) {
            // Singularity not available
        }
        
        // Stock Status (if available)
        if (hasStockAccess(ns)) {
            try {
                displayStockStatus(ui, ns);
                ui.log("", "info");
            } catch (e) {
                // Stocks not available
            }
        }
        
        // Hacknet Status
        try {
            displayHacknetStatus(ui, ns);
            ui.log("", "info");
        } catch (e) {
            // Hacknet error
        }
        
        // Programs Status
        try {
            displayProgramsStatus(ui, ns);
            ui.log("", "info");
        } catch (e) {
            // Singularity not available
        }
        
        // Coding Contracts Status
        try {
            displayContractsStatus(ui, ns);
            ui.log("", "info");
        } catch (e) {
            // Contracts not available
        }
        
        // Formulas.exe Farm Status
        try {
            displayFormulasStatus(ui, ns);
            ui.log("", "info");
        } catch (e) {
            // Formulas not available
        }
        
        // Network & Combat Stats
        try {
            displayNetworkStatus(ui, ns);
            ui.log("", "info");
        } catch (e) {
            // Network error
        }
        
        ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
        ui.log(`🕐 Last updated: ${new Date().toLocaleTimeString()} | Refresh: 2s`, "info");
    } catch (e) {
        ui.log(`Dashboard update error: ${e.message || e}`, "error");
        throw e;
    }
}

/**
 * Display current player activity
 */
function displayCurrentActivity(ui, ns) {
    try {
        const work = ns.singularity.getCurrentWork();
        if (!work) {
            ui.log(`🎯 ACTIVITY: Idle / Between Tasks`, "info");
            return;
        }
        
        let activityText = "";
        let progressBar = "";
        
        if (work.type === "FACTION") {
            const gains = work.factionWorkType === "HACKING" ? `💻 Hack XP` : 
                         work.factionWorkType === "SECURITY" ? `⚔️ Combat XP` :
                         work.factionWorkType === "FIELD" ? `🏃 Field XP` : `📚 All XP`;
            activityText = `Working for ${work.factionName} (${gains})`;
        } else if (work.type === "COMPANY") {
            activityText = `Working at ${work.companyName} (💼 Rep: ${work.cyclesWorked || 0})`;
        } else if (work.type === "CRIME") {
            activityText = `Committing ${work.crimeType} (💰 Money + Karma)`;
        } else if (work.type === "CLASS") {
            activityText = `Studying ${work.classType} at ${work.location}`;
        } else if (work.type === "GRAFTING") {
            activityText = `Grafting augmentation`;
        } else if (work.type === "CREATE_PROGRAM") {
            const percent = work.cyclesWorked ? (work.cyclesWorked / 100).toFixed(1) : 0;
            progressBar = ` [${percent}%]`;
            activityText = `Creating ${work.programName}${progressBar}`;
        } else {
            activityText = `${work.type}`;
        }
        
        ui.log(`🎯 ACTIVITY: ${activityText}`, "info");
    } catch (e) {
        // getCurrentWork not available
    }
}

/**
 * Display faction memberships and rep
 */
function displayFactionStatus(ui, ns, player) {
    try {
        const factions = player.factions || [];
        const invites = ns.singularity.checkFactionInvitations();
        
        if (factions.length === 0 && invites.length === 0) {
            ui.log(`🏛️  FACTIONS: None joined | No pending invitations`, "info");
            return;
        }
        
        // Sort factions by rep (highest first)
        const factionInfo = factions.map(f => ({
            name: f,
            rep: ns.singularity.getFactionRep(f),
            favor: ns.singularity.getFactionFavor(f)
        })).sort((a, b) => b.rep - a.rep);
        
        if (factionInfo.length > 0) {
            const top3 = factionInfo.slice(0, 3);
            const factionLines = top3.map(f => 
                `${f.name}: ${formatMoney(f.rep)} rep (Favor: ${f.favor.toFixed(0)})`
            ).join(" | ");
            ui.log(`🏛️  FACTIONS: ${factionLines}`, "info");
            
            if (factionInfo.length > 3) {
                ui.log(`   + ${factionInfo.length - 3} more factions`, "info");
            }
        }

        const grindCandidates = getFactionGrindCandidates(ns, factions).slice(0, 2);
        if (grindCandidates.length > 0) {
            const candidateLine = grindCandidates
                .map(c => `${c.name} [A:${c.grindableCount}, V:${formatMoney(c.grindableValue)}, R:${formatMoney(c.maxRepNeeded)}]`)
                .join(" | ");
            ui.log(`   🎯 Grind Priority: ${candidateLine}`, "info");
        }
        
        if (invites.length > 0) {
            ui.log(`   📨 Pending Invitations: ${invites.join(", ")}`, "info");
        }
    } catch (e) {
        // Singularity not available
    }
}

function getFactionGrindCandidates(ns, factions) {
    const candidates = [];
    for (const faction of factions) {
        if (faction === "NiteSec") continue;

        const summary = getFactionOpportunitySummaryDashboard(ns, faction);
        if (summary.grindableCount <= 0) continue;

        candidates.push({
            name: faction,
            ...summary,
        });
    }

    candidates.sort((a, b) =>
        b.grindableCount - a.grindableCount ||
        b.grindableValue - a.grindableValue ||
        b.maxRepNeeded - a.maxRepNeeded
    );

    return candidates;
}

function getFactionOpportunitySummaryDashboard(ns, faction) {
    const currentRep = ns.singularity.getFactionRep(faction);
    const augments = ns.singularity.getAugmentationsFromFaction(faction);
    const owned = new Set(ns.singularity.getOwnedAugmentations(true));

    let grindableCount = 0;
    let grindableValue = 0;
    let maxRepNeeded = 0;

    for (const aug of augments) {
        if (owned.has(aug)) continue;

        const repReq = ns.singularity.getAugmentationRepReq(aug);
        const repNeeded = Math.max(0, repReq - currentRep);
        if (repNeeded <= 0) continue;

        const price = ns.singularity.getAugmentationPrice(aug);
        grindableCount++;
        grindableValue += price;
        if (repNeeded > maxRepNeeded) {
            maxRepNeeded = repNeeded;
        }
    }

    return { grindableCount, grindableValue, maxRepNeeded };
}

/**
 * Display sleeves status
 */
function displaySleevesStatus(ui, ns) {
    try {
        const numSleeves = ns.sleeve.getNumSleeves();
        if (numSleeves === 0) return;
        
        const sleeves = [];
        for (let i = 0; i < numSleeves; i++) {
            const task = ns.sleeve.getTask(i);
            const stats = ns.sleeve.getSleeve(i);
            
            let activity = "Idle";
            if (task) {
                if (task.type === "FACTION") {
                    activity = `${task.factionName} (${task.factionWorkType})`;
                } else if (task.type === "COMPANY") {
                    activity = `${task.companyName}`;
                } else if (task.type === "CRIME") {
                    activity = `Crime: ${task.crimeType}`;
                } else if (task.type === "CLASS") {
                    activity = `Study: ${task.classType}`;
                } else if (task.type === "SYNCHRO") {
                    activity = `Synchronizing`;
                } else if (task.type === "RECOVERY") {
                    activity = `Recovering ${stats.shock}%`;
                } else {
                    activity = task.type;
                }
            }
            
            sleeves.push({
                id: i,
                activity: activity,
                sync: Math.floor(stats.sync),
                shock: Math.floor(stats.shock)
            });
        }
        
        ui.log(`👥 SLEEVES (${numSleeves}):`, "info");
        for (const sleeve of sleeves) {
            const syncBar = "█".repeat(Math.floor(sleeve.sync / 5)) + "░".repeat(20 - Math.floor(sleeve.sync / 5));
            ui.log(`   #${sleeve.id}: ${sleeve.activity.padEnd(30)} | Sync: ${syncBar} ${sleeve.sync}% | Shock: ${sleeve.shock}%`, "info");
        }
    } catch (e) {
        // Sleeves not available
    }
}

/**
 * Display Bladeburner status
 */
function displayBladeburnerStatus(ui, ns) {
    try {
        const rank = ns.bladeburner.getRank();
        const stamina = ns.bladeburner.getStamina();
        const maxStamina = stamina[1];
        const currentStamina = stamina[0];
        const staminaPct = (currentStamina / maxStamina * 100).toFixed(0);
        
        const currentAction = ns.bladeburner.getCurrentAction();
        let actionText = "Idle";
        if (currentAction && currentAction.type !== "Idle") {
            actionText = `${currentAction.name} (${currentAction.type})`;
        }
        
        const city = ns.bladeburner.getCity();
        const staminaBar = "▮".repeat(Math.floor(currentStamina / maxStamina * 20)) + 
                          "▯".repeat(20 - Math.floor(currentStamina / maxStamina * 20));
        
        ui.log(`🗡️  BLADEBURNER: Rank ${rank.toFixed(0)} | ${city}`, "info");
        ui.log(`   Action: ${actionText} | Stamina: ${staminaBar} ${staminaPct}%`, "info");
    } catch (e) {
        // Bladeburner not available
    }
}

/**
 * Display Hacknet status
 */
function displayHacknetStatus(ui, ns) {
    try {
        const numNodes = ns.hacknet.numNodes();
        if (numNodes === 0) {
            ui.log(`🌐 HACKNET: No nodes purchased`, "info");
            return;
        }
        
        let totalProduction = 0;
        let totalValue = 0;
        
        for (let i = 0; i < numNodes; i++) {
            const node = ns.hacknet.getNodeStats(i);
            totalProduction += node.production;
            totalValue += node.totalProduction;
        }
        
        const productionPerSec = totalProduction;
        const productionPerHour = productionPerSec * 3600;
        
        ui.log(`🌐 HACKNET: ${numNodes} nodes | Production: ${formatMoney(productionPerSec)}/s (${formatMoney(productionPerHour)}/hr) | Total: ${formatMoney(totalValue)}`, "info");
    } catch (e) {
        // Hacknet error
    }
}

/**
 * Display program creation status
 */
function displayProgramsStatus(ui, ns) {
    try {
        const isBusy = ns.singularity.isBusy();
        
        // Check if creating a program
        const work = ns.singularity.getCurrentWork();
        if (work && work.type === "CREATE_PROGRAM") {
            const percent = work.cyclesWorked ? (work.cyclesWorked / 100).toFixed(1) : 0;
            const progressBar = "▮".repeat(Math.floor(percent / 5)) + "▯".repeat(20 - Math.floor(percent / 5));
            ui.log(`💾 PROGRAMS: Creating ${work.programName} ${progressBar} ${percent}%`, "info");
            return;
        }
        
        // List available programs to create
        const programs = [
            "BruteSSH.exe", "FTPCrack.exe", "relaySMTP.exe", "HTTPWorm.exe", "SQLInject.exe",
            "DeepscanV1.exe", "DeepscanV2.exe", "ServerProfiler.exe", "AutoLink.exe",
            "Formulas.exe"
        ];
        
        const owned = programs.filter(p => ns.fileExists(p, "home"));
        const missing = programs.filter(p => !ns.fileExists(p, "home"));
        
        if (missing.length === 0) {
            ui.log(`💾 PROGRAMS: All ${owned.length} programs owned ✓`, "info");
        } else {
            ui.log(`💾 PROGRAMS: ${owned.length}/${programs.length} owned | Missing: ${missing[0]}${missing.length > 1 ? ` +${missing.length - 1} more` : ''}`, "info");
        }
    } catch (e) {
        // Singularity not available
    }
}

/**
 * Display Coding Contracts status
 */
function displayContractsStatus(ui, ns) {
    try {
        let contractCount = 0;
        let totalRewards = 0;
        
        // Scan all servers for contracts
        const servers = getAllServersForDashboard(ns);
        for (const server of servers) {
            try {
                const contracts = ns.codingcontract.listContracts(server);
                contractCount += contracts.length;
            } catch (e) {
                // Server doesn't have contracts API
            }
        }
        
        if (contractCount === 0) {
            ui.log(`📋 CONTRACTS: No pending contracts | ✅ Solving complete`, "info");
        } else {
            ui.log(`📋 CONTRACTS: ${contractCount} pending on network`, "info");
        }
    } catch (e) {
        ui.log(`📋 CONTRACTS: Error - ${e.message.substring(0, 30)}`, "warn");
    }
}

/**
 * Display Formulas.exe farming status
 */
function displayFormulasStatus(ui, ns) {
    try {
        const hasFormulas = ns.fileExists("Formulas.exe", "home");
        
        if (!hasFormulas) {
            ui.log(`📐 FORMULAS: Not yet acquired | Searching for hashes...`, "info");
        } else {
            ui.log(`📐 FORMULAS: ✅ Active | Farming optimizations...`, "success");
        }
    } catch (e) {
        ui.log(`📐 FORMULAS: Error - ${e.message.substring(0, 30)}`, "warn");
    }
}

/**
 * Get all servers for scanning (dashboard helper)
 */
function getAllServersForDashboard(ns) {
    const servers = [];
    const visited = new Set();
    const queue = ["home"];
    
    while (queue.length > 0) {
        const server = queue.shift();
        if (visited.has(server)) continue;
        visited.add(server);
        servers.push(server);
        
        const neighbors = ns.scan(server);
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                queue.push(neighbor);
            }
        }
    }
    
    return servers;
}

/**
 * Check if player has Bladeburner access
 */
function hasBladeburnerAccess(ns) {
    try {
        ns.bladeburner.inBladeburner();
        return true;
    } catch (e) {
        return false;
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
function displayEconomicsMetrics(ui, ns, money, player, moneyRate, xpRate) {
    const dailyRate = moneyRate * 3600 * 24;
    const sourceBreakdown = getIncomeBreakdown(ns);
    
    ui.log(`💰 MONEY: ${formatMoney(money).padEnd(15)} | Rate: ${formatMoney(moneyRate)}/s | Daily: ${formatMoney(dailyRate)}`, "info");
    if (sourceBreakdown.mode === "live") {
        if (sourceBreakdown.entries.length > 0) {
            const total = sourceBreakdown.entries.reduce((sum, entry) => sum + entry.value, 0);
            const line = sourceBreakdown.entries
                .slice(0, 4)
                .map(entry => {
                    const share = total > 0 ? (entry.value / total) * 100 : 0;
                    return `${entry.label} ${formatMoney(entry.value)}/s (${share.toFixed(1)}%)`;
                })
                .join(" | ");
            ui.log(`   📊 Income Sources (live): ${line}`, "info");
        } else {
            ui.log(`   📊 Income Sources (live): No positive cashflow detected this cycle`, "info");
        }
    } else if (sourceBreakdown.mode === "total") {
        if (sourceBreakdown.entries.length > 0) {
            const total = sourceBreakdown.entries.reduce((sum, entry) => sum + entry.value, 0);
            const line = sourceBreakdown.entries
                .slice(0, 4)
                .map(entry => {
                    const share = total > 0 ? (entry.value / total) * 100 : 0;
                    return `${entry.label} ${formatMoney(entry.value)} (${share.toFixed(1)}%)`;
                })
                .join(" | ");
            ui.log(`   📊 Income Sources (since install): ${line}`, "info");
        }
    } else {
        ui.log(`   📊 Income Sources: Data unavailable`, "info");
    }
    ui.log(`📖 XP: Level ${player.skills.hacking} | Rate: ${xpRate.toFixed(2)} XP/s`, "info");
}

function getIncomeBreakdown(ns) {
    try {
        const moneySources = ns.getMoneySources();
        const sinceInstall = moneySources?.sinceInstall;
        if (!sinceInstall || typeof sinceInstall !== "object") {
            return { mode: "none", entries: [] };
        }

        const now = Date.now();
        if (lastMoneySources && lastMoneySourceUpdate > 0) {
            const elapsedSeconds = Math.max(0.001, (now - lastMoneySourceUpdate) / 1000);
            const liveEntries = [];

            for (const [key, currentValue] of Object.entries(sinceInstall)) {
                if (key === "total" || typeof currentValue !== "number") continue;
                const previousValue = lastMoneySources[key] || 0;
                const deltaPerSecond = (currentValue - previousValue) / elapsedSeconds;
                if (deltaPerSecond > 0) {
                    liveEntries.push({
                        key,
                        label: formatIncomeSourceLabel(key),
                        value: deltaPerSecond
                    });
                }
            }

            liveEntries.sort((a, b) => b.value - a.value);
            lastMoneySources = { ...sinceInstall };
            lastMoneySourceUpdate = now;
            return { mode: "live", entries: liveEntries };
        }

        const totalEntries = [];
        for (const [key, value] of Object.entries(sinceInstall)) {
            if (key === "total" || typeof value !== "number" || value <= 0) continue;
            totalEntries.push({
                key,
                label: formatIncomeSourceLabel(key),
                value
            });
        }

        totalEntries.sort((a, b) => b.value - a.value);
        lastMoneySources = { ...sinceInstall };
        lastMoneySourceUpdate = now;
        return { mode: "total", entries: totalEntries };
    } catch (e) {
        return { mode: "none", entries: [] };
    }
}

function formatIncomeSourceLabel(sourceKey) {
    const labels = {
        hacking: "Hacking",
        hacknet: "Hacknet",
        servers: "Servers",
        stock: "Stocks",
        gang: "Gang",
        bladeburner: "Bladeburner",
        codingcontract: "Contracts",
        crime: "Crime",
        work: "Work",
        class: "Class",
        sleeves: "Sleeves",
        corporation: "Corporation",
        other: "Other"
    };

    if (labels[sourceKey]) return labels[sourceKey];
    return sourceKey
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, c => c.toUpperCase());
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

function displayXPFarmStatus(ui, ns) {
    let mode = "inactive";
    try {
        const rooted = scanAll(ns).filter(server => ns.hasRootAccess(server));
        let totalThreads = 0;
        let activeServers = 0;
        let target = "-";

        const homeProcesses = ns.ps("home");
        const xpProcess = homeProcesses.find(p => isSameScriptPath(p.filename, XP_FARM_SCRIPT));
        if (xpProcess) {
            mode = parseXPFarmMode(xpProcess.args || []);
        }

        for (const server of rooted) {
            const processes = ns.ps(server).filter(proc => isSameScriptPath(proc.filename, XP_FARM_WORKER));
            let serverHasXpFarmWorker = false;
            for (const proc of processes) {
                const args = proc.args || [];
                const marked = args.some(arg => String(arg) === XP_FARM_MARKER);
                if (!marked) continue;
                totalThreads += proc.threads || 0;
                serverHasXpFarmWorker = true;
                if (mode === "inactive") {
                    mode = "spare-home";
                }
                if (target === "-" && args.length > 0) {
                    target = String(args[0]);
                }
            }
            if (serverHasXpFarmWorker) {
                activeServers++;
            }
        }

        if (!xpProcess && totalThreads <= 0) {
            ui.log("⚡ XP FARM: Inactive", "info");
            return;
        }

        ui.log(`⚡ XP FARM: ${mode} | Threads: ${totalThreads} | Servers: ${activeServers} | Target: ${target}`, "info");
    } catch (e) {
        ui.log(`⚡ XP FARM: ${mode}`, "info");
    }
}

function parseXPFarmMode(args) {
    for (let i = 0; i < args.length; i++) {
        if (String(args[i]) === "--mode" && i + 1 < args.length) {
            return String(args[i + 1]);
        }
    }
    return "spare-home";
}

function isSameScriptPath(actualPath, expectedPath) {
    const normalize = (path) => String(path || "").replace(/^\//, "");
    return normalize(actualPath) === normalize(expectedPath);
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
