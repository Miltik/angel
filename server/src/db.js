/**
 * ANGEL Backend - SQLite Database
 * Handles telemetry, commands, and state persistence
 */

import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '../data/data.db');

let db = null;

export function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Database initialization failed:', err);
                reject(err);
                return;
            }
            
            console.log(`✓ SQLite database connected at ${dbPath}`);
            createTables();
            resolve(db);
        });
    });
}

function createTables() {
    // Telemetry data table
    db.run(`
        CREATE TABLE IF NOT EXISTS telemetry_samples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp INTEGER NOT NULL,
            run_id TEXT NOT NULL,
            module_name TEXT,
            memory_used REAL,
            money_rate REAL,
            xp_rate REAL,
            hack_level INTEGER,
            current_money TEXT,
            uptime INTEGER,
            module_status TEXT,
            execution_count INTEGER,
            failure_count INTEGER,
            avg_execution_time REAL,
            raw_data TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Commands queue table
    db.run(`
        CREATE TABLE IF NOT EXISTS commands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            command_type TEXT NOT NULL,
            parameters TEXT,
            status TEXT DEFAULT 'pending',
            executed_at DATETIME,
            result TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Discord alerts table
    db.run(`
        CREATE TABLE IF NOT EXISTS discord_alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alert_type TEXT NOT NULL,
            title TEXT,
            message TEXT,
            severity TEXT,
            sent_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // System state table
    db.run(`
        CREATE TABLE IF NOT EXISTS system_state (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT UNIQUE NOT NULL,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Solver metrics table - track contract success rates and rewards
    db.run(`
        CREATE TABLE IF NOT EXISTS solver_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contract_type TEXT,
            solver_name TEXT,
            success INTEGER DEFAULT 1,
            execution_time_ms REAL,
            reward_amount INTEGER,
            timestamp INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Module pause/control status
    db.run(`
        CREATE TABLE IF NOT EXISTS module_control (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module_name TEXT UNIQUE NOT NULL,
            is_paused INTEGER DEFAULT 0,
            paused_at DATETIME,
            paused_by TEXT,
            resume_at DATETIME,
            reason TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    // Error log table - for Discord error alerts and debugging
    db.run(`
        CREATE TABLE IF NOT EXISTS error_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            module_name TEXT,
            error_type TEXT,
            error_message TEXT,
            stack_trace TEXT,
            severity TEXT DEFAULT 'error',
            resolved INTEGER DEFAULT 0,
            timestamp INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    console.log('✓ Database tables created');

    // Create indexes for better query performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry_samples(timestamp);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_telemetry_module ON telemetry_samples(module_name);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_telemetry_run ON telemetry_samples(run_id);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_solver_metrics_type ON solver_metrics(contract_type);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_error_log_module ON error_log(module_name);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_error_log_timestamp ON error_log(timestamp);`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_module_control_name ON module_control(module_name);`);
    
    console.log('✓ Database indexes created');
    
    // Set up retention policy cleanup (run on startup)
    applyRetentionPolicy();
}

/**
 * Remove old telemetry data to prevent database bloat
 * Keeps last 7 days of samples
 */
function applyRetentionPolicy() {
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    db.run(
        `DELETE FROM telemetry_samples WHERE timestamp < ?;`,
        [sevenDaysAgo],
        function(err) {
            if (err) {
                console.warn('Retention policy cleanup failed:', err);
            } else if (this.changes > 0) {
                console.log(`✓ Retention policy cleaned up ${this.changes} old telemetry records`);
            }
        }
    );
}

export function getDatabase() {
    if (!db) throw new Error('Database not initialized. Call initializeDatabase() first.');
    return db;
}

export function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

export function queryOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

export function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

export function closeDatabase() {
    return new Promise((resolve, reject) => {
        if (db) {
            db.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        } else {
            resolve();
        }
    });
}

/**
 * Run cleanup tasks (retention policy, index maintenance)
 * Call this periodically (e.g., daily) to maintain database health
 */
export function runMaintenanceTasks() {
    applyRetentionPolicy();
}

/**
 * Add solver metric record (for contract success tracking)
 */
export async function addSolverMetric(contractType, solverName, success, executionTimeMs, rewardAmount) {
    return run(
        `INSERT INTO solver_metrics (contract_type, solver_name, success, execution_time_ms, reward_amount, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [contractType, solverName, success ? 1 : 0, executionTimeMs, rewardAmount, Date.now()]
    );
}

/**
 * Get solver metrics summary
 */
export async function getSolverMetricsSummary(hoursBack = 24) {
    const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
    return query(
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
}

/**
 * Pause a module
 */
export async function pauseModule(moduleName, reason = null, pausedBy = 'system') {
    return run(
        `INSERT OR REPLACE INTO module_control (module_name, is_paused, paused_at, paused_by, reason, updated_at)
         VALUES (?, 1, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP)`,
        [moduleName, pausedBy, reason]
    );
}

/**
 * Resume a module
 */
export async function resumeModule(moduleName) {
    return run(
        `UPDATE module_control SET is_paused = 0, resume_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE module_name = ?`,
        [moduleName]
    );
}

/**
 * Check if module is paused
 */
export async function isModulePaused(moduleName) {
    const result = await queryOne(
        `SELECT is_paused FROM module_control WHERE module_name = ?`,
        [moduleName]
    );
    return result ? result.is_paused === 1 : false;
}

/**
 * Get all module control statuses
 */
export async function getModuleControlStatus() {
    return query(
        `SELECT module_name, is_paused, paused_at, paused_by, reason FROM module_control
         ORDER BY module_name ASC`
    );
}

/**
 * Log an error for Discord alerts
 */
export async function logError(moduleName, errorType, errorMessage, stackTrace, severity = 'error') {
    return run(
        `INSERT INTO error_log (module_name, error_type, error_message, stack_trace, severity, timestamp)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [moduleName, errorType, errorMessage, stackTrace, severity, Date.now()]
    );
}

/**
 * Get recent unresolved errors
 */
export async function getRecentErrors(minsSince = 60, limit = 10) {
    const cutoffTime = Date.now() - (minsSince * 60 * 1000);
    return query(
        `SELECT module_name, error_type, error_message, severity, timestamp, created_at
         FROM error_log
         WHERE resolved = 0 AND timestamp > ?
         ORDER BY timestamp DESC
         LIMIT ?`,
        [cutoffTime, limit]
    );
}
