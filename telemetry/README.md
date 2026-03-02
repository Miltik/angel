# Angel Telemetry System

Comprehensive performance monitoring and analytics for Angel orchestrator. Tracks module execution, resource generation, system health, and progression throughout BitNode runs.

## Quick Start

### Enable Telemetry

Add to [config.js](../config.js):
```javascript
telemetry: {
    enabled: true,
    sampleIntervalMs: 60000,        // Sample every 60s
    aggregateIntervalMs: 300000,    // Aggregate every 5min  
    maxHistoryRuns: 3,              // Keep last 3 runs
    detailedLogging: false,         // Verbose event capture
    maxEventsPerRun: 1000,          // Cap event storage
}
```

### Launch Telemetry

```bash
# Background monitoring (automatic with Angel)
run /angel/telemetry/telemetry.js &

# Real-time UI dashboard
run /angel/telemetry/ui.js

# Generate reports
run /angel/telemetry/report.js
```

## Components

### 1. Core Engine (`telemetry.js`)

**Purpose**: Background data collection and storage

**Features**:
- Module execution tracking
- System metric sampling (money, XP, RAM, etc.)
- Event logging
- Milestone recording
- Automatic data aggregation
- Run archival and history management

**RAM**: ~2-3MB
**CPU**: <1% overhead
**Storage**: localStorage only

### 2. Report Generator (`report.js`)

**Purpose**: Comprehensive data analysis and reporting

**Report Types**:

```bash
# Quick summary
run /angel/telemetry/report.js --summary

# Module performance breakdown
run /angel/telemetry/report.js --modules

# Timeline of milestones and events
run /angel/telemetry/report.js --timeline

# Historical comparison
run /angel/telemetry/report.js --history

# Optimization suggestions
run /angel/telemetry/report.js --optimize

# Full report (all sections)
run /angel/telemetry/report.js
```

**Example Output**:
```
╔════════════════════════════════════════════════════════════╗
║         ANGEL TELEMETRY - SUMMARY REPORT                   ║
╚════════════════════════════════════════════════════════════╝

⏱️  Run Duration:     2h 45m 18s
💰 Current Money:    $45.2B (+$185M/min)
💻 Hack Level:       1,245 (+42/min)

📊 Module Activity:
   18 modules active
   3,421 total executions
   23 failures (0.7%)
   245ms avg execution time

🎯 Milestones:       47 achieved
📝 Events Logged:    892

✓ No bottlenecks detected
```

### 3. Real-Time UI (`ui.js`)

**Purpose**: Live monitoring dashboard

**Features**:
- Updates every 2 seconds
- Performance metrics
- Top performing modules
- Bottleneck detection
- Recent milestones
- ASCII money growth chart

**Usage**:
```bash
run /angel/telemetry/ui.js
```

Window stays open and updates automatically. Close anytime without affecting telemetry collection.

## Module Integration

### Minimal Integration (Recommended)

Add to your module:

```javascript
import { recordModuleMetric } from '/angel/telemetry/telemetry.js';

export async function main(ns) {
    const telemetry = recordModuleMetric(ns, 'my-module');
    
    // Your module code here
    
    // Optional: log significant events
    telemetry.log('worker_deployed', { target: 'n00dles', threads: 500 });
    
    // Optional: record milestones
    telemetry.milestone('first_backdoor', { server: 'CSEC' });
    
    // Mark completion (optional)
    telemetry.complete(true); // or false for failure
}
```

**That's it!** Telemetry automatically tracks:
- Module execution count
- Average runtime
- Success/failure rate
- Last run time
- Uptime percentage

### Event Logging

Log significant events for detailed analysis:

```javascript
telemetry.log('target_changed', { from: 'foodnstuff', to: 'joesguns' });
telemetry.log('purchase', { item: 'BruteSSH.exe', cost: 500000 });
telemetry.log('error', { message: 'Failed to root server', server: 'omega-net' });
```

### Milestone Recording

Record important achievements:

```javascript
telemetry.milestone('first_billion', { money: 1000000000, time: Date.now() });
telemetry.milestone('all_augs_purchased', { count: 42 });
telemetry.milestone('bitnode_complete', { bn: 1 });
```

## Data Collection

### What Gets Tracked

**Module Metrics**:
- Execution count and frequency
- Average runtime
- Failure rate
- Last execution time
- Estimated uptime percentage

**System Samples** (every 60s):
- Money available
- Hack level
- Home RAM (max/used)
- Running script count
- Owned augmentations
- Karma level

**Events**:
- Module-specific events (deployments, purchases, errors, etc.)
- Configurable detail level
- Capped at 1000 events per run

**Milestones**:
- Achievement tracking
- Progress markers
- Custom milestones per module

### Storage Strategy

**Current Run**: `localStorage.angelTelemetryCurrentRun`
- Active run data
- Updated continuously
- Full detail

**History**: `localStorage.angelTelemetryHistory`
- Last 3 completed runs (configurable)
- Compressed summaries
- Comparison baseline

**Config**: `localStorage.angelTelemetryConfig`
- User settings
- Persistent across runs

**Auto-Cleanup**:
- Old samples pruned (keeps last 1000)
- Old aggregates pruned (keeps last 100)
- Excess events dropped (FIFO)

## Analytics

### Performance Metrics

**Money Rate**: `$/second` calculated from sample deltas
**XP Rate**: `XP/second` calculated from level changes
**Module Efficiency**: `(actual runs / expected runs) * 100`
**Success Rate**: `(successful runs / total runs) * 100`
**Uptime**: Percentage of time module is active

### Bottleneck Detection

Automatically identifies:
- **High failure rate**: >10% failures with >5 executions
- **RAM starvation**: >95% average RAM usage
- **Low uptime**: <50% expected activity
- **Long execution times**: Modules blocking others

### Optimization Suggestions

Analyzes patterns and suggests:
- Interval adjustments for high-frequency modules
- Priority increases for starved modules
- Thread allocation optimizations
- Config tuning recommendations

## Reports

### Summary Report

High-level overview:
- Run duration and current state
- Money/XP rates
- Module activity stats
- Milestone count
- Bottleneck summary

### Module Report

Detailed module breakdown:
- Top performers table
- Execution counts
- Average runtimes
- Success rates
- Modules needing attention

### Timeline Report

Chronological analysis:
- Milestone timeline with timestamps
- Growth curves (money/XP over time)
- Recent significant events
- Progress markers

### History Report

Multi-run comparison:
- Previous run summaries
- Historical averages
- Current vs. historical performance
- Trend analysis

### Optimization Report

Actionable insights:
- Detected bottlenecks with severity
- Specific suggestions per module
- Impact estimates (high/medium/low)
- Config adjustment recommendations

## Configuration

### Enable/Disable

```javascript
telemetry: {
    enabled: true, // Set to false to disable all telemetry
}
```

**Note**: Disabling telemetry has zero performance impact as all tracking functions fail silently.

### Sampling Frequency

```javascript
telemetry: {
    sampleIntervalMs: 60000,  // How often to capture system state
    aggregateIntervalMs: 300000, // How often to compute aggregates
}
```

**Recommendation**:
- `sampleIntervalMs`: 30-120 seconds (lower = more detail, higher storage)
- `aggregateIntervalMs`: 300-600 seconds (5-10 minutes)

### History Retention

```javascript
telemetry: {
    maxHistoryRuns: 3, // Keep last N completed runs
}
```

Each run is ~1-5MB depending on length. Adjust based on available localStorage space.

### Event Logging

```javascript
telemetry: {
    detailedLogging: false, // Set true for verbose event capture
    maxEventsPerRun: 1000,  // Cap to prevent storage bloat
}
```

**Note**: Events are optional. Core metrics are always captured.

## Performance Impact

### Overhead

- **RAM**: ~2-3MB for data storage
- **CPU**: <1% (lightweight sampling)
- **Execution Time**: <1ms per module call
- **Network**: Zero (no external calls)
- **Disk**: Zero (localStorage only)

### Safety

- **Non-blocking**: All telemetry calls wrapped in try/catch
- **Silent failures**: Never interrupts module operation
- **Async-safe**: No races or deadlocks
- **Memory-safe**: Automatic pruning prevents bloat

## Integration with Angel

### Automatic Launch

Add to [angel.js](../angel.js):

```javascript
// Launch telemetry monitoring
if (config.telemetry?.enabled) {
    const telemetryPid = launchModule(ns, SCRIPTS.telemetry);
    ns.print('✓ Telemetry monitoring started');
}
```

### Dashboard Integration

Telemetry can be displayed in the main dashboard via `ui.js` or as a compact status line.

### Config Registry

Add to [config.js](../config.js) SCRIPTS:

```javascript
SCRIPTS: {
    // ... other scripts ...
    telemetry: "/angel/telemetry/telemetry.js",
}
```

## Use Cases

### 1. Module Performance Tuning

**Problem**: Module runs too frequently/infrequently
**Solution**: Check `--modules` report, adjust interval in config

### 2. Bottleneck Identification

**Problem**: System feels slow
**Solution**: Check `--optimize` report for specific bottlenecks

### 3. Progression Analysis

**Problem**: Want to know when milestones were hit
**Solution**: Check `--timeline` report for chronological history

### 4. Historical Comparison

**Problem**: Was last run faster than this run?
**Solution**: Check `--history` report for multi-run comparison

### 5. Config Validation

**Problem**: Did config change improve performance?
**Solution**: Compare stats before/after using history report

## Troubleshooting

### No data available

**Cause**: Telemetry not running or just started
**Solution**: Run `/angel/telemetry/telemetry.js` in background

### Missing module data

**Cause**: Module hasn't integrated telemetry yet
**Solution**: Add `recordModuleMetric()` call to module

### Storage limit exceeded

**Cause**: localStorage full
**Solution**: Reduce `maxHistoryRuns` or `maxEventsPerRun`

### UI not updating

**Cause**: Telemetry engine stopped
**Solution**: Restart `/angel/telemetry/telemetry.js`

### High RAM usage

**Cause**: Too many samples/events in memory
**Solution**: Increase `sampleIntervalMs` or decrease event logging

## Future Enhancements

Potential additions:
- Export reports to files
- Graphical charts (if game supports)
- Real-time alerting on bottlenecks
- Automated config tuning
- Machine learning for optimization
- Multi-BitNode comparison
- Slack/Discord notifications

## Examples

### Basic Module Integration

```javascript
// modules/example.js
import { recordModuleMetric } from '/angel/telemetry/telemetry.js';

export async function main(ns) {
    const telemetry = recordModuleMetric(ns, 'example');
    
    while (true) {
        try {
            // Do work
            await doSomething(ns);
            telemetry.log('work_completed', { units: 100 });
            
        } catch (e) {
            telemetry.log('error', { message: e.message });
        }
        
        await ns.sleep(10000);
    }
}
```

### Milestone Tracking

```javascript
// Track important achievements
if (money >= 1e9) {
    telemetry.milestone('first_billion', {
        money: money,
        duration: formatDuration(Date.now() - runStart),
    });
}

if (backdoorsComplete === 10) {
    telemetry.milestone('ten_backdoors', {
        count: backdoorsComplete,
        servers: backdooredServers,
    });
}
```

### Event Logging

```javascript
// Log significant events
telemetry.log('purchase', {
    item: 'SQLInject.exe',
    cost: 30000000,
    money_remaining: ns.getServerMoneyAvailable('home'),
});

telemetry.log('target_switch', {
    from: currentTarget,
    to: newTarget,
    reason: 'better_profit',
});

telemetry.log('worker_deployment', {
    target: target,
    hack_threads: hackThreads,
    grow_threads: growThreads,
    weaken_threads: weakenThreads,
});
```

## Best Practices

1. **Integrate minimally**: Just add `recordModuleMetric()` call
2. **Log selectively**: Only log significant events
3. **Milestone wisely**: Track achievements, not minutiae
4. **Check reports regularly**: Use insights to tune config
5. **Archive important runs**: Copy report output before reset
6. **Adjust retention**: Balance detail vs. storage
7. **Monitor overhead**: Check telemetry isn't impacting performance

## See Also

- [config.js](../config.js) - Main configuration file
- [angel.js](../angel.js) - Orchestrator integration
- [modules/dashboard.js](../modules/dashboard.js) - Main dashboard
- [README.md](../README.md) - Angel documentation
