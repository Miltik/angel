/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== Testing Contracts Dependencies ===");
    
    // Test imports
    try {
        ns.tprint("1. Testing uiManager import...");
        const { createWindow } = await import("/angel/modules/uiManager.js");
        ns.tprint("   ✓ uiManager.js loaded");
        
        ns.tprint("2. Testing utils import...");
        const { formatMoney } = await import("/angel/utils.js");
        ns.tprint("   ✓ utils.js loaded");
        
        ns.tprint("3. Testing createWindow...");
        const ui = createWindow("test", "Test Window", 400, 300, ns);
        ns.tprint("   ✓ createWindow works");
        
        ns.tprint("4. Testing formatMoney...");
        const formatted = formatMoney(1000000);
        ns.tprint(`   ✓ formatMoney works: ${formatted}`);
        
        ns.tprint("");
        ns.tprint("All dependencies working! The issue must be in contracts.js itself.");
        ns.tprint("Try running: run /angel/test-contracts.js");
        
    } catch (e) {
        ns.tprint(`ERROR: ${e.message}`);
        ns.tprint(`Stack: ${e.stack}`);
    }
}
