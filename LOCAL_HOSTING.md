# ANGEL Local Development & Hosting Guide

> **Note:** This guide is for running ANGEL entirely on your local machine. No cloud deployment, no monthly fees, 100% local.

---

## Overview

**Architecture:**
```
Bitburner (Game) ←→ Backend (localhost:3000) ←→ Frontend (localhost:5173)
                        ↓
                   SQLite Database (local file)
```

**Components:**
- Backend API: `http://localhost:3000`
- Frontend Dashboard: `http://localhost:5173`
- Database: `server/data/angel.db` (local file)
- Cost: **$0**

---

## Prerequisites

- Node.js 16+ installed
- Git (for version control)
- VS Code (optional, for development)
- 500MB free disk space

---

## Quick Start (5 minutes)

### Terminal 1: Start Backend

```bash
cd c:\Users\cpawl\Documents\GitHub\angel\server
npm start
```

Expected output:
```
╔════════════════════════════════════════╗
║   ANGEL Backend Server Started         ║
╚════════════════════════════════════════╝

🔌 API:       http://localhost:3000
📡 WebSocket: ws://localhost:3001
💻 Dashboard: http://localhost:5173

Ready to receive telemetry from Bitburner...
```

### Terminal 2: Start Frontend

```bash
cd c:\Users\cpawl\Documents\GitHub\angel\web
npm run dev
```

Expected output:
```
VITE v4.5.14  ready in 123 ms

➜  Local:   http://localhost:5173/
➜  press h for help
```

### Terminal 3: In Bitburner

```
run /angel/sync.js
run /angel/start.js
```

Then in browser:
```
http://localhost:5173
```

**Done!** You should see live game data. ✅

---

## Configuration

### Bitburner Config (In-Game)

File: `/angel/config.js`

```javascript
// Remote backend integration - LOCAL ONLY
remoteBackend: {
    enabled: true,
    url: "http://localhost:3000",        // LOCAL: localhost
    telemetryIntervalMs: 10000,
    commandCheckIntervalMs: 30000,
    timeoutMs: 5000,
    retryAttempts: 3,
    enableLogging: false,                // Disable logs in production
},
```

### Backend Config

File: `server/.env` (if needed)

```env
NODE_ENV=development
PORT=3000
HOST=localhost
DATABASE_URL=./data/angel.db
LOG_LEVEL=debug
```

### Frontend Config

File: `web/.env.local`

```env
VITE_BACKEND_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3001
VITE_API_TIMEOUT=30000
VITE_POLL_INTERVAL=5000
VITE_DEBUG=false
```

---

## Keeping Services Running

### Option A: Keep Terminals Open (Current Setup)

- Terminal 1: Backend (`npm start`)
- Terminal 2: Frontend (`npm run dev`)
- Terminal 3+: Free for other tasks

**Pros:** Simple, can see logs in real-time
**Cons:** Must manually restart if terminals close

### Option B: Background Processes (Windows)

Start in background without occupying terminal:

```powershell
# Backend
Start-Process -WindowStyle Minimized -FilePath "node" -ArgumentList "server/index.js" -WorkingDirectory "c:\Users\cpawl\Documents\GitHub\angel\server"

# Frontend  
Start-Process -WindowStyle Minimized -FilePath "npm" -ArgumentList "run", "dev" -WorkingDirectory "c:\Users\cpawl\Documents\GitHub\angel\web"
```

**Pros:** Runs in background
**Cons:** Harder to see logs

---

## Local Workflow

### Daily Startup

**Quick method:**
1. Open Terminal
2. `cd c:\Users\cpawl\Documents\GitHub\angel\server && npm start`
3. Open another Terminal
4. `cd c:\Users\cpawl\Documents\GitHub\angel\web && npm run dev`
5. In browser: `http://localhost:5173`

**Or create a batch file** (see "Startup Scripts" section)

### Checking Status

```bash
# Backend health
curl http://localhost:3000/health

# Latest telemetry
curl http://localhost:3000/api/status | jq

# WebSocket connected (check browser console)
# Visit http://localhost:5173 and press F12
```

### Restarting Services

**Backend:**
- Stop: Ctrl+C in backend terminal
- Start: `npm start` again

**Frontend:**
- Stop: Ctrl+C in frontend terminal
- Start: `npm run dev` again

**Both:**
```bash
# Kill all node processes
Get-Process node | Stop-Process -Force

# Restart both
```

---

## Database Management

### Location

```
c:\Users\cpawl\Documents\GitHub\angel\server\data\angel.db
```

### View Data

```bash
# Install SQLite (if needed)
choco install sqlite

# Open database
sqlite3 server/data/angel.db

# View tables
.tables

# View samples
SELECT * FROM telemetry_samples LIMIT 10;

# Exit
.quit
```

### Backup Database

```bash
# Backup to file
Copy-Item "server/data/angel.db" "server/data/angel-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').db"

# Or commit to Git
git add server/data/angel.db
git commit -m "Database backup - $(Get-Date -Format 'yyyy-MM-dd')"
```

### Reset Database

```bash
# Delete database (will auto-recreate on next backend start)
Remove-Item "server/data/angel.db"

# Restart backend
```

---

## Troubleshooting

### Issue: Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Fix:**
```bash
# Find process using port 3000
Get-NetTCPConnection -LocalPort 3000

# Kill it
Get-Process node | Stop-Process -Force

# Restart backend
cd server && npm start
```

### Issue: Frontend can't reach backend

```
Error: Failed to fetch http://localhost:3000
```

**Fix:**
1. Verify backend is running (check Terminal 1)
2. Test manually: `curl http://localhost:3000/health`
3. Check browser console (F12) for CORS errors
4. Ensure VITE_BACKEND_URL is `http://localhost:3000` (not `localhost:3000`)

### Issue: No telemetry data in dashboard

```
Symptom: Dashboard loads but "Last Update" is old
```

**Fix:**
1. Verify Bitburner is running (`run /angel/start.js`)
2. Check Bitburner console for errors (tail window)
3. Verify config.js has correct backend URL
4. Test backend: `curl http://localhost:3000/api/status`

### Issue: Dashboard won't load

```
Error: ERR_CONNECTION_REFUSED to localhost:5173
```

**Fix:**
1. Verify frontend is running (check Terminal 2)
2. Terminal 2 should show "ready in XXX ms"
3. Try: `npm run dev` again in web directory
4. Check port 5173 isn't used by something else

---

## Best Practices

### 1. Keep Data Safe
- Backup database weekly: `Copy-Item server/data/angel.db server/data/angel-backup.db`
- Commit to Git regularly: `git add . && git commit -m "Progress update"`
- Keep at least 2 backups

### 2. Monitor Performance
- Check database size: `ls -lh server/data/angel.db`
- View system logs: Backend terminal output
- Monitor memory: Task Manager → Node.js processes

### 3. Logs & Debugging
- Backend logs: Terminal 1 (detailed output)
- Frontend logs: F12 browser console
- Bitburner logs: Tail window in game

### 4. Regular Maintenance
- Clear old telemetry (monthly): `DELETE FROM telemetry_samples WHERE timestamp < NOW() - 30 DAYS;`
- Restart both services weekly
- Review database size quarterly

---

## What's Next

### When Ready for Auto-Start
See: [AUTO_START.md](AUTO_START.md) (coming soon)
- Windows Task Scheduler
- Startup batch scripts
- Service installation

### When Ready for Network Access
See: [NETWORK_ACCESS.md](NETWORK_ACCESS.md) (coming soon)
- Access from other devices on network
- Use machine IP instead of localhost
- Network security considerations

### When Ready for Cloud Deployment
See: [DEPLOYMENT.md](DEPLOYMENT.md)
- Deploy to Railway.app (backend)
- Deploy to Vercel (frontend)
- Access from anywhere

---

## Quick Reference

| Task | Command |
|------|---------|
| Start Backend | `cd server && npm start` |
| Start Frontend | `cd web && npm run dev` |
| View Dashboard | `http://localhost:5173` |
| Backend Health | `curl http://localhost:3000/health` |
| View Status | `curl http://localhost:3000/api/status` |
| Kill All Node | `Get-Process node \| Stop-Process -Force` |
| Backup Database | `Copy-Item server/data/angel.db server/data/angel-backup.db` |
| Reset Database | `Remove-Item server/data/angel.db` |

---

## File Structure

```
angel/
├── server/                    # Backend Node.js
│   ├── src/
│   │   ├── index.js          # Main server
│   │   ├── api.js            # API routes
│   │   ├── db.js             # Database
│   │   └── websocket.js      # WebSocket
│   ├── data/
│   │   └── angel.db          # SQLite database (LOCAL)
│   └── package.json
├── web/                       # Frontend React
│   ├── src/
│   │   ├── App.jsx           # Main component
│   │   └── main.jsx
│   └── package.json
├── telemetry/                 # Bitburner telemetry
│   └── telemetry.js          # In-game telemetry sender
├── config.js                  # ANGEL config (in-game)
└── sync.js                    # GitHub sync (in-game)
```

---

## Summary

✅ **All local, no cloud** - Fully on your machine
✅ **Zero cost** - No monthly fees
✅ **Full control** - Direct access to everything
✅ **Easy debugging** - See all logs in real-time
✅ **Scalable** - Easy to add auto-start or network access later

**Current Status: STABLE LOCAL SETUP** ✅

---

**Questions?** Check the troubleshooting section or review the main [README.md](README.md)
