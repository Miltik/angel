/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== Minimal Contracts Test ===");
    
    try {
        // Test 1: Import the UI manager
        ns.tprint("1. Importing uiManager...");
        const { createWindow } = await import("/angel/modules/uiManager.js");
        ns.tprint("   ✓ Import successful");
        
        // Test 2: Try to create window (this might be the failure point)
        ns.tprint("2. Creating window...");
        const ui = createWindow("test-contracts", "📋 Test Contracts", 600, 350, ns);
        ns.tprint("   ✓ Window created");
        
        // Test 3: Try logging
        ns.tprint("3. Testing UI log...");
        ui.log("Test message", "info");
        ns.tprint("   ✓ UI log works");
        
        // Test 4: Test codingcontract API
        ns.tprint("4. Testing codingcontract API...");
        const servers = ["home"];
        for (const server of servers) {
            const contracts = ns.ls(server, ".cct");
            ns.tprint(`   Found ${contracts.length} contracts on ${server}`);
            
            for (const contract of contracts) {
                try {
                    const type = ns.codingcontract.getContractType(contract, server);
                    ns.tprint(`   - ${contract}: ${type}`);
                } catch (e) {
                    ns.tprint(`   ERROR reading ${contract}: ${e.message}`);
                }
            }
        }
        
        ns.tprint("");
        ns.tprint("✓ All tests passed! Contracts module should work.");
        
    } catch (e) {
        ns.tprint(`ERROR: ${e.message}`);
        ns.tprint(`Stack: ${e.stack}`);
    }
}
