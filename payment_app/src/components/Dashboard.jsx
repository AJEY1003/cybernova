import { useState, useEffect } from 'react'
import axios from 'axios'

export default function Dashboard({ user, setPage }) {
  const [txns, setTxns] = useState([])
  const [balance, setBalance] = useState(user.balance)

  useEffect(() => {
    axios.get(`/api/upi/balance?upi=${user.upi}`)
      .then(r => setBalance(r.data.balance ?? user.balance))
      .catch(() => {})
    axios.get(`/api/upi/transactions?upi=${user.upi}&limit=5`)
      .then(r => setTxns(r.data.transactions || []))
      .catch(() => {})
    const iv = setInterval(() => {
      axios.get(`/api/upi/balance?upi=${user.upi}`).then(r => setBalance(r.data.balance ?? balance)).catch(() => {})
      axios.get(`/api/upi/transactions?upi=${user.upi}&limit=5`).then(r => setTxns(r.data.transactions || [])).catch(() => {})
    }, 5000)
    return () => clearInterval(iv)
  }, [user.upi])

  return (
    <div className="slide-up">
      {/* Header */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <p className="font-label text-primary text-[10px] tracking-[0.2em] uppercase mb-2 neon-glow-text">Command Center</p>
          <h1 className="font-headline font-extrabold text-4xl text-on-surface tracking-tight">{user.name}</h1>
          <p className="font-body text-on-surface-variant text-sm mt-1">{user.upi}</p>
        </div>
        <button onClick={() => setPage('send')}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-on-primary font-label text-xs font-bold uppercase tracking-widest rounded-lg hover:shadow-[0_0_16px_rgba(255,45,120,0.5)] active:scale-95 transition-all">
          <span className="material-symbols-outlined text-lg">send</span>
          Transfer
        </button>
      </div>

      {/* Balance hero */}
      <div className={`rounded-2xl p-8 mb-6 relative overflow-hidden ${user.isController ? 'neon-border' : 'neon-border-cyan'}`}
        style={{ background: 'linear-gradient(135deg, #141422 0%, #1e1e30 100%)' }}>
        <div className="relative z-10">
          <h2 className="font-label text-on-surface-variant uppercase tracking-widest text-xs mb-2">Total Balance</h2>
          <div className="flex items-baseline gap-3 mb-1">
            <span className="font-headline font-extrabold text-5xl text-on-surface neon-glow-text"
              style={{ color: user.isController ? '#ff2d78' : '#00ffcc' }}>
              ₹{balance.toLocaleString('en-IN')}
            </span>
          </div>
          <p className="font-body text-on-surface-variant text-sm mt-2">{user.upi}</p>
          <div className="flex gap-4 mt-6">
            <button onClick={() => setPage('send')}
              className="px-6 py-2.5 bg-primary rounded-lg text-on-primary font-label text-xs font-bold uppercase tracking-widest hover:shadow-[0_0_16px_rgba(255,45,120,0.5)] transition-all">
              Transfer
            </button>
            <button onClick={() => setPage('transactions')}
              className="px-6 py-2.5 bg-transparent border border-secondary rounded-lg text-secondary font-label text-xs font-bold uppercase tracking-widest hover:shadow-[0_0_16px_rgba(0,255,204,0.3)] transition-all">
              Ledger
            </button>
          </div>
        </div>
        {/* Decorative glow */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full blur-[80px] pointer-events-none"
          style={{ background: user.isController ? 'rgba(255,45,120,0.15)' : 'rgba(0,255,204,0.1)' }} />
        <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle, #302840 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { icon: 'send',           label: 'Send',    action: () => setPage('send') },
          { icon: 'receipt_long',   label: 'History', action: () => setPage('transactions') },
          { icon: 'qr_code_scanner',label: 'Scan QR', action: () => {} },
          { icon: 'account_balance',label: 'Bank',    action: () => {} },
        ].map(item => (
          <button key={item.label} onClick={item.action}
            className="flex flex-col items-center gap-2 p-4 bg-surface-container border border-outline-variant/20 rounded-xl hover:border-primary/40 hover:shadow-[0_0_12px_rgba(255,45,120,0.1)] active:scale-95 transition-all duration-200 group">
            <span className="material-symbols-outlined text-2xl text-on-surface-variant group-hover:text-primary transition-colors">{item.icon}</span>
            <span className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant group-hover:text-on-surface transition-colors">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Live activity */}
      <div className="bg-surface-container rounded-2xl p-6 border border-outline-variant/20">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="font-headline font-bold text-on-surface text-lg">Live Activity</h3>
            <p className="font-body text-xs text-on-surface-variant">Recent transaction stream</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary pulse-cyan"></span>
            <span className="font-label text-[10px] text-secondary uppercase tracking-widest">Live</span>
            <button onClick={() => setPage('transactions')} className="ml-4 text-secondary text-xs font-label uppercase tracking-widest hover:underline">
              View All
            </button>
          </div>
        </div>

        {txns.length === 0 ? (
          <div className="text-center py-10">
            <span className="material-symbols-outlined text-4xl text-outline block mb-3">receipt_long</span>
            <p className="font-body text-on-surface-variant text-sm">No transactions yet</p>
            <p className="font-body text-outline text-xs mt-1">Send money to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {txns.map((t, i) => {
              const isSent = t.sender_upi === user.upi
              const verdict = t.verdict || 'CLEAN'
              const isFlag = verdict !== 'CLEAN'
              return (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-surface-container-high/30 border border-outline-variant/10 hover:border-primary/20 transition-all cursor-pointer">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSent ? 'bg-primary/10' : 'bg-secondary/10'}`}>
                    <span className={`material-symbols-outlined ${isSent ? 'text-primary' : 'text-secondary'}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}>
                      {isSent ? 'call_made' : 'call_received'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <p className="font-headline font-bold text-on-surface text-sm">
                        {isSent ? `To: ${t.receiver_upi}` : `From: ${t.sender_upi}`}
                      </p>
                      <p className={`font-label text-xs font-bold ${isSent ? 'text-primary' : 'text-secondary'}`}>
                        {isSent ? '-' : '+'}₹{t.amount?.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="flex justify-between items-center mt-0.5">
                      <p className="font-body text-[10px] text-on-surface-variant">{t.timestamp?.slice(0, 16)}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase tracking-tighter font-label ${
                        isFlag ? 'bg-primary/20 text-primary' : 'bg-secondary/20 text-secondary'
                      }`}>
                        {isFlag ? verdict.replace(/_/g,' ') : 'Completed'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
