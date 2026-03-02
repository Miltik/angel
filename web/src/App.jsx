import { useState, useEffect } from 'react'
import axios from 'axios'
import './App.css'

const BACKEND_URL = 'http://localhost:3000'

function App() {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchStatus()
  }, [])

  const fetchStatus = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`${BACKEND_URL}/api/status`)
      setStatus(response.data)
      setError(null)
    } catch (err) {
      console.error('Backend unreachable:', err)
      setError('Backend not running. Start server with: cd server && npm start')
    } finally {
      setLoading(false)
    }
  }

  const sendCommand = async (commandType) => {
    try {
      await axios.post(`${BACKEND_URL}/api/commands`, {
        commandType,
        parameters: {}
      })
      alert(`Command sent: ${commandType}`)
      setTimeout(fetchStatus, 500)
    } catch (err) {
      alert(`Error: ${err.message}`)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🤖 ANGEL Dashboard</h1>
        <p className="subtitle">Real-time monitoring & control</p>
      </header>

      <main className="content">
        {error && (
          <div className="error-box">
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          <div className="loading">Connecting to backend...</div>
        ) : status ? (
          <div className="dashboard">
            <div className="status-box">
              <h2>Status</h2>
              <div className="status-grid">
                <div className="stat">
                  <span className="label">Last Update</span>
                  <span className="value">
                    {status.lastUpdate 
                      ? new Date(status.lastUpdate).toLocaleTimeString()
                      : 'No data yet'}
                  </span>
                </div>
                <div className="stat">
                  <span className="label">Pending Commands</span>
                  <span className="value">{status.pendingCommands}</span>
                </div>
              </div>
            </div>

            {status.latestData && (
              <div className="data-box">
                <h2>Latest Telemetry</h2>
                <div className="data-grid">
                  <div className="data-item">
                    <span className="label">Module</span>
                    <span className="value">{status.latestData.module_name}</span>
                  </div>
                  <div className="data-item">
                    <span className="label">Money Rate</span>
                    <span className="value">${(status.latestData.money_rate || 0).toFixed(2)}/s</span>
                  </div>
                  <div className="data-item">
                    <span className="label">XP Rate</span>
                    <span className="value">${(status.latestData.xp_rate || 0).toFixed(2)}/s</span>
                  </div>
                  <div className="data-item">
                    <span className="label">Hack Level</span>
                    <span className="value">{status.latestData.hack_level}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="controls">
              <h2>Controls</h2>
              <div className="button-group">
                <button 
                  className="btn btn-primary"
                  onClick={() => sendCommand('pause')}
                >
                  ⏸️ Pause
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => sendCommand('resume')}
                >
                  ▶️ Resume
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => sendCommand('report')}
                >
                  📊 Report
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={fetchStatus}
                >
                  🔄 Refresh
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-data">No status available</div>
        )}
      </main>

      <footer className="footer">
        <p>Backend: {BACKEND_URL}</p>
        <p>Mobile: Open on phone via WiFi IP:5173</p>
      </footer>
    </div>
  )
}

export default App
