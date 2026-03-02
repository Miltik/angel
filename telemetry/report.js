/**
 * ANGEL TELEMETRY REPORT GENERATOR
 * 
 * Generates comprehensive reports from telemetry data
 * 
 * Usage:
 *   run /angel/telemetry/report.js              - Full report
 *   run /angel/telemetry/report.js --summary    - Quick summary
 *   run /angel/telemetry/report.js --modules    - Module breakdown
 *   run /angel/telemetry/report.js --timeline   - Timeline analysis
 *   run /angel/telemetry/report.js --history    - Historical comparison
 *   run /angel/telemetry/report.js --optimize   - Optimization suggestions
 * 
 * @param {NS} ns
 */

import {
    getCurrentRun,
    getRunHistory,
    calculateRunStats,
    detectBottlenecks,
    generateSuggestions,
    formatDuration,
    formatMoney,
} from '/angel/telemetry/telemetry.js';

export async function main(ns) {
    ns.disableLog('ALL');
    ns.tail();
    
    const args = ns.args;
    const run = getCurrentRun();
    
    if (!run) {
        ns.tprint('❌ No telemetry data available');
        ns.tprint('Start Angel with telemetry enabled to collect data');
        return;
    }
    
    // Determine report type
    if (args.includes('--summary')) {
        printSummaryReport(ns);
    } else if (args.includes('--modules')) {
        printModuleReport(ns);
    } else if (args.includes('--timeline')) {
        printTimelineReport(ns);
    } else if (args.includes('--history')) {
        printHistoryReport(ns);
    } else if (args.includes('--optimize')) {
        printOptimizationReport(ns);
    } else {
        // Full report
        printFullReport(ns);
    }
}

// ============================================
// SUMMARY REPORT
// ============================================

function printSummaryReport(ns) {
    const stats = calculateRunStats();
    if (!stats) return;
    
    ns.clearLog();
    ns.print('╔════════════════════════════════════════════════════════════╗');
    ns.print('║         ANGEL TELEMETRY - SUMMARY REPORT                   ║');
    ns.print('╚════════════════════════════════════════════════════════════╝');
    ns.print('');
    
    ns.print(`⏱️  Run Duration:     ${formatDuration(stats.duration)}`);
    ns.print(`💰 Current Money:    ${formatMoney(stats.currentMoney)} (+${formatMoney(stats.moneyRate * 60)}/min)`);
    ns.print(`💻 Hack Level:       ${stats.currentHackLevel} (+${(stats.xpRate * 60).toFixed(1)}/min)`);
    ns.print('');
    
    ns.print(`📊 Module Activity:`);
    ns.print(`   ${stats.moduleCount} modules active`);
    ns.print(`   ${stats.totalExecutions} total executions`);
    ns.print(`   ${stats.totalFailures} failures (${((stats.totalFailures / Math.max(1, stats.totalExecutions)) * 100).toFixed(1)}%)`);
    ns.print(`   ${stats.avgExecutionTime.toFixed(0)}ms avg execution time`);
    ns.print('');
    
    ns.print(`🎯 Milestones:       ${stats.milestoneCount} achieved`);
    ns.print(`📝 Events Logged:    ${stats.eventCount}`);
    ns.print('');
    
    if (stats.bottlenecks.length > 0) {
        ns.print(`⚠️  Bottlenecks:      ${stats.bottlenecks.length} detected`);
        for (const mod of stats.bottlenecks.slice(0, 3)) {
            ns.print(`   • ${mod.name}: ${mod.failures} failures, ${mod.uptime.toFixed(0)}% uptime`);
        }
    } else {
        ns.print(`✓ No bottlenecks detected`);
    }
    
    ns.print('');
    ns.print('Run with --modules, --timeline, --history, or --optimize for more details');
}

// ============================================
// MODULE REPORT
// ============================================

function printModuleReport(ns) {
    const stats = calculateRunStats();
    if (!stats) return;
    
    ns.clearLog();
    ns.print('╔════════════════════════════════════════════════════════════╗');
    ns.print('║         ANGEL TELEMETRY - MODULE REPORT                    ║');
    ns.print('╚════════════════════════════════════════════════════════════╝');
    ns.print('');
    
    ns.print('Top Performing Modules:');
    ns.print('─────────────────────────────────────────────────────────────');
    ns.print(padString('Module', 20) + padString('Runs', 10) + padString('Fails', 10) + 
             padString('Avg Time', 12) + padString('Success%', 10));
    ns.print('─────────────────────────────────────────────────────────────');
    
    for (const mod of stats.topModules) {
        ns.print(
            padString(mod.name, 20) +
            padString(mod.executions.toString(), 10) +
            padString(mod.failures.toString(), 10) +
            padString(mod.avgDuration.toFixed(0) + 'ms', 12) +
            padString(mod.successRate.toFixed(1) + '%', 10)
        );
    }
    
    ns.print('');
    
    if (stats.bottlenecks.length > 0) {
        ns.print('⚠️  Modules Needing Attention:');
        ns.print('─────────────────────────────────────────────────────────────');
        
        for (const mod of stats.bottlenecks) {
            ns.print(`${mod.name}:`);
            ns.print(`  Executions: ${mod.executions}, Failures: ${mod.failures}`);
            ns.print(`  Success Rate: ${mod.successRate.toFixed(1)}%, Uptime: ${mod.uptime.toFixed(1)}%`);
            ns.print('');
        }
    }
}

// ============================================
// TIMELINE REPORT
// ============================================

function printTimelineReport(ns) {
    const run = getCurrentRun();
    if (!run) return;
    
    ns.clearLog();
    ns.print('╔════════════════════════════════════════════════════════════╗');
    ns.print('║         ANGEL TELEMETRY - TIMELINE REPORT                  ║');
    ns.print('╚════════════════════════════════════════════════════════════╝');
    ns.print('');
    
    // Milestones
    if (run.milestones.length > 0) {
        ns.print('🎯 Milestones Achieved:');
        ns.print('─────────────────────────────────────────────────────────────');
        
        for (const milestone of run.milestones) {
            const elapsed = formatDuration(milestone.time - run.startTime);
            ns.print(`[${elapsed}] ${milestone.module}: ${milestone.milestone}`);
            
            if (Object.keys(milestone.data).length > 0) {
                const dataStr = Object.entries(milestone.data)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', ');
                ns.print(`  ${dataStr}`);
            }
        }
        
        ns.print('');
    }
    
    // Money/XP growth over time
    if (run.samples.length > 10) {
        ns.print('📈 Growth Curve:');
        ns.print('─────────────────────────────────────────────────────────────');
        
        const intervals = [0, 0.25, 0.5, 0.75, 1.0];
        for (const interval of intervals) {
            const idx = Math.floor(run.samples.length * interval);
            const sample = run.samples[Math.min(idx, run.samples.length - 1)];
            const elapsed = formatDuration(sample.time - run.startTime);
            
            ns.print(`[${padString(elapsed, 15)}] Money: ${padString(formatMoney(sample.money), 15)} Level: ${sample.hackLevel}`);
        }
        
        ns.print('');
    }
    
    // Recent significant events
    if (run.events.length > 0) {
        ns.print('📝 Recent Events (last 10):');
        ns.print('─────────────────────────────────────────────────────────────');
        
        const recentEvents = run.events.slice(-10);
        for (const event of recentEvents) {
            const elapsed = formatDuration(event.time - run.startTime);
            ns.print(`[${elapsed}] ${event.module}: ${event.type}`);
        }
    }
}

// ============================================
// HISTORY REPORT
// ============================================

function printHistoryReport(ns) {
    const history = getRunHistory();
    const current = getCurrentRun();
    
    ns.clearLog();
    ns.print('╔════════════════════════════════════════════════════════════╗');
    ns.print('║         ANGEL TELEMETRY - HISTORY REPORT                   ║');
    ns.print('╚════════════════════════════════════════════════════════════╝');
    ns.print('');
    
    if (history.length === 0) {
        ns.print('No historical data available yet');
        ns.print('Complete at least one BitNode run to see historical comparison');
        return;
    }
    
    ns.print(`Historical Runs: ${history.length}`);
    ns.print('─────────────────────────────────────────────────────────────');
    ns.print('');
    
    for (let i = 0; i < history.length; i++) {
        const run = history[i];
        const duration = formatDuration(run.duration || 0);
        const startDate = new Date(run.startTime).toLocaleString();
        
        ns.print(`Run #${i + 1} - ${startDate}`);
        ns.print(`  Duration: ${duration}`);
        ns.print(`  Modules: ${Object.keys(run.modules).length}`);
        ns.print(`  Executions: ${Object.values(run.modules).reduce((sum, m) => sum + m.executions, 0)}`);
        ns.print(`  Milestones: ${run.milestones?.length || 0}`);
        
        // Start vs end state
        if (run.startState && run.samples?.length > 0) {
            const endSample = run.samples[run.samples.length - 1];
            const moneyGain = endSample.money - run.startState.money;
            const levelGain = endSample.hackLevel - run.startState.hackLevel;
            
            ns.print(`  Money Gain: ${formatMoney(moneyGain)}`);
            ns.print(`  Level Gain: +${levelGain}`);
        }
        
        ns.print('');
    }
    
    // Compare current run to historical average
    if (current) {
        ns.print('Current Run vs. Historical Average:');
        ns.print('─────────────────────────────────────────────────────────────');
        
        const avgDuration = history.reduce((sum, r) => sum + (r.duration || 0), 0) / history.length;
        const currentDuration = Date.now() - current.startTime;
        
        ns.print(`Duration: ${formatDuration(currentDuration)} (avg: ${formatDuration(avgDuration)})`);
        
        const avgModules = history.reduce((sum, r) => sum + Object.keys(r.modules).length, 0) / history.length;
        ns.print(`Active Modules: ${Object.keys(current.modules).length} (avg: ${avgModules.toFixed(1)})`);
    }
}

// ============================================
// OPTIMIZATION REPORT
// ============================================

function printOptimizationReport(ns) {
    const bottlenecks = detectBottlenecks();
    const suggestions = generateSuggestions();
    
    ns.clearLog();
    ns.print('╔════════════════════════════════════════════════════════════╗');
    ns.print('║         ANGEL TELEMETRY - OPTIMIZATION REPORT              ║');
    ns.print('╚════════════════════════════════════════════════════════════╝');
    ns.print('');
    
    // Bottlenecks
    if (bottlenecks.length > 0) {
        ns.print('⚠️  Detected Bottlenecks:');
        ns.print('─────────────────────────────────────────────────────────────');
        
        for (const bottleneck of bottlenecks) {
            const severityIcon = bottleneck.severity === 'high' ? '🔴' : 
                               bottleneck.severity === 'medium' ? '🟡' : '🟢';
            
            ns.print(`${severityIcon} ${bottleneck.description}`);
            ns.print(`   Module: ${bottleneck.module}`);
            ns.print(`   Suggestion: ${bottleneck.suggestion}`);
            ns.print('');
        }
    } else {
        ns.print('✓ No bottlenecks detected - system running smoothly!');
        ns.print('');
    }
    
    // Suggestions
    if (suggestions.length > 0) {
        ns.print('💡 Optimization Suggestions:');
        ns.print('─────────────────────────────────────────────────────────────');
        
        for (const suggestion of suggestions) {
            const impactIcon = suggestion.impact === 'high' ? '⚡' : 
                             suggestion.impact === 'medium' ? '📊' : '🔧';
            
            ns.print(`${impactIcon} ${suggestion.description}`);
            ns.print(`   ${suggestion.suggestion}`);
            ns.print(`   Impact: ${suggestion.impact}`);
            ns.print('');
        }
    } else {
        ns.print('✓ No optimization suggestions - configuration looks good!');
    }
    
    ns.print('─────────────────────────────────────────────────────────────');
    ns.print('');
    ns.print('To apply suggestions, edit /angel/config.js and adjust:');
    ns.print('  • Module intervals');
    ns.print('  • Module priorities');
    ns.print('  • Worker thread allocations');
    ns.print('  • RAM upgrade thresholds');
}

// ============================================
// FULL REPORT
// ============================================

function printFullReport(ns) {
    ns.clearLog();
    
    printSummaryReport(ns);
    ns.print('');
    ns.print('═════════════════════════════════════════════════════════════');
    ns.print('');
    
    printModuleReport(ns);
    ns.print('');
    ns.print('═════════════════════════════════════════════════════════════');
    ns.print('');
    
    printOptimizationReport(ns);
    ns.print('');
    ns.print('═════════════════════════════════════════════════════════════');
    ns.print('');
    
    ns.print('For more detailed reports:');
    ns.print('  --timeline : View milestone timeline and growth curves');
    ns.print('  --history  : Compare with previous runs');
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function padString(str, length) {
    if (typeof str !== 'string') str = String(str);
    return str + ' '.repeat(Math.max(0, length - str.length));
}
