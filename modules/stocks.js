/**
 * Stock market automation module (phase-aware: active in phases 3-4)
 * Intelligently builds stock positions during P3-4 when capital is available
 * 
 * @param {NS} ns
 */
import { config } from "/angel/config.js";
import { formatMoney } from "/angel/utils.js";
import { createWindow } from "/angel/modules/uiManager.js";

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
    
    // Create DOM window for output
    const ui = createWindow("stocks", "📈 Stock Market", 700, 500);
    ui.log("Stock market module initialized - Phase-gated (P3+)", "info");

    // Wait for phase 3+ when capital is available
    while (true) {
        const gamePhase = readGamePhase(ns);
        if (gamePhase >= 3) break;
        ui.log(`Waiting for phase 3+ to begin trading (currently P${gamePhase})`, "info");
        await ns.sleep(60000);
    }

    if (!hasStockAccess(ns)) {
        ui.log("Stock API not available yet - idle", "warn");
        while (true) {
            await ns.sleep(60000);
        }
    }

    ui.log("Stock trading active", "success");

    while (true) {
        try {
            const gamePhase = readGamePhase(ns);
            if (gamePhase < 3) {
                ui.log("Phase dropped below 3 - pausing", "warn");
                await ns.sleep(60000);
                continue;
            }

            await processStocks(ns, gamePhase, ui);
            await ns.sleep(60000);
        } catch (e) {
            ui.log(`Error: ${e}`, "error");
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
 * Process stock trading with phase-aware spending and aggressive tactics
 * Late game: More aggressive with lower buy thresholds and profit-taking
 */
async function processStocks(ns, gamePhase, ui) {
    const phaseConfig = getPhaseConfig(gamePhase);
    const symbols = ns.stock.getSymbols();
    const money = ns.getServerMoneyAvailable("home");
    
    // Phase-aware reserve and spending
    const reserveRatio = gamePhase >= 4 ? 0.05 : 0.2;  // P4 spends MORE on stocks
    const reserve = money * reserveRatio;
    const potentialBudget = money - reserve;
    const budget = Math.max(0, potentialBudget * getDynamicSpendRatio(gamePhase));
    
    let bought = 0;
    let sold = 0;
    let invested = 0;
    let profits = 0;

    for (const sym of symbols) {
        const forecast = ns.stock.getForecast(sym);
        const position = ns.stock.getPosition(sym);
        const shares = position[0];
        const avgPrice = position[1];
        const currentPrice = ns.stock.getAskPrice(sym);
        const maxShares = ns.stock.getMaxShares(sym);
        
        // Calculate current profit/loss
        const profitPerShare = currentPrice - avgPrice;
        const totalProfit = profitPerShare * shares;

        // PROFIT TAKING: Sell winners at phase-aware thresholds
        // P3-4: More aggressive profit-taking (15%+ gains)
        const profitThreshold = gamePhase >= 3 ? 0.15 : 0.25;
        const profitRatio = avgPrice > 0 ? profitPerShare / avgPrice : 0;
        
        if (shares > 0 && profitRatio >= profitThreshold) {
            ns.stock.sellStock(sym, shares);
            ui.log(`PROFIT: Sold ${shares} ${sym} | Gain: +${(profitRatio * 100).toFixed(1)}% (${formatMoney(totalProfit)})`, "success");
            sold++;
            profits += totalProfit;
            continue;
        }

        // STOP LOSS: Sell losers at -10% to minimize bleeding
        if (shares > 0 && profitRatio < -0.10) {
            ns.stock.sellStock(sym, shares);
            ui.log(`STOP LOSS: Sold ${shares} ${sym} | Loss: ${(profitRatio * 100).toFixed(1)}%`, "warn");
            sold++;
            continue;
        }

        // SELL: Forecast turned poor (< 50%)
        if (shares > 0 && forecast <= 0.50) {
            ns.stock.sellStock(sym, shares);
            ui.log(`SOLD: ${shares} ${sym} | Forecast: ${(forecast * 100).toFixed(1)}%`, "info");
            sold++;
            continue;
        }

        // BUY: Strong forecast with phase-aware thresholds
        // P3+: Lower threshold (0.50 = slight positive), earlier phases need 0.55+
        const minForecast = gamePhase >= 3 ? 0.50 : 0.55;
        const isGoodForecast = forecast >= minForecast;
        
        if (isGoodForecast && budget > 0 && invested < budget) {
            const price = ns.stock.getAskPrice(sym);
            
            // Position sizing based on forecast confidence
            const confidence = Math.min((forecast - 0.5) * 10, 1.0); // 0 to 1
            const baseRatio = gamePhase >= 3 ? 0.4 : 0.2;
            const positionRatio = baseRatio * (0.5 + confidence * 0.5); // Scale from 0.5x to 1.5x base
            
            const desired = Math.floor(maxShares * positionRatio);
            const toBuy = Math.max(0, desired - shares);
            const budgetLeft = budget - invested;
            const affordable = Math.floor(budgetLeft / price);
            const qty = Math.min(toBuy, affordable);

            if (qty > 0) {
                ns.stock.buyStock(sym, qty);
                const cost = qty * price;
                invested += cost;
                ui.log(`BUY: ${qty} ${sym} | Forecast: ${(forecast * 100).toFixed(1)}% | Confidence: ${(confidence * 100).toFixed(0)}% | Cost: ${formatMoney(cost)}`, "success");
                bought++;
            }
        }
    }

    if (bought > 0 || sold > 0 || profits > 0) {
        ui.log(`[P${gamePhase}] Traded: +${bought}/-${sold} | Profits: ${formatMoney(profits)} | Invested: ${formatMoney(invested)}`, "info");
    }
}

/**
 * Get dynamic spend ratio based on game phase
 * P3+: Aggressive (15-20%), P0-2: Conservative (5-10%)
 */
function getDynamicSpendRatio(gamePhase) {
    switch (gamePhase) {
        case 3: return 0.15;    // Gang phase: start building positions
        case 4: return 0.20;    // Late game: aggressive
        default: return 0.08;   // Early/mid: conservative
    }
}
