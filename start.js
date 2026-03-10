/**
 * Quick start script for ANGEL
 * Stops any running instances and starts fresh
 * 
 * @param {NS} ns
 */

export async function main(ns) {
    ensureLootArchiveSeed(ns);

    const missingFiles = getMissingRequiredFiles(ns);
    if (missingFiles.length > 0) {
        ns.tprint("✗ ANGEL launch blocked: missing required files on home");
        for (const file of missingFiles) {
            ns.tprint(`  - ${file}`);
        }
        ns.tprint("Upload the missing files via your Bitburner API feed, then rerun /angel/start.js.");
        return;
    }

    const shouldStop = ns.args[0] === "stop" || ns.args[0] === "--stop";
    const shouldRestart = ns.args[0] === "restart" || ns.args[0] === "--restart";
    
    if (shouldStop || shouldRestart) {
        ns.tprint("Stopping ANGEL...");
        await stopAngelProcesses(ns);
        
        if (shouldStop) {
            ns.tprint("✓ ANGEL stopped");
            return;
        }
    }
    
    // Check if already running
    if (ns.isRunning("/angel/angel.js", "home")) {
        ns.tprint("ANGEL is already running!");
        ns.tprint("Use 'run /angel/start.js restart' to restart");
        ns.tprint("Use 'run /angel/start.js stop' to stop");
        return;
    }
    
    // Start ANGEL
    ns.tprint("Starting ANGEL orchestrator...");
    const pid = ns.exec("/angel/angel.js", "home");
    
    if (pid === 0) {
        const requiredRam = getScriptRamSafe(ns, "/angel/angel.js");
        const availableRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");

        if (requiredRam <= 0) {
            ns.tprint("✗ Failed to start ANGEL (dependency or parse issue, not RAM)");
            const missingDeps = getMissingImportDependencies(ns, "/angel/angel.js");
            if (missingDeps.length > 0) {
                ns.tprint("Missing dependencies:");
                for (const file of missingDeps) {
                    ns.tprint(`  - ${file}`);
                }
            } else {
                const zeroRamDeps = getZeroRamDependencies(ns, "/angel/angel.js");
                if (zeroRamDeps.length > 0) {
                    ns.tprint("Dependencies with RAM parse failure (getScriptRam=0):");
                    for (const file of zeroRamDeps) {
                        ns.tprint(`  - ${file}`);
                    }
                } else {
                    ns.tprint("No missing/zero-RAM import files detected; check syntax/runtime errors in /angel/angel.js and transitive imports.");
                }
            }
        } else {
            ns.tprint("✗ Failed to start ANGEL (insufficient RAM?)");
        }
        
        ns.tprint(`Required RAM: ${requiredRam.toFixed(2)}GB`);
        ns.tprint(`Available RAM: ${availableRam.toFixed(2)}GB`);
    } else {
        ns.tprint(`✓ ANGEL started (PID: ${pid})`);
    }
    
    // Check if telemetry is running
    if (!ns.isRunning("/angel/telemetry/telemetry.js", "home")) {
        ns.tprint("Starting Telemetry collector...");
        const telemetryPid = ns.exec("/angel/telemetry/telemetry.js", "home");
        
        if (telemetryPid === 0) {
            ns.tprint("✗ Failed to start Telemetry (insufficient RAM?)");
            const telemetryRam = ns.getScriptRam("/angel/telemetry/telemetry.js");
            const availableRam = ns.getServerMaxRam("home") - ns.getServerUsedRam("home");
            ns.tprint(`Required RAM: ${telemetryRam.toFixed(2)}GB`);
            ns.tprint(`Available RAM: ${availableRam.toFixed(2)}GB`);
        } else {
            ns.tprint(`✓ Telemetry started (PID: ${telemetryPid})`);
        }
    } else {
        ns.tprint("✓ Telemetry is already running");
    }
    
    ns.tprint("");
    ns.tprint("The orchestrator and telemetry are now running!");
    ns.tprint("Tail window will open automatically");
}

// Lightweight stop without importing angel.js modules
async function stopAngelProcesses(ns) {
    // Kill main orchestrator
    if (ns.isRunning("/angel/angel.js", "home")) {
        ns.kill("/angel/angel.js", "home");
    }
    
    // Kill telemetry
    if (ns.isRunning("/angel/telemetry/telemetry.js", "home")) {
        ns.kill("/angel/telemetry/telemetry.js", "home");
    }
    
    // Kill all workers
    ns.killall("home", true);
    
    await ns.sleep(500);
}

function ensureLootArchiveSeed(ns) {
    const seedPath = "/angel/loot/loot.txt";
    if (!ns.fileExists(seedPath, "home")) {
        ns.write(seedPath, "loot", "w");
        ns.tprint("Initialized /angel/loot/loot.txt");
    }
}

function getMissingRequiredFiles(ns) {
    // Bootstrap dependencies required to evaluate and launch /angel/angel.js.
    const required = [
        "/angel/angel.js",
        "/angel/config.js",
        "/angel/utils.js",
        "/angel/scanner.js",
        "/angel/ports.js",
        "/angel/services/network.js",
        "/angel/services/rooting.js",
        "/angel/services/stats.js",
        "/angel/services/moduleRegistry.js",
        "/angel/services/events.js",
        "/angel/services/cache.js",
    ];

    return required.filter(file => !ns.fileExists(file, "home"));
}

function getScriptRamSafe(ns, scriptPath) {
    const normalized = normalizePath(scriptPath);
    const alt = altPath(normalized);

    if (ns.fileExists(normalized, "home")) {
        return ns.getScriptRam(normalized, "home");
    }
    if (alt && ns.fileExists(alt, "home")) {
        return ns.getScriptRam(alt, "home");
    }
    return 0;
}

function getMissingImportDependencies(ns, entryFile) {
    const visited = new Set();
    const missing = new Set();

    function walk(filePath) {
        const normalized = normalizePath(filePath);
        if (visited.has(normalized)) return;
        visited.add(normalized);

        const resolved = resolveExistingFile(ns, normalized);
        if (!resolved) {
            missing.add(normalized);
            return;
        }

        const content = String(ns.read(resolved) || "");
        if (!content) return;

        const importRegex = /from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const raw = match[1] || match[2];
            if (!raw) continue;
            if (!raw.startsWith("/angel/") && !raw.startsWith("angel/") && !raw.startsWith("./") && !raw.startsWith("../")) continue;

            const dep = resolveImportPath(resolved, raw);
            if (!dep.endsWith(".js")) continue;
            walk(dep);
        }
    }

    walk(entryFile);
    return Array.from(missing).sort();
}

function getZeroRamDependencies(ns, entryFile) {
    const deps = collectImportDependencies(ns, entryFile);
    const broken = [];

    for (const file of deps) {
        const resolved = resolveExistingFile(ns, file);
        if (!resolved) continue;
        const ram = ns.getScriptRam(resolved, "home");
        if (ram <= 0) {
            broken.push(file);
        }
    }

    return broken.sort();
}

function collectImportDependencies(ns, entryFile) {
    const visited = new Set();

    function walk(filePath) {
        const normalized = normalizePath(filePath);
        if (visited.has(normalized)) return;
        visited.add(normalized);

        const resolved = resolveExistingFile(ns, normalized);
        if (!resolved) return;

        const content = String(ns.read(resolved) || "");
        if (!content) return;

        const importRegex = /from\s+["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const raw = match[1] || match[2];
            if (!raw) continue;
            if (!raw.startsWith("/angel/") && !raw.startsWith("angel/") && !raw.startsWith("./") && !raw.startsWith("../")) continue;

            const dep = resolveImportPath(resolved, raw);
            if (!dep.endsWith(".js")) continue;
            walk(dep);
        }
    }

    walk(entryFile);
    return Array.from(visited);
}

function resolveImportPath(baseFile, rawImport) {
    if (rawImport.startsWith("/angel/") || rawImport.startsWith("angel/")) {
        return normalizePath(rawImport);
    }

    const baseParts = normalizePath(baseFile).split("/");
    baseParts.pop(); // remove filename

    const relParts = rawImport.split("/");
    for (const part of relParts) {
        if (!part || part === ".") continue;
        if (part === "..") {
            if (baseParts.length > 0) baseParts.pop();
        } else {
            baseParts.push(part);
        }
    }

    return normalizePath(baseParts.join("/"));
}

function resolveExistingFile(ns, path) {
    const normalized = normalizePath(path);
    const alternate = altPath(normalized);

    if (ns.fileExists(normalized, "home")) return normalized;
    if (alternate && ns.fileExists(alternate, "home")) return alternate;
    return null;
}

function normalizePath(path) {
    const raw = String(path || "").replace(/\\/g, "/").trim();
    if (raw.startsWith("angel/")) return `/${raw}`;
    if (raw.startsWith("/")) return raw;
    return `/${raw}`;
}

function altPath(path) {
    const normalized = normalizePath(path);
    if (normalized.startsWith("/angel/")) return normalized.slice(1);
    return null;
}
