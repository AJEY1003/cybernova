import { useState, useEffect } from 'react'
import axios from 'axios'

export default function TransactionFlow({ data, onBack }) {
  const [loading, setLoading] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [error, setError] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const [chain, setChain] = useState(data?.chain || [])
  const [controller, setController] = useState(data?.controller_name || 'Unknown Controller')
  const [honeyTrap, setHoneyTrap] = useState(data?.matched_cluster?.honey_trap || 'Honey Trap')
  const [liveHoneyTrapAlert, setLiveHoneyTrapAlert] = useState(null)

  useEffect(() => {
    // Poll for real-time honey trap hits while sitting on this page
    const interval = setInterval(() => {
      axios.get('/api/alerts?limit=5').then(res => {
        const alerts = res.data.alerts || []
        const hit = alerts.find(a => a.alert_type === 'CONTROLLER_HIT_HONEY_TRAP')
        if (hit && !dismissed) {
          setLiveHoneyTrapAlert(hit)
        }
      }).catch(console.error)
    }, 3000)
    return () => clearInterval(interval)
  }, [dismissed])

  useEffect(() => {
    // Fetch recent transaction nodes to build the chain dynamically
    axios.get('/api/upi/transactions?upi=all&limit=20').then(res => {
      const txs = res.data.transactions || [];
      if (txs.length > 0) {
        const uniqueNodes = new Set();
        txs.forEach(tx => {
          if (tx.sender_upi) uniqueNodes.add(tx.sender_upi);
          if (tx.receiver_upi) uniqueNodes.add(tx.receiver_upi);
        });
        const nodesArray = Array.from(uniqueNodes).slice(0, 5); // Take 5 recent nodes
        const ctrl = data?.controller_name || nodesArray[0] || 'Unknown Controller';
        const ht = data?.matched_cluster?.honey_trap || nodesArray[nodesArray.length - 1] || 'Honey Trap';
        
        // Ensure first node is controller and last is honeytrap
        const middleNodes = nodesArray.filter(n => n !== ctrl && n !== ht);
        
        setController(ctrl);
        setHoneyTrap(ht);
        setChain([ctrl, ...middleNodes, ht]);
      }
    }).catch(console.error);
  }, [data]);
  async function triggerVerification(node) {
    setLoading(node)
    setError(null)
    try {
      // Trigger voice agent on the specific node
      const res = await axios.post(`/api/upi/trigger-voice-agent-by-upi/${node}`)
      setVerifyResult(prev => ({ ...prev, [node]: res.data }))
    } catch (e) {
      setError(node)
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 40, background: '#13131b', minHeight: '100vh', color: '#e4e1ed', fontFamily: 'Inter, sans-serif' }}>
      <button onClick={onBack} style={{ background: 'transparent', border: '1px solid #ffb1c0', color: '#ffb1c0', padding: '8px 16px', borderRadius: 4, cursor: 'pointer', marginBottom: 20 }}>
        ← BACK TO DASHBOARD
      </button>

      <h1 style={{ fontFamily: 'Sora', fontSize: 24, color: '#ff4c83', marginBottom: 8 }}>Chained Transaction Flow Detected</h1>
      <p style={{ color: '#e4bdc3', marginBottom: 30 }}>A transaction chain has hit a known Honey Trap. Review the flow below.</p>

      {/* Visual Chain */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#1b1b23', padding: 30, borderRadius: 8, marginBottom: 30, overflowX: 'auto' }}>
        {chain.length > 0 ? chain.map((node, i) => {
          const isController = i === 0
          const isHoneyTrap = i === chain.length - 1
          const color = isController ? '#e3c630' : isHoneyTrap ? '#00e0b3' : '#ffb1c0'
          const label = isController ? 'CONTROLLER' : isHoneyTrap ? 'HONEY TRAP' : `MULE ${i}`
          const isNodeLoading = loading === node
          const nodeResult = verifyResult?.[node]

          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ background: `${color}15`, border: `2px solid ${color}`, padding: '16px', borderRadius: 8, textAlign: 'center', minWidth: 160 }}>
                <div style={{ fontSize: 10, color, letterSpacing: '0.1em', marginBottom: 8 }}>{label}</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: '#fff', wordBreak: 'break-all', marginBottom: 12 }}>{node}</div>
                
                {!isHoneyTrap && !nodeResult && (
                  <button 
                    onClick={() => triggerVerification(node)}
                    disabled={loading}
                    style={{
                      background: color, color: '#13131b', fontWeight: 'bold', padding: '6px 12px',
                      border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, width: '100%',
                      opacity: isNodeLoading ? 0.7 : loading ? 0.3 : 1
                    }}
                  >
                    {isNodeLoading ? 'CALLING...' : 'VERIFY SENDER'}
                  </button>
                )}
                
                {error === node && <div style={{ color: '#ff4c83', fontSize: 10, marginTop: 8 }}>Error triggering call</div>}

                {nodeResult && (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${color}40`, paddingTop: 8, textAlign: 'left' }}>
                    <div style={{ color: '#e4bdc3', fontSize: 9, marginBottom: 4 }}>MULE PROBABILITY</div>
                    <div style={{ color: '#ff4c83', fontWeight: 'bold', fontSize: 12, marginBottom: 8 }}>{(nodeResult.mule_prob * 100).toFixed(1)}%</div>
                    <div style={{ color: '#e4bdc3', fontSize: 9, marginBottom: 4 }}>TRANSCRIPT SNIPPET</div>
                    <div style={{ fontFamily: 'JetBrains Mono', fontSize: 9, color: '#e4e1ed', fontStyle: 'italic' }}>
                      "{nodeResult.transcript.slice(0, 40)}..."
                    </div>
                  </div>
                )}
              </div>
              {i < chain.length - 1 && (
                <div style={{ margin: '0 15px', color: '#5b3f44', fontSize: 24, alignSelf: 'center' }}>→</div>
              )}
            </div>
          )
        }) : (
          <div style={{ color: '#ff4c83' }}>No chain data found. Single hop transaction.</div>
        )}
      </div>

      {/* Detailed Analysis Section (shows details for the last verified node) */}
      {Object.keys(verifyResult || {}).length > 0 && (() => {
        // Show details of the most recently verified node (we can just show all of them or the last one)
        const lastVerifiedNode = Object.keys(verifyResult).pop()
        const res = verifyResult[lastVerifiedNode]
        
        return (
          <div style={{ background: '#1b1b23', padding: 30, borderRadius: 8, border: '1px solid rgba(0,224,179,0.3)' }}>
            <h3 style={{ color: '#00e0b3', marginBottom: 15 }}>Latest Verification Complete: {lastVerifiedNode}</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ background: '#13131b', padding: 20, borderRadius: 6 }}>
                <div style={{ color: '#e4bdc3', fontSize: 12, marginBottom: 10 }}>TRANSCRIPT</div>
                <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, color: '#e4e1ed', lineHeight: 1.6 }}>
                  "{res.transcript}"
                </div>
              </div>
              
              <div style={{ background: '#13131b', padding: 20, borderRadius: 6 }}>
                <div style={{ color: '#e4bdc3', fontSize: 12, marginBottom: 10 }}>INTELLIGENCE ANALYSIS</div>
                <div style={{ marginBottom: 10 }}>
                  <span style={{ color: '#8b8fa8', fontSize: 12 }}>Mule Probability: </span>
                  <span style={{ color: '#ff4c83', fontWeight: 'bold' }}>{(res.mule_prob * 100).toFixed(1)}%</span>
                </div>
                
                {res.mismatches?.length > 0 && (
                  <div style={{ marginTop: 15 }}>
                    <div style={{ color: '#e4bdc3', fontSize: 12, marginBottom: 8 }}>DETECTED MISMATCHES</div>
                    <ul style={{ margin: 0, paddingLeft: 20, color: '#ffb1c0', fontSize: 13 }}>
                      {res.mismatches.map((m, i) => <li key={i}>{m}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* 🍯 GLOBAL HONEY TRAP FLOATING POPUP (Local to Transaction Flow) */}
      {!dismissed && (liveHoneyTrapAlert || data?.alert_type === 'CONTROLLER_HIT_HONEY_TRAP' || data?.honey_trap_hit) && (() => {
        const activeData = liveHoneyTrapAlert || data || {};
        const ctrl = activeData?.controller || {};
        const txn = activeData?.trigger_transaction || {};
        // Only show if we actually have device fingerprint details (from controller)
        if (!ctrl.device_fingerprint && !ctrl.ip_address) return null;
        
        return (
          <div style={{
            position: 'absolute', top: 30, right: 30, width: 380, zIndex: 1000,
            background: 'rgba(10,15,20,0.95)', border: `1px solid #00e0b3`, borderRadius: 12,
            boxShadow: `0 0 40px rgba(0,224,179,0.25)`, padding: 16, backdropFilter: 'blur(16px)',
            animation: 'slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <style>{`@keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }`}</style>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap: 6, fontFamily: 'Space Grotesk,sans-serif', fontSize: 10, color: '#00e0b3', letterSpacing: '0.15em', fontWeight: 700, textShadow: `0 0 8px #00e0b3` }}>
                  <span style={{ width: 8, height: 8, background: '#00e0b3', borderRadius: '50%', boxShadow: `0 0 10px #00e0b3` }}></span>
                  LIVE HONEY TRAP HIT
                </div>
                <div style={{ fontFamily: 'Sora,sans-serif', fontSize: 16, fontWeight: 700, color: '#fff', marginTop: 4 }}>
                  {txn.sender_upi || activeData?.matched_cluster?.controller_name || controller}
                </div>
              </div>

              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <button 
                  onClick={() => setDismissed(true)}
                  style={{ background: 'transparent', border: 'none', color: '#8b8fa8', cursor: 'pointer', padding: 0, marginBottom: 8, fontSize: 16 }}>
                  ✕
                </button>
                <div style={{ fontFamily: 'Sora,sans-serif', fontSize: 24, fontWeight: 800, color: '#00e0b3', lineHeight: 1 }}>
                  {((activeData?.confidence || 0) * 100).toFixed(0)}%
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 8, padding: 12, marginBottom: 12, fontFamily: 'JetBrains Mono,monospace', fontSize: 11, borderLeft: `3px solid #ff4c83` }}>
              <div style={{ color: '#8b8fa8', marginBottom: 6, fontSize: 10, letterSpacing: '0.05em' }}>INTERCEPTED TRANSACTION</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#e4e1ed' }}>{txn.sender_upi || ctrl.upi_handle || controller}</div>
                  <div style={{ color: '#00e0b3', marginTop: 4 }}>🍯 {txn.receiver_upi || activeData?.matched_cluster?.honey_trap_account || honeyTrap}</div>
                </div>
                <div style={{ color: '#fff', fontSize: 16, fontWeight: 700 }}>
                  ₹{(txn.amount || activeData?.amount || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: 10, color: '#8b8fa8', letterSpacing: '0.1em', marginBottom: 8 }}>
              HARDWARE FINGERPRINT EXTRACTED
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
              {[
                ['DEVICE HASH', ctrl.device_fingerprint && ctrl.device_fingerprint.slice(0, 14)],
                ['JA3 FINGERPRINT', ctrl.ja3_hash && ctrl.ja3_hash.slice(0, 12)],
                ['IP ADDRESS', ctrl.ip_address],
                ['ISP PROVIDER', ctrl.isp],
                ['WEBGL RENDERER', ctrl.webgl_renderer && ctrl.webgl_renderer.slice(0, 20)],
                ['SCREEN RES', ctrl.screen_resolution],
                ['CPU CORES', ctrl.cpu_cores ? ctrl.cpu_cores + ' cores' : null],
                ['BATTERY', ctrl.battery_level != null ? Math.round(ctrl.battery_level * 100) + '%' + (ctrl.battery_charging ? ' ⚡' : '') : null],
              ].filter(x => x[1]).map(([k, v]) => (
                <div key={k} style={{ background: 'rgba(0,224,179,0.05)', padding: '6px 8px', borderRadius: 4, border: `1px solid rgba(0,224,179,0.1)` }}>
                  <div style={{ fontFamily: 'Space Grotesk,sans-serif', fontSize: 8, color: '#8b8fa8', letterSpacing: '0.05em' }}>{k}</div>
                  <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 10, color: '#00e0b3', marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
