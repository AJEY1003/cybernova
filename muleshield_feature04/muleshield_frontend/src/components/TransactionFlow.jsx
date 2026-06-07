import { useState } from 'react'
import axios from 'axios'

export default function TransactionFlow({ data, onBack }) {
  const [loading, setLoading] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [error, setError] = useState(null)

  // data is the alert object
  const chain = data?.chain || []
  const controller = chain[0] || data?.controller_name || 'Unknown Controller'
  const honeyTrap = chain[chain.length - 1] || data?.matched_cluster?.honey_trap || 'Honey Trap'
  
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
    </div>
  )
}
