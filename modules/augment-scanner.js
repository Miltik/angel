import { config } from "/angel/config.js";

/**
 * Centralized augmentation scanner - eliminates nested loop duplication
 * Scans all factions and augmentations in a single pass, returning structured data
 * Used by augments.js to avoid redundant faction/augment API calls
 */

/**
 * Check if augmentation prerequisites are met
 * @param {NS} ns
 * @param {string} augName
 * @param {Set} ownedSet - Set of already-owned augmentation names
 * @returns {boolean}
 */
function hasMetPrerequisites(ns, augName, ownedSet) {
    try {
        const prereqs = ns.singularity.getAugmentationPrereq(augName) || [];
        if (!Array.isArray(prereqs) || prereqs.length === 0) return true;
        return prereqs.every(prereq => ownedSet.has(prereq));
    } catch (e) {
        return true;
    }
}

/**
 * Single pass scan of all faction augmentations
 * Returns comprehensive augment data for all decision-making
 * Called once per orchestrator cycle, results fed to augments.js via port
 * 
 * @param {NS} ns
 * @returns {{
 *   available: Array,      // Augments already purchasable
 *   candidates: Array,     // All non-owned augments (for targeting)
 *   priority: Array,       // Config priority augments
 *   smartTarget: Object,   // Closest-to-available augment
 *   timestamp: number
 * }}
 */
export function scanAllAugments(ns) {
    try {
        if (!ns.singularity) return { available: [], candidates: [], priority: [], smartTarget: null, timestamp: Date.now() };
        
        const player = ns.getPlayer();
        const currentMoney = ns.getServerMoneyAvailable("home");
        const owned = ns.singularity.getOwnedAugmentations(true);
        const ownedSet = new Set(owned);
        const priorityList = config.augmentations.augmentPriority || [];
        
        const available = [];      // Already purchasable
        const candidates = [];     // All not-yet-owned
        
        // Single scan pass through all factions
        for (const faction of player.factions) {
            const augments = ns.singularity.getAugmentationsFromFaction(faction);
            const factionRep = ns.singularity.getFactionRep(faction);
            
            for (const aug of augments) {
                if (owned.includes(aug)) continue;
                if (!hasMetPrerequisites(ns, aug, ownedSet)) continue;
                
                const repReq = ns.singularity.getAugmentationRepReq(aug);
                const price = ns.singularity.getAugmentationPrice(aug);
                
                const augData = {
                    name: aug,
                    faction,
                    price,
                    repReq,
                    factionRep,
                    moneyShort: Math.max(0, price - currentMoney),
                    repShort: Math.max(0, repReq - factionRep),
                    isPriority: priorityList.includes(aug),
                    isAvailable: factionRep >= repReq && currentMoney >= price
                };
                
                candidates.push(augData);
                
                // Track immediately purchasable
                if (augData.isAvailable) {
                    available.push(augData);
                }
            }
        }
        
        // Find priority augments
        const priority = candidates.filter(aug => aug.isPriority);
        
        // Find smartest target (closest to being available)
        let smartTarget = null;
        if (candidates.length > 0) {
            const scored = candidates.map(aug => {
                // Normalize gaps using logarithmic scale
                const moneyGapScore = aug.moneyShort > 0 ? Math.log10(aug.moneyShort + 1) : 0;
                const repGapScore = aug.repShort > 0 ? Math.log10(aug.repShort + 1) : 0;
                const gapScore = moneyGapScore + repGapScore;
                
                // Priority bonus (soft preference, not hard constraint)
                const priorityBonus = aug.isPriority ? 0.15 : 0;
                const effectiveScore = Math.max(0, gapScore - priorityBonus);
                
                return { ...aug, gapScore, effectiveScore };
            });
            
            // Sort by effective score (closest to available)
            scored.sort((a, b) => {
                if (a.effectiveScore !== b.effectiveScore) return a.effectiveScore - b.effectiveScore;
                
                // Tiebreaker: prefer immediately available
                if (a.isAvailable !== b.isAvailable) return a.isAvailable ? -1 : 1;
                
                // Tiebreaker: prefer cheaper
                if (a.price !== b.price) return a.price - b.price;
                return a.name.localeCompare(b.name);
            });
            
            smartTarget = scored[0];
        }
        
        return {
            available: available.sort((a, b) => a.price - b.price),
            candidates: candidates,
            priority: priority,
            smartTarget: smartTarget,
            timestamp: Date.now()
        };
    } catch (e) {
        ns.print(`❌ Augment scanner error: ${e}`);
        return { available: [], candidates: [], priority: [], smartTarget: null, timestamp: Date.now() };
    }
}

/**
 * Export scan results as a JSON-serializable port message
 * Used for inter-module communication
 * @param {Object} scanResults
 * @returns {string}
 */
export function encodeScanResults(scanResults) {
    return JSON.stringify({
        available: scanResults.available,
        candidates: scanResults.candidates,
        priority: scanResults.priority,
        smartTarget: scanResults.smartTarget,
        timestamp: scanResults.timestamp
    });
}

/**
 * Decode scan results from a port message
 * @param {string} portData
 * @returns {Object}
 */
export function decodeScanResults(portData) {
    if (portData === "NULL PORT DATA") {
        return { available: [], candidates: [], priority: [], smartTarget: null, timestamp: 0 };
    }
    
    try {
        return JSON.parse(String(portData));
    } catch (e) {
        return { available: [], candidates: [], priority: [], smartTarget: null, timestamp: 0 };
    }
}
