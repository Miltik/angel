# ANGEL Remote Ecosystem - Local Setup Guide

🎮 **Complete guide to running ANGEL with Discord integration, web dashboard, and mobile monitoring locally on your machine.**

---

## Quick Start (3 Steps)

```bash
# 1. Install dependencies for all components
cd server && npm install && cd ..
cd web && npm install && cd ..
cd discord && npm install && cd ..

# 2. Copy environment templates
cp server/.env.example server/.env
cp discord/.env.example discord/.env

# 3. Open 3 terminals and run:
# Terminal 1: Backend
cd server && npm start

# Terminal 2: Web Dashboard
cd web && npm run dev

# Terminal 3: Discord Bot
cd discord && npm start
```

That's it! Your ecosystem is running.

---

## Component Details

### Backend Server (Terminal 1)
```bash
cd server
npm install
npm start
```

- **Address**: `http://localhost:3000`
- **API**: REST endpoints for telemetry, commands, status
- **WebSocket**: Real-time updates to dashboard
- **Database**: SQLite at `server/data/data.db` (auto-created)

**Health Check**:
```bash
curl http://localhost:3000/health
```

### Web Dashboard (Terminal 2)
```bash
cd web
npm install
npm run dev
```

- **Address**: `http://localhost:5173`
- **Features**: 
  - Real-time stats & metrics
  - Command buttons (pause, resume, run report)
  - Historical charts
  - Mobile-responsive

**View on Phone** (same WiFi):
1. Get your computer's IP: `ipconfig` → look for `IPv4 Address` (e.g., `192.168.1.100`)
2. On phone browser: `http://192.168.1.100:5173`

### Discord Bot (Terminal 3)
```bash
cd discord
npm install
npm start
```

- **Setup**: Add Discord token to `discord/.env`
- **Features**:
  - Real-time alerts
  - Status slash commands
  - Control from Discord

**Get Discord Token**:
1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create New Application → copy token
3. Paste in `discord/.env` as `DISCORD_TOKEN=your_token_here`
4. Enable required intents and message content intent
5. Invite bot to your server using OAuth2 URL

---

## Configuration

### Backend (.env)
```env
PORT=3000
HOST=localhost
DISCORD_TOKEN=your_discord_bot_token_here
```

### Discord (.env)
```env
DISCORD_TOKEN=your_discord_bot_token_here
BACKEND_URL=http://localhost:3000
```

---

## Integration with Bitburner

### Step 1: Update config.js
Add backend URL:
```javascript
// config.js
const orchestrator = {
    remoteBackend: {
        enabled: true,
        url: "http://localhost:3000",
        pollInterval: 30000  // Check for commands every 30s
    }
};
```

### Step 2: Modify telemetry.js
Update to send data to backend:
```javascript
// telemetry.js
async function postTelemetry(data) {
    if (!config.orchestrator.remoteBackend.enabled) return;
    
    try {
        await fetch(`${config.orchestrator.remoteBackend.url}/api/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
    } catch (e) {
        // Fall back to local storage if backend unavailable
    }
}
```

### Step 3: Add Command Listener in Angel
In `angel.js`, add periodic command check:
```javascript
async function checkForCommands(ns) {
    const response = await fetch('http://localhost:3000/api/commands');
    const { commands } = await response.json();
    
    for (const cmd of commands) {
        executeCommand(ns, cmd.type, cmd.parameters);
    }
}

// Call periodically (every 30 seconds)
```

---

## Development Workflow

### Making Changes
1. Edit files in `server/src/`, `web/src/`, or `discord/`
2. Backend: Auto-reloads with `npm run dev` (watch mode)
3. Web: Vite hot-reloads automatically
4. Discord: Kill and restart to pick up changes

### Common Tasks

**Add a new API endpoint**:
- Edit `server/src/api.js`
- Add route with `app.post()` or `app.get()`
- Restart backend

**Add a Discord command**:
- Create `discord/commands/yourcommand.js`
- Import in `discord/bot.js`
- Restart bot

**Update dashboard UI**:
- Edit `web/src/pages/` or `web/src/components/`
- Changes auto-reload

### Debugging

**Backend logs**:
```
server/data/backend.log
```

**Web console**:
- Open DevTools in browser (F12)
- Check Console & Network tabs

**Discord logs**:
```
discord/discord.log
```

---

## Troubleshooting

### "Cannot find module" error
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Port already in use
```bash
# Change PORT in .env or run on different port
PORT=3001 npm start
```

### WebSocket connection fails
- Check backend is running on correct port
- Check CORS settings in `server/src/index.js`
- Browser console should show connection attempt

### Discord bot doesn't respond
- Verify token in `.env`
- Check bot has required intents enabled
- Verify bot is in your server
- Restart bot: `npm start`

### Database locked error
- Close all connections
- Delete `server/data/data.db`
- Restart backend (rebuilds database)

---

## Performance Notes

### Resource Usage
- Backend: ~50-100 MB RAM
- Web dashboard: ~100-150 MB (browser)
- Discord bot: ~40-60 MB
- **Total**: ~200-300 MB very lightweight

### Bandwidth
- Local only: Zero internet usage
- Telemetry: ~1-2 KB per update
- WebSocket: ~100 bytes per update
- Discord: Only when alerts/commands

### SQLite Database
- Stores 7 days of telemetry
- Auto-retains last 1000 samples per module
- Auto-cleans old data daily

---

## Stopping Everything

```bash
# Terminal 1 (Backend)
Ctrl+C

# Terminal 2 (Web)
Ctrl+C

# Terminal 3 (Discord)
Ctrl+C
```

---

## Next Steps

1. **Test backend**: `curl http://localhost:3000/health`
2. **View dashboard**: Open `http://localhost:5173`
3. **Add to Discord**: Invite bot to server
4. **Sync Bitburner**: Update `sync.js` to use new backend config
5. **Monitor**: Watch telemetry flow in real-time

---

## Architecture Diagram

```
Your Computer:
┌─────────────────────────────────────────────────┐
│  Bitburner Browser                              │
│  ↓ (POST telemetry every 10s)                  │
│  ↓ (GET commands every 30s)                    │
│  ┌─────────────────────────────────────────┐  │
│  │ Backend (localhost:3000)                │  │
│  │ ├─ SQLite Database                      │  │
│  │ ├─ REST API                            │  │
│  │ └─ WebSocket                           │  │
│  └────┬────────────────────────┬──────────┘  │
│       │                        │              │
│  ┌────▼─────────────┐    ┌────▼──────────┐  │
│  │ Web Dashboard     │    │ Discord Bot    │  │
│  │ (localhost:5173)  │    │ (localhost)    │  │
│  └──────────────────┘    └────────────────┘  │
│       ↑                        ↓              │
│  View on Phone            Real-time Alerts   │
│  (192.168.1.x:5173)       & Commands         │
└─────────────────────────────────────────────────┘
```

---

## Support

Having issues? Check the troubleshooting section or review logs in each component directory.

Happy automating! 🚀
