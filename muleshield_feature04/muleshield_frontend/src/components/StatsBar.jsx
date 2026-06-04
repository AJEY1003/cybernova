/**
 * StatsBar.jsx — Dashboard stats overview
 */
import { useEffect, useState } from 'react'
import { api } from '../api'

export default function StatsBar() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.stats().then(r => setStats(r.data)).catch(() => {})
    const interval = setInterval(() => {
      api.stats().then(r => setStats(r.data)).catch(() => {})
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  if (!stats) return null

  const items = [
    { label: 'Transactions', value: stats.total_transactions, color: '#a5b4fc' },
    { label: 'Clusters', value: stats.total_clusters, color: '#22c55e' },
    { label: 'Blocked Accounts', value: stats.blocked_accounts, color: '#ef4444' },
    { label: 'Honey Traps', value: stats.honey_trap_accounts, color: '#f59e0b' },
    { label: 'Alerts', value: stats.total_alerts, color: '#a855f7' },
    { label: 'High Confidence', value: stats.high_confidence_alerts, color: '#ef4444' },
  ]

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:10, marginBottom:20 }}>
      {items.map(item => (
        <div key={item.label} style={{ background:'#1a1d27', border:'1px solid #2a2d3e',
          borderRadius:8, padding:'12px 16px', textAlign:'center' }}>
          <div style={{ color: item.color, fontSize:24, fontWeight:700 }}>{item.value ?? '—'}</div>
          <div style={{ color:'#8b8fa8', fontSize:11, marginTop:2 }}>{item.label}</div>
        </div>
      ))}
    </div>
  )
}
