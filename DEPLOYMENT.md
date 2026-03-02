# ANGEL Production Deployment Guide

## Overview
This guide walks through deploying the ANGEL ecosystem to production (backend, frontend, optional Discord bot).

---

## Architecture

```
Bitburner (Game)
    ↓ (HTTPS)
Backend (Production)
    ├─ REST API
    ├─ WebSocket Server
    └─ SQLite Database
         ↓
Web Dashboard (CDN)
    ├─ React + Vite
    ├─ Real-time updates
    └─ Chrome/Firefox

Discord Bot (Optional)
    ↓
Backend
```

---

## Prerequisites

- GitHub account (already have)
- Render.com OR Railway.app account (free tier available)
- Vercel OR Netlify account (free tier available)
- Internet-facing domain (optional but recommended)

---

## Phase 4.1: Backend Deployment (Render.com)

### Step 1: Prepare Backend for Production

Create `server/.env.production`:

```env
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATABASE_URL=/data/angel.db
LOG_LEVEL=info
CORS_ORIGINS=https://your-domain.com,https://your-app.vercel.app
```

### Step 2: Create Render Blueprint

Create `render.yaml` in root:

```yaml
services:
  - type: web
    name: angel-backend
    env: node
    plan: free
    buildCommand: cd server && npm install
    startCommand: cd server && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
      - key: DATABASE_URL
        value: /data/angel.db

  - type: web
    name: angel-web
    env: static
    buildCommand: cd web && npm install && npm run build
    staticPublishPath: dist
    envVars: []
```

### Step 3: Deploy to Render

1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect GitHub repository
4. Select `angel` repo
5. Set:
   - **Name:** `angel-backend`
   - **Environment:** Node
   - **Plan:** Free
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `cd server && npm start`
6. Click "Create Web Service"
7. Wait 5-10 minutes for deployment
8. Note the **Backend URL**: `https://angel-backend-xxxxx.onrender.com`

---

## Phase 4.2: Frontend Deployment (Vercel)

### Step 1: Prepare Frontend Config

Create `web/.env.production`:

```env
VITE_BACKEND_URL=https://angel-backend-xxxxx.onrender.com
VITE_WS_URL=wss://angel-backend-xxxxx.onrender.com
```

Update `web/src/App.jsx` to use env variables:

```javascript
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
```

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import GitHub repo `angel`
4. Set:
   - **Framework:** Vite
   - **Root Directory:** `web`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Add Environment Variables:
   - `VITE_BACKEND_URL`: Your Render backend URL
   - `VITE_WS_URL`: Your Render backend URL (wss://)
6. Click "Deploy"
7. Wait 2-3 minutes
8. Note the **Frontend URL**: `https://angel-xxxxx.vercel.app`

---

## Phase 4.3: Update Production Config

### Update `config.js`

Create conditional config loading:

```javascript
const isProd = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';

export const config = {
    remoteBackend: {
        enabled: true,
        url: isProd ? 'https://angel-backend-xxxxx.onrender.com' : 'http://localhost:3000',
        telemetryIntervalMs: 10000,
        enableLogging: !isProd,
    },
    // ... rest of config
};
```

### Update `sync.js` for Production

Add option to specify backend:

```bash
# In Bitburner:
run /angel/sync.js --backend https://angel-backend-xxxxx.onrender.com
```

---

## Phase 4.4: Update Bitburner Config (In-Game)

In Bitburner terminal:

```
run /angel/sync.js
```

Then edit `config.js` in-game:

```javascript
remoteBackend: {
    enabled: true,
    url: "https://angel-backend-xxxxx.onrender.com",  // Your Render URL
    telemetryIntervalMs: 10000,
    enableLogging: false,
},
```

---

## Phase 4.5: Discord Bot Deployment (Optional)

### Deploy to Render

1. Go to Render dashboard
2. Click "New +" → "Web Service"
3. Create `discord/.env`:

```env
DISCORD_TOKEN=your_token_here
BACKEND_URL=https://angel-backend-xxxxx.onrender.com
GUILD_ID=your_guild_id
CHANNEL_ID=your_channel_id
```

4. Deploy:
   - **Name:** `angel-discord`
   - **Build Command:** `cd discord && npm install`
   - **Start Command:** `cd discord && npm start`

---

## Verification Checklist

### Backend
- [ ] `curl https://angel-backend-xxxxx.onrender.com/health` → 200 OK
- [ ] Check Render logs for errors
- [ ] Database created at `/data/angel.db`

### Frontend
- [ ] `https://angel-xxxxx.vercel.app` loads in browser
- [ ] Connect to Dashboard
- [ ] See live telemetry updates from game

### Bitburner
- [ ] `run /angel/sync.js` completes
- [ ] `run /angel/start.js` starts ANGEL
- [ ] Dashboard shows live game data

### Discord (Optional)
- [ ] Bot appears online in Discord
- [ ] `/angel-status` command works
- [ ] Data shows live game metrics

---

## Production Monitoring

### View Logs

**Render Backend:**
```bash
# In Render dashboard → angel-backend → Logs
# Check for errors every 5 minutes
```

**Vercel Frontend:**
```bash
# In Vercel dashboard → angel → Deployments → Runtime Logs
```

### Database Backups

On Render (free tier):
- Database stored in `/data/angel.db`
- Persists across restarts
- **Recommended:** Backup to GitHub or external storage weekly

```bash
# In Render terminal or local:
cd server
sqlite3 data/angel.db ".dump" > backup.sql
git add backup.sql
git commit -m "Weekly database backup"
git push
```

---

## Troubleshooting

### Backend won't start
```
Error: Cannot find module
→ Render didn't run npm install
→ Check build logs, restart deployment
```

### Frontend can't reach backend
```
Error: Failed to fetch http://...
→ CORS misconfigured
→ Update CORS_ORIGINS in backend .env
→ Verify VITE_BACKEND_URL correct
```

### No telemetry in dashboard
```
Symptom: Dashboard loads but "Last Update" is old
→ Check Bitburner console for sync errors
→ Verify config.js remoteBackend.url correct
→ Test: curl https://backend/api/status
```

### WebSocket not connecting
```
Error: WebSocket connection failed
→ Check VITE_WS_URL in frontend env
→ Verify WSS (secure) protocol
→ Backend must support wss://
```

---

## Rollback Procedure

If production breaks:

1. **Frontend:** Vercel automatically keeps previous deployment, click "Promote to Production"
2. **Backend:** Render keeps previous build, click "Redeploy Previous"
3. **Bitburner:** Revert config.js to localhost URLs, run sync.js again

---

## Next Steps

1. ✅ Commit all production configs to GitHub
2. ✅ Deploy backend to Render
3. ✅ Deploy frontend to Vercel
4. ✅ Update Bitburner config with production URLs
5. ✅ Test full integration in production
6. ✅ Document any issues
7. ✅ Set up monitoring/alerts (optional)

---

## Support URLs

- **Backend API:** `https://angel-backend-xxxxx.onrender.com`
- **Web Dashboard:** `https://angel-xxxxx.vercel.app`
- **GitHub:** `https://github.com/Miltik/angel`
- **Status Page:** `https://angel-backend-xxxxx.onrender.com/health`

---

**Status: READY FOR PRODUCTION DEPLOYMENT** ✅
