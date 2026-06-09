import React, { useState } from 'react';
import { 
  ArrowRightLeft, 
  User, 
  ShieldCheck, 
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  History,
  Terminal
} from 'lucide-react';
import { fraudApi } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';

const Transfer = () => {
  const [formData, setFormData] = useState({
    sender: 'ACC_A',
    receiver: '',
    amount: '',
    device_id: 'DEV_BROWSER_WEB',
    ip_address: '127.0.0.1'
  });
  const [status, setStatus] = useState('idle'); // idle, loading, success, flagged
  const [fraudResult, setFraudResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.receiver || !formData.amount) return;
    
    setStatus('loading');
    try {
      const response = await fraudApi.addTransaction({
        ...formData,
        amount: parseFloat(formData.amount)
      });
      
      setTimeout(async () => {
        const alerts = await fraudApi.getAlerts();
        const latestAlert = alerts.data[0];
        
        if (latestAlert && latestAlert.account_id === formData.sender && (latestAlert.risk_level === 'HIGH' || latestAlert.risk_level === 'MEDIUM')) {
          setFraudResult(latestAlert);
          setStatus('flagged');
        } else {
          setStatus('success');
        }
      }, 1500); 
      
    } catch (err) {
      alert("Transfer protocol failed");
      setStatus('idle');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in slide-in-from-right duration-500 pb-20">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-slate-200 tracking-tight">Secure Transfer Terminal</h1>
        <p className="text-slate-500 font-medium mt-1">Execute wire transfers over encrypted channels with real-time MuleDNA tracking.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Transfer Form */}
        <section className="glass-panel p-8 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none group-hover:bg-blue-500/10 transition-colors"></div>
          
          <form className="space-y-6 relative z-10" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Source Node</label>
              <div className="flex items-center gap-4 p-4 bg-[#060B14] rounded-xl border border-[#1E293B]">
                <div className="w-10 h-10 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-lg flex items-center justify-center font-bold glow-blue">A</div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-200">Global Liquidity Pool</p>
                  <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-0.5">{formData.sender}</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Target Address</label>
              <div className="flex items-center gap-4 p-4 bg-[#060B14] rounded-xl border border-[#1E293B] focus-within:ring-2 focus-within:ring-blue-500/10 focus-within:border-blue-500/50 transition-all">
                <Terminal size={16} className="text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Enter Account ID (e.g. ACC_B)" 
                  className="bg-transparent border-none outline-none text-sm w-full font-mono text-slate-200 placeholder:text-slate-600 uppercase"
                  value={formData.receiver}
                  onChange={(e) => setFormData({...formData, receiver: e.target.value.toUpperCase()})}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Wire Amount</label>
              <div className="flex items-center gap-4 p-4 bg-[#060B14] rounded-xl border border-[#1E293B] focus-within:ring-2 focus-within:ring-emerald-500/10 focus-within:border-emerald-500/50 transition-all">
                <span className="text-lg font-semibold text-slate-500 mr-1">₹</span>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  className="bg-transparent border-none outline-none text-xl w-full font-mono font-semibold text-slate-200 placeholder:text-slate-600"
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold text-xs uppercase tracking-[0.2em] transition-all hover:bg-blue-500 active:scale-[0.98] disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed flex items-center justify-center gap-3 glow-blue relative overflow-hidden"
            >
              {status === 'loading' ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  ANALYZING SENSOR DATA...
                </>
              ) : (
                <>
                  <Zap size={16} fill="currentColor" />
                  INITIATE TRANSFER
                </>
              )}
            </button>
          </form>
        </section>

        {/* Security Result Section */}
        <div className="h-full min-h-[400px]">
          <AnimatePresence mode="wait">
            {status === 'idle' && (
              <motion.div 
                key="idle"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="bg-[#0B1324]/50 border-2 border-dashed border-[#1E293B] rounded-3xl p-10 h-full flex flex-col items-center justify-center text-center space-y-6"
              >
                <div className="w-16 h-16 bg-[#152033] rounded-2xl flex items-center justify-center text-slate-500 border border-[#1E293B] glow-blue">
                  <ShieldCheck size={32} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Real-time Pipeline Ready</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mt-2 px-8">Transactions are routed through the Kafka event stream and evaluated against our ML ensemble in &lt;800ms.</p>
                </div>
              </motion.div>
            )}

            {status === 'success' && (
              <motion.div 
                key="success"
                initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-10 h-full flex flex-col items-center justify-center text-center space-y-6 relative overflow-hidden backdrop-blur-md"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 glow-emerald"></div>
                <div className="w-20 h-20 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center justify-center glow-emerald relative z-10">
                  <CheckCircle2 size={40} />
                </div>
                <div className="relative z-10">
                  <h3 className="text-xl font-semibold text-emerald-400">Transaction Cleared</h3>
                  <p className="text-emerald-500/80 font-medium text-sm mt-2">Zero anomalies detected. Graph topology is stable.</p>
                </div>
                <button 
                  onClick={() => {setStatus('idle'); setFormData({...formData, amount: '', receiver: ''})}}
                  className="bg-emerald-500/10 text-emerald-400 px-6 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                >
                  NEW TRANSFER
                </button>
              </motion.div>
            )}

            {status === 'flagged' && (
              <motion.div 
                key="flagged"
                initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-10 h-full flex flex-col items-center justify-center text-center space-y-8 relative overflow-hidden backdrop-blur-md"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-rose-500 glow-rose animate-pulse"></div>
                <div className="w-20 h-20 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl flex items-center justify-center glow-rose animate-bounce">
                  <AlertTriangle size={40} />
                </div>
                <div className="space-y-4 w-full">
                  <h3 className="text-xl font-semibold text-rose-500">FRAUD ALERT: INTERCEPTED</h3>
                  <div className="bg-[#0B1324] p-5 rounded-xl border border-rose-500/30 text-left space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 left-0 h-full w-1 bg-rose-500"></div>
                    <p className="text-[10px] font-bold text-rose-500/80 uppercase tracking-widest flex items-center justify-between">
                      TRIGGER EVENT:
                      <span className="text-[9px] text-slate-500 bg-[#152033] px-2 py-0.5 rounded border border-[#1E293B]">HTTP 403-F</span>
                    </p>
                    <p className="text-sm font-medium text-slate-200 leading-snug">{fraudResult.reason}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setStatus('idle')}
                  className="bg-rose-500 text-white px-8 py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all hover:bg-rose-600 glow-rose"
                >
                  ACKNOWLEDGE
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Info Cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 rounded-2xl flex gap-4 items-start">
          <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Secure by Design</h4>
            <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">End-to-end telemetry and encryption via MuleDNA Core.</p>
          </div>
        </div>
        <div className="glass-panel p-6 rounded-2xl flex gap-4 items-start">
          <div className="w-10 h-10 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl flex items-center justify-center shrink-0">
            <Zap size={18} />
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Instant Clearance</h4>
            <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">Transactions execute and clear through pipelines in ~800ms.</p>
          </div>
        </div>
        <div className="glass-panel p-6 rounded-2xl flex gap-4 items-start">
          <div className="w-10 h-10 bg-[#1E293B] text-slate-400 border border-[#334155] rounded-xl flex items-center justify-center shrink-0">
            <History size={18} />
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Forensic Audit</h4>
            <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">AML compliant hashes generated out-of-the-box.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Transfer;
