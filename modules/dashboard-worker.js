/**
 * ANGEL Monitoring Dashboard (Worker)
 * This is a direct copy of the original dashboard.js for use as the worker.
 * All logic and imports are included here. Do not re-export from dashboard.js.
 */

// (Full code from dashboard.js pasted here)

import { config } from "/angel/config.js";
import { formatMoney } from "/angel/utils.js";
import { createWindow } from "/angel/modules/uiManager.js";
import { scanAll } from "/angel/services/network.js";
import { PHASE_PORT } from "/angel/ports.js";
import { 
	initializeResetTracking, 
	recordResetSnapshot,
	formatDuration,
	getCurrentRunDuration 
} from "/angel/modules/history.js";
import {
	getIncomeBreakdown,
	getPhaseGoalSummary,
	countRootedServers,
	countBackdooredServers,
	countPurchasedServers,
	calculateTotalRam,
	calculateUsedRam,
	getHackingExp,
	calculateMoneyRate,
	calculateXpRate,
	formatPhaseLabel
} from "/angel/modules/metrics.js";
import {
	displayFactionStatus,
	getFactionGrindCandidates,
	getFactionOpportunitySummaryDashboard
} from "/angel/modules/dashboard-factions.js";
import {
	displayAugmentationStatus,
	displayResetStatus
} from "/angel/modules/dashboard-augments.js";
import {
	displayGangStatus,
	displayBladeburnerStatus,
	displaySleevesStatus,
	displayHacknetStatus,
	displayProgramsStatus,
	displayContractsStatus,
	displayLootStatus,
	displayFormulasStatus,
	hasBladeburnerAccess
} from "/angel/modules/dashboard-optional.js";
import {
	displayStockStatus,
	hasStockAccess
} from "/angel/modules/dashboard-stocks.js";
import {
	displayNetworkStatus,
	displayWorldDaemonStatus
} from "/angel/modules/dashboard-combat.js";
const XP_FARM_SCRIPT = "/angel/modules/xpFarm.js";
const XP_FARM_WORKER = "/angel/workers/weaken.js";
const XP_FARM_MARKER = "__angel_xpfarm__";
let lastUpdate = 0;
let lastMoney = 0;
let lastXp = 0;
let lastMoneySources = null;
let lastMoneySourceUpdate = 0;

// Note: Reset tracking moved to /angel/modules/history.js
// Note: Metrics collection moved to /angel/modules/metrics.js

// Caching for expensive operations (Phase 1 optimization)
let dashboardCache = {
	allServers: null,
	allServersCacheTime: 0,
	ownedAllAugs: null,
	ownedInstalledAugs: null,
	augsCacheTime: 0,
};

const CACHE_TTL = 2000; // 2 second cache for dashboard cycle

function getCachedServers(ns) {
	const now = Date.now();
	if (!dashboardCache.allServers || (now - dashboardCache.allServersCacheTime > CACHE_TTL)) {
		dashboardCache.allServers = scanAll(ns);
		dashboardCache.allServersCacheTime = now;
	}
	return dashboardCache.allServers;
}

function getCachedAugmentations(ns) {
	const now = Date.now();
	if (!dashboardCache.ownedAllAugs || (now - dashboardCache.augsCacheTime > CACHE_TTL)) {
		dashboardCache.ownedAllAugs = ns.singularity.getOwnedAugmentations(true);
		dashboardCache.ownedInstalledAugs = ns.singularity.getOwnedAugmentations(false);
		dashboardCache.augsCacheTime = now;
	}
	return { all: dashboardCache.ownedAllAugs, installed: dashboardCache.ownedInstalledAugs };
}

let augmentQueueState = {
	noQueueSince: 0,
};
let coordinatorState = {
	currentPhase: 0,
};

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
			await ns.sleep(2000);
		} catch (e) {
			ui.log(`❌ Error: ${e}", "error");
			await ns.sleep(5000);
		}
	}
}

// --- Dashboard logic copied from dashboard.js ---

/**
 * Update and display dashboard metrics
 */
async function updateDashboard(ns, ui) {
	initializeResetTracking(ns);
	getCachedServers(ns);
	getCachedAugmentations(ns);
	const now = Date.now();
	const player = ns.getPlayer();
	const money = player.money + ns.getServerMoneyAvailable("home");
	const hackingXp = getHackingExp(player);
	const timeDiff = (now - lastUpdate) / 1000;
	const moneyRate = timeDiff > 0 ? (money - lastMoney) / timeDiff : 0;
	const xpRate = timeDiff > 0 ? Math.max(0, (hackingXp - lastXp) / timeDiff) : 0;
	lastUpdate = now;
	lastMoney = money;
	lastXp = hackingXp;
	const phasePortData = ns.peek(PHASE_PORT);
	const currentPhase = phasePortData === "NULL PORT DATA"
		? coordinatorState.currentPhase
		: (parseInt(phasePortData) || coordinatorState.currentPhase || 0);
	coordinatorState.currentPhase = currentPhase;
	const phaseProgress = getPhaseProgress(ns, currentPhase);
	const nextPhase = currentPhase < 4 ? currentPhase + 1 : 4;
	try {
		ui.clear();
		ui.log("╔═══════════════════════════════════════════════════════════════════════════════╗", "info");
		ui.log("║                     🏆 ANGEL COMPREHENSIVE DASHBOARD 🏆                       ║", "info");
		ui.log("╚═══════════════════════════════════════════════════════════════════════════════╝", "info");
		ui.log("", "info");
		displayPhaseStatus(ui, ns, player, currentPhase, phaseProgress, nextPhase);
		displayWorldDaemonStatus(ui, ns);
		ui.log("", "info");
		displayEconomicsMetrics(ui, ns, money, player, moneyRate, xpRate);
		ui.log("", "info");
		displayHackingStatus(ui, player, ns);
		displayXPFarmStatus(ui, ns);
		ui.log("", "info");
		try { displayCurrentActivity(ui, ns); ui.log("", "info"); } catch {}
		try { displayFactionStatus(ui, ns, player); ui.log("", "info"); } catch {}
		try { displaySleevesStatus(ui, ns); ui.log("", "info"); } catch {}
		if (ns.gang.inGang && ns.gang.inGang()) { try { displayGangStatus(ui, ns); ui.log("", "info"); } catch {} }
		try { if (hasBladeburnerAccess(ns)) { displayBladeburnerStatus(ui, ns); ui.log("", "info"); } } catch {}
		try { displayAugmentationStatus(ui, ns, player); displayResetStatus(ui, ns); ui.log("", "info"); } catch {}
		if (hasStockAccess(ns)) { try { displayStockStatus(ui, ns); ui.log("", "info"); } catch {} }
		try { displayHacknetStatus(ui, ns); ui.log("", "info"); } catch {}
		try { displayProgramsStatus(ui, ns); ui.log("", "info"); } catch {}
		try { displayContractsStatus(ui, ns); ui.log("", "info"); } catch {}
		try { displayLootStatus(ui, ns); ui.log("", "info"); } catch {}
		try { displayFormulasStatus(ui, ns); ui.log("", "info"); } catch {}
		try { displayNetworkStatus(ui, ns); ui.log("", "info"); } catch {}
		ui.log(`🕐 Last updated: ${new Date().toLocaleTimeString()} | Refresh: 2s`, "info");
	} catch (e) {
		ui.log(`Dashboard update error: ${e.message || e}", "error");
		throw e;
	}
}

function displayCurrentActivity(ui, ns) {
	try {
		const work = ns.singularity.getCurrentWork();
		if (!work) { ui.log(`🎯 ACTIVITY: Idle / Between Tasks`, "info"); return; }
		let activityText = "";
		let progressBar = "";
		if (work.type === "FACTION") {
			const gains = work.factionWorkType === "HACKING" ? `💻 Hack XP` : work.factionWorkType === "SECURITY" ? `⚔️ Combat XP` : work.factionWorkType === "FIELD" ? `🏃 Field XP` : `📚 All XP`;
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
	} catch (e) {}
}

function displayPhaseStatus(ui, ns, player, currentPhase, progress, nextPhase) {
	const phaseNames = ["Bootstrap", "Early", "Mid-Game", "Gang", "Late"];
	const currentName = phaseNames[currentPhase] || "Unknown";
	const nextName = phaseNames[nextPhase] || "Complete";
	const phaseConfig = config.gamePhases?.[`phase${currentPhase}`] || {};
	const primaryFocus = formatPhaseLabel(phaseConfig.primaryActivity || "none");
	const secondaryFocus = (phaseConfig.secondaryActivities || []).slice(0, 3).map(s => formatPhaseLabel(s)).join(", ") || "none";
	const progressBar = "█".repeat(Math.floor(progress * 20)) + "░".repeat(20 - Math.floor(progress * 20));
	ui.log(`💎 PHASE: ${currentName.padEnd(12)} [${progressBar}] ${(progress * 100).toFixed(1)}%`, "info");
	ui.log(`   Focus: ${primaryFocus} | Secondary: ${secondaryFocus}", "info");
	ui.log(`   Next: ${nextName} | Goal: ${getPhaseGoalSummary(ns, player, currentPhase, nextPhase)}", "info");
}

function getPhaseGoalSummary(ns, player, currentPhase, nextPhase) {
	const thresholds = config.gamePhases?.thresholds || {};
	const hackLevel = Number(player?.skills?.hacking || 0);
	const money = Number(player?.money || 0) + Number(ns.getServerMoneyAvailable("home") || 0);
	const minCombat = Math.min(Number(player?.skills?.strength || 0), Number(player?.skills?.defense || 0), Number(player?.skills?.dexterity || 0), Number(player?.skills?.agility || 0));
	if (nextPhase === 1) { const t = thresholds.phase0to1 || { hackLevel: 75, money: 10000000 }; return `Hack +${Math.ceil(Math.max(0, t.hackLevel - hackLevel))}, Money +${formatMoney(Math.max(0, t.money - money))}`; }
	if (nextPhase === 2) { const t = thresholds.phase1to2 || { hackLevel: 200, money: 100000000 }; return `Hack +${Math.ceil(Math.max(0, t.hackLevel - hackLevel))}, Money +${formatMoney(Math.max(0, t.money - money))}`; }
	if (nextPhase === 3) { const t = thresholds.phase2to3 || { hackLevel: 500, money: 500000000 }; return `Hack +${Math.ceil(Math.max(0, t.hackLevel - hackLevel))}, Money +${formatMoney(Math.max(0, t.money - money))}`; }
	if (nextPhase === 4 || currentPhase === 4) { const t = thresholds.phase3to4 || { hackLevel: 800, stats: 70 }; return `Hack +${Math.ceil(Math.max(0, t.hackLevel - hackLevel))}, Combat mins +${Math.ceil(Math.max(0, t.stats - minCombat))}`; }
	return "Maintain daemon prep systems";
}

function formatPhaseLabel(value) {
	return String(value || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, c => c.toUpperCase());
}

function displayEconomicsMetrics(ui, ns, money, player, moneyRate, xpRate) {
	const dailyRate = moneyRate * 3600 * 24;
	const sourceBreakdown = getIncomeBreakdown(ns);
	ui.log(`💰 MONEY: ${formatMoney(money).padEnd(15)} | Rate: ${formatMoney(moneyRate)}/s | Daily: ${formatMoney(dailyRate)}`, "info");
	if (sourceBreakdown.mode === "live") {
		if (sourceBreakdown.entries.length > 0) {
			const total = sourceBreakdown.entries.reduce((sum, entry) => sum + entry.value, 0);
			const line = sourceBreakdown.entries.slice(0, 4).map(entry => { const share = total > 0 ? (entry.value / total) * 100 : 0; return `${entry.label} ${formatMoney(entry.value)}/s (${share.toFixed(1)}%)`; }).join(" | ");
			ui.log(`   📊 Income Sources (live): ${line}", "info");
		} else {
			ui.log(`   📊 Income Sources (live): No positive cashflow detected this cycle", "info");
		}
	} else if (sourceBreakdown.mode === "total") {
		if (sourceBreakdown.entries.length > 0) {
			const total = sourceBreakdown.entries.reduce((sum, entry) => sum + entry.value, 0);
			const line = sourceBreakdown.entries.slice(0, 4).map(entry => { const share = total > 0 ? (entry.value / total) * 100 : 0; return `${entry.label} ${formatMoney(entry.value)} (${share.toFixed(1)}%)`; }).join(" | ");
			ui.log(`   📊 Income Sources (since install): ${line}", "info");
		}
	} else {
		ui.log(`   📊 Income Sources: Data unavailable", "info");
	}
	ui.log(`📖 XP: Level ${player.skills.hacking} | Rate: ${xpRate.toFixed(2)} XP/s`, "info");
}

function getIncomeBreakdown(ns) {
	try {
		const moneySources = ns.getMoneySources();
		const sinceInstall = moneySources?.sinceInstall;
		if (!sinceInstall || typeof sinceInstall !== "object") { return { mode: "none", entries: [] }; }
		const now = Date.now();
		if (lastMoneySources && lastMoneySourceUpdate > 0) {
			const elapsedSeconds = Math.max(0.001, (now - lastMoneySourceUpdate) / 1000);
			const liveEntries = [];
			for (const [key, currentValue] of Object.entries(sinceInstall)) {
				if (key === "total" || typeof currentValue !== "number") continue;
				const previousValue = lastMoneySources[key] || 0;
				const deltaPerSecond = (currentValue - previousValue) / elapsedSeconds;
				if (deltaPerSecond > 0) {
					liveEntries.push({ key, label: formatIncomeSourceLabel(key), value: deltaPerSecond });
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
			totalEntries.push({ key, label: formatIncomeSourceLabel(key), value });
		}
		totalEntries.sort((a, b) => b.value - a.value);
		lastMoneySources = { ...sinceInstall };
		lastMoneySourceUpdate = now;
		return { mode: "total", entries: totalEntries };
	} catch (e) { return { mode: "none", entries: [] }; }
}

function formatIncomeSourceLabel(sourceKey) {
	const labels = { hacking: "Hacking", hacknet: "Hacknet", servers: "Servers", stock: "Stocks", gang: "Gang", bladeburner: "Bladeburner", codingcontract: "Contracts", crime: "Crime", work: "Work", class: "Class", sleeves: "Sleeves", corporation: "Corporation", other: "Other" };
	if (labels[sourceKey]) return labels[sourceKey];
	return sourceKey.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());
}

function displayHackingStatus(ui, player, ns) {
	const serverCount = countRootedServers(ns);
	const backdooredServers = countBackdooredServers(ns);
	const purchasedServers = countPurchasedServers(ns);
	const totalRam = calculateTotalRam(ns);
	const usedRam = calculateUsedRam(ns);
	const ramBar = "▮".repeat(Math.floor((usedRam / totalRam) * 20)) + "▯".repeat(20 - Math.floor((usedRam / totalRam) * 20));
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
		if (xpProcess) { mode = parseXPFarmMode(xpProcess.args || []); }
		for (const server of rooted) {
			const processes = ns.ps(server).filter(proc => isSameScriptPath(proc.filename, XP_FARM_WORKER));
			let serverHasXpFarmWorker = false;
			for (const proc of processes) {
				const args = proc.args || [];
				const marked = args.some(arg => String(arg) === XP_FARM_MARKER);
				if (!marked) continue;
				totalThreads += proc.threads || 0;
				serverHasXpFarmWorker = true;
				if (mode === "inactive") { mode = "spare-home"; }
				if (target === "-" && args.length > 0) { target = String(args[0]); }
			}
			if (serverHasXpFarmWorker) { activeServers++; }
		}
		if (!xpProcess && totalThreads <= 0) { ui.log("⚡ XP FARM: Inactive", "info"); return; }
		ui.log(`⚡ XP FARM: ${mode} | Threads: ${totalThreads} | Servers: ${activeServers} | Target: ${target}", "info");
	} catch (e) { ui.log(`⚡ XP FARM: ${mode}", "info"); }
}

function parseXPFarmMode(args) { for (let i = 0; i < args.length; i++) { if (String(args[i]) === "--mode" && i + 1 < args.length) { return String(args[i + 1]); } } return "spare-home"; }
function isSameScriptPath(actualPath, expectedPath) { const normalize = (path) => String(path || "").replace(/^\//, ""); return normalize(actualPath) === normalize(expectedPath); }
function getHackingExp(player) { return Number(player?.exp?.hacking ?? player?.hacking_exp ?? player?.skills?.hacking ?? 0); }
function getPhaseProgress(ns, currentPhase) { const player = ns.getPlayer(); const money = player.money + ns.getServerMoneyAvailable("home"); const hack = player.skills.hacking; const thresholds = config.gamePhases.thresholds || {}; let progress = 0; if (currentPhase === 0) { const target = thresholds.phase0to1?.money || 10000000; progress = Math.min(1, money / target); } else if (currentPhase === 1) { const moneyTarget = thresholds.phase1to2?.money || 100000000; const hackTarget = thresholds.phase1to2?.hackLevel || 200; progress = Math.min(1, Math.max(money / moneyTarget, hack / hackTarget)); } else if (currentPhase === 2) { const moneyTarget = thresholds.phase2to3?.money || 500000000; const hackTarget = thresholds.phase2to3?.hackLevel || 500; progress = Math.min(1, Math.max(money / moneyTarget, hack / hackTarget)); } else if (currentPhase === 3) { const hackTarget = thresholds.phase3to4?.hackLevel || 800; progress = Math.min(1, hack / hackTarget); } else { progress = 1.0; } return progress; }
function countRootedServers(ns) { try { const all = scanAll(ns); if (!all || !Array.isArray(all)) return 0; return all.filter(s => ns.hasRootAccess(s)).length; } catch (e) { return 0; } }
function countBackdooredServers(ns) { try { const all = scanAll(ns); if (!all || !Array.isArray(all)) return 0; let count = 0; for (const server of all) { try { if (ns.getServer(server).backdoorInstalled) count++; } catch (e) {} } return count; } catch (e) { return 0; } }
function countPurchasedServers(ns) { try { const purchased = ns.getPurchasedServers(); return purchased && Array.isArray(purchased) ? purchased.length : 0; } catch (e) { return 0; } }
function calculateTotalRam(ns) { try { const all = scanAll(ns); if (!all || !Array.isArray(all)) return 0; let total = 0; for (const server of all) { if (ns.hasRootAccess(server)) { total += ns.getServerMaxRam(server); } } return total; } catch (e) { return 0; } }
function calculateUsedRam(ns) { try { const all = scanAll(ns); if (!all || !Array.isArray(all)) return 0; let total = 0; for (const server of all) { if (ns.hasRootAccess(server)) { total += ns.getServerUsedRam(server); } } return total; } catch (e) { return 0; } }
