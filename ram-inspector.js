/**
 * ANGEL RAM Inspector - System Resource Analysis
 * 
 * Displays RAM requirements for all ANGEL modules, services, and workers
 * Shows:
 * - Individual module RAM usage
 * - Service layer RAM footprint
 * - Worker script sizes
 * - Total system requirements
 * - Startup phases and optional modules
 * - What can be disabled to save RAM
 * 
 * Usage:
 *   run /angel/ram-inspector.js
 *   run /angel/ram-inspector.js --full (include all details)
 *   run /angel/ram-inspector.js --modules-only
 *   run /angel/ram-inspector.js --services-only
 * 
 * @param {NS} ns
 */

import { config, SCRIPTS } from "/angel/config.js";

const MODE = {
    FULL: "--full",
    MODULES_ONLY: "--modules-only",
    SERVICES_ONLY: "--services-only",
};

export async function main(ns) {
    ns.disableLog("ALL");
    
    const mode = ns.args[0] || "default";
    
    printBanner(ns);
    
    const moduleRam = collectModuleRam(ns);
    const serviceRam = collectServiceRam(ns);
    const workerRam = collectWorkerRam(ns);
    
    if (mode === MODE.MODULES_ONLY) {
        printModuleRam(ns, moduleRam);
    } else if (mode === MODE.SERVICES_ONLY) {
        printServiceRam(ns, serviceRam);
    } else {
        printModuleRam(ns, moduleRam);
        ns.print("");
        printServiceRam(ns, serviceRam);
        ns.print("");
        printWorkerRam(ns, workerRam);
        ns.print("");
        printTelemetryRam(ns);
        ns.print("");
        printSummary(ns, moduleRam, serviceRam, workerRam);
        
        if (mode === MODE.FULL) {
            ns.print("");
            printStartupPhases(ns, moduleRam);
            ns.print("");
            printOptionalModules(ns, moduleRam);
            ns.print("");
            printRamSavingTips(ns, moduleRam);
        }
    }
}

function printBanner(ns) {
    ns.print("╔════════════════════════════════════════════════════════╗");
    ns.print("║           ANGEL RAM INSPECTOR - System Status          ║");
    ns.print("╚════════════════════════════════════════════════════════╝");
    ns.print("");
}

function collectModuleRam(ns) {
    const modules = [];
    
    for (const [name, path] of Object.entries(SCRIPTS)) {
        // Skip non-module files
        if (!path.includes("/modules/") || name.includes("Launcher") || name.includes("Manager")) {
            continue;
        }
        
        if (!ns.fileExists(path, "home")) {
            continue;
        }
        
        const ram = ns.getScriptRam(path, "home");
        const enabled = config.orchestrator[`enable${capitalize(name)}`] !== false;
        const optional = isModuleOptional(name);
        
        modules.push({
            name,
            path,
            ram,
            enabled,
            optional,
            isRunning: ns.isRunning(path, "home")
        });
    }
    
    return modules.sort((a, b) => b.ram - a.ram);
}

function collectServiceRam(ns) {
    const services = [];
    
    const serviceFiles = [
        { name: "network", path: SCRIPTS.network },
        { name: "rooting", path: SCRIPTS.rooting },
        { name: "stats", path: SCRIPTS.stats },
        { name: "moduleRegistry", path: SCRIPTS.moduleRegistry },
        { name: "events", path: SCRIPTS.events },
        { name: "cache", path: SCRIPTS.cache },
    ];
    
    for (const { name, path } of serviceFiles) {
        if (!ns.fileExists(path, "home")) {
            continue;
        }
        
        const ram = ns.getScriptRam(path, "home");
        services.push({ name, path, ram });
    }
    
    return services.sort((a, b) => b.ram - a.ram);
}

function collectWorkerRam(ns) {
    const workers = [];
    
    const workerFiles = [
        { name: "hack.js", path: SCRIPTS.hack },
        { name: "grow.js", path: SCRIPTS.grow },
        { name: "weaken.js", path: SCRIPTS.weaken },
        { name: "share.js", path: SCRIPTS.share },
    ];
    
    for (const { name, path } of workerFiles) {
        if (!ns.fileExists(path, "home")) {
            continue;
        }
        
        const ram = ns.getScriptRam(path, "home");
        workers.push({ name, path, ram });
    }
    
    return workers.sort((a, b) => b.ram - a.ram);
}

function printModuleRam(ns, modules) {
    ns.print("╔════════════════════════════════════════════════════════╗");
    ns.print("║                    BUSINESS MODULES                    ║");
    ns.print("║           (Core automation and game features)          ║");
    ns.print("╚════════════════════════════════════════════════════════╝");
    ns.print("");
    
    const coreModules = modules.filter(m => !m.optional);
    const optionalModules = modules.filter(m => m.optional);
    
    if (coreModules.length > 0) {
        ns.print("📌 CORE MODULES (Required for Angel):");
        for (const mod of coreModules) {
            const status = mod.isRunning ? "🟢" : "⚪";
            const enabledStr = mod.enabled ? "ON" : "OFF";
            const ram = formatRam(mod.ram);
            ns.print(`  ${status} ${mod.name.padEnd(20)} ${ram.padStart(7)}  [${enabledStr}]`);
        }
        ns.print("");
    }
    
    if (optionalModules.length > 0) {
        ns.print("⭐ OPTIONAL MODULES (Can be disabled to save RAM):");
        for (const mod of optionalModules) {
            const status = mod.isRunning ? "🟢" : "⚪";
            const enabledStr = mod.enabled ? "ON" : "OFF";
            const ram = formatRam(mod.ram);
            ns.print(`  ${status} ${mod.name.padEnd(20)} ${ram.padStart(7)}  [${enabledStr}]`);
        }
    }
}

function printServiceRam(ns, services) {
    ns.print("╔════════════════════════════════════════════════════════╗");
    ns.print("║               SERVICE LAYER (Shared)                   ║");
    ns.print("║        Loaded once, shared by all modules              ║");
    ns.print("╚════════════════════════════════════════════════════════╝");
    ns.print("");
    
    for (const svc of services) {
        const ram = formatRam(svc.ram);
        ns.print(`  🔧 ${svc.name.padEnd(20)} ${ram.padStart(7)}`);
    }
}

function printWorkerRam(ns, workers) {
    ns.print("╔════════════════════════════════════════════════════════╗");
    ns.print("║                  WORKER SCRIPTS                        ║");
    ns.print("║          (Deployed to network for hacking)             ║");
    ns.print("╚════════════════════════════════════════════════════════╝");
    ns.print("");
    
    for (const worker of workers) {
        const ram = formatRam(worker.ram);
        const threads = Math.floor(ns.getServerMaxRam("home") / worker.ram);
        ns.print(`  ⚙️  ${worker.name.padEnd(20)} ${ram.padStart(7)}  (~${threads} threads on home)`);
    }
}

function printTelemetryRam(ns) {
    ns.print("╔════════════════════════════════════════════════════════╗");
    ns.print("║               TELEMETRY & MONITORING                   ║");
    ns.print("╚════════════════════════════════════════════════════════╝");
    ns.print("");
    
    const telemetryPath = SCRIPTS.telemetry;
    const reportPath = SCRIPTS.telemetryReport;
    
    let totalTelemetry = 0;
    if (ns.fileExists(telemetryPath, "home")) {
        const ram = ns.getScriptRam(telemetryPath, "home");
        ns.print(`  📊 telemetry.js          ${formatRam(ram).padStart(7)}`);
        totalTelemetry += ram;
    }
    
    if (ns.fileExists(reportPath, "home")) {
        const ram = ns.getScriptRam(reportPath, "home");
        ns.print(`  📈 report.js             ${formatRam(ram).padStart(7)}`);
        totalTelemetry += ram;
    }
    
    if (totalTelemetry > 0) {
        ns.print(`  Total: ${formatRam(totalTelemetry)}`);
    }
}

function printSummary(ns, modules, services, workers) {
    ns.print("╔════════════════════════════════════════════════════════╗");
    ns.print("║                   SUMMARY & REQUIREMENTS               ║");
    ns.print("╚════════════════════════════════════════════════════════╝");
    ns.print("");
    
    // Calculate totals
    const coreModulesRam = modules
        .filter(m => !m.optional && m.enabled)
        .reduce((sum, m) => sum + m.ram, 0);
    
    const optionalModulesRam = modules
        .filter(m => m.optional && m.enabled)
        .reduce((sum, m) => sum + m.ram, 0);
    
    const servicesRam = services.reduce((sum, s) => sum + s.ram, 0);
    const workerRam = workers.length > 0 ? workers[0].ram : 0; // Minimum 1 weaken thread
    
    const totalOrchestrator = coreModulesRam + servicesRam;
    const totalFull = totalOrchestrator + optionalModulesRam;
    const totalWithWorkers = totalFull + workerRam;
    
    const homeRam = ns.getServerMaxRam("home");
    const usedRam = ns.getServerUsedRam("home");
    const freeRam = Math.max(0, homeRam - usedRam);
    const orchestratorRam = ns.getScriptRam(SCRIPTS.orchestrator, "home");
    
    ns.print(`📋 RAM Breakdown:`);
    ns.print(`  Core Modules:     ${formatRam(coreModulesRam)} (required)`);
    ns.print(`  Optional Modules: ${formatRam(optionalModulesRam)} (can disable)`);
    ns.print(`  Services Layer:   ${formatRam(servicesRam)} (shared)`);
    ns.print(`  Orchestrator:     ${formatRam(orchestratorRam)} (coordination)`);
    ns.print("");
    
    ns.print(`💾 Home Server Status:`);
    ns.print(`  Total RAM:        ${formatRam(homeRam)}`);
    ns.print(`  Used:             ${formatRam(usedRam)}`);
    ns.print(`  Free:             ${formatRam(freeRam)}`);
    ns.print("");
    
    ns.print(`🚀 Launch Requirements:`);
    ns.print(`  Minimum (core):           ${formatRam(totalOrchestrator)} + orchestrator`);
    ns.print(`  Full (all enabled):       ${formatRam(totalFull)} + orchestrator`);
    ns.print(`  +1 worker thread:         ${formatRam(totalWithWorkers)} + orchestrator`);
    ns.print("");
    
    // Recommendation
    const needed = totalFull + orchestratorRam;
    if (freeRam >= needed) {
        ns.print(`✅ READY: You have enough RAM to run full Angel now!`);
    } else if (freeRam >= (coreModulesRam + servicesRam + orchestratorRam)) {
        ns.print(`⚠️  LIMITED: Core Angel will run, but optional modules disabled`);
        ns.print(`    Disable these to fit: ${formatRam(needed - freeRam)} more needed`);
    } else {
        ns.print(`❌ INSUFFICIENT: Need ${formatRam(needed - freeRam)} more GB`);
    }
}

function printStartupPhases(ns, modules) {
    ns.print("╔════════════════════════════════════════════════════════╗");
    ns.print("║               STARTUP SEQUENCE & PHASES                ║");
    ns.print("║            (Shows module load order/timing)            ║");
    ns.print("╚════════════════════════════════════════════════════════╝");
    ns.print("");
    
    ns.print("🔄 Phase 1: Infrastructure (Startup immediately)");
    ns.print("  1. phase.js         - Game phase tracking");
    ns.print("  2. programs.js      - Program acquisition");
    ns.print("  3. servers.js       - Server management");
    ns.print("");
    
    ns.print("🎮 Phase 2: Core Gameplay (After infrastructure ready)");
    ns.print("  4. factions.js      - Faction management");
    ns.print("  5. activities.js    - Activity coordination");
    ns.print("  6. crime.js         - Crime automation");
    ns.print("  7. augments.js      - Augmentation purchasing");
    ns.print("");
    
    ns.print("⚡ Phase 3: Advanced (After core modules loaded)");
    const ramMap = new Map(modules.map(m => [m.name, m.ram]));
    const hacking = ramMap.get("hacking");
    if (hacking) {
        ns.print(`  8. hacking.js       - Worker deployment (${formatRam(hacking)})`);
    }
    ns.print("  9. hacknet.js       - Hacknet auto-upgrade");
    ns.print(" 10. sleves.js        - Sleeve management");
    ns.print("");
    
    ns.print("🎨 Phase 4: UI & Monitoring (Low priority, can defer)");
    ns.print(" 11. dashboard.js     - Monitoring display");
    ns.print(" 12. uiLauncher.js    - UI system");
    ns.print("");
    
    ns.print("💼 Phase 5: End-Game (Optional, high RAM)");
    ns.print(" 13. corporation.js   - Company management");
    ns.print(" 14. gang.js          - Gang operations");
    ns.print(" 15. stocks.js        - Stock trading");
    ns.print(" 16. bladeburner.js   - Bladeburner automation");
}

function printOptionalModules(ns, modules) {
    ns.print("╔════════════════════════════════════════════════════════╗");
    ns.print("║              OPTIONAL MODULES (RAM Savings)            ║");
    ns.print("║           Disable in config.js to save RAM             ║");
    ns.print("╚════════════════════════════════════════════════════════╝");
    ns.print("");
    
    const optional = modules.filter(m => m.optional).sort((a, b) => b.ram - a.ram);
    
    let saved = 0;
    for (const mod of optional) {
        ns.print(`  • ${mod.name.padEnd(20)} ${formatRam(mod.ram).padStart(7)}  [set enable${capitalize(mod.name)} = false]`);
        saved += mod.ram;
    }
    
    ns.print("");
    ns.print(`  💾 Total RAM available by disabling all: ${formatRam(saved)}`);
}

function printRamSavingTips(ns, modules) {
    ns.print("╔════════════════════════════════════════════════════════╗");
    ns.print("║              RAM OPTIMIZATION TIPS                     ║");
    ns.print("╚════════════════════════════════════════════════════════╝");
    ns.print("");
    
    // Find largest modules
    const biggest = modules
        .filter(m => m.optional)
        .slice(0, 3)
        .map((m, i) => `${i + 1}. Disable ${m.name} (${formatRam(m.ram)})`);
    
    ns.print("Quick wins:");
    for (const tip of biggest) {
        ns.print(`  ${tip}`);
    }
    
    ns.print("");
    ns.print("Advanced:");
    ns.print("  • Use angel-lite.js if you have <64GB RAM");
    ns.print("  • Disable optional modules (gang, stocks, corp) to start");
    ns.print("  • Enable modules gradually as RAM becomes available");
    ns.print("  • Services layer is shared - cannot be disabled");
    ns.print("  • Workers are deployed, not loaded on home");
}

function isModuleOptional(name) {
    const optional = [
        "sleeves", "stocks", "gang", "bladeburner", "hacknet",
        "corporation", "contracts", "loot", "formulas", "xpFarm",
        "backdoor", "uiLauncher", "networkMap", "dashboard"
    ];
    return optional.includes(name);
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatRam(gb) {
    if (gb < 1) {
        return `${(gb * 1024).toFixed(0)}MB`;
    }
    return `${gb.toFixed(2)}GB`;
}
