/**
 * Hacknet automation module
 * @param {NS} ns
 */
import { config } from "/angel/config.js";
import { createWindow } from "/angel/modules/uiManager.js";

export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("hacknet", "🔗 Hacknet", 600, 350, ns);
    ui.log("Module started", "info");

    while (true) {
        try {
            const bought = buyBestUpgrade(ns, ui);
            if (!bought) {
                await ns.sleep(30000);
            } else {
                await ns.sleep(2000);
            }
        } catch (e) {
            ui.log(`Error: ${e}`, "error");
            await ns.sleep(5000);
        }
    }
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

    if (best.type === "node") {
        ns.hacknet.purchaseNode();
        ns.print("[Hacknet] Purchased new node");
        return true;
    }

    if (best.type === "level") ns.hacknet.upgradeLevel(best.node, 1);
    if (best.type === "ram") ns.hacknet.upgradeRam(best.node, 1);
    if (best.type === "core") ns.hacknet.upgradeCore(best.node, 1);
    if (best.type === "cache") ns.hacknet.upgradeCache(best.node, 1);
    ns.print(`[Hacknet] Upgraded ${best.type} on node ${best.node}`);
    return true;
}

function pickBest(current, candidate) {
    if (!candidate || candidate.cost <= 0) return current;
    if (!current || candidate.cost < current.cost) return candidate;
    return current;
}
