# ANGEL Remote Ecosystem - Comprehensive Testing Plan

Complete validation strategy for entire ANGEL remote ecosystem.

---

## 📋 Test Scope

| Component | Status | Tests |
|-----------|--------|-------|
| Backend API | ✓ Ready | 8 endpoints |
| Web Dashboard | ✓ Ready | UI/connectivity |
| Discord Bot | ✓ Ready | Command execution |
| Bitburner Integration | ✓ Ready | Telemetry sync + commands |
| Database | ✓ Ready | Schema + queries |
| WebSocket | ✓ Ready | Real-time updates |

---

## 🏃 Quick Validation (15 minutes)

This is the "smoke test" - does anything work at all?

### Step 1: Start Backend
```bash
cd server
npm start
```

**Expect to see:**
```
✓ SQLite database connected
✓ Database tables created
✓ API routes configured
✓ WebSocket server configured

🔌 API:       http://localhost:3000
📡 WebSocket: ws://localhost:3001
```

**Verify:** Open browser → `http://localhost:3000/health`

Should show:
```json
{"status":"ok","timestamp":1234567890}
```

✅ **Backend is working** if you see `"status":"ok"`

---

### Step 2: Start Web Dashboard
```bash
cd web
npm start
```

**Expect to see:**
```
  ➜  Local:   http://localhost:5173/
```

**Verify:** Open browser → `http://localhost:5173`

Should show:
- ANGEL Dashboard title
- "Connecting to backend..." message
- Eventually shows status box with latest data

✅ **Dashboard is working** if page loads and no red error boxes

---

### Step 3: Test API Endpoints (curl)

Open another terminal:

```bash
# Test 1: Health check
curl http://localhost:3000/health

# Test 2: Get status
curl http://localhost:3000/api/status

# Test 3: Get empty history
curl http://localhost:3000/api/history

# Test 4: Queue a command
curl -X POST http://localhost:3000/api/commands \
  -H "Content-Type: application/json" \
  -d "{\"commandType\":\"pause\"}"
```

**All should return JSON without errors**

✅ **API is working** if all curl commands return `"success":true`

---

### Step 4: Test POST Telemetry

```bash
curl -X POST http://localhost:3000/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "runId":"test001",
    "timestamp":'$(date +%s000)',
    "modules":{
      "hacking":{"executions":100,"failures":2,"status":"running"}
    },
    "stats":{"uptime":3600000,"moneyRate":1000000},
    "memory":{"used":64,"total":256},
    "money":"999999999",
    "hackLevel":250
  }'
```

**Should return:**
```json
{"success":true,"message":"Telemetry recorded","samplesReceived":1}
```

✅ **Telemetry is working** if you can POST and GET data back

---

## 🧪 Full Integration Test (1 hour)

Complete end-to-end validation of entire ecosystem.

### Part 1: Backend Database Tests

**Test:** Data persistence

```bash
# 1. Queue 5 commands
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/commands \
    -H "Content-Type: application/json" \
    -d "{\"commandType\":\"pause\"}"
done

# 2. Get pending commands
curl http://localhost:3000/api/commands

# Expected: Array with 5 commands, all status "pending"
```

**Checklist:**
- [ ] Can insert commands to database
- [ ] Can retrieve commands from database
- [ ] Command IDs are sequential
- [ ] Timestamp is recorded

**Test:** Command execution tracking

```bash
# 1. Get a command ID from above
# 2. Mark it as executed
curl -X PATCH http://localhost:3000/api/commands/1 \
  -H "Content-Type: application/json" \
  -d '{"status":"executed","result":{"message":"Success"}}'

# 3. Get commands again
curl http://localhost:3000/api/commands

# Expected: Command ID 1 should NOT appear (only pending shown)
```

**Checklist:**
- [ ] Can update command status
- [ ] Executed commands removed from pending list
- [ ] Result is stored and retrievable

---

### Part 2: Telemetry Data Flow

**Test:** Multiple samples over time

```bash
# Run this script to send 10 telemetry samples with varying data
# save as: test-telemetry.sh

#!/bin/bash
for i in {1..10}; do
  MONEY=$((1000000000 + i * 100000000))
  HACK=$((250 + i * 5))
  curl -X POST http://localhost:3000/api/telemetry \
    -H "Content-Type: application/json" \
    -d "{
      \"runId\":\"test-run-001\",
      \"timestamp\":$(date +%s000),
      \"modules\":{
        \"hacking\":{\"executions\":$((i*10)),\"failures\":$((i%3)),\"status\":\"running\"},
        \"servers\":{\"executions\":$((i*5)),\"failures\":0,\"status\":\"running\"}
      },
      \"stats\":{\"uptime\":$((i*600000)),\"moneyRate\":$((i*500000)),\"xpRate\":$((i*50))},
      \"memory\":{\"used\":$((64+i)),\"total\":256},
      \"money\":\"$MONEY\",
      \"hackLevel\":$HACK
    }"
  sleep 2
done
```

**Verify in browser:**
```javascript
// Open console and run:
fetch('http://localhost:3000/api/history?limit=10')
  .then(r => r.json())
  .then(d => console.log('Samples received:', d.count, 'Latest money rate:', d.data[0].money_rate))
```

**Checklist:**
- [ ] All 10 samples stored
- [ ] Money rate values vary (1st: 500k, 10th: 5M)
- [ ] Hack levels increase
- [ ] Timestamps are sequential

---

### Part 3: Web Dashboard Connectivity

**Test:** Real-time updates

1. Keep dashboard open at `http://localhost:5173`
2. Send telemetry in curl (above test)
3. Watch dashboard

**Checklist:**
- [ ] Dashboard shows "Pending Commands: 0" initially
- [ ] Send telemetry with curl
- [ ] Dashboard updates within 2 seconds
- [ ] Money/XP rates change
- [ ] No red error boxes appear
- [ ] Console (F12) shows no errors

**Test:** Command buttons

1. Click "Pause" button on dashboard
2. Check backend:
```bash
curl http://localhost:3000/api/commands
```

**Checklist:**
- [ ] Button click creates a command in database
- [ ] Command appears in `/api/commands` with type "pause"
- [ ] Button feedback (visual state change)
- [ ] No console errors

---

### Part 4: WebSocket Real-time

**Test:** Connected clients receive updates

Open **2 dashboard tabs** simultaneously at `http://localhost:5173`

Send telemetry:
```bash
curl -X POST http://localhost:3000/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{"runId":"test","timestamp":'$(date +%s000)',"modules":{"hacking":{"executions":100,"failures":0}},"stats":{"moneyRate":1000000},"memory":{"used":64,"total":256},"money":"1000000000","hackLevel":250}'
```

**Checklist:**
- [ ] BOTH tabs update simultaneously
- [ ] Data is identical on both tabs
- [ ] Update happens within 1 second
- [ ] Console shows no WebSocket errors

---

### Part 5: Discord Bot (Optional)

**Only if you've set up Discord token**

1. Start bot:
```bash
cd discord
npm start
```

**Expect to see:**
```
✓ Logged in as ANGEL#1234
✓ Backend: http://localhost:3000
✓ Ready to receive commands
✓ Slash commands registered
```

2. In Discord, type: `/angel-status`

**Checklist:**
- [ ] Bot responds with status embed
- [ ] Shows money rate, XP rate, modules
- [ ] No errors in bot console
- [ ] Embed is formatted nicely
- [ ] Can run other commands: `/angel-pause`, `/angel-resume`

---

### Part 6: Bitburner Integration (Most Important!)

**Prerequisites:**
- [ ] Bitburner running on localhost:8000
- [ ] Started backend, dashboard, everything working above

**Test:** Script sync and startup

1. In Bitburner terminal:
```
run /angel/sync.js
```

**Expect:**
```
✓ Downloaded: 38/38
✓ Telemetry system started
```

**Checklist:**
- [ ] All 38 files downloaded successfully
- [ ] No error messages
- [ ] Telemetry automatically started

2. Start Angel:
```
run /angel/start.js
```

**Checklist:**
- [ ] Angel starts without errors
- [ ] See "Initializing ANGEL" messages
- [ ] Modules begin launching (wait 30 seconds)

3. Check web dashboard - should start seeing data!

**Open browser:** `http://localhost:5173`

**Checklist:**
- [ ] Last Update timestamp is recent (within 10 seconds)
- [ ] Latest Data shows module names (hacking, servers, etc)
- [ ] Money Rate > 0
- [ ] Hack Level visible
- [ ] Data refreshes every few seconds

---

## ✅ Validation Checklist

### Backend (server/)
- [ ] `npm install` succeeds
- [ ] `npm start` runs without errors
- [ ] `/health` endpoint returns ok
- [ ] All 6 main endpoints accessible
- [ ] Sends telemetry without errors
- [ ] Receives commands and stores them
- [ ] WebSocket connects and broadcasts
- [ ] Database file created at `server/data/data.db`

### Web Dashboard (web/)
- [ ] `npm install` succeeds
- [ ] `npm run dev` starts dev server
- [ ] Page loads at localhost:5173
- [ ] Connects to backend automatically
- [ ] Shows live data after telemetry sent
- [ ] Command buttons work (POST to backend)
- [ ] Mobile responsive (test on phone browser)
- [ ] No console errors
- [ ] Styled correctly (dark theme)

### Discord Bot (discord/)
- [ ] `npm install` succeeds
- [ ] Token in `.env` is valid
- [ ] `npm start` connects to Discord
- [ ] Shows as "Online" in Discord
- [ ] Slash commands registered
- [ ] `/angel-status` returns data
- [ ] Can pause/resume from Discord
- [ ] Bot can read backend data

### Bitburner Integration
- [ ] `sync.js` downloads all 38 files
- [ ] `start.js` launches Angel without errors
- [ ] Telemetry data appears in web dashboard
- [ ] Commands from dashboard execute in game
- [ ] Can pause/resume Angel from web
- [ ] Backend config properly loaded
- [ ] No fetch errors in Bitburner console

### Database
- [ ] `data.db` created successfully
- [ ] `telemetry_samples` table has data
- [ ] `commands` table stores commands
- [ ] Old data auto-cleaned (>7 days)
- [ ] Queries return expected structure

### Data Flow (End-to-End)
- [ ] Game → Backend (telemetry POST)
- [ ] Backend → Database (stored)
- [ ] Database → Backend (retrieved)
- [ ] Backend → Dashboard (WebSocket)
- [ ] Dashboard → Backend (command POST)
- [ ] Backend → Game (PATCH status)
- [ ] Game executes command

---

## 🐛 Expected Errors & Solutions

### Error: "Cannot find module 'express'"
```bash
cd server
npm install
```

### Error: "Port 3000 already in use"
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3000
kill -9 <PID>

# Or change PORT in server/.env
```

### Error: "Backend unreachable" in web
```bash
# Check backend is running
curl http://localhost:3000/health

# Check CORS settings in server/src/index.js
# Ensure localhost:5173 is in cors origin
```

### Error: "SQLITE_CANTOPEN"
```bash
# Database file permissions issue
rm server/data/data.db
npm start  # Recreates database
```

### Error: "Discord token invalid"
```bash
# Verify token in discord/.env
# Check bot has required intents enabled:
# - Message Content Intent
# - Guilds
# - Direct Messages

# Verify bot is added to server
```

### Error: "No telemetry data on dashboard"
```bash
# Check Angel is running in game
run /angel/start.js

# Check config.js remoteBackend.enabled = true

# Check browser console for fetch errors (F12)

# Send test telemetry:
curl -X POST http://localhost:3000/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{"runId":"test","timestamp":'$(date +%s000)',"modules":{"test":{"executions":1}}}'
```

### Error: "Bitburner sync fails"
```bash
# Verify all files exist on GitHub
# Check GITHUB_USER and GITHUB_REPO in sync.js
# Try with --force flag:
run /angel/sync.js --force

# Check network connectivity
```

---

## 📊 Performance Benchmarks

**Expected performance:**

| Operation | Expected | Acceptable |
|-----------|----------|-----------|
| Health check | <50ms | <200ms |
| POST telemetry | <100ms | <500ms |
| GET status | <50ms | <200ms |
| Queue command | <50ms | <200ms |
| WebSocket update | <100ms | <500ms |
| Dashboard load | <2s | <5s |
| Discord bot response | <2s | <5s |

**Test performance:**
```bash
# Measure health check response time
time curl http://localhost:3000/health

# Should complete in <100ms
```

---

## 🔄 Continuous Testing

### Daily Validation
- [ ] Backend starts without errors
- [ ] Dashboard shows live data
- [ ] Commands execute in game
- [ ] No database errors

### Weekly Validation
- [ ] Full 1-hour integration test
- [ ] Check database size < 100MB
- [ ] Verify old data cleanup
- [ ] Test with 1000+ telemetry samples

### Monthly Validation
- [ ] Full ecosystem restart
- [ ] All components reinitialize
- [ ] Data integrity check
- [ ] Performance benchmarking

---

## 📝 Test Results Template

Use this to track your testing:

```
Date: 2026-03-01
Backend Status: ✅ PASS
  - Health check: OK
  - API endpoints: OK (6/6)
  - Database: OK
  - WebSocket: OK

Dashboard Status: ✅ PASS
  - Loads: OK
  - Connects to backend: OK
  - Shows data: OK
  - Mobile responsive: OK

Discord Bot Status: ✅ PASS (optional)
  - Connects: OK
  - Commands work: OK

Bitburner Integration Status: ✅ PASS
  - Sync works: OK
  - Telemetry flows: OK
  - Commands execute: OK

Overall: ✅ ALL SYSTEMS GO

Issues Found:
  - None

Notes:
  - System ready for production use
```

---

## 🎯 Sign-Off Checklist

### Before declaring "ready for production":

**Functionality**
- [ ] All endpoints tested and working
- [ ] Database persists data correctly
- [ ] Commands execute reliably
- [ ] Real-time updates working
- [ ] Error handling graceful

**Performance**
- [ ] Response times acceptable
- [ ] No memory leaks during load
- [ ] Database queries efficient
- [ ] WebSocket stable for hours

**Documentation**
- [ ] Setup instructions clear
- [ ] API documented
- [ ] Troubleshooting guide complete
- [ ] Example code provided

**Reliability**
- [ ] 100+ telemetry samples tested
- [ ] 50+ commands queued/executed
- [ ] Dashboard stable for 1+ hour
- [ ] No unhandled errors in logs

**Integration**
- [ ] Bitburner sync works
- [ ] Angel starts successfully
- [ ] Telemetry posts automatically
- [ ] Commands from web/Discord execute

---

## 🚀 Final Validation

When everything passes:

```
✅ Backend operational
✅ Database functional
✅ Dashboard responsive
✅ Discord bot active (optional)
✅ Bitburner integrated
✅ Real-time sync working
✅ Commands executing
✅ Performance acceptable
✅ Documentation complete

🎉 ANGEL Remote Ecosystem READY FOR DEPLOYMENT
```

---

## 📞 Support

If a test fails:

1. **Check the error message** - Often tells you exactly what's wrong
2. **Review troubleshooting section** - Most common issues covered
3. **Check terminal output** - Both backend console and browser console (F12)
4. **Review recent changes** - Did you modify something?
5. **Request help** - Provide error message and what you were testing

---

**Good luck! 🚀**
