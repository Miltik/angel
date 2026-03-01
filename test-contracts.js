/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== Contracts Module Test ===");
    
    // Test 1: Check if contracts.js file exists
    const contractsPath = "/angel/modules/contracts.js";
    const exists = ns.fileExists(contractsPath, "home");
    ns.tprint(`1. File exists: ${exists}`);
    
    if (!exists) {
        ns.tprint("ERROR: contracts.js not found!");
        return;
    }
    
    // Test 2: Check RAM requirement
    const ram = ns.getScriptRam(contractsPath, "home");
    ns.tprint(`2. RAM required: ${ram.toFixed(2)}GB`);
    
    // Test 3: Check available RAM
    const available = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
    ns.tprint(`3. RAM available: ${available.toFixed(2)}GB`);
    
    // Test 4: Check if already running
    const running = ns.isRunning(contractsPath, "home");
    ns.tprint(`4. Already running: ${running}`);
    
    if (running) {
        ns.tprint("Contracts is already running!");
        return;
    }
    
    // Test 5: Try to run it
    ns.tprint("5. Attempting to start contracts module...");
    const pid = ns.exec(contractsPath, "home");
    
    if (pid === 0) {
        ns.tprint("ERROR: exec returned 0 - module has a runtime error!");
        ns.tprint("This usually means:");
        ns.tprint("  - Syntax error in the file");
        ns.tprint("  - Missing or invalid import");
        ns.tprint("  - Corrupted file from sync");
        ns.tprint("");
        ns.tprint("Try re-downloading the file with:");
        ns.tprint("  wget <github-url>/modules/contracts.js /angel/modules/contracts.js");
    } else {
        ns.tprint(`SUCCESS: Contracts started with PID ${pid}`);
    }
}
