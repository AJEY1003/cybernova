/**
 * CyberSecPanel.jsx
 * Tests all cybersecurity detection modules:
 * - Device reuse
 * - Geo-velocity (impossible travel)
 * - Session correlation
 * - ASN intelligence (live IP lookup)
 */
import { useState } from 'react'
import { api } from '../api'
import axios from 'axios'

// No external chart libs — using plain CSS bars

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <h4 style={{ color:'#a5b4fc', fontSize:13, marginBottom:8, textTransform:'uppercase',
        letterSpacing:1 }}>{title}</h4>
      {children}
    </div>
  )
}

function ResultBox({ data, error }) {
  if (error) return <div style={{ color:'#ef4444', fontSize:12 }}>Error: {error}</div>
  if (!data) return null
  return (
    <pre style={{ background:'#12141e', borderRadius:6, padding:10, fontSize:11,
      color:'#e0e0e0', overflow:'auto', maxHeight:200 }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

export default function CyberSecPanel() {
  const [deviceReuse, setDeviceReuse] = useState(null)
  const [geoVelocity, setGeoVelocity] = useState(null)
  const [sessionCorr, setSessionCorr] = useState(null)
  const [asnResult, setAsnResult] = useState(null)
  const [ipInput, setIpInput] = useState('49.36.100.1')
  const [loading, setLoading] = useState({})
  const [errors, setErrors] = useState({})

  async function run(key, fn) {
    setLoading(l => ({ ...l, [key]: true }))
    setErrors(e => ({ ...e, [key]: null }))
    try {
      const r = await fn()
      return r.data
    } catch (e) {
      setErrors(err => ({ ...err, [key]: e.message }))
      return null
    } finally {
      setLoading(l => ({ ...l, [key]: false }))
    }
  }

  async function testASN() {
    const data = await run('asn', () => axios.get(`/api/cybersecurity/asn-lookup?ip=${ipInput}`))
    // Fallback: call ip-api directly if endpoint not available
    if (!data) {
      try {
        const r = await axios.get(`http://ip-api.com/json/${ipInput}?fields=status,country,regionName,city,isp,org,as,mobile,proxy,hosting,query`)
        setAsnResult(r.data)
      } catch (e) {
        setErrors(err => ({ ...err, asn: e.message }))
      }
    } else {
      setAsnResult(data)
    }
  }

  return (
    <div style={card}>
      <h3 style={title}>🛡 Cybersecurity Intelligence Tests</h3>

      <Section title="Device Reuse Detection">
        <p style={{ color:'#8b8fa8', fontSize:12, marginBottom:8 }}>
          Detects same physical device operating multiple mule accounts.
        </p>
        <button onClick={async () => setDeviceReuse(await run('dr', api.deviceReuse))}
          disabled={loading.dr} style={btn}>
          {loading.dr ? 'Running...' : 'Run Device Reuse Analysis'}
        </button>
        {deviceReuse && (
          <div style={{ marginTop:8 }}>
            <div style={{ color:'#f59e0b', fontSize:13, marginBottom:6 }}>
              Reuse Groups Found: {deviceReuse.total_reuse_groups}
            </div>
            {deviceReuse.reuse_groups?.slice(0,3).map((g, i) => (
              <div key={i} style={{ background:'#12141e', borderRadius:6, padding:8,
                marginBottom:6, fontSize:12 }}>
                <div style={{ color:'#f59e0b' }}>FP: {g.fingerprint}</div>
                <div style={{ color:'#e0e0e0' }}>Accounts: {g.accounts.join(', ')}</div>
                <div style={{ color:'#8b8fa8' }}>Reuse count: {g.reuse_count}</div>
              </div>
            ))}
          </div>
        )}
        <ResultBox error={errors.dr} />
      </Section>

      <Section title="Geo-Velocity (Impossible Travel)">
        <p style={{ color:'#8b8fa8', fontSize:12, marginBottom:8 }}>
          Detects same controller appearing in two distant locations within minutes.
        </p>
        <button onClick={async () => setGeoVelocity(await run('gv', api.geoVelocity))}
          disabled={loading.gv} style={btn}>
          {loading.gv ? 'Running...' : 'Run Geo-Velocity Analysis'}
        </button>
        {geoVelocity && (
          <div style={{ marginTop:8 }}>
            <div style={{ color: geoVelocity.violation_count > 0 ? '#ef4444' : '#22c55e',
              fontSize:13, marginBottom:6 }}>
              Violations: {geoVelocity.violation_count}
            </div>
            {geoVelocity.violations?.slice(0,3).map((v, i) => (
              <div key={i} style={{ background:'#12141e', borderRadius:6, padding:8,
                marginBottom:6, fontSize:12 }}>
                <div style={{ color:'#ef4444' }}>{v.flag}</div>
                <div style={{ color:'#e0e0e0' }}>
                  {v.event_1?.city} → {v.event_2?.city}
                </div>
                <div style={{ color:'#8b8fa8' }}>
                  {v.distance_km} km in {v.time_diff_minutes} min
                  ({v.speed_km_per_min} km/min)
                </div>
              </div>
            ))}
          </div>
        )}
        <ResultBox error={errors.gv} />
      </Section>

      <Section title="Session Fingerprint Correlation">
        <p style={{ color:'#8b8fa8', fontSize:12, marginBottom:8 }}>
          Finds JA3 session hashes shared across multiple mule accounts.
        </p>
        <button onClick={async () => setSessionCorr(await run('sc', api.sessionCorrelation))}
          disabled={loading.sc} style={btn}>
          {loading.sc ? 'Running...' : 'Run Session Correlation'}
        </button>
        {sessionCorr && (
          <div style={{ marginTop:8, fontSize:12 }}>
            <div style={{ color:'#a5b4fc', marginBottom:6 }}>
              Total sessions: {sessionCorr.total_sessions} |
              Correlated: {sessionCorr.correlated_sessions}
            </div>
            {sessionCorr.correlated_session_details?.slice(0,3).map((s, i) => (
              <div key={i} style={{ background:'#12141e', borderRadius:6, padding:8, marginBottom:6 }}>
                <div style={{ color:'#f59e0b' }}>JA3: {s.ja3_hash?.slice(0,16)}...</div>
                <div style={{ color:'#e0e0e0' }}>Accounts: {s.accounts?.join(', ')}</div>
                <div style={{ color:'#8b8fa8' }}>Transactions: {s.transaction_count}</div>
              </div>
            ))}
          </div>
        )}
        <ResultBox error={errors.sc} />
      </Section>

      <Section title="ASN Intelligence (Live IP Lookup)">
        <p style={{ color:'#8b8fa8', fontSize:12, marginBottom:8 }}>
          Real-time IP → ASN → infrastructure type classification.
        </p>
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          <input value={ipInput} onChange={e => setIpInput(e.target.value)}
            placeholder="Enter IP address"
            style={{ flex:1, background:'#12141e', border:'1px solid #2a2d3e',
              color:'#e0e0e0', padding:'8px 10px', borderRadius:6, fontSize:13 }} />
          <button onClick={testASN} disabled={loading.asn} style={btn}>
            {loading.asn ? '...' : 'Lookup'}
          </button>
        </div>
        {asnResult && (
          <div style={{ background:'#12141e', borderRadius:6, padding:10, fontSize:12 }}>
            <div>City: <span style={{ color:'#e0e0e0' }}>{asnResult.city}, {asnResult.regionName}</span></div>
            <div>ISP: <span style={{ color:'#e0e0e0' }}>{asnResult.isp}</span></div>
            <div>ASN: <span style={{ color:'#a5b4fc' }}>{asnResult.as}</span></div>
            <div>Proxy: <span style={{ color: asnResult.proxy ? '#ef4444' : '#22c55e' }}>
              {asnResult.proxy ? 'YES' : 'No'}
            </span></div>
            <div>Hosting: <span style={{ color: asnResult.hosting ? '#f59e0b' : '#22c55e' }}>
              {asnResult.hosting ? 'YES — Datacenter/Hosting' : 'No'}
            </span></div>
            <div>Mobile: <span style={{ color:'#e0e0e0' }}>{String(asnResult.mobile)}</span></div>
          </div>
        )}
        <ResultBox error={errors.asn} />
      </Section>
    </div>
  )
}

const card = { background:'#1a1d27', border:'1px solid #2a2d3e', borderRadius:8, padding:20, marginBottom:16 }
const title = { color:'#fff', fontSize:16, fontWeight:600, marginBottom:16 }
const btn = { background:'#1e3a5f', color:'#a5b4fc', border:'1px solid #3b5bdb',
  padding:'8px 16px', borderRadius:6, cursor:'pointer', fontSize:13 }
