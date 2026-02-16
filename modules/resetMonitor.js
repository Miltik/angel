/**
 * Reset monitor utilities
 * Tracks current run state and records reset summaries before augmentation install.
 *
 * @param {NS} ns
 */

const STATE_FILE = "/angel/data/reset-monitor-state.json";
const HISTORY_FILE = "/angel/data/reset-history.json";
const REPORT_FILE = "/angel/reset-history.txt";
const MAX_HISTORY = 200;

export function initializeResetMonitor(ns) {
    const now = Date.now();
    const player = ns.getPlayer();
    const playtime = Number(player.playtimeSinceLastAug || 0);

    const state = readJson(ns, STATE_FILE, {
        version: 1,
        currentRun: null,
        lastSeenPlaytimeSinceAug: 0,
        lastHeartbeat: 0,
    });

    const resetDetected = state.lastSeenPlaytimeSinceAug > 0 && playtime + 5000 < state.lastSeenPlaytimeSinceAug;
    const missingRun = !state.currentRun || typeof state.currentRun.startEpoch !== "number";

    if (resetDetected || missingRun) {
        const runStartEpoch = now - playtime;
        state.currentRun = {
            startEpoch: runStartEpoch,
            startedAt: new Date(runStartEpoch).toISOString(),
            startHackLevel: Number(player.skills.hacking || 0),
            startCash: Number(ns.getServerMoneyAvailable("home") || 0),
        };
    }

    state.lastSeenPlaytimeSinceAug = playtime;
    state.lastHeartbeat = now;
    writeJson(ns, STATE_FILE, state);
    return state;
}

export function recordResetSnapshot(ns, meta = {}) {
    const state = initializeResetMonitor(ns);
    const player = ns.getPlayer();

    const playtimeMs = Number(player.playtimeSinceLastAug || 0);
    const finalCash = Number(ns.getServerMoneyAvailable("home") || 0);
    const finalHackLevel = Number(player.skills.hacking || 0);
    const purchasedAugs = getPurchasedAugmentsPendingReset(ns);

    const summary = {
        timestamp: new Date().toISOString(),
        durationMs: playtimeMs,
        durationLabel: formatDuration(playtimeMs),
        finalCash,
        finalHackLevel,
        purchasedAugs,
        purchasedAugCount: purchasedAugs.length,
        restartScript: String(meta.restartScript || "/angel/start.js"),
        trigger: String(meta.trigger || "unknown"),
    };

    const history = readJson(ns, HISTORY_FILE, []);
    history.push(summary);
    while (history.length > MAX_HISTORY) {
        history.shift();
    }

    writeJson(ns, HISTORY_FILE, history);
    appendTextReport(ns, summary);

    state.lastResetSummary = summary;
    writeJson(ns, STATE_FILE, state);

    return summary;
}

export function getResetHistory(ns) {
    return readJson(ns, HISTORY_FILE, []);
}

function getPurchasedAugmentsPendingReset(ns) {
    try {
        const withPending = ns.singularity.getOwnedAugmentations(true) || [];
        const installedOnly = ns.singularity.getOwnedAugmentations(false) || [];

        const pendingA = withPending.filter(a => !installedOnly.includes(a));
        const pendingB = installedOnly.filter(a => !withPending.includes(a));

        // Handle API-semantic confusion defensively by taking the larger plausible diff.
        const pending = pendingA.length >= pendingB.length ? pendingA : pendingB;
        return [...new Set(pending)].sort((a, b) => String(a).localeCompare(String(b)));
    } catch (e) {
        return [];
    }
}

function appendTextReport(ns, summary) {
    const lines = [
        "",
        "════════════════════════════════════════",
        `RESET @ ${summary.timestamp}`,
        `Time to reset: ${summary.durationLabel}`,
        `Final cash: ${formatMoney(summary.finalCash)}`,
        `Final hack level: ${summary.finalHackLevel}`,
        `Purchased augs (${summary.purchasedAugCount}): ${summary.purchasedAugs.length > 0 ? summary.purchasedAugs.join(", ") : "None detected"}`,
        `Trigger: ${summary.trigger}`,
        `Restart script: ${summary.restartScript}`,
    ];

    ns.write(REPORT_FILE, lines.join("\n") + "\n", "a");
}

function readJson(ns, path, fallback) {
    try {
        if (!ns.fileExists(path, "home")) return structuredCloneSafe(fallback);
        const raw = ns.read(path);
        if (!raw || String(raw).trim() === "") return structuredCloneSafe(fallback);
        return JSON.parse(String(raw));
    } catch (e) {
        return structuredCloneSafe(fallback);
    }
}

function writeJson(ns, path, value) {
    ns.write(path, JSON.stringify(value, null, 2), "w");
}

function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
}

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

function formatMoney(n) {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}t`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}b`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}m`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}k`;
    return `$${n.toFixed(0)}`;
}
