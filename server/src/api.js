/**
 * ANGEL Backend - API Routes
 * Handles telemetry ingestion, status, commands
 */

import { query, queryOne, run } from './db.js';

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

            // If modules exist, store each module
            if (modules && Object.keys(modules).length > 0) {
                for (const module of Object.entries(modules)) {
                    const [moduleName, data] = module;
                    
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
                            stats?.moneyRate || 0,
                            stats?.xpRate || 0,
                            hackLevel || 0,
                            money || '0',
                            stats?.uptime || 0,
                            data?.status || 'unknown',
                            data?.executions || 0,
                            data?.failures || 0,
                            data?.avgTime || 0,
                            JSON.stringify(data)
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
                        JSON.stringify({ stats, memory, money, xp, hackLevel })
                    ]
                );
                samplesInserted = 1;
            }

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
    // STATUS ENDPOINT - Get current game state
    // ============================================
    app.get('/api/status', async (req, res) => {
        try {
            const latest = await queryOne(
                `SELECT * FROM telemetry_samples 
                 ORDER BY timestamp DESC LIMIT 1`
            );

            const pendingCommands = await query(
                `SELECT COUNT(*) as count FROM commands WHERE status = 'pending'`
            );

            res.json({
                status: 'ok',
                lastUpdate: latest?.timestamp || null,
                latestData: latest,
                pendingCommands: pendingCommands[0]?.count || 0,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Status GET error:', error);
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

    console.log('✓ API routes configured');
}
