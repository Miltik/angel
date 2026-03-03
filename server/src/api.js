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
    // ============================================
    app.get('/api/status', async (req, res) => {
        // Declare these outside try block to ensure scope
        let memoryTotal = 0;
        let targetAngelLiteRam = 64;
        
        try {
            const oneHourAgo = Date.now() - (60 * 60 * 1000);

            // Get latest single sample
            const latest = await queryOne(
                `SELECT * FROM telemetry_samples 
                 ORDER BY timestamp DESC LIMIT 1`
            );

            // Get recent samples (last 10) for trends
            const recentSamples = await query(
                `SELECT * FROM telemetry_samples 
                 ORDER BY timestamp DESC LIMIT 10`
            );

            // Get module breakdown
            const moduleStats = await query(
                `SELECT module_name, COUNT(*) as sample_count,
                        AVG(memory_used) as avg_memory,
                        AVG(money_rate) as avg_money_rate,
                        AVG(xp_rate) as avg_xp_rate,
                        MAX(execution_count) as total_executions,
                        MAX(failure_count) as total_failures,
                        AVG(module_status LIKE '%active%') as active_percent
                 FROM telemetry_samples 
                 WHERE timestamp > ?
                 GROUP BY module_name
                 ORDER BY sample_count DESC`,
                [oneHourAgo]
            );

            // Get pending commands
            const pendingCommands = await query(
                `SELECT COUNT(*) as count FROM commands WHERE status = 'pending'`
            );

            const latestAugments = await queryOne(
                `SELECT raw_data FROM telemetry_samples
                 WHERE module_name = 'augments'
                 ORDER BY timestamp DESC
                 LIMIT 1`
            );

            const latestActivities = await queryOne(
                `SELECT raw_data FROM telemetry_samples
                 WHERE module_name = 'activities'
                 ORDER BY timestamp DESC
                 LIMIT 1`
            );

            let latestRaw = {};
            try {
                latestRaw = latest?.raw_data ? JSON.parse(latest.raw_data) : {};
            } catch {
                latestRaw = {};
            }

            let augmentsRaw = {};
            try {
                augmentsRaw = latestAugments?.raw_data ? JSON.parse(latestAugments.raw_data) : {};
            } catch {
                augmentsRaw = {};
            }

            let activitiesRaw = {};
            try {
                activitiesRaw = latestActivities?.raw_data ? JSON.parse(latestActivities.raw_data) : {};
            } catch {
                activitiesRaw = {};
            }

            let phaseRaw = {};
            try {
                const latestPhase = await queryOne(
                    `SELECT raw_data FROM telemetry_samples
                     WHERE module_name = 'phase'
                     ORDER BY timestamp DESC
                     LIMIT 1`
                );
                phaseRaw = latestPhase?.raw_data ? JSON.parse(latestPhase.raw_data) : {};
            } catch {
                phaseRaw = {};
            }

            const runStartFromRunId = Number(latest?.run_id);
            const metaRun = latestRaw?.__telemetry?.runMeta || latestRaw?.runMeta || {};
            const runStartedAt = Number(metaRun.startedAt || runStartFromRunId || 0) || null;
            const startedWithInstalledAugs = Number.isFinite(Number(metaRun.startedWithInstalledAugs))
                ? Number(metaRun.startedWithInstalledAugs)
                : null;
            memoryTotal = Number(latestRaw?.__telemetry?.memoryTotal || 0);
            targetAngelLiteRam = 64;
            const currentPhase = Number.isFinite(Number(phaseRaw?.phase))
                ? Number(phaseRaw.phase)
                : null;

            // Get all samples to calculate session money and prior reset info
            const sessionSamples = await query(`
                SELECT * FROM telemetry_samples 
                WHERE timestamp > ?
                ORDER BY timestamp ASC
            `, [runStartedAt ? runStartedAt - (24 * 60 * 60 * 1000) : Date.now() - (24 * 60 * 60 * 1000)]);
            
            // Find samples before current run and after previous one
            const currentRunSamples = sessionSamples.filter(s => s.timestamp >= (runStartedAt || Date.now() - 300000));
            const priorRunSamples = sessionSamples.filter(s => s.timestamp < (runStartedAt || Date.now() - 300000));
            
            // Calculate session money gain (current money now vs when run started)
            const sessionMoneyStart = currentRunSamples.length > 0 ? Number(currentRunSamples[0].current_money || 0) : Number(latest?.current_money || 0);
            const currentMoney = Number(latest?.current_money || 0);
            const sessionMoneyGain = Math.max(0, currentMoney - sessionMoneyStart);
            
            // Get info about previous run/reset
            let lastResetTime = null;
            let lastResetHackLevel = null;
            let lastResetMoney = null;
            if (priorRunSamples.length > 0) {
                const lastPriorSample = priorRunSamples[priorRunSamples.length - 1];
                lastResetTime = lastPriorSample.timestamp;
                lastResetHackLevel = lastPriorSample.hack_level;
                lastResetMoney = lastPriorSample.current_money;
            }

            const timeSinceLastResetMs = lastResetTime ? Math.max(0, Date.now() - lastResetTime) : null;

            // Calculate aggregates
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
                modules: moduleStats.slice(0, 10),
                
                // Raw data
                latestData: latest,
                recentSamples: recentSamples.slice(0, 5),
                
                pendingCommands: pendingCommands[0]?.count || 0,
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
            const incomeModulePlaceholders = INCOME_MODULES.map(() => '?').join(', ');

            // All known modules in the system
            const KNOWN_MODULES = [
                'activities', 'augments', 'backdoorRunner', 'bladeburner',
                'contracts', 'corporation', 'formulas', 'gang', 'hacking', 'hacknet',
                'loot', 'programs', 'servers', 'sleeves', 'stocks',
                'xpFarm', 'phase'
            ];

            // Get latest sample per module
            const moduleStats = await query(`
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
                AND (module_name, timestamp) IN (
                    SELECT module_name, MAX(timestamp) 
                    FROM telemetry_samples 
                    WHERE module_name != 'SYSTEM'
                    AND timestamp > ?
                    GROUP BY module_name
                )
                ORDER BY money_rate DESC
            `, [tenMinutesAgo, tenMinutesAgo]);

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

            const richDetailRows = await query(`
                SELECT module_name, raw_data, timestamp
                FROM telemetry_samples
                WHERE module_name = 'corporation'
                AND (
                    json_extract(raw_data, '$.funds') IS NOT NULL
                    OR json_extract(raw_data, '$.revenue') IS NOT NULL
                    OR json_extract(raw_data, '$.employees') IS NOT NULL
                    OR json_extract(raw_data, '$.divisions') IS NOT NULL
                )
                ORDER BY timestamp DESC
            `);

            const richDetailsMap = new Map();
            richDetailRows.forEach(row => {
                if (!richDetailsMap.has(row.module_name)) {
                    try {
                        richDetailsMap.set(row.module_name, JSON.parse(row.raw_data || '{}'));
                    } catch {
                        richDetailsMap.set(row.module_name, {});
                    }
                }
            });

            // Estimate income metrics per module across current session (since last DB reset)
            // Session total is integrated from effective per-second rates over time.
            // For variable income modules (stocks, corp), use 5-sample average instead of latest to smooth volatility
            const incomeMetrics = await query(`
                WITH samples AS (
                    SELECT
                        module_name,
                        timestamp,
                        COALESCE(
                            CAST(json_extract(raw_data, '$.moneyRate') AS REAL),
                            CAST(json_extract(raw_data, '$.metrics.moneyRate') AS REAL),
                            CAST(json_extract(raw_data, '$.metrics.profit') AS REAL),
                            CASE
                                WHEN json_extract(raw_data, '$.revenue') IS NOT NULL OR json_extract(raw_data, '$.expenses') IS NOT NULL
                                    THEN CAST(json_extract(raw_data, '$.revenue') AS REAL) - CAST(json_extract(raw_data, '$.expenses') AS REAL)
                            END,
                            CASE
                                WHEN json_extract(raw_data, '$.metrics.revenue') IS NOT NULL OR json_extract(raw_data, '$.metrics.expenses') IS NOT NULL
                                    THEN CAST(json_extract(raw_data, '$.metrics.revenue') AS REAL) - CAST(json_extract(raw_data, '$.metrics.expenses') AS REAL)
                            END,
                            money_rate,
                            CAST(json_extract(raw_data, '$.profit') AS REAL),
                            0
                        ) AS base_rate,
                        COALESCE(
                            CAST(json_extract(raw_data, '$.totalProfits') AS REAL),
                            CAST(json_extract(raw_data, '$.metrics.totalProfits') AS REAL)
                        ) AS total_profits,
                        LAG(timestamp) OVER (PARTITION BY module_name ORDER BY timestamp) AS prev_ts,
                        LAG(COALESCE(
                            CAST(json_extract(raw_data, '$.totalProfits') AS REAL),
                            CAST(json_extract(raw_data, '$.metrics.totalProfits') AS REAL)
                        )) OVER (PARTITION BY module_name ORDER BY timestamp) AS prev_total_profits,
                        ROW_NUMBER() OVER (PARTITION BY module_name ORDER BY timestamp DESC) AS recency_rank
                    FROM telemetry_samples
                    WHERE module_name IN (${incomeModulePlaceholders})
                ),
                rates AS (
                    SELECT
                        module_name,
                        timestamp,
                        CASE
                            WHEN prev_ts IS NULL OR timestamp <= prev_ts THEN 0
                            WHEN base_rate > 0 THEN MAX(0, base_rate)
                            WHEN total_profits IS NOT NULL AND prev_total_profits IS NOT NULL
                                THEN MAX(0, (total_profits - prev_total_profits) / ((timestamp - prev_ts) / 1000.0))
                            ELSE MAX(0, base_rate)
                        END AS effective_rate,
                        CASE
                            WHEN prev_ts IS NULL OR timestamp <= prev_ts THEN 0
                            ELSE (timestamp - prev_ts) / 1000.0
                        END AS dt,
                        recency_rank
                    FROM samples
                ),
                session_totals AS (
                    SELECT
                        module_name,
                        SUM(effective_rate * dt) AS session_total
                    FROM rates
                    GROUP BY module_name
                ),
                smoothed_rates AS (
                    SELECT 
                        module_name,
                        AVG(effective_rate) AS avg_rate
                    FROM rates
                    WHERE recency_rank <= 5
                    GROUP BY module_name
                )
                SELECT
                    st.module_name,
                    COALESCE(st.session_total, 0) AS session_total,
                    COALESCE(sr.avg_rate, 0) AS current_rate
                FROM session_totals st
                LEFT JOIN smoothed_rates sr ON sr.module_name = st.module_name
            `, INCOME_MODULES);

            const incomeMap = new Map(
                incomeMetrics.map(row => [row.module_name, {
                    perSecond: Number(row.current_rate) || 0,
                    sessionTotal: Number(row.session_total) || 0
                }])
            );

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

                if (mod.module_name === 'corporation') {
                    const hasCorpDetails = details && (
                        details.funds !== undefined ||
                        details.revenue !== undefined ||
                        details.employees !== undefined ||
                        details.divisions !== undefined
                    );
                    if (!hasCorpDetails && richDetailsMap.has('corporation')) {
                        details = {
                            ...richDetailsMap.get('corporation'),
                            ...details,
                        };
                    }
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

                const income = incomeMap.get(mod.module_name) || { perSecond: 0, sessionTotal: 0 };
                const isIncomeModule = INCOME_MODULES.includes(mod.module_name);
                const displayMoneyRate = isIncomeModule ? income.perSecond : 0;
                
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
                        sessionTotal: isIncomeModule ? income.sessionTotal : 0,
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

    console.log('✓ API routes configured');
}
