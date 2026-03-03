/**
 * ANGEL Discord Bot - Enhanced Control Portal
 * Comprehensive monitoring, reporting, and control via Discord
 * Mobile-friendly interface for secure remote management
 */

import { Client, GatewayIntentBits, REST, Routes, ButtonBuilder, ActionRowBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN) {
    console.error('❌ DISCORD_TOKEN not found in .env');
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Utility function to format large numbers
const formatNum = (num, decimals = 2) => {
    if (num >= 1e9) return (num / 1e9).toFixed(decimals) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(decimals) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(decimals) + 'K';
    return num.toFixed(decimals);
};

const normalizeStatusPayload = (payload = {}) => {
    const latestData = payload.latestData || {};
    const metrics = payload.metrics || {};
    const legacyStats = payload.stats || {};

    return {
        latestData,
        totalSamples: Number(metrics.totalSamples ?? legacyStats.total_samples ?? 0),
        avgMoneyRate: Number(metrics.avgMoneyRate ?? legacyStats.avg_money_rate ?? 0),
        activeModules: Number(legacyStats.unique_modules ?? 0),
        lastUpdate: Number(payload.lastUpdate || 0) || Date.now(),
    };
};

const parseRawData = (row = {}) => {
    try {
        return row?.raw_data ? JSON.parse(row.raw_data) : {};
    } catch {
        return {};
    }
};

const toNum = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const progressBar = (percent, width = 14) => {
    const bounded = Math.max(0, Math.min(100, toNum(percent, 0)));
    const filled = Math.round((bounded / 100) * width);
    return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`;
};

// Slash commands - comprehensive monitoring & control
const commands = [
    // === MONITORING ===
    {
        name: 'angel-status',
        description: '📊 Get real-time ANGEL system status and metrics'
    },
    {
        name: 'angel-status-full',
        description: '🧾 Full terminal-style ANGEL dashboard snapshot'
    },
    {
        name: 'angel-modules',
        description: '📦 View detailed status of all modules'
    },
    {
        name: 'angel-income',
        description: '💰 Detailed income breakdown by source'
    },
    {
        name: 'angel-report',
        description: '📈 Complete telemetry and performance report'
    },
    {
        name: 'angel-performance',
        description: '⚡ Performance metrics and efficiency analysis'
    },
    {
        name: 'angel-health',
        description: '❤️ System health check'
    },
    
    // === CONTROL ===
    {
        name: 'angel-pause',
        description: '⏸️ Pause ANGEL execution'
    },
    {
        name: 'angel-resume',
        description: '▶️ Resume ANGEL execution'
    },
    {
        name: 'angel-restart-module',
        description: '🔄 Restart a specific module',
        options: [
            {
                name: 'module',
                description: 'Module to restart',
                type: 3, // STRING
                required: true,
                choices: [
                    { name: 'hacking', value: 'hacking' },
                    { name: 'servers', value: 'servers' },
                    { name: 'augments', value: 'augments' },
                    { name: 'gang', value: 'gang' },
                    { name: 'stocks', value: 'stocks' },
                    { name: 'corporation', value: 'corporation' }
                ]
            }
        ]
    },
    {
        name: 'angel-daemon-unlock',
        description: '🔓 Manually unlock daemon advancement (progression will begin if ready)'
    },
    
    // === INFORMATION ===
    {
        name: 'angel-help',
        description: '❓ Show all available commands and usage'
    },
    {
        name: 'angel-uptime',
        description: '⏱️ Show session uptime and reset history'
    },
    {
        name: 'angel-targets',
        description: '🎯 View current hack targets and strategy'
    }
];

// Bot event: Ready
client.on('ready', () => {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   ANGEL Discord Bot - Enhanced Portal  ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`✓ Logged in as ${client.user.tag}`);
    console.log(`✓ Backend: ${BACKEND_URL}`);
    console.log(`✓ Ready for monitoring & control\n`);

    // Register slash commands
    registerSlashCommands();
});

// Bot event: Interaction (slash commands)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        switch (interaction.commandName) {
            case 'angel-status':
                await handleStatusCommand(interaction);
                break;
            case 'angel-status-full':
                await handleStatusFullCommand(interaction);
                break;
            case 'angel-modules':
                await handleModulesCommand(interaction);
                break;
            case 'angel-income':
                await handleIncomeCommand(interaction);
                break;
            case 'angel-report':
                await handleReportCommand(interaction);
                break;
            case 'angel-performance':
                await handlePerformanceCommand(interaction);
                break;
            case 'angel-health':
                await handleHealthCommand(interaction);
                break;
            case 'angel-pause':
                await handlePauseCommand(interaction);
                break;
            case 'angel-resume':
                await handleResumeCommand(interaction);
                break;
            case 'angel-restart-module':
                await handleRestartModuleCommand(interaction);
                break;
            case 'angel-daemon-unlock':
                await handleDaemonUnlockCommand(interaction);
                break;
            case 'angel-help':
                await handleHelpCommand(interaction);
                break;
            case 'angel-uptime':
                await handleUptimeCommand(interaction);
                break;
            case 'angel-targets':
                await handleTargetsCommand(interaction);
                break;
            default:
                await interaction.reply('Unknown command');
        }
    } catch (error) {
        console.error('Command error:', error);
        await interaction.reply({ content: '❌ Error executing command', ephemeral: true });
    }
});

// ============================================
// COMMAND HANDLERS
// ============================================

async function handleStatusCommand(interaction) {
    await interaction.deferReply();

    try {
        const response = await axios.get(`${BACKEND_URL}/api/status`);
        const normalized = normalizeStatusPayload(response.data);
        const latestData = normalized.latestData;
        const overview = response.data?.overview || {};
        const phase = toNum(overview?.phase?.current, 0);
        const phasePct = toNum(overview?.phase?.percent, 0);
        const phaseLabel = ['Bootstrap', 'Early', 'Mid', 'Gang', 'Late'][Math.max(0, Math.min(4, phase))] || 'Unknown';
        const activeModules = normalized.activeModules || (Array.isArray(response.data?.modules) ? response.data.modules.length : 0);

        const compact = [
            `Phase: ${phaseLabel} [${progressBar(phasePct, 10)}] ${phasePct.toFixed(0)}%`,
            `Money: $${formatNum(toNum(latestData?.current_money))} | Rate: $${formatNum(toNum(latestData?.money_rate))}/s`,
            `XP: ${String(latestData?.hack_level ?? 'N/A')} | Rate: ${formatNum(toNum(latestData?.xp_rate))}/s`,
            `RAM: ${(toNum(latestData?.memory_used) / 1024).toFixed(1)}GB | Modules: ${activeModules}`,
            `Uptime: ${formatUptime(toNum(latestData?.uptime))} | Status: ${latestData?.module_status === 'running' ? 'Running' : 'Idle'}`,
        ].join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('📊 ANGEL Status Snapshot')
            .setDescription(`\`\`\`\n${compact}\n\`\`\``)
            .setTimestamp(new Date(normalized.lastUpdate))
            .addFields(
                {
                    name: '💰 Money Rate',
                    value: latestData?.money_rate ? `$${formatNum(latestData.money_rate)}/s` : 'N/A',
                    inline: true
                },
                {
                    name: '📚 XP Rate',
                    value: latestData?.xp_rate ? `${formatNum(latestData.xp_rate)}/s` : 'N/A',
                    inline: true
                },
                {
                    name: '🔴 Hack Level',
                    value: String(latestData?.hack_level ?? 'N/A'),
                    inline: true
                },
                {
                    name: '💾 Memory Used',
                    value: latestData?.memory_used ? `${(latestData.memory_used / 1024).toFixed(2)}GB` : 'N/A',
                    inline: true
                },
                {
                    name: '🎯 Current Module',
                    value: latestData?.module_name || 'Unknown',
                    inline: true
                },
                {
                    name: '🟢 Status',
                    value: latestData?.module_status === 'running' ? '✅ Running' : '⏸️ Idle',
                    inline: true
                },
                {
                    name: '📊 Total Samples',
                    value: String(normalized.totalSamples),
                    inline: true
                },
                {
                    name: '📦 Active Modules',
                    value: String(activeModules),
                    inline: true
                }
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Status error:', error.message);
        await interaction.editReply('❌ Failed to fetch status');
    }
}

async function handleStatusFullCommand(interaction) {
    await interaction.deferReply();

    try {
        const [statusResponse, modulesResponse] = await Promise.all([
            axios.get(`${BACKEND_URL}/api/status`),
            axios.get(`${BACKEND_URL}/api/modules`),
        ]);

        const statusPayload = statusResponse.data || {};
        const normalized = normalizeStatusPayload(statusPayload);
        const latestData = normalized.latestData;
        const overview = statusPayload.overview || {};
        const modules = Array.isArray(modulesResponse?.data?.modules) ? modulesResponse.data.modules : [];

        // Create module map from modules array using 'name' and 'details'
        const moduleMap = {};
        modules.forEach(m => {
            moduleMap[m.name] = m.details || {};
        });

        // PHASE
        const phase = toNum(overview?.phase?.current, 0);
        const phasePct = toNum(overview?.phase?.percent, 0);
        const phaseLabel = ['Bootstrap', 'Early Scaling', 'Mid-Game', 'Gang', 'Late'][Math.max(0, Math.min(4, phase))] || 'Unknown';
        const phaseBar = `[${progressBar(phasePct, 16)}] ${phasePct.toFixed(1)}%`;

        // Extract focus from phase module details
        const phaseDetails = moduleMap['phase'] || {};
        // (Focus/secondary removed from dashboard display)

        // MONEY
        const currentMoney = toNum(latestData?.current_money);
        const moneyRate = toNum(latestData?.money_rate);
        const dailyMoney = moneyRate * 86400;

        // XP
        const hackLevel = String(latestData?.hack_level ?? 'N/A');
        const xpRate = toNum(latestData?.xp_rate);

        // NETWORK (from servers module or deprecated)
        const serversDetails = moduleMap['servers'] || {};
        const rootedServers = toNum(serversDetails?.rooted, 0);
        const backdooredServers = toNum(serversDetails?.backdoored, 0);
        const purchasedServers = toNum(serversDetails?.purchased, 0);

        // RAM
        const memoryUsedGb = (toNum(latestData?.memory_used) / 1024).toFixed(1);
        const memoryMaxGb = toNum(overview?.angelLite?.currentRam, 8) / 1024;
        const ramPct = toNum(overview?.angelLite?.percent, 0);
        const ramBar = `${progressBar(ramPct, 14)} ${memoryUsedGb}GB`;

        // XP FARM (get threads and target from hacking module, not xpFarm)
        const hackingDetails = moduleMap['hacking'] || {};
        const xpFarmThreads = toNum(hackingDetails?.activeThreads, 0);
        const xpFarmTarget = hackingDetails?.currentTarget || 'n/a';

        // ACTIVITY (not displayed in trimmed dashboard)
        // const activitiesDetails = moduleMap['activities'] || {};

        // GANG
        const gangDetails = moduleMap['gang'] || {};
        const gangMembers = toNum(gangDetails?.members, 0);
        const gangTerritory = ((toNum(gangDetails?.territory, 0) || 0) * 100).toFixed(1);
        const gangRespect = formatNum(toNum(gangDetails?.respect, 0), 0);
        const gangWanted = formatNum(toNum(gangDetails?.wantedPenalty, 0), 2);
        const gangMoneyRate = toNum(gangDetails?.moneyRate, 0);

        // STOCKS
        const stocksDetails = moduleMap['stocks'] || {};
        const stocksHoldings = toNum(stocksDetails?.stocks, 0);
        const stocksBought = toNum(stocksDetails?.bought, 0);
        const stocksSold = toNum(stocksDetails?.sold, 0);
        const stocksValue = formatNum(toNum(stocksDetails?.portfolioValue, 0));
        const stocksGain = toNum(stocksDetails?.totalProfits, 0);
        const stocksGainPct = stocksValue > 0 ? ((stocksGain / toNum(stocksValue.replace(/[^0-9]/g, ''), 1)) * 100).toFixed(1) : '0.0';

        // HACKNET
        const hacknetDetails = moduleMap['hacknet'] || {};
        const hacknetNodes = toNum(hacknetDetails?.nodeCount, 0);
        const hacknetProduction = formatNum(toNum(hacknetDetails?.production, 0));
        const hacknetTotal = formatNum(toNum(hacknetDetails?.total, 0));

        // PROGRAMS
        const programsDetails = moduleMap['programs'] || {};
        const programsPurchased = toNum(programsDetails?.programsOwned, 0);

        // TIME TO RESET (from augments module resetCountdown)
        const avgMoneyRate = toNum(statusPayload?.metrics?.avgMoneyRate, moneyRate);
        const augmentsDetails = moduleMap['augments'] || {};
        let timeToResetStr = 'N/A';
        let augmentTargetStr = 'N/A';
        let augmentGapsStr = '';
        
        // augmentsDetails is the 'details' object, not wrapped
        const installed = toNum(augmentsDetails?.installed, 0);
        const queued = toNum(augmentsDetails?.queued, 0);
        const resetData = augmentsDetails?.resetCountdown;
        
        if (resetData) {
            const targetAugName = resetData.targetAugName || 'Unknown';
            const targetAugFaction = resetData.targetAugFaction || 'Unknown';
            const progressPct = Math.min(100, toNum(resetData.progressPercent, 0));
            const repPercent = Math.min(100, toNum(resetData.repPercent, 0));
            const moneyNeeded = toNum(resetData.moneyNeeded, 0);
            const repNeeded = toNum(resetData.repNeeded, 0);
            
            augmentTargetStr = `${targetAugName} (${targetAugFaction})`;
            
            // Show gaps if not ready
            if (moneyNeeded > 0 || repNeeded > 0) {
                const moneyGapStr = moneyNeeded > 0 ? `💰 ${formatNum(moneyNeeded)}` : '';
                const repGapStr = repNeeded > 0 ? `⭐ ${(repNeeded / 1000).toFixed(0)}k rep` : '';
                const gapItems = [moneyGapStr, repGapStr].filter(x => x);
                augmentGapsStr = ` [${gapItems.join(' | ')}]`;
            } else {
                augmentGapsStr = ` [READY]`;
            }
            
            if (queued > 0) {
                // Augmentations are queued and ready to install
                timeToResetStr = `Ready! (${queued} queued)`;
            } else if (moneyNeeded > 0 && avgMoneyRate > 0) {
                // Calculate countdown to accumulate money for target augmentation
                const timeToResetSec = moneyNeeded / avgMoneyRate;
                timeToResetStr = `~${formatUptime(timeToResetSec)}`;
            } else if (moneyNeeded <= 0 && queued === 0) {
                // Have money but no augmentations queued - waiting for faction rep
                timeToResetStr = `Ready to buy!`;
            }
        }

        const dashboardLines = [
            `ANGEL COMPREHENSIVE DASHBOARD`,
            `────────────────────────────────────────`,
            `PHASE: ${phaseLabel} ${phaseBar}`,
            `AUGMENT TARGET: ${augmentTargetStr}${augmentGapsStr}`,
            `RAM: ${ramBar}`,
            `MONEY: $${formatNum(currentMoney)} | Rate: $${formatNum(moneyRate)}/s | Daily: $${formatNum(dailyMoney)}`,
            `XP: Level ${hackLevel} | Rate: ${formatNum(xpRate)}/s`,
            `NETWORK: Rooted ${rootedServers} | Backdoored ${backdooredServers} | Purchased ${purchasedServers}`,
            `XP FARM: Threads ${xpFarmThreads} | Target ${xpFarmTarget}`,
            `GANG: Members ${gangMembers} | Territory ${gangTerritory}% | Respect ${gangRespect} | Wanted ${gangWanted} | Income $${formatNum(gangMoneyRate)}/s`,
            `STOCKS: Holdings ${stocksHoldings} | Bought ${stocksBought} | Value $${stocksValue} | Gain ${stocksGainPct}%`,
            `HACKNET: ${hacknetNodes} nodes | Production $${hacknetProduction}/s | Total $${hacknetTotal}`,
            `PROGRAMS: ${programsPurchased} purchased`,
            `TIME TO RESET: ${timeToResetStr}`,
        ];

        const embed = new EmbedBuilder()
            .setColor(0x4da3ff)
            .setTitle('🧾 ANGEL Status (Full Dashboard)')
            .setDescription(`\`\`\`\n${dashboardLines.join('\n')}\n\`\`\``)
            .setFooter({ text: `Last update: ${new Date(normalized.lastUpdate).toLocaleString()}` })
            .setTimestamp(new Date(normalized.lastUpdate));

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Status full error:', error.message);
        await interaction.editReply('❌ Failed to fetch full status dashboard');
    }
}

async function handleModulesCommand(interaction) {
    await interaction.deferReply();

    try {
        const response = await axios.get(`${BACKEND_URL}/api/modules`);
        const { modules } = response.data;

        const embed = new EmbedBuilder()
            .setColor(0x0099ff)
            .setTitle('📦 Module Status Overview')
            .setTimestamp();

        modules.forEach(mod => {
            const status = mod.module_status === 'running' ? '✅' : mod.module_status === 'idle' ? '⏸️' : '⚫';
            embed.addFields({
                name: `${status} ${mod.module_name}`,
                value: `Money: $${formatNum(mod.money_rate || 0)}/s | XP: ${formatNum(mod.xp_rate || 0)}/s | RAM: ${(mod.memory_used || 0).toFixed(2)}MB | Execs: ${mod.execution_count || 0}`,
                inline: false
            });
        });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Modules error:', error.message);
        await interaction.editReply('❌ Failed to fetch modules');
    }
}

async function handleIncomeCommand(interaction) {
    await interaction.deferReply();

    try {
        const response = await axios.get(`${BACKEND_URL}/api/status`);
        const normalized = normalizeStatusPayload(response.data);
        const latestData = normalized.latestData;

        const embed = new EmbedBuilder()
            .setColor(0x00dd00)
            .setTitle('💰 Income Breakdown')
            .setTimestamp()
            .addFields(
                {
                    name: '💵 Total Income Rate',
                    value: `$${formatNum(latestData?.money_rate || 0)}/s`,
                    inline: false
                },
                {
                    name: '📊 Average Money Rate',
                    value: `$${formatNum(normalized.avgMoneyRate || 0)}/s`,
                    inline: true
                },
                {
                    name: '⏱️ Uptime',
                    value: formatUptime(latestData?.uptime || 0),
                    inline: true
                },
                {
                    name: '💸 Session Money',
                    value: latestData?.current_money ? `$${formatNum(latestData.current_money)}` : 'N/A',
                    inline: true
                }
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Income error:', error.message);
        await interaction.editReply('❌ Failed to fetch income data');
    }
}

async function handleReportCommand(interaction) {
    await interaction.deferReply();

    try {
        const response = await axios.get(`${BACKEND_URL}/api/stats`);
        const { stats } = response.data;

        const embed = new EmbedBuilder()
            .setColor(0x9933ff)
            .setTitle('📈 Complete Telemetry Report')
            .setTimestamp()
            .addFields(
                {
                    name: '📊 Total Samples',
                    value: (stats.total_samples || 0).toString(),
                    inline: true
                },
                {
                    name: '📦 Active Modules',
                    value: (stats.unique_modules || 0).toString(),
                    inline: true
                },
                {
                    name: '💰 Avg Money Rate',
                    value: `$${formatNum(stats.avg_money_rate || 0)}/s`,
                    inline: true
                },
                {
                    name: '📚 Avg XP Rate',
                    value: `${formatNum(stats.avg_xp_rate || 0)}/s`,
                    inline: true
                },
                {
                    name: '💾 Avg Memory',
                    value: `${(stats.avg_memory || 0).toFixed(2)}MB`,
                    inline: true
                },
                {
                    name: '🎯 Hack Level Range',
                    value: `${stats.min_hack_level || 0} - ${stats.max_hack_level || 0}`,
                    inline: true
                }
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Report error:', error.message);
        await interaction.editReply('❌ Failed to generate report');
    }
}

async function handlePerformanceCommand(interaction) {
    await interaction.deferReply();

    try {
        const response = await axios.get(`${BACKEND_URL}/api/status`);
        const { latestData, stats } = response.data;

        // Calculate efficiency metrics
        const moneyPerMemory = (latestData?.money_rate || 0) / Math.max(latestData?.memory_used || 1, 1);
        const xpPerMemory = (latestData?.xp_rate || 0) / Math.max(latestData?.memory_used || 1, 1);

        const embed = new EmbedBuilder()
            .setColor(0xff9900)
            .setTitle('⚡ Performance Metrics')
            .setTimestamp()
            .addFields(
                {
                    name: '💰 Money Efficiency',
                    value: `$${formatNum(moneyPerMemory)}/MB/s`,
                    inline: true
                },
                {
                    name: '📚 XP Efficiency',
                    value: `${formatNum(xpPerMemory)}/MB/s`,
                    inline: true
                },
                {
                    name: '💾 Memory Usage',
                    value: `${(latestData?.memory_used || 0).toFixed(2)}MB`,
                    inline: true
                },
                {
                    name: '⏱️ Session Duration',
                    value: formatUptime(latestData?.uptime || 0),
                    inline: true
                }
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Performance error:', error.message);
        await interaction.editReply('❌ Failed to fetch performance data');
    }
}

async function handleHealthCommand(interaction) {
    await interaction.deferReply();

    try {
        const response = await axios.get(`${BACKEND_URL}/api/status`);
        const { latestData } = response.data;

        // Simple health checks
        const isRunning = latestData?.module_status === 'running';
        const memoryOk = (latestData?.memory_used || 0) < 1024; // Less than 1GB
        const hasIncome = (latestData?.money_rate || 0) > 0;

        let healthStatus = '✅ Healthy';
        let healthColor = 0x00ff00;

        if (!isRunning) {
            healthStatus = '⚠️ Not running';
            healthColor = 0xffff00;
        } else if (!hasIncome) {
            healthStatus = '⚠️ No income';
            healthColor = 0xffff00;
        }

        const embed = new EmbedBuilder()
            .setColor(healthColor)
            .setTitle('❤️ System Health Check')
            .setTimestamp()
            .addFields(
                {
                    name: 'Status',
                    value: healthStatus,
                    inline: false
                },
                {
                    name: 'Running',
                    value: isRunning ? '✅ Yes' : '❌ No',
                    inline: true
                },
                {
                    name: 'Memory OK',
                    value: memoryOk ? '✅ Yes' : '⚠️ High',
                    inline: true
                },
                {
                    name: 'Income Present',
                    value: hasIncome ? '✅ Yes' : '⚠️ No',
                    inline: true
                }
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Health error:', error.message);
        await interaction.editReply('❌ Failed to check system health');
    }
}

async function handlePauseCommand(interaction) {
    await interaction.deferReply();

    try {
        await axios.post(`${BACKEND_URL}/api/commands`, {
            commandType: 'pause',
            parameters: {}
        });

        await interaction.editReply('⏸️ ANGEL paused - execution suspended');
    } catch (error) {
        await interaction.editReply('❌ Failed to pause ANGEL');
    }
}

async function handleResumeCommand(interaction) {
    await interaction.deferReply();

    try {
        await axios.post(`${BACKEND_URL}/api/commands`, {
            commandType: 'resume',
            parameters: {}
        });

        await interaction.editReply('▶️ ANGEL resumed - execution continues');
    } catch (error) {
        await interaction.editReply('❌ Failed to resume ANGEL');
    }
}

async function handleRestartModuleCommand(interaction) {
    await interaction.deferReply();

    try {
        const module = interaction.options.getString('module');

        await axios.post(`${BACKEND_URL}/api/commands`, {
            commandType: 'restart_module',
            parameters: { module }
        });

        await interaction.editReply(`🔄 Restarting module: **${module}**`);
    } catch (error) {
        await interaction.editReply('❌ Failed to restart module');
    }
}

async function handleHelpCommand(interaction) {
    await interaction.deferReply();

    const helpEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('❓ ANGEL Discord Bot - Complete Help')
        .setDescription('Comprehensive control portal for Angel automation system')
        .addFields(
            {
                name: '📊 Monitoring Commands',
                value: '`/angel-status` - Compact status snapshot\n`/angel-status-full` - Full dashboard view\n`/angel-modules` - Module status\n`/angel-income` - Income breakdown\n`/angel-performance` - Efficiency metrics\n`/angel-health` - System health check',
                inline: false
            },
            {
                name: '📈 Reporting Commands',
                value: '`/angel-report` - Complete telemetry report\n`/angel-uptime` - Session uptime and history\n`/angel-targets` - Current hack targets',
                inline: false
            },
            {
                name: '⚡ Control Commands',
                value: '`/angel-pause` - Pause execution\n`/angel-resume` - Resume execution\n`/angel-restart-module` - Restart specific module\n`/angel-daemon-unlock` - Unlock daemon progression (manual approval)',
                inline: false
            },
            {
                name: '💡 Tips',
                value: '• Use on mobile for remote monitoring\n• Commands update every 1-2 seconds\n• Safe to use while game is running\n• No need to close existing windows',
                inline: false
            }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [helpEmbed] });
}

async function handleUptimeCommand(interaction) {
    await interaction.deferReply();

    try {
        const response = await axios.get(`${BACKEND_URL}/api/status`);
        const { latestData } = response.data;

        const embed = new EmbedBuilder()
            .setColor(0x1abc9c)
            .setTitle('⏱️ Session Uptime & History')
            .setTimestamp()
            .addFields(
                {
                    name: 'Current Session',
                    value: formatUptime(latestData?.uptime || 0),
                    inline: true
                },
                {
                    name: 'Status',
                    value: latestData?.uptime > 0 ? '✅ Active' : '⏸️ Not running',
                    inline: true
                }
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Uptime error:', error.message);
        await interaction.editReply('❌ Failed to fetch uptime data');
    }
}

async function handleTargetsCommand(interaction) {
    await interaction.deferReply();

    try {
        const response = await axios.get(`${BACKEND_URL}/api/status`);
        const { latestData } = response.data;

        let rawData = {};
        try {
            rawData = latestData?.raw_data ? JSON.parse(latestData.raw_data) : {};
        } catch {
            rawData = {};
        }

        const embed = new EmbedBuilder()
            .setColor(0xf39c12)
            .setTitle('🎯 Hacking Targets & Strategy')
            .setTimestamp()
            .addFields(
                {
                    name: 'Current Module',
                    value: latestData?.module_name || 'N/A',
                    inline: true
                },
                {
                    name: 'Hack Level',
                    value: latestData?.hack_level ? latestData.hack_level.toString() : 'N/A',
                    inline: true
                },
                {
                    name: 'Money Rate',
                    value: `$${formatNum(latestData?.money_rate || 0)}/s`,
                    inline: true
                },
                {
                    name: 'XP Rate',
                    value: `${formatNum(latestData?.xp_rate || 0)}/s`,
                    inline: true
                }
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Targets error:', error.message);
        await interaction.editReply('❌ Failed to fetch target data');
    }
}

async function handleDaemonUnlockCommand(interaction) {
    await interaction.deferReply();

    try {
        // Send unlock signal to port 15
        const response = await axios.post(`${BACKEND_URL}/api/daemon-unlock`, {
            timestamp: Date.now()
        });

        const embed = new EmbedBuilder()
            .setColor(0x27ae60)
            .setTitle('🔓 Daemon Advancement Unlocked')
            .setDescription('✅ Manual unlock signal sent! Daemon progression will begin when ready.')
            .addFields(
                {
                    name: 'Status',
                    value: 'Waiting for augmentation threshold...',
                    inline: false
                },
                {
                    name: 'Next Step',
                    value: 'System will advance to next daemon node once conditions are met',
                    inline: false
                }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Daemon unlock error:', error.message);
        const embed = new EmbedBuilder()
            .setColor(0xe74c3c)
            .setTitle('❌ Daemon Unlock Failed')
            .setDescription(error.response?.data?.message || 'Failed to send unlock signal')
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatUptime(seconds) {
    if (!seconds || seconds <= 0) return '0 seconds';
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
}

// Register slash commands with Discord
async function registerSlashCommands() {
    try {
        const rest = new REST({ version: '10' }).setToken(TOKEN);

        console.log('Registering slash commands...');
        if (GUILD_ID) {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, GUILD_ID),
                { body: commands }
            );
            console.log(`✓ Registered as guild commands for ${GUILD_ID}`);
        } else {
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: commands }
            );
            console.log('✓ Registered as global commands (may take time to appear)');
        }

        console.log(`✓ ${commands.length} slash commands registered\n`);
    } catch (error) {
        console.error('Failed to register commands:', error);
    }
}

// Login
client.login(TOKEN);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\nShutting down Discord bot...');
    client.destroy();
    process.exit(0);
});
