# Quick Start - Local Development

> Everything runs locally on your machine. No cloud, no fees, 100% offline capable.

## One-Click Start

### Windows (Batch File)
Double-click this file to start everything:
```
start-local.bat
```

**OR** (PowerShell)
```powershell
.\start-local.ps1
```

This will:
1. ✅ Start Backend (localhost:3000)
2. ✅ Start Frontend (localhost:5173)
3. ✅ Open both in new windows

---

## Manual Start (3 Steps)

### Terminal 1: Backend
```bash
cd server
npm start
```

Expected: `Ready to receive telemetry from Bitburner...`

### Terminal 2: Frontend
```bash
cd web
npm run dev
```

Expected: `Local: http://localhost:5173/`

### Terminal 3: Bitburner
```
run /angel/sync.js
run /angel/start.js
```

---

## Access Dashboard

Open in browser:
```
http://localhost:5173
```

You should see live game data updating! ✅

---

## Full Documentation

For detailed setup, troubleshooting, and maintenance:
→ See [LOCAL_HOSTING.md](LOCAL_HOSTING.md)

## File Structure

```
angel/
├── start-local.bat           👈 Double-click this
├── start-local.ps1           👈 Or run this
├── LOCAL_HOSTING.md          👈 Full documentation
├── server/                   👈 Backend (runs locally)
├── web/                       👈 Frontend (runs locally)
└── ...
```

---

**Status: Ready to run local** ✅
