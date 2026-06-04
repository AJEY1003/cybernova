import { useState, useEffect } from 'react'
import axios from 'axios'

export default function Transactions({ user }) {
  const [txns, setTxns] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const fetch = () => axios.get(`/api/upi/transactions?upi=${user.upi}&limit=50`)
      .then(r => { setTxns(r.data.transactions || []); setLoading(false) })
      .catch(() => setLoading(false))
    fetch()
    const iv = setInterval(fetch, 5000)
    return () => clearInterval(iv)
  }, [user.upi])

  const filtered = filter === 'all' ? txns
    : filter === 'sent' ? txns.filter(t => t.sender_upi === user.upi)
    : txns.filter(t => t.receiver_upi === user.upi)

  const verdictColor = (v) => v === 'BLOCKED_ACCOUNT_HIT' ? '#ff4444'
    : v === 'CONTROLLER_IDENTIFIED' ? '#ff2d78'
    : v === 'SUSPECTED_MULE_TRANSACTION' ? '#ffe04a'
    : '#00ffcc'

  return (
    <div className="slide-up">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="font-label text-primary text-[10px] tracking-[0.2em] uppercase mb-2 neon-glow-text">Financial Ledger</p>
          <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight">Transactions</h1>
          <p className="font-body text-on-surface-variant text-sm mt-1">Real-time consolidated history</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-secondary pulse-cyan"></span>
          <span className="font-label text-[10px] text-secondary uppercase tracking-widest">Live</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {['all', 'sent', 'received'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg font-label text-[10px] tracking-widest uppercase transition-all ${
              filter === f
                ? 'bg-primary text-on-primary shadow-[0_0_12px_rgba(255,45,120,0.4)]'
                : 'bg-surface-container border border-outline-variant text-on-surface-variant hover:border-outline'
            }`}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface-container rounded-2xl border border-outline-variant/20 overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-outline-variant/20 bg-surface-container-high/50">
          {['Transaction', 'From / To', 'Amount', 'Time', 'Status'].map(h => (
            <p key={h} className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase">{h}</p>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-4xl text-outline animate-spin block mb-3">progress_activity</span>
            <p className="font-body text-on-surface-variant text-sm">Loading...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <span className="material-symbols-outlined text-4xl text-outline block mb-3">receipt_long</span>
            <p className="font-body text-on-surface-variant text-sm">No transactions yet</p>
          </div>
        ) : (
          filtered.map((t, i) => {
            const isSent = t.sender_upi === user.upi
            const verdict = t.verdict || 'CLEAN'
            const vc = verdictColor(verdict)
            return (
              <div key={i} className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-high/30 transition-colors cursor-pointer">
                {/* ID */}
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSent ? 'bg-primary/10' : 'bg-secondary/10'}`}>
                    <span className={`material-symbols-outlined text-sm ${isSent ? 'text-primary' : 'text-secondary'}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}>
                      {isSent ? 'call_made' : 'call_received'}
                    </span>
                  </div>
                  <span className="font-mono text-on-surface-variant text-xs truncate">{t.transaction_id?.slice(-8) || '—'}</span>
                </div>
                {/* From/To */}
                <div>
                  <p className="font-headline font-bold text-on-surface text-sm truncate">{isSent ? t.receiver_upi : t.sender_upi}</p>
                  <p className="font-body text-on-surface-variant text-xs">{isSent ? 'Sent to' : 'Received from'}</p>
                </div>
                {/* Amount */}
                <div>
                  <p className={`font-headline font-bold ${isSent ? 'text-primary' : 'text-secondary'}`}>
                    {isSent ? '-' : '+'}₹{t.amount?.toLocaleString('en-IN')}
                  </p>
                </div>
                {/* Time */}
                <div>
                  <p className="font-body text-on-surface text-sm">{t.timestamp?.slice(11, 16) || '—'}</p>
                  <p className="font-body text-on-surface-variant text-xs">{t.timestamp?.slice(0, 10) || '—'}</p>
                </div>
                {/* Status */}
                <div>
                  <span className="font-label text-[9px] px-2 py-1 rounded uppercase tracking-tighter"
                    style={{ background: `${vc}15`, color: vc, border: `1px solid ${vc}30` }}>
                    {verdict === 'CLEAN' ? 'Completed' : verdict.replace(/_/g, ' ')}
                  </span>
                  {t.razorpay_order_id && (
                    <p className="font-mono text-outline text-[10px] mt-1">{t.razorpay_order_id?.slice(-8)}</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
