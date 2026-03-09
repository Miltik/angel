/**
 * Cache Service - Centralized caching with TTL and statistics
 * Reduces expensive API calls and improves performance
 * 
 * Features:
 * - Time-based cache expiration (TTL)
 * - Cache statistics (hits, misses, etc.)
 * - Multiple cache namespaces
 * - Memory-efficient cleanup
 * - Cache preloading and warming
 * 
 * @module services/cache
 */

// Cache storage
const caches = new Map(); // namespace -> cache data

// Default TTL in milliseconds
const DEFAULT_TTL = 5000;

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry
 * @property {*} value - Cached value
 * @property {number} timestamp - When cached
 * @property {number} ttl - Time to live in ms
 * @property {number} hits - Number of cache hits
 */

/**
 * Get a cache namespace
 * @param {string} namespace
 * @returns {Map}
 */
function getCache(namespace) {
    if (!caches.has(namespace)) {
        caches.set(namespace, {
            data: new Map(),
            stats: {
                hits: 0,
                misses: 0,
                sets: 0,
                evictions: 0,
                created: Date.now(),
            },
        });
    }
    return caches.get(namespace);
}

/**
 * Set a value in cache
 * @param {string} namespace - Cache namespace
 * @param {string} key - Cache key
 * @param {*} value - Value to cache
 * @param {number} ttl - Time to live in ms (default: 5000)
 */
export function set(namespace, key, value, ttl = DEFAULT_TTL) {
    const cache = getCache(namespace);
    
    cache.data.set(key, {
        value,
        timestamp: Date.now(),
        ttl,
        hits: 0,
    });
    
    cache.stats.sets++;
}

/**
 * Get a value from cache
 * @param {string} namespace - Cache namespace
 * @param {string} key - Cache key
 * @returns {*} - Cached value or undefined if not found/expired
 */
export function get(namespace, key) {
    const cache = getCache(namespace);
    const entry = cache.data.get(key);
    
    if (!entry) {
        cache.stats.misses++;
        return undefined;
    }
    
    const now = Date.now();
    const age = now - entry.timestamp;
    
    if (age > entry.ttl) {
        // Expired
        cache.data.delete(key);
        cache.stats.misses++;
        cache.stats.evictions++;
        return undefined;
    }
    
    // Valid cache hit
    entry.hits++;
    cache.stats.hits++;
    return entry.value;
}

/**
 * Check if a key exists and is valid
 * @param {string} namespace
 * @param {string} key
 * @returns {boolean}
 */
export function has(namespace, key) {
    return get(namespace, key) !== undefined;
}

/**
 * Delete a key from cache
 * @param {string} namespace
 * @param {string} key
 * @returns {boolean} - True if deleted
 */
export function del(namespace, key) {
    const cache = getCache(namespace);
    return cache.data.delete(key);
}

/**
 * Clear entire namespace or specific pattern
 * @param {string} namespace
 * @param {string} pattern - Optional regex pattern
 */
export function clear(namespace, pattern = null) {
    const cache = getCache(namespace);
    
    if (!pattern) {
        cache.data.clear();
        return;
    }
    
    const regex = new RegExp(pattern);
    const toDelete = [];
    
    for (const key of cache.data.keys()) {
        if (regex.test(key)) {
            toDelete.push(key);
        }
    }
    
    for (const key of toDelete) {
        cache.data.delete(key);
    }
}

/**
 * Clear all caches
 */
export function clearAll() {
    caches.clear();
}

/**
 * Clean up expired entries
 * @param {string} namespace - Optional, clean specific namespace
 * @returns {number} - Number of entries removed
 */
export function cleanup(namespace = null) {
    let removed = 0;
    const now = Date.now();
    
    const namespacesToClean = namespace
        ? [namespace]
        : Array.from(caches.keys());
    
    for (const ns of namespacesToClean) {
        const cache = getCache(ns);
        const toDelete = [];
        
        for (const [key, entry] of cache.data) {
            const age = now - entry.timestamp;
            if (age > entry.ttl) {
                toDelete.push(key);
            }
        }
        
        for (const key of toDelete) {
            cache.data.delete(key);
            removed++;
        }
        
        cache.stats.evictions += toDelete.length;
    }
    
    return removed;
}

/**
 * Get cache statistics
 * @param {string} namespace - Optional, get stats for specific namespace
 * @returns {Object}
 */
export function getStats(namespace = null) {
    if (namespace) {
        const cache = getCache(namespace);
        const hitRate = cache.stats.hits + cache.stats.misses > 0
            ? (cache.stats.hits / (cache.stats.hits + cache.stats.misses) * 100).toFixed(2)
            : 0;
        
        return {
            namespace,
            size: cache.data.size,
            hitRate: parseFloat(hitRate),
            ...cache.stats,
        };
    }
    
    // All namespaces
    const allStats = {};
    let totalHits = 0;
    let totalMisses = 0;
    let totalSize = 0;
    
    for (const [ns, cache] of caches) {
        const hitRate = cache.stats.hits + cache.stats.misses > 0
            ? (cache.stats.hits / (cache.stats.hits + cache.stats.misses) * 100).toFixed(2)
            : 0;
        
        allStats[ns] = {
            size: cache.data.size,
            hitRate: parseFloat(hitRate),
            ...cache.stats,
        };
        
        totalHits += cache.stats.hits;
        totalMisses += cache.stats.misses;
        totalSize += cache.data.size;
    }
    
    const overallHitRate = totalHits + totalMisses > 0
        ? (totalHits / (totalHits + totalMisses) * 100).toFixed(2)
        : 0;
    
    return {
        namespaces: allStats,
        total: {
            size: totalSize,
            hits: totalHits,
            misses: totalMisses,
            hitRate: parseFloat(overallHitRate),
        },
    };
}

/**
 * Get or compute and cache
 * @param {string} namespace
 * @param {string} key
 * @param {Function} computeFn - Function to compute value if not cached
 * @param {number} ttl - Time to live
 * @returns {*} - Value
 */
export function getOrCompute(namespace, key, computeFn, ttl = DEFAULT_TTL) {
    const cached = get(namespace, key);
    if (cached !== undefined) {
        return cached;
    }
    
    const value = computeFn();
    set(namespace, key, value, ttl);
    return value;
}

/**
 * Memoize a function with caching
 * @param {Function} fn - Function to memoize
 * @param {Object} options - Options
 * @returns {Function} - Memoized function
 */
export function memoize(fn, options = {}) {
    const namespace = options.namespace || "memoized";
    const ttl = options.ttl || DEFAULT_TTL;
    const keyGen = options.keyGen || ((...args) => JSON.stringify(args));
    
    return function (...args) {
        const key = keyGen(...args);
        return getOrCompute(namespace, key, () => fn(...args), ttl);
    };
}

/**
 * Preload cache with entries
 * @param {string} namespace
 * @param {Map|Object} entries - Entries to preload
 * @param {number} ttl
 */
export function preload(namespace, entries, ttl = DEFAULT_TTL) {
    const cache = getCache(namespace);
    
    const entriesMap = entries instanceof Map ? entries : Object.entries(entries);
    
    for (const [key, value] of entriesMap) {
        set(namespace, key, value, ttl);
    }
}

/**
 * Get all keys in a namespace
 * @param {string} namespace
 * @returns {string[]}
 */
export function keys(namespace) {
    const cache = getCache(namespace);
    return Array.from(cache.data.keys());
}

/**
 * Get cache size for namespace
 * @param {string} namespace
 * @returns {number}
 */
export function size(namespace) {
    const cache = getCache(namespace);
    return cache.data.size;
}

// Common cache namespaces (for consistency)
export const NAMESPACES = {
    NETWORK: "network",
    SERVERS: "servers",
    STATS: "stats",
    PLAYERS: "players",
    FACTIONS: "factions",
    AUGMENTS: "augments",
    FORMULAS: "formulas",
    CONTRACTS: "contracts",
    GANG: "gang",
    STOCKS: "stocks",
    CORPORATION: "corporation",
};

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== Cache Service Test ===");
    ns.tprint("");
    
    // Test basic caching
    set("test", "key1", "value1", 2000);
    set("test", "key2", "value2", 2000);
    
    ns.tprint("Set 2 values");
    ns.tprint(`Get key1: ${get("test", "key1")}`);
    ns.tprint(`Get key2: ${get("test", "key2")}`);
    ns.tprint(`Get missing: ${get("test", "key3")}`);
    
    ns.tprint("");
    ns.tprint("Stats:");
    const stats = getStats("test");
    ns.tprint(`  Size: ${stats.size}`);
    ns.tprint(`  Hits: ${stats.hits}`);
    ns.tprint(`  Misses: ${stats.misses}`);
    ns.tprint(`  Hit Rate: ${stats.hitRate}%`);
    
    // Test memoization
    ns.tprint("");
    ns.tprint("Testing memoization...");
    
    let callCount = 0;
    const expensiveFn = (x) => {
        callCount++;
        return x * x;
    };
    
    const memoized = memoize(expensiveFn, { namespace: "math", ttl: 5000 });
    
    ns.tprint(`memoized(5) = ${memoized(5)} (calls: ${callCount})`);
    ns.tprint(`memoized(5) = ${memoized(5)} (calls: ${callCount})`); // Should use cache
    ns.tprint(`memoized(7) = ${memoized(7)} (calls: ${callCount})`);
    
    // Show all stats
    ns.tprint("");
    ns.tprint("All cache stats:");
    const allStats = getStats();
    for (const [namespace, stats] of Object.entries(allStats.namespaces)) {
        ns.tprint(`  ${namespace}: ${stats.size} entries, ${stats.hitRate}% hit rate`);
    }
    
    // Test expiration
    ns.tprint("");
    ns.tprint("Testing expiration...");
    set("expire", "short", "expires soon", 100);
    ns.tprint(`Before: ${get("expire", "short")}`);
    await ns.sleep(150);
    ns.tprint(`After 150ms: ${get("expire", "short")}`);
    
    // Cleanup
    clearAll();
    ns.tprint("");
    ns.tprint("Cleared all caches");
}
