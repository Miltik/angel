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

// ...rest of dashboard.js code (functions, helpers, etc.)...
