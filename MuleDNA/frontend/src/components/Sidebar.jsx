import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Network,
  CreditCard, 
  ShieldCheck, 
  ArrowRightLeft, 
  LogOut,
  Zap,
  Bot
} from 'lucide-react';

const Sidebar = () => {
  const menuItems = [
    { icon: Network, label: 'Overview', path: '/' },
    { icon: CreditCard, label: 'Transactions', path: '/transactions' },
    { icon: ArrowRightLeft, label: 'Payments', path: '/transfer' },
    { icon: ShieldCheck, label: 'Security Center', path: '/security' },
    { icon: Bot, label: 'Forensic AI Chat', path: '/chat' },
  ];

  return (
    <aside className="w-64 h-screen bg-[#060B14] border-r border-[#152033] flex flex-col pt-8 pb-4 relative z-20">
      <div className="px-6 mb-10 flex items-center gap-3">
        <div className="w-10 h-10 bg-[#0B1324] border border-[#1E293B] rounded-xl flex items-center justify-center text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
          <Zap size={22} fill="currentColor" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-200 tracking-tight">MuleDNA</h1>
          <p className="text-[10px] text-blue-500/80 font-medium tracking-[0.2em] uppercase">Simulated Bank</p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 text-sm font-medium border ${
                isActive 
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-[inset_0_0_20px_rgba(59,130,246,0.05)]' 
                  : 'border-transparent text-slate-400 hover:bg-[#0B1324] hover:text-slate-200 hover:border-[#1E293B]'
              }`
            }
          >
            <item.icon size={18} className={({ isActive }) => isActive ? 'text-blue-400' : 'text-slate-500'} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 mt-auto">
        <div className="p-4 bg-[#0B1324] border border-[#152033] rounded-2xl mb-4 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#152033] border border-[#1E293B] flex items-center justify-center text-slate-300 font-bold text-xs">
              PA
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-200">Priya Admin</div>
              <div className="text-[10px] font-medium text-emerald-500/80 tracking-widest uppercase">Sec Analyst</div>
            </div>
          </div>
          <button className="w-full flex items-center justify-center gap-2 text-rose-500/80 hover:text-rose-400 text-xs font-semibold tracking-wider uppercase transition-colors">
            <LogOut size={14} />
            Disconnect
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
