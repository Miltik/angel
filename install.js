/**
 * Quick install/update script for ANGEL
 * Downloads all ANGEL files from GitHub or copies from local storage
 * 
 * @param {NS} ns
 */

export async function main(ns) {
    ns.tprint("=======================================");
    ns.tprint("     ANGEL Installation Script         ");
    ns.tprint("=======================================");
    ns.tprint("");
    
    // List of all files to install
    const files = [
        "/angel/angel.js",
        "/angel/config.js",
        "/angel/utils.js",
        "/angel/scanner.js",
        "/angel/sync.js",
        "/angel/bootstrap.js",
        "/angel/start.js",
        "/angel/status.js",
        "/angel/windowLayoutSnapshot.js",
        "/angel/angel_windowdefaults.json",
        "/angel/angel_windowstates.json",
        "/angel/modules/hacking.js",
        "/angel/modules/servers.js",
        "/angel/modules/factions.js",
        "/angel/modules/augments.js",
        "/angel/modules/programs.js",
        "/angel/workers/hack.js",
        "/angel/workers/grow.js",
        "/angel/workers/weaken.js",
        "/angel/workers/share.js",
    ];
    
    // Check if files exist
    let existCount = 0;
    let missingCount = 0;
    
    for (const file of files) {
        if (ns.fileExists(file, "home")) {
            existCount++;
        } else {
            missingCount++;
            ns.tprint(`MISSING: ${file}`);
        }
    }
    
    ns.tprint("");
    ns.tprint(`Found: ${existCount}/${files.length} files`);
    
    if (missingCount === 0) {
        ns.tprint("✓ All ANGEL files are present!");
        ns.tprint("");
        ns.tprint("To start ANGEL, run: run /angel/start.js");
        ns.tprint("To update from GitHub, run: run /angel/sync.js");
    } else {
        ns.tprint(`✗ Missing ${missingCount} files`);
        ns.tprint("");
        ns.tprint("Please ensure all files are copied to /angel/ directory");
    }
    
    ns.tprint("");
    ns.tprint("=======================================");
}
