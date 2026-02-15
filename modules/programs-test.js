/**
 * ANGEL Programs Module - Test Version
 * Simplified to diagnose startup issues
 * @param {NS} ns
 */

export async function main(ns) {
    ns.disableLog("ALL");
    ns.print("Programs module test started");
    
    try {
        ns.print("Attempting to open tail...");
        ns.ui.openTail();
        ns.print("Tail opened successfully");
    } catch (e) {
        ns.print(`Failed to open tail: ${e}`);
    }
    
    ns.print("Program module basic test complete");
}
