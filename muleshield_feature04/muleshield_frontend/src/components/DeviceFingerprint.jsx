/**
 * DeviceFingerprint.jsx
 * Displays real device fingerprint collected from the browser.
 * This is what makes device detection REAL — not simulated.
 */
import { useDeviceFingerprint } from '../hooks/useDeviceFingerprint'

const Row = ({ label, value, highlight }) => (
  <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 0',
    borderBottom:'1px solid #2a2d3e' }}>
    <span style={{ color:'#8b8fa8', fontSize:13 }}>{label}</span>
    <span style={{ color: highlight ? '#f59e0b' : '#e0e0e0', fontSize:13,
      fontFamily:'monospace', maxWidth:'60%', textAlign:'right', wordBreak:'break-all' }}>
      {value ?? '—'}
    </span>
  </div>
)

export default function DeviceFingerprint() {
  const { fingerprint: fp, loading } = useDeviceFingerprint()

  if (loading) return (
    <div style={card}>
      <h3 style={title}>Device Fingerprint</h3>
      <p style={{ color:'#8b8fa8' }}>Collecting real device signals...</p>
    </div>
  )

  const em = fp.emulator_detection
  const emColor = em.is_emulator ? '#ef4444' : '#22c55e'

  return (
    <div style={card}>
      <h3 style={title}>🔬 Real Device Fingerprint</h3>
      <p style={{ color:'#8b8fa8', fontSize:12, marginBottom:12 }}>
        Collected live from your browser — no simulation
      </p>

      {/* Emulator status banner */}
      <div style={{ background: em.is_emulator ? '#3f1515' : '#153f1f',
        border:`1px solid ${emColor}`, borderRadius:6, padding:'8px 12px', marginBottom:12 }}>
        <span style={{ color: emColor, fontWeight:600 }}>
          {em.is_emulator ? '⚠ EMULATOR DETECTED' : '✓ REAL DEVICE'}
        </span>
        {em.emulator_flags.length > 0 && (
          <div style={{ marginTop:4 }}>
            {em.emulator_flags.map(f => (
              <span key={f} style={{ background:'#ef4444', color:'#fff', fontSize:11,
                padding:'2px 6px', borderRadius:3, marginRight:4 }}>{f}</span>
            ))}
          </div>
        )}
      </div>

      <Row label="Device Fingerprint" value={fp.device_fingerprint} highlight />
      <Row label="JA3 Session Hash" value={fp.ja3_hash} highlight />
      <Row label="Canvas Hash" value={fp.canvas_hash} />
      <Row label="WebGL Vendor" value={fp.webgl_vendor} />
      <Row label="WebGL Renderer" value={fp.webgl_renderer} />
      <Row label="Screen Resolution" value={fp.screen_resolution} />
      <Row label="CPU Cores" value={fp.cpu_cores} />
      <Row label="Device Memory" value={fp.device_memory_gb ? `${fp.device_memory_gb} GB` : 'Not available'} />
      <Row label="Platform" value={fp.platform} />
      <Row label="Timezone" value={fp.timezone} />
      <Row label="Language" value={fp.language} />
      <Row label="Battery Level" value={fp.battery_level !== null ? `${(fp.battery_level*100).toFixed(0)}%` : 'Not available'} />
      <Row label="Battery Charging" value={fp.battery_charging !== null ? String(fp.battery_charging) : 'Not available'} />
      <Row label="Emulator Risk Score" value={em.emulator_risk_score?.toFixed(2)} highlight={em.emulator_risk_score > 0.3} />
    </div>
  )
}

const card = {
  background:'#1a1d27', border:'1px solid #2a2d3e',
  borderRadius:8, padding:20, marginBottom:16
}
const title = { color:'#fff', fontSize:16, fontWeight:600, marginBottom:12 }
