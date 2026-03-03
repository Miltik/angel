/**
 * ANGEL Central Constants & Configuration
 * 
 * Centralized location for all system-wide constants, magic numbers, and configuration values.
 * Import from here instead of scattering values throughout the codebase.
 * 
 * This file serves as "source of truth" for:
 * - IPC Port definitions
 * - Timeouts and intervals
 * - Threshold values
 * - Database settings
 * - Module configurations
 */

// ============================================
// IPC PORTS - Inter-Process Communication
// ============================================
// Each port serves a specific purpose for module coordination
export const PORTS = {
    // Core system ports
    PHASE: 7,                          // Daemon/phase progression signaling
    DAEMON_LOCK: 15,                   // Daemon unlock gate control
    TELEMETRY: 20,                     // Telemetry & metrics reporting
    HACKNET_TELEMETRY: 21,             // Hacknet-specific metrics
    
    // Activity coordination (1-6)
    ACTIVITY: 1,                       // Current activity status
    ACTIVITY_MODE: 2,                  // Activity mode (crime, work, train, etc)
    ACTIVITY_STATUS: 3,                // Activity state updates
    
    // Control signals
    PAUSE_SIGNAL: 30,                  // Pause/resume coordination
    RESTART_SIGNAL: 31,                // Module restart signal
    SHUTDOWN_SIGNAL: 32                // Clean shutdown signal
};

// ============================================
// TIMEOUTS & INTERVALS (milliseconds)
// ============================================
export const TIMING = {
    // Telemetry reporting
    TELEMETRY_INTERVAL: 5000,          // Report every 5 seconds
    
    // Module cycles
    CONTRACTS_CHECK: 30000,            // Check for contracts every 30s
    HACKNET_UPDATE: 10000,             // Update hacknet every 10s
    STOCK_UPDATE: 5000,                // Stock price check every 5s
    GANG_UPDATE: 8000,                 // Gang operations every 8s
    
    // Database maintenance
    DB_CLEANUP_INTERVAL: 86400000,     // Daily (24h)
    DB_RETENTION_DAYS: 7,              // Keep 7 days of data
    
    // API timeouts
    API_TIMEOUT: 5000,                 // 5 second API timeout
    BACKEND_POLL: 2000,                // Poll backend every 2s for commands
    
    // Reset timing
    SOFT_RESET_DELAY: 100,             // Quick reset delay
    HARD_RESET_DELAY: 1000,            // Delayed reset
};

// ============================================
// THRESHOLDS & LIMITS
// ============================================
export const THRESHOLDS = {
    // Memory management
    MAX_SCRIPT_MEMORY: 200,            // Max RAM per module
    TARGET_RAM_TOTAL: 64,              // Angel-lite RAM target
    
    // Hacking targets
    MIN_HACK_LEVEL: 1,                 // Minimum hack level to attempt
    DEFAULT_HACK_TARGET: 'n00dles',   // Fallback target server
    
    // Money/spending
    SERVER_BUY_THRESHOLD: 0.15,        // Buy servers when have 15% of cost
    AUGMENT_QUEUE_SIZE: 15,            // Queue up to 15 augments
    
    // Error handling
    MAX_RETRIES: 3,                    // Retry failed operations 3 times
    ERROR_COOLDOWN: 5000,              // Wait 5s before retry
};

// ============================================
// DATABASE SETTINGS
// ============================================
export const DB = {
    // Table settings
    TELEMETRY_RETENTION_MS: TIMING.DB_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    
    // Query limits
    MAX_RECENT_SAMPLES: 100,           // Get last 100 telemetry samples max
    MAX_ERROR_LOG_SIZE: 1000,          // Keep last 1000 errors
    
    // Performance
    BATCH_INSERT_SIZE: 50,             // Insert up to 50 records per batch
    QUERY_TIMEOUT_MS: 3000,            // Query timeout
};

// ============================================
// MODULE CONFIGURATION
// ============================================
export const MODULES = {
    // All module names
    ALL: [
        'activities', 'augments', 'backdoor', 'bladeburner', 'contracts',
        'corporation', 'customHacking', 'dashboard', 'formulas', 'gang',
        'hacknet', 'hacking', 'loot', 'networkMap', 'phase', 'programs',
        'servers', 'sleeves', 'stocks', 'uiLauncher', 'xpFarm',
        'backdoorRunner', 'uiManager'
    ],
    
    // Module categories
    MONEY_MAKERS: ['hacking', 'stocks', 'gang', 'corporation'],
    XP_FARMERS: ['xpFarm', 'customHacking'],
    INFRASTRUCTURE: ['servers', 'programs', 'hacknet'],
    GAMEPLAY: ['activities', 'augments', 'phase', 'bladeburner'],
    
    // Module priorities (lower = higher priority)
    DEFAULT_PRIORITY: {
        'phase': 1,
        'augments': 2,
        'servers': 3,
        'hacking': 4,
        'gang': 5,
        'stocks': 6,
        'corporation': 7,
        'contracts': 8,
        'formulas': 9
    }
};

// ============================================
// GAME PHASES - Daemon progression
// ============================================
export const PHASES = {
    BOOTSTRAP: 0,
    EARLY_SCALING: 1,
    MID_GAME: 2,
    GANG_PHASE: 3,
    LATE_GAME: 4,
    DAEMON_PREP: 5,
    DAEMON_ACQUIRED: 6
};

// ============================================
// SEVERITY LEVELS
// ============================================
export const SEVERITY = {
    INFO: 'info',
    WARNING: 'warning',
    ERROR: 'error',
    CRITICAL: 'critical'
};

// ============================================
// DISCORD COLORS - Cyberpunk aesthetic
// ============================================
export const COLORS = {
    primary: 0x00efff,     // Cyan
    secondary: 0x00ffff,   // Light Cyan
    accent: 0x99ff00,      // Lime
    success: 0x00ff00,     // Green
    warning: 0xffaa00,     // Orange
    danger: 0xff0000,      // Red
    info: 0x00aaff         // Blue
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if a port number is valid for IPC
 */
export function isValidPort(portNum) {
    return typeof portNum === 'number' && portNum > 0 && portNum <= 255;
}

/**
 * Get port name from number
 */
export function getPortName(portNum) {
    for (const [name, num] of Object.entries(PORTS)) {
        if (num === portNum) return name;
    }
    return `UNKNOWN_PORT_${portNum}`;
}

/**
 * Format timing value to human-readable
 */
export function formatTiming(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
}

// Export everything as namespace for convenience
export default {
    PORTS,
    TIMING,
    THRESHOLDS,
    DB,
    MODULES,
    PHASES,
    SEVERITY,
    COLORS,
    isValidPort,
    getPortName,
    formatTiming
};
