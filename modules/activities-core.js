/**
 * ANGEL Activities Core
 * Lightweight activity coordinator that selects mode only.
 * Execution is delegated to dedicated workers (crime/work/training).
 *
 * @param {NS} ns
 */

import { config, PORTS } from "/angel/config.js";
import { createWindow } from "/angel/modules/uiManager.js";
import { PHASE_PORT } from "/angel/ports.js";
import { formatMoney } from "/angel/utils.js";

let state = {
    loopCount: 0,
    lastPhase: -1,
    lastMode: "none",
};

export async function main(ns) {
    ns.disableLog("ALL");

    const ui = createWindow("activities-core", "Activities Core", 620, 360, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");
    ui.log("Activities core coordinator initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "info");

    while (true) {
        try {
            state.loopCount++;
            const phase = readGamePhase(ns);
            const player = ns.getPlayer();
            const money = Number(ns.getServerMoneyAvailable("home") || 0);

            if (phase !== state.lastPhase) {
                ui.log(`Phase ${phase} | Money ${formatMoney(money)}`, "info");
                state.lastPhase = phase;
            }

            // Respect manual user actions by mirroring mode from current work.
            const currentWork = safeCurrentWork(ns);
            if (currentWork) {
                const mirrored = modeFromWork(currentWork);
                if (mirrored !== "none") {
                    setActivityMode(ns, mirrored);
                    state.lastMode = mirrored;
                    await ns.sleep(5000);
                    continue;
                }
            }

            const nextMode = chooseMode(ns, phase, player, money);
            if (nextMode !== state.lastMode || state.loopCount % 12 === 0) {
                ui.log(`Mode => ${nextMode}`, "info");
                state.lastMode = nextMode;
            }
            setActivityMode(ns, nextMode);
        } catch (e) {
            ui.log(`Coordinator error: ${e}`, "error");
        }

        await ns.sleep(5000);
    }
}

function readGamePhase(ns) {
    const raw = ns.peek(PHASE_PORT);
    if (raw === "NULL PORT DATA") return 0;
    return Number.parseInt(String(raw), 10) || 0;
}

function safeCurrentWork(ns) {
    try {
        return ns.singularity.getCurrentWork();
    } catch (e) {
        return null;
    }
}

function modeFromWork(work) {
    const type = String(work?.type || "").toUpperCase();
    if (type === "CRIME") return "crime";
    if (type === "FACTION") return "faction";
    if (type === "COMPANY") return "company";
    if (type === "UNIVERSITY" || type === "GYM" || type === "CLASS") return "training";
    return "none";
}

function setActivityMode(ns, mode) {
    try {
        ns.clearPort(PORTS.ACTIVITY_MODE);
        ns.writePort(PORTS.ACTIVITY_MODE, String(mode || "none").toLowerCase());
    } catch (e) {
        // Ignore IPC failures.
    }
}

function chooseMode(ns, phase, player, money) {
    const missingCrimeFactions = getMissingCrimeFactions(player);
    const lateCrimeMoneyCap = Number(config.activities?.lateCrimeMoneyCap ?? 100000000);
    const forceCrimeUnlockUntilPhase = Number(config.activities?.forceCrimeFactionUnlockUntilPhase ?? 2);
    const hasFactionWork = readFactionWorkHint(ns);
    const needsTraining = checkNeedsTraining(player);

    if (missingCrimeFactions.length > 0 && phase <= forceCrimeUnlockUntilPhase) {
        return "crime";
    }

    if (hasFactionWork) {
        return "faction";
    }

    if (phase === 0) {
        if (money < 10000000) return "crime";
        if (needsTraining) return "training";
        return "crime";
    }

    if (phase === 1) {
        if (needsTraining) return "training";
        const companyThreshold = Number(config.company?.onlyWhenMoneyBelow || 200000000);
        if (money < companyThreshold) return "company";
        return "crime";
    }

    if (phase >= 3) {
        if (needsTraining) return "training";
        if (money < lateCrimeMoneyCap) return "crime";
        return "none";
    }

    if (needsTraining) return "training";
    return "crime";
}

function getMissingCrimeFactions(player) {
    const joined = new Set(player?.factions || []);
    const crimeFactions = ["Slum Snakes", "Tetrads", "Speakers for the Dead", "The Dark Army", "The Syndicate"];
    return crimeFactions.filter((f) => !joined.has(f));
}

function readFactionWorkHint(ns) {
    try {
        const raw = ns.peek(PORTS.FACTIONS);
        if (raw === "NULL PORT DATA") return false;
        const parsed = JSON.parse(String(raw));
        return Boolean(parsed?.hasViableFactionWork);
    } catch (e) {
        return false;
    }
}

function checkNeedsTraining(player) {
    const targets = config.training?.targetStats || { strength: 60, defense: 60, dexterity: 60, agility: 60 };
    const targetHack = Number(config.training?.targetHacking || 75);
    const skills = player?.skills || {};

    if (Number(skills.hacking || 0) < targetHack) return true;
    if (Number(skills.strength || 0) < Number(targets.strength || 60)) return true;
    if (Number(skills.defense || 0) < Number(targets.defense || 60)) return true;
    if (Number(skills.dexterity || 0) < Number(targets.dexterity || 60)) return true;
    if (Number(skills.agility || 0) < Number(targets.agility || 60)) return true;
    return false;
}
