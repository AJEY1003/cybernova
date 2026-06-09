import React from 'react';
import Sidebar from './Sidebar';
import { Bell, Search, ShieldAlert, Cpu } from 'lucide-react';

const Layout = ({ children }) => {
  return (
    <div className="flex bg-[#060B14] min-h-screen text-slate-300 relative overflow-hidden">
      {/* Background ambient light */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none"></div>
      
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative z-10">
        {/* Top Navbar */}
        <header className="h-20 bg-[#060B14]/80 backdrop-blur-md border-b border-[#152033] px-8 flex items-center justify-between">
          <div className="flex items-center gap-4 bg-[#0B1324] px-4 py-2.5 rounded-lg w-96 border border-[#1E293B] focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
            <Search size={16} className="text-slate-500" />
            <input 
              type="text" 
              placeholder="Query ledgers or hash IDs..." 
              className="bg-transparent border-none outline-none text-sm w-full font-medium text-slate-200 placeholder:text-slate-600" 
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0B1324] border border-[#1E293B] rounded-lg">
              <Cpu size={14} className="text-emerald-500" />
              <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">KAFKA SYNC: ON</span>
            </div>

            <div className="relative group cursor-pointer">
              <div className="w-10 h-10 bg-[#0B1324] border border-[#1E293B] rounded-lg flex items-center justify-center text-rose-500 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all">
                <ShieldAlert size={18} strokeWidth={2} />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-[#060B14] animate-pulse"></span>
            </div>
            
            <div className="w-10 h-10 bg-[#0B1324] border border-[#1E293B] rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-800 transition-colors cursor-pointer">
              <Bell size={18} />
            </div>

            <div className="h-6 w-[1px] bg-[#1E293B]"></div>

            <div className="flex items-center gap-3 cursor-pointer">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-200">Priya A.</p>
                <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Root Access</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 scrollbar-hide relative">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
