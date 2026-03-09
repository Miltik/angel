import { config } from "/angel/config.js";

function hasMetAugPrereqs(ns, augName, ownedSet) {
    try {
        const prereqs = ns.singularity.getAugmentationPrereq(augName) || [];
        if (!Array.isArray(prereqs) || prereqs.length === 0) return true;
        return prereqs.every((prereq) => ownedSet.has(prereq));
    } catch (e) {
        return true;
    }
}

export function getAugmentRepGoal(ns) {
    try {
        const player = ns.getPlayer();
        const currentMoney = ns.getServerMoneyAvailable("home");
        const owned = ns.singularity.getOwnedAugmentations(true);
        const ownedSet = new Set(owned);
        const priorityList = config.augmentations?.augmentPriority || [];

        const candidates = [];
        for (const faction of player.factions || []) {
            if (faction === "NiteSec") continue;

            const factionRep = ns.singularity.getFactionRep(faction);
            const augments = ns.singularity.getAugmentationsFromFaction(faction) || [];

            for (const aug of augments) {
                if (ownedSet.has(aug)) continue;
                if (!hasMetAugPrereqs(ns, aug, ownedSet)) continue;

                const repReq = ns.singularity.getAugmentationRepReq(aug);
                const price = ns.singularity.getAugmentationPrice(aug);
                const repShort = Math.max(0, repReq - factionRep);
                const moneyShort = Math.max(0, price - currentMoney);

                const moneyGapScore = moneyShort > 0 ? Math.log10(moneyShort + 1) : 0;
                const repGapScore = repShort > 0 ? Math.log10(repShort + 1) : 0;
                const gapScore = moneyGapScore + repGapScore;
                const priorityBonus = priorityList.includes(aug) ? 0.15 : 0;
                const effectiveScore = Math.max(0, gapScore - priorityBonus);

                candidates.push({
                    name: aug,
                    faction,
                    repReq,
                    price,
                    repShort,
                    moneyShort,
                    effectiveScore,
                });
            }
        }

        if (candidates.length === 0) return null;

        candidates.sort((a, b) => {
            if (a.effectiveScore !== b.effectiveScore) return a.effectiveScore - b.effectiveScore;
            const aReady = a.moneyShort === 0 && a.repShort === 0;
            const bReady = b.moneyShort === 0 && b.repShort === 0;
            if (aReady !== bReady) return aReady ? -1 : 1;
            if (a.price !== b.price) return a.price - b.price;
            return a.name.localeCompare(b.name);
        });

        return candidates[0];
    } catch (e) {
        return null;
    }
}

export function hasAnyViableFactionWork(ns) {
    const augGoal = getAugmentRepGoal(ns);
    return Boolean(augGoal && augGoal.repShort > 0);
}

export function getFactionOpportunitySummary(ns, faction) {
    const currentRep = ns.singularity.getFactionRep(faction);
    const augments = ns.singularity.getAugmentationsFromFaction(faction);
    const owned = new Set(ns.singularity.getOwnedAugmentations(true));

    let grindableCount = 0;
    let grindableValue = 0;
    let maxRepNeeded = 0;

    for (const aug of augments) {
        if (owned.has(aug)) continue;

        const repReq = ns.singularity.getAugmentationRepReq(aug);
        const price = ns.singularity.getAugmentationPrice(aug);
        const repNeeded = Math.max(0, repReq - currentRep);

        if (repNeeded > 0) {
            grindableCount++;
            grindableValue += price;
            if (repNeeded > maxRepNeeded) {
                maxRepNeeded = repNeeded;
            }
        }
    }

    return { grindableCount, grindableValue, maxRepNeeded };
}
