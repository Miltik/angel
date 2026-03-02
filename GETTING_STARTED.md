# Getting Started with Angel

Complete setup guide for deploying Angel to Bitburner.

---

## 📋 Prerequisites

- **Bitburner game** running (browser or Steam)
- **Source Files**: SF1 (hacking formulas) highly recommended
- **Initial state**: Fresh after BitNode win or early in new run

**Optional but helpful:**
- GitHub account (for automatic sync)
- Basic familiarity with Bitburner terminal commands

---

## 🚀 Installation

### Method 1: Quick Deploy (Recommended)

**Best for:** First-time users, fastest setup

1. **Fork or clone** this repository to your GitHub account
2. **Make repository public** (required for wget without auth)
3. **Edit sync.js** - Update lines 17-19 with your info:
   ```javascript
   const GITHUB_USER = "YourUsername";     // Your GitHub username
   const GITHUB_REPO = "angel";            // Your repository name
   const GITHUB_BRANCH = "main";           // Usually "main"
   ```

4. **In Bitburner terminal**, download sync.js:
   ```bash
   wget https://raw.githubusercontent.com/YourUsername/angel/main/sync.js /angel/sync.js
   ```
   *(Replace YourUsername with your actual username)*

5. **Run sync to download everything**:
   ```bash
   run /angel/sync.js
   ```

6. **Start Angel**:
   ```bash
   run /angel/start.js
   ```

**That's it!** Angel is now running.

---

### Method 2: Bootstrap Script (Easiest Updates)

**Best for:** Frequent updates, multiple game restarts

1. **Follow steps 1-3 from Method 1** (setup GitHub)

2. **Edit bootstrap.js** - Update line with your sync.js URL:
   ```javascript
   const SYNC_SCRIPT_URL = "https://raw.githubusercontent.com/YourUsername/angel/main/sync.js";
   ```

3. **In Bitburner**, copy only bootstrap.js to home:
   ```bash
   # Copy bootstrap.js content from your repository
   # Paste into Bitburner editor, save as bootstrap.js
   ```

4. **Run bootstrap** (downloads sync.js):
   ```bash
   run bootstrap.js
   ```

5. **Run sync** (downloads everything else):
   ```bash
   run /angel/sync.js
   ```

6. **Start Angel**:
   ```bash
   run /angel/start.js
   ```

**Future updates:** Just run `run bootstrap.js` then `run /angel/sync.js`

---

### Method 3: Manual Copy

**Best for:** Offline use, no GitHub account

1. **Copy all files** from this repository to Bitburner:
   - Use Bitburner's built-in file editor
   - Create `/angel/` directory structure
   - Copy each file manually

2. **File structure should look like:**
   ```
   /angel/
   ├── angel.js
   ├── config.js
   ├── utils.js
   ├── scanner.js
   ├── start.js
   ├── angel-lite.js
   ├── modules/
   │   ├── hacking.js
   │   ├── servers.js
   │   └── ... (all 21 modules)
   ├── workers/
   │   ├── hack.js
   │   └── ... (all 4 workers)
   ├── telemetry/
   │   └── ... (all telemetry files)
   └── loot/
       └── loot.txt
   ```

3. **Start Angel**:
   ```bash
   run /angel/start.js
   ```

---

## 🔧 Configuration

### Quick Config Changes

Edit `/angel/config.js` to customize behavior:

**Essential settings:**
```javascript
// Orchestrator settings
orchestrator: {
    enableDashboard: true,      // Real-time monitoring window
    enableTelemetry: true,       // Performance analytics
}

// Augmentation settings (SF4)
augmentations: {
    enabled: true,               // Auto-purchase augments
    resetScript: "/angel/angel-lite.js",  // Auto-restart after reset
}
```

**For detailed config:** See `config.js` comments - every option is documented inline.

---

## 📊 What Happens After Starting

### Immediate (0-30 seconds)
- ✓ Network scanning begins
- ✓ Server rooting starts
- ✓ Core modules initialize
- ✓ Dashboard window appears

### Early Game (1-5 minutes)
- ✓ Workers deployed across network
- ✓ Money generation starts
- ✓ Server management begins
- ✓ Program purchases (BruteSSH.exe, etc.)

### Mid Game (5-30 minutes)
- ✓ Home RAM upgrades
- ✓ Purchased servers
- ✓ Faction work (if SF4)
- ✓ Augmentation purchases (if SF4)

### Late Game (30+ minutes)
- ✓ Gang operations (if available)
- ✓ Corporation (if available)
- ✓ Bladeburner (if available)
- ✓ Stock market trading
- ✓ Hacknet expansion

---

## 🎛️ Monitoring & Control

### Real-Time Dashboard

Angel launches a monitoring dashboard by default:
- Current money and rates
- Active modules status
- Network statistics
- Next milestone info

**Manual launch:**
```bash
run /angel/modules/dashboard.js
```

### Telemetry System

Track Angel's performance over entire BitNode runs:

```bash
# View live metrics
run /angel/telemetry/ui.js

# Generate reports
run /angel/telemetry/report.js --summary
run /angel/telemetry/report.js --optimize

# See manual
cat /angel/telemetry/MANUAL_LAUNCH.txt
```

### Control Commands

```bash
# Start Angel
run /angel/start.js

# Stop all Angel processes
kill /angel/angel.js

# Restart (if already running)
kill /angel/angel.js; run /angel/start.js

# Watch orchestrator logs
tail /angel/angel.js
```

---

## 🔄 BitNode Resets & Angel-Lite

### Automatic Restart

Angel is configured to **automatically restart** after augmentation installation:
- If you have **64GB+** home RAM: Full Angel starts immediately
- If you have **<64GB** home RAM: Angel-Lite bootstraps until ready

**This means Angel never dies!**

### Angel-Lite Bootstrap

When you reset with low RAM (8GB-32GB):
1. Angel-Lite auto-starts
2. Generates money efficiently
3. Purchases RAM upgrades
4. Transitions to full Angel when ready (64GB)

**Manual launch:** `run /angel/angel-lite.js`

See [ANGEL_LITE_README.md](ANGEL_LITE_README.md) for details.

---

## 🛠️ Troubleshooting

### "Cannot run /angel/angel.js - insufficient RAM"

**Cause:** Home server has less than 15GB RAM

**Solutions:**
- Run Angel-Lite: `run /angel/angel-lite.js`
- Manually upgrade home RAM first
- Wait for Angel-Lite to auto-upgrade (if post-reset)

### "Module failed to start" errors

**Cause:** Missing Source Files or early game state

**Solution:** This is normal! Angel continues running. Modules will auto-start when prerequisites are met.

### No money being generated

**Cause:** Insufficient hack level or ports

**Check:**
- Your hack level (need 1+ to start)
- Available port openers (BruteSSH.exe, etc.)
- Network has rootable servers

**Solution:** Angel will auto-purchase port openers as money permits.

### Dashboard not appearing

**Check:** `config.orchestrator.enableDashboard` is `true`

**Manual launch:** `run /angel/modules/dashboard.js`

### Sync fails with 404 error

**Causes:**
- Repository is private (must be public)
- Wrong GitHub username/repo in sync.js
- Branch name mismatch (main vs master)

**Fix:** Double-check sync.js configuration, ensure repo is public

### Multiple Angel instances running

**Symptom:** Weird behavior, high RAM usage

**Fix:**
```bash
# Kill all Angel processes
killall

# Or manually:
ps
kill <pid>

# Restart clean
run /angel/start.js
```

---

## 📚 Additional Documentation

### Feature-Specific Guides
- [ANGEL_LITE_README.md](ANGEL_LITE_README.md) - Bootstrap system for low RAM scenarios
- [telemetry/README.md](telemetry/README.md) - Performance monitoring system
- [telemetry/MANUAL_LAUNCH.txt](telemetry/MANUAL_LAUNCH.txt) - Telemetry quick reference

### Main Documentation
- [README.md](README.md) - Project overview and feature list
- [config.js](config.js) - All configuration options (inline comments)

### Module Documentation
Most modules have detailed comments at the top of their files:
- `modules/hacking.js` - Worker deployment and target selection
- `modules/servers.js` - Server purchasing and upgrades
- `modules/augments.js` - Augmentation management
- `modules/gang.js` - Gang operations
- etc.

---

## 🚦 Next Steps

### After Installation

1. **Watch the dashboard** for 5-10 minutes to see Angel in action
2. **Check telemetry** after 15-20 minutes: `run /angel/telemetry/report.js --summary`
3. **Review config.js** to understand customization options
4. **Enable/disable modules** based on your playstyle

### For Advanced Users

1. **Integrate telemetry** into custom modules (see telemetry/README.md)
2. **Customize target selection** in config.js
3. **Adjust module intervals** based on telemetry optimization report
4. **Create custom scripts** that hook into Angel's infrastructure

### Getting Help

1. **Check inline comments** in config.js and module files
2. **Review README.md** for feature descriptions
3. **Run telemetry optimize report** for performance issues
4. **Check GitHub issues** for known problems

---

## 📖 Quick Reference

### Essential Commands

```bash
# Install (first time)
wget https://raw.githubusercontent.com/USER/REPO/main/sync.js /angel/sync.js
run /angel/sync.js
run /angel/start.js

# Update (after changes)
run /angel/sync.js
kill /angel/angel.js
run /angel/start.js

# Monitor
run /angel/modules/dashboard.js
run /angel/telemetry/ui.js

# Reports
run /angel/telemetry/report.js --summary
run /angel/telemetry/report.js --optimize

# Control
kill /angel/angel.js           # Stop
run /angel/start.js            # Start
tail /angel/angel.js           # Logs
```

### Files to Edit

```bash
sync.js         # GitHub config (lines 17-19)
bootstrap.js    # Sync URL (line ~12)
config.js       # Angel behavior (everything)
```

### Repository Structure

```
angel/
├── Core files (6)
├── modules/ (21 files)
├── workers/ (4 files)
├── telemetry/ (4 files)
└── loot/ (1 file)
```

---

**Installation complete? Run:** `run /angel/start.js`

**Need help?** See troubleshooting section above or check documentation files.
