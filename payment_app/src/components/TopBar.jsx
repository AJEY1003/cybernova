export default function TopBar({ user }) {
  return (
    <header className="fixed top-0 right-0 w-full lg:w-[calc(100%-16rem)] h-16 px-6 flex justify-between items-center bg-surface-dim/80 backdrop-blur-md border-b border-outline-variant/30 z-50 shadow-[0_4px_20px_rgba(10,10,18,0.5)]">
      {/* Brand + search */}
      <div className="flex items-center gap-6">
        <span className="font-headline font-black text-xl tracking-tighter text-primary drop-shadow-[0_0_8px_rgba(255,45,120,0.8)] lg:hidden">
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
              background: user.isController ? 'linear-gradient(135deg,#ff2d78,#b3004e)' : '#1e1e30',
              color: user.isController ? '#1a0010' : '#e8e0f0',
            }}>
            {user.avatar}
          </div>
        </div>
      </div>
    </header>
  )
}
