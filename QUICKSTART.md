# ANGEL Quick Start Guide

## Installation

### Option A: GitHub Sync (Recommended)

1. **Push ANGEL to GitHub** (if not already done)
2. **Edit sync.js** with your GitHub repository details
3. **In Bitburner**, download the sync script:
   ```
   wget <your-raw-github-url>/sync.js /angel/sync.js
   ```
4. **Run the sync script:**
   ```
   run /angel/sync.js
   ```

### Option B: Bootstrap (Easiest for updates)

1. **Edit bootstrap.js** with your sync.js GitHub URL
2. **Copy only bootstrap.js** to Bitburner
3. **Run:**
   ```
   run bootstrap.js
   run /angel/sync.js
   ```

### Option C: Manual Installation

1. **In Bitburner**, navigate to the terminal
2. Create the `/angel/` directory structure
3. Copy all files from your local workspace to Bitburner's `/angel/` directory

## Starting ANGEL

### Option 1: Quick Start (Recommended)
```
run /angel/start.js
```

### Option 2: Direct Launch
```
run /angel/angel.js
```

### Option 3: With Tail (to see logs)
```
run /angel/angel.js; tail /angel/angel.js
```

## Stopping ANGEL

```
run /angel/start.js stop
```

## Restarting ANGEL

```
run /angel/start.js restart
```

## Checking Status

```
run /angel/status.js
```

For detailed status:
```
run /angel/status.js --detailed
```

## First Time Setup

1. **Review Configuration**
   - Edit `/angel/config.js` to customize settings
   - Pay attention to `reservedHomeRam` setting
   - Adjust `purchaseThreshold` for server buying

2. **Start the Orchestrator**
   ```
   run /angel/start.js
   ```

3. **Monitor Progress**
   ```
   tail /angel/angel.js
   ```

## Common Commands

| Command | Description |
|---------|-------------|
| `run /angel/sync.js` | Sync files from GitHub |
| `run /angel/start.js` | Start ANGEL |
| `run /angel/start.js stop` | Stop ANGEL |
| `run /angel/start.js restart` | Restart ANGEL |
| `run /angel/status.js` | View system status |
| `run /angel/scanner.js` | Scan and display network |
| `run /angel/install.js` | Check installation |
| `run /angel/standalones/xpFarm.js` | Run XP farm independently |
| `run /angel/standalones/networkMap.js` | Run network map independently |
| `run /angel/standalones/backdoor.js` | Run backdoor flow independently |

## Runtime Layout

- Canonical orchestrator runtime scripts live in `/angel/modules/`.
- `/angel/xpFarm.js`, `/angel/networkMap.js`, and `/angel/backdoor.js` are compatibility wrappers.
- Use `/angel/standalones/*` when launching those tools outside normal orchestrator flow.

## What ANGEL Does Automatically

### Always Active (SF1)
- ✓ Scans network for all servers
- ✓ Attempts to root all accessible servers
- ✓ Distributes hacking operations across all rooted servers
- ✓ Automatically purchases and upgrades servers
- ✓ Manages hack/grow/weaken cycles

### With SF4 (Singularity)
- ✓ Joins priority factions automatically
- ✓ Works for faction reputation
- ✓ Tracks available augmentations
- ✓ Can auto-purchase augmentations (if enabled)

## Configuration Quick Reference

### Essential Settings

```javascript
// In config.js

// Reserve RAM on home for manual scripts
hacking: {
    reservedHomeRam: 32,  // Increase if you run many manual scripts
}

// Control server purchases
servers: {
    autoBuyServers: true,
    purchaseThreshold: 0.1,  // Buy when we have 10% of cost
}

// Faction automation (SF4)
factions: {
    autoJoinFactions: true,
    workForFactionRep: true,
}

// Augmentation automation (SF4)
augmentations: {
    autoBuyAugments: false,  // Keep false to manually control purchases
}
```

## Troubleshooting

### "Insufficient RAM" Error
- Increase `reservedHomeRam` in config
- Kill unnecessary scripts
- Upgrade home RAM

### Modules Not Starting
- Run `/angel/status.js` to see which modules failed
- Check RAM availability
- Verify all files are present with `/angel/install.js`

### No Hacking Activity
- Check if hacking module is enabled in config
- Verify targets are available with `/angel/scanner.js`
- Check your hacking level is high enough

### SF4 Features Not Working
- Verify you have Source-File 4 installed
- Check Node Stats in-game to confirm SF4
- Some features require SF4 level 3 for full functionality

## Performance Tips

1. **Early Game**: Start with default settings
2. **Mid Game**: Increase server purchase threshold as money grows
3. **Late Game**: Enable augmentation automation if desired
4. **Always**: Monitor with `/angel/status.js` regularly

## Module Control

To disable specific modules, edit `config.js`:

```javascript
orchestrator: {
    enableHacking: true,      // Core money-making
    enableServerMgmt: true,   // Server buying
    enableFactions: false,    // Disable if not using SF4
    enableAugments: false,    // Disable if not using SF4
   enableCorporation: false, // Enable only when you have Corp API and want automation
}
```

## Next Steps

1. Let ANGEL run for a few minutes
2. Check status with `/angel/status.js`
3. Monitor money growth
4. Adjust configuration as needed
5. Once you have SF4, enable faction/augment features

## Support

- Check `/angel/README.md` for full documentation
- Review `/angel/config.js` for all available settings
- Examine individual module files for detailed behavior

---

**Happy hacking! 🚀**
