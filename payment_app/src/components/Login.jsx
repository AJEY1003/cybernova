import { useState } from 'react'

export const USERS = [
  { id: 'CTRL_001', name: 'Arjun Mehta',  upi: '9800000001@paytm', role: 'Controller', balance: 100000, avatar: 'A', isController: true },
  { id: 'MULE_001', name: 'Ravi Kumar',   upi: '9123456001@paytm', role: 'Mule 1',     balance: 0,      avatar: 'R', isController: false },
  { id: 'MULE_002', name: 'Priya Singh',  upi: '9123456002@paytm', role: 'Mule 2',     balance: 0,      avatar: 'P', isController: false },
  { id: 'MULE_003', name: 'Suresh Nair',  upi: '9123456003@paytm', role: 'Mule 3',     balance: 0,      avatar: 'S', isController: false },
  { id: 'MULE_004', name: 'Deepa Rao',    upi: '9123456004@paytm', role: 'Mule 4',     balance: 0,      avatar: 'D', isController: false },
  { id: 'MULE_005', name: 'Kiran Patel',  upi: '9123456005@paytm', role: 'Mule 5',     balance: 0,      avatar: 'K', isController: false },
]

export default function Login({ onLogin }) {
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  function handleLogin() {
    if (!selected) { setError('Select an account to continue'); return }
    if (pin !== '1234') { setError('Incorrect PIN — use 1234'); return }
    onLogin({ ...selected })
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-secondary/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-2xl relative z-10">
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="font-headline font-black text-5xl tracking-tighter text-primary neon-glow-text drop-shadow-[0_0_12px_rgba(255,45,120,0.8)]">
            NEON BANK
          </h1>
          <p className="font-label text-on-surface-variant text-xs tracking-[0.3em] uppercase mt-2">
            Secure Payment Platform
          </p>
        </div>

        {/* Card */}
        <div className="bg-surface-container rounded-2xl p-8 neon-border">
          <p className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase mb-5">
            Select Account
          </p>

          {/* User grid */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            {USERS.map(u => (
              <button key={u.id} onClick={() => { setSelected(u); setError('') }}
                className={`flex items-center gap-3 p-4 rounded-xl border transition-all duration-200 text-left ${
                  selected?.id === u.id
                    ? u.isController
                      ? 'border-primary bg-primary/10 shadow-[0_0_16px_rgba(255,45,120,0.2)]'
                      : 'border-secondary bg-secondary/10 shadow-[0_0_16px_rgba(0,255,204,0.1)]'
                    : 'border-outline-variant bg-surface-container-low hover:border-outline hover:bg-surface-container'
                }`}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{
                    background: u.isController
                      ? 'linear-gradient(135deg, #ff2d78, #b3004e)'
                      : '#1e1e30',
                    color: u.isController ? '#1a0010' : '#e8e0f0',
                    boxShadow: u.isController ? '0 0 12px rgba(255,45,120,0.4)' : 'none'
                  }}>
                  {u.avatar}
                </div>
                <div className="min-w-0">
                  <p className="text-on-surface text-sm font-medium truncate font-headline">{u.name}</p>
                  <p className={`text-xs font-label tracking-wider ${u.isController ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {u.role}
                  </p>
                </div>
                {selected?.id === u.id && (
                  <span className="material-symbols-outlined ml-auto text-lg"
                    style={{ color: u.isController ? '#ff2d78' : '#00ffcc' }}>
                    check_circle
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* PIN */}
          <div className="mb-6">
            <label className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase block mb-3">
              Enter PIN
            </label>
            <div className="flex gap-3 justify-center mb-4">
              {[0,1,2,3].map(i => (
                <div key={i} className="w-12 h-12 border border-outline-variant rounded-lg bg-surface-container-lowest flex items-center justify-center text-2xl text-primary neon-glow-text">
                  {pin.length > i ? '●' : ''}
                </div>
              ))}
            </div>
            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
              {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => (
                <button key={i} onClick={() => {
                  if (k === '⌫') setPin(p => p.slice(0,-1))
                  else if (k !== '' && pin.length < 4) setPin(p => p + k)
                }}
                  className={`h-12 rounded-lg text-sm font-label font-medium transition-all duration-150 ${
                    k === '' ? 'invisible' :
                    'bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high hover:border-primary hover:shadow-[0_0_8px_rgba(255,45,120,0.2)] active:scale-95'
                  }`}>
                  {k}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-error-container/30 border border-error/30 rounded-lg">
              <span className="material-symbols-outlined text-error text-lg">error</span>
              <p className="text-error text-sm font-body">{error}</p>
            </div>
          )}

          <button onClick={handleLogin}
            className="w-full py-3.5 bg-primary text-on-primary font-label font-bold text-sm tracking-widest uppercase rounded-lg hover:shadow-[0_0_20px_rgba(255,45,120,0.6)] active:scale-95 transition-all">
            ACCESS ACCOUNT
          </button>
        </div>

        <p className="text-center text-on-surface-variant text-xs font-body mt-4">
          Demo PIN: 1234 · No real money involved
        </p>
      </div>
    </div>
  )
}
