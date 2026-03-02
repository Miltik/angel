/**
 * ANGEL Backend - Command Queue Manager
 * Handles command lifecycle (queue, execute, complete)
 */

import { query, queryOne, run } from './db.js';

export class CommandQueue {
    constructor() {
        this.executingCommands = new Map();
    }

    /**
     * Queue a new command
     */
    async queueCommand(type, parameters = {}) {
        const result = await run(
            `INSERT INTO commands (command_type, parameters, status)
             VALUES (?, ?, 'pending')`,
            [type, JSON.stringify(parameters)]
        );

        console.log(`📋 Command queued: ${type} (ID: ${result.lastID})`);
        return result.lastID;
    }

    /**
     * Get pending commands for the game to execute
     */
    async getPendingCommands(limit = 10) {
        const commands = await query(
            `SELECT * FROM commands WHERE status = 'pending'
             ORDER BY created_at ASC LIMIT ?`,
            [limit]
        );

        return commands.map(cmd => ({
            id: cmd.id,
            type: cmd.command_type,
            parameters: JSON.parse(cmd.parameters || '{}')
        }));
    }

    /**
     * Mark command as executed
     */
    async markExecuted(commandId, result = {}) {
        await run(
            `UPDATE commands 
             SET status = 'executed', result = ?, executed_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [JSON.stringify(result), commandId]
        );

        console.log(`✓ Command executed: ${commandId}`);
        this.executingCommands.delete(commandId);
    }

    /**
     * Mark command as failed
     */
    async markFailed(commandId, error) {
        await run(
            `UPDATE commands 
             SET status = 'failed', result = ?, executed_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [JSON.stringify({ error: error.message }), commandId]
        );

        console.log(`✗ Command failed: ${commandId} - ${error.message}`);
        this.executingCommands.delete(commandId);
    }

    /**
     * Get command history
     */
    async getHistory(limit = 50) {
        return await query(
            `SELECT * FROM commands 
             WHERE status IN ('executed', 'failed')
             ORDER BY executed_at DESC LIMIT ?`,
            [limit]
        );
    }

    /**
     * Clear old executed commands (older than 7 days)
     */
    async cleanupOldCommands() {
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const result = await run(
            `DELETE FROM commands 
             WHERE status IN ('executed', 'failed')
             AND executed_at < datetime(?, 'unixepoch')`,
            [Math.floor(sevenDaysAgo / 1000)]
        );

        console.log(`🧹 Cleaned up ${result.changes} old commands`);
        return result.changes;
    }
}

export const commandQueue = new CommandQueue();

// Cleanup old commands every hour
setInterval(() => {
    commandQueue.cleanupOldCommands().catch(err => 
        console.error('Cleanup error:', err)
    );
}, 60 * 60 * 1000);
