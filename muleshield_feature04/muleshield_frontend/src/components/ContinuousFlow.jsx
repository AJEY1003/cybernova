/**
 * ContinuousFlow.jsx
 * The main demo flow:
 * Step 1: Send a transaction → analyze across network
 * Step 2: System detects mule cluster → blocks accounts
 * Step 3: Controller sends to honey trap → full attribution
 * Step 4: Controller identified → alert generated
 */
import { useState } from 'react'
import { api } from '../api'
import { useDeviceFingerprint } from '../hooks/useDeviceFingerprint'

// Preset transactions simulating different controller scenarios
const PRESETS = [
  {
    label: 'Night Owl → Mule (₹9,500)',
    sender_upi: '9800000001@paytm',
    receiver_upi: 'mule_acc@paytm',
    sender_ip: '49.36.100.50',
    amount: 9500,
    isp: 'Jio Mobile',
    is_proxy: false,
    device_type: 'mobile',
  },
  {
    label: 'Splitter → Mule (₹5,000)',
    sender_upi: '8700000002@ybl',
    receiver_upi: 'mule_split@ybl',
    sender_ip: '122.161.50.10',
    amount: 5000,
    isp: 'Airtel Broadband',
    is_proxy: false,
    device_type: 'broadband',
  },
  {
    label: 'Ghost → Mule via VPN (₹25,000)',
    sender_upi: '7600000003@okaxis',
    receiver_upi: 'mule_ghost@okaxis',
    sender_ip: '185.220.101.1',
    amount: 25000,
    isp: 'NordVPN',
    is_proxy: true,
    device_type: 'mobile',
  },
  {
    label: 'Local → Mule (₹2,500)',
    sender_upi: '6500000004@ibl',
    receiver_upi: 'mule_local@ibl',
    sender_ip: '49.204.100.20',
    amount: 2500,
    isp: 'BSNL',
    is_proxy: false,
    device_type: 'mobile',
  },
]

// Honey trap presets — controller sending to honey trap account
const HONEY_TRAP_PRESETS = [
  {
    label: 'Night Owl hits Honey Trap',
    sender_upi: '9800000001@paytm',
    receiver_upi: 'ACC_CTRL_001_002@upi',
    sender_ip: '49.36.100.50',
    amount: 9500,
    isp: 'Jio Mobile',
    is_proxy: false,
    device_type: 'mobile',
  },
  {
    label: 'Ghost hits Honey Trap (VPN)',
    sender_upi: '7600000003@okaxis',
    receiver_upi: 'ACC_CTRL_003_004@upi',
    sender_ip: '185.220.101.1',
    amount: 25000,
    isp: 'NordVPN',
    is_proxy: true,
    device_type: 'mobile',
  },
]

function Step({ number, title, active, done }) {
  const color = done ? '#22c55e' : active ? '#3b5bdb' : '#2a2d3e'
  const textColor = done ? '#22c55e' : active ? '#fff' : '#8b8fa8'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0,
      }}>
        {done ? '✓' : number}
      </div>
      <span style={{ color: textColor, fontSize: 13 }}>{title}</span>
    </div>
  )
}

function SignalBar({ label, value }) {
  const pct = Math.min(100, (value || 0) * 100)
  const color = pct > 80 ? '#ef4444' : pct > 50 ? '#f59e0b' : '#22c55e'
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 11, color: '#8b8fa8' }}>{label.replace(/_/g, ' ')}</span>
        <span style={{ fontSize: 11, color, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
      </div>
      <div style={{ background: '#2a2d3e', borderRadius: 3, height: 5 }}>
        <div style={{ width: `${pct}%`, background: color, borderRadius: 3, height: 5 }} />
      </div>
    </div>
  )
}

export default function ContinuousFlow() {
  const { fingerprint: fp } = useDeviceFingerprint()

  const [step, setStep] = useState(0)
  const [analyzeResult, setAnalyzeResult] = useState(null)
  const [blockResult, setBlockResult] = useState(null)
  const [controllerResult, setControllerResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [selectedPreset, setSelectedPreset] = useState(0)
  const [selectedHtPreset, setSelectedHtPreset] = useState(0)

  function buildPayload(preset) {
    return {
      ...preset,
      device_fingerprint: fp?.device_fingerprint || '',
      ja3_hash: fp?.ja3_hash || '',
      webgl_renderer: fp?.webgl_renderer || '',
      screen_resolution: fp?.screen_resolution || '',
      cpu_cores: fp?.cpu_cores || 0,
      battery_level: fp?.battery_level ?? null,
      battery_charging: fp?.battery_charging ?? null,
      emulator_flags: fp?.emulator_detection?.emulator_flags || [],
    }
  }

  async function runStep1() {
    setLoading(true)
    setError(null)
    try {
      const payload = buildPayload(PRESETS[selectedPreset])
      const r = await fetch('/api/razorpay/pay-and-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (data.detail) throw new Error(data.detail)
      setAnalyzeResult(data)
      setStep(1)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function runStep2() {
    const clusterId = analyzeResult?.mule_network?.cluster_id
    if (!clusterId) return
    setLoading(true)
    try {
      const r = await fetch(`/api/network/block-cluster/${clusterId}`, { method: 'POST' })
      const data = await r.json()
      setBlockResult(data)
      setStep(2)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function runStep3() {
    setLoading(true)
    setError(null)
    try {
      const payload = buildPayload(HONEY_TRAP_PRESETS[selectedHtPreset])
      const r = await fetch('/api/razorpay/pay-and-detect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (data.detail) throw new Error(data.detail)
      setControllerResult(data)
      setStep(3)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setStep(0)
    setAnalyzeResult(null)
    setBlockResult(null)
    setControllerResult(null)
    setError(null)
  }

  const tier = controllerResult?.detection?.confidence_tier
  const tierColor = tier === 'HIGH_CONFIDENCE' ? '#ef4444'
    : tier === 'SUSPECTED' ? '#f59e0b' : '#22c55e'

  return (
    <div style={card}>
      <h3 style={title}>🔄 Continuous Detection Flow</h3>
      <p style={{ color: '#8b8fa8', fontSize: 12, marginBottom: 16 }}>
        Full pipeline: Transaction → Analyze → Block Mules → Trap Controller → Identify
      </p>

      {/* Progress steps */}
      <div style={{ background: '#12141e', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <Step number={1} title="Incoming transaction analyzed across network" active={step === 0} done={step > 0} />
        <Step number={2} title="Mule cluster detected → accounts blocked, honey trap set" active={step === 1} done={step > 1} />
        <Step number={3} title="Controller sends to honey trap → attribution running" active={step === 2} done={step > 2} />
        <Step number={4} title="Controller identified → LEA alert generated" active={step === 3} done={false} />
      </div>

      {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>Error: {error}</div>}

      {/* ── STEP 1 ── */}
      {step === 0 && (
        <div>
          <label style={lbl}>Select Transaction Scenario</label>
          <select value={selectedPreset} onChange={e => setSelectedPreset(+e.target.value)} style={sel}>
            {PRESETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
          </select>
          <div style={{ background: '#12141e', borderRadius: 6, padding: 10, marginBottom: 12, fontSize: 12, color: '#8b8fa8' }}>
            <div>Sender UPI: <span style={{ color: '#e0e0e0' }}>{PRESETS[selectedPreset].sender_upi}</span></div>
            <div>IP: <span style={{ color: '#e0e0e0' }}>{PRESETS[selectedPreset].sender_ip}</span></div>
            <div>ISP: <span style={{ color: '#e0e0e0' }}>{PRESETS[selectedPreset].isp}</span></div>
            <div>Amount: <span style={{ color: '#e0e0e0' }}>₹{PRESETS[selectedPreset].amount.toLocaleString()}</span></div>
            <div>Proxy: <span style={{ color: PRESETS[selectedPreset].is_proxy ? '#ef4444' : '#22c55e' }}>
              {PRESETS[selectedPreset].is_proxy ? 'YES' : 'No'}
            </span></div>
            {fp && <div style={{ marginTop: 6, color: '#f59e0b' }}>
              Real Device FP: {fp.device_fingerprint} | JA3: {fp.ja3_hash}
            </div>}
          </div>
          <button onClick={runStep1} disabled={loading} style={btnPrimary}>
            {loading ? 'Analyzing...' : '▶ Step 1: Analyze Transaction'}
          </button>
        </div>
      )}

      {/* ── STEP 1 RESULT ── */}
      {step >= 1 && analyzeResult && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ background: '#12141e', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ color: '#a5b4fc', fontWeight: 600, marginBottom: 8 }}>Step 1 Result — Razorpay Order Created + Detection</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
              <div>
                Verdict: <span style={{
                  color: analyzeResult.detection?.verdict === 'CLEAN' ? '#22c55e'
                    : analyzeResult.detection?.verdict === 'CONTROLLER_IDENTIFIED' ? '#ef4444' : '#f59e0b',
                  fontWeight: 700
                }}>{analyzeResult.detection?.verdict}</span>
              </div>
              <div>Confidence: <span style={{ color: '#e0e0e0' }}>
                {((analyzeResult.detection?.confidence_score || 0) * 100).toFixed(1)}%
              </span></div>
              <div>Cluster: <span style={{ color: '#a5b4fc' }}>
                {analyzeResult.mule_network?.cluster_id} — {analyzeResult.mule_network?.controller_name}
              </span></div>
              <div>Proxy: <span style={{ color: analyzeResult.controller?.proxy_used ? '#ef4444' : '#22c55e' }}>
                {analyzeResult.controller?.proxy_used ? 'DETECTED' : 'Clean'}
              </span></div>
            </div>
            {analyzeResult.razorpay?.order_id && (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                <span style={{ color: '#22c55e' }}>✓ Razorpay Order Live: </span>
                <span style={{ color: '#e0e0e0', fontFamily: 'monospace' }}>{analyzeResult.razorpay.order_id}</span>
                <span style={{ color: '#8b8fa8' }}> — ₹{analyzeResult.razorpay.amount_inr?.toLocaleString()} — {analyzeResult.razorpay.status}</span>
              </div>
            )}
          </div>
          {step === 1 && (
            <button onClick={runStep2} disabled={loading} style={btnPrimary}>
              {loading ? 'Blocking...' : '▶ Step 2: Block Mule Accounts'}
            </button>
          )}
        </div>
      )}

      {/* ── STEP 2 RESULT ── */}
      {step >= 2 && blockResult && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ background: '#12141e', borderRadius: 8, padding: 12, marginBottom: 12 }}>
            <div style={{ color: '#a5b4fc', fontWeight: 600, marginBottom: 8 }}>Step 2 Result — Accounts Blocked</div>
            <div style={{ fontSize: 13 }}>
              <div style={{ color: '#ef4444', marginBottom: 6 }}>
                🔒 {blockResult.blocked_count} accounts BLOCKED
              </div>
              {blockResult.blocked_accounts?.map(acc => (
                <span key={acc} style={{ background: '#3f1515', color: '#ef4444',
                  fontSize: 11, padding: '2px 8px', borderRadius: 4, marginRight: 6, marginBottom: 4,
                  display: 'inline-block' }}>{acc}</span>
              ))}
              <div style={{ marginTop: 8, color: '#f59e0b' }}>
                🍯 Honey Trap Active: {blockResult.honey_trap}
              </div>
            </div>
          </div>
          {step === 2 && (
            <div>
              <label style={lbl}>Select Controller Honey Trap Scenario</label>
              <select value={selectedHtPreset} onChange={e => setSelectedHtPreset(+e.target.value)} style={sel}>
                {HONEY_TRAP_PRESETS.map((p, i) => <option key={i} value={i}>{p.label}</option>)}
              </select>
              <button onClick={runStep3} disabled={loading} style={{ ...btnPrimary, background: '#7c3aed' }}>
                {loading ? 'Detecting...' : '▶ Step 3: Controller Sends to Honey Trap'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3 RESULT — CONTROLLER IDENTIFIED ── */}
      {step >= 3 && controllerResult && (
        <div>
          <div style={{
            background: tier === 'HIGH_CONFIDENCE' ? '#3f1515' : '#1f2a15',
            border: `2px solid ${tierColor}`, borderRadius: 8, padding: 16, marginBottom: 16
          }}>
            <div style={{ color: tierColor, fontWeight: 700, fontSize: 18, marginBottom: 4 }}>
              {tier === 'HIGH_CONFIDENCE' ? '🚨 CONTROLLER IDENTIFIED' : '⚠ SUSPECTED CONTROLLER'}
            </div>
            <div style={{ color: '#fff', fontSize: 28, fontWeight: 700 }}>
              {((controllerResult.detection?.confidence_score || 0) * 100).toFixed(1)}% Confidence
            </div>
            <div style={{ color: '#8b8fa8', fontSize: 12, marginTop: 4 }}>
              {controllerResult.mule_network?.controller_name} | {controllerResult.mule_network?.cluster_id}
            </div>
          </div>

          {/* Controller details */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div style={infoCard}>
              <div style={infoTitle}>Controller Identity</div>
              <InfoRow label="UPI Handle" value={controllerResult.controller?.upi_handle} highlight />
              <InfoRow label="IP Address" value={controllerResult.controller?.ip_address} />
              <InfoRow label="ISP" value={controllerResult.controller?.isp} />
              <InfoRow label="Proxy Used" value={controllerResult.controller?.proxy_used ? 'YES ⚠' : 'No'} highlight={controllerResult.controller?.proxy_used} />
              <InfoRow label="Device FP" value={controllerResult.controller?.device_fingerprint?.slice(0, 16) + '...'} />
              <InfoRow label="JA3 Hash" value={controllerResult.controller?.ja3_hash?.slice(0, 16) + '...'} />
              <InfoRow label="Emulator" value={controllerResult.controller?.emulator_used ? 'DETECTED ⚠' : 'No'} highlight={controllerResult.controller?.emulator_used} />
              <InfoRow label="ASN" value={controllerResult.controller?.asn} />
              <InfoRow label="Infra Type" value={controllerResult.controller?.infra_type} />
            </div>

            <div style={infoCard}>
              <div style={infoTitle}>Location Intelligence</div>
              <InfoRow label="City" value={controllerResult.controller?.location?.city} />
              <InfoRow label="State" value={controllerResult.controller?.location?.state} />
              <InfoRow label="Country" value={controllerResult.controller?.location?.country} />
              <InfoRow label="Coordinates" value={`${controllerResult.controller?.location?.lat}, ${controllerResult.controller?.location?.lon}`} />
              <InfoRow label="Location Reliable" value={controllerResult.controller?.location?.reliable ? 'Yes' : 'NO — VPN'} highlight={!controllerResult.controller?.location?.reliable} />
            </div>
          </div>

          {/* Mule network */}
          <div style={{ ...infoCard, marginBottom: 16 }}>
            <div style={infoTitle}>Mule Network</div>
            <div style={{ fontSize: 12 }}>
              <div style={{ marginBottom: 6 }}>
                Total Mule Accounts: <span style={{ color: '#e0e0e0' }}>{controllerResult.mule_network?.total_accounts}</span>
              </div>
              <div style={{ marginBottom: 6 }}>
                Blocked:
                {controllerResult.mule_network?.blocked_accounts?.map(acc => (
                  <span key={acc} style={{ background: '#3f1515', color: '#ef4444',
                    fontSize: 11, padding: '2px 6px', borderRadius: 3, marginLeft: 6 }}>{acc}</span>
                ))}
              </div>
              <div>
                Honey Trap: <span style={{ color: '#f59e0b', fontFamily: 'monospace' }}>
                  {controllerResult.mule_network?.honey_trap}
                </span>
              </div>
            </div>
          </div>

          {/* Signal breakdown */}
          <div style={{ ...infoCard, marginBottom: 16 }}>
            <div style={infoTitle}>Signal Breakdown</div>
            {Object.entries(controllerResult.signal_breakdown || {}).map(([k, v]) => (
              <SignalBar key={k} label={k} value={v?.value} />
            ))}
          </div>

          {/* Razorpay order */}
          {controllerResult.razorpay?.order_id && (
            <div style={{ background: '#0f2a1a', border: '1px solid #22c55e', borderRadius: 6,
              padding: 10, marginBottom: 16, fontSize: 12 }}>
              <div style={{ color: '#22c55e', fontWeight: 600, marginBottom: 4 }}>
                ✓ Razorpay Order Live on Dashboard
              </div>
              <div>Order ID: <span style={{ color: '#e0e0e0', fontFamily: 'monospace' }}>{controllerResult.razorpay.order_id}</span></div>
              <div>Amount: <span style={{ color: '#e0e0e0' }}>₹{controllerResult.razorpay.amount_inr?.toLocaleString()}</span></div>
              <div>Status: <span style={{ color: '#e0e0e0' }}>{controllerResult.razorpay.status}</span></div>
              <div style={{ marginTop: 4 }}>
                <a href={controllerResult.razorpay.dashboard_url} target="_blank" rel="noreferrer"
                  style={{ color: '#3b5bdb', fontSize: 11 }}>
                  View on Razorpay Dashboard →
                </a>
              </div>
            </div>
          )}

          {/* LEA Alert */}
          <div style={{ background: '#1a0a2e', border: '1px solid #a855f7', borderRadius: 6, padding: 12, marginBottom: 16 }}>
            <div style={{ color: '#a855f7', fontWeight: 600, marginBottom: 6 }}>
              📋 LEA Alert Generated
            </div>
            <div style={{ fontSize: 12, color: '#8b8fa8' }}>
              Reference: <span style={{ color: '#e0e0e0' }}>{controllerResult.alert?.lea_reference}</span>
            </div>
            <div style={{ fontSize: 12, color: '#8b8fa8' }}>
              Action: <span style={{ color: tierColor }}>{controllerResult.detection?.recommended_action}</span>
            </div>
          </div>

          <button onClick={reset} style={{ ...btnPrimary, background: '#374151' }}>
            ↺ Reset — Run Again
          </button>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0',
      borderBottom: '1px solid #2a2d3e', fontSize: 12 }}>
      <span style={{ color: '#8b8fa8' }}>{label}</span>
      <span style={{ color: highlight ? '#f59e0b' : '#e0e0e0', fontFamily: 'monospace',
        maxWidth: '55%', textAlign: 'right', wordBreak: 'break-all' }}>{value ?? '—'}</span>
    </div>
  )
}

const card = { background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8, padding: 20, marginBottom: 16 }
const title = { color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 8 }
const lbl = { display: 'block', color: '#8b8fa8', fontSize: 12, marginBottom: 6 }
const sel = { width: '100%', background: '#12141e', border: '1px solid #2a2d3e',
  color: '#e0e0e0', padding: '8px 10px', borderRadius: 6, fontSize: 13, marginBottom: 12 }
const btnPrimary = { background: '#3b5bdb', color: '#fff', border: 'none', padding: '10px 20px',
  borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600, width: '100%', marginBottom: 8 }
const infoCard = { background: '#12141e', borderRadius: 6, padding: 12 }
const infoTitle = { color: '#a5b4fc', fontSize: 12, fontWeight: 600, marginBottom: 8,
  textTransform: 'uppercase', letterSpacing: 1 }
