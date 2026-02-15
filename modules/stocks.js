/**
 * Stock market automation module (TIX + 4S)
 * @param {NS} ns
 */
import { config } from "/angel/config.js";

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    ns.print("[Stocks] Module started");

    while (true) {
        try {
            if (!hasStockAccess(ns)) {
                ns.print("[Stocks] TIX/4S not available - idle");
                await ns.sleep(60000);
                continue;
            }

            await processStocks(ns);
            await ns.sleep(60000);
        } catch (e) {
            ns.print(`[Stocks] Error: ${e}`);
            await ns.sleep(5000);
        }
    }
}

function hasStockAccess(ns) {
    try {
        return ns.stock.hasTIXAPIAccess() && ns.stock.has4SDataTIXAPI();
    } catch (e) {
        return false;
    }
}

async function processStocks(ns) {
    const symbols = ns.stock.getSymbols();
    const money = ns.getServerMoneyAvailable("home");
    const budget = Math.max(0, (money - config.stocks.reserveMoney) * config.stocks.maxSpendRatio);

    for (const sym of symbols) {
        const forecast = ns.stock.getForecast(sym);
        const position = ns.stock.getPosition(sym);
        const shares = position[0];
        const maxShares = ns.stock.getMaxShares(sym);

        if (shares > 0 && forecast <= config.stocks.sellForecast) {
            ns.stock.sellStock(sym, shares);
            ns.print(`[Stocks] Sold ${shares} of ${sym}`);
            continue;
        }

        if (forecast >= config.stocks.minForecast && budget > 0) {
            const price = ns.stock.getAskPrice(sym);
            const desired = Math.floor(maxShares * config.stocks.maxPositionRatio);
            const toBuy = Math.max(0, desired - shares);
            const affordable = Math.floor(budget / price);
            const qty = Math.min(toBuy, affordable);

            if (qty > 0) {
                ns.stock.buyStock(sym, qty);
                ns.print(`[Stocks] Bought ${qty} of ${sym}`);
            }
        }
    }
}
