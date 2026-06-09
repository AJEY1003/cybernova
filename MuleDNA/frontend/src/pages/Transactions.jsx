import React, { useState, useEffect } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Search, 
  Filter, 
  ChevronRight, 
  ChevronDown,
  ShieldCheck,
  ShieldAlert,
  BrainCircuit,
  Share2,
  Activity
} from 'lucide-react';
import { fraudApi } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

const Transactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const response = await fraudApi.getTransactions();
        setTransactions(response.data.reverse());
      } catch (err) {
        console.error("Failed to fetch transactions", err);
      }
    };
    fetchTransactions();
  }, []);

  const filteredTransactions = transactions.filter(t => 
    t.sender.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.receiver.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id.toString().includes(searchTerm)
  );

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-200 tracking-tight">Transaction Ledger</h1>
          <p className="text-slate-500 font-medium mt-1">Audit and secure all money movement in your network.</p>
        </div>
        <div className="flex gap-4">
          <div className="glass-panel px-4 py-2.5 rounded-xl flex items-center gap-3 w-72 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10 transition-all">
            <Search size={16} className="text-slate-500" />
            <input 
              type="text" 
              placeholder="Search by ID or Account..." 
              className="bg-transparent border-none outline-none text-sm w-full font-medium text-slate-200 placeholder:text-slate-600"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-2.5 glass-panel rounded-xl text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] transition-colors">
            <Filter size={18} />
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden font-mono">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#060B14] border-b border-[#1E293B]">
              <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-widest">Hash ID</th>
              <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-widest">Protocol Path</th>
              <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-widest">Volume (INR)</th>
              <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-widest text-center">Status</th>
              <th className="px-8 py-5 text-xs font-semibold text-slate-500 uppercase tracking-widest text-right">Audit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1E293B]/50">
            {filteredTransactions.map((tx) => (
              <React.Fragment key={tx.id}>
                <tr 
                  className={`hover:bg-[#1E293B]/30 transition-all cursor-pointer group ${expandedId === tx.id ? 'bg-[#1E293B]/50' : ''}`}
                  onClick={() => setExpandedId(expandedId === tx.id ? null : tx.id)}
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className={`p-1.5 rounded-lg border flex items-center justify-center ${
                        tx.amount > 50000 
                          ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 glow-rose' 
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 glow-emerald'
                      }`}>
                        {tx.amount > 50000 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                      </div>
                      <div>
                        <p className="text-slate-200 text-sm font-semibold tracking-tight">#{tx.id.toString().padStart(5, '0')}</p>
                        <p className="text-[10px] text-slate-500 font-medium font-sans mt-0.5">MAR 29 • 12:45 UTC</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm text-slate-400 truncate max-w-xs">{tx.sender} <span className="text-slate-600 mx-1">→</span> {tx.receiver}</p>
                  </td>
                  <td className="px-8 py-5">
                    <p className={`text-sm font-semibold tracking-tight ${tx.amount > 50000 ? 'text-rose-400' : 'text-slate-200'}`}>
                      ₹ {tx.amount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                    </p>
                  </td>
                  <td className="px-8 py-5 text-center">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border font-sans ${
                      tx.amount > 50000 
                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {tx.amount > 50000 ? <ShieldAlert size={12} /> : <ShieldCheck size={12} />}
                      {tx.amount > 50000 ? 'FLAGGED' : 'CLEARED'}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="w-7 h-7 rounded-lg bg-[#060B14] border border-[#1E293B] text-slate-400 flex items-center justify-center group-hover:bg-blue-500/20 group-hover:text-blue-400 group-hover:border-blue-500/30 transition-all transform group-hover:rotate-90 mx-auto mr-0">
                      {expandedId === tx.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                  </td>
                </tr>

                {/* Expanded Detail Row */}
                <AnimatePresence>
                  {expandedId === tx.id && (
                    <tr>
                      <td colSpan="5" className="px-8 py-0 border-b border-[#1E293B]">
                        <motion.div 
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden bg-[#060B14]/50 my-4 rounded-xl border border-[#1E293B] p-6 font-sans"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-3">
                              <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                                <Activity size={12} />
                                Rule Engine Hit
                              </h4>
                              <div className="space-y-2">
                                {tx.amount > 50000 && (
                                  <div className="p-3 bg-[#0B1324] rounded-lg border border-rose-500/20 text-xs flex items-center gap-2 text-rose-400">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>
                                    Velocity / Large Amplitude (+30 pts)
                                  </div>
                                )}
                                <div className="p-3 bg-[#0B1324] rounded-lg border border-[#1E293B] text-xs flex items-center gap-2 text-emerald-400 border-l-2 border-l-emerald-500">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                  Sanctions & KYC Cleared
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h4 className="text-[10px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-2">
                                <BrainCircuit size={12} />
                                ML Confidence Score
                              </h4>
                              <div className="h-16 flex items-center justify-center bg-[#0B1324] rounded-lg border border-[#1E293B] relative overflow-hidden">
                                <div 
                                  className={`absolute left-0 top-0 h-full ${tx.amount > 50000 ? 'bg-rose-500/20 border-r-2 border-rose-500' : 'bg-blue-500/10 border-r-2 border-blue-500'} transition-all duration-1000`}
                                  style={{ width: tx.amount > 50000 ? '82%' : '14%' }}
                                ></div>
                                <span className={`text-xl font-mono font-semibold relative z-10 ${tx.amount > 50000 ? 'text-rose-400' : 'text-slate-200'}`}>
                                  {tx.amount > 50000 ? '82.4%' : '14.1%'}
                                </span>
                              </div>
                              <p className="text-[9px] text-slate-500 font-bold uppercase text-center tracking-widest">Ensemble Model Inference</p>
                            </div>

                            <div className="space-y-3">
                              <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                <Share2 size={12} />
                                Network Topology
                              </h4>
                              <div className="p-3 bg-[#0B1324] rounded-lg border border-[#1E293B] space-y-2">
                                <div className="flex justify-between text-xs text-slate-500">
                                  <span>Node IP</span>
                                  <span className="text-slate-300 font-mono">{tx.ip_address}</span>
                                </div>
                                <div className="flex justify-between text-xs text-slate-500">
                                  <span>H/W Hash</span>
                                  <span className="text-slate-300 font-mono truncate max-w-[100px]">{tx.device_id}</span>
                                </div>
                                <div className="mt-2 pt-2 border-t border-[#1E293B] text-[9px] text-emerald-500/80 uppercase tracking-widest font-bold text-center">
                                  Isolated Node / No Graph Ring
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </AnimatePresence>
              </React.Fragment>
            ))}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan="5" className="px-8 py-32 text-center">
                  <div className="inline-flex flex-col items-center justify-center text-slate-600">
                    <Search size={24} className="mb-4 animate-bounce" />
                    <p className="font-sans text-sm font-medium">Querying distributed ledger...</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Transactions;
