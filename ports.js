/**
 * ANGEL Port Constants
 * Central definition of all inter-module communication ports
 * Used for IPC (inter-process communication) between Angel modules
 */

// Core coordination ports
export const PHASE_PORT = 7;                    // Phase tracker broadcasts current game phase
export const DAEMON_LOCK_PORT = 15;             // Hard-gate lock for daemon progression
export const TELEMETRY_PORT = 20;               // Main telemetry aggregation port
export const HACKNET_TELEMETRY_PORT = 21;       // Hacknet-specific metrics

// Activity coordination
export const PORTS = {
    ACTIVITY: 1,                                // Activities lock and ownership tracking
    ACTIVITY_MODE: 2,                           // Current activity type (crime, training, faction, company)
    ACTIVITY_STATUS: 3,                         // Activity status details
};

// Helper to validate port number
export function isValidPort(num) {
    return Number.isInteger(num) && num >= 1 && num <= 20;
}
