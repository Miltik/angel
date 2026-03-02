# ANGEL-LITE DESIGN PLAN
**Bootstrap System for Post-BitNode Victory**

---

## 🎯 OBJECTIVE

Create a lightweight, self-contained automation script that bridges the gap between BitNode victory (minimal home RAM) and full Angel orchestrator readiness.

**Problem Statement:**
- After winning a BitNode, home RAM resets to 8GB
- Full Angel requires ~15-25GB to run orchestrator + core modules
- Need automated resource building to reach Angel-ready state

**Success Criteria:**
- ✓ Runs on 8GB home RAM
- ✓ Generates money efficiently
- ✓ Purchases home RAM upgrades automatically
- ✓ Detects Angel-ready state
- ✓ Hands off to full Angel automatically

---

## 📐 ARCHITECTURE

### **Design: Single-File Bootstrap**

**File:** `angel-lite.js` (~300-400 lines)

**Why Single File?**
- Minimal RAM overhead (no import costs)
- Easy to deploy (copy one file)
- Self-contained logic (no module dependencies)
- Can write worker scripts inline at runtime

**RAM Budget:**
```
angel-lite.js main loop:     ~3.5 GB  (with all NS functions)
Worker scripts (3 types):    ~1.75 GB each
Inline worker generation:    ~0 GB (written to disk, not imported)
Total orchestrator RAM:      ~3.5 GB
```

**Remaining for workers:** 4.5GB on 8GB home = 2-3 worker scripts

---

## 🔧 CORE COMPONENTS

### **1. Inline Worker Generation**
```javascript
function deployWorkers(ns) {
    // Write minimal worker scripts to disk
    ns.write("/lite-hack.js", 
        "export async function main(ns){const t=ns.args[0];while(true){await ns.hack(t);}}", 
        "w");
    ns.write("/lite-grow.js", 
        "export async function main(ns){const t=ns.args[0];while(true){await ns.grow(t);}}", 
        "w");
    ns.write("/lite-weaken.js", 
        "export async function main(ns){const t=ns.args[0];while(true){await ns.weaken(t);}}", 
        "w");
}
```

### **2. Network Discovery & Rooting**
- Scan all servers recursively
- Attempt NUKE on servers within hacking skill
- Track rooted servers for worker deployment
- Prioritize servers with money

### **3. Target Selection**
- Early game: `n00dles`, `foodnstuff`, `sigma-cosmetics`
- Mid-bootstrap: `joesguns`, `nectar-net`, `hong-fang-tea`
- Late-bootstrap: `iron-gym`, `phantasy`, `silver-helix`

**Selection Algorithm:**
```javascript
function selectBestTarget(ns, rootedServers) {
    return rootedServers
        .filter(s => ns.getServerMaxMoney(s) > 0)
        .filter(s => ns.getServerRequiredHackingLevel(s) <= ns.getHackingLevel())
        .sort((a, b) => {
            const scoreA = ns.getServerMaxMoney(a) / ns.getServerMinSecurityLevel(a);
            const scoreB = ns.getServerMaxMoney(b) / ns.getServerMinSecurityLevel(b);
            return scoreB - scoreA;
        })[0] || "n00dles";
}
```

### **4. Worker Distribution**
- Calculate total available RAM across rooted servers
- Distribute hack/grow/weaken threads across network
- Ratio: 1 hack : 10 grow : 5 weaken (early game balance)
- Redeploy every 30 seconds or when new servers rooted

### **5. Home RAM Upgrade Logic**
```javascript
async function manageHomeUpgrade(ns) {
    const currentRam = ns.getServerMaxRam("home");
    const upgradeCost = ns.singularity.getUpgradeHomeRamCost();
    const money = ns.getServerMoneyAvailable("home");
    
    // Buy if we have 2x the cost (safety margin)
    if (money >= upgradeCost * 2 && currentRam < 1024) {
        ns.singularity.upgradeHomeRam();
        ns.tprint(`✓ Upgraded home RAM to ${currentRam * 2}GB`);
        return true;
    }
    return false;
}
```

**Upgrade Thresholds:**
- 8GB → 16GB: Wait for $55k
- 16GB → 32GB: Wait for $220k
- 32GB → 64GB: Wait for $880k
- 64GB → 128GB: Wait for $3.5M (Angel-ready threshold)

### **6. Angel Readiness Detection**
```javascript
function checkAngelReady(ns) {
    const homeRam = ns.getServerMaxRam("home");
    const angelRam = ns.fileExists("/angel/angel.js") 
        ? ns.getScriptRam("/angel/angel.js") 
        : 20; // Estimate if not present
    const money = ns.getServerMoneyAvailable("home");
    
    // Criteria:
    // 1. Home RAM >= 64GB (comfortable margin)
    // 2. Angel files exist OR enough money to run sync
    // 3. Have basic programs (if Angel needs them)
    
    return homeRam >= 64 && 
           (ns.fileExists("/angel/angel.js") || money > 1000000);
}
```

### **7. Automatic Handoff**
```javascript
async function transitionToAngel(ns) {
    ns.tprint("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    ns.tprint("    ANGEL-LITE → ANGEL TRANSITION    ");
    ns.tprint("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // Stop all lite workers
    ns.killall("home", true); // Kill all except this script
    await ns.sleep(500);
    
    // Download Angel if not present
    if (!ns.fileExists("/angel/angel.js")) {
        ns.tprint("Downloading full ANGEL system...");
        if (ns.fileExists("/angel/sync.js")) {
            ns.exec("/angel/sync.js", "home");
            await ns.sleep(30000); // Wait for sync to complete
        } else {
            ns.tprint("ERROR: Cannot find /angel/sync.js");
            ns.tprint("Please manually download Angel or run bootstrap.js");
            return;
        }
    }
    
    // Launch Angel
    ns.tprint("Launching full ANGEL orchestrator...");
    const pid = ns.exec("/angel/start.js", "home");
    
    if (pid > 0) {
        ns.tprint("✓ ANGEL started successfully!");
        ns.tprint("Angel-lite shutting down...");
        ns.exit();
    } else {
        ns.tprint("✗ Failed to start ANGEL");
        ns.tprint("Angel-lite will continue running");
    }
}
```

---

## 🎮 MAIN LOOP STRUCTURE

```javascript
export async function main(ns) {
    ns.disableLog("ALL");
    ns.tail();
    
    let lastUpgradeCheck = 0;
    let lastNetworkScan = 0;
    let lastWorkerDeploy = 0;
    let lastAngelCheck = 0;
    
    // Initial setup
    deployWorkers(ns);
    
    while (true) {
        const now = Date.now();
        
        // Every 5 seconds: Check for Angel readiness
        if (now - lastAngelCheck > 5000) {
            if (checkAngelReady(ns)) {
                await transitionToAngel(ns);
                return; // Exit if transition successful
            }
            lastAngelCheck = now;
        }
        
        // Every 10 seconds: Attempt home RAM upgrade
        if (now - lastUpgradeCheck > 10000) {
            await manageHomeUpgrade(ns);
            lastUpgradeCheck = now;
        }
        
        // Every 30 seconds: Full network scan + rooting
        if (now - lastNetworkScan > 30000) {
            scanAndRoot(ns);
            lastNetworkScan = now;
        }
        
        // Every 60 seconds: Redeploy workers
        if (now - lastWorkerDeploy > 60000) {
            deployHackingWorkers(ns);
            lastWorkerDeploy = now;
        }
        
        // Update display
        displayStatus(ns);
        
        await ns.sleep(1000);
    }
}
```

---

## 📊 STATUS DISPLAY

```
╔════════════════════════════════════════════════════════════╗
║              ANGEL-LITE BOOTSTRAP v1.0                     ║
╚════════════════════════════════════════════════════════════╝

💰 Money:        $2.45M  (+$184k/sec)
💾 Home RAM:     64GB / 1024GB max
🎯 Target:       joesguns ($25.0M max, 45% hacked)
🌐 Network:      24 servers (18 rooted)
⚙️  Workers:     42 hack, 420 grow, 210 weaken

📈 Progress to Angel:
  [████████████████████░░░░]  80%
  
  ✓ Home RAM: 64GB (target: 64GB)
  ✓ Money: $2.45M (target: $1M)
  ⏳ Estimated handoff: 2m 15s
  
Next upgrade: 128GB RAM for $3.5M (available in ~3min)
```

---

## 🚀 DEPLOYMENT STRATEGY

### **Initial Setup (Post-BitNode Win)**

1. **Player manually downloads angel-lite.js:**
   ```bash
   wget https://raw.githubusercontent.com/USERNAME/REPO/main/angel-lite.js angel-lite.js
   ```

2. **Run angel-lite:**
   ```bash
   run angel-lite.js
   ```

3. **Angel-lite operates autonomously:**
   - Scans network
   - Roots servers
   - Deploys workers
   - Earns money
   - Buys RAM upgrades
   - Monitors for Angel readiness

4. **Automatic transition:**
   - When home RAM ≥ 64GB and money > $1M
   - Downloads full Angel (if needed)
   - Launches Angel
   - Self-terminates

### **Bootstrap.js Integration**

Update bootstrap.js to offer angel-lite option:
```javascript
if (homeRam < 64) {
    ns.tprint("Home RAM is low. Download angel-lite.js for bootstrap?");
    ns.tprint("  wget YOUR_REPO_URL/angel-lite.js angel-lite.js");
} else {
    ns.tprint("Continue with full ANGEL sync...");
}
```

---

## 🎛️ CONFIGURATION

**Embedded config at top of angel-lite.js:**

```javascript
const CONFIG = {
    // RAM thresholds
    ANGEL_READY_RAM: 64,          // GB needed to run Angel
    MAX_HOME_RAM: 1024,            // Stop upgrading at this point
    
    // Upgrade behavior
    UPGRADE_SAFETY_MULTIPLIER: 2,  // Have 2x cost before buying
    
    // Worker ratios
    HACK_RATIO: 1,
    GROW_RATIO: 10,
    WEAKEN_RATIO: 5,
    
    // Timings
    ANGEL_CHECK_INTERVAL: 5000,    // Check every 5s
    UPGRADE_CHECK_INTERVAL: 10000, // Check every 10s
    NETWORK_SCAN_INTERVAL: 30000,  // Scan every 30s
    WORKER_DEPLOY_INTERVAL: 60000, // Redeploy every 60s
    
    // Transition
    AUTO_TRANSITION: true,          // Automatically launch Angel
    REQUIRE_SYNC: true,             // Download Angel via sync.js if missing
};
```

---

## 🔄 HANDOFF PROTOCOL

### **Transition Checklist:**

```javascript
function validateTransitionReady(ns) {
    const checks = {
        homeRam: ns.getServerMaxRam("home") >= CONFIG.ANGEL_READY_RAM,
        money: ns.getServerMoneyAvailable("home") >= 1000000,
        angelExists: ns.fileExists("/angel/angel.js"),
        syncExists: ns.fileExists("/angel/sync.js"),
        startExists: ns.fileExists("/angel/start.js"),
    };
    
    const allChecks = Object.values(checks).every(v => v);
    
    if (!allChecks) {
        ns.print("Transition checks:");
        for (const [key, value] of Object.entries(checks)) {
            ns.print(`  ${value ? "✓" : "✗"} ${key}`);
        }
    }
    
    return allChecks;
}
```

### **Graceful Shutdown:**

1. Log transition event
2. Kill all lite workers
3. Wait 500ms for cleanup
4. Launch Angel via start.js
5. Wait 2s to confirm Angel running
6. Self-terminate if Angel PID > 0
7. Continue if Angel failed to start

---

## 🧪 TESTING STRATEGY

### **Test Scenarios:**

1. **Fresh BitNode (8GB RAM):**
   - Verify angel-lite starts and runs
   - Confirm worker deployment
   - Check money generation
   - Monitor RAM upgrades

2. **Mid-Bootstrap (32GB RAM):**
   - Test target selection upgrade
   - Verify worker scaling
   - Check upgrade logic

3. **Pre-Transition (64GB RAM, $1M):**
   - Verify Angel detection
   - Test sync.js download
   - Confirm Angel launch
   - Validate self-termination

4. **Manual Transition Override:**
   - Test forcing transition early (via flag)
   - Test disabling auto-transition

### **Edge Cases:**

- Angel already running (shouldn't start lite)
- Sync.js fails (manual intervention prompt)
- Angel fails to start (lite continues)
- Home RAM downgrade (shouldn't happen, but handle)

---

## 📈 PROGRESSION TIMELINE

**Estimated Timeline (varies by BitNode):**

```
T+0:00    Angel-lite starts (8GB home RAM)
T+0:30    First home upgrade → 16GB     ($55k)
T+2:00    Second upgrade → 32GB         ($220k)
T+5:00    Third upgrade → 64GB          ($880k)
T+6:00    ANGEL-READY (64GB + $1M)
T+6:05    Sync downloads full Angel
T+6:35    Angel starts, lite exits
T+6:40    Full automation active
```

**Money Generation Rates:**
- 8GB phase:  ~$15k/min  (2 servers, basic target)
- 16GB phase: ~$50k/min  (5 servers, better targets)
- 32GB phase: ~$200k/min (15 servers, optimal targets)

---

## 🔮 FUTURE ENHANCEMENTS

### **V1.1 - Crime Option:**
Add early game crime for faster initial money:
```javascript
if (homeRam < 16 && ns.singularity) {
    // Commit crimes for fast early cash
    ns.singularity.commitCrime("Shoplift");
}
```

### **V1.2 - Augment Check:**
Detect if need to install augments before running:
```javascript
const ownedAugs = ns.singularity.getOwnedAugmentations();
if (ownedAugs.length > 0) {
    // Install and reset
}
```

### **V1.3 - Phase Detection:**
Adapt strategy based on BitNode modifiers:
```javascript
const bitNode = ns.getResetInfo().currentNode;
// Adjust ratios/targets based on BitNode
```

---

## 📦 DELIVERABLES

1. **angel-lite.js** - Main bootstrap script (~400 lines)
2. **ANGEL_LITE_README.md** - User documentation
3. **Update bootstrap.js** - Add lite recommendation
4. **Update sync.js** - Include angel-lite.js in file list
5. **Update main README.md** - Document lite usage

---

## ✅ ACCEPTANCE CRITERIA

- [ ] angel-lite.js runs on 8GB home RAM
- [ ] Generates money at >= $10k/min on 8GB
- [ ] Automatically purchases RAM upgrades
- [ ] Detects Angel-ready state correctly
- [ ] Downloads full Angel via sync.js
- [ ] Launches Angel automatically
- [ ] Self-terminates after successful handoff
- [ ] Handles failure cases gracefully
- [ ] Displays clear status information
- [ ] Documented for user deployment

---

## 🚦 NEXT STEPS

1. **Review plan with user** ✓ (awaiting feedback)
2. **Implement angel-lite.js** (if approved)
3. **Test in BitNode restart scenario**
4. **Integrate with existing Angel**
5. **Update documentation**
6. **Deploy to repository**

---

**Status:** 📋 **PLAN COMPLETE - AWAITING USER APPROVAL**
