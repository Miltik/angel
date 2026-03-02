# ANGEL Testing Checklist - Quick Reference

Print this out or keep it open while testing.

---

## 🚀 Pre-Flight Checklist (5 min)

### Startup Sequence

- [ ] **Backend Started**
  - Terminal 1: `cd server && npm start`
  - Expect: "✓ API: http://localhost:3000"
  - Verify: `curl http://localhost:3000/health`

- [ ] **Web Dashboard Started**
  - Terminal 2: `cd web && npm run dev`
  - Expect: "Local: http://localhost:5173"
  - Verify: Browser loads with no errors

- [ ] **Discord Bot Started** (Optional)
  - Terminal 3: `cd discord && npm start`
  - Expect: "✓ Logged in as ANGEL"
  - Expect: "✓ Slash commands registered"

- [ ] **Database Exists**
  - Check: `server/data/data.db` file present
  - If not: Restart backend (will auto-create)

---

## 🎮 Bitburner Integration Test (15 min)

### Sync Phase

```
Game Terminal:
> run /angel/sync.js
```

**Expectations:**
- [ ] No errors
- [ ] See: "✓ Downloaded: 38/38"
- [ ] See: "✓ Telemetry system started"

### Startup Phase

```
Game Terminal:
> run /angel/start.js
```

**Expectations:**
- [ ] See initialization messages
- [ ] Modules begin launching
- [ ] Wait 30 seconds for startup

### Connection Phase

**Web Dashboard Check:**
```
Browser: http://localhost:5173
```

**Expectations:**
- [ ] Page loads (no red error boxes)
- [ ] "Last Update" timestamp is recent (< 10 seconds)
- [ ] "Latest Data" shows module name (e.g., "hacking")
- [ ] Money Rate > 0
- [ ] Hack Level visible
- [ ] Data refreshes every 5-10 seconds

---

## 📡 Data Flow Validation (5 min)

### Test 1: Telemetry Upload

**In Browser Console** (F12 → Console):
```javascript
// Should show recent telemetry
fetch('http://localhost:3000/api/history?limit=5')
  .then(r => r.json())
  .then(d => console.log('Samples:', d.count, d.data[0]))
```

**Expected Output:**
```
Samples: 5 {id: X, timestamp: ..., module_name: "hacking", ...}
```

**Checkmarks:**
- [ ] Data exists
- [ ] Timestamps are recent
- [ ] Module names present

### Test 2: Command Queue

**On Dashboard:**
1. [ ] Click "Pause" button
2. [ ] Wait 2 seconds
3. [ ] Open browser console

**In Browser Console:**
```javascript
fetch('http://localhost:3000/api/commands')
  .then(r => r.json())
  .then(d => console.log('Pending commands:', d.count, d.commands))
```

**Expected:**
```
Pending commands: 1 [{id: X, type: "pause", ...}]
```

**Checkmarks:**
- [ ] Command appears
- [ ] Type is "pause"
- [ ] Can see it in database

---

## 🤖 Discord Bot Test (Optional, 5 min)

**In Discord Channel:**

### Test 1: Status Command
```
/angel-status
```

**Expected:**
- [ ] Bot responds with embed
- [ ] Shows money rate
- [ ] Shows XP rate  
- [ ] Shows module info

### Test 2: Pause Command
```
/angel-pause
```

**Expected:**
- [ ] Bot responds "⏸️ ANGEL paused"
- [ ] Command queued in backend
- [ ] Verify: Check database has pause command

### Test 3: Resume Command
```
/angel-resume
```

**Expected:**
- [ ] Bot responds "▶️ ANGEL resumed"
- [ ] Can execute other commands after

---

## 📊 Real-time Update Test (2 min)

### Test: WebSocket Broadcasting

**Step 1: Open 2 Dashboard Tabs**
- [ ] Tab 1: `http://localhost:5173`
- [ ] Tab 2: `http://localhost:5173` (side-by-side)

**Step 2: Send Test Telemetry**
```bash
curl -X POST http://localhost:3000/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{
    "runId":"test",
    "timestamp":'$(date +%s000)',
    "modules":{"test":{"executions":999,"status":"running"}},
    "stats":{"moneyRate":999999999},
    "memory":{"used":64,"total":256},
    "money":"999999999",
    "hackLevel":999
  }'
```

**Expected:**
- [ ] BOTH tabs update simultaneously
- [ ] Data identical on both
- [ ] Update within 1 second

---

## ⚠️ Error Scenarios (Optional)

### Test 1: Backend Down
1. [ ] Stop backend (Ctrl+C in Terminal 1)
2. [ ] Try to send command on dashboard
3. [ ] Expected: "Backend unreachable" message
4. [ ] Restart backend
5. [ ] Expected: Dashboard reconnects automatically

### Test 2: Database Locked
1. [ ] Try: `rm server/data/data.db`
2. [ ] Restart backend
3. [ ] Expected: Database recreated
4. [ ] Data still flows

### Test 3: Backend Disabled in Config
1. [ ] Edit: `config.js`
2. [ ] Change: `remoteBackend.enabled = false`
3. [ ] Reload Angel in game
4. [ ] Expected: No telemetry sent to backend
5. [ ] Restore: `remoteBackend.enabled = true`

---

## 📈 Performance Test (Optional, 10 min)

### Load Test: 100 Telemetry Samples

**Run in Terminal:**
```bash
for i in {1..100}; do
  curl -X POST http://localhost:3000/api/telemetry \
    -H "Content-Type: application/json" \
    -d "{\"runId\":\"load-test\",\"timestamp\":$(date +%s000),\"modules\":{\"test\":{\"executions\":$i}}}" 2>/dev/null
  sleep 0.2
done
```

**Expectations:**
- [ ] No errors in backend console
- [ ] Database size increases
- [ ] Dashboard updates smoothly
- [ ] No lag or crashes

**Verify:**
```bash
curl http://localhost:3000/api/stats
```

Should show `"total_samples": 100+`

---

## ✅ Sign-Off Matrix

| System | Test | Status | Date |
|--------|------|--------|------|
| Backend | Health Check | ✅/❌ | __/__/__ |
| Backend | All Endpoints | ✅/❌ | __/__/__ |
| Database | Data Persistence | ✅/❌ | __/__/__ |
| Dashboard | Loads & Connects | ✅/❌ | __/__/__ |
| Dashboard | Real-time Updates | ✅/❌ | __/__/__ |
| Bitburner | Sync Works | ✅/❌ | __/__/__ |
| Bitburner | Telemetry Posts | ✅/❌ | __/__/__ |
| Bitburner | Commands Execute | ✅/❌ | __/__/__ |
| Discord | Bot Online | ✅/❌ | __/__/__ |
| Discord | Commands Work | ✅/❌ | __/__/__ |
| **OVERALL** | **ALL SYSTEMS** | ✅/❌ | __/__/__ |

---

## 🎯 Final Sign-Off

When all tests pass:

```
Date: __/__/____
Tester: ________________

✅ Backend fully operational
✅ Database storing and retrieving data
✅ Dashboard showing real-time updates
✅ Discord bot responding to commands
✅ Bitburner successfully syncing telemetry
✅ Commands executing from web/Discord
✅ No crashes or errors
✅ Performance acceptable

ANGEL REMOTE ECOSYSTEM: APPROVED FOR DEPLOYMENT ✅

Signature: ________________________
```

---

## 📞 Quick Help

**If test fails, check:**

1. **Backend won't start**
   - `npm install` again
   - Check port 3000 not in use
   - Check Node.js version: `node -v`

2. **Dashboard won't connect**
   - Confirm backend running
   - Check CORS in `server/src/index.js`
   - Check browser console (F12)

3. **No telemetry data**
   - Confirm Angel running in game
   - Check `config.js` remoteBackend.enabled = true
   - Test with curl manually

4. **Discord bot offline**
   - Verify token in `discord/.env`
   - Check bot has "Message Content" intent
   - Bot must be in your server

5. **Database errors**
   - Delete `server/data/data.db`
   - Restart backend
   - Should auto-recreate

---

**Good luck! 🚀**
