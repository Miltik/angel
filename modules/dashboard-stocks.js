/**
 * ANGEL Dashboard - Stock Portfolio Module
 * Extracted for RAM efficiency: handles stock portfolio display and analysis
 * 
 * @param {NS} ns
 */

import { formatMoney } from "/angel/utils.js";

/**
 * Display stock portfolio status and gain/loss
 * @param {object} ui - UI window
 * @param {NS} ns
 */
export function displayStockStatus(ui, ns) {
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
 * Check if player has stock market access (TIX API + 4S Data)
 * @param {NS} ns
 * @returns {boolean}
 */
export function hasStockAccess(ns) {
    try {
        return ns.stock && ns.stock.hasTIXAPIAccess && ns.stock.has4SDataTIXAPI && 
               ns.stock.hasTIXAPIAccess() && ns.stock.has4SDataTIXAPI();
    } catch (e) {
        return false;
    }
}
