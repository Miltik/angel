/**
 * ANGEL TELEMETRY - REAL-TIME UI DASHBOARD
 * 
 * Live monitoring window showing real-time telemetry data
 * 
 * Usage:
 *   run /angel/telemetry/ui.js
 * 
 * @param {NS} ns
 */

import {
    getCurrentRun,
    calculateRunStats,
    detectBottlenecks,
    formatDuration,
    formatMoney,
} from '/angel/telemetry/telemetry.js';

import { createWindow } from '/angel/modules/uiManager.js';

const UI_ID = 'telemetry';
const UPDATE_INTERVAL = 2000; // Update every 2s

/**
 * Wraps the window object to provide helper methods for formatting output
 */
function createUIWrapper(window) {
    return {
        log: (msg, level = 'info') => window.log(msg, level),
        clear: () => window.clear(),
        header: (title) => {
            window.log('', 'info');
            window.log('═'.repeat(50), 'info');
            window.log(`  ${title}`, 'info');
            window.log('═'.repeat(50), 'info');
            window.log('', 'info');
        },
        separator: () => window.log('─'.repeat(50), 'info'),
        section: (name) => {
            window.log('', 'info');
            window.log(`► ${name}`, 'info');
            window.log('─'.repeat(50), 'info');
        },
        show: () => window.show(),
    };
}

export async function main(ns) {
    ns.disableLog('ALL');
    
    const windowObj = createWindow(UI_ID, 'Angel Telemetry', 700, 500);
    const ui = createUIWrapper(windowObj);
    ui.show();
    
    let lastUpdate = 0;
    
    while (true) {
        const now = Date.now();
        
        if (now - lastUpdate >= UPDATE_INTERVAL) {
            try {
                updateTelemetryUI(ui, ns);
                lastUpdate = now;
            } catch (e) {
                ui.log(`Error updating UI: ${e}`, 'error');
            }
        }
        
        await ns.sleep(1000);
    }
}

function updateTelemetryUI(ui, ns) {
    const run = getCurrentRun();
    
    if (!run) {
        ui.clear();
        ui.header('ANGEL TELEMETRY - NO DATA');
        ui.log('No telemetry data available', 'warn');
        ui.log('Ensure telemetry.js is running in the background', 'info');
        return;
    }
    
    const stats = calculateRunStats();
    if (!stats) {
        ui.clear();
        ui.header('ANGEL TELEMETRY - LOADING...');
        return;
    }
    
    ui.clear();
    
    // Header
    ui.header('ANGEL TELEMETRY - LIVE DASHBOARD');
    ui.separator();
    
    // Run Info
    ui.section('Current Run');
    ui.log(`⏱️  Duration:        ${formatDuration(stats.duration)}`);
    ui.log(`📊 Last Updated:    ${new Date(stats.lastUpdate).toLocaleTimeString()}`);
    ui.log(`🔄 Samples:         ${run.samples.length}`);
    ui.separator();
    
    // Performance Metrics
    ui.section('Performance');
    ui.log(`💰 Money:           ${formatMoney(stats.currentMoney)}`);
    ui.log(`   Rate:           ${formatMoney(stats.moneyRate * 60)}/min`);
    ui.log(`💻 Hack Level:      ${stats.currentHackLevel}`);
    ui.log(`   Rate:           +${(stats.xpRate * 60).toFixed(1)}/min`);
    ui.separator();
    
    // Module Activity
    ui.section('Module Activity');
    ui.log(`Active Modules:    ${stats.moduleCount}`);
    ui.log(`Total Executions:  ${stats.totalExecutions}`);
    ui.log(`Failures:          ${stats.totalFailures} (${((stats.totalFailures / Math.max(1, stats.totalExecutions)) * 100).toFixed(1)}%)`);
    ui.log(`Avg Exec Time:     ${stats.avgExecutionTime.toFixed(0)}ms`);
    ui.separator();
    
    // Top Performers
    if (stats.topModules.length > 0) {
        ui.section('Top Performers');
        
        for (let i = 0; i < Math.min(5, stats.topModules.length); i++) {
            const mod = stats.topModules[i];
            const statusIcon = mod.successRate > 95 ? '✓' : mod.successRate > 85 ? '⚠' : '✗';
            
            ui.log(`${statusIcon} ${mod.name}`);
            ui.log(`   ${mod.executions} runs, ${mod.successRate.toFixed(1)}% success, ${mod.avgDuration.toFixed(0)}ms avg`);
        }
        
        ui.separator();
    }
    
    // Bottlenecks
    const bottlenecks = detectBottlenecks();
    if (bottlenecks.length > 0) {
        ui.section('⚠️  Bottlenecks');
        
        for (const bottleneck of bottlenecks.slice(0, 3)) {
            const severityIcon = bottleneck.severity === 'high' ? '🔴' : 
                               bottleneck.severity === 'medium' ? '🟡' : '🟢';
            
            ui.log(`${severityIcon} ${bottleneck.description}`, 'warn');
            ui.log(`   ${bottleneck.suggestion}`, 'info');
        }
        
        ui.separator();
    }
    
    // Milestones
    if (run.milestones.length > 0) {
        ui.section(`Milestones (${run.milestones.length})`);
        
        const recentMilestones = run.milestones.slice(-3);
        for (const milestone of recentMilestones) {
            const elapsed = formatDuration(milestone.time - run.startTime);
            ui.log(`[${elapsed}] ${milestone.module}: ${milestone.milestone}`);
        }
        
        ui.separator();
    }
    
    // Growth Chart (simple ASCII)
    if (run.samples.length >= 10) {
        ui.section('Money Growth');
        drawMoneyChart(ui, run.samples);
        ui.separator();
    }
    
    // Footer
    ui.log('Run /angel/telemetry/report.js for detailed reports', 'info');
}

function drawMoneyChart(ui, samples) {
    // Draw simple ASCII chart of money growth
    const width = 50;
    const height = 5;
    
    // Sample every N samples to fit width
    const step = Math.max(1, Math.floor(samples.length / width));
    const chartSamples = [];
    
    for (let i = 0; i < samples.length; i += step) {
        chartSamples.push(samples[i].money);
    }
    
    // Normalize to chart height
    const maxMoney = Math.max(...chartSamples);
    const minMoney = Math.min(...chartSamples);
    const range = maxMoney - minMoney;
    
    if (range === 0) {
        ui.log('Insufficient data for chart');
        return;
    }
    
    // Build chart rows (top to bottom)
    const chart = [];
    for (let row = height - 1; row >= 0; row--) {
        let line = '';
        const threshold = minMoney + (range * row / height);
        
        for (const money of chartSamples) {
            if (money >= threshold) {
                line += '█';
            } else {
                line += ' ';
            }
        }
        
        chart.push(line);
    }
    
    // Display chart
    ui.log(`Max: ${formatMoney(maxMoney)}`);
    for (const row of chart) {
        ui.log(row);
    }
    ui.log(`Min: ${formatMoney(minMoney)}`);
}
