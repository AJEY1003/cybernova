import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  ShieldCheck, 
  Users, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from 'lucide-react';
import { fraudApi, WS_URL } from '../services/api';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const Home = () => {
  const [stats, setStats] = useState({
    totalAccounts: 0,
    highRisk: 0,
    alerts: [],
    recentTransactions: []
  });
  const [wsMessage, setWsMessage] = useState('Listening for live network signals...');

  useEffect(() => {
    // Initial data fetch
    const fetchData = async () => {
      try {
        const [txs, alerts] = await Promise.all([
          fraudApi.getTransactions(),
          fraudApi.getAlerts()
        ]);
        setStats(prev => ({
          ...prev,
          recentTransactions: txs.data.slice(-5).reverse(),
          alerts: alerts.data.filter(a => a.risk_level !== 'LOW').slice(0, 5),
          totalAccounts: [...new Set(txs.data.map(t => t.sender))].length,
          highRisk: alerts.data.filter(a => a.risk_level === 'HIGH').length
        }));
      } catch (err) {
        console.error("Failed to fetch initial stats", err);
      }
    };
    fetchData();

    // WS Connection for real-time alerts
    const ws = new WebSocket(WS_URL);
    ws.onmessage = (event) => setWsMessage(event.data);
    return () => ws.close();
  }, []);

  const data = [
    { name: 'Mon', value: 400 },
    { name: 'Tue', value: 300 },
    { name: 'Wed', value: 600 },
    { name: 'Thu', value: 800 },
    { name: 'Fri', value: 500 },
    { name: 'Sat', value: 900 },
    { name: 'Sun', value: 1100 },
  ];

  // Dynamic Pie Data based on real highRisk stats
  const total = stats.totalAccounts || 100; // prevent divide by zero
  const safeCount = Math.max(0, total - stats.highRisk);
  
  const pieData = [
    { name: 'Safe', value: safeCount, color: '#10b981' },
    { name: 'High Risk', value: stats.highRisk, color: '#f43f5e' },
  ];

  const getRiskColor = (level) => {
    if (level === 'HIGH') return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    if (level === 'MEDIUM') return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-200 tracking-tight">Financial Overview</h1>
          <p className="text-slate-500 font-medium mt-1">Real-time monitoring of your bank's liquidity and security.</p>
        </div>
        <div className="flex gap-2">
          <div className="px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold uppercase tracking-widest glow-emerald">
            LIVE MONITORING ON
          </div>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-panel p-6 rounded-2xl group hover:border-blue-500/50 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-10 h-10 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/20 group-hover:bg-blue-500 group-hover:text-white group-hover:glow-blue transition-all duration-300">
              <TrendingUp size={20} />
            </div>
            <div className="flex items-center text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg text-xs font-bold">
              <ArrowUpRight size={14} className="mr-1" /> 12%
            </div>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 relative z-10">Total Liquidity</p>
          <h3 className="text-3xl font-semibold text-slate-200 relative z-10">₹ 14.2M</h3>
        </div>

        <div className="glass-panel p-6 rounded-2xl group hover:border-rose-500/50 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-10 h-10 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center border border-rose-500/20 group-hover:bg-rose-500 group-hover:text-white group-hover:glow-rose transition-all duration-300">
              <AlertTriangle size={20} />
            </div>
            {stats.highRisk > 0 && (
              <span className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-lg text-xs font-bold animate-pulse">CRITICAL</span>
            )}
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 relative z-10">Risk Flagged</p>
          <h3 className="text-3xl font-semibold text-slate-200 relative z-10">{stats.highRisk} <span className="text-slate-500 text-sm">Accounts</span></h3>
        </div>

        <div className="glass-panel p-6 rounded-2xl group hover:border-emerald-500/50 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-white group-hover:glow-emerald transition-all duration-300">
              <ShieldCheck size={20} />
            </div>
            <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-lg text-xs font-bold">HEALTHY</span>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 relative z-10">Scanned Today</p>
          <h3 className="text-3xl font-semibold text-slate-200 relative z-10">4,129 <span className="text-slate-500 text-sm">Tx</span></h3>
        </div>

        <div className="glass-panel p-6 rounded-2xl group hover:border-slate-400/50 transition-all duration-300 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div className="w-10 h-10 bg-[#1E293B] text-slate-400 rounded-xl flex items-center justify-center border border-[#334155] group-hover:bg-slate-700 group-hover:text-white transition-all duration-300">
              <Users size={20} />
            </div>
          </div>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1 relative z-10">Active Accounts</p>
          <h3 className="text-3xl font-semibold text-slate-200 relative z-10">{stats.totalAccounts}</h3>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-panel p-8 rounded-3xl relative">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-semibold text-slate-200">Transaction Volume</h2>
            <div className="flex gap-2">
              <button className="px-4 py-1.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold">Weekly</button>
              <button className="px-4 py-1.5 bg-[#0B1324] text-slate-500 border border-[#1E293B] rounded-lg text-xs font-bold hover:bg-[#1E293B] hover:text-slate-300 transition-colors">Monthly</button>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12, fontWeight: 500}} dy={10} />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{backgroundColor: '#0B1324', borderColor: '#1E293B', borderRadius: '12px', color: '#f1f5f9'}}
                  cursor={{stroke: '#3b82f6', strokeWidth: 1, strokeDasharray: '4 4'}}
                />
                <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-3xl flex flex-col items-center relative">
          <h2 className="text-lg font-semibold text-slate-200 w-full mb-8">Risk Distribution</h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  innerRadius={70}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{backgroundColor: '#0B1324', borderColor: '#1E293B', borderRadius: '12px', color: '#f1f5f9'}}
                  itemStyle={{color: '#f1f5f9'}}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-4 w-full mt-4">
            {pieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{backgroundColor: item.color}}></div>
                  <span className="text-sm font-medium text-slate-400">{item.name}</span>
                </div>
                <span className="text-sm font-semibold text-slate-200">
                  {stats.totalAccounts > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Signals & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12">
        <div className="glass-panel p-8 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
          <h2 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
            <Activity className="text-blue-500" size={20} />
            MuleDNA Live Event Stream
          </h2>
          <div className="bg-[#060B14] p-6 rounded-2xl border border-[#1E293B] h-48 flex items-center justify-center font-mono text-sm overflow-hidden relative shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 left-0 w-1 p-0.5 h-full flex flex-col items-center">
                <div className="w-full h-1/2 bg-blue-500/50 animate-pulse rounded-t"></div>
                <div className="w-full h-1/2 bg-transparent rounded-b"></div>
            </div>
            <p className="text-blue-400 font-medium px-4 text-center leading-relaxed">
              <span className="text-slate-500 mr-2">&gt;</span>
              {wsMessage}
              <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse"></span>
            </p>
          </div>
        </div>

        <div className="glass-panel p-8 rounded-3xl relative">
          <h2 className="text-lg font-semibold text-slate-200 mb-6 flex items-center gap-2">
            <AlertTriangle className="text-rose-500" size={20} />
            Security Alerts
          </h2>
          <div className="space-y-3">
            {stats.alerts.map((alert, i) => {
              const riskColor = getRiskColor(alert.risk_level);
              return (
                <div key={alert.id || i} className={`flex items-center gap-4 p-4 bg-[#0B1324] hover:bg-[#1E293B]/50 rounded-xl transition-colors border ${alert.risk_level === 'HIGH' ? 'border-rose-500/30' : 'border-[#1E293B]'}`}>
                  <div className={`w-8 h-8 focus:outline-none rounded-lg flex items-center justify-center flex-shrink-0 border ${riskColor}`}>
                    <AlertTriangle size={14} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-200">Account Flagged: <span className="text-slate-400 font-mono text-[10px]">{alert.account_id}</span></p>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight mt-1">{alert.reason || "Suspicious transaction chain detected"}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded inline-block border ${riskColor}`}>
                      {alert.risk_level} RISK
                    </p>
                  </div>
                </div>
              );
            })}
            {stats.alerts.length === 0 && (
              <div className="h-48 flex items-center justify-center">
                <p className="text-slate-500 font-medium italic text-sm">No critical security threats found in the active stream.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
