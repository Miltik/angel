/**
 * ANGEL Backend - API Routes
 * Handles telemetry ingestion, status, commands
 */

import { query, queryOne, run } from './db.js';
import { broadcastTelemetry } from './websocket.js';

// Track daemon unlock status for in-game port communication
let daemonUnlockSignal = null;

export function setupApiRoutes(app) {
    // ============================================
    // TELEMETRY ENDPOINT - Game sends data here
    // ============================================
    app.post('/api/telemetry', async (req, res) => {
        try {
            const {
                runId,
                timestamp,
                modules,
                stats,
                memory,
                money,
                xp,
                hackLevel
            } = req.body;

            const finalTimestamp = timestamp || Date.now();
            let samplesInserted = 0;
            
            // Log incoming telemetry
            const moduleCount = modules ? Object.keys(modules).length : 0;
            console.log(`📡 Telemetry POST: ${moduleCount} modules, timestamp=${finalTimestamp}`);
            if (modules && moduleCount > 0) {
                console.log(`   Modules: ${Object.keys(modules).join(', ')}`);
            }

            // If modules exist, store each module
            if (modules && Object.keys(modules).length > 0) {
                for (const module of Object.entries(modules)) {
                    const [moduleName, data] = module;
                    
                    // Determine module status: running, idle, or offline
                    let moduleStatus = 'idle';
                    if (data?.active) {
                        moduleStatus = 'running';
                    } else if (data?.lastRun && Date.now() - data.lastRun < 60000) {
                        // Recently active (within last minute)
                        moduleStatus = 'idle';
                    } else {
                        moduleStatus = 'offline';
                    }
                    
                    // For active modules, capture their money/xp rates if available
                    let moduleMoneyRate = 0;
                    let moduleXpRate = 0;
                    if (moduleStatus === 'running') {
                        // Try to extract module-specific rates if stored in raw data
                        try {
                            if (data?.moneyRate) moduleMoneyRate = data.moneyRate;
                            if (data?.xpRate) moduleXpRate = data.xpRate;
                        } catch (e) {
                            // Use default rates
                        }
                    }
                    
                    const enrichedRawData = {
                        ...(data && typeof data === 'object' ? data : {}),
                        __telemetry: {
                            memoryTotal: Number(memory?.total || 0),
                            memoryUsagePercent: Number(memory?.usagePercent || 0),
                            runMeta: req.body?.runMeta || null,
                        },
                    };

                    await run(
                        `INSERT INTO telemetry_samples 
                        (timestamp, run_id, module_name, memory_used, money_rate, xp_rate, 
                         hack_level, current_money, uptime, module_status, 
                         execution_count, failure_count, avg_execution_time, raw_data)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                        [
                            finalTimestamp,
                            runId || 'unknown',
                            moduleName,
                            memory?.used || 0,
                            moduleMoneyRate || 0,
                            moduleXpRate || 0,
                            hackLevel || 0,
                            money || '0',
                            stats?.uptime || 0,
                            moduleStatus,
                            data?.successfulHacks ?? data?.executions ?? 0,
                            data?.failures || 0,
                            data?.avgDuration || 0,
                            JSON.stringify(enrichedRawData)
                        ]
                    );
                    samplesInserted++;
                }
            } else {
                // Store overall stats even without modules
                await run(
                    `INSERT INTO telemetry_samples 
                    (timestamp, run_id, module_name, memory_used, money_rate, xp_rate, 
                     hack_level, current_money, uptime, module_status, raw_data)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        finalTimestamp,
                        runId || 'unknown',
                        'SYSTEM',
                        memory?.used || 0,
                        stats?.moneyRate || 0,
                        stats?.xpRate || 0,
                        hackLevel || 0,
                        money || '0',
                        stats?.uptime || 0,
                        'active',
                        JSON.stringify({ stats, memory, money, xp, hackLevel, runMeta: req.body?.runMeta || null })
                    ]
                );
                samplesInserted = 1;
            }

            // Broadcast to WebSocket clients
            broadcastTelemetry({
                timestamp: finalTimestamp,
                runId: runId || 'unknown',
                stats,
                memory,
                money,
                xp,
                hackLevel,
                samplesInserted
            });

            res.json({ 
                success: true, 
                message: 'Telemetry recorded',
                samplesReceived: samplesInserted
            });
        } catch (error) {
            console.error('Telemetry POST error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================
    // STATUS ENDPOINT - Get current game state with dashboard data
    // OPTIMIZED: Reduced from 5+ queries to 2 main queries
    // ============================================
    app.get('/api/status', async (req, res) => {
        let memoryTotal = 0;
        let targetAngelLiteRam = 64;
        
        try {
            const oneHourAgo = Date.now() - (60 * 60 * 1000);

            // OPTIMIZED Query 1: Get all recent samples with module breakdown in one go
            const recentSamples = await query(
                `SELECT * FROM telemetry_samples 
                 ORDER BY timestamp DESC LIMIT 100`
            );

            // OPTIMIZED Query 2: Get module-specific latest data (phase, augments, activities)
            const latestByModule = await query(
                `SELECT module_name, raw_data, timestamp FROM telemetry_samples
                 WHERE module_name IN ('phase', 'augments', 'activities')
                 ORDER BY timestamp DESC
                 LIMIT 300`
            );

            // Parse single requests into a lookup map
            const moduleDataMap = {};
            latestByModule.forEach(row => {
                if (moduleDataMap[row.module_name]) {
                    return;
                }
                try {
                    moduleDataMap[row.module_name] = row.raw_data ? JSON.parse(row.raw_data) : {};
                } catch (e) {
                    moduleDataMap[row.module_name] = {};
                }
            });

            const latest = recentSamples[0] || {};
            const latestRaw = latest?.raw_data ? (() => { try { return JSON.parse(latest.raw_data); } catch { return {}; } })() : {};
            
            // Build module stats from recentSamples (no extra query needed)
            const moduleStats = {};
            recentSamples.forEach(sample => {
                if (!moduleStats[sample.module_name]) {
                    moduleStats[sample.module_name] = {
                        sample_count: 0,
                        avg_memory: 0,
                        avg_money_rate: 0,
                        avg_xp_rate: 0,
                        total_executions: 0,
                        total_failures: 0
                    };
                }
                moduleStats[sample.module_name].sample_count++;
                moduleStats[sample.module_name].avg_memory += (sample.memory_used || 0);
                moduleStats[sample.module_name].avg_money_rate += (sample.money_rate || 0);
                moduleStats[sample.module_name].avg_xp_rate += (sample.xp_rate || 0);
                moduleStats[sample.module_name].total_executions = Math.max(
                    moduleStats[sample.module_name].total_executions,
                    sample.execution_count || 0
                );
                moduleStats[sample.module_name].total_failures = Math.max(
                    moduleStats[sample.module_name].total_failures,
                    sample.failure_count || 0
                );
            });
            
            // Average the sums
            Object.values(moduleStats).forEach(stat => {
                if (stat.sample_count > 0) {
                    stat.avg_memory = stat.avg_memory / stat.sample_count;
                    stat.avg_money_rate = stat.avg_money_rate / stat.sample_count;
                    stat.avg_xp_rate = stat.avg_xp_rate / stat.sample_count;
                }
            });

            // Get pending commands count
            const pendingCount = await queryOne(
                `SELECT COUNT(*) as count FROM commands WHERE status = 'pending'`
            );

            const phaseRaw = moduleDataMap['phase'] || {};
            const augmentsRaw = moduleDataMap['augments'] || {};
            const activitiesRaw = moduleDataMap['activities'] || {};

            const runStartFromRunId = Number(latest?.run_id);
            const metaRun = latestRaw?.__telemetry?.runMeta || latestRaw?.runMeta || {};
            const runStartedAt = Number(metaRun.startedAt || runStartFromRunId || 0) || null;
            const timeSinceLastResetMs = runStartedAt ? Math.max(0, Date.now() - runStartedAt) : null;
            const lastResetHackLevel = Number.isFinite(Number(metaRun.lastResetHackLevel))
                ? Number(metaRun.lastResetHackLevel)
                : null;
            const lastResetMoney = Number.isFinite(Number(metaRun.lastResetMoney))
                ? Number(metaRun.lastResetMoney)
                : null;
            memoryTotal = Number(latestRaw?.__telemetry?.memoryTotal || 0);
            const startedWithInstalledAugs = Number.isFinite(Number(metaRun.startedWithInstalledAugs))
                ? Number(metaRun.startedWithInstalledAugs)
                : null;
            const currentPhase = Number.isFinite(Number(phaseRaw?.phase))
                ? Number(phaseRaw.phase)
                : null;

            // Use already-fetched recentSamples for session money calculation
            const sessionMoneyStart = recentSamples.length > 0 ? Number(recentSamples[recentSamples.length - 1].current_money || 0) : 0;
            const currentMoney = Number(latest?.current_money || 0);
            const sessionMoneyGain = Math.max(0, currentMoney - sessionMoneyStart);
            
            // Calculate aggregates from already-fetched recentSamples
            const totalSamples = recentSamples.length;
            const avgMemory = recentSamples.length > 0
                ? recentSamples.reduce((sum, s) => sum + (s.memory_used || 0), 0) / recentSamples.length
                : 0;
            const avgMoneyRate = recentSamples.length > 0
                ? recentSamples.reduce((sum, s) => sum + (s.money_rate || 0), 0) / recentSamples.length
                : 0;
            const avgXpRate = recentSamples.length > 0
                ? recentSamples.reduce((sum, s) => sum + (s.xp_rate || 0), 0) / recentSamples.length
                : 0;

            const moduleSummary = Object.entries(moduleStats)
                .map(([moduleName, stats]) => ({ moduleName, ...stats }))
                .sort((a, b) => b.sample_count - a.sample_count)
                .slice(0, 10);

            res.json({
                status: 'ok',
                timestamp: Date.now(),
                lastUpdate: latest?.timestamp || null,
                
                // Current state
                current: {
                    memory: latest?.memory_used || 0,
                    money: latest?.current_money || 0,
                    hackLevel: latest?.hack_level || 0,
                    xpGain: latest?.hack_level || 0,
                    uptime: latest?.uptime || 0,
                    moduleStatus: latest?.module_status || 'unknown',
                },
                
                // Aggregated metrics
                metrics: {
                    totalSamples,
                    avgMemory,
                    avgMoneyRate,
                    avgXpRate,
                    successRate: latest?.failure_count > 0 
                        ? ((latest?.execution_count - latest?.failure_count) / latest?.execution_count * 100)
                        : 100,
                },

                overview: {
                    reset: {
                        runStartedAt,
                        timeSinceResetMs: runStartedAt ? Math.max(0, Date.now() - runStartedAt) : null,
                        timeSinceLastResetMs,
                        installedAtReset: startedWithInstalledAugs,
                        installedNow: Number.isFinite(Number(augmentsRaw?.installed)) ? Number(augmentsRaw.installed) : null,
                        lastResetHackLevel,
                        lastResetMoney,
                        sessionMoneyGain,
                        lastResetTotalAugCost: Number.isFinite(Number(augmentsRaw?.resetMetadata?.totalAugmentsCost)) ? Number(augmentsRaw.resetMetadata.totalAugmentsCost) : null,
                        lastResetTotalAugRep: Number.isFinite(Number(augmentsRaw?.resetMetadata?.totalAugmentsReputation)) ? Number(augmentsRaw.resetMetadata.totalAugmentsReputation) : null,
                    },
                    phase: {
                        current: currentPhase,
                        max: 4,
                        percent: currentPhase === null ? null : Math.max(0, Math.min(100, (currentPhase / 4) * 100)),
                    },
                    angelLite: {
                        currentRam: memoryTotal || null,
                        targetRam: targetAngelLiteRam,
                        percent: memoryTotal > 0
                            ? Math.min(100, Math.max(0, (memoryTotal / targetAngelLiteRam) * 100))
                            : null,
                    },
                },
                
                // Module breakdown
                modules: moduleSummary,
                
                // Raw data
                latestData: latest,
                recentSamples: recentSamples.slice(0, 5),
                
                pendingCommands: Number(pendingCount?.count || 0),
            });
        } catch (error) {
            console.error('Status GET error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================
    // MODULES ENDPOINT - Detailed per-module stats
    // ============================================
    app.get('/api/modules', async (req, res) => {
        try {
            const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            const INCOME_MODULES = ['hacking', 'hacknet', 'gang', 'stocks', 'corporation'];

            // All known modules in the system
            const KNOWN_MODULES = [
                'activities', 'augments', 'backdoor', 'bladeburner',
                'contracts', 'corporation', 'crime', 'factions', 'formulas', 'gang', 'hacking', 'hacknet',
                'loot', 'programs', 'servers', 'sleeves', 'stocks',
                'xpFarm', 'phase'
            ];

            // Pull bounded recent rows and derive latest per module in JS for speed/reliability
            const recentModuleRows = await query(`
                SELECT 
                    module_name,
                    timestamp,
                    memory_used,
                    money_rate,
                    xp_rate,
                    hack_level,
                    module_status,
                    execution_count,
                    failure_count,
                    avg_execution_time,
                    raw_data,
                    uptime
                FROM telemetry_samples
                WHERE module_name != 'SYSTEM'
                AND timestamp > ?
                ORDER BY timestamp DESC
                LIMIT 5000
            `, [tenMinutesAgo]);

            const moduleStatsMap = new Map();
            recentModuleRows.forEach((row) => {
                if (!moduleStatsMap.has(row.module_name)) {
                    moduleStatsMap.set(row.module_name, row);
                }
            });
            const moduleStats = Array.from(moduleStatsMap.values());

            // Get aggregate stats per module (last hour)
            const aggregates = await query(`
                SELECT 
                    module_name,
                    COUNT(*) as sample_count,
                    AVG(memory_used) as avg_memory,
                    AVG(money_rate) as avg_money_rate,
                    AVG(xp_rate) as avg_xp_rate,
                    MAX(execution_count) as total_executions,
                    MAX(failure_count) as total_failures,
                    AVG(avg_execution_time) as avg_exec_time
                FROM telemetry_samples
                WHERE module_name != 'SYSTEM'
                AND timestamp > ?
                GROUP BY module_name
                ORDER BY total_executions DESC
            `, [oneHourAgo]);

            // Create a map of module data
            const dataMap = {};
            
            moduleStats.forEach(mod => {
                const agg = aggregates.find(a => a.module_name === mod.module_name) || {};
                const moduleStatus = mod.module_status || 'inactive';
                let details = {};
                try {
                    details = mod.raw_data ? JSON.parse(mod.raw_data) : {};
                } catch {
                    details = {};
                }

                if (mod.module_name === 'phase') {
                    details = {
                        ...details,
                        phase: Number.isFinite(Number(details.phase)) ? Number(details.phase) : null,
                        hackLevel: Number(details.hackLevel || 0),
                        money: Number(details.money || 0),
                        minCombat: Number(details.minCombat || 0),
                    };
                }

                if (mod.module_name === 'activities') {
                    const activityKey = String(details.currentActivity || 'idle');
                    const parts = activityKey.split('-');
                    const parsedType = String(parts[0] || 'idle').toLowerCase();
                    const parsedTarget = parts.slice(1).join('-') || 'none';

                    details = {
                        ...details,
                        phase: details.phase ?? null,
                        plannedActivity: details.plannedActivity || (parsedType !== 'idle' ? parsedType : 'none'),
                        liveWorkType: details.liveWorkType || parsedType,
                        liveTarget: details.liveTarget || parsedTarget,
                        factionFocus: details.factionFocus || (parsedType === 'faction' ? parsedTarget : 'none'),
                        factionRepNeeded: details.factionRepNeeded !== undefined && details.factionRepNeeded !== null
                            ? Number(details.factionRepNeeded)
                            : null,
                        bestCrime: details.bestCrime || 'n/a',
                        bestCrimeChance: details.bestCrimeChance !== undefined && details.bestCrimeChance !== null
                            ? Number(details.bestCrimeChance)
                            : null,
                        combatGap: details.combatGap ?? null,
                        hackingGap: details.hackingGap ?? null,
                    };
                }
                
                // Module is considered "active" if status is running or idle
                const isActive = moduleStatus === 'running' || moduleStatus === 'idle';

                const isIncomeModule = INCOME_MODULES.includes(mod.module_name);
                const displayMoneyRate = isIncomeModule ? Number(mod.money_rate || 0) : 0;
                const estimatedSessionTotal = isIncomeModule
                    ? Number((agg.avg_money_rate || 0) * 3600)
                    : 0;
                
                dataMap[mod.module_name] = {
                    name: mod.module_name,
                    status: moduleStatus,
                    isActive: isActive,
                    current: {
                        memory: mod.memory_used || 0,
                        moneyRate: displayMoneyRate,
                        xpRate: mod.xp_rate || 0,
                        executions: mod.execution_count || details.successfulHacks || 0,
                        failures: mod.failure_count || 0,
                        avgExecTime: mod.avg_execution_time || 0,
                    },
                    aggregate: {
                        samples: agg.sample_count || 0,
                        avgMemory: agg.avg_memory || 0,
                        avgMoneyRate: isIncomeModule ? agg.avg_money_rate || 0 : 0,
                        avgXpRate: agg.avg_xp_rate || 0,
                        totalExecutions: agg.total_executions || 0,
                        totalFailures: agg.total_failures || 0,
                        avgExecTime: agg.avg_exec_time || 0,
                    },
                    successRate: agg.total_executions > 0 
                        ? ((agg.total_executions - agg.total_failures) / agg.total_executions * 100)
                        : 100,
                    details,
                    income: {
                        show: isIncomeModule,
                        perSecond: displayMoneyRate,
                        sessionTotal: estimatedSessionTotal,
                    },
                    lastUpdate: mod.timestamp
                };
            });

            // Build complete module list with all known modules
            const enriched = KNOWN_MODULES.map(moduleName => {
                if (dataMap[moduleName]) {
                    return dataMap[moduleName];
                } else {
                    // Return placeholder for modules without data
                    return {
                        name: moduleName,
                        status: 'offline',
                        isActive: false,
                        current: {
                            memory: 0,
                            moneyRate: 0,
                            xpRate: 0,
                            executions: 0,
                            failures: 0,
                            avgExecTime: 0,
                        },
                        aggregate: {
                            samples: 0,
                            avgMemory: 0,
                            avgMoneyRate: 0,
                            avgXpRate: 0,
                            totalExecutions: 0,
                            totalFailures: 0,
                            avgExecTime: 0,
                        },
                        successRate: 100,
                        details: {},
                        income: {
                            show: INCOME_MODULES.includes(moduleName),
                            perSecond: 0,
                            sessionTotal: 0,
                        },
                        lastUpdate: null
                    };
                }
            });

            // Sort alphabetically for stable UI (no jumping around)
            enriched.sort((a, b) => a.name.localeCompare(b.name));

            res.json({
                success: true,
                count: enriched.length,
                modules: enriched,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Modules GET error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================
    // COMMANDS ENDPOINT - Queue a command
    // ============================================
    app.post('/api/commands', async (req, res) => {
        try {
            const { commandType, parameters } = req.body;

            if (!commandType) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'commandType required' 
                });
            }

            const result = await run(
                `INSERT INTO commands (command_type, parameters, status)
                 VALUES (?, ?, 'pending')`,
                [commandType, JSON.stringify(parameters || {})]
            );

            res.json({
                success: true,
                message: 'Command queued',
                commandId: result.lastID
            });
        } catch (error) {
            console.error('Commands POST error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================
    // GET COMMANDS - Game polls for commands
    // ============================================
    app.get('/api/commands', async (req, res) => {
        try {
            const commands = await query(
                `SELECT * FROM commands WHERE status = 'pending' 
                 ORDER BY created_at ASC LIMIT 10`
            );

            res.json({
                success: true,
                commands: commands.map(cmd => ({
                    id: cmd.id,
                    type: cmd.command_type,
                    parameters: JSON.parse(cmd.parameters || '{}')
                })),
                count: commands.length
            });
        } catch (error) {
            console.error('Commands GET error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================
    // MARK COMMAND AS EXECUTED
    // ============================================
    app.patch('/api/commands/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { status, result } = req.body;

            await run(
                `UPDATE commands 
                 SET status = ?, result = ?, executed_at = CURRENT_TIMESTAMP
                 WHERE id = ?`,
                [status || 'executed', JSON.stringify(result || {}), id]
            );

            res.json({ success: true, message: 'Command updated' });
        } catch (error) {
            console.error('Command PATCH error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================
    // HISTORY ENDPOINT - Get telemetry history
    // ============================================
    app.get('/api/history', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 100;
            const module = req.query.module || null;

            let sql = `SELECT * FROM telemetry_samples`;
            let params = [];

            if (module) {
                sql += ` WHERE module_name = ?`;
                params.push(module);
            }

            sql += ` ORDER BY timestamp DESC LIMIT ?`;
            params.push(limit);

            const history = await query(sql, params);

            res.json({
                success: true,
                count: history.length,
                data: history
            });
        } catch (error) {
            console.error('History GET error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================
    // SUMMARY STATS - Aggregated metrics
    // ============================================
    app.get('/api/stats', async (req, res) => {
        try {
            const stats = await queryOne(`
                SELECT 
                    COUNT(*) as total_samples,
                    COUNT(DISTINCT module_name) as unique_modules,
                    AVG(money_rate) as avg_money_rate,
                    MAX(money_rate) as peak_money_rate,
                    AVG(xp_rate) as avg_xp_rate,
                    SUM(CASE WHEN failure_count > 0 THEN 1 ELSE 0 END) as modules_with_failures
                FROM telemetry_samples
                WHERE timestamp > ?
            `, [Date.now() - (7 * 24 * 60 * 60 * 1000)]); // Last 7 days

            res.json({
                success: true,
                stats
            });
        } catch (error) {
            console.error('Stats GET error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================
    // DAEMON ADVANCEMENT CONTROL
    // ============================================
    app.post('/api/daemon-unlock', (req, res) => {
        try {
            daemonUnlockSignal = Date.now();
            console.log('🔓 Daemon unlock signal received from Discord');
            res.json({
                success: true,
                message: 'Daemon advancement unlocked',
                timestamp: daemonUnlockSignal
            });
        } catch (error) {
            console.error('Daemon unlock error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/daemon-unlock-status', (req, res) => {
        try {
            const hasUnlock = daemonUnlockSignal !== null;
            const response = {
                success: true,
                unlocked: hasUnlock,
                signal: daemonUnlockSignal
            };
            
            if (hasUnlock) {
                // Clear the signal after retrieval
                daemonUnlockSignal = null;
            }
            
            res.json(response);
        } catch (error) {
            console.error('Daemon unlock status error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================
    // ADMIN ENDPOINTS - Service control
    // ============================================
    app.post('/api/admin/stop', (req, res) => {
        try {
            console.log('🛑 Backend stop requested');
            res.json({ success: true, message: 'Backend stopping...' });
            
            // Give response time to send, then exit gracefully
            setTimeout(() => {
                console.log('Exiting...');
                process.exit(0);
            }, 500);
        } catch (error) {
            console.error('Admin stop error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/admin/restart', (req, res) => {
        try {
            console.log('🔄 Backend restart requested');
            res.json({ success: true, message: 'Backend restarting...' });
            
            // Give response time to send, then restart
            setTimeout(() => {
                console.log('Restarting...');
                process.exit(0);
            }, 500);
        } catch (error) {
            console.error('Admin restart error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================
    // NEW: MODULE CONTROL ENDPOINTS
    // ============================================
    app.post('/api/modules/pause', async (req, res) => {
        try {
            const { moduleName, reason, pausedBy } = req.body;
            await run(
                `INSERT OR REPLACE INTO module_control (module_name, is_paused, paused_at, paused_by, reason, updated_at)
                 VALUES (?, 1, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP)`,
                [moduleName, pausedBy || 'system', reason || null]
            );
            
            res.json({ success: true, message: `${moduleName} paused` });
        } catch (error) {
            console.error('Module pause error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/modules/resume', async (req, res) => {
        try {
            const { moduleName, resumedBy } = req.body;
            await run(
                `UPDATE module_control SET is_paused = 0, resume_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE module_name = ?`,
                [moduleName]
            );
            
            res.json({ success: true, message: `${moduleName} resumed` });
        } catch (error) {
            console.error('Module resume error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.get('/api/modules/status', async (req, res) => {
        try {
            const statuses = await query(
                `SELECT module_name, is_paused, paused_at, paused_by, reason FROM module_control
                 ORDER BY module_name ASC`
            );
            
            res.json({ success: true, modules: statuses });
        } catch (error) {
            console.error('Module status error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================
    // NEW: ERROR & ALERT ENDPOINTS
    // ============================================
    app.get('/api/errors', async (req, res) => {
        try {
            const minsSince = parseInt(req.query.mins || '60');
            const cutoffTime = Date.now() - (minsSince * 60 * 1000);
            
            const errors = await query(
                `SELECT module_name, error_type, error_message, severity, timestamp
                 FROM error_log
                 WHERE resolved = 0 AND timestamp > ?
                 ORDER BY timestamp DESC
                 LIMIT 20`,
                [cutoffTime]
            );
            
            res.json({ success: true, errors, count: errors.length });
        } catch (error) {
            console.error('Errors endpoint error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/errors/resolve', async (req, res) => {
        try {
            const { errorId } = req.body;
            await run(
                `UPDATE error_log SET resolved = 1 WHERE id = ?`,
                [errorId]
            );
            
            res.json({ success: true });
        } catch (error) {
            console.error('Error resolve error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    // ============================================
    // NEW: SOLVER METRICS ENDPOINT
    // ============================================
    app.get('/api/solver-metrics', async (req, res) => {
        try {
            const hoursBack = parseInt(req.query.hours || '24');
            const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
            
            const metrics = await query(
                `SELECT 
                    contract_type,
                    COUNT(*) as total_attempts,
                    SUM(success) as successful,
                    ROUND(100.0 * SUM(success) / COUNT(*), 2) as success_rate,
                    ROUND(AVG(execution_time_ms), 2) as avg_time_ms,
                    SUM(reward_amount) as total_rewards,
                    MAX(timestamp) as last_solved
                 FROM solver_metrics
                 WHERE timestamp > ?
                 GROUP BY contract_type
                 ORDER BY total_rewards DESC`,
                [cutoffTime]
            );
            
            res.json({ success: true, metrics, count: metrics.length });
        } catch (error) {
            console.error('Solver metrics error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    app.post('/api/solver-metrics', async (req, res) => {
        try {
            const { contractType, solverName, success, executionTimeMs, rewardAmount } = req.body;
            
            await run(
                `INSERT INTO solver_metrics (contract_type, solver_name, success, execution_time_ms, reward_amount, timestamp)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [contractType, solverName, success ? 1 : 0, executionTimeMs, rewardAmount, Date.now()]
            );
            
            res.json({ success: true });
        } catch (error) {
            console.error('Add solver metric error:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

    console.log('✓ API routes configured');
}
