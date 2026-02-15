/**
 * Training automation module
 * Handled by crime.js as part of unified activity selector
 * This file kept for compatibility but delegates to crime.js
 * @param {NS} ns
 */
import { config, PORTS } from "/angel/config.js";

export async function main(ns) {
    ns.print("[Training] Module delegated to activity selector (crime.js)");
    ns.print("[Training] If you see this and crime.js is not running, start it instead");
    while (true) {
        await ns.sleep(60000);
    }
}
