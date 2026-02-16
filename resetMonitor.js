/**
 * Reset monitor viewer utility
 * Shows recent reset summaries captured by ANGEL.
 *
 * Usage:
 *   run /angel/resetMonitor.js
 *   run /angel/resetMonitor.js --last 10
 *
 * @param {NS} ns
 */

import { getResetHistory, initializeResetMonitor } from "/angel/modules/resetMonitor.js";

export async function main(ns) {
    ns.disableLog("ALL");

    const flags = ns.flags([
        ["last", 5],
    ]);

    initializeResetMonitor(ns);

    const history = getResetHistory(ns);
    const count = Math.max(1, Number(flags.last) || 5);
    const recent = history.slice(-count).reverse();

    ns.tprint("╔════════════════════════════════════════╗");
    ns.tprint("║        ANGEL RESET MONITOR            ║");
    ns.tprint("╚════════════════════════════════════════╝");
    ns.tprint("");

    if (recent.length === 0) {
        ns.tprint("No reset records yet.");
        return;
    }

    for (const [index, item] of recent.entries()) {
        ns.tprint(`[#${index + 1}] ${item.timestamp}`);
        ns.tprint(`  Time to reset: ${item.durationLabel}`);
        ns.tprint(`  Final cash: ${formatMoney(item.finalCash)} | Hack: ${item.finalHackLevel}`);
        ns.tprint(`  Purchased augs (${item.purchasedAugCount}): ${item.purchasedAugs?.length ? item.purchasedAugs.join(", ") : "None detected"}`);
        ns.tprint(`  Trigger: ${item.trigger} | Restart: ${item.restartScript}`);
        ns.tprint("");
    }
}

function formatMoney(n) {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}t`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}b`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}m`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}k`;
    return `$${Number(n || 0).toFixed(0)}`;
}
