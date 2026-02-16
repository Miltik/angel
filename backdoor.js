/**
 * ANGEL Backdoor Launcher
 * Frees RAM (xpFarm first) and launches the full backdoor runner.
 *
 * Run manually: run /angel/backdoor.js
 *
 * @param {NS} ns
 */

const RUNNER_SCRIPT = "/angel/modules/backdoorRunner.js";
const RECLAIM_ORDER = [
    "/angel/xpFarm.js",
    "/angel/modules/networkMap.js",
    "/angel/networkMap.js",
    "/angel/modules/dashboard.js",
];

export async function main(ns) {
    ns.disableLog("ALL");

    if (!ns.fileExists(RUNNER_SCRIPT, "home")) {
        ns.tprint(`ERROR: Missing ${RUNNER_SCRIPT}. Run /angel/sync.js first.`);
        return;
    }

    if (ns.isRunning(RUNNER_SCRIPT, "home")) {
        ns.tprint("Backdoor runner already active.");
        return;
    }

    const requiredRam = ns.getScriptRam(RUNNER_SCRIPT, "home");
    if (requiredRam <= 0) {
        ns.tprint(`ERROR: Unable to read RAM usage for ${RUNNER_SCRIPT}`);
        return;
    }

    const reclaimed = [];
    let availableRam = getAvailableHomeRam(ns);

    if (availableRam < requiredRam) {
        ns.tprint(`Backdoor launcher: need ${requiredRam.toFixed(2)}GB, have ${availableRam.toFixed(2)}GB. Reclaiming RAM...`);
        for (const script of RECLAIM_ORDER) {
            if (availableRam >= requiredRam) break;
            if (!ns.isRunning(script, "home")) continue;

            const stopped = ns.kill(script, "home");
            if (stopped) {
                reclaimed.push(script);
                await ns.sleep(50);
                availableRam = getAvailableHomeRam(ns);
            }
        }
    }

    if (availableRam < requiredRam) {
        ns.tprint(`ERROR: Still insufficient RAM for backdoor runner (${availableRam.toFixed(2)}GB/${requiredRam.toFixed(2)}GB).`);
        if (reclaimed.length > 0) {
            ns.tprint(`Freed by stopping: ${reclaimed.join(", ")}`);
        }
        return;
    }

    const pid = ns.exec(RUNNER_SCRIPT, "home");
    if (pid === 0) {
        ns.tprint("ERROR: Failed to start backdoor runner.");
        return;
    }

    if (reclaimed.length > 0) {
        ns.tprint(`Backdoor runner started (PID ${pid}). Freed RAM by stopping: ${reclaimed.join(", ")}`);
    } else {
        ns.tprint(`Backdoor runner started (PID ${pid}).`);
    }
}

function getAvailableHomeRam(ns) {
    return ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
}
