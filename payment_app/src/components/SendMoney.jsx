import { useState, useEffect } from 'react'
import axios from 'axios'
import { useDeviceFingerprint } from '../hooks/useDeviceFingerprint'
import { USERS } from './Login.jsx'

const MULESHIELD_API = '/api'

export default function SendMoney({ user }) {
  const fp = useDeviceFingerprint()
  const [receiverUpi, setReceiverUpi] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [phone, setPhone] = useState('')
  const [step, setStep] = useState('form')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [balance, setBalance] = useState(user.balance)
  const [honeyTraps, setHoneyTraps] = useState([])
  const [honeyTrapMode, setHoneyTrapMode] = useState(false)

  useEffect(() => {
    axios.get(`/api/upi/balance?upi=${user.upi}`)
      .then(r => setBalance(r.data.balance ?? user.balance))
      .catch(() => {})
    // Fetch active honey traps from MuleShield
    axios.get(`${MULESHIELD_API}/accounts/honey-traps`)
      .then(r => setHoneyTraps(r.data?.honey_traps || []))
      .catch(() => {})
  }, [user.upi])

  const recipients = USERS.filter(u => u.upi !== user.upi)

  function activateHoneyTrapMode(ht) {
    setReceiverUpi(ht.upi_handle || ht.account_id)  // use real UPI handle
    setHoneyTrapMode(true)
    setNote(`Payment to ${ht.controller_name}`)
    setError('')
  }

  function validate() {
    if (!receiverUpi.trim()) { setError('Enter receiver UPI ID'); return false }
    if (!amount || isNaN(amount) || +amount <= 0) { setError('Enter a valid amount'); return false }
    if (+amount > balance) { setError('Insufficient balance'); return false }
    if (phone && !phone.match(/^\+?\d{10,15}$/)) { setError('Enter a valid phone number'); return false }
    return true
  }

  async function sendPayment() {
    if (!validate()) return
    setLoading(true)
    setError('')
    try {
      const payload = {
        sender_upi: user.upi,
        receiver_upi: receiverUpi,
        amount: parseFloat(amount),
        note: note || 'Payment',
        sender_phone: phone || '+917810018691',
        isp: fp?.user_agent?.includes('Mobile') ? 'Jio Mobile' : 'Broadband',
        device_type: fp?.cpu_cores <= 2 ? 'mobile' : 'broadband',
        is_proxy: false,
        device_fingerprint: fp?.device_fingerprint || '',
        ja3_hash: fp?.ja3_hash || '',
        webgl_renderer: fp?.webgl_renderer || '',
        screen_resolution: fp?.screen_resolution || '',
        cpu_cores: fp?.cpu_cores || 0,
        battery_level: fp?.battery_level ?? null,
        battery_charging: fp?.battery_charging ?? null,
        emulator_flags: fp?.emulator_flags || [],
      }
      const res = await axios.post('/api/upi/send', payload)
      setResult(res.data)
      setStep('result')
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
      setStep('form')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setStep('form'); setResult(null)
    setReceiverUpi(''); setAmount(''); setNote('')
    setError(''); setHoneyTrapMode(false)
  }

  const verdict = result?.detection?.verdict
  const isBlocked = verdict === 'BLOCKED_ACCOUNT_HIT'
  const isFlag = verdict === 'CONTROLLER_IDENTIFIED' || verdict === 'SUSPECTED_MULE_TRANSACTION'
  const isHoneyHit = result?.detection?.hits_honey_trap
  const statusColor = isBlocked ? '#ff4444' : isFlag ? '#ff2d78' : '#00ffcc'

  return (
    <div className="slide-up max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="font-label text-primary text-[10px] tracking-[0.2em] uppercase mb-2 neon-glow-text">Transfer Funds</p>
        <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight">Send Money</h1>
        <p className="font-body text-on-surface-variant text-sm mt-1">
          Balance: <span className="font-bold" style={{ color: user.isController ? '#ff2d78' : '#00ffcc' }}>
            ₹{balance.toLocaleString('en-IN')}
          </span>
        </p>
      </div>

      {/* ── FORM ── */}
      {step === 'form' && (
        <div className="bg-surface-container rounded-2xl p-8 neon-border">

          {/* 🍯 Honey Trap Simulation Panel */}
          {honeyTraps.length > 0 && (
            <div className="mb-6 p-4 rounded-xl border border-[#00e0b3]/40 bg-[#00e0b3]/5">
              <p className="font-label text-[#00e0b3] text-[10px] tracking-[0.2em] uppercase mb-3">
                🍯 Simulate Controller Attack
              </p>
              <p className="font-body text-on-surface-variant text-xs mb-3">
                Send to an active honey trap to capture controller fingerprint. MuleShield will identify the sender's device, IP, and hardware.
              </p>
              <div className="flex flex-wrap gap-2">
                {honeyTraps.map(ht => (
                  <button
                    key={ht.account_id}
                    onClick={() => activateHoneyTrapMode(ht)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-label transition-all ${
                      receiverUpi === (ht.upi_handle || ht.account_id)
                        ? 'border-[#00e0b3] bg-[#00e0b3]/15 text-[#00e0b3] shadow-[0_0_10px_rgba(0,224,179,0.3)]'
                        : 'border-[#00e0b3]/30 text-[#00e0b3]/70 hover:border-[#00e0b3]/60'
                    }`}
                  >
                    <span>🍯</span>
                    <span>{ht.controller_name}</span>
                    <span className="font-mono text-[10px] opacity-70">{(ht.upi_handle || ht.account_id).slice(0, 14)}</span>
                  </button>
                ))}
              </div>
              {honeyTrapMode && (
                <div className="mt-3 flex items-center gap-2 text-xs font-body text-[#00e0b3]/80">
                  <span className="w-2 h-2 rounded-full bg-[#00e0b3] animate-pulse" />
                  Honey trap active — your device fingerprint will be captured on send
                </div>
              )}
            </div>
          )}

          {/* Quick recipients */}
          <div className="mb-6">
            <p className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase mb-3">Quick Send</p>
            <div className="flex gap-2 flex-wrap">
              {recipients.map(r => (
                <button key={r.upi} onClick={() => setReceiverUpi(r.upi)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-label transition-all duration-200 ${
                    receiverUpi === r.upi
                      ? 'border-secondary bg-secondary/10 text-secondary shadow-[0_0_8px_rgba(0,255,204,0.2)]'
                      : 'border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-outline'
                  }`}>
                  <div className="w-6 h-6 rounded bg-surface-container-high flex items-center justify-center text-xs font-bold text-on-surface">
                    {r.avatar}
                  </div>
                  {r.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Receiver UPI */}
          <div className="mb-5">
            <label className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase block mb-2">Receiver UPI ID</label>
            <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 focus-within:border-primary focus-within:shadow-[0_0_8px_rgba(255,45,120,0.2)] transition-all">
              <span className="material-symbols-outlined text-on-surface-variant mr-3 text-lg">alternate_email</span>
              <input value={receiverUpi} onChange={e => { setReceiverUpi(e.target.value); setError('') }}
                placeholder="name@paytm / name@ybl"
                className="bg-transparent border-none text-on-surface text-sm focus:ring-0 w-full outline-none placeholder:text-on-surface-variant/40 font-body" />
            </div>
          </div>

          {/* Amount */}
          <div className="mb-5">
            <label className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase block mb-2">Amount (₹)</label>
            <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 focus-within:border-primary focus-within:shadow-[0_0_8px_rgba(255,45,120,0.2)] transition-all">
              <span className="text-primary font-headline font-bold mr-3 text-xl neon-glow-text">₹</span>
              <input type="number" value={amount} onChange={e => { setAmount(e.target.value); setError('') }}
                placeholder="0"
                className="bg-transparent border-none text-on-surface text-3xl font-headline font-bold focus:ring-0 w-full outline-none placeholder:text-on-surface-variant/30" />
            </div>
            <div className="flex gap-2 mt-2">
              {[500, 1000, 2500, 5000, 9500].map(a => (
                <button key={a} onClick={() => setAmount(String(a))}
                  className="px-3 py-1 bg-surface-container border border-outline-variant text-on-surface-variant text-xs font-label rounded hover:border-primary hover:text-primary hover:shadow-[0_0_6px_rgba(255,45,120,0.2)] transition-all">
                  ₹{a.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="mb-6">
            <label className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase block mb-2">Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Add a note..."
              className="bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 text-on-surface text-sm w-full outline-none focus:border-primary focus:shadow-[0_0_8px_rgba(255,45,120,0.2)] transition-all font-body" />
          </div>

          {/* Phone Number (For KYC update) */}
          <div className="mb-6">
            <label className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase block mb-2">Sender Phone Number (For Voice Agent)</label>
            <div className="flex items-center bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 focus-within:border-primary focus-within:shadow-[0_0_8px_rgba(255,45,120,0.2)] transition-all">
              <span className="material-symbols-outlined text-on-surface-variant mr-3 text-lg">call</span>
              <input value={phone} onChange={e => { setPhone(e.target.value); setError('') }}
                placeholder="+91..."
                className="bg-transparent border-none text-on-surface text-sm focus:ring-0 w-full outline-none placeholder:text-on-surface-variant/40 font-body" />
            </div>
            <p className="text-[9px] text-on-surface-variant mt-1 ml-1 font-body">If the voice agent is triggered for this account, it will call this number.</p>
          </div>

          {/* Device FP indicator */}
          {fp && (
            <div className="mb-4 p-3 bg-surface-container-lowest border border-outline-variant/30 rounded-lg text-xs font-body text-on-surface-variant">
              <span className="text-secondary font-label text-[10px] tracking-wider">DEVICE SECURED</span>
              <span className="ml-2 font-mono">{fp.device_fingerprint?.slice(0,12)}...</span>
              {fp.is_emulator && <span className="ml-2 text-error">⚠ Emulator</span>}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-error-container/20 border border-error/30 rounded-lg">
              <span className="material-symbols-outlined text-error text-lg">error</span>
              <p className="text-error text-sm font-body">{error}</p>
            </div>
          )}

          <button onClick={() => { if (validate()) setStep('confirm') }}
            className="w-full py-3.5 bg-primary text-on-primary font-label font-bold text-sm tracking-widest uppercase rounded-lg hover:shadow-[0_0_20px_rgba(255,45,120,0.6)] active:scale-95 transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-lg">send</span>
            PROCEED
          </button>
        </div>
      )}

      {/* ── CONFIRM ── */}
      {step === 'confirm' && (
        <div className="bg-surface-container rounded-2xl p-8 neon-border slide-up">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(255,45,120,0.2)]">
              <span className="material-symbols-outlined text-3xl text-primary">send</span>
            </div>
            <p className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase mb-2">Confirm Transfer</p>
            <p className="font-headline font-extrabold text-5xl text-on-surface neon-glow-text" style={{ color: '#ff2d78' }}>
              ₹{parseFloat(amount).toLocaleString('en-IN')}
            </p>
          </div>

          <div className="space-y-3 mb-8">
            {[
              { label: 'From', value: user.upi },
              { label: 'To', value: receiverUpi },
              { label: 'Amount', value: `₹${parseFloat(amount).toLocaleString('en-IN')}` },
              { label: 'Note', value: note || '—' },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-2 border-b border-outline-variant/30">
                <span className="font-body text-on-surface-variant text-sm">{row.label}</span>
                <span className="font-body text-on-surface text-sm font-medium">{row.value}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('form')}
              className="flex-1 py-3 border border-outline-variant text-on-surface-variant font-label text-xs tracking-widest uppercase rounded-lg hover:border-outline transition-all">
              BACK
            </button>
            <button onClick={sendPayment} disabled={loading}
              className="flex-1 py-3 bg-primary text-on-primary font-label font-bold text-xs tracking-widest uppercase rounded-lg hover:shadow-[0_0_20px_rgba(255,45,120,0.6)] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? (
                <><span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>SENDING...</>
              ) : (
                <><span className="material-symbols-outlined text-lg">check_circle</span>CONFIRM</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── RESULT ── */}
      {step === 'result' && result && (
        <div className="slide-up">
          {/* Status */}
          <div className="rounded-2xl p-8 mb-6 text-center relative overflow-hidden"
            style={{ background: '#141422', border: `1px solid ${statusColor}40`, boxShadow: `0 0 20px ${statusColor}15` }}>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: `${statusColor}15`, border: `2px solid ${statusColor}`, boxShadow: `0 0 16px ${statusColor}40` }}>
              <span className="material-symbols-outlined text-3xl" style={{ color: statusColor }}>
                {isBlocked ? 'block' : isFlag ? 'warning' : 'check_circle'}
              </span>
            </div>
            <p className="font-label text-[10px] tracking-widest uppercase mb-2" style={{ color: statusColor }}>
              {isBlocked ? 'Transaction Blocked' : isFlag ? 'Transaction Flagged' : 'Payment Sent'}
            </p>
            <p className="font-headline font-extrabold text-4xl text-on-surface neon-glow-text" style={{ color: statusColor }}>
              ₹{parseFloat(amount).toLocaleString('en-IN')}
            </p>
            <p className="font-body text-on-surface-variant text-sm mt-2">{receiverUpi}</p>
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] pointer-events-none"
              style={{ background: `${statusColor}20` }} />
          </div>

          {/* Razorpay proof */}
          {result.razorpay?.order_id && (
            <div className="bg-surface-container rounded-2xl p-5 mb-4 border border-outline-variant/20">
              <p className="font-label text-secondary text-[10px] tracking-widest uppercase mb-3">Payment Record</p>
              <div className="space-y-2">
                {[
                  { label: 'Order ID', value: result.razorpay.order_id },
                  { label: 'Status', value: result.razorpay.status },
                  { label: 'Receipt', value: result.razorpay.receipt },
                ].map(r => (
                  <div key={r.label} className="flex justify-between text-sm">
                    <span className="font-body text-on-surface-variant">{r.label}</span>
                    <span className="font-mono text-on-surface text-xs">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Internal Security/Detection details removed to simulate a real payment app */}

          <button onClick={reset}
            className="w-full py-3.5 bg-primary text-on-primary font-label font-bold text-sm tracking-widest uppercase rounded-lg hover:shadow-[0_0_20px_rgba(255,45,120,0.6)] active:scale-95 transition-all">
            NEW PAYMENT
          </button>
        </div>
      )}
    </div>
  )
}
