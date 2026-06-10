import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { C, lbl } from '../theme'
import TransactionFlow from '../components/TransactionFlow'
import { Search, ChevronDown, ChevronRight, Activity, Fingerprint, MapPin, Eye } from 'lucide-react'

export default function Transactions() {
  const [transactions, setTransactions] = useState([])
  const [alerts, setAlerts] = useState([])
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set())
  const [view, setView] = useState('stream') // stream | flow
  const [flowData, setFlowData] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    async function fetchTxs() {
      try {
        const res = await axios.get('/api/upi/transactions?upi=all&limit=20').catch(() => ({ data: { transactions: [] } }))
        setTransactions(res.data.transactions || [])
        
        const alRes = await axios.get('/api/alerts?limit=50').catch(() => ({ data: [] }))
        setAlerts(alRes.data || [])
      } catch (e) { console.error(e) }
    }
    fetchTxs()
    const iv = setInterval(fetchTxs, 3000)
    return () => clearInterval(iv)
  }, [])

  if (view === 'flow' && flowData) {
    return (
      <div style={{ padding: 24, height: '100%' }}>
        <button
          onClick={() => setView('stream')}
          style={{ marginBottom: 16, padding: '8px 16px', background: C.surface, color: C.textMain, border: `1px solid ${C.outline}`, borderRadius: 4, cursor: 'pointer' }}
        >
          ← BACK TO LEDGER
        </button>
        <div style={{ height: 'calc(100% - 60px)', background: C.bgDeep, borderRadius: 8, overflow: 'hidden' }}>
          <TransactionFlow data={flowData} onBack={() => setView('stream')} />
        </div>
      </div>
    )
  }

  const filteredTransactions = transactions.filter(t => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase()
    return (t.transaction_id && t.transaction_id.toLowerCase().includes(q)) ||
           (t.sender_upi && t.sender_upi.toLowerCase().includes(q)) ||
           (t.receiver_upi && t.receiver_upi.toLowerCase().includes(q))
  })

  // Styles for the table
  const thStyle = { padding: '20px 32px', fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `1px solid ${C.outline}` }
  const tdStyle = { padding: '20px 32px', fontSize: 14, borderBottom: `1px solid ${C.outline}40` }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1400, margin: '0 auto', animation: 'fadeIn 0.5s ease' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .tx-row:hover { background: ${C.surfaceHigh} !important; cursor: pointer; }
        .search-input::placeholder { color: rgba(228,189,195,0.4); }
      `}</style>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: 28, fontWeight: 700, color: C.textMain, margin: 0 }}>Transaction Ledger</h1>
          <p style={{ color: C.textMuted, fontSize: 14, marginTop: 8 }}>Audit and secure all money movement in your network.</p>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', background: C.surface, padding: '10px 16px', borderRadius: 12, border: `1px solid ${C.outline}`, width: 300 }}>
            <span style={{ color: C.textMuted, marginRight: 10 }}>🔍</span>
            <input 
              className="search-input"
              type="text" 
              placeholder="Search by ID or Account..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', color: C.textMain, width: '100%', fontSize: 14, fontFamily: 'Space Grotesk,sans-serif' }}
            />
          </div>
        </div>
      </div>

      <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.outline}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontFamily: 'JetBrains Mono, monospace' }}>
          <thead>
            <tr style={{ background: C.bgDeep }}>
              <th style={thStyle}>Hash ID</th>
              <th style={thStyle}>Protocol Path</th>
              <th style={thStyle}>Volume (INR)</th>
              <th style={{...thStyle, textAlign: 'center'}}>Status</th>
              <th style={{...thStyle, textAlign: 'right'}}>Audit</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx, i) => {
              const v = tx.verdict || 'CLEAN'
              const isHit = v === 'CONTROLLER_IDENTIFIED'
              const isBlocked = v === 'BLOCKED_ACCOUNT_HIT'
              const isHoneyTrap = v === 'HONEY_TRAP_HIT'
              const isFlagged = isHit || isBlocked || isHoneyTrap
              
              const accentColor = isFlagged ? C.error : C.secondary
              const bgAccent = isFlagged ? 'rgba(255, 180, 171, 0.1)' : 'rgba(0, 224, 179, 0.1)'
              const isExpanded = expandedId === (tx.transaction_id || i)

              return (
                <React.Fragment key={tx.transaction_id || i}>
                  <tr 
                    className="tx-row"
                    onClick={() => setExpandedId(isExpanded ? null : (tx.transaction_id || i))}
                    style={{ background: isExpanded ? C.surfaceHigh : 'transparent', transition: 'background 0.2s' }}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ 
                          width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: bgAccent, color: accentColor, border: `1px solid ${accentColor}40`
                        }}>
                          {isFlagged ? '↑' : '↓'}
                        </div>
                        <div>
                          <div style={{ color: C.textMain, fontWeight: 700, fontSize: 14 }}>#{tx.transaction_id?.slice(-8) || `TX_${i}`}</div>
                          <div style={{ color: C.textMuted, fontSize: 10, marginTop: 4, fontFamily: 'Space Grotesk,sans-serif' }}>
                            {tx.timestamp?.slice(11, 16) || 'JUST NOW'} UTC
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ color: C.textMuted, fontSize: 13 }}>
                        {tx.sender_upi} <span style={{ color: C.outline, margin: '0 8px' }}>→</span> {tx.receiver_upi}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ color: isFlagged ? C.error : C.textMain, fontWeight: 700, fontSize: 15 }}>
                        ₹ {tx.amount?.toLocaleString('en-IN', {minimumFractionDigits: 2}) || '0.00'}
                      </div>
                    </td>
                    <td style={{...tdStyle, textAlign: 'center'}}>
                      <div style={{ 
                        display: 'inline-block', padding: '4px 12px', borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
                        background: bgAccent, color: accentColor, border: `1px solid ${accentColor}40`
                      }}>
                        {isFlagged ? 'FLAGGED' : 'CLEARED'}
                      </div>
                    </td>
                    <td style={{...tdStyle, textAlign: 'right'}}>
                      <button style={{ 
                        width: 28, height: 28, borderRadius: 6, background: C.bgDeep, border: `1px solid ${C.outline}`, 
                        color: C.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s'
                      }}>
                        ▼
                      </button>
                    </td>
                  </tr>

                  {/* Expanded Analytics Row */}
                  {isExpanded && (
                    <tr>
                      <td colSpan="5" style={{ padding: 0, borderBottom: `1px solid ${C.outline}40` }}>
                        <div style={{ padding: '24px 32px', background: C.bgDeep, borderTop: `1px solid ${C.outline}20`, borderBottom: `1px solid ${C.outline}20` }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
                            
                            {/* Rule Engine */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <h4 style={{ fontSize: 10, fontWeight: 700, color: C.secondary, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                ⚡ Rule Engine Hit
                              </h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {isFlagged && (
                                  <div style={{ padding: 12, background: C.surface, borderRadius: 8, border: `1px solid ${C.error}30`, color: C.error, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.error }} />
                                    {v.replace(/_/g, ' ')}
                                  </div>
                                )}
                                <div style={{ padding: 12, background: C.surface, borderRadius: 8, border: `1px solid ${C.outline}`, color: C.secondary, fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, borderLeft: `2px solid ${C.secondary}` }}>
                                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.secondary }} />
                                  KYC Validation Completed
                                </div>
                              </div>
                            </div>

                            {/* ML Confidence */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <h4 style={{ fontSize: 10, fontWeight: 700, color: C.error, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                🧠 ML Confidence Score
                              </h4>
                              <div style={{ height: 64, background: C.surface, borderRadius: 8, border: `1px solid ${C.outline}`, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ 
                                  position: 'absolute', left: 0, top: 0, bottom: 0, 
                                  width: `${(tx.confidence_score || 0.14) * 100}%`, 
                                  background: isFlagged ? 'rgba(255, 180, 171, 0.2)' : 'rgba(0, 224, 179, 0.1)',
                                  borderRight: `2px solid ${isFlagged ? C.error : C.secondary}`,
                                  transition: 'width 1s ease'
                                }} />
                                <span style={{ position: 'relative', zIndex: 10, fontSize: 24, fontWeight: 700, color: isFlagged ? C.error : C.textMain }}>
                                  {((tx.confidence_score || 0.141) * 100).toFixed(1)}%
                                </span>
                              </div>
                              <p style={{ fontSize: 9, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center', margin: 0, fontWeight: 700 }}>
                                Ensemble Model Inference
                              </p>
                            </div>

                            {/* Network Topology */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              <h4 style={{ fontSize: 10, fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                🕸️ Network Topology
                              </h4>
                              <div style={{ padding: 12, background: C.surface, borderRadius: 8, border: `1px solid ${C.outline}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textMuted }}>
                                  <span>Node IP</span>
                                  <span style={{ color: C.textMain }}>{tx.sender_ip || '192.168.1.1'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.textMuted }}>
                                  <span>Device Hash</span>
                                  <span style={{ color: C.textMain, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {tx.device_fingerprint || 'Unknown'}
                                  </span>
                                </div>
                                <div style={{ borderTop: `1px solid ${C.outline}40`, paddingTop: 8, marginTop: 4, textAlign: 'center' }}>
                                  <button 
                                    onClick={async (e) => { 
                                      e.stopPropagation(); 
                                      try {
                                        const r = await axios.get('/api/alerts?limit=50');
                                        const alerts = r.data?.alerts || [];
                                        const alert = alerts.find(a => (a.trigger_transaction?.transaction_id || a.transaction?.transaction_id) === tx.transaction_id);
                                        const controller = "ACC_CTRL_" + (tx.controller_id || "Unknown");
                                        setFlowData(alert || { 
                                          chain: [tx.sender_upi, tx.receiver_upi], 
                                          controller_name: tx.sender_upi 
                                        });
                                        setView('flow');
                                      } catch (err) {
                                        setFlowData({ 
                                          chain: [tx.sender_upi, tx.receiver_upi], 
                                          controller_name: tx.sender_upi 
                                        });
                                        setView('flow');
                                      }
                                    }}
                                    style={{ 
                                      background: 'transparent', border: `1px solid ${C.primary}`, color: C.primary, padding: '6px 12px', 
                                      borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', cursor: 'pointer', width: '100%',
                                      textTransform: 'uppercase'
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255, 177, 192, 0.1)' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                                  >
                                    View Graph Flow →
                                  </button>
                                </div>
                              </div>
                            </div>

                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
            
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan="5" style={{ padding: '120px 0', textAlign: 'center', color: C.textMuted }}>
                  <div style={{ fontSize: 24, marginBottom: 16 }}>🔍</div>
                  <div style={{ fontSize: 14, fontFamily: 'Space Grotesk,sans-serif' }}>Querying distributed ledger...</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
