# ANGEL Remote Ecosystem - Complete Testing Summary

Your comprehensive testing plan consists of multiple resources working together.

---

## 📚 Testing Documentation

### 1. **TESTING_GUIDE.md** (This Repository Root)
The complete testing strategy with:
- 🏃 **Quick Validation** (15 min) - Smoke test everything works
- 🧪 **Full Integration Test** (1 hour) - Complete end-to-end validation
- ✅ **Validation Checklist** - Detailed component tests
- 🐛 **Troubleshooting** - Common errors & solutions
- 📊 **Performance Benchmarks** - Expected vs acceptable times
- 🔄 **Continuous Testing** - Daily/weekly/monthly validation
- 🎯 **Sign-Off Checklist** - Production readiness criteria

**USE THIS FOR:** Detailed testing methodology and understanding what each test validates.

---

### 2. **TESTING_CHECKLIST.md** (This Repository Root)
Quick reference checklist for:
- 🚀 **Pre-Flight Checklist** (5 min) - Startup verification
- 🎮 **Bitburner Integration Test** (15 min) - Game sync validation
- 📡 **Data Flow Validation** (5 min) - Telemetry & commands
- 🤖 **Discord Bot Test** (5 min) - Slash commands
- 📊 **Real-time Update Test** (2 min) - WebSocket broadcasting
- ⚠️ **Error Scenarios** - Test failure handling
- 📈 **Performance Test** - Load testing
- ✅ **Sign-Off Matrix** - Final approval checklist

**USE THIS FOR:** Quick reference while testing. Print it out!

---

### 3. **docs/TESTING_GUIDE.md** (Full Reference)
Same as TESTING_GUIDE.md above, but in docs folder for easy reference.

---

## 🤖 Automated Testing Scripts

### Windows Users

```bash
# Run automated tests
test-all.bat
```

**What it tests:**
- Backend connectivity
- All 6 API endpoints
- Telemetry ingestion
- Command queue
- Dashboard connectivity
- Database existence

**Runtime:** ~2 minutes

---

### Mac/Linux Users

```bash
# Make script executable
chmod +x test-all.sh

# Run automated tests
./test-all.sh
```

Same tests as Windows version.

---

## 🗂️ Complete Testing Workflow

### Phase 1: Setup & Quick Validation (15 min)

```bash
# Terminal 1: Start Backend
cd server
npm install
npm start

# Verify output includes:
# ✓ SQLite database connected
# ✓ Database tables created
# ✓ API routes configured
# ✓ WebSocket server configured
# ✓ 🔌 API: http://localhost:3000
```

```bash
# Terminal 2: Start Web Dashboard
cd web
npm install
npm run dev

# Verify output includes:
# ➜ Local: http://localhost:5173/
```

```bash
# Terminal 3: Run automated tests
./test-all.sh  # Mac/Linux
test-all.bat   # Windows
```

**Expected Result:**
```
✅ ALL TESTS PASSED
Your ANGEL ecosystem is ready for deployment!
```

---

### Phase 2: Bitburner Integration (15 min)

**In Bitburner Terminal:**

```
> run /angel/sync.js
```

Expected output:
```
✓ Downloaded: 38/38
▶ Telemetry system started
```

Then:
```
> run /angel/start.js
```

Expected:
```
======= ANGEL - Network Orchestrator =======
Initializing ANGEL orchestrator...
Module startup sequence beginning...
```

**In Web Dashboard:** `http://localhost:5173`

Expected:
- [ ] Data starts flowing in
- [ ] Last Update shows recent timestamp
- [ ] Money Rate > 0
- [ ] Hack Level visible

---

### Phase 3: Manual Validation (30 min)

**Follow these tests:**

1. **Open TESTING_CHECKLIST.md**
2. **Check off each section:**
   - [ ] Pre-Flight Checklist
   - [ ] Bitburner Integration Test
   - [ ] Data Flow Validation
   - [ ] Discord Bot Test (optional)
   - [ ] Real-time Update Test
   - [ ] Error Scenarios
   - [ ] Performance Test

3. **Mark status in Sign-Off Matrix**

---

## 🎯 Testing Scenarios

### Scenario 1: Fresh Deployment
1. Kill all services
2. Delete `server/data/data.db`
3. Restart all services
4. Run quick validation
5. Run full integration test

**Expected:** Everything starts fresh, no errors

---

### Scenario 2: Long-Running Stability (2+ hours)
1. Keep all services running
2. Send telemetry every minute (using curl)
3. Queue commands every 5 minutes
4. Monitor dashboard for lag/crashes
5. Check database size periodically

**Expected:** 
- No crashes
- Consistent response times
- Database < 100MB

---

### Scenario 3: Command Execution
1. Queue pause command via dashboard
2. Verify it appears in backend
3. Mark as executed in backend
4. Verify it doesn't appear in pending
5. Retrieve from history

**Expected:** Commands flow through entire chain

---

## ✅ Key Validations

### Backend Validations
```javascript
// Health endpoint
✓ GET /health returns {"status":"ok"}

// API endpoints
✓ GET /api/status returns current state
✓ GET /api/commands returns pending commands
✓ POST /api/telemetry stores data
✓ POST /api/commands queues command
✓ PATCH /api/commands/:id updates status
✓ GET /api/history retrieves samples
✓ GET /api/stats returns aggregates
```

### Database Validations
```sql
-- Telemetry samples stored
✓ SELECT COUNT(*) FROM telemetry_samples > 0

-- Commands stored
✓ SELECT COUNT(*) FROM commands > 0

-- Data types correct
✓ timestamp is INTEGER
✓ money_rate is REAL
✓ execution_count is INTEGER
```

### Web Dashboard Validations
```javascript
// Connectivity
✓ Page loads at localhost:5173
✓ No 404 or 500 errors
✓ No JavaScript console errors

// Real-time
✓ Connects to backend websocket
✓ Receives telemetry updates
✓ Updates display within 2 seconds

// Commands
✓ Send commands to backend
✓ Receive confirmation
✓ Commands appear in database
```

### Bitburner Integration Validations
```javascript
// Sync
✓ sync.js downloads 38 files
✓ All files present in /angel/

// Telemetry
✓ telemetry.js posts to backend every 10s
✓ Data appears on dashboard
✓ Includes game stats (money, hack level, etc)

// Commands
✓ angel.js checks backend every 30s
✓ Executes commands from backend
✓ Updates command status to executed
```

---

## 🐛 Debugging Tips

### If Backend Tests Fail

```bash
# Check Node.js version
node -v  # Should be v16+

# Check port availability
netstat -an | grep 3000  # Windows
lsof -i :3000            # Mac/Linux

# Reinstall dependencies
rm -rf server/node_modules
npm install
npm start
```

---

### If Dashboard Tests Fail

```bash
# Check backend running
curl http://localhost:3000/health

# Check CORS enabled
# Look for localhost:5173 in server/src/index.js

# Clear browser cache
# Press Ctrl+Shift+Del and clear all

# Check WebSocket
# Open DevTools → Network → WS filter
# Should see ws://localhost:3001 connected
```

---

### If Bitburner Tests Fail

```javascript
// In Bitburner console, check:

// 1. Backend URL correct
run /angel/angel.js --test-config

// 2. Network connectivity
run /angel/scanner.js

// 3. Telemetry enabled
run /angel/telemetry/report.js --summary
```

---

## 📊 Test Results Tracking

Create a file `TEST_RESULTS.txt`:

```
═══════════════════════════════════════
ANGEL Remote Ecosystem - Test Results
═══════════════════════════════════════

Date: 2026-03-01
Tester: Your Name

BACKEND (server/)
  ✅ npm install successful
  ✅ npm start runs without errors
  ✅ All 8 endpoints respond
  ✅ Database created at server/data/data.db
  ✅ WebSocket server listening on ws://localhost:3001

DASHBOARD (web/)
  ✅ npm install successful
  ✅ npm run dev starts dev server
  ✅ Page loads at localhost:5173
  ✅ Connects to backend
  ✅ Shows real-time data
  ✅ Mobile responsive

DATABASE
  ✅ telemetry_samples table has 100+ rows
  ✅ commands table functioning
  ✅ Auto-cleanup working
  ✅ Size < 100MB

BITBURNER
  ✅ sync.js 38/38 files downloaded
  ✅ start.js launches without errors
  ✅ Telemetry flowing to backend
  ✅ Commands from dashboard execute in game

DISCORD (optional)
  ✅ Bot online and responding
  ✅ /angel-status works
  ✅ /angel-pause works

PERFORMANCE
  ✅ Health check < 50ms
  ✅ POST telemetry < 100ms
  ✅ WebSocket updates < 100ms
  ✅ No memory leaks observed

STABILITY
  ✅ 2+ hour run without crashes
  ✅ 100+ telemetry samples processed
  ✅ 50+ commands queued/executed
  ✅ Database integrity maintained

OVERALL: ✅ PRODUCTION READY

Notes:
  - All systems performing nominally
  - No errors or warnings
  - Ready for live deployment

═══════════════════════════════════════
```

---

## 🚀 When Everything Passes

Congratulations! Your ANGEL Remote Ecosystem is ready:

```
✅ Bitburner automation running
✅ Real-time telemetry flowing
✅ Web dashboard monitoring live
✅ Discord bot providing control
✅ Mobile access working
✅ Commands executing reliably
✅ Database persisting data
✅ All systems stable & performant

🎉 READY FOR PRODUCTION DEPLOYMENT 🎉
```

---

## 📞 Test Execution Order

**Recommended sequence:**

1. **Day 1 - Setup & Validation**
   - Start all services (backend, dashboard, Discord)
   - Run automated test script
   - Follow Pre-Flight Checklist
   - Follow Bitburner Integration Test

2. **Day 2 - Manual Validation**
   - Follow Data Flow Validation tests
   - Test Error Scenarios
   - Verify Discord commands
   - Check Performance Benchmarks

3. **Day 3 - Extended Testing**
   - Run stability test (2+ hours)
   - Monitor dashboard for issues
   - Send 100+ telemetry samples
   - Queue 50+ commands

4. **Day 4 - Final Sign-Off**
   - Complete all sign-off items
   - Document any issues found
   - Verify fixes applied
   - Mark as PRODUCTION READY

---

## 📋 Resources

| Document | Location | Purpose |
|----------|----------|---------|
| TESTING_GUIDE.md | Repo root | Complete testing methodology |
| TESTING_CHECKLIST.md | Repo root | Quick reference checklist |
| docs/TESTING_GUIDE.md | /docs | Full reference copy |
| test-all.sh | Repo root | Automated tests (Mac/Linux) |
| test-all.bat | Repo root | Automated tests (Windows) |
| DEPLOYMENT_GUIDE.md | /docs | Installation instructions |
| LOCAL_SETUP.md | /docs | Setup procedures |
| API_REFERENCE.md | /docs | Endpoint documentation |

---

## ✨ You're All Set!

Your ANGEL Remote Ecosystem has:

- ✅ Complete backend API
- ✅ Real-time web dashboard
- ✅ Discord bot integration
- ✅ Bitburner game integration
- ✅ Automated testing tools
- ✅ Comprehensive documentation
- ✅ Quick reference checklists
- ✅ Troubleshooting guides

**Everything you need to validate and deploy!** 🚀

---

**Next Step:** Follow the **TESTING_CHECKLIST.md** to begin validating your system.

Good luck! 🎮
