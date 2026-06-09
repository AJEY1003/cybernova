import React, { useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MarkerType, 
  Edge, 
  Node,
  BackgroundVariant
} from 'reactflow';
import 'reactflow/dist/style.css';
import { EchoChain } from '../types';

interface GraphExplorerProps {
  chains: EchoChain[];
}

export default function GraphExplorer({ chains }: GraphExplorerProps) {
  
  const { nodes, edges } = useMemo(() => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const nodeSet = new Set<string>();

    const deviceToAccounts = new Map<string, Set<string>>();

    chains.forEach((chain) => {
      const isHighRisk = chain.confidenceScore > 80;
      
      chain.transactions.forEach((tx) => {
        // Collect device mapping details
        if (tx.deviceId) {
          if (!deviceToAccounts.has(tx.deviceId)) {
            deviceToAccounts.set(tx.deviceId, new Set());
          }
          deviceToAccounts.get(tx.deviceId)!.add(tx.senderId);
          deviceToAccounts.get(tx.deviceId)!.add(tx.receiverId);
        }

        // Add Sender Node
        if (!nodeSet.has(tx.senderId)) {
          newNodes.push({
            id: tx.senderId,
            position: { x: 0, y: 0 },
            data: { label: `💳 Account: ${tx.senderId}` },
            style: {
              background: '#13131a',
              color: '#fff',
              border: `1px solid ${isHighRisk ? '#ff0055' : '#00f0ff'}`,
              borderRadius: '8px',
              padding: '10px',
              boxShadow: isHighRisk ? '0 0 10px #ff0055' : '0 0 5px #00f0ff',
              fontFamily: 'monospace',
              fontSize: '12px'
            }
          });
          nodeSet.add(tx.senderId);
        }

        // Add Receiver Node
        if (!nodeSet.has(tx.receiverId)) {
          newNodes.push({
            id: tx.receiverId,
            position: { x: 0, y: 0 },
            data: { label: `💳 Account: ${tx.receiverId}` },
            style: {
              background: '#13131a',
              color: '#fff',
              border: `1px solid ${isHighRisk ? '#ff0055' : '#00f0ff'}`,
              borderRadius: '8px',
              padding: '10px',
              boxShadow: isHighRisk ? '0 0 10px #ff0055' : '0 0 5px #00f0ff',
              fontFamily: 'monospace',
              fontSize: '12px'
            }
          });
          nodeSet.add(tx.receiverId);
        }

        // Add Edge
        newEdges.push({
          id: tx.id,
          source: tx.senderId,
          target: tx.receiverId,
          animated: true,
          label: `$${tx.amount.toFixed(2)}`,
          style: { stroke: isHighRisk ? '#ff0055' : '#00f0ff', strokeWidth: 2.5 },
          labelStyle: { fill: '#fff', fontWeight: 700, fontSize: 11 },
          labelBgStyle: { fill: '#0a0a0f', fillOpacity: 0.9 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isHighRisk ? '#ff0055' : '#00f0ff',
          },
        });
      });
    });

    // Lay out Accounts first in visual layers
    let currentY = 100;
    chains.forEach(chain => {
      let currentX = 100;
      chain.transactions.forEach(tx => {
         const sNode = newNodes.find(n => n.id === tx.senderId);
         if (sNode) { sNode.position = { x: currentX, y: currentY }; }
         currentX += 240;
         const rNode = newNodes.find(n => n.id === tx.receiverId);
         if (rNode) { rNode.position = { x: currentX, y: currentY }; }
      });
      currentY += 220; // Expanded spacing to allow room for devices
    });

    // Add and position Device Nodes dynamically
    deviceToAccounts.forEach((accounts, deviceId) => {
      const isReused = accounts.size >= 2;
      const id = `device_${deviceId}`;
      
      if (!nodeSet.has(id)) {
        newNodes.push({
          id,
          position: { x: 0, y: 0 },
          data: { label: `📱 Device: ${deviceId.replace('DEV-', '')}` },
          style: {
            background: '#181024',
            color: '#c084fc',
            border: `1px solid ${isReused ? '#ff0055' : '#a855f7'}`,
            borderRadius: '12px',
            padding: '8px 12px',
            boxShadow: isReused ? '0 0 10px #ff0055' : '0 0 5px #a855f7',
            fontFamily: 'monospace',
            fontSize: '11px',
            fontWeight: 'bold',
          }
        });
        nodeSet.add(id);
      }

      // Add Purple/Red correlations
      accounts.forEach(accountId => {
        const edgeId = `edge_${id}_to_${accountId}`;
        newEdges.push({
          id: edgeId,
          source: id,
          target: accountId,
          animated: isReused,
          style: { 
            stroke: isReused ? '#ff0055' : '#a855f7',
            strokeWidth: isReused ? 2 : 1.5, 
            strokeDasharray: isReused ? 'none' : '4,4' 
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isReused ? '#ff0055' : '#a855f7',
          },
        });
      });
    });

    // Position Devices in the center of their connected accounts
    deviceToAccounts.forEach((accounts, deviceId) => {
      const devNode = newNodes.find(n => n.id === `device_${deviceId}`);
      if (devNode) {
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        accounts.forEach(accId => {
          const accNode = newNodes.find(n => n.id === accId);
          if (accNode) {
            sumX += accNode.position.x;
            sumY += accNode.position.y;
            count++;
          }
        });
        if (count > 0) {
          devNode.position = {
            x: sumX / count + 40, // Offset slightly to separate from transaction edges
            y: (sumY / count) - 100 // Float 100px above
          };
        }
      }
    });

    return { nodes: newNodes, edges: newEdges };
  }, [chains]);

  return (
    <ReactFlow 
      nodes={nodes} 
      edges={edges}
      fitView
      className="bg-background/50"
    >
      <Background color="#ffffff" variant={BackgroundVariant.Dots} gap={24} size={1} opacity={0.1} />
      <Controls className="bg-surface border-white/10 fill-white" />
    </ReactFlow>
  );
}
