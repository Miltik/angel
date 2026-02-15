import { config } from "/angel/config.js";
import { formatMoney, log } from "/angel/utils.js";

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    ns.ui.openTail();
    
    log(ns, "Programs & Backdoor module started", "INFO");
    
    while (true) {
        try {
            await programsLoop(ns);
        } catch (e) {
            log(ns, `Programs management error: ${e}`, "ERROR");
        }
        await ns.sleep(30000); // Check every 30 seconds
    }
}

/**
 * Main programs management loop
 * @param {NS} ns
 */
async function programsLoop(ns) {
    // Buy TOR router if we don't have it
    if (!hasTorRouter(ns)) {
        await buyTorRouter(ns);
    }
    
    // Create or buy programs we need
    await managePrograms(ns);
    
    // Backdoor important servers
    await backdoorServers(ns);
}

/**
 * Check if we have TOR router
 * @param {NS} ns
 * @returns {boolean}
 */
function hasTorRouter(ns) {
    try {
        // Try to check darkweb - if this doesn't error, we have TOR
        ns.singularity.getDarkwebPrograms();
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Buy TOR router
 * @param {NS} ns
 */
async function buyTorRouter(ns) {
    if (!config.programs.autoBuyTor) return;
    
    const cost = 200000; // TOR costs $200k
    const money = ns.getServerMoneyAvailable("home");
    
    if (money >= cost) {
        try {
            const success = ns.singularity.purchaseTor();
            if (success) {
                log(ns, `Purchased TOR router for ${formatMoney(cost)}`, "INFO");
            }
        } catch (e) {
            // Singularity not available
            log(ns, "TOR purchase requires SF4", "WARN");
        }
    }
}

/**
 * Manage program creation and purchases
 * @param {NS} ns
 */
async function managePrograms(ns) {
    const programs = [
        { name: "BruteSSH.exe", createTime: 60000 },
        { name: "FTPCrack.exe", createTime: 300000 },
        { name: "relaySMTP.exe", createTime: 600000 },
        { name: "HTTPWorm.exe", createTime: 1200000 },
        { name: "SQLInject.exe", createTime: 1800000 },
        { name: "DeepscanV1.exe", createTime: 900000 },
        { name: "DeepscanV2.exe", createTime: 1800000 },
        { name: "ServerProfiler.exe", createTime: 300000 },
        { name: "AutoLink.exe", createTime: 600000 },
    ];
    
    for (const program of programs) {
        if (ns.fileExists(program.name, "home")) {
            continue; // Already have it
        }
        
        // Try to create it
        if (!isCreatingProgram(ns) && canCreateProgram(ns, program.name)) {
            await createProgram(ns, program.name);
            return; // Only create one at a time
        }
        
        // If we can't create it and have TOR, try to buy it
        if (hasTorRouter(ns) && config.programs.autoBuyPrograms) {
            await buyProgram(ns, program.name);
        }
    }
}

/**
 * Check if we're currently creating a program
 * @param {NS} ns
 * @returns {boolean}
 */
function isCreatingProgram(ns) {
    try {
        const work = ns.singularity.getCurrentWork();
        return work && work.type === "CREATE_PROGRAM";
    } catch (e) {
        return false;
    }
}

/**
 * Check if we can create a program
 * @param {NS} ns
 * @param {string} programName
 * @returns {boolean}
 */
function canCreateProgram(ns, programName) {
    try {
        const programs = ns.singularity.getDarkwebPrograms();
        // If we can see it on darkweb but don't have it, we might be able to create it
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Start creating a program
 * @param {NS} ns
 * @param {string} programName
 */
async function createProgram(ns, programName) {
    try {
        const success = ns.singularity.createProgram(programName, false);
        if (success) {
            log(ns, `Started creating ${programName}`, "INFO");
        }
    } catch (e) {
        // Singularity not available or can't create
    }
}

/**
 * Buy a program from darkweb
 * @param {NS} ns
 * @param {string} programName
 */
async function buyProgram(ns, programName) {
    try {
        const cost = ns.singularity.getDarkwebProgramCost(programName);
        const money = ns.getServerMoneyAvailable("home");
        
        if (cost > 0 && money >= cost * config.programs.purchaseThreshold) {
            const success = ns.singularity.purchaseProgram(programName);
            if (success) {
                log(ns, `Purchased ${programName} for ${formatMoney(cost)}`, "INFO");
            }
        }
    } catch (e) {
        // Can't buy or singularity not available
    }
}

/**
 * Backdoor important servers for faction access
 * @param {NS} ns
 */
async function backdoorServers(ns) {
    if (!config.programs.autoBackdoor) return;
    
    const player = ns.getPlayer();
    
    // Important faction servers to backdoor
    const targets = [
        { server: "CSEC", faction: "CyberSec", reqLevel: 50 },
        { server: "avmnite-02h", faction: "NiteSec", reqLevel: 200 },
        { server: "I.I.I.I", faction: "The Black Hand", reqLevel: 350 },
        { server: "run4theh111z", faction: "BitRunners", reqLevel: 500 },
        { server: "w0r1d_d43m0n", faction: "Daedalus", reqLevel: 3000 },
    ];
    
    for (const target of targets) {
        // Skip if we don't meet requirements
        if (player.skills.hacking < target.reqLevel) {
            continue;
        }
        
        // Skip if already backdoored
        if (ns.getServer(target.server).backdoorInstalled) {
            continue;
        }
        
        // Skip if we don't have root access
        if (!ns.hasRootAccess(target.server)) {
            continue;
        }
        
        // Try to backdoor it
        await attemptBackdoor(ns, target.server, target.faction);
    }
}

/**
 * Attempt to backdoor a server
 * @param {NS} ns
 * @param {string} server
 * @param {string} faction
 */
async function attemptBackdoor(ns, server, faction) {
    try {
        log(ns, `Installing backdoor on ${server} for ${faction}...`, "INFO");
        
        // Connect to the server
        const connected = await connectToServer(ns, server);
        
        if (connected) {
            // Install backdoor (requires singularity)
            await ns.singularity.installBackdoor();
            log(ns, `Successfully backdoored ${server}!`, "INFO");
            
            // Return home
            ns.singularity.connect("home");
        }
    } catch (e) {
        log(ns, `Failed to backdoor ${server}: ${e}`, "WARN");
    }
}

/**
 * Connect to a server by finding path
 * @param {NS} ns
 * @param {string} target
 * @returns {boolean}
 */
async function connectToServer(ns, target) {
    try {
        // Import scanner to find path
        const { findPath } = await import("/angel/scanner.js");
        const path = findPath(ns, target);
        
        if (path.length === 0) {
            return false;
        }
        
        // Connect through the path
        for (const server of path) {
            ns.singularity.connect(server);
        }
        
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Get list of programs we own
 * @param {NS} ns
 * @returns {string[]}
 */
export function getOwnedPrograms(ns) {
    const programs = [
        "BruteSSH.exe",
        "FTPCrack.exe",
        "relaySMTP.exe",
        "HTTPWorm.exe",
        "SQLInject.exe",
        "DeepscanV1.exe",
        "DeepscanV2.exe",
        "ServerProfiler.exe",
        "AutoLink.exe",
        "Formulas.exe",
    ];
    
    return programs.filter(p => ns.fileExists(p, "home"));
}

/**
 * Get port opener count
 * @param {NS} ns
 * @returns {number}
 */
export function getPortOpenerCount(ns) {
    const openers = [
        "BruteSSH.exe",
        "FTPCrack.exe",
        "relaySMTP.exe",
        "HTTPWorm.exe",
        "SQLInject.exe",
    ];
    
    return openers.filter(p => ns.fileExists(p, "home")).length;
}

/**
 * Display program status
 * @param {NS} ns
 */
export function displayProgramStatus(ns) {
    const owned = getOwnedPrograms(ns);
    const portOpeners = getPortOpenerCount(ns);
    const hasTor = hasTorRouter(ns);
    
    ns.tprint("\n=== PROGRAMS STATUS ===");
    ns.tprint(`TOR Router: ${hasTor ? "Yes" : "No"}`);
    ns.tprint(`Port Openers: ${portOpeners}/5`);
    ns.tprint(`Total Programs: ${owned.length}`);
    ns.tprint("\nOwned Programs:");
    for (const prog of owned) {
        ns.tprint(`  ✓ ${prog}`);
    }
}
