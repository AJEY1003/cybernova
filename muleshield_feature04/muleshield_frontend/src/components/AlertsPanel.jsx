/**
 * AlertsPanel.jsx — Live alerts feed + Razorpay orders
 */
import { useEffect, useState, useMemo } from 'react'
import { api } from '../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

export default function AlertsPanel() {
  const [alerts, setAlerts] = useState([])
  const [orders, setOrders] = useState([])
  const [creatingOrders, setCreatingOrders] = useState(false)
  const [tab, setTab] = useState('alerts')

  useEffect(() => {
    api.alerts().then(r => setAlerts(r.data.alerts || [])).catch(() => {})
    api.razorpayOrders().then(r => {
      const items = r.data?.data?.items || []
      setOrders(items)
    }).catch(() => {})
  }, [])

  async function createDemoOrders() {
    setCreatingOrders(true)
    try {
      await api.createDemoOrders()
      const r = await api.razorpayOrders()
      setOrders(r.data?.data?.items || [])
    } finally {
      setCreatingOrders(false)
    }
  }

  const tierColor = (tier) => tier === 'HIGH_CONFIDENCE' ? '#ef4444'
    : tier === 'SUSPECTED' ? '#f59e0b' : '#22c55e'

  const chartData = useMemo(() => {
    const counts = {}
    alerts.forEach(a => {
      const type = a.alert_type || 'Unknown'
      counts[type] = (counts[type] || 0) + 1
    })
    return Object.keys(counts).map(k => ({
      name: k,
      count: counts[k],
      color: k.includes('Honey Trap') ? '#f59e0b' : '#ef4444'
    }))
  }, [alerts])

  return (
    <div style={card}>
      <div style={{ display:'flex', gap:12, marginBottom:16 }}>
        {['alerts','razorpay'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ background: tab===t ? '#3b5bdb' : '#12141e',
              color: tab===t ? '#fff' : '#8b8fa8', border:'1px solid #2a2d3e',
              padding:'6px 16px', borderRadius:6, cursor:'pointer', fontSize:13 }}>
            {t === 'alerts' ? `🚨 Alerts (${alerts.length})` : '💳 Razorpay Orders'}
          </button>
        ))}
      </div>

      {tab === 'alerts' && (
        <>
          {alerts.length > 0 && (
            <div style={{ width: '100%', height: 140, marginBottom: 16 }}>
              <span style={{ color: '#8b8fa8', fontSize: 12, marginBottom: 8, display: 'block' }}>Alerts by Type</span>
              <ResponsiveContainer>
                <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{fontSize: 10, fill: '#e0e0e0'}} axisLine={false} tickLine={false} width={120} />
                  <Tooltip 
                    cursor={{fill: '#2a2d3e'}}
                    contentStyle={{ background: '#12141e', border: '1px solid #2a2d3e', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={16}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {alerts.length === 0
            ? <p style={{ color:'#8b8fa8', fontSize:13 }}>No alerts yet. Run honey trap detection to generate alerts.</p>
            : alerts.map(a => (
              <div key={a.alert_id} style={{ background:'#12141e', borderRadius:6,
                padding:12, marginBottom:10, borderLeft:`3px solid ${tierColor(a.confidence_tier)}` }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <span style={{ color: tierColor(a.confidence_tier), fontWeight:600, fontSize:13 }}>
                    {a.alert_type}
                  </span>
                  <span style={{ color:'#8b8fa8', fontSize:11 }}>{a.alert_timestamp?.slice(0,19)}</span>
                </div>
                <div style={{ fontSize:12, color:'#e0e0e0' }}>
                  Confidence: <strong>{(a.confidence * 100).toFixed(1)}%</strong> |
                  Cluster: {a.matched_cluster?.cluster_id} |
                  UPI: {a.controller?.upi_handle}
                </div>
                <div style={{ fontSize:12, color:'#8b8fa8', marginTop:4 }}>
                  Action: <span style={{ color: tierColor(a.confidence_tier) }}>{a.recommended_action}</span> |
                  LEA Ref: {a.lea_reference}
                </div>
              </div>
            ))
          }
        </>
      )}

      {tab === 'razorpay' && (
        <div>
          <button onClick={createDemoOrders} disabled={creatingOrders}
            style={{ background:'#1e3a5f', color:'#a5b4fc', border:'1px solid #3b5bdb',
              padding:'8px 16px', borderRadius:6, cursor:'pointer', fontSize:13, marginBottom:12 }}>
            {creatingOrders ? 'Creating...' : '+ Create Demo Orders on Razorpay'}
          </button>
          {orders.length === 0
            ? <p style={{ color:'#8b8fa8', fontSize:13 }}>No orders yet. Click above to create test orders.</p>
            : orders.map(o => (
              <div key={o.id} style={{ background:'#12141e', borderRadius:6,
                padding:10, marginBottom:8, fontSize:12 }}>
                <div style={{ color:'#a5b4fc', fontFamily:'monospace' }}>{o.id}</div>
                <div style={{ color:'#e0e0e0' }}>₹{(o.amount/100).toLocaleString()} — {o.status}</div>
                <div style={{ color:'#8b8fa8' }}>{o.receipt}</div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

const card = { background:'#1a1d27', border:'1px solid #2a2d3e', borderRadius:8, padding:16, marginBottom:16 }
