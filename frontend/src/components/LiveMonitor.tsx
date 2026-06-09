import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Transaction } from '../types';

interface LiveMonitorProps {
  transactions: Transaction[];
}

export default function LiveMonitor({ transactions }: LiveMonitorProps) {
  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence>
        {transactions.map((tx) => (
          <motion.div
            key={tx.id}
            initial={{ opacity: 0, x: -20, backgroundColor: 'rgba(255,255,255,0)' }}
            animate={{ 
              opacity: 1, 
              x: 0,
              backgroundColor: tx.riskScore > 80 ? 'rgba(255,0,85,0.1)' : 'rgba(255,255,255,0.02)'
            }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className={`p-3 rounded-lg border ${
              tx.riskScore > 80 ? 'border-danger/30' : 'border-white/5'
            } text-sm flex flex-col gap-1`}
          >
            <div className="flex justify-between items-center">
              <span className="font-mono text-xs text-gray-400">{tx.id}</span>
              <span className={`font-bold ${tx.riskScore > 80 ? 'text-danger' : 'text-primary'}`}>
                ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <span className="font-mono truncate w-24">{tx.senderId}</span>
              <span className="text-gray-500">→</span>
              <span className="font-mono truncate w-24">{tx.receiverId}</span>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      {transactions.length === 0 && (
        <div className="text-center text-gray-500 py-10">
          Waiting for transactions...
        </div>
      )}
    </div>
  );
}
