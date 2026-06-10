import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { C, lbl } from '../theme'
import { 
  TrendingUp, 
  ShieldCheck, 
  Users, 
  AlertTriangle,
  ArrowUpRight,
  Activity
} from 'lucide-react'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'

export default function Home() {
  const [stats, setStats] = useState({
    total_transactions: 0,
    total_alerts: 0,
    total_clusters: 0,
    high_confidence_alerts: 0
  })
  const [agentStatus, setAgentStatus] = useState(null)
  const [clusters, setClusters] = useState([])
  const [wsMessage, setWsMessage] = useState(["[SYSTEM] Listening for live network signals..."])

  useEffect(() => {
    async function fetchData() {
      try {
        const [st, as, cl] = await Promise.all([
          axios.get('/api/stats').catch(() => ({ data: {} })),
          axios.get('/api/graph-network/agent-status').catch(() => ({ data: { networks: [] } })),
          axios.get('/api/clusters').catch(() => ({ data: { clusters: [] } }))
        ])
        if (st.data && typeof st.data.total_transactions === 'number') {
          setStats(st.data)
        }
        setAgentStatus(as.data)
        setClusters(cl.data.clusters || [])
      } catch (e) {
        console.error(e)
      }
    }
    fetchData()
    const iv = setInterval(fetchData, 5000)
    
    // Simulate live stream messages
    const baseMsgs = [
      "Analyzing transaction chain #TX-829...",
      "DBSCAN updating cluster fingerprints...",
      "Velocity spike detected on subnet 10.4.x",
      "Validating IP geo-location anomalies...",
      "Waiting for next telemetry batch...",
      "Cross-referencing KYC profiles...",
      "Ingesting new UPI transactions...",
      "GraphSAGE embeddings refreshed..."
    ]
    let msgCount = 0
    const streamIv = setInterval(() => {
      setWsMessage(prev => {
        const nextMsg = baseMsgs[msgCount % baseMsgs.length]
        msgCount++
        const newLog = [...prev, `[${new Date().toLocaleTimeString()}] > ${nextMsg}`]
        return newLog.slice(-5) // Keep last 5 messages
      })
    }, 2500)
    
    return () => {
      clearInterval(iv)
      clearInterval(streamIv)
    }
  }, [])

  const controllers = agentStatus?.networks || []
  const displayItems = controllers.length > 0 ? controllers : clusters

  // Mock data for area chart
  const data = [
    { name: 'Mon', value: 400 },
    { name: 'Tue', value: 300 },
    { name: 'Wed', value: 600 },
    { name: 'Thu', value: 800 },
    { name: 'Fri', value: 500 },
    { name: 'Sat', value: 900 },
    { name: 'Sun', value: 1100 },
  ]

  const total = stats.total_transactions || 100
  const alertsCount = stats.total_alerts || 0
  const safeCount = Math.max(0, total - alertsCount)
  
  const pieData = [
    { name: 'Safe', value: safeCount, color: C.secondary }, // Greenish
    { name: 'High Risk', value: alertsCount, color: C.error },   // Redish
  ]

  // Base styling for cards
  const glassPanel = {
    background: C.surface,
    borderRadius: 16,
    padding: 24,
    border: `1px solid ${C.outline}`,
    position: 'relative',
    overflow: 'hidden'
  }

  return (
    <div style={{ padding: '32px 48px', maxWidth: 1400, margin: '0 auto', animation: 'fadeIn 0.5s ease' }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        .glass-hover:hover { border-color: rgba(255,255,255,0.2) !important; }
        .glow-emerald { text-shadow: 0 0 10px ${C.secondary}; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: 32, fontWeight: 700, color: C.textMain, margin: 0, letterSpacing: '-0.02em' }}>Financial Overview</h1>
          <p style={{ color: C.textMuted, fontSize: 14, marginTop: 6 }}>Real-time monitoring of your network's liquidity and security.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ 
            padding: '6px 12px', background: 'rgba(0, 224, 179, 0.1)', color: C.secondary, 
            border: `1px solid rgba(0, 224, 179, 0.3)`, borderRadius: 8, 
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em',
            boxShadow: `0 0 10px rgba(0, 224, 179, 0.2)`
          }}>
            LIVE MONITORING ON
          </div>
        </div>
      </div>

      {/* Hero Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 32 }}>
        
        {/* Total Liquidity */}
        <div className="glass-hover" style={{ ...glassPanel, transition: 'border-color 0.3s' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, background: 'rgba(0, 224, 179, 0.1)', borderRadius: '50%', filter: 'blur(30px)' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, position: 'relative', zIndex: 10 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(0, 224, 179, 0.1)', color: C.secondary, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid rgba(0, 224, 179, 0.2)` }}>
              <TrendingUp size={20} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', color: C.secondary, background: 'rgba(0, 224, 179, 0.1)', border: `1px solid rgba(0, 224, 179, 0.2)`, padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
              <ArrowUpRight size={14} style={{ marginRight: 4 }} /> 12%
            </div>
          </div>
          <p style={{ ...lbl({ marginBottom: 4 }), position: 'relative', zIndex: 10 }}>Total Liquidity</p>
          <h3 style={{ fontFamily: 'Sora,sans-serif', fontSize: 32, fontWeight: 700, color: C.textMain, margin: 0, position: 'relative', zIndex: 10 }}>₹ 14.2M</h3>
        </div>

        {/* Risk Flagged */}
        <div className="glass-hover" style={{ ...glassPanel, transition: 'border-color 0.3s' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, background: 'rgba(255, 180, 171, 0.1)', borderRadius: '50%', filter: 'blur(30px)' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, position: 'relative', zIndex: 10 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(255, 180, 171, 0.1)', color: C.error, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid rgba(255, 180, 171, 0.2)` }}>
              <AlertTriangle size={20} />
            </div>
            {alertsCount > 0 && (
              <span style={{ color: C.error, background: 'rgba(255, 180, 171, 0.1)', border: `1px solid rgba(255, 180, 171, 0.2)`, padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700, animation: 'pulse 2s infinite' }}>
                CRITICAL
              </span>
            )}
          </div>
          <p style={{ ...lbl({ marginBottom: 4 }), position: 'relative', zIndex: 10 }}>Risk Flagged</p>
          <h3 style={{ fontFamily: 'Sora,sans-serif', fontSize: 32, fontWeight: 700, color: C.textMain, margin: 0, position: 'relative', zIndex: 10 }}>{alertsCount} <span style={{ color: C.textMuted, fontSize: 14, fontFamily: 'Space Grotesk,sans-serif' }}>Alerts</span></h3>
        </div>

        {/* Scanned Today */}
        <div className="glass-hover" style={{ ...glassPanel, transition: 'border-color 0.3s' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, background: 'rgba(255, 177, 192, 0.1)', borderRadius: '50%', filter: 'blur(30px)' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, position: 'relative', zIndex: 10 }}>
            <div style={{ width: 40, height: 40, background: 'rgba(255, 177, 192, 0.1)', color: C.primary, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid rgba(255, 177, 192, 0.2)` }}>
              <ShieldCheck size={20} />
            </div>
            <span style={{ color: C.primary, background: 'rgba(255, 177, 192, 0.1)', border: `1px solid rgba(255, 177, 192, 0.2)`, padding: '4px 8px', borderRadius: 8, fontSize: 11, fontWeight: 700 }}>
              HEALTHY
            </span>
          </div>
          <p style={{ ...lbl({ marginBottom: 4 }), position: 'relative', zIndex: 10 }}>Scanned Today</p>
          <h3 style={{ fontFamily: 'Sora,sans-serif', fontSize: 32, fontWeight: 700, color: C.textMain, margin: 0, position: 'relative', zIndex: 10 }}>{total} <span style={{ color: C.textMuted, fontSize: 14, fontFamily: 'Space Grotesk,sans-serif' }}>Tx</span></h3>
        </div>

        {/* Active Controllers */}
        <div className="glass-hover" style={{ ...glassPanel, transition: 'border-color 0.3s' }}>
           <div style={{ position: 'absolute', top: -40, right: -40, width: 120, height: 120, background: 'rgba(227, 198, 48, 0.05)', borderRadius: '50%', filter: 'blur(30px)' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, position: 'relative', zIndex: 10 }}>
            <div style={{ width: 40, height: 40, background: C.bgDeep, color: C.tertiary, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.outline}` }}>
              <Users size={20} />
            </div>
          </div>
          <p style={{ ...lbl({ marginBottom: 4 }), position: 'relative', zIndex: 10 }}>Active Clusters</p>
          <h3 style={{ fontFamily: 'Sora,sans-serif', fontSize: 32, fontWeight: 700, color: C.textMain, margin: 0, position: 'relative', zIndex: 10 }}>{stats.total_clusters}</h3>
        </div>
      </div>

      {/* Main Charts Area */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32, marginBottom: 32 }}>
        
        {/* Transaction Volume Chart */}
        <div style={{ ...glassPanel, padding: 32, borderRadius: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: C.textMain, margin: 0, fontFamily: 'Space Grotesk,sans-serif' }}>Transaction Volume</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{ padding: '6px 16px', background: 'rgba(0, 224, 179, 0.1)', color: C.secondary, border: `1px solid rgba(0, 224, 179, 0.3)`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Weekly</button>
              <button style={{ padding: '6px 16px', background: C.bgDeep, color: C.textMuted, border: `1px solid ${C.outline}`, borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Monthly</button>
            </div>
          </div>
          <div style={{ height: 280, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.secondary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={C.secondary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.outline} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: C.textMuted, fontSize: 12, fontWeight: 500, fontFamily: 'JetBrains Mono,monospace'}} dy={10} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{backgroundColor: C.bgDeep, borderColor: C.outline, borderRadius: 12, color: C.textMain, fontFamily: 'JetBrains Mono,monospace'}}
                  cursor={{stroke: C.secondary, strokeWidth: 1, strokeDasharray: '4 4'}}
                />
                <Area type="monotone" dataKey="value" stroke={C.secondary} strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Risk Distribution Chart */}
        <div style={{ ...glassPanel, padding: 32, borderRadius: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.textMain, width: '100%', marginBottom: 32, marginTop: 0, fontFamily: 'Space Grotesk,sans-serif' }}>Risk Distribution</h2>
          <div style={{ height: 220, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{backgroundColor: C.bgDeep, borderColor: C.outline, borderRadius: 12, color: C.textMain, fontFamily: 'JetBrains Mono,monospace'}}
                  itemStyle={{color: C.textMain}}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ width: '100%', marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {pieData.map((item) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: item.color }}></div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: C.textMuted, fontFamily: 'Space Grotesk,sans-serif' }}>{item.name}</span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.textMain, fontFamily: 'JetBrains Mono,monospace' }}>
                  {total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Signals & Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, paddingBottom: 48 }}>
        
        {/* Live Stream */}
        <div style={{ ...glassPanel, padding: 32, borderRadius: 24 }}>
          <div style={{ position: 'absolute', top: -50, right: -50, width: 250, height: 250, background: 'rgba(0, 224, 179, 0.05)', borderRadius: '50%', filter: 'blur(50px)', pointerEvents: 'none' }}></div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.textMain, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Space Grotesk,sans-serif' }}>
            <Activity color={C.secondary} size={20} />
            MuleShield Live Event Stream
          </h2>
          <div style={{ background: C.bgDeep, padding: 24, borderRadius: 16, border: `1px solid ${C.outline}`, height: 160, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', fontFamily: 'JetBrains Mono,monospace', fontSize: 13, position: 'relative', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.05)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2px 0' }}>
                <div style={{ width: '100%', height: '50%', background: 'rgba(0, 224, 179, 0.5)', animation: 'pulse 2s infinite', borderRadius: '4px 4px 0 0' }}></div>
                <div style={{ width: '100%', height: '50%', background: 'transparent', borderRadius: '0 0 4px 4px' }}></div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 16 }}>
              {Array.isArray(wsMessage) && wsMessage.map((msg, i) => (
                <p key={i} style={{ color: i === wsMessage.length - 1 ? C.secondary : C.textMuted, fontWeight: 500, margin: 0, opacity: 0.4 + (i * 0.15) }}>
                  {msg}
                  {i === wsMessage.length - 1 && <span style={{ display: 'inline-block', width: 6, height: 14, background: C.secondary, marginLeft: 6, animation: 'pulse 1s infinite', verticalAlign: 'middle' }}></span>}
                </p>
              ))}
            </div>
          </div>
        </div>

        {/* Security Alerts / Detected Clusters */}
        <div style={{ ...glassPanel, padding: 32, borderRadius: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: C.textMain, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Space Grotesk,sans-serif' }}>
            <AlertTriangle color={C.error} size={20} />
            Detected Controller Hubs
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 200, overflowY: 'auto', paddingRight: 8 }}>
            {displayItems.map((net, i) => {
              const riskScore = net.risk_score !== undefined ? net.risk_score : net.confidence_score || 0
              const isHighRisk = riskScore > 0.8
              const riskColor = isHighRisk ? C.error : C.primary
              const riskBg = isHighRisk ? 'rgba(255, 180, 171, 0.1)' : 'rgba(255, 177, 192, 0.1)'
              const riskBorder = isHighRisk ? 'rgba(255, 180, 171, 0.3)' : 'rgba(255, 177, 192, 0.3)'
              const blockedCount = net.blocked_count !== undefined ? net.blocked_count : net.account_count || 0
              const canaryId = net.canary || net.honey_trap_account || 'N/A'

              return (
                <div key={net.cluster_id || i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: C.bgDeep, borderRadius: 12, border: `1px solid ${isHighRisk ? riskBorder : C.outline}`, transition: 'background 0.2s', cursor: 'pointer' }} className="glass-hover">
                  <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${riskColor}`, color: riskColor, background: riskBg }}>
                    <AlertTriangle size={14} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: C.textMain, margin: '0 0 4px 0', fontFamily: 'Space Grotesk,sans-serif' }}>
                      {net.controller_name} <span style={{ color: C.textMuted, fontFamily: 'JetBrains Mono,monospace', fontSize: 10, marginLeft: 8 }}>{net.cluster_id}</span>
                    </p>
                    <p style={{ fontSize: 10, color: C.textMuted, fontWeight: 500, margin: 0, fontFamily: 'JetBrains Mono,monospace' }}>
                      {blockedCount} Accounts monitored • Canary: {canaryId.slice(0, 8)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 8px', borderRadius: 4, display: 'inline-block', border: `1px solid ${riskColor}`, color: riskColor, background: riskBg, margin: 0 }}>
                      {(riskScore * 100).toFixed(0)}% RISK
                    </p>
                  </div>
                </div>
              )
            })}
            {displayItems.length === 0 && (
              <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ color: C.textMuted, fontWeight: 500, fontStyle: 'italic', fontSize: 14 }}>No active controller networks detected in stream.</p>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
