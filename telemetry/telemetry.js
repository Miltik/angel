/**
 * ANGEL TELEMETRY - Performance Monitoring & Analytics
 * 
 * Tracks Angel's performance throughout entire BitNode runs for optimization.
 * Lightweight background monitoring with zero interference.
 * 
 * Usage:
 *   In modules: import { recordModuleMetric } from '/angel/telemetry/telemetry.js';
 *   Reports: run /angel/telemetry/report.js
 *   UI: Launched automatically by Angel orchestrator
 * 
 * @param {NS} ns
 */

// ============================================
// STORAGE KEYS
// ============================================

const STORAGE_KEYS = {
    CURRENT_RUN: 'angelTelemetryCurrentRun',
    RUN_HISTORY: 'angelTelemetryHistory',
    CONFIG: 'angelTelemetryConfig',
    EVENTS: 'angelTelemetryEvents',
};

// ============================================
// DEFAULT CONFIGURATION
// ============================================

const DEFAULT_CONFIG = {
    enabled: true,
    sampleIntervalMs: 60000,        // Sample every 60s
    aggregateIntervalMs: 300000,    // Aggregate every 5min
    maxHistoryRuns: 3,              // Keep last 3 runs
    detailedLogging: false,         // Verbose event capture
    maxEventsPerRun: 1000,          // Cap event storage
};

// ============================================
// MODULE METRIC RECORDER
// ============================================

/**
 * Create a telemetry recorder for a module
 * @param {NS} ns
 * @param {string} moduleName
 * @returns {Object} Telemetry recorder with log methods
 */
export function recordModuleMetric(ns, moduleName) {
    const startTime = Date.now();
    
    return {
        /**
         * Log a metric event
         * @param {string} eventType
         * @param {Object} data
         */
        log: (eventType, data = {}) => {
            try {
                logModuleEvent(ns, moduleName, eventType, data);
            } catch (e) {
                // Silently fail - never interrupt module operation
            }
        },
        
        /**
         * Record module execution completion
         * @param {boolean} success
         */
        complete: (success = true) => {
            try {
                const duration = Date.now() - startTime;
                recordModuleExecution(ns, moduleName, duration, success);
            } catch (e) {
                // Silently fail
            }
        },
        
        /**
         * Record a milestone
         * @param {string} milestone
         * @param {Object} data
         */
        milestone: (milestone, data = {}) => {
            try {
                recordMilestone(ns, moduleName, milestone, data);
            } catch (e) {
                // Silently fail
            }
        },
    };
}

// ============================================
// CORE TELEMETRY ENGINE
// ============================================

export async function main(ns) {
    ns.disableLog('ALL');
    
    const config = loadConfig();
    if (!config.enabled) {
        ns.print('Telemetry disabled');
        return;
    }
    
    initializeRun(ns);
    
    let lastSample = 0;
    let lastAggregate = 0;
    let lastBackendSync = 0;
    
    ns.print('🔍 Telemetry monitoring started');
    
    while (true) {
        const now = Date.now();
        
        try {
            // Sample metrics
            if (now - lastSample >= config.sampleIntervalMs) {
                sampleSystemMetrics(ns);
                lastSample = now;
            }
            
            // Aggregate data
            if (now - lastAggregate >= config.aggregateIntervalMs) {
                aggregateMetrics(ns);
                lastAggregate = now;
            }

            // Sync to backend (if enabled)
            if (now - lastBackendSync >= (config.telemetryIntervalMs || 10000)) {
                await syncToBackend(ns, config);
                lastBackendSync = now;
            }
            
        } catch (e) {
            ns.print(`⚠️ Telemetry error: ${e}`);
        }
        
        await ns.sleep(5000); // Check every 5s
    }
}

// ============================================
// INITIALIZATION
// ============================================

function initializeRun(ns) {
    const existing = loadCurrentRun();
    const resetInfo = ns.getResetInfo();
    const now = Date.now();
    
    // Check if this is a new run
    const lastAugReset = Number(resetInfo?.lastAugReset || now);
    const isNewRun = !existing || (existing.startTime < lastAugReset);
    
    if (isNewRun) {
        // Archive previous run
        if (existing && existing.startTime) {
            archiveRun(existing);
        }
        
        // Start new run
        const newRun = {
            startTime: now,
            lastUpdate: now,
            modules: {},
            samples: [],
            aggregates: [],
            events: [],
            milestones: [],
            startState: captureGameState(ns),
        };
        
        saveCurrentRun(newRun);
        ns.print('📊 New telemetry run initialized');
    }
}

function captureGameState(ns) {
    try {
        return {
            money: ns.getServerMoneyAvailable('home'),
            hackLevel: ns.getHackingLevel(),
            homeRam: ns.getServerMaxRam('home'),
            ownedAugs: ns.singularity?.getOwnedAugmentations?.(false)?.length || 0,
            installedAugs: ns.singularity?.getOwnedAugmentations?.(true)?.length || 0,
            karma: ns.heart?.break?.() || 0,
        };
    } catch (e) {
        return {};
    }
}

// ============================================
// METRIC COLLECTION
// ============================================

function logModuleEvent(ns, moduleName, eventType, data) {
    const run = loadCurrentRun();
    if (!run) return;
    
    const config = loadConfig();
    if (run.events.length >= config.maxEventsPerRun) {
        // Drop oldest events when limit reached
        run.events.shift();
    }
    
    run.events.push({
        time: Date.now(),
        module: moduleName,
        type: eventType,
        data: data,
    });
    
    saveCurrentRun(run);
}

function recordModuleExecution(ns, moduleName, duration, success) {
    const run = loadCurrentRun();
    if (!run) return;
    
    if (!run.modules[moduleName]) {
        run.modules[moduleName] = {
            executions: 0,
            failures: 0,
            totalDuration: 0,
            avgDuration: 0,
            lastRun: 0,
            firstRun: Date.now(),
        };
    }
    
    const mod = run.modules[moduleName];
    mod.executions++;
    if (!success) mod.failures++;
    mod.totalDuration += duration;
    mod.avgDuration = mod.totalDuration / mod.executions;
    mod.lastRun = Date.now();
    
    saveCurrentRun(run);
}

function recordMilestone(ns, moduleName, milestone, data) {
    const run = loadCurrentRun();
    if (!run) return;
    
    run.milestones.push({
        time: Date.now(),
        module: moduleName,
        milestone: milestone,
        data: data,
    });
    
    saveCurrentRun(run);
}

function sampleSystemMetrics(ns) {
    const run = loadCurrentRun();
    if (!run) return;
    
    const sample = {
        time: Date.now(),
        money: ns.getServerMoneyAvailable('home'),
        hackLevel: ns.getHackingLevel(),
        homeRam: ns.getServerMaxRam('home'),
        usedRam: ns.getServerUsedRam('home'),
        scriptCount: ns.ps('home').length,
    };
    
    // Try to get additional Singularity data
    try {
        sample.ownedAugs = ns.singularity?.getOwnedAugmentations?.(false)?.length || 0;
        sample.karma = Math.abs(ns.heart?.break?.() || 0);
    } catch (e) {
        // SF4/SF2 not available
    }
    
    run.samples.push(sample);
    run.lastUpdate = Date.now();
    
    // Keep last 1000 samples max
    if (run.samples.length > 1000) {
        run.samples.shift();
    }
    
    saveCurrentRun(run);
}

function aggregateMetrics(ns) {
    const run = loadCurrentRun();
    if (!run || run.samples.length === 0) return;
    
    const recentSamples = run.samples.slice(-5); // Last 5 minutes
    const firstSample = recentSamples[0];
    const lastSample = recentSamples[recentSamples.length - 1];
    
    if (!firstSample || !lastSample) return;
    
    const timeDiff = (lastSample.time - firstSample.time) / 1000; // seconds
    
    const aggregate = {
        time: Date.now(),
        moneyRate: timeDiff > 0 ? (lastSample.money - firstSample.money) / timeDiff : 0,
        xpRate: timeDiff > 0 ? (lastSample.hackLevel - firstSample.hackLevel) / timeDiff : 0,
        avgRamUsage: recentSamples.reduce((sum, s) => sum + s.usedRam, 0) / recentSamples.length,
        avgScriptCount: recentSamples.reduce((sum, s) => sum + s.scriptCount, 0) / recentSamples.length,
    };
    
    run.aggregates.push(aggregate);
    
    // Keep last 100 aggregates max
    if (run.aggregates.length > 100) {
        run.aggregates.shift();
    }
    
    saveCurrentRun(run);
}

// ============================================
// STORAGE MANAGEMENT
// ============================================

function loadConfig() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CONFIG);
        return stored ? JSON.parse(stored) : DEFAULT_CONFIG;
    } catch (e) {
        return DEFAULT_CONFIG;
    }
}

export function saveConfig(config) {
    try {
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
    } catch (e) {
        // Ignore
    }
}

function loadCurrentRun() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_RUN);
        return stored ? JSON.parse(stored) : null;
    } catch (e) {
        return null;
    }
}

function saveCurrentRun(run) {
    try {
        localStorage.setItem(STORAGE_KEYS.CURRENT_RUN, JSON.stringify(run));
    } catch (e) {
        // Ignore
    }
}

export function getCurrentRun() {
    return loadCurrentRun();
}

function archiveRun(run) {
    try {
        const history = loadHistory();
        const config = loadConfig();
        
        // Add end state
        run.endTime = Date.now();
        run.duration = run.endTime - run.startTime;
        
        history.push(run);
        
        // Keep only maxHistoryRuns
        while (history.length > config.maxHistoryRuns) {
            history.shift();
        }
        
        localStorage.setItem(STORAGE_KEYS.RUN_HISTORY, JSON.stringify(history));
    } catch (e) {
        // Ignore
    }
}

function loadHistory() {
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.RUN_HISTORY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

export function getRunHistory() {
    return loadHistory();
}

// ============================================
// ANALYTICS FUNCTIONS
// ============================================

/**
 * Calculate statistics for current run
 * @returns {Object} Statistics object
 */
export function calculateRunStats() {
    const run = loadCurrentRun();
    if (!run) return null;
    
    const now = Date.now();
    const duration = now - run.startTime;
    
    const stats = {
        duration: duration,
        startTime: run.startTime,
        lastUpdate: run.lastUpdate,
        
        // Module stats
        moduleCount: Object.keys(run.modules).length,
        totalExecutions: 0,
        totalFailures: 0,
        avgExecutionTime: 0,
        
        // Performance
        currentMoney: 0,
        currentHackLevel: 0,
        moneyRate: 0,
        xpRate: 0,
        
        // Progress
        milestoneCount: run.milestones.length,
        eventCount: run.events.length,
        
        // Top performers
        topModules: [],
        bottlenecks: [],
    };
    
    // Calculate module stats
    let totalDuration = 0;
    const modulePerf = [];
    
    for (const [name, mod] of Object.entries(run.modules)) {
        stats.totalExecutions += mod.executions;
        stats.totalFailures += mod.failures;
        totalDuration += mod.totalDuration;
        
        modulePerf.push({
            name: name,
            executions: mod.executions,
            failures: mod.failures,
            avgDuration: mod.avgDuration,
            successRate: mod.executions > 0 ? ((mod.executions - mod.failures) / mod.executions) * 100 : 0,
            uptime: calculateModuleUptime(mod, duration),
        });
    }
    
    stats.avgExecutionTime = stats.totalExecutions > 0 ? totalDuration / stats.totalExecutions : 0;
    
    // Sort modules by performance
    modulePerf.sort((a, b) => b.executions - a.executions);
    stats.topModules = modulePerf.slice(0, 5);
    
    // Identify bottlenecks (modules with high failure rate or low uptime)
    stats.bottlenecks = modulePerf.filter(m => m.failures > 3 || m.uptime < 50);
    
    // Get latest sample data
    if (run.samples.length > 0) {
        const latest = run.samples[run.samples.length - 1];
        stats.currentMoney = latest.money;
        stats.currentHackLevel = latest.hackLevel;
    }
    
    // Get latest aggregate data
    if (run.aggregates.length > 0) {
        const latest = run.aggregates[run.aggregates.length - 1];
        stats.moneyRate = latest.moneyRate;
        stats.xpRate = latest.xpRate;
    }
    
    return stats;
}

function calculateModuleUptime(mod, totalDuration) {
    const avgInterval = 60000; // Assume 60s average between runs
    const expectedRuns = totalDuration / avgInterval;
    const actualRuns = mod.executions;
    
    return expectedRuns > 0 ? Math.min(100, (actualRuns / expectedRuns) * 100) : 0;
}

/**
 * Detect performance bottlenecks
 * @returns {Array} Array of bottleneck descriptions
 */
export function detectBottlenecks() {
    const run = loadCurrentRun();
    if (!run) return [];
    
    const bottlenecks = [];
    
    // Check for high failure rates
    for (const [name, mod] of Object.entries(run.modules)) {
        const failureRate = mod.executions > 0 ? (mod.failures / mod.executions) * 100 : 0;
        if (failureRate > 10 && mod.executions > 5) {
            bottlenecks.push({
                type: 'high_failure_rate',
                module: name,
                severity: 'high',
                description: `${name} has ${failureRate.toFixed(1)}% failure rate`,
                suggestion: `Check ${name} logs for errors`,
            });
        }
    }
    
    // Check for RAM starvation
    if (run.samples.length > 10) {
        const recentSamples = run.samples.slice(-10);
        const avgUsage = recentSamples.reduce((sum, s) => sum + (s.usedRam / s.homeRam) * 100, 0) / recentSamples.length;
        
        if (avgUsage > 95) {
            bottlenecks.push({
                type: 'ram_starvation',
                module: 'system',
                severity: 'medium',
                description: `Home RAM usage at ${avgUsage.toFixed(1)}%`,
                suggestion: 'Consider upgrading home RAM or reducing worker threads',
            });
        }
    }
    
    return bottlenecks;
}

/**
 * Generate optimization suggestions
 * @returns {Array} Array of suggestion objects
 */
export function generateSuggestions() {
    const stats = calculateRunStats();
    if (!stats) return [];
    
    const suggestions = [];
    
    // Suggest interval adjustments for high-frequency modules
    for (const mod of stats.topModules) {
        if (mod.executions > 100 && mod.avgDuration < 1000) {
            suggestions.push({
                module: mod.name,
                type: 'interval_adjustment',
                description: `${mod.name} runs very frequently with short duration`,
                suggestion: `Consider increasing ${mod.name} interval to reduce CPU overhead`,
                impact: 'low',
            });
        }
    }
    
    // Suggest priority adjustments for low-uptime modules
    for (const mod of stats.bottlenecks) {
        if (mod.uptime < 50) {
            suggestions.push({
                module: mod.name,
                type: 'priority_increase',
                description: `${mod.name} only active ${mod.uptime.toFixed(1)}% of time`,
                suggestion: `Consider increasing ${mod.name} priority or reducing interval`,
                impact: 'medium',
            });
        }
    }
    
    return suggestions;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

export function formatMoney(num) {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}k`;
    return `$${num.toFixed(2)}`;
}
// ============================================
// REMOTE BACKEND SYNC
// ============================================

async function syncToBackend(ns, telemetryConfig) {
    try {
        // Load remote backend config from main config
        let backendConfig = {};
        try {
            // Read config.js as text and extract backend settings
            const configContent = ns.read('/angel/config.js');
            
            // Extract remoteBackend config using regex
            const backendMatch = configContent.match(/remoteBackend:\s*{([^}]+{[^}]+}[^}]*)*[^}]*}/);
            const enabledMatch = configContent.match(/enabled:\s*(true|false)/);
            const urlMatch = configContent.match(/url:\s*"([^"]+)"/);
            const intervalMatch = configContent.match(/telemetryIntervalMs:\s*(\d+)/);
            
            backendConfig.enabled = enabledMatch ? enabledMatch[1] === 'true' : false;
            backendConfig.url = urlMatch ? urlMatch[1] : 'http://localhost:3000';
            backendConfig.telemetryIntervalMs = intervalMatch ? parseInt(intervalMatch[1]) : 10000;
            backendConfig.enableLogging = true;
            
            ns.print(`✅ Loaded backend config: enabled=${backendConfig.enabled}, url=${backendConfig.url}`);
        } catch (e) {
            ns.print(`❌ Config read failed: ${e.message}`);
            return;
        }

        if (!backendConfig.enabled) {
            ns.print(`⚠️ Backend sync disabled in config`);
            return;
        }

        const backendUrl = backendConfig.url || 'http://localhost:3000';
        const run = loadCurrentRun();
        if (!run) {
            ns.print(`⚠️ No current run data to sync`);
            return;
        }

        ns.print(`🔄 Syncing to backend: ${backendUrl}`);
        
        // Prepare telemetry payload with enhanced metrics
        const homeServer = ns.getServer('home');
        const usedRam = ns.getServerUsedRam('home');
        const maxRam = ns.getServerMaxRam('home');
        const moneyEarned = ns.getServerMoneyAvailable('home');
        const totalXp = ns.getTotalScriptExpGain();
        const hackLevel = ns.getHackingLevel();
        
        // Calculate active workers (rough estimate based on running scripts)
        let activeWorkers = 0;
        const serverList = ns.scan('home');
        
        // Get module counts
        const moduleCount = Object.keys(run.modules || {}).length;
        const activeModules = Object.entries(run.modules || {})
            .filter(([_, m]) => m.active)
            .map(([name, _]) => name);
        
        // Calculate additional metrics
        const ramUsagePercent = maxRam > 0 ? (usedRam / maxRam) * 100 : 0;
        const totalModuleExecutions = Object.values(run.modules || {}).reduce((sum, m) => sum + (m.executions || 0), 0);
        const totalModuleFailures = Object.values(run.modules || {}).reduce((sum, m) => sum + (m.failures || 0), 0);
        const moduleSuccessRate = totalModuleExecutions > 0 
            ? ((totalModuleExecutions - totalModuleFailures) / totalModuleExecutions * 100)
            : 0;
        
        const payload = {
            runId: run.startTime,
            timestamp: Date.now(),
            modules: run.modules,
            stats: {
                uptime: Date.now() - run.startTime,
                totalExecutions: totalModuleExecutions,
                totalFailures: totalModuleFailures,
                successRate: moduleSuccessRate,
                moneyRate: run.aggregates?.length > 0 ? run.aggregates[run.aggregates.length - 1].moneyRate : 0,
                xpRate: run.aggregates?.length > 0 ? run.aggregates[run.aggregates.length - 1].xpRate : 0,
            },
            memory: {
                used: usedRam,
                total: maxRam,
                usagePercent: ramUsagePercent,
            },
            money: moneyEarned,
            xp: totalXp,
            hackLevel: hackLevel,
            // New detailed metrics
            server: {
                cores: homeServer?.cpuCores || 1,
                hostname: 'home',
                type: 'home',
            },
            modules: {
                count: moduleCount,
                active: activeModules,
                activeCount: activeModules.length,
            },
            skills: {
                hack: hackLevel,
                hacking_exp: totalXp,
            },
            workers: {
                estimated: activeWorkers || moduleCount,
            },
        };

        // Send to backend
        ns.print(`📤 POST to ${backendUrl}/api/telemetry with ${Object.keys(payload.modules).length} modules`);
        const response = await fetch(`${backendUrl}/api/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        ns.print(`📨 Response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const text = await response.text();
            ns.print(`❌ Backend error: ${response.status} - ${text.substring(0, 100)}`);
            return;
        }

        if (backendConfig.enableLogging) {
            ns.print(`📡 Telemetry synced to backend`);
        }
    } catch (error) {
        // Log backend sync errors for debugging
        ns.print(`❌ Backend sync error: ${error.message}`);
    }
}