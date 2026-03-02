# ANGEL - Automated Network Game Entity Logic

A comprehensive automation orchestrator for Bitburner that manages hacking operations, server infrastructure, augmentations, factions, and more.

**Never stop automating.** Angel runs continuously from early game through BitNode completion and auto-restarts after resets.

---

## ✨ Key Features

- **Automated Hacking**: Intelligent target selection, dynamic worker deployment across network
- **Server Management**: Auto-purchase and upgrade servers as funds permit
- **Augmentation Management**: Queue and install augments automatically (SF4)
- **Faction Automation**: Auto-join and work for reputation (SF4)
- **BitNode Continuity**: Auto-restart after resets with Angel-Lite bootstrap
- **Telemetry System**: Performance monitoring, bottleneck detection, optimization suggestions
- **Real-Time Dashboard**: Live monitoring of all operations
- **Gang Operations**: Full gang management when available
- **Corporation**: Automated company management when available
- **Stock Market**: Automated trading when available
- **Bladeburner**: Task automation when ava ilable

---

## 🚀 Quick Start

**New users:** See **[GETTING_STARTED.md](GETTING_STARTED.md)** for complete installation guide.

### Fastest Setup (3 commands)

1. **Configure sync.js** with your GitHub details
2. **In Bitburner:**
   ```bash
   wget https://raw.githubusercontent.com/YourUser/angel/main/sync.js /angel/sync.js
   run /angel/sync.js
   run /angel/start.js
   ```

**That's it!** Angel is running.

---

## 📋 What Angel Does

### Core Automation
✓ **Network Management**: Scans network, roots servers, deploys workers
✓ **Hacking Operations**: Intelligent target selection, prep + batch coordination
✓ **Income Generation**: Optimized money farming across entire network
✓ **Server Fleet**: Auto-purchases and upgrades servers to 1PB each

### Advanced Features (When Available)
✓ **Augmentations** (SF4): Auto-purchase, queue management, smart reset timing
✓ **Factions** (SF4): Auto-join priority factions, reputation farming
✓ **Gang**: Full gang management, territory warfare, equipment optimization
✓ **Corporation**: Automated company creation and growth
✓ **Stocks**: Automated trading with 4S + TIX API
✓ **Bladeburner**: Task automation and rank farming
✓ **Hacknet**: Node purchasing and upgrade optimization
✓ **Programs**: Auto-creates or purchases all port openers and tools

### Monitoring & Analytics
✓ **Real-Time Dashboard**: Live stats, module status, progress tracking
✓ **Telemetry System**: Performance monitoring, historical comparison, optimization tips
✓ **Reset Tracking**: Tracks progress across BitNode runs

---

## 📁 Project Structure

```
/angel/
├── angel.js                    # Main orchestrator
├── angel-lite.js               # Bootstrap for low-RAM scenarios
├── config.js                   # Configuration (edit this!)
├── start.js                    # Launcher script
├── utils.js                    # Shared utilities
├── scanner .js                  # Network scanning
├── sync.js                     # GitHub download script
├── bootstrap.js                # Quick deploy helper
│
├── modules/                    # 21 automation modules
│   ├── hacking.js              # Core hacking operations
│   ├── servers.js              # Server management
│   ├── augments.js             # Augmentation automation
│   ├── activities.js           # Faction/training/company work
│   ├── gang.js                 # Gang operations
│   ├── corporation.js          # Corporation management
│   ├── stocks.js               # Stock market trading
│   ├── bladeburner.js          # Bladeburner automation
│   ├── hacknet.js              # Hacknet optimization
│   ├── dashboard.js            # Monitoring UI
│   └── ... (12 more modules)
│
├── workers/                    # 4 worker scripts
│   ├── hack.js                 # Hack worker
│   ├── grow.js                 # Grow worker
│   ├── weaken.js               # Weaken worker
│   └── share.js                # Share worker
│
├── telemetry/                  # Performance analytics
│   ├── telemetry.js            # Data collection engine
│   ├── report.js               # Report generator
│   ├── ui.js                   # Real-time monitoring
│   ├── README.md               # Full documentation
│   └── MANUAL_LAUNCH.txt       # Quick reference
│
└── loot/
    └── loot.txt                # Coding contract answers
```

---

## ⚙️ Configuration

**Main config file:** [config.js](config.js)

All options are documented inline. Key settings:

```javascript
// Enable/disable major features
orchestrator: {
    enableHacking: true,
    enableDashboard: true,
    // ... more options
}

// Augmentation behavior (SF4)
augmentations: {
    enabled: true,
    resetScript: "/angel/angel-lite.js",  // Auto-restart after reset
    // ... more options
}

// Telemetry
telemetry: {
    enabled: true,
    sampleIntervalMs: 60000,
    // ... more options
}
```

**For first-time setup:** Most defaults work well. Just enable/disable features you want.

---

## 📊 Monitoring

### Dashboard

Real-time monitoring window (auto-launches):
```bash
run /angel/modules/dashboard.js
```

Shows:
- Current money, hack level, income rates
- Active modules and their status
- Network statistics
- Next milestones
- Reset tracking

### Telemetry

Performance analytics across entire BitNode runs:

```bash
# Live monitoring
run /angel/telemetry/ui.js

# Summary report
run /angel/telemetry/report.js --summary

# Optimization suggestions
run /angel/telemetry/report.js --optimize

# Full manual
cat /angel/telemetry/MANUAL_LAUNCH.txt
```

**Tracks:**
- Module performance (execution counts, durations, failures)
- Money/XP rates over time
- Bottleneck detection
- Historical run comparison
- Actionable optimization tips

---

## 🔄 BitNode Resets & Angel-Lite

### The Problem
After installing augmentations, your home RAM resets (potentially to 8GB). Full Angel needs ~15-64GB to run.

### The Solution: Angel-Lite
Lightweight bootstrap system that:
1. Runs on 8GB RAM
2. Generates money efficiently
3. Auto-purchases RAM upgrades 
4. Transitions to full Angel when ready (64GB)

### Auto-Restart
Angel is configured to **automatically restart** after augmentation installation:
- **64GB+ RAM**: Full Angel starts immediately (~10 seconds)
- **<64GB RAM**: Angel-Lite bootstraps, then transitions (~6-8 minutes)

**This means Angel never dies across BitNode resets!**

See [ANGEL_LITE_README.md](ANGEL_LITE_README.md) for details.

---

## 📚 Documentation

### Getting Started
- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Complete setup guide (start here!)
- [bootstrap.js](bootstrap.js) - Helper script (inline docs)
- [sync.js](sync.js) - Sync configuration (inline docs)

### Features
- **[ANGEL_LITE_README.md](ANGEL_LITE_README.md)** - Bootstrap system
- **[telemetry/README.md](telemetry/README.md)** - Performance monitoring
- **[telemetry/MANUAL_LAUNCH.txt](telemetry/MANUAL_LAUNCH.txt)** - Quick reference
- [config.js](config.js) - All options (inline comments)

### Module Documentation
Each module in `modules/` has detailed comments at the top of the file explaining:
- Purpose and features
- Configuration options
- Manual usage
- API/integration hooks

---

## 🛠️ Common Tasks

### Start/Stop Angel
```bash
# Start
run /angel/start.js

# Stop all
kill /angel/angel.js

# Restart
kill /angel/angel.js; run /angel/start.js
```

### Update from GitHub
```bash
run /angel/sync.js
kill /angel/angel.js
run /angel/start.js
```

### Monitor Performance
```bash
run /angel/modules/dashboard.js           # Real-time
run /angel/telemetry/report.js --summary  # Stats
```

### Manual Module Launch
```bash
# Any module can run standalone
run /angel/modules/hacking.js
run /angel/modules/gang.js
run /angel/modules/stocks.js
# ... etc
```

### Check What's Running
```bash
ps | grep angel
```

---

## 🐛 Troubleshooting

### Angel won't start
- **RAM too low**: Use Angel-Lite: `run /angel/angel-lite.js`
- **Files missing**: Run sync: `run /angel/sync.js`

### No money being generated
- **Early game**: Normal, need hack level 1+ and port openers
- **Check logs**: `tail /angel/modules/hacking.js`

### Module errors
- **"SF not available"**: Normal, module will activate when prerequisite Source Files are obtained
- **Check dashboard**: Shows which modules are active

### Sync fails
- **Repository must be public**
- **Check sync.js config**: Lines 17-19 (username, repo, branch)

**More help:** See [GETTING_STARTED.md](GETTING_STARTED.md) troubleshooting section.

---

## 🎯 Performance Tips

1. **Enable telemetry** - Get optimization suggestions automatically
2. **Review config.js** - Tune intervals and thresholds for your playstyle
3. **Check optimize report** - `run /angel/telemetry/report.js --optimize`
4. **Monitor dashboard** - Watch for bottlenecks in real-time
5. **Reserve RAM** - Adjust `config.hacking.reservedHomeRam` if needed

---

## 📜 License

Free to use and modify for your Bitburner gameplay.

---

## 🙏 Contributing

Improvements welcome! Key areas:
- Additional modules (sleeves, contracts, etc. - though many exist)
- Performance optimizations
- Better target selection algorithms
- Enhanced telemetry metrics
- Documentation improvements

---

**Version**: 2.0  
**Compatible with**: Bitburner 2.x  
**Source Files**: Works with SF1; SF4 unlocks enhanced features
