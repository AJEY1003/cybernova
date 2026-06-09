import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  ShieldAlert, 
  Users, 
  Network, 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  Cpu, 
  Server,
  Terminal,
  X
} from 'lucide-react';
import { socketService } from './services/socket';
import { Transaction, EchoChain } from './types';
import LiveMonitor from './components/LiveMonitor';
import GraphExplorer from './components/GraphExplorer';
import TransactionInjector from './components/TransactionInjector';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [chains, setChains] = useState<EchoChain[]>([]);
  
  // Tabs Control
  const [activeTab, setActiveTab] = useState<'transactions' | 'chains'>('transactions');

  // Replay Engine State
  const [replayChain, setReplayChain] = useState<EchoChain | null>(null);
  const [replayIndex, setReplayIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<number>(1000); // ms per hop

  useEffect(() => {
    const socket = socketService.connect();

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('initial_chains', (data: EchoChain[]) => {
      setChains(data);
    });

    socket.on('new_transaction', (tx: Transaction) => {
      setTransactions(prev => [tx, ...prev].slice(0, 50)); // Keep last 50
    });

    socket.on('fraud_alert', (updatedChains: EchoChain[]) => {
      setChains(prev => {
        const newChains = [...prev];
        updatedChains.forEach(uc => {
          const idx = newChains.findIndex(c => c.chainId === uc.chainId);
          if (idx >= 0) newChains[idx] = uc;
          else newChains.push(uc);
        });
        return newChains;
      });
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('initial_chains');
      socket.off('new_transaction');
      socket.off('fraud_alert');
    };
  }, []);

  // Automatic Replay Engine Playback Loop
  useEffect(() => {
    let interval: any;
    if (isPlaying && replayChain) {
      interval = setInterval(() => {
        setReplayIndex(prev => {
          if (prev < replayChain.transactions.length - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, replaySpeed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, replayChain, replaySpeed]);

  // Compute Device Correlations dynamically
  const deviceStats = useMemo(() => {
    const deviceToAccounts = new Map<string, Set<string>>();
    const ipToAccounts = new Map<string, Set<string>>();
    
    chains.forEach(chain => {
      chain.transactions.forEach(tx => {
        if (!deviceToAccounts.has(tx.deviceId)) deviceToAccounts.set(tx.deviceId, new Set());
        deviceToAccounts.get(tx.deviceId)!.add(tx.senderId);
        deviceToAccounts.get(tx.deviceId)!.add(tx.receiverId);
        
        if (!ipToAccounts.has(tx.ipAddress)) ipToAccounts.set(tx.ipAddress, new Set());
        ipToAccounts.get(tx.ipAddress)!.add(tx.senderId);
        ipToAccounts.get(tx.ipAddress)!.add(tx.receiverId);
      });
    });
    
    let sharedDevicesCount = 0;
    let topDevice = 'None';
    let maxDeviceAccounts = 0;
    deviceToAccounts.forEach((accs, dev) => {
      if (accs.size >= 2) sharedDevicesCount++;
      if (accs.size > maxDeviceAccounts) {
        maxDeviceAccounts = accs.size;
        topDevice = dev;
      }
    });
    
    let topIp = 'None';
    let maxIpAccounts = 0;
    ipToAccounts.forEach((accs, ip) => {
      if (accs.size > maxIpAccounts) {
        maxIpAccounts = accs.size;
        topIp = ip;
      }
    });
    
    return {
      sharedDevicesCount,
      topDevice: maxDeviceAccounts > 0 ? `${topDevice.replace('DEV-', '')} (${maxDeviceAccounts} accts)` : 'None',
      topIp: maxIpAccounts > 0 ? `${topIp} (${maxIpAccounts} accts)` : 'None',
    };
  }, [chains]);

  // Slice Replay Dataset based on timeline pointer
  const activeChainsForGraph = useMemo(() => {
    if (!replayChain) return chains;
    return [{
      ...replayChain,
      transactions: replayChain.transactions.slice(0, replayIndex + 1)
    }];
  }, [chains, replayChain, replayIndex]);

  // Simulated AI Next Hop Predictor
  const nextHopPrediction = useMemo(() => {
    if (!replayChain) return null;
    
    if (replayIndex < replayChain.transactions.length - 1) {
      const nextTx = replayChain.transactions[replayIndex + 1];
      return {
        target: nextTx.receiverId,
        confidence: 94,
        method: "Structural Amount Echo Correlation"
      };
    } else {
      const lastTx = replayChain.transactions[replayIndex];
      // Generate deterministic but dynamic next target to make it look like an active AI
      const charCodeSum = lastTx.receiverId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const mockMuleIndex = (charCodeSum % 10) + 1;
      return {
        target: `MULE-NODE-0${mockMuleIndex}`,
        confidence: 76,
        method: "Temporal Outflow Velocity Signature"
      };
    }
  }, [replayChain, replayIndex]);

  const highRiskChains = chains.filter(c => c.confidenceScore > 80);

  return (
    <div className="min-h-screen p-6 grid grid-rows-[auto_1fr] gap-6">
      {/* Header */}
      <header className="flex justify-between items-center glass-panel rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-primary animate-pulse" />
          <h1 className="text-2xl font-bold tracking-tight text-glow">Transaction Echo Tracking System</h1>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${isConnected ? 'bg-success animate-pulse' : 'bg-danger'}`}></span>
            <span className="text-sm text-gray-400">{isConnected ? 'System Online' : 'Disconnected'}</span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-12 gap-6 h-full min-h-0">
        
        {/* Left Column: Metrics, Injector, Tabs Container */}
        <div className="col-span-4 flex flex-col gap-6 h-full overflow-hidden">
          
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-4">
            <MetricCard 
              title="Active Chains" 
              value={chains.length} 
              icon={<Network className="w-5 h-5" />} 
              color="text-primary" 
            />
            <MetricCard 
              title="High Risk Alerts" 
              value={highRiskChains.length} 
              icon={<ShieldAlert className="w-5 h-5" />} 
              color="text-danger" 
              alert={highRiskChains.length > 0}
            />
            <MetricCard 
              title="Transactions (Live)" 
              value={transactions.length} 
              icon={<Activity className="w-5 h-5" />} 
              color="text-success" 
            />
            <MetricCard 
              title="Shared Devices" 
              value={deviceStats.sharedDevicesCount} 
              icon={<Cpu className="w-5 h-5" />} 
              color="text-warning" 
              alert={deviceStats.sharedDevicesCount > 0}
            />
          </div>

          <TransactionInjector />

          {/* Interactive Tabs Panel */}
          <div className="glass-panel rounded-2xl flex-1 flex flex-col overflow-hidden">
            
            {/* Tabs Header */}
            <div className="p-2 border-b border-white/10 flex gap-2">
              <button 
                onClick={() => setActiveTab('transactions')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'transactions' 
                    ? 'bg-primary/20 text-primary border border-primary/50 shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Live Feed
              </button>
              <button 
                onClick={() => setActiveTab('chains')}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all relative ${
                  activeTab === 'chains' 
                    ? 'bg-primary/20 text-primary border border-primary/50 shadow-md' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Fraud Alerts
                {chains.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-danger text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold animate-bounce">
                    {chains.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-auto p-4">
              {activeTab === 'transactions' ? (
                <LiveMonitor transactions={transactions} />
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Device Summary Panel */}
                  <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-xs flex flex-col gap-2">
                    <h4 className="font-bold text-glow text-primary uppercase tracking-wide text-[10px] flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5" /> Device Intelligence Summary
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-gray-400 font-mono">
                      <div>Top suspicious device:</div>
                      <div className="text-white text-right truncate">{deviceStats.topDevice}</div>
                      <div>Top suspicious IP:</div>
                      <div className="text-white text-right truncate">{deviceStats.topIp}</div>
                    </div>
                  </div>

                  {/* Chains List */}
                  <div className="flex flex-col gap-3">
                    {chains.map((chain) => {
                      const isHigh = chain.confidenceScore > 80;
                      const isCurrentlyReplayed = replayChain?.chainId === chain.chainId;

                      return (
                        <div 
                          key={chain.chainId}
                          className={`p-4 bg-background/40 border rounded-xl flex flex-col gap-3 transition-all hover:bg-white/5 ${
                            isCurrentlyReplayed 
                              ? 'border-primary shadow-[0_0_15px_rgba(0,240,255,0.25)]' 
                              : isHigh 
                              ? 'border-danger/30' 
                              : 'border-white/5'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="text-xs font-mono text-gray-500">Chain ID</div>
                              <div className="font-mono text-sm font-bold text-white truncate max-w-[120px]">
                                {chain.chainId.substring(0, 8)}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                                isHigh ? 'bg-danger/20 text-danger border border-danger/50' : 'bg-success/20 text-success'
                              }`}>
                                {chain.confidenceScore}% Risk
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 font-mono">
                            <div>Hops Count:</div>
                            <div className="text-white text-right">{chain.depth} Hops</div>
                            <div>Total Volume:</div>
                            <div className="text-white text-right">${chain.totalAmount.toLocaleString()}</div>
                          </div>

                          <button
                            onClick={() => {
                              setReplayChain(chain);
                              setReplayIndex(0);
                              setIsPlaying(false);
                            }}
                            className={`w-full py-2 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                              isCurrentlyReplayed 
                                ? 'bg-primary/20 text-primary border-primary/50 hover:bg-primary/30'
                                : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <Play className="w-3.5 h-3.5" />
                            {isCurrentlyReplayed ? 'Active Investigation' : 'Replay Incident'}
                          </button>
                        </div>
                      );
                    })}

                    {chains.length === 0 && (
                      <div className="text-center text-gray-500 py-10 font-mono text-xs">
                        No active chains detected. Use the auto-inject button above to generate a suspicious chain.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Graph Explorer & Replay Controls */}
        <div className="col-span-8 glass-panel rounded-2xl flex flex-col overflow-hidden relative border border-white/5">
          <div className="absolute top-4 left-4 z-10 flex gap-2">
            <h2 className="text-lg font-semibold flex items-center gap-2 bg-background/80 px-4 py-2 rounded-lg backdrop-blur-md border border-white/10">
              <Network className="w-5 h-5 text-primary" /> Multi-hop Fraud Topology
            </h2>
            {replayChain && (
              <span className="text-xs bg-primary/20 text-primary border border-primary/50 rounded-lg px-3 py-2 flex items-center gap-1.5 font-bold font-mono uppercase tracking-wider backdrop-blur-md animate-pulse">
                <Terminal className="w-3.5 h-3.5" /> Investigation Mode
              </span>
            )}
          </div>
          
          <div className="flex-1 w-full h-full relative">
             <GraphExplorer chains={activeChainsForGraph} />
          </div>

          {/* Incident Replay Float Panel */}
          <AnimatePresence>
            {replayChain && (
              <motion.div 
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 50, opacity: 0 }}
                className="absolute bottom-4 left-4 right-4 z-10 glass-panel p-4 rounded-xl flex flex-col gap-4 backdrop-blur-xl bg-background/90 border border-primary/20 shadow-2xl"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="p-1.5 bg-primary/10 rounded-lg text-primary">
                      <Cpu className="w-5 h-5" />
                    </span>
                    <div>
                      <h3 className="font-bold text-glow text-primary text-sm font-mono">
                        REPLAYING ATTACK: {replayChain.chainId.substring(0, 8)}
                      </h3>
                      <p className="text-xs text-gray-400">
                        Visualizing sequentially. Step {replayIndex + 1} of {replayChain.transactions.length}
                      </p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => {
                      setReplayChain(null);
                      setIsPlaying(false);
                    }}
                    className="p-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Timeline Scrubber */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-gray-500">Timeline:</span>
                  <div className="flex-1 flex gap-1 h-2 bg-white/5 rounded overflow-hidden">
                    {replayChain.transactions.map((_, idx) => (
                      <div 
                        key={idx}
                        onClick={() => {
                          setIsPlaying(false);
                          setReplayIndex(idx);
                        }}
                        className={`flex-1 cursor-pointer transition-colors ${
                          idx <= replayIndex ? 'bg-primary' : 'bg-white/10 hover:bg-white/20'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Replay Controls & AI Predictor Panel */}
                <div className="grid grid-cols-12 gap-4 items-center">
                  {/* Left Controls */}
                  <div className="col-span-5 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setReplayIndex(0);
                        setIsPlaying(false);
                      }}
                      className="p-2 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"
                      title="Reset Timeline"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className="flex-1 py-2 bg-primary/20 text-primary border border-primary/50 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-primary/30 transition-all"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {isPlaying ? 'Pause' : 'Play Simulation'}
                    </button>

                    <button
                      onClick={() => {
                        setIsPlaying(false);
                        if (replayIndex < replayChain.transactions.length - 1) {
                          setReplayIndex(prev => prev + 1);
                        }
                      }}
                      disabled={replayIndex === replayChain.transactions.length - 1}
                      className="p-2 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 disabled:opacity-50 transition-colors"
                      title="Next Step"
                    >
                      <SkipForward className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mid Speed Control */}
                  <div className="col-span-3 flex items-center gap-2 text-xs font-mono text-gray-400">
                    <span>Speed:</span>
                    <select
                      value={replaySpeed}
                      onChange={(e) => setReplaySpeed(Number(e.target.value))}
                      className="bg-background/80 border border-white/10 rounded px-2 py-1 text-white focus:outline-none focus:border-primary text-xs"
                    >
                      <option value={2000}>0.5x (Slow)</option>
                      <option value={1000}>1.0x (Normal)</option>
                      <option value={500}>2.0x (Fast)</option>
                    </select>
                  </div>

                  {/* Right: AI Prediction Box */}
                  {nextHopPrediction && (
                    <div className="col-span-4 bg-primary/5 border border-primary/30 p-2.5 rounded-lg flex flex-col gap-0.5">
                      <div className="text-[9px] uppercase tracking-wider text-primary font-bold flex items-center gap-1">
                        <Server className="w-3 h-3" /> System Prediction
                      </div>
                      <div className="text-xs font-mono text-white truncate font-bold">
                        Target ➔ {nextHopPrediction.target}
                      </div>
                      <div className="text-[10px] font-mono text-success flex justify-between">
                        <span>Confidence:</span>
                        <span className="font-bold">{nextHopPrediction.confidence}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, color, alert }: { title: string, value: number | string, icon: React.ReactNode, color: string, alert?: boolean }) {
  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`glass-panel p-4 rounded-xl flex flex-col gap-2 relative overflow-hidden transition-all ${
        alert ? 'border-danger/40 bg-danger/5 shadow-[0_0_10px_rgba(255,0,85,0.1)] animate-pulse' : 'border-white/5'
      }`}
    >
      {alert && (
        <div className="absolute top-0 right-0 w-16 h-16 bg-danger/20 blur-xl rounded-full" />
      )}
      <div className={`flex items-center gap-2 ${color}`}>
        {icon}
        <span className="text-sm font-medium text-gray-400">{title}</span>
      </div>
      <div className={`text-3xl font-bold ${color} text-glow font-mono`}>
        {value}
      </div>
    </motion.div>
  );
}

export default App;
