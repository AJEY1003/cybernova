/**
 * HoneyTrapDetector.jsx
 * Core detection panel — simulates controller sending money to honey trap.
 * Injects real device fingerprint + JA3 hash into the transaction payload.
 * Calls POST /detect/honey-trap and shows full attribution result.
 */
import { useState } from 'react'
import { api } from '../api'
import { useDeviceFingerprint } from '../hooks/useDeviceFingerprint'

const HONEY_TRAP_ACCOUNTS = [
  'ACC_CTRL_001_002',
  'ACC_CTRL_002_003',
  'ACC_CTRL_003_004',
  'ACC_CTRL_004_001',
]

const CONTROLLER_UPIS = {
  'ACC_CTRL_001_002': { upi:'9800000001@paytm', ip:'49.36.100.50', isp:'Jio Mobile', amount:9500 },
  'ACC_CTRL_002_003': { upi:'8700000002@ybl',   ip:'122.161.50.10', isp:'Airtel Broadband', amount:5000 },
  'ACC_CTRL_003_004': { upi:'7600000003@okaxis', ip:'185.220.101.1', isp:'NordVPN', amount:25000 },
  'ACC_CTRL_004_001': { upi:'6500000004@ibl',   ip:'49.204.100.20', isp:'BSNL', amount:2500 },
}

function ScoreBar({ label, value, max=1 }) {
  const pct = Math.min(100, (value / max) * 100)
  const color = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#22c55e'
  return (
    <div style={{ marginBottom:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
        <span style={{ fontSize:12, color:'#8b8fa8' }}>{label}</span>
        <span style={{ fontSize:12, color, fontWeight:600 }}>{(value*100).toFixed(0)}%</span>
      </div>
      <div style={{ background:'#2a2d3e', borderRadius:4, height:6 }}>
        <div style={{ width:`${pct}%`, background:color, borderRadius:4, height:6,
          transition:'width 0.5s ease' }} />
      </div>
    </div>
  )
}

export default function HoneyTrapDetector() {
  const { fingerprint: fp } = useDeviceFingerprint()
  const [selectedAccount, setSelectedAccount] = useState(HONEY_TRAP_ACCOUNTS[0])
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const preset = CONTROLLER_UPIS[selectedAccount]

  async function runDetection() {
    setLoading(true)
    setError(null)
    setResult(null)

    const now = new Date().toISOString().slice(0, 19)

    // Build payload with REAL device fingerprint from browser
    const payload = {
      transaction_id: `txn_live_${Date.now()}`,
      account_id: selectedAccount,
      sender_upi: preset.upi,
      receiver_upi: `mule_${selectedAccount}@upi`,
      sender_ip: preset.ip,
      amount: preset.amount,
      timestamp: now,
      isp: preset.isp,
      device_type: fp?.cpu_cores <= 2 ? 'emulator' : 'mobile',
      is_proxy: preset.isp.toLowerCase().includes('vpn'),
      method: 'UPI',
      bank_ifsc: 'IOBA0001234',
      // ── Real device signals from browser ──
      device_fingerprint: fp?.device_fingerprint || '',
      ja3_hash: fp?.ja3_hash || '',
      webgl_renderer: fp?.webgl_renderer || '',
      screen_resolution: fp?.screen_resolution || '',
      cpu_cores: fp?.cpu_cores || 0,
      battery_level: fp?.battery_level ?? null,
      battery_charging: fp?.battery_charging ?? null,
      emulator_flags: fp?.emulator_detection?.emulator_flags || [],
    }

    try {
      const res = await api.detectHoneyTrap(payload)
      setResult(res.data)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }

  const tier = result?.risk_assessment?.confidence_tier
  const tierColor = tier === 'HIGH_CONFIDENCE' ? '#ef4444'
    : tier === 'SUSPECTED' ? '#f59e0b' : '#22c55e'

  return (
    <div style={card}>
      <h3 style={title}>🍯 Honey Trap Detection</h3>
      <p style={{ color:'#8b8fa8', fontSize:12, marginBottom:16 }}>
        Simulate controller sending money to a honey trap account. Real device fingerprint injected automatically.
      </p>

      {/* Account selector */}
      <div style={{ marginBottom:12 }}>
        <label style={label}>Select Honey Trap Account</label>
        <select value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)} style={select}>
          {HONEY_TRAP_ACCOUNTS.map(acc => (
            <option key={acc} value={acc}>{acc}</option>
          ))}
        </select>
      </div>

      {/* Preset info */}
      <div style={{ background:'#12141e', borderRadius:6, padding:10, marginBottom:12,
        fontSize:12, color:'#8b8fa8' }}>
        <div>Sender UPI: <span style={{ color:'#e0e0e0' }}>{preset.upi}</span></div>
        <div>Sender IP: <span style={{ color:'#e0e0e0' }}>{preset.ip}</span></div>
        <div>ISP: <span style={{ color:'#e0e0e0' }}>{preset.isp}</span></div>
        <div>Amount: <span style={{ color:'#e0e0e0' }}>₹{preset.amount.toLocaleString()}</span></div>
        {fp && <div>Device FP: <span style={{ color:'#f59e0b', fontFamily:'monospace' }}>{fp.device_fingerprint}</span></div>}
        {fp && <div>JA3 Hash: <span style={{ color:'#f59e0b', fontFamily:'monospace' }}>{fp.ja3_hash}</span></div>}
      </div>

      <button onClick={runDetection} disabled={loading} style={btn}>
        {loading ? 'Running Detection...' : '▶ Run Controller Attribution'}
      </button>

      {error && <div style={{ color:'#ef4444', marginTop:12, fontSize:13 }}>Error: {error}</div>}

      {result && (
        <div style={{ marginTop:16 }}>
          {/* Confidence banner */}
          <div style={{ background: tier === 'HIGH_CONFIDENCE' ? '#3f1515' : '#1f2a15',
            border:`2px solid ${tierColor}`, borderRadius:8, padding:12, marginBottom:16 }}>
            <div style={{ color:tierColor, fontWeight:700, fontSize:16 }}>
              {tier === 'HIGH_CONFIDENCE' ? '🚨 CONTROLLER IDENTIFIED' :
               tier === 'SUSPECTED' ? '⚠ SUSPECTED CONTROLLER' : '✓ UNRELATED TRANSACTION'}
            </div>
            <div style={{ color:'#e0e0e0', fontSize:24, fontWeight:700, marginTop:4 }}>
              {(result.risk_assessment.composite_score * 100).toFixed(1)}% Confidence
            </div>
            <div style={{ color:'#8b8fa8', fontSize:12, marginTop:4 }}>
              Matched: {result.controller_name} ({result.matched_cluster})
            </div>
            <div style={{ color:'#8b8fa8', fontSize:12 }}>
              Action: <span style={{ color:tierColor }}>{result.risk_assessment.recommended_action}</span>
            </div>
          </div>

          {/* Signal breakdown */}
          <h4 style={{ color:'#fff', marginBottom:10, fontSize:14 }}>Signal Breakdown</h4>
          {Object.entries(result.risk_assessment.signal_breakdown || {}).map(([key, data]) => (
            <ScoreBar key={key} label={key.replace(/_/g,' ')} value={data.value} />
          ))}

          {/* Geo data */}
          {result.geo_data && (
            <div style={{ marginTop:16 }}>
              <h4 style={{ color:'#fff', marginBottom:8, fontSize:14 }}>IP Geolocation</h4>
              <div style={{ background:'#12141e', borderRadius:6, padding:10, fontSize:12 }}>
                <div>City: <span style={{ color:'#e0e0e0' }}>{result.geo_data.city}, {result.geo_data.state}</span></div>
                <div>ISP: <span style={{ color:'#e0e0e0' }}>{result.geo_data.isp}</span></div>
                <div>Proxy: <span style={{ color: result.geo_data.proxy ? '#ef4444' : '#22c55e' }}>
                  {result.geo_data.proxy ? 'YES — VPN/Proxy Detected' : 'No'}
                </span></div>
                <div>Coordinates: <span style={{ color:'#e0e0e0' }}>{result.geo_data.lat}, {result.geo_data.lon}</span></div>
              </div>
            </div>
          )}

          {/* Alert flags */}
          {result.alert?.evidence?.flags?.length > 0 && (
            <div style={{ marginTop:12 }}>
              <h4 style={{ color:'#fff', marginBottom:8, fontSize:14 }}>Security Flags</h4>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {result.alert.evidence.flags.map(f => (
                  <span key={f} style={{ background:'#3f1515', color:'#ef4444',
                    fontSize:11, padding:'3px 8px', borderRadius:4, border:'1px solid #ef4444' }}>
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const card = { background:'#1a1d27', border:'1px solid #2a2d3e', borderRadius:8, padding:20, marginBottom:16 }
const title = { color:'#fff', fontSize:16, fontWeight:600, marginBottom:8 }
const label = { display:'block', color:'#8b8fa8', fontSize:12, marginBottom:6 }
const select = { width:'100%', background:'#12141e', border:'1px solid #2a2d3e',
  color:'#e0e0e0', padding:'8px 10px', borderRadius:6, fontSize:13 }
const btn = { background:'#3b5bdb', color:'#fff', border:'none', padding:'10px 20px',
  borderRadius:6, cursor:'pointer', fontSize:14, fontWeight:600, width:'100%' }
