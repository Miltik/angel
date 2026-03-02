# ANGEL Production Deployment Guide - Railway.app + Vercel

## Overview
This guide walks through deploying the ANGEL ecosystem to production using **Railway.app (free backend)** and **Vercel (free frontend)**.

**Cost: $0/month** ✅

---

## Architecture

```
Bitburner (Game)
    ↓ (HTTPS)
Backend (Railway.app - Free)
    ├─ REST API
    ├─ WebSocket Server
    └─ SQLite Database
         ↓
Web Dashboard (Vercel - Free)
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
- Railway.app account (create with GitHub)
- Vercel account (create with GitHub)
- Internet-facing domain (optional)

---

## Phase 4.1: Backend Deployment (Railway.app)

### Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Click "Start Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway with GitHub
5. Select the `angel` repository

### Step 2: Configure Railway Deployment

1. Click "Add Plugin" → "PostgreSQL" (or skip for SQLite)
2. Click "Add Service" → "GitHub Repo"
3. Select `angel` repository
4. Set configuration:
   - **Service name:** `angel-backend`
   - **Root directory:** `server`
   - **Environment:** Node.js
   - **Start command:** `npm start`
   - **Build command:** `npm install`

### Step 3: Set Environment Variables

In Railway dashboard:

```
NODE_ENV=production
PORT=3000
DATABASE_URL=/data/angel.db
```

### Step 4: Deploy

1. Click "Deploy" button
2. Wait 2-3 minutes for deployment
3. Once deployed, note the **public URL**
   - Format: `https://angel-production-xxxxx.railway.app`
   - Copy this URL - you'll need it for the frontend

### Step 5: Verify Backend

Test the backend is live:

```bash
curl https://angel-production-xxxxx.railway.app/health
```

Should return: `{"status":"ok","timestamp":...}`

---

## Phase 4.2: Frontend Deployment (Vercel)

### Step 1: Prepare Frontend Config

Update `web/vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_BACKEND_URL": "@backend-url",
    "VITE_WS_URL": "@backend-ws-url"
  }
}
```

### Step 2: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New" → "Project"
3. Import GitHub repo `angel`
4. Configure:
   - **Framework:** Vite
   - **Root Directory:** `web`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`

### Step 3: Add Environment Variables

In Vercel → Settings → Environment Variables:

```
VITE_BACKEND_URL = https://your-railway-url
VITE_WS_URL = wss://your-railway-url
```

(Replace with your actual Railway URL from Step 4.1)

### Step 4: Deploy

1. Click "Deploy"
2. Wait 1-2 minutes
3. Once deployed, note the **Vercel URL**
   - Format: `https://angel-xxxxx.vercel.app`

---

## Phase 4.3: Update Production Config

### Update `config.js`

In Bitburner, edit `/angel/config.js`:

```javascript
remoteBackend: {
    enabled: true,
    url: "https://your-railway-backend-url",  // Your Railway URL
    telemetryIntervalMs: 10000,
    enableLogging: false,  // Disable logs in production
},
```

---

## Phase 4.4: Verify Production Deployment

### Test 1: Backend Health

```bash
curl https://your-railway-url/health
```

Expected: `{"status":"ok"...}`

### Test 2: Frontend Loads

Open in browser: `https://your-vercel-url`

Expected: Dashboard loads without errors

### Test 3: Bitburner Connection

In Bitburner:

```
run /angel/sync.js
run /angel/start.js
```

Wait 30 seconds, then in browser:

```
Open https://your-vercel-url
```

Expected: "Last Update" timestamp should be recent and updating

### Test 4: API Endpoints

```bash
# Get status
curl https://your-railway-url/api/status | jq

# Should show recent lastUpdate timestamp
```

---

## Production Monitoring

### Daily Checks

- Open dashboard: `https://your-vercel-url`
- Verify "Last Update" is current (< 1 minute old)
- Verify Money Rate and Hack Level showing

### View Logs

**Railway Backend Logs:**
- Go to Railway dashboard
- Select `angel-backend` service
- Click "Logs" tab
- Check for errors (red text)

**Vercel Frontend Logs:**
- Go to Vercel dashboard
- Select project
- Click "Deployments"
- Click latest deployment
- View "Runtime Logs"

### If Something Goes Wrong

**Fix 1: Restart Backend**
- Railway → `angel-backend` → "Redeploy"

**Fix 2: Restart Frontend**
- Vercel → Latest Deployment → "Redeploy"

**Fix 3: Clear Database**
- SSH into Railway service (optional)
- Delete `data/angel.db`
- Restart backend (auto-creates database)

---

## Troubleshooting

### Dashboard shows old timestamp
```
Symptom: Last Update doesn't refresh
→ Check Bitburner config.js has correct backend URL
→ Verify telemetry.js is running (run /angel/start.js)
→ Check Railway logs for errors
```

### 502 Bad Gateway
```
Symptom: Dashboard won't load
→ Railway backend may be restarting
→ Wait 30 seconds and refresh
→ Check Railway logs
```

### WebSocket connection failed
```
Symptom: Even though page loads, no live updates
→ Verify VITE_WS_URL uses wss:// (not ws://)
→ Check it matches your Railway URL
→ Redeploy frontend if env vars changed
```

### Game can't reach backend
```
Symptom: Bitburner shows "Backend sync error"
→ Verify config.js URL is accessible (curl it)
→ Check URL doesn't have typos
→ Verify Railway service is running
```

---

## Cost Summary

| Service | Tier | Cost |
|---------|------|------|
| Railway Backend | Free | $0 |
| Vercel Frontend | Free | $0 |
| Discord Bot | Optional | $0 |
| **Total** | | **$0/month** ✅ |

**Benefits of Free Tier:**
- ✅ No auto-sleep (always responsive)
- ✅ 512 MB RAM (plenty for ANGEL)
- ✅ No credit card required
- ✅ $5 monthly credit (can upgrade features if needed)

---

## Next Steps

1. Create Railway account: https://railway.app
2. Create Vercel account: https://vercel.app
3. Connect GitHub (via OAuth with both)
4. Deploy backend on Railway (5 minutes)
5. Deploy frontend on Vercel (2 minutes)
6. Update Bitburner config with production URLs
7. Open dashboard and verify live telemetry

**Total deployment time: 20 minutes** ⏱️

---

## Production URLs

After deployment, you'll have:

```
Backend API:     https://angel-xxxxx.railway.app
Frontend URL:    https://angel-xxxxx.vercel.app
WebSocket:       wss://angel-xxxxx.railway.app
GitHub:          https://github.com/Miltik/angel
```

---

**Status: READY FOR ZERO-COST PRODUCTION DEPLOYMENT** ✅
