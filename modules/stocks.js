/**
 * Stock market automation module (phase-aware: active in phases 3-4)
 * Intelligently builds stock positions during P3-4 when capital is available
 * 
 * @param {NS} ns
 */
import { config } from "/angel/config.js";
import { formatMoney, isScriptDeathError } from "/angel/utils.js";
import { createWindow } from "/angel/modules/uiManager.js";

const PHASE_PORT = 7;
const TELEMETRY_PORT = 20;

// State tracking
let lastState = {
    phase: null,
    bought: 0,
    sold: 0,
    totalProfits: 0,
    loopCount: 0
};

// Telemetry tracking
let telemetryState = {
    lastReportTime: 0,
    lastProfits: 0,
    lastPortfolioValue: 0
};

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
    const ui = createWindow("stocks", "📈 Stock Market", 700, 500, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("📈 Stock market automation initialized (P3+ gated)", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");

    // Wait for phase 3+ when capital is available
    while (true) {
        const gamePhase = readGamePhase(ns);
        if (gamePhase >= 3) break;
        if (lastState.loopCount % 4 === 0) {
            ui.log(`⏰ Waiting for phase 3+ (currently P${gamePhase})`, "info");
        }
        lastState.loopCount++;
        await ns.sleep(60000);
    }

    if (!hasStockAccess(ns)) {
        ui.log("⚠️  Stock API not available yet - entering idle mode", "warn");
        while (true) {
            await ns.sleep(60000);
        }
    }

    ui.log("✅ Stock trading active", "success");

    // Initialize telemetry
    telemetryState.lastReportTime = Date.now();

    while (true) {
        try {
            const gamePhase = readGamePhase(ns);
            if (gamePhase < 3) {
                if (lastState.phase !== "paused") {
                    ui.log("⏸️ Phase dropped below 3 - pausing trading", "warn");
                    lastState.phase = "paused";
                }
                await ns.sleep(60000);
                continue;
            }

            const loopStartTime = Date.now();
            lastState.loopCount++;
            await processStocks(ns, gamePhase, ui);
            
            // Report telemetry every 5 seconds
            const timeSinceLastReport = Date.now() - telemetryState.lastReportTime;
            if (timeSinceLastReport >= 5000) {
                reportStocksTelemetry(ns);
            }
            
            await ns.sleep(60000);
        } catch (e) {
            if (isScriptDeathError(e)) {
                return;
            }
            ui.log(`❌ Error: ${e}`, "error");
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
            ui.log(`💰 PROFIT: Sold ${shares} ${sym} | +${(profitRatio * 100).toFixed(1)}% (${formatMoney(totalProfit)})`, "success");
            sold++;
            profits += totalProfit;
            continue;
        }

        // STOP LOSS: Sell losers at -10% to minimize bleeding
        if (shares > 0 && profitRatio < -0.10) {
            ns.stock.sellStock(sym, shares);
            ui.log(`🔻 STOP LOSS: Sold ${shares} ${sym} | ${(profitRatio * 100).toFixed(1)}%`, "warn");
            sold++;
            continue;
        }

        // SELL: Forecast turned poor (< 50%)
        if (shares > 0 && forecast <= 0.50) {
            ns.stock.sellStock(sym, shares);
            ui.log(`📉 SOLD: ${shares} ${sym} | Forecast: ${(forecast * 100).toFixed(1)}%`, "info");
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
                ui.log(`📈 BUY: ${qty} ${sym} | Forecast: ${(forecast * 100).toFixed(1)}% | Confidence: ${(confidence * 100).toFixed(0)}% | ${formatMoney(cost)}`, "success");
                bought++;
            }
        }
    }

    // Update state tracking
    const hadActivity = bought > 0 || sold > 0 || profits > 0;
    lastState.bought += bought;
    lastState.sold += sold;
    lastState.totalProfits += profits;
    lastState.phase = gamePhase;

    // Log summary only if there was activity OR every 10 loops (10 minutes)
    if (hadActivity || lastState.loopCount % 10 === 0) {
        ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
        ui.log(`📊 Phase ${gamePhase} Summary | This cycle: +${bought}/-${sold}`, "info");
        if (profits !== 0) {
            ui.log(`💰 Profits this cycle: ${formatMoney(profits)} | Total: ${formatMoney(lastState.totalProfits)}`, profits > 0 ? "success" : "warn");
        }
        if (invested > 0) {
            ui.log(`💵 Invested: ${formatMoney(invested)}`, "info");
        }
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
function reportStocksTelemetry(ns) {
    try {
        const now = Date.now();
        const stocks = ns.stock.getSymbols();
        let portfolioValue = 0;
        let totalShares = 0;
        
        for (const symbol of stocks) {
            const position = ns.stock.getPosition(symbol);
            if (position[0] > 0 || position[2] > 0) {
                const price = ns.stock.getPrice(symbol);
                portfolioValue += (position[0] * price) + (position[2] * price);
                totalShares += position[0] + position[2];
            }
        }
        
        // Calculate money rate using portfolio delta (primary) and realized profit delta (fallback)
        const timeDelta = now - telemetryState.lastReportTime;
        const seconds = timeDelta > 0 ? (timeDelta / 1000) : 0;
        const profitDelta = lastState.totalProfits - (telemetryState.lastProfits || 0);
        const portfolioDelta = portfolioValue - (telemetryState.lastPortfolioValue || portfolioValue);

        const realizedRate = seconds > 0 ? profitDelta / seconds : 0;
        const portfolioRate = seconds > 0 ? portfolioDelta / seconds : 0;
        const moneyRate = portfolioRate !== 0 ? portfolioRate : realizedRate;
        
        const metricsPayload = {
            moneyRate: moneyRate,
            portfolioValue: portfolioValue,
            stocks: stocks.length,
            totalShares: totalShares,
            bought: lastState.bought,
            sold: lastState.sold,
            totalProfits: lastState.totalProfits
        };
        
        writeStocksMetrics(ns, metricsPayload);
        telemetryState.lastReportTime = now;
        telemetryState.lastProfits = lastState.totalProfits;
        telemetryState.lastPortfolioValue = portfolioValue;
    } catch (e) {
        ns.print(`❌ Stocks telemetry error: ${e}`);
    }
}

function writeStocksMetrics(ns, metricsPayload) {
    try {
        const payload = JSON.stringify({
            module: 'stocks',
            timestamp: Date.now(),
            metrics: metricsPayload,
        });
        ns.writePort(TELEMETRY_PORT, payload);
    } catch (e) {
        ns.print(`❌ Failed to write stocks metrics: ${e}`);
    }
}