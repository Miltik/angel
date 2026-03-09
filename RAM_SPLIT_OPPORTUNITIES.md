# Angel Module RAM Optimization Analysis

## Overview
Analysis of 5 key modules to identify split opportunities for RAM reduction via code separation, facade abstraction, and port-based messaging. All RAM figures are API call costs, not file storage.

---

## 1. DASHBOARD.JS
**Current Size:** ~1,380 lines  
**Estimated API RAM Cost:** 180-220 GB  
**Loop Frequency:** Every 2 seconds  

### Main Responsibilities
1. **Display Orchestration** - Coordinates rendering of 15+ data panels
2. **Metrics Aggregation** - Pulls state from metrics.js, history.js, network
3. **Status Tracking** - Game phase, money/XP rates, player activity
4. **Augmentation Planning** - Faction grind targets, aug goal snapshots
5. **Multi-System Monitoring** - Gang, Bladeburner, Sleeves, Hacknet, Stocks, Programs, Contracts, Loot

### Heavy API Imports
```
Singularity: getOwnedAugmentations(2x), getFactionRep(), getAugmentationsFromFaction(),
             getAugmentationPrice(), getAugmentationRepReq(), checkFactionInvitations(),
             getCurrentWork(), getPlayer(), getResetInfo()

Gang: inGang(), getGangInformation(), getMemberNames()
Bladeburner: getRank(), getStamina(), getCurrentAction(), getCity()
Sleeve: getNumSleeves(), getTask(), getSleeve()
Hacknet: numNodes(), getNodeStats()
Stock: getSymbols(), getPosition(), getBidPrice()
Services: scanAll() (network service), metrics.js functions
```

### Code Duplication Issues
- **Augmentation Analysis** (lines 480-550): 
  - `getFactionOpportunitySummaryDashboard()` duplicates logic from `factions-augments.js`
  - `getAugmentGoalSnapshot()` duplicates `augments.js` smart targeting logic
  - Recalculates faction rep/price/prerequisite checks every 2 seconds

- **Faction Trading** (lines 415-450):
  - Duplicates faction opportunity summary calculation
  - Calls `getAugmentationsFromFaction()` + price/rep lookup for all factions

### Transitive Dependencies
- `history.js` → not directly in module; imported at top but many functions redeclared locally
- `metrics.js` → Heavy dependency pulls ALL metrics calculations
- `network.js (scanAll())` → Pulls full network scanning infrastructure
- Uses `uiManager` which may pull other modules

### Split Candidates

| Responsibility | Split Module Name | Estimated Saving | Complexity |
|---|---|---|---|
| Augmentation snapshot/planning | `dashboard-augments.js` | 25-35 GB | Low |
| Multi-faction opportunity aggregation | `dashboard-factions.js` | 30-40 GB | Low |
| Bladeburner/Gang/Sleeve display | `dashboard-combat.js` | 20-30 GB | Medium |
| Stocks/Hacknet/Programs display | `dashboard-assets.js` | 20-30 GB | Medium |
| Reset history tracking | Port-based from `history.js` | 10-15 GB | Medium |

### Priority Recommendation: **HIGH**
**Suggested Actions:**
1. Extract `getFactionOpportunitySummaryDashboard()`, `getAugmentGoalSnapshot()` → facade module
2. Replace direct faction queries with port-based state from `factions.js` 
3. Port-subscribe to Bladeburner/Gang status instead of polling
4. Lazy-load or conditionally-render optional system panels
5. Split display functions from logic functions into separate files

---

## 2. AUGMENTS.JS
**Current Size:** ~750 lines  
**Estimated API RAM Cost:** 95-130 GB  
**Loop Frequency:** Every 60 seconds  

### Main Responsibilities
1. **Augmentation Purchase Logic** - Phase-aware strategy decision
2. **Faction Scanning** - Find available augs across joined factions
3. **Smart Target Selection** - Gap analysis (money + rep) to find closest-to-available aug
4. **Priority-Based Buying** - Buy priority augs, then cascade, then boost queue
5. **Telemetry Reporting** - Every 60 seconds

### Heavy API Imports
```
Singularity: getOwnedAugmentations(4x per loop), getFactionRep(x2),
             getAugmentationsFromFaction(), getAugmentationPrice(),
             getAugmentationRepReq(), getAugmentationPrereq(),
             purchaseAugmentation(), getCurrentWork(), getPlayer()

Stock-accessible: getServerMoneyAvailable() (called 6+ times per loop iteration)
```

### Nested Loop Problems
**In `selectSmartestTargetAug()` (lines 230-302):**
```javascript
for (const faction of player.factions) {              // ~10-15 factions
  const augments = ns.singularity.getAugmentationsFromFaction(faction);  // 16.5 GB per call
  for (const aug of augments) {                       // ~30-50 augs per faction
    const repReq = ns.singularity.getAugmentationRepReq(aug);            // 1.5 GB
    const price = ns.singularity.getAugmentationPrice(aug);              // 1.5 GB
    // = ~5GB per aug × 50 augs × 15 factions = 3,750 GB per call
  }
}
```

**In `getAvailableAugmentsInline()` (lines 167-205):**
- Nearly identical loop structure, duplicated work
- Called by `augmentLoop()` first, then `selectSmartestTargetAug()` again
- Result: **~6,000+ GB of redundant faction/aug queries per loop cycle**

### Transitive Dependencies
- Imports from `reset.js` but doesn't use most functions (only 2 of 5 imported)
- Minimal dependencies = good isolation

### Split Candidates

| Logic | Split Module | Estimated Saving | Complexity |
|---|---|---|---|
| Faction data caching layer | `augment-scanner.js` | 40-60 GB | High |
| Smart targeting algorithm | `augment-selector.js` | 15-20 GB | Low |
| Purchase execution | `augment-buyer.js` | 5-10 GB | Low |
| Phase strategy config | `augment-strategies.js` | Trivial | Low |

### Port-Based Alternative
**Current** (every 60s): Scan all factions → get all augs → find available → select target  
**Proposed** (with port caching):
- `factions.js` publishes AUGMENT_STATE_PORT: {available: [], closestTargets: [], owned: []}
- `augments.js` subscribes instead of scanning
- Reduces loop RAM by 80-85%

### Priority Recommendation: **CRITICAL**
**Suggested Actions:**
1. **Create `augment-scanner.js`** - Centralized faction/aug query cacher
   - Called by `factions.js` during its cycle
   - Publishes to AUGMENT_DATA_PORT
2. **Port-based architecture** - `augments.js` only calls `ns.peek(AUGMENT_DATA_PORT)` + `purchaseAugmentation()`
3. **De-duplicate `getAvailableAugmentsInline()` and `selectSmartestTargetAug()`** → single shared function
4. Extract Purchase logic from strategy into `augment-buyer.js` (reusable for manual commands)

---

## 3. SERVERS.JS
**Current Size:** ~465 lines  
**Estimated API RAM Cost:** 35-50 GB  
**Loop Frequency:** Every 15 seconds  

### Main Responsibilities
1. **Server Purchase Management** - Budget allocation, purchase decisions
2. **Server Upgrade Cascade** - Identify bottlenecks, upgrade oldest/lowest
3. **Home Upgrade Coordination** - RAM and CPU core upgrades
4. **Telemetry & Reporting** - Server stats, rooted/backdoored counts
5. **Network Scanning** - Radial scan for rooted/backdoored server enumeration

### Heavy API Imports
```
Singularity: upgradeHomeRam(), upgradeHomeCores(), getUpgradeHomeRamCost(),
             getUpgradeHomeCoresCost()

Purchase APIs: getPurchasedServers(), getPurchasedServerCost(),
               purchaseServer(), deleteServer(), killall()
               
Network: getPurchasedServerCost() (called in loop), getServerMaxRam(),
         getServerUsedRam(), getServer(), scan() (radial traversal)
         
External: rootAll() from scanner.js, getServerStats() from services/stats.js
```

### Code Analysis
**Home Upgrade Reserve Logic (lines 176-230):**
- Calls `getHomeUpgradeStatus()` which calls 4 singularity methods
- Duplicates phase-lookup from config
- Could be memoized or ported

**Server Telemetry (lines 409-447):**
- Full network radial scan with visited tracking
- Polls root/backdoor status on **every 15-second loop**
- Should be ported from centralized network scanner

### Split Candidates

| Logic | Split Module | Est. Saving | Complexity |
|---|---|---|---|
| Home upgrade logic | `home-upgrades.js` | 5-8 GB | Low |
| Purchase strategy | `server-purchaser.js` | 3-5 GB | Low |
| Network stats polling | Port from `network.js` | 8-12 GB | High |

### Current Port Integration: ✅ Already good
- Uses ports for phase coordination (PHASE_PORT)
- Minimal transitive dependencies

### Priority Recommendation: **MEDIUM**
**Suggested Actions:**
1. Extract `getHomeUpgradeStatus()` to `home-upgrades.js` - reusable by other modules
2. Port network scanner telemetry (root/backdoor counts) from `services/network.js` instead of rescanning
3. Cache purchase strategy per phase in local state (recalc only on phase change)

---

## 4. FORMULAS.JS
**Current Size:** ~120 lines  
**Estimated API RAM Cost:** 8-12 GB  
**Loop Frequency:** Every 10 seconds  

### Main Responsibilities
1. **Formulas.exe Detection** - Check file existence
2. **Passive Farming** - Call `ns.formulas.hacking.hackTime()` on purchased servers
3. **Telemetry Reporting** - Status updates

### API Usage
```
Minimal:
  - ns.fileExists() (cheap, ~0.1GB)
  - ns.getPurchasedServers() (cheap, ~0.4GB)
  - ns.formulas.hacking.hackTime() (medium, ~3-4GB)
  - ns.getPlayer() (cheap, ~0.1GB)
```

### Assessment
**This module is already well-optimized.** Very light API surface, no redundant calls, clean separation.

### Small optimization
- Cache `ns.getPurchasedServers()` length to avoid recalculating if 0 servers
- Skip farming calculation if no servers exist

### Priority Recommendation: **LOW - LEAVE AS-IS**
Only optimization: Minor caching, otherwise this is a good example of efficient module design.

---

## 5. TRAINING.JS
**Current Size:** ~200 lines  
**Estimated API RAM Cost:** 4-6 GB  

### Main Responsibilities
1. **Training Target Selection** - Determine which stat needs training
2. **Training Execution** - Call gym/university functions
3. **Progress Tracking** - Report current vs target stats

### API Usage
```
Very Minimal:
  - ns.getPlayer() (cheap, ~0.1GB)
  - ns.singularity.travelToCity() (medium, ~2GB - optional)
  - ns.singularity.gymWorkout() (medium, ~2GB)
  - ns.singularity.universityCourse() (medium, ~2GB)
```

### Assessment
**Excellent module isolation.** Only queried when needed, not continuously polling. Minimal API surface.

### Observations
- Exported functions (`doTraining()`, `needsTraining()`, `getTrainingProgress()`) are reusable by coordinator
- No code duplication
- Config-driven behavior

### Priority Recommendation: **LOW - EXCELLENT DESIGN**
This module exemplifies good functional design. No changes needed.

---

# Summary Tables

## RAM Savings Potential by Module

| Module | Current Est. | Main Issues | Potential Savings | Priority |
|---|---|---|---|---|
| **dashboard.js** | 180-220 GB | Massive display coordination + duplicated faction logic | 60-85 GB | **CRITICAL** |
| **augments.js** | 95-130 GB | Nested faction/aug loops, duplicate scanning | 50-75 GB | **CRITICAL** |
| **servers.js** | 35-50 GB | Home upgrade calls, network rescanning | 8-15 GB | MEDIUM |
| **formulas.js** | 8-12 GB | N/A (well-optimized) | 0-2 GB | LOW |
| **training.js** | 4-6 GB | N/A (excellent design) | 0 GB | NONE |

**Total Potential Savings: 118-177 GB across these 5 modules alone**

---

## Recommended Implementation Order

### Phase 1: Quick Wins (Address CRITICAL items)
1. **Created augment-scanner.js** - Centralized faction/aug data cache
   - Time: 1-2 hours
   - Savings: 40-50 GB
   - Dependencies: Works with augments.js + factions.js

2. **Port-based augments.js rewrite** - Subscribe to AUGMENT_DATA_PORT
   - Time: 1-2 hours  
   - Savings: 30-40 GB
   - Risk: Low (isolated module)

### Phase 2: Dashboard Refactoring (HIGH complexity, HIGH payoff)
1. **Extract dashboard-factions.js** - Dedup faction logic with factions.js
   - Time: 2-3 hours
   - Savings: 30-40 GB

2. **Extract dashboard-combat.js** - Gang/Bladeburner/Sleeve display
   - Time: 1-2 hours
   - Savings: 20-30 GB

3. **Port-based state subscriptions** - Replace polling with port peeks
   - Time: 2-3 hours
   - Savings: 15-25 GB

### Phase 3: Home Upgrades & Telemetry (MEDIUM complexity)
1. Extract `home-upgrades.js`
   - Time: 30 min
   - Savings: 5-8 GB

2. Cache network telemetry from centralized scanner
   - Time: 1 hour
   - Savings: 8-12 GB

---

## Architecture Recommendations

### Use Port-Based Facades for Large API Groups
Instead of:
```javascript
import { function1, function2, function3 } from "/angel/heavy-module.js";
```

Use:
```javascript
// Publisher writes aggregated state
ns.writePort(STATE_PORT, JSON.stringify({
  faction1: {augs: [...], rep: X, ...},
  faction2: {...},
}));

// Subscriber just reads
const state = ns.peek(STATE_PORT);
```

### Split Display Logic from State Logic
- **dashboard.js** should only handle UI rendering
- **dashboard-factions.js, dashboard-combat.js** handle data aggregation
- **factions.js, gang.js, bladeburner.js** publish aggregated state

### Cache Query Results Where Possible
- Faction/aug data changes only on:
  - Player level up
  - Augmentation purchase
  - Faction membership change (~1-2x per minute max)
- No need to requery every loop cycle

---

## Code Quality Notes

### Well-Designed Modules (No Changes Needed)
✅ **training.js** - Minimal dependencies, good functional separation, config-driven  
✅ **formulas.js** - Lightweight, no redundancy, clean single responsibility  

### Needs Refactoring (Medium Complexity)
⚠️ **servers.js** - Good structure, minor extraction opportunities  

### Needs Major Refactoring (High Priority & Complexity)
🔴 **dashboard.js** - Too many responsibilities, duplicated logic, massive API surface  
🔴 **augments.js** - Nested loops with redundant queries, needs caching layer  

---

## Next Steps
1. Review and validate cost estimates with profiler
2. Start with Phase 1 (augment-scanner + augments port redesign)
3. Add new modules to ANGEL_LITE system as they stabilize
4. Document reusable patterns for future module design
