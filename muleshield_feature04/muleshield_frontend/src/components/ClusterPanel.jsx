/**
 * ClusterPanel.jsx
 * Shows all 4 detected controller clusters with fingerprints and account statuses.
 */
import { useEffect, useState } from 'react'
import { api } from '../api'

const STATUS_COLOR = {
  BLOCKED: '#ef4444',
  HONEY_TRAP: '#f59e0b',
  ACTIVE: '#22c55e',
  FLAGGED: '#a855f7',
}

function AccountBadge({ accountId, status, onStatusChange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 0',
      borderBottom:'1px solid #2a2d3e' }}>
      <span style={{ fontSize:12, color:'#e0e0e0', flex:1, fontFamily:'monospace' }}>{accountId}</span>
      <span style={{ background: STATUS_COLOR[status] + '22', color: STATUS_COLOR[status],
        fontSize:11, padding:'2px 8px', borderRadius:4, border:`1px solid ${STATUS_COLOR[status]}`,
        minWidth:80, textAlign:'center' }}>{status}</span>
      <select
        value={status}
        onChange={e => onStatusChange(accountId, e.target.value)}
        style={{ background:'#12141e', border:'1px solid #2a2d3e', color:'#8b8fa8',
          fontSize:11, padding:'2px 4px', borderRadius:4 }}>
        {Object.keys(STATUS_COLOR).map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  )
}

export default function ClusterPanel() {
  const [clusters, setClusters] = useState([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(null)

  useEffect(() => {
    api.clusters().then(r => { setClusters(r.data.clusters); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function handleStatusChange(accountId, newStatus) {
    setUpdating(accountId)
    try {
      await api.updateAccountStatus(accountId, newStatus)
      setClusters(prev => prev.map(c => ({
        ...c,
        account_statuses: {
          ...c.account_statuses,
          [accountId]: newStatus,
        }
      })))
    } finally {
      setUpdating(null)
    }
  }

  if (loading) return <div style={card}><p style={{ color:'#8b8fa8' }}>Loading clusters...</p></div>

  return (
    <div>
      <h3 style={{ color:'#fff', fontSize:16, fontWeight:600, marginBottom:16 }}>
        🎯 Controller Clusters ({clusters.length} detected)
      </h3>
      {clusters.map(c => (
        <div key={c.cluster_id} style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
            <div>
              <div style={{ color:'#fff', fontWeight:600, fontSize:15 }}>{c.controller_name}</div>
              <div style={{ color:'#8b8fa8', fontSize:12 }}>{c.cluster_id}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ color:'#22c55e', fontWeight:700, fontSize:18 }}>
                {(c.confidence_score * 100).toFixed(0)}%
              </div>
              <div style={{ color:'#8b8fa8', fontSize:11 }}>confidence</div>
            </div>
          </div>

          {/* Fingerprint */}
          <div style={{ background:'#12141e', borderRadius:6, padding:10, marginBottom:12, fontSize:12 }}>
            <div style={{ color:'#8b8fa8', marginBottom:6, fontWeight:600 }}>Controller Fingerprint</div>
            {Object.entries(c.controller_fingerprint || {}).map(([k, v]) => (
              <div key={k} style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                <span style={{ color:'#8b8fa8' }}>{k.replace(/_/g,' ')}</span>
                <span style={{ color: k === 'proxy_user' && v ? '#ef4444' : '#e0e0e0' }}>
                  {String(v)}
                </span>
              </div>
            ))}
          </div>

          {/* Honey trap highlight */}
          <div style={{ background:'#2a1f00', border:'1px solid #f59e0b', borderRadius:6,
            padding:'6px 10px', marginBottom:10, fontSize:12 }}>
            🍯 Honey Trap: <span style={{ color:'#f59e0b', fontFamily:'monospace' }}>{c.honey_trap_account}</span>
          </div>

          {/* Account statuses */}
          <div style={{ fontSize:12, color:'#8b8fa8', marginBottom:6 }}>
            Accounts ({c.account_count})
          </div>
          {Object.entries(c.account_statuses || {}).map(([acc, status]) => (
            <AccountBadge
              key={acc}
              accountId={acc}
              status={updating === acc ? '...' : status}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

const card = { background:'#1a1d27', border:'1px solid #2a2d3e', borderRadius:8, padding:16, marginBottom:12 }
