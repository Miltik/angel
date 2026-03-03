import React, { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

const BACKEND_URL = 'http://localhost:3000'

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-box" style={{ margin: '20px', padding: '20px' }}>
          <span className="error-icon">⚠️</span>
          <div>
            <strong>Frontend Error:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
              {this.state.error?.toString()}
            </pre>
            <button onClick={() => window.location.reload()}>Reload Page</button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

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
function ModuleCard({ module, onToggle, formatCompactMoney, moduleDetailsMap }) {
  const statusIcon = module.status === 'active' ? '🟢' 
    : module.status === 'running' ? '🟢'
    : module.status === 'idle' ? '🟡' 
    : '🔴'
  
  // Module has data if it's active (running/idle) OR has generated samples
  const hasData = module.isActive || module.aggregate?.samples > 0

  const incomePerSecond = module.income?.perSecond || 0
  const incomeSessionTotal = module.income?.sessionTotal || 0
  const showIncome = Boolean(module.income?.show && (incomePerSecond > 0 || incomeSessionTotal > 0))

  const moneyIcon = incomePerSecond > 1000000 ? '💎'
    : incomePerSecond > 100000 ? '💰'
    : incomePerSecond > 0 ? '📈'
    : '⏸️'

  const moduleName = String(module.name || '').toLowerCase()
  const isHacking = moduleName === 'hacking'
  const isHacknet = moduleName === 'hacknet'
  const isGang = moduleName === 'gang'
  const isStocks = moduleName === 'stocks'
  const isCorporation = moduleName === 'corporation'
  const isBladeburner = moduleName === 'bladeburner'
  const isSleeves = moduleName === 'sleeves'
  const isXpFarm = moduleName === 'xpfarm'
  const isLoot = moduleName === 'loot'
  const isCrime = moduleName === 'crime'
  const isServers = moduleName === 'servers'
  const isActivities = moduleName === 'activities'
  const isPhase = moduleName === 'phase'
  const isFormulas = moduleName === 'formulas'
  const incomeDisplayValue = isStocks ? incomePerSecond * 3600 : incomePerSecond
  const incomeDisplayUnit = isStocks ? '/h' : '/s'
  const details = module.details || {}
  const activitiesDetails = moduleDetailsMap?.activities || {}
  const legacyActivityParts = String(details.currentActivity || '').split('-')
  const legacyActivityType = String(legacyActivityParts[0] || 'idle').toLowerCase()
  const legacyActivityTarget = legacyActivityParts.slice(1).join('-')
  const activityPhase = Number.isFinite(Number(details.phase)) ? Number(details.phase) : null
  const activityPlan = details.plannedActivity || (legacyActivityType !== 'idle' ? legacyActivityType : 'none')
  const activityLiveType = details.liveWorkType || legacyActivityType || 'idle'
  const activityTarget = details.liveTarget || legacyActivityTarget || 'none'
  const activityFaction = details.factionFocus || (activityLiveType === 'faction' ? activityTarget : 'none')
  const activityCrime = details.bestCrime || 'n/a'
  const activityCrimeChance = details.bestCrimeChance === null || details.bestCrimeChance === undefined
    ? null
    : Number(details.bestCrimeChance)
  const activityCombatGap = Number.isFinite(Number(details.combatGap)) ? Number(details.combatGap) : null
  const activityHackingGap = Number.isFinite(Number(details.hackingGap)) ? Number(details.hackingGap) : null

  const getCurrentUsage = () => {
    if (isHacking) return `${details.activeThreads ?? 0} threads`
    if (isHacknet) return `${details.nodes ?? 0} nodes`
    if (isGang) return `${details.members ?? 0} members`
    if (isStocks) return `${details.totalShares ?? 0} shares`
    if (isCorporation) return `${details.employees ?? 0} employees`
    if (isSleeves) return `${details.working ?? 0}/${details.sleeves ?? 0} working`
    if (isXpFarm) return `${details.threads ?? 0} threads`
    if (isServers) return `${details.servers ?? 0} servers`
    if (isActivities) return details.currentActivity || 'idle'
    if (isLoot) return `${details.loopsRun ?? 0} loops`
    if (isCrime) return details.mode ? `mode:${details.mode}` : 'idle'
    if (isPhase) return `Phase ${details.phase ?? 0} of 4`
    if (isFormulas) return details.farmingActive ? 'Farming active' : 'Waiting for Formulas.exe'
    return module.status || 'offline'
  }

  return (
    <div className={`module-line ${!hasData ? 'inactive' : ''}`}>
      {/* Line 1: Name, Status, Primary Metric */}
      <div className="line-text">
        <span className="line-icon">{statusIcon}</span>
        <span className="module-name">{module.name}</span>
        <span className="line-divider">|</span>
        <span className="status-text">{module.status.toUpperCase()}</span>
        <span className="line-divider">|</span>
        <button
          className={`btn-inline module-toggle-inline ${module.isActive ? 'active' : 'inactive'}`}
          onClick={() => onToggle(module)}
          title={module.isActive ? `Stop ${module.name}` : `Start ${module.name}`}
        >
          {module.isActive ? '⏹ Off' : '▶ On'}
        </button>
        {hasData && showIncome && (
          <>
            <span className="line-divider">|</span>
            <span className="line-icon">{moneyIcon}</span>
            <span className="metric-label">Money:</span>
            <span className="metric-value">${incomeDisplayValue.toLocaleString(undefined, {maximumFractionDigits: 0})}{incomeDisplayUnit}</span>
            <span className="line-divider">|</span>
            <span className="metric-label">Session:</span>
            <span className="metric-value">{formatCompactMoney(incomeSessionTotal)}</span>
          </>
        )}
        {!hasData && (
          <>
            <span className="line-divider">|</span>
            <span className="no-data-text">No telemetry data</span>
          </>
        )}
      </div>

      {/* Line 2: Current usage - Only if has data */}
      {hasData && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">📌</span>
          <span className="metric-label">Using:</span>
          <span className="metric-value">{getCurrentUsage()}</span>
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

      {hasData && isHacking && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">💰</span>
          <span className="metric-label">Money:</span>
          <span className="metric-value">{formatCompactMoney(details.targetMoneyCurrent)}/{formatCompactMoney(details.targetMoneyMax)}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🔒</span>
          <span className="metric-label">Security:</span>
          <span className="metric-value">{Number(details.targetSecurityCurrent || 0).toFixed(2)}/{Number(details.targetSecurityMin || 0).toFixed(2)}</span>
        </div>
      )}

      {hasData && isHacknet && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">🖥️</span>
          <span className="metric-label">Nodes:</span>
          <span className="metric-value">{details.nodes || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">💾</span>
          <span className="metric-label">RAM:</span>
          <span className="metric-value">{(details.totalRam || 0)}GB</span>
          <span className="line-divider">|</span>
          <span className="line-icon">⚙️</span>
          <span className="metric-label">Cores:</span>
          <span className="metric-value">{details.totalCores || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">📊</span>
          <span className="metric-label">Avg L:</span>
          <span className="metric-value">{details.avgLevel || 0}</span>
        </div>
      )}

      {hasData && isHacknet && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">💸</span>
          <span className="metric-label">Invested:</span>
          <span className="metric-value">{formatCompactMoney(details.totalInvestment)}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">📈</span>
          <span className="metric-label">Upgraded:</span>
          <span className="metric-value">{details.upgradesCompleted || 0}x</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🏦</span>
          <span className="metric-label">Budget:</span>
          <span className="metric-value">{formatCompactMoney(details.budget)}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🔐</span>
          <span className="metric-label">Reserve:</span>
          <span className="metric-value">{formatCompactMoney(details.reserve)}</span>
        </div>
      )}

      {hasData && isGang && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">👾</span>
          <span className="metric-label">Members:</span>
          <span className="metric-value">{details.members || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🗺️</span>
          <span className="metric-label">Territory:</span>
          <span className="metric-value">{((details.territory || 0) * 100).toFixed(1)}%</span>
          <span className="line-divider">|</span>
          <span className="line-icon">✨</span>
          <span className="metric-label">Respect:</span>
          <span className="metric-value">{formatCompactMoney(details.respect)}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">⚔️</span>
          <span className="metric-label">Power:</span>
          <span className="metric-value">{((details.power || 0) / 1).toFixed(1)}</span>
        </div>
      )}

      {hasData && isStocks && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">📈</span>
          <span className="metric-label">Portfolio:</span>
          <span className="metric-value">{formatCompactMoney(details.portfolioValue)}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">📊</span>
          <span className="metric-label">Stocks:</span>
          <span className="metric-value">{details.stocks || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">📉</span>
          <span className="metric-label">Shares:</span>
          <span className="metric-value">{details.totalShares || 0}</span>
        </div>
      )}

      {hasData && isCorporation && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">💰</span>
          <span className="metric-label">Funds:</span>
          <span className="metric-value">{formatCompactMoney(details.funds)}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">📊</span>
          <span className="metric-label">Revenue:</span>
          <span className="metric-value">{formatCompactMoney(details.revenue)}/s</span>
          <span className="line-divider">|</span>
          <span className="line-icon">👥</span>
          <span className="metric-label">Employees:</span>
          <span className="metric-value">{details.employees || 0}</span>
        </div>
      )}

      {hasData && isBladeburner && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">⚔️</span>
          <span className="metric-label">Rank:</span>
          <span className="metric-value">{((details.rank || 0) / 1).toFixed(1)}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🔋</span>
          <span className="metric-label">Stamina:</span>
          <span className="metric-value">{((details.stamina || 0) / (details.maxStamina || 1) * 100).toFixed(0)}%</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🏙️</span>
          <span className="metric-label">City:</span>
          <span className="metric-value">{(details.city || 'N/A').substring(0, 8)}</span>
        </div>
      )}

      {hasData && isSleeves && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">👨‍👨‍👧‍👦</span>
          <span className="metric-label">Sleeves:</span>
          <span className="metric-value">{details.sleeves || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">📚</span>
          <span className="metric-label">Trained:</span>
          <span className="metric-value">{details.trained || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🔄</span>
          <span className="metric-label">Working:</span>
          <span className="metric-value">{details.working || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">💤</span>
          <span className="metric-label">Recovering:</span>
          <span className="metric-value">{details.recovering || 0}</span>
        </div>
      )}

      {hasData && isXpFarm && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">🎯</span>
          <span className="metric-label">Target:</span>
          <span className="metric-value">{(details.target || 'N/A').substring(0, 12)}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">⚡</span>
          <span className="metric-label">Threads:</span>
          <span className="metric-value">{details.threads || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🖥️</span>
          <span className="metric-label">Servers:</span>
          <span className="metric-value">{details.servers || 0}</span>
        </div>
      )}

      {hasData && isLoot && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">📚</span>
          <span className="metric-label">Archived:</span>
          <span className="metric-value">{details.filesArchived || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🔄</span>
          <span className="metric-label">Loops:</span>
          <span className="metric-value">{details.loopsRun || 0}</span>
        </div>
      )}

      {hasData && isCrime && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">🔪</span>
          <span className="metric-label">Mode:</span>
          <span className="metric-value">{String(details.mode || 'none')}</span>
          <span className="line-divider">|</span>
          <span className="metric-label">Crime:</span>
          <span className="metric-value">{String(details.currentCrime || 'none').substring(0, 14)}</span>
          <span className="line-divider">|</span>
          <span className="metric-label">Chance:</span>
          <span className="metric-value">{`${((Number(details.successChance || 0)) * 100).toFixed(0)}%`}</span>
          <span className="line-divider">|</span>
          <span className="metric-label">Duration:</span>
          <span className="metric-value">{`${Math.round((Number(details.durationMs || 0)) / 1000)}s`}</span>
        </div>
      )}

      {hasData && isServers && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">🖥️</span>
          <span className="metric-label">Owned:</span>
          <span className="metric-value">{details.servers || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">💾</span>
          <span className="metric-label">Total RAM:</span>
          <span className="metric-value">{((details.totalRam || 0) / 1).toFixed(0)}GB</span>
          <span className="line-divider">|</span>
          <span className="line-icon">📊</span>
          <span className="metric-label">Max:</span>
          <span className="metric-value">{details.maxServers || 0}</span>
        </div>
      )}

      {hasData && isActivities && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">🎯</span>
          <span className="metric-label">Phase:</span>
          <span className="metric-value">{activityPhase !== null ? `P${activityPhase}` : 'P?'}</span>
          <span className="line-divider">|</span>
          <span className="metric-label">Plan:</span>
          <span className="metric-value">{String(activityPlan).substring(0, 10)}</span>
          <span className="line-divider">|</span>
          <span className="metric-label">Live:</span>
          <span className="metric-value">{String(activityLiveType).substring(0, 10)}</span>
          <span className="line-divider">|</span>
          <span className="metric-label">Target:</span>
          <span className="metric-value">{String(activityTarget).substring(0, 12)}</span>
        </div>
      )}

      {hasData && isActivities && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">🤝</span>
          <span className="metric-label">Faction:</span>
          <span className="metric-value">{String(activityFaction).substring(0, 10)}</span>
          <span className="line-divider">|</span>
          <span className="metric-label">Rep Need:</span>
          <span className="metric-value">{details.factionRepNeeded === null || details.factionRepNeeded === undefined ? '?' : Number(details.factionRepNeeded).toLocaleString()}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🔪</span>
          <span className="metric-label">Best Crime:</span>
          <span className="metric-value">{String(activityCrime).substring(0, 10)} {activityCrimeChance === null ? '?' : `${(activityCrimeChance * 100).toFixed(0)}%`}</span>
          <span className="line-divider">|</span>
          <span className="metric-label">Train Gap:</span>
          <span className="metric-value">C{activityCombatGap ?? '-'}/H{activityHackingGap ?? '-'}</span>
        </div>
      )}

      {hasData && moduleName === 'contracts' && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">✅</span>
          <span className="metric-label">Solved:</span>
          <span className="metric-value">{details.contractsSolved || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">💰</span>
          <span className="metric-label">Total Rewards:</span>
          <span className="metric-value">{formatCompactMoney(details.totalRewards)}</span>
        </div>
      )}

      {hasData && moduleName === 'programs' && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">💾</span>
          <span className="metric-label">Programs:</span>
          <span className="metric-value">{details.programsOwned || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🔓</span>
          <span className="metric-label">TOR:</span>
          <span className="metric-value">{details.hasTor ? '✅' : '⏳'}</span>
        </div>
      )}

      {hasData && moduleName === 'augments' && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">💉</span>
          <span className="metric-label">Installed:</span>
          <span className="metric-value">{details.installed || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">📋</span>
          <span className="metric-label">Queued:</span>
          <span className="metric-value">{details.queued || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">📚</span>
          <span className="metric-label">Available:</span>
          <span className="metric-value">{details.available || 0}</span>
        </div>
      )}

      {hasData && moduleName === 'augments' && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">🎯</span>
          <span className="metric-label">Target:</span>
          <span className="metric-value">{String(details?.resetCountdown?.targetAugName || 'Unknown').substring(0, 18)}</span>
          <span className="line-divider">|</span>
          <span className="metric-label">Faction:</span>
          <span className="metric-value">{String(details?.resetCountdown?.targetAugFaction || 'Unknown').substring(0, 12)}</span>
          <span className="line-divider">|</span>
          <span className="metric-label">Need:</span>
          <span className="metric-value">💰 {formatCompactMoney(Number(details?.resetCountdown?.moneyNeeded || 0))} | ⭐ {Number(details?.resetCountdown?.repNeeded || 0).toLocaleString()}</span>
          <span className="line-divider">|</span>
          <span className="metric-label">Sync:</span>
          <span className="metric-value">
            {String(activitiesDetails?.factionFocus || 'none').toLowerCase() === String(details?.resetCountdown?.targetAugFaction || '').toLowerCase()
              ? '✅'
              : `⚠ ${String(activitiesDetails?.factionFocus || 'none').substring(0, 10)}`}
          </span>
        </div>
      )}

      {hasData && moduleName === 'backdoorrunner' && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">🔓</span>
          <span className="metric-label">Installed:</span>
          <span className="metric-value">{details.installed || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🎯</span>
          <span className="metric-label">Attempted:</span>
          <span className="metric-value">{details.attempted || 0}</span>
        </div>
      )}

      {hasData && isPhase && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">📊</span>
          <span className="metric-label">Phase:</span>
          <span className="metric-value">{details.phase ?? 0} / 4</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🔧</span>
          <span className="metric-label">Hack:</span>
          <span className="metric-value">{details.hackLevel || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">💰</span>
          <span className="metric-label">Money:</span>
          <span className="metric-value">{formatCompactMoney(details.money)}</span>
        </div>
      )}

      {hasData && isFormulas && (
        <div className="line-text sub-text">
          <span className="spacing"></span>
          <span className="line-icon">📐</span>
          <span className="metric-label">Status:</span>
          <span className="metric-value">{details.farmingActive ? '✅ Farming' : '⏳ Waiting'}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🔄</span>
          <span className="metric-label">Hashes:</span>
          <span className="metric-value">{details.sessionHashes || 0}</span>
          <span className="line-divider">|</span>
          <span className="line-icon">🎯</span>
          <span className="metric-label">Formulas:</span>
          <span className="metric-value">{details.hasFormulas ? '✅ Found' : '⏳ Searching'}</span>
        </div>
      )}

      {/* Success/exec/memory strip intentionally removed */}
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
  const [controlLoading, setControlLoading] = useState(null)

  useEffect(() => {
    fetchData(true)

    const intervalId = setInterval(() => {
      fetchData(false)
    }, 2000) // Poll every 2 seconds for near real-time updates

    return () => clearInterval(intervalId)
  }, [])

  const fetchData = async (showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true)
      }
      console.log('Fetching data from backend...')
      const [statusRes, modulesRes] = await Promise.all([
        axios.get(`${BACKEND_URL}/api/status`),
        axios.get(`${BACKEND_URL}/api/modules`)
      ])
      console.log('Status:', statusRes.data)
      console.log('Modules:', modulesRes.data)
      
      const modulesData = Array.isArray(modulesRes.data?.modules) ? modulesRes.data.modules : []
      console.log('Setting modules:', modulesData)
      
      setStatus(statusRes.data || {})
      setModules(modulesData)
      setLastUpdateTime(new Date())
      setError(null)
    } catch (err) {
      console.error('Backend error:', err.message, err.response?.data || err)
      setError('Backend not running. Start server with: cd server && npm start')
    } finally {
      if (showLoading) {
        setLoading(false)
      }
    }
  }

  const formatCompactMoney = (val) => {
    if (!val) return '$0'
    if (val >= 1e12) return `$${(val / 1e12).toFixed(2)}t`
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}b`
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}m`
    if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}k`
    return `$${Number(val).toFixed(0)}`
  }

  const sendCommand = async (commandType, parameters = {}) => {
    try {
      await axios.post(`${BACKEND_URL}/api/commands`, {
        commandType,
        parameters
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

  const formatAbbreviated = (value, { money = false, perSecond = false } = {}) => {
    const num = Number(value || 0)
    const abs = Math.abs(num)
    let suffix = ''
    let scaled = num

    if (abs >= 1e15) {
      scaled = num / 1e15
      suffix = 'p'
    } else if (abs >= 1e12) {
      scaled = num / 1e12
      suffix = 't'
    } else if (abs >= 1e9) {
      scaled = num / 1e9
      suffix = 'b'
    } else if (abs >= 1e6) {
      scaled = num / 1e6
      suffix = 'm'
    } else if (abs >= 1e3) {
      scaled = num / 1e3
      suffix = 'k'
    }

    const precision = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2
    const prefix = money ? '$' : ''
    const unit = perSecond ? '/s' : ''
    return `${prefix}${scaled.toFixed(precision)}${suffix}${unit}`
  }

  const handleModuleToggle = async (module) => {
    const commandType = module.isActive ? 'stopModule' : 'runModule'
    await sendCommand(commandType, { module: module.name })
  }

  const handleRestartBackend = async () => {
    if (!window.confirm('⚠️ Restart backend? Dashboard will briefly disconnect.')) return
    setControlLoading('backend-restart')
    try {
      await axios.post(`${BACKEND_URL}/api/admin/restart`)
      await new Promise(resolve => setTimeout(resolve, 2000))
      await fetchData(true)
    } catch (err) {
      console.error('Backend restart failed:', err)
      alert('Backend restart initiated. Please wait 5 seconds for reconnect.')
    } finally {
      setControlLoading(null)
    }
  }

  const handleStopBackend = async () => {
    if (!window.confirm('⚠️ STOP BACKEND? This will disconnect the dashboard.')) return
    setControlLoading('backend-stop')
    try {
      await axios.post(`${BACKEND_URL}/api/admin/stop`)
      alert('Backend stopped. Restart with: cd server && npm start')
    } catch (err) {
      console.error('Backend stop error:', err)
    } finally {
      setControlLoading(null)
    }
  }

  const handleStartBackend = () => {
    alert('ℹ️ Backend is waiting to restart.\n\nIn terminal, run:\ncd server && npm start')
  }

  const handleStartAngel = async () => {
    if (!window.confirm('🎮 Send START command to Angel?')) return
    await sendCommand('startAngel')
  }

  const handleStopAngel = async () => {
    if (!window.confirm('⚠️ Send STOP command to Angel?')) return
    await sendCommand('stopAngel')
  }

  const handleRestartFrontend = () => {
    if (!window.confirm('🔄 Reload frontend? Current data will be lost.')) return
    window.location.reload()
  }

  const handleRestartAngel = async () => {
    if (!window.confirm('🎮 Send restart command to Angel orchestrator?')) return
    await sendCommand('restartAngel')
  }

  const modulesArray = Array.isArray(modules) ? modules : []
  const moduleDetailsMap = modulesArray.reduce((acc, module) => {
    acc[String(module?.name || '').toLowerCase()] = module?.details || {}
    return acc
  }, {})
  const totalIncomeRate = modulesArray.reduce((sum, module) => sum + Number(module?.income?.perSecond || 0), 0)
  const memoryUsed = Number(status?.current?.memory || 0)
  const memoryTotal = Number(status?.overview?.angelLite?.currentRam || 0)
  const memoryPercent = memoryTotal > 0
    ? Math.max(0, Math.min(100, (memoryUsed / memoryTotal) * 100))
    : 0
  const phaseCurrent = Number.isFinite(Number(status?.overview?.phase?.current))
    ? Number(status.overview.phase.current)
    : null
  const phasePercent = Number.isFinite(Number(status?.overview?.phase?.percent))
    ? Number(status.overview.phase.percent)
    : 0
  const angelLitePercent = Number.isFinite(Number(status?.overview?.angelLite?.percent))
    ? Number(status.overview.angelLite.percent)
    : 0
  const resetSinceMs = Number(status?.overview?.reset?.timeSinceResetMs || status?.current?.uptime || 0)
  const resetAugs = status?.overview?.reset?.installedAtReset
  const augmentsModule = modulesArray.find(m => String(m?.name || '').toLowerCase() === 'augments')
  const augmentsDetails = augmentsModule?.details || {}
  const resetCountdown = augmentsDetails?.resetCountdown || {}
  const targetAugName = resetCountdown?.targetAugName || 'Unknown'
  const targetAugFaction = resetCountdown?.targetAugFaction || 'Unknown'
  const liveTargetCost = Number(resetCountdown?.targetAugCost || 0)
  const liveRepNeeded = Number(resetCountdown?.repNeeded || 0)
  const displayCost = status?.overview?.reset?.lastResetTotalAugCost || liveTargetCost || 0
  const displayRep = status?.overview?.reset?.lastResetTotalAugRep || liveRepNeeded || 0
  const hasLiveTarget = Boolean(resetCountdown && Object.keys(resetCountdown).length > 0)
  const modulesForControls = [...modulesArray].sort((a, b) => (a.name || '').localeCompare(b.name || ''))

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
            <div className="overview-layout">
              <section className="overview-main-panel">
                <div className="overview-stats-grid">
                  <div className="overview-stat">
                    <span className="overview-label">Status</span>
                    <span className="overview-value">Active</span>
                  </div>
                  <div className="overview-stat">
                    <span className="overview-label">Uptime</span>
                    <span className="overview-value">{formatTime(status.current?.uptime)}</span>
                  </div>
                  <div className="overview-stat">
                    <span className="overview-label">Last Update</span>
                    <span className="overview-value">{status.lastUpdate ? new Date(status.lastUpdate).toLocaleTimeString() : 'N/A'}</span>
                  </div>
                  <div className="overview-stat">
                    <span className="overview-label">Hacking Level</span>
                    <span className="overview-value">{(status.current?.hackLevel || 0).toLocaleString()}</span>
                  </div>
                </div>

                <div className="memory-block">
                  <div className="memory-header-row">
                    <span className="overview-label">Memory Usage</span>
                    <span className="overview-value">{memoryUsed.toFixed(0)} / {memoryTotal > 0 ? memoryTotal.toFixed(0) : '?'} GB</span>
                  </div>
                  <div className="memory-track">
                    <div className={`memory-fill ${memoryPercent >= 90 ? 'danger' : memoryPercent >= 75 ? 'warning' : 'safe'}`} style={{ width: `${memoryPercent}%` }} />
                  </div>
                </div>

                <div className="overview-stats-grid">
                  <div className="overview-stat">
                    <span className="overview-label">Money Available</span>
                    <span className="overview-value">{formatMoney(Number(status.current?.money || 0))}</span>
                  </div>
                  <div className="overview-stat">
                    <span className="overview-label">Money Rate</span>
                    <span className="overview-value">{formatAbbreviated(totalIncomeRate, { money: true, perSecond: true })}</span>
                  </div>
                  <div className="overview-stat">
                    <span className="overview-label">XP Rate</span>
                    <span className="overview-value">{formatAbbreviated(status.metrics?.avgXpRate || 0, { perSecond: true })}</span>
                  </div>
                </div>

                <div className="tracker-grid">
                  <div className="tracker-card reset-tracker-single">
                    <div className="reset-tracker-content">
                      <span className="reset-icon">🔄</span>
                      <span className="reset-label">Current Run:</span>
                      <span className="reset-run">{formatTime(resetSinceMs)}</span>
                      <span className="reset-separator">|</span>
                      <span className="reset-label">Last Run:</span>
                      <span className="reset-run">{status?.overview?.reset?.timeSinceLastResetMs ? formatTime(status.overview.reset.timeSinceLastResetMs) : '?'}</span>
                      <span className="reset-separator">|</span>
                      <span className="reset-label">Last Money:</span>
                      <span className="reset-run">{status?.overview?.reset?.lastResetMoney ? formatCompactMoney(status.overview.reset.lastResetMoney) : '?'}</span>
                      <span className="reset-separator">|</span>
                      <span className="reset-label">Hack Level:</span>
                      <span className="reset-run">{status?.overview?.reset?.lastResetHackLevel ? Number(status.overview.reset.lastResetHackLevel).toLocaleString() : '?'}</span>
                      <span className="reset-separator">|</span>
                      <span className="reset-label">Augs:</span>
                      <span className="reset-run">{resetAugs === null || resetAugs === undefined ? '?' : Number(resetAugs)}</span>
                      <span className="reset-separator">|</span>
                      {hasLiveTarget && (
                        <>
                          <span className="reset-label">Target:</span>
                          <span className="reset-run">{targetAugName} ({targetAugFaction})</span>
                          <span className="reset-separator">|</span>
                        </>
                      )}
                      <span className="reset-label">Cost:</span>
                      <span className="reset-run">{displayCost > 0 ? formatCompactMoney(displayCost) : '?'}</span>
                      <span className="reset-separator">|</span>
                      <span className="reset-label">Rep:</span>
                      <span className="reset-run">{displayRep > 0 ? formatCompactMoney(displayRep) : (hasLiveTarget ? 'READY' : '?')}</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="overview-controls-panel">
                <h3>⚙️ Service Controls</h3>
                
                <div className="service-control-row">
                  <span className="service-label">🌐 Frontend</span>
                  <div className="button-group">
                    <button className="btn btn-primary" onClick={handleRestartFrontend} title="Reload dashboard">🔄 Reload</button>
                  </div>
                </div>

                <div className="service-control-row">
                  <span className="service-label">🖥️ Backend</span>
                  <div className="button-group">
                    <button className="btn btn-success" onClick={handleStartBackend} title="Start backend server">▶️ Start</button>
                    <button className="btn btn-danger" onClick={handleStopBackend} disabled={controlLoading === 'backend-stop'} title="Stop backend server">{controlLoading === 'backend-stop' ? '⏳ Stopping...' : '🛑 Stop'}</button>
                    <button className="btn btn-warning" onClick={handleRestartBackend} disabled={controlLoading === 'backend-restart'} title="Restart backend server">{controlLoading === 'backend-restart' ? '⏳ Restarting...' : '🔄 Restart'}</button>
                  </div>
                </div>

                <div className="service-control-row">
                  <span className="service-label">🎮 Angel</span>
                  <div className="button-group">
                    <button className="btn btn-success" onClick={handleStartAngel} title="Start Angel orchestrator">▶️ Start</button>
                    <button className="btn btn-danger" onClick={handleStopAngel} title="Stop Angel orchestrator">🛑 Stop</button>
                    <button className="btn btn-warning" onClick={handleRestartAngel} title="Restart Angel orchestrator">🔄 Restart</button>
                  </div>
                </div>

                <div className="control-divider"></div>

                <div className="progress-tracker-section">
                  <div className="progress-row">
                    <span className="overview-label">Phase Progress</span>
                    <span className="tracker-secondary">{phaseCurrent === null ? 'P?' : `P${phaseCurrent}`} / P4</span>
                  </div>
                  <div className="mini-progress-track">
                    <div className="mini-progress-fill" style={{ width: `${phasePercent}%` }} />
                  </div>

                  <div className="progress-row tracker-gap">
                    <span className="overview-label">Angel Lite Progress</span>
                    <span className="tracker-secondary">{angelLitePercent.toFixed(0)}%</span>
                  </div>
                  <div className="mini-progress-track">
                    <div className="mini-progress-fill angel-lite" style={{ width: `${angelLitePercent}%` }} />
                  </div>
                </div>
              </section>
            </div>

          {/* Modules Section - Grid Layout */}
          {modulesArray && modulesArray.length > 0 && (
            <div className="modules-section">
              <div className="modules-header">
                <h2>📦 Active Modules ({modulesArray.length})</h2>
                <span className="module-hint">Terminal-style list • All modules visible</span>
              </div>
              <div className="modules-scroll">
                {modulesArray.map((module, idx) => (
                  <ModuleCard key={idx} module={module} onToggle={handleModuleToggle} formatCompactMoney={formatCompactMoney} moduleDetailsMap={moduleDetailsMap} />
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

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}
