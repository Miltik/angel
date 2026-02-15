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
        enableCrime: true,
        enableTraining: true,
        enableCompany: true,
        enableSleeves: true,
        enableStocks: true,
        enableGang: true,
        enableBladeburner: true,
        enableHacknet: true,
        enableMilestones: true,
    },

    // Hacking settings
    hacking: {
        targetMoneyThreshold: 0.75,  // Hack when money is above 75% of max
        targetSecurityThreshold: 5,   // Only hack when security is within 5 of min
        batchDelay: 200,              // Delay between batch operations (ms)
        reservedHomeRam: 20,          // RAM to reserve on home server (GB) - reduced to prevent conflicts
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
        autoBuyAugments: true,         // Auto-buy augments when affordable
        preBuyAugments: true,          // Queue augments before reset
        reserveMoneyForAugments: true,
        installOnThreshold: true,
        minQueuedAugs: 10,
        minQueuedCost: 5000000000,
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
        preferBuying: true,            // Prefer buying over creating (default: true)
        purchaseThreshold: 0.05,       // Buy programs when we have 5% of cost
        priorityPrograms: [
            "BruteSSH.exe",
            "FTPCrack.exe",
            "relaySMTP.exe",
            "HTTPWorm.exe",
            "SQLInject.exe",
        ],
    },

    // Crime automation settings (SF4)
    crime: {
        onlyWhenMoneyBelow: 5000000000, // Only commit crimes when money is below this
        minSuccessChance: 0.4,          // Minimum success chance to pick a crime
        focus: false,
        crimes: [
            "Shoplift",
            "Rob store",
            "Mug someone",
            "Larceny",
            "Deal Drugs",
            "Bond Forgery",
            "Grand Theft Auto",
        ],
    },

    // University + gym training settings (SF4)
    training: {
        autoTravel: true,
        city: "Sector-12",
        university: "Rothman University",
        course: "Algorithms",
        gym: "Powerhouse Gym",
        targetHacking: 800,
        targetStats: {
            strength: 50,
            defense: 50,
            dexterity: 50,
            agility: 50,
        },
        focus: false,
    },

    // Company job automation settings (SF4)
    company: {
        onlyWhenMoneyBelow: 10000000000, // Only work a job when money is below this
        autoApply: true,
        focus: false,
        preferredCompanies: [
            "MegaCorp",
            "Four Sigma",
            "ECorp",
            "Bachman & Associates",
            "Clarke Incorporated",
            "NWO",
            "OmniTek Incorporated",
            "KuaiGong International",
            "Fulcrum Technologies",
        ],
        preferredFields: [
            "Software",
            "IT",
            "Security",
            "Business",
        ],
    },

    // Milestone coordinator settings
    milestones: {
        mode: "balanced",
        loopDelay: 30000,
        notifyDaemon: true,
        notifyInterval: 300000,
    },

    // Sleeve automation settings (if sleeves unlocked)
    sleeves: {
        mode: "balanced", // balanced | training | crime | faction
        crime: "Mug someone",
        fallbackCrime: "Shoplift",
        maxShock: 75,
        recoverShock: true,
        targetHacking: 800,
        targetStats: {
            strength: 50,
            defense: 50,
            dexterity: 50,
            agility: 50,
        },
        university: "Rothman University",
        course: "Algorithms",
        gym: "Powerhouse Gym",
        factionPriority: [
            "CyberSec",
            "NiteSec",
            "The Black Hand",
            "BitRunners",
        ],
        factionWorkType: "Hacking",
    },

    // Stock market automation settings (TIX + 4S)
    stocks: {
        enableShorts: false,
        minForecast: 0.6,
        sellForecast: 0.5,
        maxPositionRatio: 0.25,
        maxSpendRatio: 0.2,
        reserveMoney: 1000000000,
    },

    // Gang automation settings
    gang: {
        trainUntil: 60,
        minWantedPenalty: 0.9,
        moneyTask: "Human Trafficking",
        wantedTask: "Vigilante Justice",
    },

    // Bladeburner automation settings
    bladeburner: {
        minSuccessChance: 0.6,
        staminaThreshold: 0.5,
        loopDelay: 60000,
        contracts: [
            "Tracking",
            "Bounty Hunter",
            "Retirement",
        ],
    },

    // Hacknet automation settings
    hacknet: {
        maxSpendRatio: 0.15,
        reserveMoney: 500000000,
        allowCache: false,
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
    ACTIVITY: 5,
    ACTIVITY_MODE: 6,
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
    crime: "/angel/modules/crime.js",
    training: "/angel/modules/training.js",
    company: "/angel/modules/company.js",
    sleeves: "/angel/modules/sleeves.js",
    stocks: "/angel/modules/stocks.js",
    gang: "/angel/modules/gang.js",
    bladeburner: "/angel/modules/bladeburner.js",
    hacknet: "/angel/modules/hacknet.js",
    milestones: "/angel/modules/milestones.js",
    
    // Workers (actual hacking scripts)
    hack: "/angel/workers/hack.js",
    grow: "/angel/workers/grow.js",
    weaken: "/angel/workers/weaken.js",
    share: "/angel/workers/share.js",
    
    // Utils
    utils: "/angel/utils.js",
    scanner: "/angel/scanner.js",
};
