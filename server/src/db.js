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

    console.log('✓ Database tables created');
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
