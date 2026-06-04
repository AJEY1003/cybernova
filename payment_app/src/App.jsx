import { useState } from 'react'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import SendMoney from './components/SendMoney.jsx'
import Transactions from './components/Transactions.jsx'
import Sidebar from './components/Sidebar.jsx'
import TopBar from './components/TopBar.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('dashboard')

  if (!user) return <Login onLogin={setUser} />

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar user={user} page={page} setPage={setPage} onLogout={() => { setUser(null); setPage('dashboard') }} />

      <div className="flex-1 flex flex-col lg:ml-64">
        <TopBar user={user} />
        <main className="flex-1 pt-20 px-6 pb-12 max-w-5xl mx-auto w-full">
          {page === 'dashboard'    && <Dashboard user={user} setPage={setPage} />}
          {page === 'send'         && <SendMoney user={user} />}
          {page === 'transactions' && <Transactions user={user} />}
        </main>
      </div>

      {/* Floating action button */}
      <div className="fixed bottom-10 right-10 z-40">
        <button onClick={() => setPage('send')}
          className="w-14 h-14 bg-primary rounded-full shadow-[0_0_24px_rgba(255,45,120,0.6)] flex items-center justify-center text-on-primary hover:scale-110 active:scale-95 transition-all">
          <span className="material-symbols-outlined text-3xl">add</span>
        </button>
      </div>
    </div>
  )
}
