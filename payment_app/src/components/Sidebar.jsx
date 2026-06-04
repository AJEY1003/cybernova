export default function Sidebar({ user, page, setPage, onLogout }) {
  const nav = [
    { id: 'dashboard',    icon: 'dashboard',    label: 'Command Center' },
    { id: 'send',         icon: 'send',         label: 'Transfer' },
    { id: 'transactions', icon: 'receipt_long', label: 'Ledger' },
  ]

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 pt-16 bg-surface-container-low border-r border-outline-variant/20 shadow-[4px_0_24px_rgba(0,0,0,0.4)] hidden lg:flex flex-col py-4 gap-2 z-40">
      {/* User node */}
      <div className="px-4 mb-6 mt-4">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-high/50 border border-outline-variant/20">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold font-headline"
            style={{
              background: user.isController ? 'linear-gradient(135deg,#ff2d78,#b3004e)' : '#1e1e30',
              color: user.isController ? '#1a0010' : '#e8e0f0',
              boxShadow: user.isController ? '0 0 12px rgba(255,45,120,0.4)' : 'none'
            }}>
            {user.avatar}
          </div>
          <div>
            <p className="font-headline font-bold text-on-surface text-sm">{user.name}</p>
            <p className={`font-label uppercase text-[10px] tracking-widest ${user.isController ? 'text-primary' : 'text-on-surface-variant'}`}>
              {user.role}
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 px-3">
        {nav.map(item => (
          <button key={item.id} onClick={() => setPage(item.id)}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200 ease-in-out active:scale-95 ${
              page === item.id
                ? 'bg-primary/10 text-primary border-r-4 border-primary shadow-[inset_0_0_12px_rgba(255,45,120,0.1)]'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface hover:shadow-[0_0_15px_rgba(0,255,204,0.1)]'
            }`}>
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="font-label uppercase text-[10px] tracking-widest font-bold">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 mt-auto flex flex-col gap-1 border-t border-outline-variant/10 pt-4">
        <button onClick={() => setPage('send')}
          className="w-full mb-3 py-3 bg-primary text-on-primary rounded-lg font-label uppercase text-[11px] font-bold tracking-widest hover:shadow-[0_0_16px_rgba(255,45,120,0.6)] transition-all flex items-center justify-center gap-2">
          <span className="material-symbols-outlined text-sm">add</span>
          New Transaction
        </button>
        <button onClick={onLogout}
          className="flex items-center gap-4 px-4 py-3 rounded-lg text-on-surface-variant hover:text-error transition-all w-full">
          <span className="material-symbols-outlined">logout</span>
          <span className="font-label uppercase text-[10px] tracking-widest">Logout</span>
        </button>
      </div>
    </aside>
  )
}
