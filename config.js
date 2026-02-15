/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("Config module - use as import only");
}

// Core angel configuration
export const config = {
    // Orchestrator settings
    orchestrator: {
        loopDelay: 1000,           // Main loop delay in ms
        enableHacking: true,
        enableServerMgmt: true,
        enableFactions: true,
        enableAugments: true,
        enablePrograms: true,
    },

    // Hacking settings
    hacking: {
        targetMoneyThreshold: 0.75,  // Hack when money is above 75% of max
        targetSecurityThreshold: 5,   // Only hack when security is within 5 of min
        batchDelay: 200,              // Delay between batch operations (ms)
        reservedHomeRam: 64,          // RAM to reserve on home server (GB) - increased for modules
        shareExcessRam: true,         // Use excess RAM for share() scripts
    },

    // Server management settings
    servers: {
        autoBuyServers: true,
        maxServerRam: 1048576,        // Max RAM per purchased server (2^20 = 1PB)
        purchaseThreshold: 0.1,       // Buy servers when we have 10% of cost available
        serverPrefix: "angel-",
        maxServers: 25,
    },

    // Faction settings (for SF4)
    factions: {
        autoJoinFactions: true,
        priorityFactions: [
            "CyberSec",
            "Tian Di Hui", 
            "Netburners",
            "Sector-12",
            "Daedalus",
            "The Covenant",
            "Illuminati",
        ],
        workForFactionRep: true,
        repThresholdMultiplier: 1.1,  // Work until 110% of needed rep
    },

    // Augmentation settings (for SF4)
    augmentations: {
        autoBuyAugments: false,        // Don't auto-buy by default (expensive!)
        preBuyAugments: true,          // Queue augments before reset
        reserveMoneyForAugments: true,
        augmentPriority: [
            // Hacking augments
            "BitWire",
            "Artificial Bio-neural Network Implant",
            "Artificial Synaptic Potentiation",
            // Add more as desired
        ],
    },

    // Programs and backdoor settings
    programs: {
        autoBuyTor: true,              // Automatically purchase TOR router
        autoBuyPrograms: true,         // Buy programs from darkweb if can't create
        autoCreatePrograms: true,      // Create programs when idle
        autoBackdoor: true,            // Automatically backdoor faction servers
        purchaseThreshold: 0.05,       // Buy programs when we have 5% of cost
        priorityPrograms: [
            "BruteSSH.exe",
            "FTPCrack.exe",
            "relaySMTP.exe",
            "HTTPWorm.exe",
            "SQLInject.exe",
        ],
    },

    // Early game targets (sorted by difficulty)
    targets: {
        earlyGame: [
            "n00dles",
            "foodnstuff", 
            "sigma-cosmetics",
            "joesguns",
            "nectar-net",
            "hong-fang-tea",
            "harakiri-sushi",
        ],
        midGame: [
            "iron-gym",
            "phantasy",
            "silver-helix",
            "omega-net",
            "crush-fitness",
            "johnson-ortho",
        ],
    },
};

// Ports for inter-script communication
export const PORTS = {
    ORCHESTRATOR: 1,
    HACKING: 2,
    SERVERS: 3,
    FACTIONS: 4,
};

// Script paths (relative to /angel/)
export const SCRIPTS = {
    // Core
    orchestrator: "/angel/angel.js",
    
    // Modules
    hacking: "/angel/modules/hacking.js",
    serverMgmt: "/angel/modules/servers.js",
    factions: "/angel/modules/factions.js",
    augments: "/angel/modules/augments.js",
    programs: "/angel/modules/programs.js",
    
    // Workers (actual hacking scripts)
    hack: "/angel/workers/hack.js",
    grow: "/angel/workers/grow.js",
    weaken: "/angel/workers/weaken.js",
    share: "/angel/workers/share.js",
    
    // Utils
    utils: "/angel/utils.js",
    scanner: "/angel/scanner.js",
};
