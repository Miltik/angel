/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("Config module - use as import only");
}

// Core angel configuration
export const config = {
    // ============================================
    // UNIFIED GAME PHASE SYSTEM
    // ============================================
    // Defines complete lifecycle toward daemon
    gamePhases: {
        // Detection thresholds (system auto-advances through phases)
        thresholds: {
            phase0to1: { hackLevel: 75, money: 10000000 },           // Bootstrap → Early Scaling
            phase1to2: { hackLevel: 200, money: 100000000 },         // Early → Mid Game
            phase2to3: { hackLevel: 500, money: 500000000 },         // Mid → Gang Phase
            phase3to4: { hackLevel: 800, stats: 70 },                // Gang → Late Game
        },

        // Phase 0: Bootstrap
        phase0: {
            name: "Bootstrap",
            hackingTarget: 75,
            primaryActivity: "crime",                    // Focus: quick cash
            secondaryActivities: ["training", "company"],
            priorities: {
                crime: 1,                               // Get money ASAP
                training: 2,                            // Minimal stat training
                company: 3,                             // Alternative income
                hacking: 4,                             // Early xp
                gang: 0,                                // Not yet
                stocks: 0,                              // Not yet
            },
            spending: {
                augmentsTargetCost: 5000000,            // Conservative
                serverBuyThreshold: 0.15,               // Buy when have 15% of cost
                focus: "TOR_and_programs",              // Auto-buy TOR + 5 programs
            },
        },

        // Phase 1: Early Scaling
        phase1: {
            name: "Early Scaling",
            hackingTarget: 200,
            primaryActivity: "factionWork",             // Focus: faction rep
            secondaryActivities: ["training", "hacking", "crime"],
            priorities: {
                factionWork: 1,                         // Grind faction rep
                training: 2,                            // Get stats to 30+
                hacking: 3,                             // Scale hacking xp
                servers: 4,                             // Start buying cheap servers
                crime: 5,                               // Filler when faction done
                gang: 0,                                // Not yet
                stocks: 0,                              // Not yet
            },
            spending: {
                augmentsTargetCost: 50000000,           // More aggressive
                serverBuyThreshold: 0.1,                // Buy more often
                focus: "acquisition",                   // Buy everything affordable
            },
            augmentThreshold: 15,                       // Queue 15+ if possible
        },

        // Phase 2: Mid Game
        phase2: {
            name: "Mid Game",
            hackingTarget: 500,
            primaryActivity: "hacking",                 // Focus: scale servers + hacking
            secondaryActivities: ["factionWork", "training"],
            priorities: {
                hacking: 1,                             // Scale
                servers: 2,                             // Aggressive purchases
                factionWork: 3,                         // Maintain rep
                training: 4,                            // Get stats to 50+
                augments: 5,                            // Continuous buying
                crime: 0,                               // Filler only
                gang: 0,                                // Wait
                stocks: 0,                              // Not yet
            },
            spending: {
                augmentsTargetCost: 200000000,          // Heavy spending
                serverBuyThreshold: 0.05,               // buy very regularly
                focus: "augments_and_servers",
            },
            augmentThreshold: 20,
        },

        // Phase 3: Gang Phase
        phase3: {
            name: "Gang Phase",
            hackingTarget: 800,
            primaryActivity: "gangRespect",             // Focus: gang rep for $$$
            secondaryActivities: ["stocks", "hacking", "sleeves"],
            priorities: {
                gang: 1,                                // MAXIMUM gang priority
                stocks: 2,                              // Start building positions
                hacking: 3,                             // Continue scaling
                sleeves: 4,                             // Delegate work
                factionWork: 5,                         // Maintain where needed
                training: 0,                            // Done
                crime: 0,                               // Not needed
            },
            spending: {
                augmentsTargetCost: 500000000,          // Max spending
                serverBuyThreshold: 0.05,
                gangMembers: 12,                        // Keep at max
                stocksSpendRatio: 0.2,                  // Invest 20% of profits
                focus: "gang_and_augments",
            },
            augmentThreshold: 25,
        },

        // Phase 4: Late Game (Daemon Prep)
        phase4: {
            name: "Late Game",
            hackingTarget: 1000,
            primaryActivity: "daemonPrep",              // Focus: finish daemon requirements
            secondaryActivities: ["bladeburner", "augments"],
            priorities: {
                bladeburner: 1,                         // Final combat prep
                augments: 2,                            // Final sprint
                hacknet: 3,                             // Late-game money scaling
                gang: 4,                                // Maintain
                stocks: 5,                              // Let run
                sleeves: 6,                             // Delegate
                hacking: 0,                             // Done scaling
            },
            spending: {
                augmentsTargetCost: 1000000000,         // Everything
                focus: "daemon_requirements",           // Target: level X, programs Y, root Z
            },
        },
    },

    // ============================================
    // LEGACY CONFIG (Keep existing, phase-aware)
    // ============================================
    // Orchestrator settings
    orchestrator: {
        loopDelay: 1000,           // Main loop delay in ms
        enableHacking: true,
        enableServerMgmt: true,
        enableFactions: false,     // Moved into activities.js unified activity+faction module
        enableAugments: true,
        enablePrograms: true,
        enableActivities: true,    // Handles crime, training, faction, company (all phases)
        enableTraining: false,     // Delegated to activities.js unified activity module
        enableCompany: false,      // Integrated into activities.js unified activity selector
        enableSleeves: true,
        enableStocks: true,
        enableGang: true,
        enableBladeburner: true,
        enableHacknet: true,
        enableMilestones: true,
        enableDashboard: true,     // New: Real-time monitoring
    },

    // Hacking settings
    hacking: {
        targetMoneyThreshold: 0.75,  // Hack when money is above 75% of max
        targetSecurityThreshold: 5,   // Only hack when security is within 5 of min
        batchDelay: 200,              // Delay between batch operations (ms)
        reservedHomeRam: 20,          // RAM to reserve on home server (GB)
        shareExcessRam: true,         // Use excess RAM for share() scripts
    },

    // Server management settings
    servers: {
        autoBuyServers: true,
        maxServerRam: 1048576,        // Max RAM per purchased server
        purchaseThreshold: 0.1,       // Default; overridden by phase
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
        minQueuedAugs: 7,
        minQueuedCost: 5000000000,
        resetScript: "/angel/start.js",
        resetCountdownSec: 10,
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
        minSuccessChance: 0.25,          // Minimum success chance (lower for high-tier crimes)
        focus: false,
        crimes: [
            // Low tier (early game)
            "Shoplift",
            "Rob Store",
            "Mug Someone",
            "Larceny",
            // Mid tier
            "Deal Drugs",
            "Bond Forgery",
            "Grand Theft Auto",
            // High tier (late game)
            "Traffick Illegal Arms",
            "Assassination",
            "Heist",
        ],
        // Prefer higher tier crimes when money is above these thresholds
        tierThresholds: {
            high: 100000000,      // Above $100M, prefer high-tier crimes
            mid: 10000000,        // Above $10M, prefer mid-tier
            low: 0,               // Otherwise, do low-tier
        },
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
        // Training phase thresholds
        trainUntil: 60,                 // Train members to this level before warfare
        trainingPhaseEnd: 0.3,          // Phase ends when 30% of members are trained
        transitionPhaseEnd: 0.8,        // Phase ends when 80% of members are trained
        
        // Wanted level management
        minWantedPenalty: 0.9,          // Start peacekeeping when wanted below this
        criticalWantedPenalty: 0.8,     // Emergency peacekeeping below this
        peacekeeperRatio: 0.3,          // Peacekeepers as % of gang when critical
        
        // Territory Warfare (respect building)
        warfareRatio: 0.75,             // % of ready members on Territory Warfare in respect phase
        warfareMinReadyRatio: 0.8,      // Need 80% ready before full warfare push
        
        // Money and respect balance
        moneyTask: "Human Trafficking",  // Primary money task (overridden by strategy)
        respectTasks: ["Territory Warfare", "Cyberterrorism", "DDoS Attacks"],
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
    activities: "/angel/modules/activities.js",
    training: "/angel/modules/training.js",
    company: "/angel/modules/company.js",
    sleeves: "/angel/modules/sleeves.js",
    stocks: "/angel/modules/stocks.js",
    gang: "/angel/modules/gang.js",
    bladeburner: "/angel/modules/bladeburner.js",
    hacknet: "/angel/modules/hacknet.js",
    milestones: "/angel/modules/milestones.js",
    dashboard: "/angel/modules/dashboard.js",
    
    // Workers (actual hacking scripts)
    hack: "/angel/workers/hack.js",
    grow: "/angel/workers/grow.js",
    weaken: "/angel/workers/weaken.js",
    share: "/angel/workers/share.js",
    
    // Utils
    utils: "/angel/utils.js",
    scanner: "/angel/scanner.js",
};
