import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Users, 
  Network, 
  Map, 
  Activity, 
  Fingerprint,
  Share2,
  Trash2,
  ScanSearch,
  ShieldCheck
} from 'lucide-react';
import { fraudApi } from '../services/api';
import NetworkVisualizer from '../components/NetworkVisualizer';

const SecurityCenter = () => {
  const [clusters, setClusters] = useState([]);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [clusterRes, graphRes] = await Promise.all([
          fraudApi.getClusters(),
          fraudApi.getGraphData()
        ]);
        setClusters(clusterRes.data.clusters);
        setGraphData(graphRes.data);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch security data", err);
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  const handleSync = async () => {
    try {
      setLoading(true);
      await fraudApi.syncGraph();
      const [clusterRes, graphRes] = await Promise.all([
        fraudApi.getClusters(),
        fraudApi.getGraphData()
      ]);
      setClusters(clusterRes.data.clusters);
      setGraphData(graphRes.data);
      setLoading(false);
    } catch (err) {
      alert("Graph Sync Failed");
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in zoom-in-95 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-200 tracking-tight">Security & AML Center</h1>
          <p className="text-slate-500 font-medium mt-1">Detecting syndicated fraud networks and money laundering rings.</p>
        </div>
        <button 
          onClick={handleSync}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm tracking-wide hover:bg-blue-500 transition-all glow-blue disabled:bg-slate-700 disabled:text-slate-500 disabled:shadow-none"
        >
          <Network size={18} />
          {loading ? 'SYNCING GRAPH...' : 'SYNC NEO4J GRAPH'}
        </button>
      </div>

      {/* Network Graph Visualization */}
      <section className="glass-panel p-8 rounded-3xl relative overflow-hidden">
        <h2 className="text-xl font-semibold text-slate-200 mb-6 flex items-center gap-2">
          <Map className="text-blue-500" size={20} />
          Global Account Topology
          <span className="ml-2 text-[10px] bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">
            Live Graph
          </span>
        </h2>
        {loading && graphData.nodes.length === 0 ? (
          <div className="w-full h-[500px] flex items-center justify-center bg-[#060B14] rounded-2xl border border-[#1E293B]">
             <div className="text-sm font-bold text-slate-500 animate-pulse tracking-widest">MAPING NODE REPO...</div>
          </div>
        ) : (
          <NetworkVisualizer data={graphData} />
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Statistics Columns */}
        <div className="lg:col-span-2 space-y-8">
          <section className="glass-panel p-8 rounded-3xl relative overflow-hidden">
            <h2 className="text-xl font-semibold text-slate-200 mb-6 flex items-center gap-2">
              <Users className="text-rose-500" size={20} />
              Mule Ring Candidates
              <span className="ml-2 text-[10px] bg-rose-500/10 text-rose-500 border border-rose-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest font-bold">
                {clusters.length} Found
              </span>
            </h2>

            <div className="space-y-4">
              {clusters.map((cluster, i) => (
                <div key={i} className="p-6 bg-[#060B14] rounded-2xl border border-[#1E293B] hover:border-rose-500/30 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                  
                  <div className="flex items-start justify-between mb-4 relative z-10">
                    <div>
                      <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <Share2 size={10} /> Shared Hardware Hash
                      </p>
                      <h3 className="text-lg font-mono tracking-tight text-slate-200 leading-tight group-hover:text-rose-400 transition-colors cursor-pointer">{cluster.shared_device}</h3>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Cluster Density</p>
                      <span className="text-2xl font-semibold text-rose-400">{cluster.accounts.length} <span className="text-base text-slate-500">Nodes</span></span>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[#1E293B] relative z-10">
                    {cluster.accounts.map((acc, idx) => (
                      <div key={acc} className="px-3 py-1 bg-[#152033] border border-[#1E293B] text-slate-300 font-mono text-xs rounded-lg hover:border-blue-500/30 hover:text-blue-400 transition-colors cursor-pointer flex items-center gap-2">
                        <span className="text-slate-600 text-[9px]">{idx + 1}.</span>
                        {acc}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2 text-rose-500 bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20 text-[10px] font-bold uppercase tracking-widest glow-rose">
                      <ShieldAlert size={12} />
                      SYNDICATED FRAUD RISK
                    </div>
                    <button className="text-blue-500 text-[10px] font-bold uppercase tracking-widest hover:text-blue-400 flex items-center gap-1 transition-colors">
                      <ScanSearch size={14} />
                      Trace Path
                    </button>
                  </div>
                </div>
              ))}
              {clusters.length === 0 && !loading && (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto glow-emerald">
                    <ShieldCheck size={32} />
                  </div>
                  <p className="text-emerald-400/80 font-medium italic">No suspicious clusters detected in the network graph.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Behavioral Sidebar */}
        <div className="space-y-8">
          <section className="glass-panel p-8 rounded-3xl h-fit relative">
            <h2 className="text-xl font-semibold text-slate-200 mb-6 flex items-center gap-2">
              <Fingerprint className="text-blue-500" size={20} />
              Forensic Signals
            </h2>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <span>Login Anomaly (UTC)</span>
                  <span className="text-rose-500">8.2% SPIKE</span>
                </div>
                <div className="h-1.5 w-full bg-[#152033] rounded-full overflow-hidden flex border border-[#1E293B]">
                  <div className="h-full bg-rose-500 w-[8%] glow-rose" />
                  <div className="h-full bg-transparent w-[92%]" />
                </div>
                <p className="text-[10px] text-slate-500 font-medium uppercase leading-tight">Increased activity detected between 12:00 AM - 4:00 AM UTC.</p>
              </div>

              <div className="space-y-3 pt-6 border-t border-[#1E293B]">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <span>Device Swapping</span>
                  <span className="text-blue-500">MODERATE</span>
                </div>
                <div className="h-1.5 w-full bg-[#152033] rounded-full overflow-hidden flex border border-[#1E293B]">
                  <div className="h-full bg-blue-500 w-[42%] glow-blue" />
                  <div className="h-full bg-transparent w-[58%]" />
                </div>
                <p className="text-[10px] text-slate-500 font-medium uppercase leading-tight">42 accounts transitioned to new device hashes in the last 24h.</p>
              </div>

              <div className="space-y-3 pt-6 border-t border-[#1E293B]">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  <span>Rapid In-Out Flow</span>
                  <span className="text-emerald-500">STABLE</span>
                </div>
                <div className="h-1.5 w-full bg-[#152033] rounded-full overflow-hidden flex border border-[#1E293B]">
                  <div className="h-full bg-emerald-500 w-[15%] glow-emerald" />
                  <div className="h-full bg-transparent w-[85%]" />
                </div>
                <p className="text-[10px] text-slate-500 font-medium uppercase leading-tight">Funds typically held for &gt;24h across 85% of transactions.</p>
              </div>
            </div>

            <div className="mt-10 p-4 bg-[#0B1324] border border-[#1E293B] rounded-2xl space-y-2 relative overflow-hidden group">
              <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-center gap-2 text-blue-500 relative z-10">
                <Share2 size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Neo4j Bolt Connected</span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium leading-tight relative z-10">Graph engine tracking 1,280 accounts & 4,500 relationships in real-time.</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default SecurityCenter;
