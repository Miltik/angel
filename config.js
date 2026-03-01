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
            hackingTarget: 2500,
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
        enableDashboard: true,     // Real-time monitoring
        enableUILauncher: true,    // Clickable DOM window launcher/toggles
        enableNetworkMap: true,    // Network visualization
        enableContracts: true,     // Coding contracts solver
        enableLoot: true,          // Loot file collector (.lit/.msg/.txt/.cct)
        enableFormulas: true,      // Formulas.exe farming
        enableCorporation: true,   // Corporation automation (delayed startup to avoid RAM contention)
        enableXPFarm: true,        // Optional XP farming using spare/home RAM or hyper mode
        enableBackdoorAuto: true,  // Auto-run backdoor flow when new servers become eligible
        startupCorporationDelayMs: 35000, // Start corporation early (before hacking consumes RAM)
        startupHackingDelayMs: 45000, // Delay hacking module startup after corporation initializes
        startupXPFarmDelayMs: 55000, // XP farm starts last, uses spare RAM
        startupWorkerDelayMs: 90000, // Global grace period before worker-heavy modules (hacking/xpFarm)

    },

    // Corporation automation settings (requires Corporation API access)
    corporation: {
        loopDelayMs: 5000,
        autoCreate: false,
        corporationName: "AngelCorp",
        createWithSeedCapital: true,
        minFundsForCreation: 150000000000,
        maxSpendRatioPerCycle: 0.3,           // 30% per cycle (aggressive early growth)
        minimumCashBuffer: 5000000000,        // 5b safety buffer

        primaryIndustry: "Agriculture",
        primaryDivision: "Agri",
        primaryCity: "Sector-12",             // Single city focus
        expandToAllCities: false,             // Focus single city first, expand at milestones
        multiCityExpansionMinFunds: 500000000000,      // 500b
        multiCityExpansionMinRevenue: 5000000000,      // 5b/s
        multiCityExpansionMinEmployees: 30,            // 30 employees in primary
        minOfficeSizePrimary: 6,              // Start small, grow incrementally
        minWarehouseLevelPrimary: 1,          // Start with level 1, grow as profits come in

        enableProducts: true,
        productIndustry: "Tobacco",
        productDivision: "Cigs",
        productCity: "Aevum",
        productPrefix: "AngelProduct",
        productStartFunds: 300000000000,
        productDesignInvestment: 2000000000,  // 2b per product
        productMarketingInvestment: 2000000000,
        maxProductsToKeep: 5,
        minOfficeSizeProduct: 15,             // Larger product office
        minWarehouseLevelProduct: 5,

        upgrades: {
            "Smart Factories": 10,            // Increased targets
            "Smart Storage": 10,
            "Wilson Analytics": 5,
        },
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

    // Home machine upgrade policy (Singularity)
    homeUpgrades: {
        enabled: true,
        prioritizeUntilTarget: true,   // Reserve budget for home upgrades before server expansion
        purchaseThresholdRatio: 1.0,   // Buy when we have 100% of upgrade cost
        reserveRatio: 0.75,            // Reserve up to 75% of next home upgrade cost
        maxReserveMoneyRatio: 0.5,     // Never reserve more than 50% of current cash
        minMoneyToUpgrade: 5000000,    // Ignore tiny early balances
        defaultTargetRam: 256,
        defaultTargetCores: 4,
        targets: {
            phase0: { ram: 128, cores: 2 },
            phase1: { ram: 256, cores: 4 },
            phase2: { ram: 512, cores: 6 },
            phase3: { ram: 2048, cores: 8 },
            phase4: { ram: 8192, cores: 12 },
        },
    },

    // Activity behavior tuning
    activities: {
        forceCrimeFactionUnlockUntilPhase: 2, // Only force crime-faction unlock path up to phase 2
        lateCrimeMoneyCap: 100000000,         // In phase 3+, only fall back to crime when below this cash
    },

    // Faction settings (for SF4)
    factions: {
        autoJoinFactions: true,
        priorityFactions: [
            "CyberSec",
            "Tian Di Hui", 
            "Netburners",
            "Sector-12",
            "The Syndicate",
            "Tetrads",
            "Slum Snakes",
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
        aggressiveQueueTarget: 3,
        aggressiveQueueSpendMultiplier: 1.5,
        queueReserveMoney: 50000000,
        minQueuedCost: 15000000000,
        resetMinQueuedAugsFloor: 8,    // Never reset below this queue count unless high-value override is met
        resetMinRunMinutes: 35,        // Minimum run age before reset (unless high-value override)
        resetStallMinutes: 12,         // Require queue progress to stall this long before resetting
        resetRequireStall: true,       // Wait for queue growth to flatten before reset
        resetHighValueCost: 60000000000, // Immediate reset override for very high queued value
        resetPhaseTargets: {
            phase0: { minQueuedAugs: 8, minQueuedCost: 8000000000, minQueuedFloor: 6, minRunMinutes: 25, stallMinutes: 8, highValueCost: 25000000000 },
            phase1: { minQueuedAugs: 9, minQueuedCost: 12000000000, minQueuedFloor: 7, minRunMinutes: 30, stallMinutes: 10, highValueCost: 35000000000 },
            phase2: { minQueuedAugs: 10, minQueuedCost: 15000000000, minQueuedFloor: 8, minRunMinutes: 35, stallMinutes: 12, highValueCost: 60000000000 },
            phase3: { minQueuedAugs: 12, minQueuedCost: 25000000000, minQueuedFloor: 9, minRunMinutes: 45, stallMinutes: 15, highValueCost: 90000000000 },
            phase4: { minQueuedAugs: 14, minQueuedCost: 40000000000, minQueuedFloor: 10, minRunMinutes: 60, stallMinutes: 20, highValueCost: 150000000000 },
        },
        noQueueWarnMinutes: 20,           // Dashboard warning when queue remains empty too long
        noQueueWarnCash: 1000000000,      // Only warn when queue is empty and cash is above this value
        daemonResetPolicy: {
            preventResetWhenDaemonReady: true,      // Hold reset once daemon run conditions are ready
            resetImmediatelyOnQueuedRedPill: true,  // If Red Pill is queued, reset now to install it
        },
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
        targetHacking: 2500,
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
        emergencyWantedPenalty: 0.9,    // Hard emergency: prioritize wanted reduction over all non-training tasks
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
        minCombatStats: 75,
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
        reserveScale: 0.25,
        minReserveMoney: 200000,
        bootstrapNodeTarget: 2,
        bootstrapSpendRatio: 0.9,
        allowCache: false,
    },

    // XP farm settings
    xpFarm: {
        mode: "spare-home",        // spare-home | hyper
        reserveHomeRam: 2,          // GB reserved on home for other modules
        minHomeFreeRamGb: 1,        // Keep at least this much home RAM free
        interval: 3000,             // Loop interval in ms
        cleanHyper: true,           // In hyper mode, clean existing weaken workers before redeploy
        target: "",                // Optional fixed target (empty = auto)
    },

    // Loot collector settings
    loot: {
        loopDelayMs: 60000,
        includeHome: false,
        maxFilesPerLoop: 250,
        archivePrefix: "/angel/loot/",
        extensions: [".lit", ".msg", ".txt", ".cct"],
    },

    // Backdoor automation settings
    backdoor: {
        checkIntervalMs: 60000,     // How often orchestrator checks for new eligible backdoor targets
        minHackLevelDelta: 25,      // Trigger if hacking level increased by this much since last run/check
        forceRunIntervalMs: 300000, // Force a run every N ms if eligible targets exist
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
    dashboard: "/angel/modules/dashboard.js",
    uiLauncher: "/angel/modules/uiLauncher.js",
    networkMap: "/angel/networkMap.js",
    contracts: "/angel/modules/contracts.js",
    loot: "/angel/modules/loot.js",
    formulas: "/angel/modules/formulas.js",
    corporation: "/angel/modules/corporation.js",
    xpFarm: "/angel/xpFarm.js",
    backdoor: "/angel/backdoor.js",
    
    // Workers (actual hacking scripts)
    hack: "/angel/workers/hack.js",
    grow: "/angel/workers/grow.js",
    weaken: "/angel/workers/weaken.js",
    share: "/angel/workers/share.js",
    
    // Utils
    utils: "/angel/utils.js",
    scanner: "/angel/scanner.js",
};
