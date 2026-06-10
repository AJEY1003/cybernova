import { useState, useEffect } from 'react'

export default function TopBar({ user }) {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])

  return (
    <header className="fixed top-0 right-0 w-full lg:w-[calc(100%-16rem)] h-16 px-6 flex justify-between items-center bg-surface-dim/80 backdrop-blur-md border-b border-outline-variant/30 z-50 shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-colors duration-300">
      {/* Brand + search */}
      <div className="flex items-center gap-6">
        <span className="font-headline font-black text-xl tracking-tighter text-primary drop-shadow-[0_0_8px_rgba(255,45,120,0.4)] lg:hidden">
          NEON BANK
        </span>
        <div className="hidden md:flex items-center bg-surface-container rounded-lg px-3 py-1.5 border border-outline-variant/30 focus-within:border-secondary transition-all">
          <span className="material-symbols-outlined text-on-surface-variant mr-2 text-lg">search</span>
          <input className="bg-transparent border-none focus:ring-0 text-sm font-body text-on-surface w-44 outline-none placeholder:text-on-surface-variant/50"
            placeholder="Search transactions..." type="text" />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setIsDark(!isDark)}
          className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-variant rounded-full transition-all duration-300 flex items-center justify-center">
          <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
        </button>
        <button className="p-2 text-on-surface-variant hover:text-primary transition-all duration-300">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button className="p-2 text-on-surface-variant hover:text-primary transition-all duration-300">
          <span className="material-symbols-outlined">account_balance_wallet</span>
        </button>
        <div className="flex items-center gap-2 ml-2">
          <div className="text-right hidden sm:block">
            <p className="font-headline font-bold text-on-surface text-sm">{user.name}</p>
            <p className={`font-label text-[10px] tracking-widest uppercase ${user.isController ? 'text-primary' : 'text-on-surface-variant'}`}>
              {user.role}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-headline border border-outline/50"
            style={{
              background: user.isController ? 'linear-gradient(135deg,#ff2d78,#b3004e)' : 'var(--c-surface-variant)',
              color: user.isController ? '#1a0010' : 'var(--c-on-surface)',
            }}>
            {user.avatar}
          </div>
        </div>
      </div>
    </header>
  )
}

