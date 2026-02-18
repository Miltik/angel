import { createWindow } from "/angel/modules/uiManager.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");

    const ui = createWindow("maxprofit", "🚀 Max Profit Hacker", 700, 420, ns);
    ui.log("📡 Scanning network and preparing aggressive hack loop", "info");

    // Give other modules time to start
    await ns.sleep(3000);

    while (true) {
        try {
            await runAggressiveCycle(ns, ui);
        } catch (e) {
            ui.log(`❌ maxprofit error: ${e}`,"error");
        }
        await ns.sleep(2000);
    }
}

async function runAggressiveCycle(ns, ui) {
    const rooted = getRootedServersInline(ns);
    if (rooted.length === 0) {
        ui.log("⚠️  No rooted servers found", "warn");
        await ns.sleep(5000);
        return;
    }

    const targets = getHackableServersInline(ns);
    if (targets.length === 0) {
        ui.log("⚠️  No hackable targets available", "warn");
        await ns.sleep(5000);
        return;
    }

    // Score and sort targets by profitability
    const scored = targets.map(t => ({ t, s: calculateProfitabilityScore(ns, t) }));
    scored.sort((a,b) => b.s - a.s);

    // Use top N targets (aggressive: use up to top 5)
    const topTargets = scored.slice(0, 5).map(x => x.t);

    // Determine available RAM budget (use 90% of spare RAM)
    const totalAvailable = getTotalAvailableRamInline(ns);
    const usageLimit = Math.max(0, totalAvailable * 0.90);

    const hackScript = "/angel/workers/hack.js";
    const growScript = "/angel/workers/grow.js";
    const weakenScript = "/angel/workers/weaken.js";

    const hackRam = ns.getScriptRam(hackScript);
    const growRam = ns.getScriptRam(growScript);
    const weakenRam = ns.getScriptRam(weakenScript);

    if (hackRam === 0 || growRam === 0 || weakenRam === 0) {
        ui.log("❌ Required worker scripts missing in /angel/workers/", "error");
        return;
    }

    // Aggressively allocate: prioritize hack threads first on best targets,
    // then fill remaining with grow/weaken for recovery.
    let usedRam = 0;
    let totalHackThreads = 0;
    let totalGrowThreads = 0;
    let totalWeakenThreads = 0;

    for (const server of rooted) {
        // copy scripts
        try { await ns.scp([hackScript,growScript,weakenScript], server, "home"); } catch (_) {}

        const reserved = server === "home" ? 20 : 0;
        let avail = getAvailableRamInline(ns, server, reserved);
        if (avail <= 0) continue;

        // Don't exceed overall usage limit
        const serverBudget = Math.min(avail, usageLimit - usedRam);
        if (serverBudget <= 0) break;

        // Fill with hack threads on the best target that is within level
        for (const target of topTargets) {
            if (serverBudget - (totalHackThreads * hackRam) <= 0) break;
            const threads = Math.floor(serverBudget / hackRam);
            if (threads <= 0) break;
            try {
                ns.exec(hackScript, server, threads, target);
                totalHackThreads += threads;
                const used = threads * hackRam;
                usedRam += used;
                serverBudget -= used;
            } catch (e) {
                // ignore exec failures
                break;
            }
        }

        // Use leftover budget for grow/weaken to keep targets healthy
        if (serverBudget > 0) {
            const growThreads = Math.floor(serverBudget / growRam);
            if (growThreads > 0) {
                try {
                    ns.exec(growScript, server, growThreads, topTargets[0]);
                    totalGrowThreads += growThreads;
                    const used = growThreads * growRam;
                    usedRam += used;
                    serverBudget -= used;
                } catch (e) {}
            }
        }

        if (serverBudget > 0) {
            const weakenThreads = Math.floor(serverBudget / weakenRam);
            if (weakenThreads > 0) {
                try {
                    ns.exec(weakenScript, server, weakenThreads, topTargets[0]);
                    totalWeakenThreads += weakenThreads;
                    const used = weakenThreads * weakenRam;
                    usedRam += used;
                    serverBudget -= used;
                } catch (e) {}
            }
        }
    }

    ui.log(`⚡ Allocated: ${totalHackThreads} hack | ${totalGrowThreads} grow | ${totalWeakenThreads} weaken (${usedRam.toFixed(2)}GB)`, "success");
}

// ==========================
// Scanning & Helpers (inline)
// ==========================

function scanAllInline(ns, server = "home", visited = new Set()) {
    visited.add(server);
    const neighbors = ns.scan(server);
    for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) scanAllInline(ns, neighbor, visited);
    }
    return Array.from(visited);
}

function getRootedServersInline(ns) {
    const all = scanAllInline(ns);
    return all.filter(s => ns.hasRootAccess(s));
}

function getAvailableRamInline(ns, server, reserved = 0) {
    const max = ns.getServerMaxRam(server);
    const used = ns.getServerUsedRam(server);
    return Math.max(0, max - used - reserved);
}

function getTotalAvailableRamInline(ns) {
    const servers = getRootedServersInline(ns);
    let total = 0;
    for (const s of servers) {
        const reserved = s === "home" ? 20 : 0;
        total += getAvailableRamInline(ns, s, reserved);
    }
    return total;
}

function getHackableServersInline(ns) {
    const player = ns.getPlayer();
    const all = scanAllInline(ns);
    return all.filter(s => ns.hasRootAccess(s) && ns.getServerMaxMoney(s) > 0 && ns.getServerRequiredHackingLevel(s) <= player.skills.hacking);
}

function calculateProfitabilityScore(ns, server) {
    const maxMoney = ns.getServerMaxMoney(server);
    if (maxMoney <= 0) return 0;
    const minSec = ns.getServerMinSecurityLevel(server);
    const curSec = ns.getServerSecurityLevel(server);
    const curMoney = ns.getServerMoneyAvailable(server);

    let score = maxMoney;
    score *= Math.pow(0.92, minSec);
    const moneyPercent = curMoney / Math.max(1, maxMoney);
    if (moneyPercent < 0.75) score *= moneyPercent;
    if (curSec - minSec > 5) score *= Math.pow(0.7, curSec - minSec - 5);
    // small bonus for being already prepped
    if (moneyPercent >= 0.75 && curSec - minSec <= 5) score *= 1.5;

    return score;
}

function formatMoneyInline(money) {
    if (money >= 1e12) return `$${(money/1e12).toFixed(2)}t`;
    if (money >= 1e9) return `$${(money/1e9).toFixed(2)}b`;
    if (money >= 1e6) return `$${(money/1e6).toFixed(2)}m`;
    if (money >= 1e3) return `$${(money/1e3).toFixed(2)}k`;
    return `$${money.toFixed(0)}`;
}
