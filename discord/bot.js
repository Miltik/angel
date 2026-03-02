/**
 * ANGEL Discord Bot
 * Real-time monitoring and control via Discord
 */

import { Client, GatewayIntentBits, REST, Routes } from 'discord.js';
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

// Slash commands
const commands = [
    {
        name: 'angel-status',
        description: 'Get ANGEL system status'
    },
    {
        name: 'angel-pause',
        description: 'Pause ANGEL execution'
    },
    {
        name: 'angel-resume',
        description: 'Resume ANGEL execution'
    },
    {
        name: 'angel-report',
        description: 'Get telemetry report'
    }
];

// Bot event: Ready
client.on('ready', () => {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   ANGEL Discord Bot Started            ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`✓ Logged in as ${client.user.tag}`);
    console.log(`✓ Backend: ${BACKEND_URL}`);
    console.log(`✓ Ready to receive commands\n`);

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
            case 'angel-pause':
                await handlePauseCommand(interaction);
                break;
            case 'angel-resume':
                await handleResumeCommand(interaction);
                break;
            case 'angel-report':
                await handleReportCommand(interaction);
                break;
            default:
                await interaction.reply('Unknown command');
        }
    } catch (error) {
        console.error('Command error:', error);
        await interaction.reply('Error executing command');
    }
});

// Command handlers
async function handleStatusCommand(interaction) {
    await interaction.deferReply();

    try {
        const response = await axios.get(`${BACKEND_URL}/api/status`);
        const { lastUpdate, latestData } = response.data;

        const embed = {
            color: 0x00ff00,
            title: '📊 ANGEL Status',
            fields: [
                {
                    name: 'Last Update',
                    value: new Date(lastUpdate).toLocaleString(),
                    inline: false
                },
                {
                    name: 'Module',
                    value: latestData?.module_name || 'Unknown',
                    inline: true
                },
                {
                    name: 'Money Rate',
                    value: `$${(latestData?.money_rate || 0).toFixed(2)}/s`,
                    inline: true
                },
                {
                    name: 'XP Rate',
                    value: `${(latestData?.xp_rate || 0).toFixed(2)}/s`,
                    inline: true
                }
            ],
            timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error('Status command error:', error);
        await interaction.editReply('Failed to fetch status');
    }
}

async function handlePauseCommand(interaction) {
    await interaction.deferReply();

    try {
        await axios.post(`${BACKEND_URL}/api/commands`, {
            commandType: 'pause',
            parameters: {}
        });

        await interaction.editReply('⏸️ ANGEL paused');
    } catch (error) {
        await interaction.editReply('Failed to pause ANGEL');
    }
}

async function handleResumeCommand(interaction) {
    await interaction.deferReply();

    try {
        await axios.post(`${BACKEND_URL}/api/commands`, {
            commandType: 'resume',
            parameters: {}
        });

        await interaction.editReply('▶️ ANGEL resumed');
    } catch (error) {
        await interaction.editReply('Failed to resume ANGEL');
    }
}

async function handleReportCommand(interaction) {
    await interaction.deferReply();

    try {
        const response = await axios.get(`${BACKEND_URL}/api/stats`);
        const { stats } = response.data;

        const embed = {
            color: 0x0099ff,
            title: '📈 ANGEL Report',
            fields: [
                {
                    name: 'Total Samples',
                    value: stats.total_samples?.toString() || '0',
                    inline: true
                },
                {
                    name: 'Active Modules',
                    value: stats.unique_modules?.toString() || '0',
                    inline: true
                },
                {
                    name: 'Avg Money Rate',
                    value: `$${(stats.avg_money_rate || 0).toFixed(2)}/s`,
                    inline: true
                }
            ],
            timestamp: new Date()
        };

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        await interaction.editReply('Failed to generate report');
    }
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

        console.log('✓ Slash commands registered');
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
