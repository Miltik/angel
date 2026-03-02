# ANGEL Remote Ecosystem - Deployment Guide

Complete guide to deploying ANGEL with full remote integration locally.

---

## 📋 Prerequisites

- **Node.js** v16+ (includes npm)
- **Bitburner** running on localhost:8000
- **GitHub** account (your Angel repo)
- **Discord** account (optional, for Discord bot)

<a href="https://nodejs.org/" target="_blank">Download Node.js →</a>

---

## 🚀 Quick Deployment (5 minutes)

### Step 1: Install All Dependencies

```bash
# Backend
cd server
npm install
cd ..

# Web Dashboard
cd web
npm install
cd ..

# Discord Bot
cd discord
npm install
cd ..
```

### Step 2: Create Environment Files

```bash
# Backend config
cp server/.env.example server/.env

# Discord config
cp discord/.env.example discord/.env
```

### Step 3: Setup Discord (Optional)

If you want Discord integration:

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" → Name it "ANGEL"
3. Go to "Bot" tab → Click "Add Bot"
4. Copy the token
5. Open `discord/.env` and paste:
```env
DISCORD_TOKEN=your_token_here
BACKEND_URL=http://localhost:3000
```
6. Go to OAuth2 → URL Generator
7. Select scopes: `bot`
8. Select permissions: `Send Messages`, `Embed Links`
9. Copy generated URL and open in browser to invite to your server

### Step 4: Start Everything

Open **3 separate terminals**:

**Terminal 1 - Backend:**
```bash
cd server
npm start
```
You should see:
```
🔌 API:       http://localhost:3000
📡 WebSocket: ws://localhost:3001
```

**Terminal 2 - Web Dashboard:**
```bash
cd web
npm run dev
```
You should see:
```
  ➜  Local:   http://localhost:5173/
```

**Terminal 3 - Discord Bot (optional):**
```bash
cd discord
npm start
```
You should see:
```
✓ Logged in as ANGEL#1234
✓ Slash commands registered
```

### Step 5: Test Backend

```bash
curl http://localhost:3000/health
```

Should return:
```json
{"status":"ok","timestamp":1234567890}
```

---

## 🎮 Connect Bitburner

### Step 1: Update config.js

Your `config.js` is already set to:
```javascript
remoteBackend: {
    enabled: true,
    url: "http://localhost:3000",
    telemetryIntervalMs: 10000,
    commandCheckIntervalMs: 30000,
}
```

### Step 2: Sync Scripts

In Bitburner game:
```
run /angel/sync.js
```

Or download fresh:
```
wget https://raw.githubusercontent.com/Miltik/angel/main/bootstrap.js bootstrap.js
run bootstrap.js
```

### Step 3: Start Angel

```
run /angel/start.js
```

### Step 4: Verify Connection

Check web dashboard: `http://localhost:5173`

You should see:
- ✅ Status: Connected
- 📊 Live telemetry data flowing in
- 💰 Money/XP rates updating

---

## 📱 Access Dashboard on Phone

**Same WiFi Required**

1. Find your computer's IP:
   ```bash
   ipconfig
   ```
   Look for `IPv4 Address` (e.g., `192.168.1.100`)

2. On phone browser, open:
   ```
   http://192.168.1.100:5173
   ```

3. See live Angel status on mobile!

---

## 🤖 Discord Commands

Once bot is running in your Discord server:

```
/angel-status      - Get current game status
/angel-pause       - Pause Angel execution
/angel-resume      - Resume Angel execution
/angel-report      - Generate telemetry report
```

---

## 🔧 Troubleshooting

### Backend won't start
```bash
# Check if port 3000 is in use
netstat -an | findstr :3000

# If in use, kill and retry
# Or change PORT in server/.env
```

### Web dashboard won't load
```bash
# Check if backend is running
curl http://localhost:3000/health

# Check CORS settings in server/src/index.js
# Ensure localhost:5173 is allowed
```

### Discord bot offline
```bash
# Check token is correct in discord/.env
# Verify bot is in your server
# Check bot has message permissions
```

### No telemetry data
```bash
# Check Angel is running in game
# Check config.js remoteBackend.enabled = true
# Check backend is receiving in console:
# "✓ API: http://localhost:3000"
```

### Database errors
```bash
# Delete and rebuild database
rm server/data/data.db
npm start  # Restarts and recreates
```

---

## 📊 Monitoring

### Backend Logs
- Watch terminal for API requests
- Check WebSocket client connections
- Database operations logged

### Web Dashboard
- Real-time stats at `http://localhost:5173`
- Refresh button polls latest data
- Command buttons send to backend

### Discord
- Bot status via `/angel-status`
- Real-time alerts in Discord channels
- Commands execute immediately

---

## 🛑 Stopping

Stop all 3 processes:
```bash
# Terminal 1
Ctrl+C

# Terminal 2
Ctrl+C

# Terminal 3
Ctrl+C
```

Everything will gracefully shutdown.

---

## 📈 Architecture Overview

```
Your Computer
├─ Bitburner (localhost:8000)
│  ├─ Sends telemetry to backend
│  └─ Polls backend for commands
│
├─ Backend Server (localhost:3000)
│  ├─ Receives telemetry
│  ├─ Stores in SQLite database
│  ├─ Provides REST API
│  └─ Broadcasts via WebSocket
│
├─ Web Dashboard (localhost:5173)
│  ├─ Connects to backend via WebSocket
│  ├─ Shows real-time stats
│  ├─ Sends commands to backend
│  └─ Mobile-responsive
│
├─ Discord Bot (Discord network)
│  ├─ Connects to backend
│  ├─ Provides slash commands
│  ├─ Sends alerts to Discord
│  └─ Executes commands
│
└─ Your Phone (same WiFi)
   └─ Opens web dashboard without backend
```

---

## 🚀 Performance

- **Backend RAM**: ~50-100 MB
- **Web Dashboard RAM**: ~100-150 MB
- **Discord Bot RAM**: ~40-60 MB
- **Total**: ~200-300 MB (very lightweight)

All local, so:
- ✅ Zero internet dependency
- ✅ Zero latency
- ✅ Zero storage costs
- ✅ Zero bandwidth concerns

---

## 🔐 Security Notes

- All data is **local only**
- No data leaves your computer
- Discord bot token stored in local `.env` (never committed)
- `.env` files are gitignored
- Can safely push code to GitHub

---

## 💡 Pro Tips

1. **Autostart on boot** - Create batch scripts to start all 3 terminals
2. **Systemd service** - Run backend as Linux service for always-on
3. **Docker** - Containerize for easy deployment elsewhere
4. **Mac/Linux** - Works identically, just use `chmod +x` on scripts
5. **Development** - Use `npm run dev` to enable hot-reloading

---

## 🆘 Support

Check the LOCAL_SETUP.md for additional details and examples.

For issues:
1. Check all 3 services are running
2. Verify ports: 3000, 5173, 3001 (WebSocket)
3. Check backend console for errors
4. Review browser DevTools (F12) for web dashboard errors

---

## 🎉 You're Done!

Your ANGEL ecosystem is now running:
- ✅ Bitburner automation
- ✅ Real-time telemetry
- ✅ Web dashboard
- ✅ Discord integration
- ✅ Mobile monitoring

**Enjoy the automated path to victory!** 🚀
