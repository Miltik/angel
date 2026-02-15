/**
 * Display ANGEL system status
 * 
 * @param {NS} ns
 */

import { config } from "/angel/config.js";
import { formatMoney, formatRam, formatNumber } from "/angel/utils.js";
import { scanAll, getRootedServers, getHackableServers } from "/angel/scanner.js";
import { getServerStats } from "/angel/modules/servers.js";
import { getSystemHealth } from "/angel/angel.js";

export async function main(ns) {
    const detailed = ns.args.includes("--detailed") || ns.args.includes("-d");
    
    ns.tprint("\n═══════════════════════════════════════");
    ns.tprint("     ANGEL SYSTEM STATUS REPORT       ");
    ns.tprint("═══════════════════════════════════════\n");
    
    // Player stats
    showPlayerStats(ns);
    
    // Network stats
    showNetworkStats(ns);
    
    // Server stats
    showServerStats(ns);
    
    // Module health
    showModuleHealth(ns);
    
    // Detailed info if requested
    if (detailed) {
        showDetailedStats(ns);
    }
    
    ns.tprint("═══════════════════════════════════════\n");
    
    if (!detailed) {
        ns.tprint("Use --detailed or -d for more information\n");
    }
}

function showPlayerStats(ns) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home");
    
    ns.tprint("▓▒░ PLAYER ░▒▓");
    ns.tprint(`  Money:          ${formatMoney(money)}`);
    ns.tprint(`  Hacking Level:  ${player.skills.hacking}`);
    ns.tprint(`  Karma:          ${formatNumber(player.karma)}`);
    ns.tprint("");
}

function showNetworkStats(ns) {
    const allServers = scanAll(ns);
    const rootedServers = getRootedServers(ns);
    const hackableServers = getHackableServers(ns);
    
    const rootPercent = ((rootedServers.length / allServers.length) * 100).toFixed(1);
    
    ns.tprint("▓▒░ NETWORK ░▒▓");
    ns.tprint(`  Total Servers:    ${allServers.length}`);
    ns.tprint(`  Rooted:           ${rootedServers.length} (${rootPercent}%)`);
    ns.tprint(`  Hackable:         ${hackableServers.length}`);
    ns.tprint("");
}

function showServerStats(ns) {
    const stats = getServerStats(ns);
    const homeRam = ns.getServerMaxRam("home");
    
    ns.tprint("▓▒░ SERVERS ░▒▓");
    ns.tprint(`  Purchased:        ${stats.count}/${stats.maxPossible}`);
    ns.tprint(`  Total RAM:        ${formatRam(stats.totalRam)}`);
    ns.tprint(`  RAM Range:        ${formatRam(stats.minRam)} - ${formatRam(stats.maxRam)}`);
    ns.tprint(`  Home RAM:         ${formatRam(homeRam)}`);
    ns.tprint("");
}

function showModuleHealth(ns) {
    const health = getSystemHealth(ns);
    
    ns.tprint("▓▒░ MODULES ░▒▓");
    
    for (const module of health.modules) {
        const status = module.healthy ? "✓" : "✗";
        const state = module.running ? "RUNNING" : "STOPPED";
        const enabled = module.enabled ? "" : " (disabled)";
        
        ns.tprint(`  ${status} ${module.name.padEnd(15)} ${state}${enabled}`);
    }
    
    ns.tprint("");
    
    if (health.allHealthy) {
        ns.tprint("  System Status: ✓ ALL SYSTEMS OPERATIONAL");
    } else {
        ns.tprint("  System Status: ✗ ISSUES DETECTED");
    }
    
    ns.tprint("");
}

function showDetailedStats(ns) {
    ns.tprint("▓▒░ CONFIGURATION ░▒▓");
    ns.tprint(`  Loop Delay:       ${config.orchestrator.loopDelay}ms`);
    ns.tprint(`  Reserved Home:    ${formatRam(config.hacking.reservedHomeRam)}`);
    ns.tprint(`  Max Server RAM:   ${formatRam(config.servers.maxServerRam)}`);
    ns.tprint(`  Auto Buy Servers: ${config.servers.autoBuyServers ? "Yes" : "No"}`);
    ns.tprint(`  Auto Join Factions: ${config.factions.autoJoinFactions ? "Yes" : "No"}`);
    ns.tprint(`  Auto Buy Augments: ${config.augmentations.autoBuyAugments ? "Yes" : "No"}`);
    ns.tprint("");
    
    // Show running scripts
    ns.tprint("▓▒░ RUNNING SCRIPTS ░▒▓");
    const processes = ns.ps("home");
    const angelProcesses = processes.filter(p => p.filename.includes("/angel/"));
    
    if (angelProcesses.length === 0) {
        ns.tprint("  No ANGEL scripts running");
    } else {
        for (const proc of angelProcesses) {
            const ram = proc.threads * ns.getScriptRam(proc.filename);
            ns.tprint(`  ${proc.filename.padEnd(30)} (${formatRam(ram)})`);
        }
    }
    
    ns.tprint("");
}
