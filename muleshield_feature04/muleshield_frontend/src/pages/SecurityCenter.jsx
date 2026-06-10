import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { C, lbl } from '../theme'
import NetworkGraph from '../components/NetworkGraph'
import AlertsPanel from '../components/AlertsPanel'
import HoneyTrapDetector from '../components/HoneyTrapDetector'

export default function SecurityCenter() {
  const [viewMode, setViewMode] = useState('graph') // graph | alerts
  const [alerts, setAlerts] = useState([])
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set())

  useEffect(() => {
    async function fetchAlerts() {
      try {
        const alRes = await axios.get('/api/alerts?limit=50').catch(() => ({ data: { alerts: [] } }))
        setAlerts(alRes.data?.alerts || [])
      } catch (e) { console.error(e) }
    }
    fetchAlerts()
    const iv = setInterval(fetchAlerts, 3000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontFamily: 'Space Grotesk,sans-serif', color: C.textMain, margin: 0 }}>SECURITY CENTER</h2>
          <p style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: C.textMuted, margin: '4px 0 0' }}>THREAT INTELLIGENCE & NETWORK TOPOLOGY</p>
        </div>
        
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            onClick={() => setViewMode('graph')}
            style={{ 
              padding: '8px 16px', background: viewMode === 'graph' ? 'rgba(0,224,179,0.1)' : 'transparent', 
              color: viewMode === 'graph' ? C.secondary : C.textMuted, 
              border: `1px solid ${viewMode === 'graph' ? C.secondary : C.outline}`, 
              borderRadius: 4, cursor: 'pointer', fontFamily: 'Space Grotesk,sans-serif', fontSize: 12, letterSpacing: '0.1em'
            }}
          >
            NETWORK GRAPH
          </button>
          <button 
            onClick={() => setViewMode('alerts')}
            style={{ 
              padding: '8px 16px', background: viewMode === 'alerts' ? 'rgba(255,177,192,0.1)' : 'transparent', 
              color: viewMode === 'alerts' ? C.primary : C.textMuted, 
              border: `1px solid ${viewMode === 'alerts' ? C.primary : C.outline}`, 
              borderRadius: 4, cursor: 'pointer', fontFamily: 'Space Grotesk,sans-serif', fontSize: 12, letterSpacing: '0.1em'
            }}
          >
            LIVE ALERTS
          </button>
          <button 
            onClick={() => setViewMode('honey-trap')}
            style={{ 
              padding: '8px 16px', background: viewMode === 'honey-trap' ? 'rgba(0,224,179,0.1)' : 'transparent', 
              color: viewMode === 'honey-trap' ? C.nodeCanary : C.textMuted, 
              border: `1px solid ${viewMode === 'honey-trap' ? C.nodeCanary : C.outline}`, 
              borderRadius: 4, cursor: 'pointer', fontFamily: 'Space Grotesk,sans-serif', fontSize: 12, letterSpacing: '0.1em'
            }}
          >
            HONEY TRAP
          </button>
        </div>
      </div>

      <div style={{ flex: 1, background: C.surface, border: `1px solid rgba(91,63,68,0.2)`, borderRadius: 8, overflow: 'hidden', position: 'relative' }}>
        {viewMode === 'graph' && <NetworkGraph />}
        {viewMode === 'alerts' && <AlertsPanel />}
        {viewMode === 'honey-trap' && <HoneyTrapDetector />}
      </div>

    </div>
  )
}
