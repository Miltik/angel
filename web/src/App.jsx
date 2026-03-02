import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

const BACKEND_URL = 'http://localhost:3000'

// Status card component
function StatusCard({ title, children, className = '' }) {
  return (
    <div className={`card ${className}`}>
      <div className="card-header">
        <h3>{title}</h3>
      </div>
      <div className="card-content">
        {children}
      </div>
    </div>
  )
}

// Module card component
function ModuleCard({ module }) {
  const statusIcon = module.status === 'active' ? '🟢' 
    : module.status === 'running' ? '🟢'
    : module.status === 'idle' ? '🟡' 
    : '🔴'
  
  // Module has data if it's active (running/idle) OR has generated samples/money
  const hasData = module.isActive || module.aggregate?.samples > 0 || module.current?.moneyRate > 0
  
  const successIcon = module.successRate > 95 ? '✅' 
    : module.successRate > 80 ? '⚠️' 
    : module.successRate > 50 ? '⚡'
    : '❌'
  
  const moneyIcon = module.current?.moneyRate > 1000000 ? '💎'
    : module.current?.moneyRate > 100000 ? '💰'
    : module.current?.moneyRate > 0 ? '📈'
    : '⏸️'

  const isHacking = module.name === 'hacking'
  const details = module.details || {}
  const executionCount = isHacking
    ? (details.successfulHacks ?? module.aggregate?.totalExecutions ?? 0)
    : (module.aggregate?.totalExecutions || 0)

  return (
    <div className={`module-line ${!hasData ? 'inactive' : ''}`}>
      {/* Line 1: Name, Status, Primary Metric */}
      <div className="line-text">
        <span className="line-icon">{statusIcon}</span>
        <span className="module-name">{module.name}</span>
        <span className="line-divider">|</span>
        <span className="status-text">{module.status.toUpperCase()}</span>
        {hasData && (
          <>
            <span className="line-divider">|</span>
            <span className="line-icon">{moneyIcon}</span>
            <span className="metric-label">Money:</span>
            <span className="metric-value">${(module.current?.moneyRate || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}/s</span>
          </>
        )}
        {!hasData && (
          <>
            <span className="line-divider">|</span>
            <span className="no-data-text">No telemetry data</span>
          </>
        )}
      </div>

      {/* Line 2: Success, Executions, Memory - Only if has data */}
      {hasData && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">{successIcon}</span>
          <span className="metric-label">Success:</span>
          <span className="metric-value">{module.successRate.toFixed(1)}%</span>
          <span className="sub-metric">({executionCount} execs)</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🧠</span>
          <span className="metric-label">Memory:</span>
          <span className="metric-value">{(module.current?.memory || 0).toLocaleString(undefined, {maximumFractionDigits: 1})} GB</span>
        </div>
      )}

      {hasData && isHacking && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">🎯</span>
          <span className="metric-label">Target:</span>
          <span className="metric-value">{details.currentTarget || 'none'}</span>
          <span className="line-divider">|</span>
          <span className="metric-label">Phase:</span>
          <span className="metric-value">{details.phase ?? 0}</span>
          <span className="line-divider">|</span>
          <span className="metric-label">Prep:</span>
          <span className="metric-value">{details.prepState || 'unknown'}</span>
          <span className="line-divider">|</span>
          <span className="metric-label">Money%:</span>
          <span className="metric-value">{details.targetMoneyPercent ?? 0}%</span>
          <span className="line-divider">|</span>
          <span className="metric-label">Sec Δ:</span>
          <span className="metric-value">+{details.targetSecurityDelta ?? 0}</span>
        </div>
      )}

      {/* Bar Graph: Success Rate - Only if has data and success < 100% */}
      {hasData && module.successRate < 100 && (
        <div className="bar-line">
          <span className="spacing"></span>
          <span className="bar-label">Success Rate</span>
          <div className="bar-graph">
            <div className="bar-fill" style={{
              width: module.successRate + '%',
              backgroundColor: module.successRate > 95 ? '#0f0' : module.successRate > 80 ? '#fa0' : '#f00'
            }}></div>
          </div>
          <span className="bar-value">{module.successRate.toFixed(1)}%</span>
        </div>
      )}
    </div>
  )
}

// Stat item component
function StatItem({ label, value, unit = '', color = null, icon = null }) {
  return (
    <div className={`stat-item ${color ? `stat-${color}` : ''}`}>
      {icon && <span className="stat-icon">{icon}</span>}
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {typeof value === 'number' ? value.toLocaleString() : value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
    </div>
  )
}

// Progress bar component
function ProgressBar({ value, max, label, color = 'primary' }) {
  const percentage = max > 0 ? (value / max) * 100 : 0
  const clampedPercentage = Math.min(100, percentage)
  
  return (
    <div className="progress-bar-container">
      <div className="progress-label">{label}</div>
      <div className={`progress-bar progress-${color}`}>
        <div 
          className="progress-fill" 
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
      <div className="progress-text">
        {value.toLocaleString()} / {max.toLocaleString()}
      </div>
    </div>
  )
}

function App() {
  const [status, setStatus] = useState(null)
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdateTime, setLastUpdateTime] = useState(null)

  useEffect(() => {
    fetchData(true)

    const intervalId = setInterval(() => {
      fetchData(false)
    }, 5000)

    return () => clearInterval(intervalId)
  }, [])

  const fetchData = async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true)
      }
      const [statusRes, modulesRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/status`),
        axios.get(`${BACKEND_URL}/api/modules`)
      ])
      setStatus(statusRes.data)
      setModules(modulesRes.data.modules || [])
      setLastUpdateTime(new Date())
      setError(null)
    } catch (err) {
      console.error('Backend unreachable:', err)
      setError('Backend not running. Start server with: cd server && npm start')
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  const sendCommand = async (commandType) => {
    try {
      await axios.post(`${BACKEND_URL}/api/commands`, {
        commandType,
        parameters: {}
      })
      await new Promise(resolve => setTimeout(resolve, 500))
      await fetchData(false)
    } catch (err) {
      console.error('Command error:', err)
    }
  }

  const formatTime = (ms) => {
    if (!ms) return '0s'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    
    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const formatMoney = (val) => {
    if (!val) return '$0'
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`
    if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`
    return `$${val.toFixed(0)}`
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>🤖 ANGEL Dashboard</h1>
          <p className="subtitle">Real-time Game Monitoring & Control</p>
        </div>
        <div className="header-status">
          {lastUpdateTime && (
            <span className="update-time">
              Last update: {lastUpdateTime.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      <main className="content">
        {error && (
          <div className="error-box">
            <span className="error-icon">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Connecting to backend...</p>
          </div>
        ) : status ? (
          <>
            <div className="dashboard-grid">
              {/* System Status */}
              <StatusCard title="🖥️ System Status" className="card-system">
              <div className="stats-grid">
                <StatItem 
                  label="Status"
                  value="Active"
                  icon="●"
                  color="success"
                />
                <StatItem 
                  label="Uptime"
                  value={formatTime(status.current?.uptime)}
                  color="info"
                />
                <StatItem 
                  label="Last Update"
                  value={status.lastUpdate ? new Date(status.lastUpdate).toLocaleTimeString() : 'N/A'}
                  color="info"
                />
                <StatItem 
                  label="Pending Commands"
                  value={status.pendingCommands || 0}
                  color={status.pendingCommands > 0 ? 'warning' : 'success'}
                />
              </div>
            </StatusCard>

            {/* Resources */}
            <StatusCard title="💾 Resources" className="card-resources">
              <ProgressBar 
                value={status.current?.memory || 0}
                max={status.metrics?.totalSamples || 100}
                label="Memory Usage"
                color={status.metrics?.avgMemory > 80 ? 'danger' : 'success'}
              />
              <StatItem 
                label="Money Available"
                value={formatMoney(status.current?.money)}
                color="success"
                icon="💰"
              />
              <StatItem 
                label="Total XP Gained"
                value={(status.current?.xpGain || 0).toLocaleString()}
                unit=" exp"
                color="info"
                icon="⚡"
              />
            </StatusCard>

            {/* Performance Metrics */}
            <StatusCard title="📊 Performance" className="card-performance">
              <div className="stats-grid">
                <StatItem 
                  label="Money Rate"
                  value={formatMoney(status.metrics?.avgMoneyRate)}
                  unit="/s"
                  color="success"
                />
                <StatItem 
                  label="XP Rate"
                  value={(status.metrics?.avgXpRate || 0).toFixed(0)}
                  unit="/s"
                  color="info"
                />
                <StatItem 
                  label="Success Rate"
                  value={(status.metrics?.successRate || 0).toFixed(1)}
                  unit="%"
                  color={status.metrics?.successRate > 95 ? 'success' : 'warning'}
                />
                <StatItem 
                  label="Total Samples"
                  value={status.metrics?.totalSamples || 0}
                  color="info"
                />
              </div>
            </StatusCard>

            {/* Hacking Info */}
            <StatusCard title="⚔️ Hacking" className="card-hacking">
              <div className="stats-grid">
                <StatItem 
                  label="Hacking Level"
                  value={status.current?.hackLevel || 0}
                  color="success"
                  icon="🎯"
                />
                <StatItem 
                  label="Skill Progress"
                  value={((status.current?.hackLevel || 0) % 10).toFixed(1)}
                  unit=" / 10"
                  color="info"
                />
                <StatItem 
                  label="Experience"
                  value={(status.current?.xpGain || 0).toLocaleString()}
                  color="info"
                />
              </div>
            </StatusCard>

            {/* Module Statistics */}
            <StatusCard title="🔧 Modules" className="card-modules">
              <div className="module-summary">
                <div className="summary-stat">
                  <span className="summary-label">Total Executions</span>
                  <span className="summary-value">{(status.latestData?.execution_count || 0).toLocaleString()}</span>
                </div>
                <div className="summary-stat">
                  <span className="summary-label">Failures</span>
                  <span className="summary-value warning">{status.latestData?.failure_count || 0}</span>
                </div>
                <div className="summary-stat">
                  <span className="summary-label">Avg Exec Time</span>
                  <span className="summary-value">{(status.latestData?.avg_execution_time || 0).toFixed(0)}ms</span>
                </div>
              </div>
              
              {status.modules && status.modules.length > 0 && (
                <div className="module-list">
                  <h4>Top Modules</h4>
                  {status.modules.slice(0, 5).map((mod, idx) => (
                    <div key={idx} className="module-item">
                      <span className="module-name">{mod.module_name}</span>
                      <span className="module-count">{mod.sample_count} samples</span>
                    </div>
                  ))}
                </div>
              )}
            </StatusCard>

            {/* Controls */}
            <StatusCard title="⚙️ Controls" className="card-controls">
              <div className="button-group">
                <button 
                  className="btn btn-primary"
                  onClick={() => sendCommand('pause')}
                  title="Pause game interactions"
                >
                  ⏸️ Pause
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => sendCommand('resume')}
                  title="Resume game interactions"
                >
                  ▶️ Resume
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => fetchData(false)}
                  title="Manually refresh dashboard"
                >
                  🔄 Refresh
                </button>
                <button 
                  className="btn btn-info"
                  onClick={() => sendCommand('report')}
                  title="Generate detailed report"
                >
                  📊 Report
                </button>
              </div>
            </StatusCard>
          </div>

          {/* Modules Section - Grid Layout */}
          {modules && modules.length > 0 && (
            <div className="modules-section">
              <div className="modules-header">
                <h2>📦 Active Modules ({modules.length})</h2>
                <span className="module-hint">Terminal-style list • All modules visible</span>
              </div>
              <div className="modules-scroll">
                {modules.map((module, idx) => (
                  <ModuleCard key={idx} module={module} />
                ))}
              </div>
            </div>
          )}
          </>
        ) : (
          <div className="no-data">
            <span className="no-data-icon">📭</span>
            <p>No data available</p>
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="footer-content">
          <span>🔗 Backend: {BACKEND_URL}</span>
          <span>📱 Mobile: Use WiFi IP:5173</span>
        </div>
      </footer>
    </div>
  )
}

export default App
