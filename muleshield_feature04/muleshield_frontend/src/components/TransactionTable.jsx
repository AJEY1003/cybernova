/**
 * TransactionTable.jsx — Live transaction feed with mule flags
 */
import { useEffect, useState, useMemo } from 'react'
import { api } from '../api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const CTRL_COLORS = {
  CTRL_001: '#3b82f6',
  CTRL_002: '#22c55e',
  CTRL_003: '#a855f7',
  CTRL_004: '#f59e0b',
}

export default function TransactionTable() {
  const [txns, setTxns] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.transactions(100).then(r => { setTxns(r.data.transactions); setLoading(false) })
  }, [])

  const filtered = filter
    ? txns.filter(t => t.controller_id === filter)
    : txns

  // Aggregate transaction volumes by Controller
  const chartData = useMemo(() => {
    const vols = {}
    txns.forEach(t => {
      const c = t.controller_id || 'Unknown'
      if (!vols[c]) vols[c] = 0
      vols[c] += t.amount || 0
    })
    return Object.keys(vols).map(c => ({
      controller: c,
      volume: vols[c]
    })).sort((a,b) => b.volume - a.volume)
  }, [txns])

  return (
    <div style={card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
        <h3 style={title}>📡 Transaction Feed ({filtered.length})</h3>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ background:'#12141e', border:'1px solid #2a2d3e', color:'#e0e0e0',
            padding:'6px 10px', borderRadius:6, fontSize:12 }}>
          <option value=''>All Controllers</option>
          <option value='CTRL_001'>Night Owl</option>
          <option value='CTRL_002'>Splitter</option>
          <option value='CTRL_003'>Ghost</option>
          <option value='CTRL_004'>Local</option>
        </select>
      </div>

      {!loading && txns.length > 0 && !filter && (
        <div style={{ width: '100%', height: 120, marginBottom: 16 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
              <XAxis dataKey="controller" tick={{fontSize: 10, fill: '#8b8fa8'}} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ background: '#12141e', border: '1px solid #2a2d3e', borderRadius: '8px', fontSize: '12px', color: '#fff' }}
                itemStyle={{ color: '#00e0b3' }}
                formatter={(value) => `₹${value.toLocaleString()}`}
              />
              <Bar dataKey="volume" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CTRL_COLORS[entry.controller] || '#8b8fa8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {loading ? <p style={{ color:'#8b8fa8' }}>Loading...</p> : (
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #2a2d3e' }}>
                {['TXN ID','Account','Controller','Amount','Timestamp','ISP','Proxy','Status'].map(h => (
                  <th key={h} style={{ color:'#8b8fa8', padding:'6px 8px', textAlign:'left',
                    fontWeight:500, whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map(t => (
                <tr key={t.transaction_id} style={{ borderBottom:'1px solid #1a1d27' }}>
                  <td style={td}><span style={{ fontFamily:'monospace', color:'#a5b4fc' }}>{t.transaction_id}</span></td>
                  <td style={td}><span style={{ fontFamily:'monospace', fontSize:11 }}>{t.account_id}</span></td>
                  <td style={td}>
                    <span style={{ background: (CTRL_COLORS[t.controller_id] || '#8b8fa8') + '22',
                      color: CTRL_COLORS[t.controller_id] || '#8b8fa8', padding:'2px 6px', borderRadius:3,
                      fontSize:11 }}>{t.controller_id}</span>
                  </td>
                  <td style={td}>₹{t.amount?.toLocaleString()}</td>
                  <td style={td}>{t.timestamp?.slice(0,16)}</td>
                  <td style={td}>{t.isp}</td>
                  <td style={td}>
                    <span style={{ color: t.is_proxy ? '#ef4444' : '#22c55e' }}>
                      {t.is_proxy ? 'YES' : 'No'}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={{ background:'#3f1515', color:'#ef4444',
                      padding:'2px 6px', borderRadius:3, fontSize:11 }}>MULE</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

const card = { background:'#1a1d27', border:'1px solid #2a2d3e', borderRadius:8, padding:16, marginBottom:16 }
const title = { color:'#fff', fontSize:16, fontWeight:600 }
const td = { padding:'6px 8px', color:'#e0e0e0', whiteSpace:'nowrap' }
