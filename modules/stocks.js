/**
 * Stock market automation module (phase-aware: active in phases 3-4)
 * Intelligently builds stock positions during P3-4 when capital is available
 * 
 * @param {NS} ns
 */
import { config } from "/angel/config.js";
import { formatMoney, log } from "/angel/utils.js";

const PHASE_PORT = 7;

/**
 * Read current game phase from orchestrator
 */
function readGamePhase(ns) {
    const phasePortData = ns.peek(PHASE_PORT);
    if (phasePortData === "NULL PORT DATA") return 0;
    return parseInt(phasePortData) || 0;
}

/**
 * Get phase config
 */
function getPhaseConfig(phase) {
    const phaseKey = `phase${phase}`;
    return config.gamePhases[phaseKey] || config.gamePhases.phase0;
}

export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    log(ns, "📈 Stock market module started - Phase-gated (P3+)", "INFO");

    // Wait for phase 3+ when capital is available
    while (true) {
        const gamePhase = readGamePhase(ns);
        if (gamePhase >= 3) break;
        log(ns, `📈 Waiting for phase 3+ to begin trading (currently P${gamePhase})`, "INFO");
        await ns.sleep(60000);
    }

    if (!hasStockAccess(ns)) {
        log(ns, "📈 Stock API not available yet - idle", "WARN");
        while (true) {
            await ns.sleep(60000);
        }
    }

    log(ns, "📈 Stock trading active", "SUCCESS");

    while (true) {
        try {
            const gamePhase = readGamePhase(ns);
            if (gamePhase < 3) {
                log(ns, "📈 Phase dropped below 3 - pausing", "WARN");
                await ns.sleep(60000);
                continue;
            }

            await processStocks(ns, gamePhase);
            await ns.sleep(60000);
        } catch (e) {
            log(ns, `📈 Error: ${e}`, "ERROR");
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

/**
 * Process stock trading with phase-aware spending
 */
async function processStocks(ns, gamePhase) {
    const phaseConfig = getPhaseConfig(gamePhase);
    const symbols = ns.stock.getSymbols();
    const money = ns.getServerMoneyAvailable("home");
    
    // Phase-aware reserve and spending
    const reserveRatio = gamePhase >= 4 ? 0.1 : 0.3;  // P4 spends more on stocks, earlier phases reserve
    const reserve = money * reserveRatio;
    const budget = Math.max(0, (money - reserve) * (config.stocks.maxSpendRatio || 0.1));
    
    let bought = 0;
    let sold = 0;
    let invested = 0;

    for (const sym of symbols) {
        const forecast = ns.stock.getForecast(sym);
        const position = ns.stock.getPosition(sym);
        const shares = position[0];
        const avgPrice = position[1];
        const maxShares = ns.stock.getMaxShares(sym);

        // SELL: Forecast poor or position strong
        if (shares > 0 && forecast <= (config.stocks.sellForecast || 0.52)) {
            const profit = (ns.stock.getBidPrice(sym) - avgPrice) * shares;
            ns.stock.sellStock(sym, shares);
            log(ns, `📈 Sold ${shares} ${sym} | Profit: ${formatMoney(profit)}`, "SUCCESS");
            sold++;
            continue;
        }

        // BUY: Strong forecast and capital available
        const minForecast = config.stocks.minForecast || 0.55;
        if (forecast >= minForecast && budget > 0 && invested < budget) {
            const price = ns.stock.getAskPrice(sym);
            const desired = Math.floor(maxShares * (config.stocks.maxPositionRatio || 0.3));
            const toBuy = Math.max(0, desired - shares);
            const budgetLeft = budget - invested;
            const affordable = Math.floor(budgetLeft / price);
            const qty = Math.min(toBuy, affordable);

            if (qty > 0) {
                ns.stock.buyStock(sym, qty);
                const cost = qty * price;
                invested += cost;
                log(ns, `📈 Bought ${qty} ${sym} | Forecast: ${(forecast * 100).toFixed(1)}% | Cost: ${formatMoney(cost)}`, "SUCCESS");
                bought++;
            }
        }
    }

    if (bought > 0 || sold > 0) {
        log(ns, `📈 [P${gamePhase}] Traded: +${bought} / -${sold} | Portfolio: ${formatMoney(invested)} invested`, "INFO");
    }
}
