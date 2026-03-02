# Angel-Lite Bootstrap System

## Overview

Angel-Lite is a minimal, self-contained bootstrap script designed to bridge the gap between BitNode victory (8GB home RAM) and full Angel readiness (64GB+ RAM). It runs autonomously to generate income, purchase RAM upgrades, and automatically transition to the full ANGEL orchestrator when prerequisites are met.

## Quick Start

```bash
# After winning a BitNode with 8GB home RAM
run angel-lite.js
```

That's it! The script will:
- Generate money efficiently
- Purchase home RAM upgrades automatically
- Transition to full ANGEL when ready (64GB RAM + $1M)

## Features

### Self-Contained Operation
- **No module dependencies** - Everything is inline
- **Auto-generates workers** - Creates hack/grow/weaken scripts on startup
- **Network scanning** - Finds and roots servers automatically
- **Intelligent targeting** - Selects best money-making servers

### Automatic RAM Upgrades
- Monitors available money continuously
- Purchases upgrades when safe (2x cost threshold)
- Upgrades from 8GB → 16GB → 32GB → 64GB → ... → 1024GB max

### Worker Distribution
- Deploys hacking workers across all rooted servers
- Balanced ratio: 1 hack : 10 grow : 5 weaken
- Reserves 4GB on home for the orchestrator itself
- Redeploys every 60s to optimize efficiency

### Angel Transition
- **Automatic detection** when ready (64GB + $1M)
- **Downloads Angel** via sync.js if not present
- **Launches full orchestrator** via start.js
- **Clean handoff** - Stops all lite workers, starts Angel modules

## Configuration

Edit the `CONFIG` object at the top of [angel-lite.js](angel-lite.js) to customize behavior:

```javascript
const CONFIG = {
    // RAM thresholds
    ANGEL_READY_RAM: 64,           // GB needed to run Angel
    MAX_HOME_RAM: 1024,             // Stop upgrading at this point
    ANGEL_READY_MONEY: 1000000,     // $1M for comfort margin
    
    // Upgrade behavior
    UPGRADE_SAFETY_MULTIPLIER: 2,   // Have 2x cost before buying
    
    // Worker ratios
    HACK_RATIO: 1,
    GROW_RATIO: 10,
    WEAKEN_RATIO: 5,
    
    // Timings (ms)
    ANGEL_CHECK_INTERVAL: 5000,     // Check every 5s
    UPGRADE_CHECK_INTERVAL: 10000,  // Check every 10s
    NETWORK_SCAN_INTERVAL: 30000,   // Scan every 30s
    WORKER_DEPLOY_INTERVAL: 60000,  // Redeploy every 60s
    
    // Transition
    AUTO_TRANSITION: true,           // Automatically launch Angel
    REQUIRE_SYNC: true,              // Download Angel via sync.js if missing
};
```

## Display

Angel-Lite shows a real-time dashboard with:

```
╔════════════════════════════════════════════════════════════╗
║              ANGEL-LITE BOOTSTRAP v1.0                     ║
╚════════════════════════════════════════════════════════════╝

💰 Money:        $24.50M  (+$2.50M/sec)
💾 Home RAM:     32GB / 1024GB max
🎯 Target:       joesguns
🌐 Network:      45 servers rooted
⚙️  Workers:      850 deployed
💻 Hack Level:   450

📈 Progress to Angel:
  [████████████░░░░░░░░]  60%

  ✓ Home RAM: 32GB / 64GB
  ⏳ Money: $24.50M / $100.00M

Next upgrade: 64GB RAM for $80.00M (5m 30s)
```

## Timeline

Expected progression from BitNode win to Angel launch:

| Time    | Home RAM | Approximate Money | Status          |
|---------|----------|-------------------|-----------------|
| 0:00    | 8GB      | ~$0               | Angel-lite start|
| 2:00    | 16GB     | ~$1M              | First upgrade   |
| 4:00    | 32GB     | ~$20M             | Second upgrade  |
| 6-8:00  | 64GB     | ~$100M+           | Angel ready     |

*Times are approximate and depend on network size, hack level, and available port openers*

## Transition Process

When Angel-Lite detects readiness (64GB + $1M):

1. **Stops all workers** across the network
2. **Downloads Angel** via [sync.js](sync.js) if files are missing
3. **Launches Angel** via [start.js](start.js)
4. **Exits cleanly** to free resources

You'll see:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    ANGEL-LITE → ANGEL TRANSITION    
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Stopping all lite workers...
Launching full ANGEL orchestrator...
✓ ANGEL started successfully!
✓ Angel-lite shutting down...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Prerequisites

### Required
- **8GB home RAM** minimum
- **Singularity API** access (for RAM upgrades)

### Recommended
- **Port opener programs** (BruteSSH.exe, FTPCrack.exe, etc.) - More servers = faster income
- **sync.js configured** - For automatic Angel download (see [SETUP_GITHUB_SYNC.md](SETUP_GITHUB_SYNC.md))

## Manual Transition

If you want to manually control the transition to Angel:

1. Set `AUTO_TRANSITION: false` in CONFIG
2. Angel-Lite will continue running even when ready
3. Manually run `kill angel-lite.js; run /angel/start.js` when desired

## Troubleshooting

### "Cannot find /angel/sync.js"
- Download sync.js manually first
- Or place full Angel files in `/angel/` directory before running

### "Failed to start ANGEL (insufficient RAM?)"
- Verify you have 64GB+ home RAM
- Check that Angel files downloaded successfully
- Ensure previous Angel processes are stopped

### Angel-Lite running but no money generated
- Check worker deployment count
- Verify network has hackable servers
- Ensure your hack level is sufficient for available targets
- Check that port opener programs are available

### Workers not deploying
- Ensure target server has money (`getServerMaxMoney() > 0`)
- Check that your hack level meets server requirements
- Verify sufficient RAM available on network servers

## Architecture

Angel-Lite is a single-file script (~600 lines) that:
- Generates worker scripts inline (hack, grow, weaken)
- Implements full network scanning and rooting
- Manages target selection with scoring algorithm
- Distributes workers across available RAM
- Monitors progress and manages upgrades
- Handles transition orchestration

No external dependencies = guaranteed to run on any 8GB+ home server.

## Integration with Full Angel

Angel-Lite is designed to seamlessly hand off to the full ANGEL orchestrator:

- **Complementary** - Never run simultaneously
- **Same ecosystem** - Uses same sync.js for downloads
- **Clean transition** - Stops all workers before Angel starts
- **Automated** - Requires no user intervention

## See Also

- [ANGEL_LITE_PLAN.md](ANGEL_LITE_PLAN.md) - Complete design specification
- [README.md](README.md) - Full Angel orchestrator documentation
- [QUICKSTART.md](QUICKSTART.md) - Getting started with Angel
- [SETUP_GITHUB_SYNC.md](SETUP_GITHUB_SYNC.md) - Configuring automatic downloads
