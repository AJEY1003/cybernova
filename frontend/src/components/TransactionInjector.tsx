import React, { useState } from 'react';
import { Send } from 'lucide-react';

export default function TransactionInjector() {
  const [senderId, setSenderId] = useState('');
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderId || !receiverId || !amount) return;

    const tx = {
      id: `TXN-${crypto.randomUUID()}`,
      senderId,
      receiverId,
      amount: parseFloat(amount),
      timestamp: Date.now(),
      deviceId: `DEV-MANUAL`,
      ipAddress: `127.0.0.1`,
      geoRegion: 'Local',
      type: 'transfer',
      riskScore: 50 // Default
    };

    try {
      const res = await fetch('http://localhost:4000/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx)
      });
      if (res.ok) {
        setSenderId('');
        setReceiverId('');
        setAmount('');
      }
    } catch (err) {
      console.error('Failed to submit transaction', err);
    }
  };

  const handleInjectFraudChain = async () => {
    // Helper to inject a 3-hop fraud chain instantly
    const baseAmount = 50000;
    const t1 = { senderId: 'VICTIM-1', receiverId: 'MULE-A', amount: baseAmount };
    const t2 = { senderId: 'MULE-A', receiverId: 'MULE-B', amount: baseAmount * 0.99 }; // 1% fee
    const t3 = { senderId: 'MULE-B', receiverId: 'MULE-C', amount: baseAmount * 0.99 * 0.985 }; // 1.5% fee

    const sharedDevice = `DEV-SHARED-FINGERPRINT`;
    const sharedIp = `192.168.42.100`;

    const sendTx = async (txData: any) => {
      await fetch('http://localhost:4000/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: `TXN-${crypto.randomUUID()}`,
          ...txData,
          timestamp: Date.now(),
          deviceId: sharedDevice,
          ipAddress: sharedIp,
          geoRegion: 'Unknown',
          type: 'transfer',
          riskScore: 90,
          browserFingerprint: 'chrome_windows_v124_xyz',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          os: 'Windows 11',
          vpnUsage: true
        })
      });
    };

    await sendTx(t1);
    setTimeout(() => sendTx(t2), 500);
    setTimeout(() => sendTx(t3), 1000);
  };

  return (
    <div className="glass-panel p-4 rounded-xl flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-primary">Inject Real-time Transaction</h3>
        <button 
          onClick={handleInjectFraudChain}
          className="text-xs bg-danger/20 text-danger border border-danger/50 hover:bg-danger/30 px-2 py-1 rounded"
        >
          Auto-Inject Fraud Chain
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <input 
            type="text" 
            placeholder="Sender ID" 
            value={senderId} 
            onChange={(e) => setSenderId(e.target.value)}
            className="bg-background/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
          <input 
            type="text" 
            placeholder="Receiver ID" 
            value={receiverId} 
            onChange={(e) => setReceiverId(e.target.value)}
            className="bg-background/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <div className="flex gap-2">
          <input 
            type="number" 
            placeholder="Amount" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-background/50 border border-white/10 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary"
          />
          <button 
            type="submit"
            className="bg-primary/20 text-primary border border-primary/50 hover:bg-primary/30 rounded px-4 py-2 flex items-center justify-center transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
