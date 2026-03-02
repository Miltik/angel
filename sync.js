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
        "sync.js",
        "angel.js",
        "angel-lite.js",
        "config.js",
        "utils.js",
        "scanner.js",
        "start.js",
        "status.js",
        "bootstrap.js",
        
        // Quick start (in-game reference - markdown files stay on GitHub)
        "WELCOME.txt",
        
        // Modules
        "modules/uiManager.js",
        "modules/hacking.js",
        "modules/servers.js",
        "modules/augments.js",
        "modules/programs.js",
        "modules/activities.js",
        "modules/sleeves.js",
        "modules/stocks.js",
        "modules/gang.js",
        "modules/bladeburner.js",
        "modules/hacknet.js",
        "modules/dashboard.js",
        "modules/networkMap.js",
        "modules/xpFarm.js",
        "modules/backdoor.js",
        "modules/uiLauncher.js",
        "modules/contracts.js",
        "modules/loot.js",
        "modules/formulas.js",
        "modules/corporation.js",
        "modules/backdoorRunner.js",
        
        // Workers
        "workers/hack.js",
        "workers/grow.js",
        "workers/weaken.js",
        "workers/share.js",
        
        // Telemetry (in-game quick reference only - README on GitHub)
        "telemetry/telemetry.js",
        "telemetry/report.js",
        "telemetry/ui.js",
        "telemetry/MANUAL_LAUNCH.txt",
        
        // Data
        "loot/loot.txt",
    ];
    
    // ========================================
    // SCRIPT START - No need to edit below
    // ========================================
    
    ns.disableLog("ALL");
    const forceMode = ns.args.includes("--force") || ns.args.includes("force");
    
    // Validate configuration
    if (GITHUB_USER === "YOUR_GITHUB_USERNAME" || GITHUB_REPO === "YOUR_REPO_NAME") {
        ns.tprint("ERROR: Please configure the GitHub repository settings in sync.js");
        ns.tprint("Edit the GITHUB_USER and GITHUB_REPO variables at the top of the script.");
        return;
    }

    if (forceMode) {
        ns.tprint("Force mode: stopping running ANGEL scripts before sync...");
        stopRunningAngelScripts(ns);
        await ns.sleep(200);
    }

    ensureLootArchiveSeed(ns);
    
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
    const cacheBust = `?v=${Date.now()}`;
    
    let successCount = 0;
    let failCount = 0;
    const failed = [];
    
    ns.tprint("Starting download...");
    ns.tprint("─────────────────────────────────────────");
    
    for (const file of files) {
        const url = `${baseUrl}${subdir}/${file}${cacheBust}`;
        const destination = `/angel/${file}`;
        const legacyDestination = `angel/${file}`;
        
        try {
            if (ns.fileExists(destination, "home")) ns.rm(destination, "home");
            if (legacyDestination !== destination && ns.fileExists(legacyDestination, "home")) ns.rm(legacyDestination, "home");

            ns.tprint(`Downloading: ${file}...`);
            const success = await ns.wget(url, destination, "home");
            
            // Verify the file was downloaded
            if (success && (ns.fileExists(destination, "home") || ns.fileExists(legacyDestination, "home"))) {
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
        
        // Auto-launch telemetry if not running
        if (!ns.isRunning("/angel/telemetry/telemetry.js", "home")) {
            ns.run("/angel/telemetry/telemetry.js");
            ns.tprint("▶ Telemetry system started");
        } else {
            ns.tprint("✓ Telemetry system already running");
        }
        
        ns.tprint("");
        ns.tprint("To start ANGEL:");
        ns.tprint("  run /angel/start.js");
        ns.tprint("");
        ns.tprint("To check status:");
        ns.tprint("  run /angel/status.js");
    }
    
    ns.tprint("");
}

function ensureLootArchiveSeed(ns) {
    const seedPath = "/angel/loot/loot.txt";
    if (!ns.fileExists(seedPath, "home")) {
        ns.write(seedPath, "loot", "w");
        ns.tprint("Initialized /angel/loot/loot.txt");
    }
}

function stopRunningAngelScripts(ns) {
    const scripts = [
        "/angel/angel.js",
        "/angel/modules/backdoor.js",
        "/angel/modules/networkMap.js",
        "/angel/modules/xpFarm.js",
        "/angel/modules/loot.js",
        "/angel/modules/contracts.js",
        "/angel/modules/contracts-simple.js",
        "/angel/modules/dashboard.js",
        "/angel/modules/hacking.js",
        "/angel/modules/programs.js",
        "/angel/modules/servers.js",
        "/angel/modules/formulas.js",
        "/angel/modules/corporation.js",
    ];

    for (const script of scripts) {
        if (ns.isRunning(script, "home")) {
            ns.kill(script, "home");
        }
    }
}
