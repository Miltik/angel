/**
 * ANGEL Bootstrap Script
 * 
 * This is a minimal script to download the sync.js file from GitHub,
 * which can then download all other ANGEL files.
 * 
 * USAGE:
 * 1. Update the URL below with your GitHub raw URL to sync.js
 * 2. Copy ONLY this file to Bitburner
 * 3. Run: run bootstrap.js
 * 4. Then run: run /angel/sync.js
 * 
 * @param {NS} ns
 */

export async function main(ns) {
    // ========================================
    // CONFIGURATION - UPDATE THIS URL
    // ========================================
    
    // Replace with your actual GitHub raw URL for sync.js
    // Format: https://raw.githubusercontent.com/USERNAME/REPO/BRANCH/sync.js
    const SYNC_SCRIPT_URL = "https://raw.githubusercontent.com/Miltik/angel/main/sync.js";
    
    // ========================================
    
    if (SYNC_SCRIPT_URL.includes("YOUR_USERNAME") || SYNC_SCRIPT_URL.includes("YOUR_REPO")) {
        ns.tprint("ERROR: Please configure the SYNC_SCRIPT_URL in bootstrap.js");
        ns.tprint("Update it with your GitHub repository URL.");
        return;
    }
    
    ns.tprint("═══════════════════════════════════════");
    ns.tprint("    ANGEL Bootstrap - Step 1 of 2      ");
    ns.tprint("═══════════════════════════════════════");
    ns.tprint("");
    ns.tprint("Downloading sync script...");
    
    try {
        await ns.wget(SYNC_SCRIPT_URL, "/angel/sync.js");
        
        if (ns.fileExists("/angel/sync.js", "home")) {
            ns.tprint("✓ Sync script downloaded successfully!");
            ns.tprint("");
            ns.tprint("═══════════════════════════════════════");
            ns.tprint("    Next Step: Run the sync script     ");
            ns.tprint("═══════════════════════════════════════");
            ns.tprint("");
            ns.tprint("Run this command:");
            ns.tprint("  run /angel/sync.js");
            ns.tprint("");
        } else {
            ns.tprint("✗ Download failed - file not found");
            ns.tprint("");
            ns.tprint("Troubleshooting:");
            ns.tprint("  1. Check that sync.js exists in your repository");
            ns.tprint("  2. Verify the URL is correct");
            ns.tprint("  3. Ensure your repository is public");
        }
    } catch (error) {
        ns.tprint(`✗ Download failed: ${error}`);
        ns.tprint("");
        ns.tprint("Please check:");
        ns.tprint("  1. URL is correct and points to raw file");
        ns.tprint("  2. Repository is public");
        ns.tprint("  3. File exists in the repository");
    }
    
    ns.tprint("");
}
