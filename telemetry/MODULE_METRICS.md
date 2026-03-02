# Module Telemetry Metrics Guide

This document defines the unique metrics each module should report to telemetry for proper dashboard tracking.

## How to Report Metrics

Import and use the `reportModuleMetrics` function in your module:

```javascript
import { reportModuleMetrics } from '/angel/telemetry/telemetry.js';

// Inside your main loop (every 30-60 seconds is sufficient)
reportModuleMetrics(ns, 'moduleName', {
    moneyRate: 1000000,  // $ per second
    xpRate: 500,         // XP per second
    // ... other module-specific metrics
});
```

## Module-Specific Metrics

### 🔧 Core Modules

#### **hacking**
```javascript
{
    moneyRate: number,        // $ earned per second
    xpRate: number,           // XP gained per second
    currentTarget: string,    // Current target server
    targetsPrepped: number,   // Number of servers prepped
    activeThreads: number,    // Total threads deployed
    successfulHacks: number   // Total successful hacks
}
```

#### **servers**
```javascript
{
    serversOwned: number,     // Total purchased servers
    totalRam: number,         // Combined RAM (GB)
    ramUsed: number,          // RAM currently in use
    ramCost: number,          // Total investment in servers
    upgradesPending: number   // Servers queued for upgrade
}
```

#### **programs**
```javascript
{
    programsOwned: number,    // Total programs created
    currentProgram: string,   // Currently creating
    progress: number,         // % complete (0-100)
    timeRemaining: number     // Seconds until complete
}
```

---

### 💰 Income Modules

#### **gang**
```javascript
{
    moneyRate: number,        // $ earned per second
    respect: number,          // Current respect
    respectRate: number,      // Respect per second
    members: number,          // Total gang members
    territory: number,        // Territory owned (0-100)
    wantedLevel: number,      // Current wanted level
    power: number             // Gang power
}
```

#### **stocks**
```javascript
{
    moneyRate: number,        // Average $ per second
    portfolio: number,        // Current portfolio value
    profit: number,           // Total profit/loss
    positions: number,        // Number of active positions
    successRate: number,      // % profitable trades (0-100)
    totalTrades: number       // Lifetime trades
}
```

#### **hacknet**
```javascript
{
    moneyRate: number,        // $ per second production
    nodes: number,            // Total nodes owned
    totalInvestment: number,  // Money spent on nodes
    roi: number,              // Return on investment %
    nextUpgradeCost: number   // Cost of next upgrade
}
```

#### **corporation**
```javascript
{
    moneyRate: number,        // $ per second revenue
    revenue: number,          // Total revenue
    profit: number,           // Net profit
    divisions: number,        // Number of divisions
    cities: number,           // Expanding to cities count
    employees: number,        // Total employees
    investmentRound: number   // Current funding round
}
```

---

### 🎯 Faction/Reputation Modules

#### **bladeburner**
```javascript
{
    rank: number,             // Current rank
    rankRate: number,         // Rank gained per second
    currentAction: string,    // Action being performed
    successRate: number,      // % success rate (0-100)
    stamina: number,          // Current stamina %
    contracts: number,        // Contracts completed
    chaos: number             // City chaos level
}
```

#### **augments**
```javascript
{
    augmentsBought: number,   // Augments purchased this run
    nextAugment: string,      // Next target augment
    reputation: number,       // Reputation needed
    cost: number,             // Money needed
    progress: number,         // % to goal (0-100)
    totalOwned: number        // All augments owned
}
```

#### **activities**
```javascript
{
    currentActivity: string,  // Activity name
    focusTarget: string,      // Faction/Company
    reputation: number,       // Current rep
    repRate: number,          // Rep per second
    duration: number,         // Time spent (ms)
    goal: string              // Objective description
}
```

---

### 🔓 Utility Modules

#### **contracts**
```javascript
{
    moneyRate: number,        // Average $ per contract
    solved: number,           // Total solved
    failed: number,           // Total failed
    successRate: number,      // % success (0-100)
    pending: number,          // Unsolved contracts found
    lastReward: number        // Last contract payout
}
```

#### **backdoor**
```javascript
{
    serversBackdoored: number, // Total backdoored
    pending: number,           // Servers awaiting backdoor
    currentTarget: string,     // Server being backdoored
    progress: number,          // Overall progress %
    factionsUnlocked: number   // Factions unlocked via backdoor
}
```

#### **sleeves**
```javascript
{
    moneyRate: number,        // Combined $ per second
    xpRate: number,           // Combined XP per second
    sleeveCount: number,      // Total sleeves
    activeSleeves: number,    // Sleeves working
    shockRecovery: number,    // Average shock %
    syncRate: number          // Average synchronization %
}
```

---

### 📊 Special Modules

#### **xpFarm**
```javascript
{
    xpRate: number,           // XP per second
    threads: number,          // Active threads
    targetLevel: number,      // Goal hack level
    currentLevel: number,     // Current hack level
    progress: number          // % to goal (0-100)
}
```

#### **networkMap**
```javascript
{
    serversFound: number,     // Total servers discovered
    hackableServers: number,  // Servers within hack level
    rootedServers: number,    // Servers with root access
    backdooredServers: number,// Backdoored count
    mapUpdateTime: number     // Last scan timestamp
}
```

---

## Best Practices

1. **Report Periodically**: Call `reportModuleMetrics()` every 30-60 seconds in your module's main loop
2. **Calculate Rates**: For rate metrics ($/sec), track values over time and calculate deltas
3. **Be Consistent**: Always report the same metric structure for your module
4. **Handle Errors**: Wrap telemetry calls in try-catch to avoid breaking module operation
5. **Keep It Light**: Don't report too frequently (< 10 seconds) to avoid performance impact

## Example Implementation

```javascript
import { reportModuleMetrics } from '/angel/telemetry/telemetry.js';

export async function main(ns) {
    let lastMoney = 0;
    let lastTime = Date.now();
    
    while (true) {
        // ... your module logic ...
        
        // Calculate rates
        const now = Date.now();
        const currentMoney = ns.getServerMoneyAvailable('home');
        const timeDelta = (now - lastTime) / 1000; // seconds
        const moneyRate = timeDelta > 0 ? (currentMoney - lastMoney) / timeDelta : 0;
        
        // Report metrics
        reportModuleMetrics(ns, 'myModule', {
            moneyRate: moneyRate,
            // ... other metrics ...
        });
        
        lastMoney = currentMoney;
        lastTime = now;
        
        await ns.sleep(30000); // 30 second loop
    }
}
```

## Testing Your Metrics

After implementing metric reporting:
1. Run your module
2. Check the dashboard at `http://localhost:5173`
3. Your module should show as "RUNNING" with live metrics
4. Metrics should update every 30-60 seconds

## Troubleshooting

**Module shows OFFLINE**: Module isn't running or script name doesn't match
**Module shows RUNNING but "No telemetry data"**: Module isn't calling `reportModuleMetrics()`
**Old data showing**: Check that metrics are being reported in the main loop
**Rate metrics are zero**: Ensure you're calculating deltas properly over time
