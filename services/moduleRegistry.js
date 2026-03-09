/**
 * Module Registry - Centralized module lifecycle management
 * Manages module registration, dependencies, health, and state
 * 
 * Features:
 * - Module registration and discovery
 * - Dependency resolution
 * - Enable/disable tracking
 * - Health checks and status monitoring
 * - Lifecycle management (init, start, stop)
 * 
 * @module services/moduleRegistry
 */

import { config } from "/angel/config.js";

// Module registry state
const registry = new Map();

// Module states
export const ModuleState = {
    UNREGISTERED: "unregistered",
    REGISTERED: "registered",
    STARTING: "starting",
    RUNNING: "running",
    STOPPING: "stopping",
    STOPPED: "stopped",
    ERROR: "error",
    DISABLED: "disabled"
};

/**
 * Register a module with the registry
 * @param {string} name - Module name
 * @param {Object} moduleConfig - Module configuration
 * @returns {boolean} - Success
 */
export function registerModule(name, moduleConfig) {
    if (registry.has(name)) {
        return false; // Already registered
    }
    
    const module = {
        name,
        path: moduleConfig.path,
        enabled: moduleConfig.enabled !== false,
        dependencies: moduleConfig.dependencies || [],
        optional: moduleConfig.optional || false,
        priority: moduleConfig.priority || 50,
        state: ModuleState.REGISTERED,
        pid: null,
        lastStartTime: 0,
        lastStopTime: 0,
        startAttempts: 0,
        errors: [],
        metadata: moduleConfig.metadata || {},
    };
    
    registry.set(name, module);
    return true;
}

/**
 * Unregister a module
 * @param {string} name
 * @returns {boolean}
 */
export function unregisterModule(name) {
    return registry.delete(name);
}

/**
 * Get module info
 * @param {string} name
 * @returns {Object|null}
 */
export function getModule(name) {
    return registry.get(name) || null;
}

/**
 * Get all registered modules
 * @returns {Map}
 */
export function getAllModules() {
    return new Map(registry);
}

/**
 * Check if module is registered
 * @param {string} name
 * @returns {boolean}
 */
export function isRegistered(name) {
    return registry.has(name);
}

/**
 * Check if module is enabled
 * @param {string} name
 * @returns {boolean}
 */
export function isEnabled(name) {
    const module = registry.get(name);
    return module ? module.enabled : false;
}

/**
 * Enable a module
 * @param {string} name
 * @returns {boolean}
 */
export function enableModule(name) {
    const module = registry.get(name);
    if (!module) return false;
    
    module.enabled = true;
    if (module.state === ModuleState.DISABLED) {
        module.state = ModuleState.STOPPED;
    }
    return true;
}

/**
 * Disable a module
 * @param {string} name
 * @returns {boolean}
 */
export function disableModule(name) {
    const module = registry.get(name);
    if (!module) return false;
    
    module.enabled = false;
    module.state = ModuleState.DISABLED;
    return true;
}

/**
 * Update module state
 * @param {string} name
 * @param {string} state - New state from ModuleState
 * @param {number} pid - Optional PID
 * @returns {boolean}
 */
export function updateModuleState(name, state, pid = null) {
    const module = registry.get(name);
    if (!module) return false;
    
    module.state = state;
    
    if (state === ModuleState.RUNNING && pid !== null) {
        module.pid = pid;
        module.lastStartTime = Date.now();
        module.startAttempts++;
    }
    
    if (state === ModuleState.STOPPED || state === ModuleState.ERROR) {
        module.pid = null;
        module.lastStopTime = Date.now();
    }
    
    return true;
}

/**
 * Record module error
 * @param {string} name
 * @param {string} error
 */
export function recordModuleError(name, error) {
    const module = registry.get(name);
    if (!module) return;
    
    module.errors.push({
        timestamp: Date.now(),
        error: String(error),
    });
    
    // Keep only last 10 errors
    if (module.errors.length > 10) {
        module.errors = module.errors.slice(-10);
    }
    
    module.state = ModuleState.ERROR;
}

/**
 * Check if module is running
 * @param {NS} ns
 * @param {string} name
 * @returns {boolean}
 */
export function isModuleRunning(ns, name) {
    const module = registry.get(name);
    if (!module || !module.path) return false;
    
    return ns.isRunning(module.path, "home");
}

/**
 * Get module dependencies
 * @param {string} name
 * @returns {string[]}
 */
export function getModuleDependencies(name) {
    const module = registry.get(name);
    return module ? [...module.dependencies] : [];
}

/**
 * Check if all dependencies are satisfied
 * @param {NS} ns
 * @param {string} name
 * @returns {Object} - {satisfied: boolean, missing: string[]}
 */
export function checkDependencies(ns, name) {
    const module = registry.get(name);
    if (!module) {
        return { satisfied: false, missing: ["Module not registered"] };
    }
    
    const missing = [];
    
    for (const dep of module.dependencies) {
        const depModule = registry.get(dep);
        if (!depModule) {
            missing.push(dep);
            continue;
        }
        
        if (!depModule.enabled) {
            missing.push(`${dep} (disabled)`);
            continue;
        }
        
        if (!isModuleRunning(ns, dep)) {
            missing.push(`${dep} (not running)`);
        }
    }
    
    return {
        satisfied: missing.length === 0,
        missing
    };
}

/**
 * Get modules sorted by priority (higher priority first)
 * @returns {Array}
 */
export function getModulesByPriority() {
    const modules = Array.from(registry.values());
    return modules.sort((a, b) => b.priority - a.priority);
}

/**
 * Get modules that depend on a specific module
 * @param {string} name
 * @returns {string[]}
 */
export function getModuleDependents(name) {
    const dependents = [];
    
    for (const [moduleName, module] of registry) {
        if (module.dependencies.includes(name)) {
            dependents.push(moduleName);
        }
    }
    
    return dependents;
}

/**
 * Get module health summary
 * @param {NS} ns
 * @returns {Object}
 */
export function getHealthSummary(ns) {
    const summary = {
        total: registry.size,
        running: 0,
        stopped: 0,
        error: 0,
        disabled: 0,
        enabled: 0,
        unhealthy: [],
    };
    
    for (const [name, module] of registry) {
        if (module.enabled) summary.enabled++;
        
        if (module.state === ModuleState.DISABLED) {
            summary.disabled++;
        } else if (module.state === ModuleState.ERROR) {
            summary.error++;
            summary.unhealthy.push(name);
        } else if (isModuleRunning(ns, name)) {
            summary.running++;
        } else {
            summary.stopped++;
            if (module.enabled && !module.optional) {
                summary.unhealthy.push(name);
            }
        }
    }
    
    return summary;
}

/**
 * Initialize registry from config
 * @param {NS} ns
 */
export function initializeFromConfig(ns) {
    // Core modules (highest priority)
    if (config.orchestrator.enablePhase) {
        registerModule("phase", {
            path: "/angel/modules/phase.js",
            enabled: true,
            priority: 100,
            dependencies: [],
            metadata: { category: "core" }
        });
    }
    
    // Infrastructure modules
    if (config.orchestrator.enablePrograms) {
        registerModule("programs", {
            path: "/angel/modules/programs.js",
            enabled: true,
            priority: 90,
            dependencies: [],
            metadata: { category: "infrastructure" }
        });
    }
    
    if (config.orchestrator.enableServerMgmt) {
        registerModule("servers", {
            path: "/angel/modules/servers.js",
            enabled: true,
            priority: 85,
            dependencies: ["phase"],
            metadata: { category: "infrastructure" }
        });
    }
    
    // Core gameplay modules
    if (config.orchestrator.enableHacking) {
        registerModule("hacking", {
            path: "/angel/modules/hacking.js",
            enabled: true,
            priority: 80,
            dependencies: ["phase", "servers"],
            metadata: { category: "economy" }
        });
    }
    
    if (config.orchestrator.enableFactions) {
        registerModule("factions", {
            path: "/angel/modules/factions.js",
            enabled: true,
            priority: 75,
            dependencies: ["phase"],
            metadata: { category: "progression" }
        });
    }
    
    if (config.orchestrator.enableActivities) {
        registerModule("activities", {
            path: "/angel/modules/activities.js",
            enabled: true,
            priority: 70,
            dependencies: ["phase", "factions"],
            metadata: { category: "progression" }
        });
    }
    
    if (config.orchestrator.enableCrime) {
        registerModule("crime", {
            path: "/angel/modules/crime.js",
            enabled: true,
            priority: 65,
            dependencies: ["phase", "activities"],
            metadata: { category: "progression" }
        });
    }
    
    if (config.orchestrator.enableAugments) {
        registerModule("augments", {
            path: "/angel/modules/augments.js",
            enabled: true,
            priority: 60,
            dependencies: ["phase", "factions"],
            metadata: { category: "progression" }
        });
    }
    
    if (config.orchestrator.enableSleeves) {
        registerModule("sleeves", {
            path: "/angel/modules/sleeves.js",
            enabled: true,
            priority: 55,
            dependencies: ["phase"],
            optional: true,
            metadata: { category: "automation" }
        });
    }
    
    if (config.orchestrator.enableGang) {
        registerModule("gang", {
            path: "/angel/modules/gang.js",
            enabled: true,
            priority: 50,
            dependencies: ["phase"],
            optional: true,
            metadata: { category: "economy" }
        });
    }
    
    if (config.orchestrator.enableStocks) {
        registerModule("stocks", {
            path: "/angel/modules/stocks.js",
            enabled: true,
            priority: 45,
            dependencies: ["phase"],
            optional: true,
            metadata: { category: "economy" }
        });
    }
    
    if (config.orchestrator.enableBladeburner) {
        registerModule("bladeburner", {
            path: "/angel/modules/bladeburner.js",
            enabled: true,
            priority: 40,
            dependencies: ["phase"],
            optional: true,
            metadata: { category: "combat" }
        });
    }
    
    if (config.orchestrator.enableHacknet) {
        registerModule("hacknet", {
            path: "/angel/modules/hacknet.js",
            enabled: true,
            priority: 35,
            dependencies: ["phase"],
            optional: true,
            metadata: { category: "economy" }
        });
    }
    
    if (config.orchestrator.enableCorporation) {
        registerModule("corporation", {
            path: "/angel/modules/corporation.js",
            enabled: true,
            priority: 30,
            dependencies: ["phase"],
            optional: true,
            metadata: { category: "economy" }
        });
    }
    
    // UI and monitoring modules
    if (config.orchestrator.enableDashboard) {
        registerModule("dashboard", {
            path: "/angel/modules/dashboard.js",
            enabled: true,
            priority: 20,
            dependencies: ["phase"],
            optional: true,
            metadata: { category: "ui" }
        });
    }
    
    if (config.orchestrator.enableUILauncher) {
        registerModule("uiLauncher", {
            path: "/angel/modules/uiLauncher.js",
            enabled: true,
            priority: 15,
            dependencies: [],
            optional: true,
            metadata: { category: "ui" }
        });
    }
    
    if (config.orchestrator.enableNetworkMap) {
        registerModule("networkMap", {
            path: "/angel/modules/networkMap.js",
            enabled: true,
            priority: 10,
            dependencies: [],
            optional: true,
            metadata: { category: "ui" }
        });
    }
    
    // Utility modules
    if (config.orchestrator.enableContracts) {
        registerModule("contracts", {
            path: "/angel/modules/contracts.js",
            enabled: true,
            priority: 25,
            dependencies: [],
            optional: true,
            metadata: { category: "utility" }
        });
    }
    
    if (config.orchestrator.enableLoot) {
        registerModule("loot", {
            path: "/angel/modules/loot.js",
            enabled: true,
            priority: 5,
            dependencies: [],
            optional: true,
            metadata: { category: "utility" }
        });
    }
    
    if (config.orchestrator.enableFormulas) {
        registerModule("formulas", {
            path: "/angel/modules/formulas.js",
            enabled: true,
            priority: 5,
            dependencies: [],
            optional: true,
            metadata: { category: "utility" }
        });
    }
    
    if (config.orchestrator.enableXPFarm) {
        registerModule("xpFarm", {
            path: "/angel/modules/xpFarm.js",
            enabled: true,
            priority: 5,
            dependencies: [],
            optional: true,
            metadata: { category: "utility" }
        });
    }
    
    if (config.orchestrator.enableBackdoorAuto) {
        registerModule("backdoor", {
            path: "/angel/modules/backdoor.js",
            enabled: true,
            priority: 5,
            dependencies: [],
            optional: true,
            metadata: { category: "utility" }
        });
    }
}

/**
 * Clear the registry
 */
export function clearRegistry() {
    registry.clear();
}

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== Module Registry ===");
    ns.tprint("");
    
    // Initialize from config
    initializeFromConfig(ns);
    
    ns.tprint(`Registered ${registry.size} modules`);
    ns.tprint("");
    
    // Show modules by priority
    const byPriority = getModulesByPriority();
    ns.tprint("Modules (by priority):");
    for (const module of byPriority) {
        const running = isModuleRunning(ns, module.name);
        const status = running ? "RUNNING" : module.state;
        const deps = module.dependencies.length > 0 ? ` (deps: ${module.dependencies.join(", ")})` : "";
        ns.tprint(`  [${module.priority}] ${module.name}: ${status}${deps}`);
    }
    
    ns.tprint("");
    const health = getHealthSummary(ns);
    ns.tprint("Health Summary:");
    ns.tprint(`  Total: ${health.total}`);
    ns.tprint(`  Enabled: ${health.enabled}`);
    ns.tprint(`  Running: ${health.running}`);
    ns.tprint(`  Stopped: ${health.stopped}`);
    ns.tprint(`  Error: ${health.error}`);
    ns.tprint(`  Disabled: ${health.disabled}`);
    if (health.unhealthy.length > 0) {
        ns.tprint(`  Unhealthy: ${health.unhealthy.join(", ")}`);
    }
}
