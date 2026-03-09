/**
 * History Module - Reset tracking and historical data
 * Maintains reset history and session state across runs
 * 
 * Features:
 * - Reset detection and tracking
 * - Historical reset data storage
 * - Current run state management
 * - Duration formatting
 * 
 * @module modules/history
 */

// LocalStorage keys
const RESET_HISTORY_KEY = "angelResetHistory";
const RESET_STATE_KEY = "angelResetState";
const MAX_RESET_HISTORY = 50;

/**
 * Initialize reset tracking for current session
 * @param {NS} ns
 * @returns {Object} - Current state
 */
export function initializeResetTracking(ns) {
    const now = Date.now();
    const resetInfo = ns.getResetInfo();
    const lastAugReset = Number(resetInfo?.lastAugReset || now);

    let state = loadResetState();
    
    // Detect if we've reset since last session
    const resetDetected = state.lastSeenAugReset > 0 && lastAugReset !== state.lastSeenAugReset;
    
    if (resetDetected || !state.currentRun) {
        state.currentRun = {
            startEpoch: lastAugReset,
            startedAt: new Date(lastAugReset).toISOString(),
            startHackLevel: Number(ns.getPlayer().skills.hacking || 0),
            startCash: Number(ns.getServerMoneyAvailable("home") || 0),
        };
    }
    
    state.lastSeenAugReset = lastAugReset;
    state.lastHeartbeat = now;
    saveResetState(state);
    return state;
}

/**
 * Load reset state from localStorage
 * @returns {Object}
 */
export function loadResetState() {
    try {
        const stored = localStorage.getItem(RESET_STATE_KEY);
        return stored ? JSON.parse(stored) : { currentRun: null, lastSeenAugReset: 0, lastHeartbeat: 0 };
    } catch (e) {
        return { currentRun: null, lastSeenAugReset: 0, lastHeartbeat: 0 };
    }
}

/**
 * Save reset state to localStorage
 * @param {Object} state
 */
export function saveResetState(state) {
    try {
        localStorage.setItem(RESET_STATE_KEY, JSON.stringify(state));
    } catch (e) {
        // Ignore storage errors
    }
}

/**
 * Record a reset snapshot to history
 * @param {NS} ns
 * @returns {Object} - Snapshot data
 */
export function recordResetSnapshot(ns) {
    const state = loadResetState();
    const player = ns.getPlayer();
    const now = Date.now();
    const resetInfo = ns.getResetInfo();
    const lastAugReset = Number(resetInfo?.lastAugReset || now);
    
    const playtimeMs = Math.max(0, now - lastAugReset);
    const finalCash = Number(ns.getServerMoneyAvailable("home") || 0);
    const finalHackLevel = Number(player.skills.hacking || 0);
    
    let purchasedAugCount = 0;
    try {
        const ownedAll = ns.singularity.getOwnedAugmentations(true);
        const ownedInstalled = ns.singularity.getOwnedAugmentations(false);
        purchasedAugCount = ownedAll.length - ownedInstalled.length;
    } catch (e) {
        // Singularity not available
    }
    
    const snapshot = {
        timestamp: new Date(now).toISOString(),
        startEpoch: state.currentRun?.startEpoch || lastAugReset,
        endEpoch: now,
        durationMs: playtimeMs,
        durationLabel: formatDuration(playtimeMs),
        finalCash,
        finalHackLevel,
        purchasedAugCount,
    };
    
    // Add to history
    let history = loadResetHistory();
    history.push(snapshot);
    
    // Keep only last N resets
    if (history.length > MAX_RESET_HISTORY) {
        history = history.slice(-MAX_RESET_HISTORY);
    }
    
    saveResetHistory(history);
    return snapshot;
}

/**
 * Load reset history from localStorage
 * @returns {Array}
 */
export function loadResetHistory() {
    try {
        const stored = localStorage.getItem(RESET_HISTORY_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

/**
 * Save reset history to localStorage
 * @param {Array} history
 */
export function saveResetHistory(history) {
    try {
        localStorage.setItem(RESET_HISTORY_KEY, JSON.stringify(history));
    } catch (e) {
        // Ignore storage errors
    }
}

/**
 * Format duration in milliseconds to human-readable string
 * @param {number} ms
 * @returns {string}
 */
export function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
}

/**
 * Get current run duration in milliseconds
 * @param {NS} ns
 * @returns {number}
 */
export function getCurrentRunDuration(ns) {
    const resetInfo = ns.getResetInfo();
    const lastAugReset = Number(resetInfo?.lastAugReset || Date.now());
    return Date.now() - lastAugReset;
}

/**
 * Get reset statistics
 * @returns {Object}
 */
export function getResetStatistics() {
    const history = loadResetHistory();
    
    if (history.length === 0) {
        return {
            totalResets: 0,
            avgDuration: 0,
            avgCash: 0,
            avgHackLevel: 0,
            avgAugCount: 0,
        };
    }
    
    let totalDuration = 0;
    let totalCash = 0;
    let totalHackLevel = 0;
    let totalAugCount = 0;
    
    for (const reset of history) {
        totalDuration += reset.durationMs || 0;
        totalCash += reset.finalCash || 0;
        totalHackLevel += reset.finalHackLevel || 0;
        totalAugCount += reset.purchasedAugCount || 0;
    }
    
    return {
        totalResets: history.length,
        avgDuration: totalDuration / history.length,
        avgCash: totalCash / history.length,
        avgHackLevel: totalHackLevel / history.length,
        avgAugCount: totalAugCount / history.length,
    };
}

/**
 * Get last N resets from history
 * @param {number} count
 * @returns {Array}
 */
export function getRecentResets(count = 10) {
    const history = loadResetHistory();
    return history.slice(-count);
}

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== History Module ===");
    ns.tprint("");
    
    const state = initializeResetTracking(ns);
    ns.tprint("Current Run:");
    ns.tprint(`  Started: ${state.currentRun?.startedAt || "Unknown"}`);
    ns.tprint(`  Duration: ${formatDuration(getCurrentRunDuration(ns))}`);
    
    ns.tprint("");
    const stats = getResetStatistics();
    ns.tprint("Reset Statistics:");
    ns.tprint(`  Total Resets: ${stats.totalResets}`);
    ns.tprint(`  Avg Duration: ${formatDuration(stats.avgDuration)}`);
    ns.tprint(`  Avg Final Cash: $${stats.avgCash.toFixed(0)}`);
    ns.tprint(`  Avg Final Hack Level: ${stats.avgHackLevel.toFixed(1)}`);
    ns.tprint(`  Avg Augs Purchased: ${stats.avgAugCount.toFixed(1)}`);
    
    ns.tprint("");
    const recentResets = getRecentResets(5);
    ns.tprint(`Last ${recentResets.length} Resets:`);
    for (const reset of recentResets) {
        ns.tprint(`  ${reset.timestamp}: ${reset.durationLabel}, Hack ${reset.finalHackLevel}, ${reset.purchasedAugCount} augs`);
    }
}
