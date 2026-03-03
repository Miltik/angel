# ANGEL Discord Bot - Setup & Usage Guide

## Overview

The ANGEL Discord Bot provides a **secure, mobile-friendly portal** for monitoring and controlling your Angel automation system from Discord. Access from your phone, laptop, or anywhere with Discord.

**Features:**
- 📊 Real-time system status and metrics
- 📦 Detailed module performance data
- 💰 Income breakdown by source
- ⚡ Efficiency and performance metrics
- 🔄 Control execution (pause/resume/restart)
- ❤️ System health checks
- 📈 Complete telemetry reports

---

## Prerequisites

1. **Discord Server** - Create one or use existing
2. **Discord Bot Token** - Create bot in Discord Developer Portal
3. **Backend Running** - `npm run backend:start` in `/server` folder
4. **Node.js** - v18+

---

## Step 1: Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"**
3. Name it `ANGEL` (or preferred name)
4. Go to **"Bot"** section → Click **"Add Bot"**
5. Under **TOKEN**, click **"Copy"** (save this safely)
6. Go to **OAuth2 → URL Generator**:
   - Scopes: ✓ `bot`
   - Permissions: ✓ `Send Messages`, ✓ `Embed Links`, ✓ `Read Messages/View Channels`
7. Copy the generated URL and open in browser → Authorize to your server

---

## Step 2: Environment Setup

Create `.env` file in `/discord/` folder:

```bash
# Required
DISCORD_TOKEN=your_bot_token_here

# Optional (defaults shown)
BACKEND_URL=http://localhost:3000
GUILD_ID=your_server_id_here
```

**Where to get values:**
- `DISCORD_TOKEN` - From Developer Portal (Step 1)
- `GUILD_ID` - Right-click Discord server → "Copy Server ID" (enable Developer Mode first)

---

## Step 3: Start Bot

```bash
# From /discord folder
npm start

# Or with watch mode for development
npm run dev
```

**Expected output:**
```
╔════════════════════════════════════════╗
║   ANGEL Discord Bot - Enhanced Portal  ║
╚════════════════════════════════════════╝

✓ Logged in as ANGEL#1234
✓ Backend: http://localhost:3000
✓ Ready for monitoring & control
✓ 11 slash commands registered
```

---

## Available Commands

### 📊 Monitoring

| Command | Description |
|---------|-------------|
| `/angel-status` | Real-time metrics (money rate, XP, hack level, memory) |
| `/angel-modules` | Status of all running modules |
| `/angel-income` | Detailed income breakdown and rates |
| `/angel-performance` | Efficiency metrics and ratios |
| `/angel-health` | System health check (running, memory, income) |

### 📈 Reporting

| Command | Description |
|---------|-------------|
| `/angel-report` | Complete telemetry and statistics |
| `/angel-uptime` | Session duration and history |
| `/angel-targets` | Current hack targets and strategy |

### ⚡ Control

| Command | Description |
|---------|-------------|
| `/angel-pause` | Pause Angel execution |
| `/angel-resume` | Resume Angel execution |
| `/angel-restart-module <module>` | Restart specific module (hacking, servers, etc.) |

### ❓ Help

| Command | Description |
|---------|-------------|
| `/angel-help` | Show all commands and usage tips |

---

## Usage Examples

### On Your Phone
1. Open Discord mobile app
2. Go to your Angel server
3. Tap the **"/"** icon to see all commands
4. Select any `/angel-*` command
5. View real-time status instantly

### Monitor While Gaming
- Keep Discord in second window/monitor
- Run `/angel-status` every few minutes
- See income rates, module status, system health
- No need to minimize or interrupt Bitburner

### Remote Control from Anywhere
- Away from home? Check Discord
- See if Angel is running smoothly
- Pause if needed, resume when ready
- All from your phone in a pinch

---

## Data Refresh Rate

Commands fetch data **on-demand** from the backend:
- Latest telemetry: **Real-time**
- Module stats: **Last 10 minutes**
- Reports: **Last hour aggregates**
- Response time: **<1 second** (usually instant)

---

## Troubleshooting

### Bot doesn't respond
- Check Discord token is correct in `.env`
- Verify backend is running: `curl http://localhost:3000/health`
- Restart bot: `npm start`

### Command says "Failed to fetch"
- Backend offline? Start it: `npm run backend:start`
- Check URL in `.env` matches your backend
- Verify game is sending telemetry

### Can't invite bot to server
- Go back to OAuth2 → URL Generator
- Make sure `bot` scope is checked
- Regenerate URL and use that

### Wrong data showing
- Wait 10 seconds for telemetry to sync
- Run game's `run /angel/start.js` to ensure data flow
- Check backend database: `cd server && npm run db:status`

---

## Advanced Setup

### Production Deployment
If deploying bot to a server (e.g., Replit, Railway):

```bash
# Use environment variables instead of .env file
export DISCORD_TOKEN="your_token"
export BACKEND_URL="https://your-backend.railway.app"
npm start
```

### Multiple Servers
Run multiple bot instances with different configs:

```bash
GUILD_ID=server1 npm start
GUILD_ID=server2 npm start --port 3001
```

### Custom Commands
Edit `bot.js` to add custom commands following the existing pattern:

```javascript
{
    name: 'angel-custom',
    description: 'My custom command'
}
```

Then add handler:

```javascript
case 'angel-custom':
    await handleCustomCommand(interaction);
    break;
```

---

## Security Notes

✅ **Safe to use:**
- No passwords sent through Discord
- No sensitive data exposed
- Commands only queue actions (nothing destructive by default)
- All communication over HTTPS in production

❌ **Don't:**
- Share your Discord token publicly
- Add untrusted users as admins
- Run on completely open networks

---

## Next Steps

1. ✅ Create Discord bot
2. ✅ Setup `.env` file  
3. ✅ Start bot: `npm start`
4. ✅ Test: `/angel-status` in Discord
5. ✅ Monitor Angel from your phone!

**Questions?** Check bot logs or backend status with `/angel-health`

Happy monitoring! 🚀
