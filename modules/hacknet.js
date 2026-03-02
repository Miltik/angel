/**
 * Hacknet automation module
 * @param {NS} ns
 */
import { config } from "/angel/config.js";
import { createWindow } from "/angel/modules/uiManager.js";
import { formatMoney } from "/angel/utils.js";

const HACKNET_TELEMETRY_PORT = 21;

// State tracking
let lastState = {
    nodeCount: 0,
    totalProduction: 0,
    loopCount: 0,
    lastUpgradeLoop: -10
};

// Telemetry tracking
let telemetryState = {
    lastMoney: 0,
    lastReportTime: 0,
    totalInvestment: 0,
    upgradesCompleted: 0
};

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("hacknet", "🌐 Hacknet", 600, 350, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("🌐 Hacknet automation initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");

    // Initialize telemetry tracking
    telemetryState.lastMoney = ns.getServerMoneyAvailable("home");
    telemetryState.lastReportTime = Date.now();

    while (true) {
        try {
            const loopStartTime = Date.now();
            lastState.loopCount++;
            
            // Check telemetry FIRST before anything else
            const timeSinceLastReport = loopStartTime - telemetryState.lastReportTime;
            if (timeSinceLastReport >= 5000) {
                ns.print(`🚀 Loop ${lastState.loopCount}: REPORTING (${timeSinceLastReport}ms >= 5000ms)`);
                reportTelemetry(ns);
            } else if (lastState.loopCount === 1 || lastState.loopCount % 20 === 0) {
                ns.print(`🔄 Loop ${lastState.loopCount}: ${timeSinceLastReport}ms since last report (need 5000ms)`);
            }
            
            const bought = buyBestUpgrade(ns, ui);
            
            // Display status periodically (every 10 loops = ~5 minutes if not buying)
            if (!bought && lastState.loopCount % 10 === 0) {
                displayStatus(ns, ui);
            }
            
            // Sleep with dynamic timing based on telemetry readiness
            const timeSinceLastReportAfterBuy = Date.now() - telemetryState.lastReportTime;
            const timeUntilNextReport = Math.max(0, 5000 - timeSinceLastReportAfterBuy);
            const sleepTime = Math.min(timeUntilNextReport, bought ? 2000 : 30000);
            
            if (!bought) {
                await ns.sleep(Math.min(sleepTime, 30000));
            } else {
                await ns.sleep(Math.min(sleepTime, 2000));
            }
        } catch (e) {
            if (isScriptDeathError(e)) {
                return;
            }
            ns.print(`❌ Loop error: ${e}`);
            ui.log(`❌ Error: ${e}`, "error");
            await ns.sleep(5000);
        }
    }
}

function isScriptDeathError(error) {
    const message = String(error || "");
    return message.includes("ScriptDeath") || message.includes("NS instance has already been killed");
}

/**
 * Report telemetry metrics to dashboard
 */
function reportTelemetry(ns) {
    try {
        const now = Date.now();
        const currentMoney = ns.getServerMoneyAvailable('home');
        const timeDelta = (now - telemetryState.lastReportTime) / 1000; // seconds
        
        // Calculate production rate
        const moneyRate = timeDelta > 0 ? (currentMoney - telemetryState.lastMoney) / timeDelta : 0;
        
        // Get hacknet stats
        const nodeCount = ns.hacknet.numNodes();
        let totalRam = 0;
        let totalCores = 0;
        let totalLevel = 0;
        
        for (let i = 0; i < nodeCount; i++) {
            const node = ns.hacknet.getNodeStats(i);
            totalRam += node.ram;
            totalCores += node.cores;
            totalLevel += node.level;
        }
        
        // Calculate total investment (rough estimate based on config)
        const budgetInfo = getHacknetBudget(ns);
        
        // Report to telemetry
        const metricsPayload = {
            moneyRate: Math.max(0, moneyRate),
            nodes: nodeCount,
            totalRam: totalRam,
            totalCores: totalCores,
            avgLevel: nodeCount > 0 ? (totalLevel / nodeCount).toFixed(1) : 0,
            totalInvestment: telemetryState.totalInvestment,
            upgradesCompleted: telemetryState.upgradesCompleted,
            budget: budgetInfo.budget,
            reserve: budgetInfo.reserve
        };
        writeHacknetMetrics(ns, metricsPayload);
        
        // Diagnostic: confirm reporting (100% for troubleshooting)
        ns.print(`📊 Reported hacknet: ${nodeCount} nodes, ${telemetryState.upgradesCompleted} upgrades, $${(telemetryState.totalInvestment / 1e6).toFixed(2)}M invested`);
        
        // Update state
        telemetryState.lastMoney = currentMoney;
        telemetryState.lastReportTime = now;
    } catch (e) {
        ns.print(`❌ Hacknet telemetry error: ${e}`);
    }
}

function writeHacknetMetrics(ns, metricsPayload) {
    try {
        const payload = JSON.stringify({
            module: 'hacknet',
            timestamp: Date.now(),
            metrics: metricsPayload,
        });
        const ok = ns.tryWritePort(HACKNET_TELEMETRY_PORT, payload);
        if (!ok) {
            ns.print('⚠️ Failed to write hacknet metrics to port 21 (queue full)');
        }
    } catch (e) {
        ns.print(`❌ Hacknet port write error: ${e}`);
    }
}

function displayStatus(ns, ui) {
    const count = ns.hacknet.numNodes();
    const budgetInfo = getHacknetBudget(ns);
    const budget = budgetInfo.budget;
    
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log(`🌐 Hacknet Status | Nodes: ${count} | 💰 Budget: ${formatMoney(budget)} | Reserve: ${formatMoney(budgetInfo.reserve)} | Ratio: ${(budgetInfo.spendRatio * 100).toFixed(0)}%`, "info");
}

function buyBestUpgrade(ns, ui) {
    const budgetInfo = getHacknetBudget(ns);
    const budget = budgetInfo.budget;
    if (budget <= 0) return false;

    let best = null;

    const nodeCost = ns.hacknet.getPurchaseNodeCost();
    if (nodeCost <= budget) {
        best = { type: "node", cost: nodeCost };
    }

    const count = ns.hacknet.numNodes();
    for (let i = 0; i < count; i++) {
        const levelCost = ns.hacknet.getLevelUpgradeCost(i, 1);
        const ramCost = ns.hacknet.getRamUpgradeCost(i, 1);
        const coreCost = ns.hacknet.getCoreUpgradeCost(i, 1);
        const cacheCost = ns.hacknet.getCacheUpgradeCost(i, 1);

        best = pickBest(best, { type: "level", node: i, cost: levelCost });
        best = pickBest(best, { type: "ram", node: i, cost: ramCost });
        best = pickBest(best, { type: "core", node: i, cost: coreCost });
        if (config.hacknet.allowCache) {
            best = pickBest(best, { type: "cache", node: i, cost: cacheCost });
        }
    }

    if (!best || best.cost > budget) return false;

    // Track state change
    lastState.lastUpgradeLoop = lastState.loopCount;

    if (best.type === "node") {
        const purchasedNode = ns.hacknet.purchaseNode();
        if (purchasedNode === -1) {
            return false;
        }
        lastState.nodeCount = ns.hacknet.numNodes();
        telemetryState.totalInvestment += best.cost;
        telemetryState.upgradesCompleted++;
        ui.log(`✅ Purchased new node (total: ${lastState.nodeCount}) | ${formatMoney(best.cost)}`, "success");
        return true;
    }

    if (best.type === "level") {
        if (!ns.hacknet.upgradeLevel(best.node, 1)) return false;
        telemetryState.totalInvestment += best.cost;
        telemetryState.upgradesCompleted++;
        ui.log(`⬆️ Upgraded level on node ${best.node} | ${formatMoney(best.cost)}`, "success");
    }
    if (best.type === "ram") {
        if (!ns.hacknet.upgradeRam(best.node, 1)) return false;
        telemetryState.totalInvestment += best.cost;
        telemetryState.upgradesCompleted++;
        ui.log(`💾 Upgraded RAM on node ${best.node} | ${formatMoney(best.cost)}`, "success");
    }
    if (best.type === "core") {
        if (!ns.hacknet.upgradeCore(best.node, 1)) return false;
        telemetryState.totalInvestment += best.cost;
        telemetryState.upgradesCompleted++;
        ui.log(`🔧 Upgraded core on node ${best.node} | ${formatMoney(best.cost)}`, "success");
    }
    if (best.type === "cache") {
        if (!ns.hacknet.upgradeCache(best.node, 1)) return false;
        telemetryState.totalInvestment += best.cost;
        telemetryState.upgradesCompleted++;
        ui.log(`📦 Upgraded cache on node ${best.node} | ${formatMoney(best.cost)}`, "success");
    }
    return true;
}

function pickBest(current, candidate) {
    if (!candidate || !Number.isFinite(candidate.cost) || candidate.cost <= 0) return current;
    if (!current || candidate.cost < current.cost) return candidate;
    return current;
}

function getHacknetBudget(ns) {
    const settings = config.hacknet;
    const money = ns.getServerMoneyAvailable("home");
    const nodeCount = ns.hacknet.numNodes();

    const bootstrapNodeTarget = settings.bootstrapNodeTarget ?? 2;
    const inBootstrap = nodeCount < bootstrapNodeTarget;

    const spendRatio = inBootstrap
        ? (settings.bootstrapSpendRatio ?? 0.9)
        : settings.maxSpendRatio;

    const reserveMoney = settings.reserveMoney ?? 0;
    const reserveScale = settings.reserveScale ?? 0.25;
    const minReserveMoney = settings.minReserveMoney ?? 0;

    const scaledReserve = Math.min(reserveMoney, money * reserveScale);
    const reserve = inBootstrap ? 0 : Math.max(minReserveMoney, scaledReserve);
    const budget = Math.max(0, (money - reserve) * spendRatio);

    return { budget, reserve, spendRatio, inBootstrap };
}
