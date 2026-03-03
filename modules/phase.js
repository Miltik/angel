import { config } from "/angel/config.js";
import { createWindow } from "/angel/modules/uiManager.js";

/**
 * Phase Tracking Module
 * 
 * Single source of truth for game phase progression.
 * Calculates phase based on player stats and broadcasts to:
 * - PHASE_PORT (port 7) for module coordination
 * - TELEMETRY_PORT for backend/UI display
 * 
 * Phase definitions (0-4):
 * - Phase 0: Bootstrap (H:0-74, Money $0-9M)
 * - Phase 1: Early Scaling (H:75-199, Money $10M-99M)
 * - Phase 2: Mid-Game (H:200-499, Money $100M-499M)
 * - Phase 3: Gang Phase (H:500-799, Money $500M+)
 * - Phase 4: Late Game (H:800+, Stats 70+)
 */

const PHASE_PORT = 7;
const TELEMETRY_PORT = 20;

// State tracking
let lastState = {
    phase: null,
    loopCount: 0,
};

let telemetryState = {
    lastReportTime: 0,
};

/** @param {NS} ns */
export async function main(ns) {
    ns.disableLog("ALL");
    
    const ui = createWindow("phase", "📊 Phase Tracker", 600, 350, ns);
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ui.log("📊 Phase tracking module initialized", "success");
    ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    // Initialize telemetry
    telemetryState.lastReportTime = Date.now();

    while (true) {
        try {
            const loopStartTime = Date.now();
            const phase = calculateGamePhase(ns);
            lastState.loopCount++;

            // Broadcast phase to PHASE_PORT for module coordination
            ns.clearPort(PHASE_PORT);
            ns.writePort(PHASE_PORT, phase);

            // Log phase transitions and periodic status
            if (phase !== lastState.phase) {
                const player = ns.getPlayer();
                const money = ns.getServerMoneyAvailable("home") + player.money;
                ui.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
                ui.log(`🎯 Phase Transition: ${lastState.phase ?? '?'} → ${phase}`, "info");
                ui.log(`💰 ${formatMoney(money)} | 🔧 H:${player.skills.hacking}`, "info");
                displayPhaseInfo(ns, ui, phase);
                lastState.phase = phase;
            } else if (lastState.loopCount % 12 === 1) {
                const player = ns.getPlayer();
                const money = ns.getServerMoneyAvailable("home") + player.money;
                ui.log(`📊 Phase ${phase} | 💰 ${formatMoney(money)} | 🔧 H:${player.skills.hacking}`, "info");
            }

            // Report telemetry every 5 seconds
            const now = Date.now();
            if (now - telemetryState.lastReportTime >= 5000) {
                reportTelemetry(ns, phase);
                telemetryState.lastReportTime = now;
            }

            // Sleep until next check (10 seconds)
            const elapsed = Date.now() - loopStartTime;
            await ns.sleep(Math.max(100, 10000 - elapsed));

        } catch (e) {
            ns.print(`❌ Phase module error: ${e}`);
            await ns.sleep(10000);
        }
    }
}

/**
 * Calculate current game phase from player progress
 * Aligned with config.gamePhases.thresholds
 */
function calculateGamePhase(ns) {
    const player = ns.getPlayer();
    const money = ns.getServerMoneyAvailable("home") + player.money;
    const hack = player.skills.hacking;
    const minCombat = Math.min(
        player.skills.strength,
        player.skills.defense,
        player.skills.dexterity,
        player.skills.agility
    );
    
    const thresholds = config.gamePhases?.thresholds || {};

    const p01 = thresholds.phase0to1 || { hackLevel: 75, money: 10000000 };
    const p12 = thresholds.phase1to2 || { hackLevel: 200, money: 100000000 };
    const p23 = thresholds.phase2to3 || { hackLevel: 500, money: 500000000 };
    const p34 = thresholds.phase3to4 || { hackLevel: 800, stats: 70 };

    // Phase 4: Late game
    if (hack >= p34.hackLevel && minCombat >= p34.stats) return 4;
    
    // Phase 3: Gang phase
    if (hack >= p23.hackLevel && money >= p23.money) return 3;
    
    // Phase 2: Mid-game
    if (hack >= p12.hackLevel && money >= p12.money) return 2;
    
    // Phase 1: Early scaling
    if (hack >= p01.hackLevel && money >= p01.money) return 1;
    
    // Phase 0: Bootstrap
    return 0;
}

/**
 * Display phase information and progress
 */
function displayPhaseInfo(ns, ui, phase) {
    const phaseNames = ["Bootstrap", "Early Scaling", "Mid-Game", "Gang Phase", "Late Game"];
    const phaseName = phaseNames[phase] || "Unknown";
    const phaseConfig = config.gamePhases?.[`phase${phase}`] || {};
    const primaryFocus = phaseConfig.primaryActivity || "none";
    
    ui.log(`📋 ${phaseName} (Phase ${phase})`, "info");
    ui.log(`🎯 Focus: ${primaryFocus}`, "info");
    
    // Show next phase requirements
    if (phase < 4) {
        const thresholds = config.gamePhases?.thresholds || {};
        const player = ns.getPlayer();
        const money = ns.getServerMoneyAvailable("home") + player.money;
        const hack = player.skills.hacking;
        const minCombat = Math.min(player.skills.strength, player.skills.defense, player.skills.dexterity, player.skills.agility);
        
        const nextPhaseKey = `phase${phase}to${phase + 1}`;
        const nextThreshold = thresholds[nextPhaseKey];
        
        if (nextThreshold) {
            const requirements = [];
            if (nextThreshold.hackLevel) {
                const progress = Math.min(100, (hack / nextThreshold.hackLevel) * 100);
                requirements.push(`H:${hack}/${nextThreshold.hackLevel} (${progress.toFixed(0)}%)`);
            }
            if (nextThreshold.money) {
                const progress = Math.min(100, (money / nextThreshold.money) * 100);
                requirements.push(`$${formatMoney(money)}/${formatMoney(nextThreshold.money)} (${progress.toFixed(0)}%)`);
            }
            if (nextThreshold.stats) {
                const progress = Math.min(100, (minCombat / nextThreshold.stats) * 100);
                requirements.push(`Combat:${minCombat}/${nextThreshold.stats} (${progress.toFixed(0)}%)`);
            }
            
            ui.log(`⏭️  Next: ${requirements.join(" | ")}`, "info");
        }
    } else {
        ui.log("🏆 Maximum phase reached!", "success");
    }
}

/**
 * Report phase telemetry to backend
 */
function reportTelemetry(ns, phase) {
    try {
        const player = ns.getPlayer();
        const money = ns.getServerMoneyAvailable("home") + player.money;
        
        const payload = JSON.stringify({
            module: 'phase',
            timestamp: Date.now(),
            metrics: {
                phase,
                hackLevel: player.skills.hacking,
                money,
                minCombat: Math.min(
                    player.skills.strength,
                    player.skills.defense,
                    player.skills.dexterity,
                    player.skills.agility
                ),
                loopCount: lastState.loopCount,
            },
        });
        
        ns.writePort(TELEMETRY_PORT, payload);
    } catch (e) {
        ns.print(`❌ Phase telemetry error: ${e}`);
    }
}

/**
 * Format money with abbreviations
 */
function formatMoney(amount) {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    
    if (absAmount >= 1e15) return `${sign}${(absAmount / 1e15).toFixed(2)}q`;
    if (absAmount >= 1e12) return `${sign}${(absAmount / 1e12).toFixed(2)}t`;
    if (absAmount >= 1e9) return `${sign}${(absAmount / 1e9).toFixed(2)}b`;
    if (absAmount >= 1e6) return `${sign}${(absAmount / 1e6).toFixed(2)}m`;
    if (absAmount >= 1e3) return `${sign}${(absAmount / 1e3).toFixed(2)}k`;
    return `${sign}${absAmount.toFixed(2)}`;
}
