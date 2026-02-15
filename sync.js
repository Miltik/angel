/**
 * ANGEL Sync Script
 * Downloads all ANGEL files from GitHub repository
 * 
 * SETUP:
 * 1. Update the GITHUB_REPO variables below with your repository information
 * 2. Ensure your files are pushed to GitHub
 * 3. Run: run /angel/sync.js
 * 
 * @param {NS} ns
 */

export async function main(ns) {
    // ========================================
    // CONFIGURATION - UPDATE THESE VALUES
    // ========================================
    
    const GITHUB_USER = "Miltik";                      // GitHub username
    const GITHUB_REPO = "angel";                        // Repository name
    const GITHUB_BRANCH = "main";                       // Branch name
    
    // Optional: If files are in a subdirectory, specify it here
    const REPO_SUBDIR = "";                             // Files are in repository root
    
    // ========================================
    // FILE LIST - Add/remove files as needed
    // ========================================
    
    const files = [
        // Core files
        "angel.js",
        "config.js",
        "utils.js",
        "scanner.js",
        "start.js",
        "status.js",
        "networkMap.js",
        
        // Modules
        "modules/hacking.js",
        "modules/servers.js",
        "modules/factions.js",
        "modules/augments.js",
        "modules/programs.js",
        "modules/crime.js",
        "modules/training.js",
        "modules/company.js",
        "modules/sleeves.js",
        "modules/stocks.js",
        "modules/gang.js",
        "modules/bladeburner.js",
        "modules/hacknet.js",
        
        // Workers
        "workers/hack.js",
        "workers/grow.js",
        "workers/weaken.js",
        "workers/share.js",
    ];
    
    // ========================================
    // SCRIPT START - No need to edit below
    // ========================================
    
    ns.disableLog("ALL");
    
    // Validate configuration
    if (GITHUB_USER === "YOUR_GITHUB_USERNAME" || GITHUB_REPO === "YOUR_REPO_NAME") {
        ns.tprint("ERROR: Please configure the GitHub repository settings in sync.js");
        ns.tprint("Edit the GITHUB_USER and GITHUB_REPO variables at the top of the script.");
        return;
    }
    
    ns.tprint("╔════════════════════════════════════════╗");
    ns.tprint("║     ANGEL GitHub Sync Script           ║");
    ns.tprint("╚════════════════════════════════════════╝");
    ns.tprint("");
    ns.tprint(`Repository: ${GITHUB_USER}/${GITHUB_REPO}`);
    ns.tprint(`Branch: ${GITHUB_BRANCH}`);
    ns.tprint(`Files to sync: ${files.length}`);
    ns.tprint("");
    
    // Build base URL
    const baseUrl = `https://raw.githubusercontent.com/${GITHUB_USER}/${GITHUB_REPO}/${GITHUB_BRANCH}`;
    const subdir = REPO_SUBDIR ? `/${REPO_SUBDIR}` : "";
    
    let successCount = 0;
    let failCount = 0;
    const failed = [];
    
    ns.tprint("Starting download...");
    ns.tprint("─────────────────────────────────────────");
    
    for (const file of files) {
        const url = `${baseUrl}${subdir}/${file}`;
        const destination = `angel/${file}`;
        
        try {
            ns.tprint(`Downloading: ${file}...`);
            const success = await ns.wget(url, destination, "home");
            
            // Verify the file was downloaded
            if (success && ns.fileExists(destination, "home")) {
                successCount++;
                ns.tprint(`  ✓ Success`);
            } else {
                failCount++;
                failed.push(file);
                ns.tprint(`  ✗ Failed (wget returned: ${success})`);
            }
        } catch (error) {
            failCount++;
            failed.push(file);
            ns.tprint(`  ✗ Failed: ${error}`);
        }
        
        // Small delay to avoid rate limiting
        await ns.sleep(100);
    }
    
    ns.tprint("─────────────────────────────────────────");
    ns.tprint("");
    ns.tprint("╔════════════════════════════════════════╗");
    ns.tprint("║          SYNC COMPLETE                 ║");
    ns.tprint("╚════════════════════════════════════════╝");
    ns.tprint("");
    ns.tprint(`✓ Downloaded: ${successCount}/${files.length}`);
    
    if (failCount > 0) {
        ns.tprint(`✗ Failed: ${failCount}`);
        ns.tprint("");
        ns.tprint("Failed files:");
        for (const file of failed) {
            ns.tprint(`  - ${file}`);
        }
        ns.tprint("");
        ns.tprint("Common issues:");
        ns.tprint("  1. Check that files exist in your GitHub repo");
        ns.tprint("  2. Verify the branch name is correct");
        ns.tprint("  3. Ensure REPO_SUBDIR is set correctly");
        ns.tprint("  4. Check that repository is public (or use personal access token)");
    } else {
        ns.tprint("");
        ns.tprint("All files synced successfully!");
        ns.tprint("");
        ns.tprint("To start ANGEL:");
        ns.tprint("  run /angel/start.js");
        ns.tprint("");
        ns.tprint("To check status:");
        ns.tprint("  run /angel/status.js");
    }
    
    ns.tprint("");
}
