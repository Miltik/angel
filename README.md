# ANGEL - Automated Network Game Entity Logic

A modular orchestrator for Bitburner that automates core game mechanics. Designed for SF1 (Source-File 1) and SF4 (Source-File 4) gameplay.

## 📝 Recent Update

- **2026-02-16**: Merged phase/activity coordinator + reset monitor output into `modules/dashboard.js` and removed legacy `modules/milestones.js`.
- **2026-02-16**: Fixed Hacknet post-reset behavior so nodes/upgrades are bought in early game. Added adaptive bootstrap budgeting (`bootstrapNodeTarget`, `bootstrapSpendRatio`) plus scaled reserve controls (`reserveScale`, `minReserveMoney`) in `config.js`.

## 🚀 Quick Start

### Method 1: GitHub Sync (Recommended)

1. Push this repository to GitHub
2. Edit [sync.js](sync.js) and update the GitHub repository settings
3. In Bitburner, run: `wget <your-raw-github-url>/sync.js /angel/sync.js`
4. Then run: `run /angel/sync.js`

### Method 2: Bootstrap Script (Easiest)

1. Push this repository to GitHub
2. Edit [bootstrap.js](bootstrap.js) with your GitHub URL
3. Copy only bootstrap.js to Bitburner
4. Run: `run bootstrap.js`
5. Then run: `run /angel/sync.js`

### Method 3: Manual Copy

1. Copy all files from this directory to `/angel/` on your Bitburner home server
2. Run the orchestrator: `run /angel/angel.js`

### What Happens Next

The system will automatically:
   - Scan and root all accessible servers
   - Start automated hacking operations
   - Manage server purchases and upgrades
   - Handle faction work (if SF4 available)
   - Manage augmentation purchases (if SF4 available)

## 📁 Project Structure

```
/angel/
├── angel.js              # Main orchestrator
├── config.js             # Configuration settings
├── utils.js              # Utility functions
├── scanner.js            # Network scanning and rooting
├── sync.js               # GitHub sync script
├── bootstrap.js          # Bootstrap installer
├── modules/
│   ├── hacking.js        # Automated hacking operations
│   ├── servers.js        # Server purchase and management
│   ├── factions.js       # Faction automation (SF4)
│   ├── augments.js       # Augmentation management (SF4)
│   └── programs.js       # TOR, programs, and backdoors
└── workers/
    ├── hack.js           # Hack worker script
    ├── grow.js           # Grow worker script
    ├── weaken.js         # Weaken worker script
    └── share.js          # Share worker script
```

## ⚙️ Configuration

Edit `config.js` to customize ANGEL's behavior:

### Orchestrator Settings
- `loopDelay`: Main loop delay in milliseconds (default: 1000)
- `enableHacking`: Enable/disable hacking automation
- `enableServerMgmt`: Enable/disable server management
- `enableFactions`: Enable/disable faction automation
- `enableAugments`: Enable/disable augmentation automation

### Hacking Settings
- `targetMoneyThreshold`: Hack when money is above this % of max (default: 0.75)
- `targetSecurityThreshold`: Only hack when security is within this of min (default: 5)
- `reservedHomeRam`: RAM to reserve on home server in GB (default: 32)
- `shareExcessRam`: Use excess RAM for share() to boost faction rep

### Server Settings
- `autoBuyServers`: Automatically purchase servers (default: true)
- `maxServerRam`: Maximum RAM per server in GB (default: 1048576 = 1PB)
- `purchaseThreshold`: Buy when we have this % of cost (default: 0.1)
- `serverPrefix`: Prefix for purchased servers (default: "angel-")
- `maxServers`: Maximum number of servers to buy (default: 25)

### Faction Settings (SF4 Required)
- `autoJoinFactions`: Automatically join factions (default: true)
- `priorityFactions`: List of factions to prioritize
- `workForFactionRep`: Automatically work for faction rep (default: true)

### Augmentation Settings (SF4 Required)
- `autoBuyAugments`: Automatically purchase augments (default: false)
- `preBuyAugments`: Queue augments before reset (default: true)
- `augmentPriority`: List of priority augmentations

### Programs & Backdoor Settings
- `autoBuyTor`: Auto-purchase TOR router (default: true)
- `autoBuyPrograms`: Buy programs from darkweb (default: true)
- `autoCreatePrograms`: Create programs when idle (default: true)
- `autoBackdoor`: Backdoor faction servers automatically (default: true)
- `purchaseThreshold`: Buy when we have this % of cost (default: 0.05)

## 📦 Modules

### Hacking Module (`modules/hacking.js`)
- Automatically finds and roots hackable servers
- Distributes hack/grow/weaken operations across all available RAM
- Preps targets (weaken to min security, grow to max money)
- Executes continuous hack cycles for optimal income

**Run standalone:**
```
run /angel/modules/hacking.js
```

### Server Management Module (`modules/servers.js`)
- Automatically roots new servers as they become accessible
- Purchases new servers when funds are available
- Upgrades existing servers to higher RAM tiers
- Manages purchased server fleet efficiently

**Run standalone:**
```
run /angel/modules/servers.js
```

### Faction Module (`modules/factions.js`)
*Requires SF4 (Singularity)*
- Automatically accepts faction invitations from priority list
- Works for factions to gain reputation
- Prioritizes factions based on configuration
- Focuses on factions with valuable augmentations

**Run standalone:**
```
run /angel/modules/factions.js
```

**Display faction status:**
```
run /angel/modules/factions.js --tail
```

### Augmentation Module (`modules/augments.js`)
*Requires SF4 (Singularity)*
- Tracks available augmentations
- Purchases priority augmentations when affordable
- Can auto-buy all affordable augments (disabled by default)
- Handles augmentation installation and reset

**Run standalone:**
```
run /angel/modules/augments.js
```

### Programs & Backdoor Module (`modules/programs.js`)
- Automatically purchases TOR router when affordable
- Creates or buys port opener programs (BruteSSH, FTPCrack, etc.)
- Purchases useful programs from darkweb
- Automatically backdoors faction servers (CSEC, NiteSec, BitRunners, etc.)
- Tracks owned programs and port opener count

**Run standalone:**
```
run /angel/modules/programs.js
```

**Key features:**
- **TOR Router**: Auto-purchases when you have $200k
- **Programs**: Creates programs when idle, buys from darkweb if needed
- **Backdoors**: Installs backdoors on faction servers for easy invites
- **Port Openers**: Prioritizes tools that unlock more servers

## 🛠️ Utilities

### Scanner (`scanner.js`)
Network scanning and server rooting utilities.

**Functions:**
- `scanAll()`: Scan entire network
- `getRootedServers()`: Get servers with root access
- `getUnrootedServers()`: Get servers without root access
- `getHackableServers()`: Get rooted servers within hacking level
- `tryGainRoot(server)`: Attempt to root a specific server
- `rootAll()`: Attempt to root all accessible servers

**Run as script:**
```
run /angel/scanner.js
```

### Utils (`utils.js`)
General utility functions for formatting, calculations, and common operations.

**Key Functions:**
- `formatMoney()`: Format currency
- `formatRam()`: Format RAM sizes
- `formatTime()`: Format milliseconds to readable time
- `getAvailableRam()`: Calculate available RAM on a server
- `getBestTarget()`: Find optimal hacking target
- `deployFiles()`: Copy scripts to target servers

## 📊 Monitoring

The main orchestrator displays a real-time status dashboard showing:
- Current money and hacking level
- Network statistics (total/rooted/hackable servers)
- Purchased server count and RAM
- Available RAM across all servers
- Module status

## 🎯 Usage Examples

### Basic Usage
```javascript
// Start the orchestrator
run /angel/angel.js
```

### Check Network Status
```javascript
// Scan network and display all servers
run /angel/scanner.js
```

### Manual Faction Management (SF4)
```javascript
// Display faction status
run /angel/modules/factions.js
```

### Manual Augmentation Purchase (SF4)
```javascript
// Display available augments
run /angel/modules/augments.js
```

## 🔧 Advanced Configuration

### Custom Target Lists
Edit the `targets` section in `config.js` to define your own server target lists:

```javascript
targets: {
    earlyGame: ["n00dles", "foodnstuff", "sigma-cosmetics"],
    midGame: ["iron-gym", "phantasy", "silver-helix"],
}
```

### Custom Priority Factions
Edit `priorityFactions` in `config.js`:

```javascript
factions: {
    priorityFactions: [
        "CyberSec",
        "Netburners",
        "Daedalus",
        // Add your own...
    ],
}
```

### Custom Augmentation Priority
Edit `augmentPriority` in `config.js`:

```javascript
augmentations: {
    augmentPriority: [
        "BitWire",
        "Artificial Bio-neural Network Implant",
        // Add your own...
    ],
}
```

## 🐛 Troubleshooting

### "Insufficient RAM" errors
- Increase `reservedHomeRam` in config if running on home server
- Upgrade home server RAM
- Purchase more servers

### Modules not starting
- Check if scripts exist in correct locations
- Verify sufficient RAM is available
- Check orchestrator logs for specific errors

### SF4 features not working
- Verify you have Source-File 4 installed
- Check that Singularity functions are accessible
- Some SF4 features may have reduced functionality at lower SF4 levels

## 📝 Notes

- **SF1 (Source-File 1)**: Core hacking and server management features work without SF4
- **SF4 (Source-File 4)**: Required for faction and augmentation automation
- The system is designed to be modular - each module can run independently
- All modules will auto-restart if killed (managed by orchestrator)
- Worker scripts (hack/grow/weaken) are minimal and RAM-efficient

## 🎮 Recommended Workflow

1. **Early Game**: Focus on hacking automation and server purchases
2. **Mid Game**: Enable faction work to build reputation
3. **Late Game**: Use augmentation module to prepare for resets
4. **Before Reset**: Purchase all desired augmentations manually or enable auto-buy

## 🚦 Performance Tips

- Adjust `loopDelay` in config to balance responsiveness vs CPU usage
- Use `reservedHomeRam` to ensure space for manual scripts
- Disable unused modules to save RAM
- Consider running modules on purchased servers if home RAM is limited

## 📜 License

Free to use and modify for your Bitburner gameplay.

---

**Version**: 1.0  
**Compatible with**: Bitburner v2.x  
**Source Files**: SF1, SF4 (SF4 optional for extended features)
