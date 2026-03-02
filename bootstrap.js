/**
 * ANGEL BOOTSTRAP SCRIPT
 * 
 * Quick deployment helper that downloads sync.js from GitHub
 * 
 * SETUP:
 * 1. Update SYNC_SCRIPT_URL below with your repository URL
 * 2. Copy this file to Bitburner (only file you need to copy manually)
 * 3. Run: run bootstrap.js
 * 4. Then run: run /angel/sync.js
 * 
 * @param {NS} ns
 */

export async function main(ns) {
    // ========================================
    // CONFIGURATION - UPDATE THIS VALUE
    // ========================================
    
    // Your sync.js raw URL from GitHub
    // Example: "https://raw.githubusercontent.com/YourUser/angel/main/sync.js"
    const SYNC_SCRIPT_URL = "https://raw.githubusercontent.com/Miltik/angel/main/sync.js";
    
    // ========================================
    // SCRIPT START - No need to edit below
    // ========================================
    
    const SYNC_PATH = "/angel/sync.js";
    
    ns.tprint("╔════════════════════════════════════════╗");
    ns.tprint("║     ANGEL Bootstrap Installer          ║");
    ns.tprint("╚════════════════════════════════════════╝");
    ns.tprint("");
    
    if (SYNC_SCRIPT_URL.includes("YourUser") || SYNC_SCRIPT_URL.includes("YOUR_")) {
        ns.tprint("ERROR: Please configure SYNC_SCRIPT_URL in bootstrap.js");
        ns.tprint("Update line 18 with your GitHub repository URL");
        return;
    }
    
    ns.tprint(`Downloading sync.js from:`);
    ns.tprint(`  ${SYNC_SCRIPT_URL}`);
    ns.tprint("");
    
    try {
        const success = await ns.wget(SYNC_SCRIPT_URL, SYNC_PATH);
        
        if (success) {
            ns.tprint("✓ sync.js downloaded successfully!");
            ns.tprint("");
            ns.tprint("Next steps:");
            ns.tprint("  1. run /angel/sync.js     (download all Angel files)");
            ns.tprint("  2. run /angel/start.js    (start Angel)");
            ns.tprint("");
        } else {
            ns.tprint("✗ Download failed!");
            ns.tprint("");
            ns.tprint("Common causes:");
            ns.tprint("  • Repository is private (must be public)");
            ns.tprint("  • Wrong URL format");
            ns.tprint("  • Network error");
            ns.tprint("");
            ns.tprint("Manual alternative:");
            ns.tprint(`  wget ${SYNC_SCRIPT_URL} ${SYNC_PATH}`);
        }
        
    } catch (e) {
        ns.tprint(`✗ Error: ${e}`);
    }
}
