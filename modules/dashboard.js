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
const XP_FARM_SCRIPT = "/angel/modules/xpFarm.js";
const XP_FARM_WORKER = "/angel/workers/weaken.js";
const XP_FARM_MARKER = "__angel_xpfarm__";
let lastUpdate = 0;
let lastMoney = 0;
let lastXp = 0;
let lastMoneySources = null;
let lastMoneySourceUpdate = 0;
let augmentQueueState = {
    noQueueSince: 0,
};
let coordinatorState = {
    currentPhase: 0,
};

// Reset tracking
const RESET_HISTORY_KEY = "angelResetHistory";
const RESET_STATE_KEY = "angelResetState";
const MAX_RESET_HISTORY = 50;

function initializeResetTracking(ns) {
    const now = Date.now();
    const resetInfo = ns.getResetInfo();
    const lastAugReset = Number(resetInfo?.lastAugReset || now);

    let state = loadResetState();
    
    // Detect if we've reset since last session
    const resetDetected = state.lastSeenAugReset > 0 && lastAugReset !== state.lastSeenAugReset;
    
    if (resetDetected || !state.currentRun) {
        state.currentRun = {
            startEpoch: lastAugReset,
            startedAt: new Date(lastAugReset).toISOString(),
            startHackLevel: Number(ns.getPlayer().skills.hacking || 0),
            startCash: Number(ns.getServerMoneyAvailable("home") || 0),
        };
    }
    
    state.lastSeenAugReset = lastAugReset;
    state.lastHeartbeat = now;
    saveResetState(state);
    return state;
}

function loadResetState() {
    try {
        const stored = localStorage.getItem(RESET_STATE_KEY);
        return stored ? JSON.parse(stored) : { currentRun: null, lastSeenAugReset: 0, lastHeartbeat: 0 };
    } catch (e) {
        return { currentRun: null, lastSeenAugReset: 0, lastHeartbeat: 0 };
    }
}

function saveResetState(state) {
    try {
        localStorage.setItem(RESET_STATE_KEY, JSON.stringify(state));
    } catch (e) {
        // Ignore storage errors
    }
}

function recordResetSnapshot(ns) {
    const state = loadResetState();
    const player = ns.getPlayer();
    const now = Date.now();
    const resetInfo = ns.getResetInfo();
    const lastAugReset = Number(resetInfo?.lastAugReset || now);
    
    const playtimeMs = Math.max(0, now - lastAugReset);
    const finalCash = Number(ns.getServerMoneyAvailable("home") || 0);
    const finalHackLevel = Number(player.skills.hacking || 0);
    
    const snapshot = {
        timestamp: new Date(now).toISOString(),
        startEpoch: state.currentRun?.startEpoch || lastAugReset,
        endEpoch: now,
        durationMs: playtimeMs,
        durationLabel: formatDuration(playtimeMs),
        finalCash,
        finalHackLevel,
        purchasedAugCount: ns.singularity.getOwnedAugmentations(true).length - ns.singularity.getOwnedAugmentations(false).length,
    };
    
    // Add to history
    let history = loadResetHistory();
    history.push(snapshot);
    
    // Keep only last N resets
    if (history.length > MAX_RESET_HISTORY) {
        history = history.slice(-MAX_RESET_HISTORY);
    }
    
    saveResetHistory(history);
    return snapshot;
}

function loadResetHistory() {
    try {
        const stored = localStorage.getItem(RESET_HISTORY_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

function saveResetHistory(history) {
    try {
        localStorage.setItem(RESET_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        // Ignore storage errors
    }
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("dashboard", "📊 Comprehensive Dashboard", 1000, 800, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("📊 Comprehensive dashboard monitoring initialized", "success");
    ui.log("🚫 DAEMON ADVANCEMENT: Manual unlock required (use Discord /angel-daemon-unlock)", "warn");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    
    while (true) {
        try {
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
    // Initialize reset tracking
    initializeResetTracking(ns);

    const now = Date.now();
    const player = ns.getPlayer();
    const money = player.money + ns.getServerMoneyAvailable("home");
    const hackingXp = getHackingExp(player);
    
    // Calculate rates
    const timeDiff = (now - lastUpdate) / 1000; // seconds
    const moneyRate = timeDiff > 0 ? (money - lastMoney) / timeDiff : 0;
    const xpRate = timeDiff > 0 ? Math.max(0, (hackingXp - lastXp) / timeDiff) : 0;
    
    lastUpdate = now;
    lastMoney = money;
    lastXp = hackingXp;
    
    // Get current phase and progress
    const phasePortData = ns.peek(PHASE_PORT);
    const currentPhase = phasePortData === "NULL PORT DATA"
        ? coordinatorState.currentPhase
        : (parseInt(phasePortData) || coordinatorState.currentPhase || 0);
    coordinatorState.currentPhase = currentPhase;
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
        displayPhaseStatus(ui, ns, player, currentPhase, phaseProgress, nextPhase);
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
            displayResetStatus(ui, ns);
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

        // Loot archive status
        try {
            displayLootStatus(ui, ns);
            ui.log("", "info");
        } catch (e) {
            // Loot not available
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
            const top2 = factionInfo.slice(0, 2);
            const topRep = factionInfo[0];
            ui.log(`🏛️  FACTIONS: ${factions.length} joined | ${invites.length} invites | Top rep: ${topRep.name} (${formatMoney(topRep.rep)})`, "info");

            const topLine = top2
                .map(f => `${f.name}: ${formatMoney(f.rep)} (F${f.favor.toFixed(0)})`)
                .join(" | ");
            ui.log(`   Top: ${topLine}`, "info");

            if (factionInfo.length > 2) {
                ui.log(`   + ${factionInfo.length - 2} more joined factions`, "info");
            }
        }

        const grindCandidates = getFactionGrindCandidates(ns, factions).slice(0, 2);
        if (grindCandidates.length > 0) {
            const candidateLine = grindCandidates
                .map(c => `${c.name} (A${c.grindableCount} • ${formatMoney(c.grindableValue)} • Rep ${formatMoney(c.maxRepNeeded)})`)
                .join(" | ");
            ui.log(`   🎯 Grind Priority: ${candidateLine}`, "info");
        }

        const augGoal = getAugmentGoalSnapshot(ns);
        if (augGoal) {
            ui.log(`   🧬 Aug Goal: ${augGoal.name} @ ${augGoal.faction} | Rep ${formatMoney(augGoal.repShort)} | Money ${formatMoney(augGoal.moneyShort)}`, "info");
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

function hasMetAugPrereqsDashboard(ns, augName, ownedSet) {
    try {
        const prereqs = ns.singularity.getAugmentationPrereq(augName) || [];
        if (!Array.isArray(prereqs) || prereqs.length === 0) return true;
        return prereqs.every(prereq => ownedSet.has(prereq));
    } catch (e) {
        return true;
    }
}

function getAugmentGoalSnapshot(ns) {
    try {
        const player = ns.getPlayer();
        const currentMoney = Number(ns.getServerMoneyAvailable("home") || 0);
        const owned = new Set(ns.singularity.getOwnedAugmentations(true));
        const priorityList = config.augmentations?.augmentPriority || [];
        const candidates = [];

        for (const faction of player.factions || []) {
            if (faction === "NiteSec") continue;

            const factionRep = Number(ns.singularity.getFactionRep(faction) || 0);
            const augments = ns.singularity.getAugmentationsFromFaction(faction) || [];

            for (const aug of augments) {
                if (owned.has(aug)) continue;
                if (!hasMetAugPrereqsDashboard(ns, aug, owned)) continue;

                const repReq = Number(ns.singularity.getAugmentationRepReq(aug) || 0);
                const price = Number(ns.singularity.getAugmentationPrice(aug) || 0);
                const repShort = Math.max(0, repReq - factionRep);
                const moneyShort = Math.max(0, price - currentMoney);
                const score = (moneyShort > 0 ? Math.log10(moneyShort + 1) : 0) + (repShort > 0 ? Math.log10(repShort + 1) : 0);
                const effective = Math.max(0, score - (priorityList.includes(aug) ? 0.15 : 0));

                candidates.push({ name: aug, faction, price, repReq, repShort, moneyShort, effective });
            }
        }

        if (candidates.length === 0) return null;

        candidates.sort((a, b) => {
            if (a.effective !== b.effective) return a.effective - b.effective;
            const aReady = a.repShort === 0 && a.moneyShort === 0;
            const bReady = b.repShort === 0 && b.moneyShort === 0;
            if (aReady !== bReady) return aReady ? -1 : 1;
            if (a.price !== b.price) return a.price - b.price;
            return a.name.localeCompare(b.name);
        });

        return candidates[0];
    } catch (e) {
        return null;
    }
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
            totalProduction += Number(node?.production || 0);
            totalValue += Number(node?.totalProduction || 0);
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
        
        // Scan all servers for contracts
        const servers = getAllServersForDashboard(ns);
        for (const server of servers) {
            try {
                const contracts = ns.ls(server, ".cct");
                contractCount += contracts.length;
            } catch (e) {
                // Ignore inaccessible servers
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
 * Display loot archive status
 */
function displayLootStatus(ui, ns) {
    const lootFiles = ns.ls("home", "/angel/loot/").filter(file => file !== "/angel/loot/loot.txt");
    const seedExists = ns.fileExists("/angel/loot/loot.txt", "home");

    if (!seedExists && lootFiles.length === 0) {
        ui.log("📚 LOOT: Archive not initialized", "info");
        return;
    }

    ui.log(`📚 LOOT: ${lootFiles.length} archived files${seedExists ? " | seed ready" : ""}`, "info");
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
function displayPhaseStatus(ui, ns, player, currentPhase, progress, nextPhase) {
    const phaseNames = ["Bootstrap", "Early", "Mid-Game", "Gang", "Late"];
    const currentName = phaseNames[currentPhase] || "Unknown";
    const nextName = phaseNames[nextPhase] || "Complete";
    const phaseConfig = config.gamePhases?.[`phase${currentPhase}`] || {};
    const primaryFocus = formatPhaseLabel(phaseConfig.primaryActivity || "none");
    const secondaryFocus = (phaseConfig.secondaryActivities || [])
        .slice(0, 3)
        .map(s => formatPhaseLabel(s))
        .join(", ") || "none";
    
    const progressBar = "█".repeat(Math.floor(progress * 20)) + 
                        "░".repeat(20 - Math.floor(progress * 20));
    
    ui.log(`💎 PHASE: ${currentName.padEnd(12)} [${progressBar}] ${(progress * 100).toFixed(1)}%`, "info");
    ui.log(`   Focus: ${primaryFocus} | Secondary: ${secondaryFocus}`, "info");
    ui.log(`   Next: ${nextName} | Goal: ${getPhaseGoalSummary(ns, player, currentPhase, nextPhase)}`, "info");
}

function getPhaseGoalSummary(ns, player, currentPhase, nextPhase) {
    const thresholds = config.gamePhases?.thresholds || {};
    const hackLevel = Number(player?.skills?.hacking || 0);
    const money = Number(player?.money || 0) + Number(ns.getServerMoneyAvailable("home") || 0);
    const minCombat = Math.min(
        Number(player?.skills?.strength || 0),
        Number(player?.skills?.defense || 0),
        Number(player?.skills?.dexterity || 0),
        Number(player?.skills?.agility || 0)
    );

    if (nextPhase === 1) {
        const t = thresholds.phase0to1 || { hackLevel: 75, money: 10000000 };
        const hackNeed = Math.max(0, t.hackLevel - hackLevel);
        const moneyNeed = Math.max(0, t.money - money);
        return `Hack +${Math.ceil(hackNeed)}, Money +${formatMoney(moneyNeed)}`;
    }

    if (nextPhase === 2) {
        const t = thresholds.phase1to2 || { hackLevel: 200, money: 100000000 };
        const hackNeed = Math.max(0, t.hackLevel - hackLevel);
        const moneyNeed = Math.max(0, t.money - money);
        return `Hack +${Math.ceil(hackNeed)}, Money +${formatMoney(moneyNeed)}`;
    }

    if (nextPhase === 3) {
        const t = thresholds.phase2to3 || { hackLevel: 500, money: 500000000 };
        const hackNeed = Math.max(0, t.hackLevel - hackLevel);
        const moneyNeed = Math.max(0, t.money - money);
        return `Hack +${Math.ceil(hackNeed)}, Money +${formatMoney(moneyNeed)}`;
    }

    if (nextPhase === 4 || currentPhase === 4) {
        const t = thresholds.phase3to4 || { hackLevel: 800, stats: 70 };
        const hackNeed = Math.max(0, t.hackLevel - hackLevel);
        const statNeed = Math.max(0, t.stats - minCombat);
        return `Hack +${Math.ceil(hackNeed)}, Combat mins +${Math.ceil(statNeed)}`;
    }

    return "Maintain daemon prep systems";
}

function formatPhaseLabel(value) {
    return String(value || "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/_/g, " ")
        .replace(/^./, c => c.toUpperCase());
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
    const backdooredServers = countBackdooredServers(ns);
    const purchasedServers = countPurchasedServers(ns);
    const totalRam = calculateTotalRam(ns);
    const usedRam = calculateUsedRam(ns);
    
    const ramBar = "▮".repeat(Math.floor((usedRam / totalRam) * 20)) + 
                   "▯".repeat(20 - Math.floor((usedRam / totalRam) * 20));
    
    ui.log(`⚔️  HACKING: ${player.skills.hacking.toString().padStart(4)} (${(player.skills.hacking / 1000).toFixed(1)}k/1k)`, "info");
    ui.log(`🖥️  NETWORK: ${serverCount} rooted | ${backdooredServers} backdoored | ${purchasedServers} purchased`, "info");
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
    let queuedCost = 0;
    try {
        const purchased = ns.singularity.getOwnedAugmentations(true);  // installed + queued
        const installed = ns.singularity.getOwnedAugmentations(false); // installed only
        
        // Safety check - ensure we have arrays
        if (Array.isArray(purchased) && Array.isArray(installed)) {
            queuedCount = Math.max(0, purchased.length - installed.length);
            if (queuedCount > 0) {
                const queued = purchased.filter(aug => !installed.includes(aug));
                for (const aug of queued) {
                    queuedCost += ns.singularity.getAugmentationPrice(aug);
                }
            }
        }
    } catch (e) {
        // Singularity not available or error getting augs
    }

    const now = Date.now();
    if (queuedCount <= 0) {
        if (!augmentQueueState.noQueueSince) {
            augmentQueueState.noQueueSince = now;
        }
    } else {
        augmentQueueState.noQueueSince = 0;
    }

    const queuedText = queuedCount > 0 ? `Queued ${queuedCount} (${formatMoney(queuedCost)})` : "No queue";
    const resetThreshold = config.augmentations?.minQueuedAugs || 7;
    const status = queuedCount >= resetThreshold ? "🔴 READY FOR RESET" : "⏳ Building queue";
    
    ui.log(`🧬 AUGMENTS: Installed ${ownedCount} | ${queuedText} | ${status} (threshold: ${resetThreshold})`, "info");

    const goal = getAugmentGoalSnapshot(ns);
    if (goal) {
        const readiness = goal.repShort <= 0 && goal.moneyShort <= 0 ? "READY" : "IN PROGRESS";
        ui.log(`   🎯 Target: ${goal.name} (${goal.faction}) | Rep ${formatMoney(goal.repShort)} | Money ${formatMoney(goal.moneyShort)} | ${readiness}`, "info");
    }

    const noQueueWarnMinutes = Number(config.augmentations?.noQueueWarnMinutes ?? 20);
    const noQueueCashThreshold = Number(config.augmentations?.noQueueWarnCash ?? 1000000000);
    const money = player.money + ns.getServerMoneyAvailable("home");
    if (queuedCount <= 0 && augmentQueueState.noQueueSince > 0 && money >= noQueueCashThreshold) {
        const elapsedMin = (now - augmentQueueState.noQueueSince) / 60000;
        if (elapsedMin >= noQueueWarnMinutes) {
            ui.log(`   ⚠️ Queue stalled ${Math.floor(elapsedMin)}m with ${formatMoney(money)} cash — prioritize faction rep unlocks`, "warn");
        }
    }
}

function getHackingExp(player) {
    return Number(player?.exp?.hacking ?? player?.hacking_exp ?? player?.skills?.hacking ?? 0);
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
 * Count backdoored servers
 */
function countBackdooredServers(ns) {
    try {
        const all = scanAll(ns);
        if (!all || !Array.isArray(all)) return 0;
        let count = 0;
        for (const server of all) {
            try {
                if (ns.getServer(server).backdoorInstalled) count++;
            } catch (e) {
                // Ignore inaccessible/invalid server reads
            }
        }
        return count;
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

function displayResetStatus(ui, ns) {
    try {
        const history = loadResetHistory();
        const last = history.length > 0 ? history[history.length - 1] : null;
        const now = Date.now();
        const resetInfo = ns.getResetInfo();
        const lastAugReset = Number(resetInfo?.lastAugReset || now);
        const runDuration = formatDuration(Math.max(0, now - lastAugReset));

        if (!last) {
            ui.log(`🔄 RESET TRACKING: Current run ${runDuration} | No history yet`, "info");
            return;
        }

        ui.log(`🔄 RESET TRACKING: Run ${runDuration} | Last: ${last.durationLabel} → ${formatMoney(last.finalCash)} (Hack ${last.finalHackLevel}, ${last.purchasedAugCount} augs)`, "info");
    } catch (e) {
        ui.log(`🔄 RESET TRACKING: Unavailable`, "info");
    }
}
