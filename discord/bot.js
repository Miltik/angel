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

// Slash commands - comprehensive monitoring & control
const commands = [
    // === MONITORING ===
    {
        name: 'angel-status',
        description: '📊 Get real-time ANGEL system status and metrics'
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
        const { lastUpdate, latestData, stats } = response.data;

        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('📊 ANGEL Real-Time Status')
            .setTimestamp(new Date(lastUpdate))
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
                    value: latestData?.hack_level || 'N/A',
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
                    value: stats?.total_samples ? stats.total_samples.toString() : '0',
                    inline: true
                },
                {
                    name: '📦 Active Modules',
                    value: stats?.unique_modules ? stats.unique_modules.toString() : '0',
                    inline: true
                }
            );

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Status error:', error.message);
        await interaction.editReply('❌ Failed to fetch status');
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
        const { latestData, stats } = response.data;

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
                    value: `$${formatNum(stats?.avg_money_rate || 0)}/s`,
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
                value: '`/angel-status` - Real-time system metrics\n`/angel-modules` - Module status\n`/angel-income` - Income breakdown\n`/angel-performance` - Efficiency metrics\n`/angel-health` - System health check',
                inline: false
            },
            {
                name: '📈 Reporting Commands',
                value: '`/angel-report` - Complete telemetry report\n`/angel-uptime` - Session uptime and history\n`/angel-targets` - Current hack targets',
                inline: false
            },
            {
                name: '⚡ Control Commands',
                value: '`/angel-pause` - Pause execution\n`/angel-resume` - Resume execution\n`/angel-restart-module` - Restart specific module',
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
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );

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
