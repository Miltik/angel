/**
 * Lightweight telemetry helpers for modules.
 * Keep this file minimal so modules can report metrics without importing
 * the full telemetry collector and inheriting its RAM-heavy API surface.
 *
 * @param {NS} ns
 */

import { TELEMETRY_PORT } from "/angel/ports.js";

/**
 * Report module metrics to telemetry collector via port.
 * @param {NS} ns
 * @param {string} moduleName
 * @param {Object} metrics
 */
export function reportModuleMetrics(ns, moduleName, metrics) {
    try {
        const data = {
            module: moduleName,
            timestamp: Date.now(),
            metrics,
        };
        ns.writePort(TELEMETRY_PORT, JSON.stringify(data));
    } catch (e) {
        // Never let telemetry reporting interrupt module logic.
    }
}

/**
 * Create a tiny recorder utility for compatibility with existing modules.
 * @param {NS} ns
 * @param {string} moduleName
 * @returns {{log: Function, complete: Function, milestone: Function}}
 */
export function recordModuleMetric(ns, moduleName) {
    const startTime = Date.now();

    return {
        log: (eventType, data = {}) => {
            reportModuleMetrics(ns, moduleName, {
                eventType,
                data,
                kind: "event",
            });
        },
        complete: (success = true) => {
            const duration = Date.now() - startTime;
            reportModuleMetrics(ns, moduleName, {
                kind: "execution",
                success,
                duration,
            });
        },
        milestone: (milestone, data = {}) => {
            reportModuleMetrics(ns, moduleName, {
                kind: "milestone",
                milestone,
                data,
            });
        },
    };
}

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("telemetry-core.js is a helper module; import its functions directly.");
}
