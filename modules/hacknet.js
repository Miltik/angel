/**
 * Hacknet automation module
 * @param {NS} ns
 */
import { config } from "/angel/config.js";
import { createWindow } from "/angel/modules/uiManager.js";
import { formatMoney } from "/angel/utils.js";

// State tracking
let lastState = {
    nodeCount: 0,
    totalProduction: 0,
    loopCount: 0,
    lastUpgradeLoop: -10
};

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("hacknet", "🌐 Hacknet", 600, 350, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("🌐 Hacknet automation initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");

    while (true) {
        try {
            lastState.loopCount++;
            const bought = buyBestUpgrade(ns, ui);
            
            // Display status periodically (every 10 loops = ~5 minutes if not buying)
            if (!bought && lastState.loopCount % 10 === 0) {
                displayStatus(ns, ui);
            }
            
            if (!bought) {
                await ns.sleep(30000);
            } else {
                await ns.sleep(2000);
            }
        } catch (e) {
            ui.log(`❌ Error: ${e}`, "error");
            await ns.sleep(5000);
        }
    }
}

function displayStatus(ns, ui) {
    const count = ns.hacknet.numNodes();
    const money = ns.getServerMoneyAvailable("home");
    const budget = Math.max(0, (money - config.hacknet.reserveMoney) * config.hacknet.maxSpendRatio);
    
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log(`🌐 Hacknet Status | Nodes: ${count} | 💰 Budget: ${formatMoney(budget)}`, "info");
}

function buyBestUpgrade(ns, ui) {
    const money = ns.getServerMoneyAvailable("home");
    const budget = Math.max(0, (money - config.hacknet.reserveMoney) * config.hacknet.maxSpendRatio);
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
    const prevNodeCount = lastState.nodeCount;
    lastState.lastUpgradeLoop = lastState.loopCount;

    if (best.type === "node") {
        ns.hacknet.purchaseNode();
        lastState.nodeCount = ns.hacknet.numNodes();
        ui.log(`✅ Purchased new node (total: ${lastState.nodeCount}) | ${formatMoney(best.cost)}`, "success");
        return true;
    }

    if (best.type === "level") {
        ns.hacknet.upgradeLevel(best.node, 1);
        ui.log(`⬆️ Upgraded level on node ${best.node} | ${formatMoney(best.cost)}`, "success");
    }
    if (best.type === "ram") {
        ns.hacknet.upgradeRam(best.node, 1);
        ui.log(`💾 Upgraded RAM on node ${best.node} | ${formatMoney(best.cost)}`, "success");
    }
    if (best.type === "core") {
        ns.hacknet.upgradeCore(best.node, 1);
        ui.log(`🔧 Upgraded core on node ${best.node} | ${formatMoney(best.cost)}`, "success");
    }
    if (best.type === "cache") {
        ns.hacknet.upgradeCache(best.node, 1);
        ui.log(`📦 Upgraded cache on node ${best.node} | ${formatMoney(best.cost)}`, "success");
    }
    return true;
}

function pickBest(current, candidate) {
    if (!candidate || candidate.cost <= 0) return current;
    if (!current || candidate.cost < current.cost) return candidate;
    return current;
}
