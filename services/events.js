/**
 * Event Bus - Publish/Subscribe system for inter-module communication
 * Allows modules to communicate without direct dependencies
 * 
 * Features:
 * - Topic-based pub/sub messaging
 * - Wildcard subscriptions
 * - Event history/replay
 * - Event filtering
 * - Priority handlers
 * 
 * @module services/events
 */

// Event bus state
const subscribers = new Map(); // topic -> array of handlers
const eventHistory = []; // Ring buffer of recent events
const MAX_HISTORY_SIZE = 100;

/**
 * Subscribe to events on a topic
 * @param {string} topic - Topic name (supports wildcards: "module.*")
 * @param {Function} handler - Callback function(event)
 * @param {Object} options - Optional configuration
 * @returns {Function} - Unsubscribe function
 */
export function subscribe(topic, handler, options = {}) {
    if (typeof handler !== "function") {
        throw new Error("Handler must be a function");
    }
    
    const subscription = {
        topic,
        handler,
        priority: options.priority || 0,
        filter: options.filter || null,
        once: options.once || false,
        subscriberId: options.subscriberId || "anonymous",
    };
    
    if (!subscribers.has(topic)) {
        subscribers.set(topic, []);
    }
    
    const topicSubs = subscribers.get(topic);
    topicSubs.push(subscription);
    
    // Sort by priority (higher first)
    topicSubs.sort((a, b) => b.priority - a.priority);
    
    // Return unsubscribe function
    return () => {
        const subs = subscribers.get(topic);
        if (subs) {
            const index = subs.indexOf(subscription);
            if (index >= 0) {
                subs.splice(index, 1);
            }
        }
    };
}

/**
 * Unsubscribe all handlers for a topic
 * @param {string} topic
 */
export function unsubscribe(topic) {
    subscribers.delete(topic);
}

/**
 * Unsubscribe all handlers for a subscriber ID
 * @param {string} subscriberId
 */
export function unsubscribeAll(subscriberId) {
    for (const [topic, subs] of subscribers) {
        const filtered = subs.filter(s => s.subscriberId !== subscriberId);
        if (filtered.length === 0) {
            subscribers.delete(topic);
        } else {
            subscribers.set(topic, filtered);
        }
    }
}

/**
 * Publish an event to all subscribers
 * @param {string} topic - Event topic
 * @param {*} data - Event data
 * @param {Object} metadata - Optional metadata
 */
export function publish(topic, data, metadata = {}) {
    const event = {
        topic,
        data,
        timestamp: Date.now(),
        metadata: {
            ...metadata,
            source: metadata.source || "unknown",
        },
    };
    
    // Add to history
    eventHistory.push(event);
    if (eventHistory.length > MAX_HISTORY_SIZE) {
        eventHistory.shift();
    }
    
    // Notify subscribers
    const handlers = getMatchingSubscribers(topic);
    const toRemove = [];
    
    for (const subscription of handlers) {
        try {
            // Apply filter if present
            if (subscription.filter && !subscription.filter(event)) {
                continue;
            }
            
            // Call handler
            subscription.handler(event);
            
            // Remove if once-only
            if (subscription.once) {
                toRemove.push({ topic: subscription.topic, subscription });
            }
        } catch (error) {
            console.error(`Event handler error for topic "${topic}":`, error);
        }
    }
    
    // Remove once-only handlers
    for (const { topic: t, subscription } of toRemove) {
        const subs = subscribers.get(t);
        if (subs) {
            const index = subs.indexOf(subscription);
            if (index >= 0) {
                subs.splice(index, 1);
            }
        }
    }
}

/**
 * Get all subscribers matching a topic (supports wildcards)
 * @param {string} publishedTopic - The topic being published
 * @returns {Array} - Matching subscriptions
 */
function getMatchingSubscribers(publishedTopic) {
    const matches = [];
    
    for (const [subscribedTopic, subs] of subscribers) {
        if (topicMatches(publishedTopic, subscribedTopic)) {
            matches.push(...subs);
        }
    }
    
    // Sort by priority
    matches.sort((a, b) => b.priority - a.priority);
    
    return matches;
}

/**
 * Check if a published topic matches a subscribed topic pattern
 * @param {string} publishedTopic - e.g., "module.hacking.start"
 * @param {string} subscribedTopic - e.g., "module.*" or "module.hacking.start"
 * @returns {boolean}
 */
function topicMatches(publishedTopic, subscribedTopic) {
    // Exact match
    if (publishedTopic === subscribedTopic) {
        return true;
    }
    
    // Wildcard match
    if (subscribedTopic.includes("*")) {
        const pattern = subscribedTopic
            .replace(/\./g, "\\.")
            .replace(/\*/g, ".*");
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(publishedTopic);
    }
    
    return false;
}

/**
 * Get event history
 * @param {Object} options - Filter options
 * @returns {Array} - Events
 */
export function getHistory(options = {}) {
    let events = [...eventHistory];
    
    // Filter by topic
    if (options.topic) {
        events = events.filter(e => topicMatches(e.topic, options.topic));
    }
    
    // Filter by time range
    if (options.since) {
        events = events.filter(e => e.timestamp >= options.since);
    }
    
    if (options.until) {
        events = events.filter(e => e.timestamp <= options.until);
    }
    
    // Limit results
    if (options.limit) {
        events = events.slice(-options.limit);
    }
    
    return events;
}

/**
 * Clear event history
 */
export function clearHistory() {
    eventHistory.length = 0;
}

/**
 * Get all active topics
 * @returns {string[]}
 */
export function getTopics() {
    return Array.from(subscribers.keys());
}

/**
 * Get subscriber count for a topic
 * @param {string} topic
 * @returns {number}
 */
export function getSubscriberCount(topic) {
    const subs = subscribers.get(topic);
    return subs ? subs.length : 0;
}

/**
 * Get all subscriber info
 * @returns {Object}
 */
export function getSubscriberInfo() {
    const info = {};
    for (const [topic, subs] of subscribers) {
        info[topic] = subs.map(s => ({
            subscriberId: s.subscriberId,
            priority: s.priority,
            once: s.once,
        }));
    }
    return info;
}

// ============================================
// COMMON EVENT TOPICS (for documentation)
// ============================================

/**
 * Standard event topics used throughout ANGEL
 */
export const TOPICS = {
    // Module lifecycle
    MODULE_START: "module.*.start",
    MODULE_STOP: "module.*.stop",
    MODULE_ERROR: "module.*.error",
    
    // Phase changes
    PHASE_CHANGE: "phase.change",
    PHASE_THRESHOLD: "phase.threshold",
    
    // Server events
    SERVER_ROOTED: "server.rooted",
    SERVER_PURCHASED: "server.purchased",
    SERVER_BACKDOORED: "server.backdoored",
    
    // Economy events
    MONEY_MILESTONE: "economy.money.milestone",
    INCOME_CHANGE: "economy.income.change",
    
    // Faction events
    FACTION_JOINED: "faction.joined",
    FACTION_INVITED: "faction.invited",
    FACTION_REP_MILESTONE: "faction.rep.milestone",
    
    // Augmentation events
    AUGMENT_PURCHASED: "augment.purchased",
    AUGMENT_INSTALLED: "augment.installed",
    RESET_STARTED: "reset.started",
    
    // Gang events
    GANG_FORMED: "gang.formed",
    GANG_MEMBER_RECRUITED: "gang.member.recruited",
    GANG_TERRITORY_CHANGE: "gang.territory.change",
    
    // Stat milestones
    STAT_MILESTONE: "stats.*.milestone",
    HACK_LEVEL_UP: "stats.hacking.levelup",
    
    // Activity changes
    ACTIVITY_CHANGE: "activity.change",
    WORK_STARTED: "activity.work.start",
    WORK_STOPPED: "activity.work.stop",
    
    // Hacking events
    HACK_TARGET_CHANGE: "hacking.target.change",
    HACK_BATCH_COMPLETE: "hacking.batch.complete",
    
    // Stock events
    STOCK_POSITION_OPENED: "stocks.position.open",
    STOCK_POSITION_CLOSED: "stocks.position.close",
    
    // Corporation events
    CORP_CREATED: "corp.created",
    CORP_DIVISION_CREATED: "corp.division.created",
    CORP_MILESTONE: "corp.milestone",
    
    // Bladeburner events
    BLADE_JOINED: "bladeburner.joined",
    BLADE_RANK_UP: "bladeburner.rankup",
    
    // UI events
    UI_NOTIFICATION: "ui.notification",
    UI_UPDATE: "ui.update",
    
    // System events
    SYSTEM_ERROR: "system.error",
    SYSTEM_WARNING: "system.warning",
    DAEMON_LOCK_ACQUIRED: "system.daemon.lock",
    DAEMON_LOCK_RELEASED: "system.daemon.unlock",
};

/** @param {NS} ns */
export async function main(ns) {
    ns.tprint("=== Event Bus Test ===");
    ns.tprint("");
    
    // Subscribe to test events
    const unsub1 = subscribe("test.message", (event) => {
        ns.tprint(`Handler 1: ${event.data}`);
    }, { subscriberId: "test1", priority: 10 });
    
    const unsub2 = subscribe("test.*", (event) => {
        ns.tprint(`Handler 2 (wildcard): ${event.topic} - ${event.data}`);
    }, { subscriberId: "test2", priority: 5 });
    
    // Publish some events
    publish("test.message", "Hello, World!", { source: "main" });
    publish("test.other", "Other message", { source: "main" });
    
    ns.tprint("");
    ns.tprint("Subscribers:");
    const info = getSubscriberInfo();
    for (const [topic, subs] of Object.entries(info)) {
        ns.tprint(`  ${topic}: ${subs.length} subscribers`);
        for (const sub of subs) {
            ns.tprint(`    - ${sub.subscriberId} (priority: ${sub.priority})`);
        }
    }
    
    ns.tprint("");
    ns.tprint("History:");
    const history = getHistory();
    for (const event of history) {
        ns.tprint(`  [${new Date(event.timestamp).toLocaleTimeString()}] ${event.topic}: ${event.data}`);
    }
    
    // Cleanup
    unsub1();
    unsub2();
    
    ns.tprint("");
    ns.tprint("Subscribers after cleanup: " + getTopics().length);
}
