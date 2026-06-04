"""
blocking_agent.py
Autonomous Blocking Agent
Analyzes GraphSAGE embeddings + DBSCAN clusters to:
1. Identify mule networks
2. Block all accounts in 2 highest-risk networks
3. Set one canary (honey trap) per blocked network
4. Monitor canary for controller activity
5. Trigger attribution when controller hits canary
"""

import numpy as np
import json
import os
import sys
from datetime import datetime
from collections import defaultdict

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import HIGH_CONFIDENCE_THRESHOLD


class BlockingAgent:
    """
    Autonomous agent that makes blocking decisions based on
    GraphSAGE mule probability scores and cluster analysis.
    """

    def __init__(self, mule_threshold: float = 0.55, canary_strategy: str = "highest_activity"):
        self.mule_threshold = mule_threshold
        self.canary_strategy = canary_strategy
        self.blocked_networks = {}   # cluster_id → {accounts, canary, status}
        self.canary_hits = []        # log of canary transactions
        self.agent_log = []          # full decision log

    def _log(self, action: str, details: dict):
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "action": action,
            **details
        }
        self.agent_log.append(entry)
        print(f"  [AGENT] {action}: {details}")

    def analyze_networks(self, graphsage_result: dict, clusters: list,
                         transactions: list) -> dict:
        """
        Step 1: Analyze all detected networks using GraphSAGE scores.
        Ranks networks by combined risk score.
        """
        node_results = graphsage_result.get('node_results', {})
        mule_probs = graphsage_result.get('mule_probabilities', [])

        network_risks = []
        for cluster in clusters:
            accounts = cluster.get('accounts', [])
            cluster_id = cluster.get('cluster_id', '')

            # Get GraphSAGE mule probabilities for accounts in this cluster
            account_probs = []
            for acc in accounts:
                # Match account to UPI node
                for node, data in node_results.items():
                    if acc in node or node in acc:
                        account_probs.append(data['mule_probability'])
                        break

            avg_prob = float(np.mean(account_probs)) if account_probs else 0.5
            max_prob = float(np.max(account_probs)) if account_probs else 0.5

            # Combined risk: GraphSAGE score + cluster confidence
            combined_risk = (avg_prob * 0.6) + (cluster.get('confidence_score', 0.5) * 0.4)

            network_risks.append({
                'cluster_id': cluster_id,
                'cluster': cluster,
                'avg_mule_probability': avg_prob,
                'max_mule_probability': max_prob,
                'combined_risk': combined_risk,
                'account_count': len(accounts),
            })

        # Sort by combined risk descending
        network_risks.sort(key=lambda x: x['combined_risk'], reverse=True)

        self._log("NETWORK_ANALYSIS_COMPLETE", {
            "networks_analyzed": len(network_risks),
            "top_risk": network_risks[0]['combined_risk'] if network_risks else 0,
        })

        return network_risks

    def select_canary(self, cluster: dict, transactions: list) -> str:
        """
        Select the canary (honey trap) account from a cluster.
        Strategy: account with highest recent transaction activity
        (controller most likely to use it again).
        """
        accounts = cluster.get('accounts', [])
        if not accounts:
            return ""

        if self.canary_strategy == "highest_activity":
            # Count recent transactions per account
            activity = defaultdict(int)
            for txn in transactions:
                acc = txn.get('account_id', '')
                if acc in accounts:
                    activity[acc] += 1

            if activity:
                return max(activity, key=activity.get)

        # Fallback: last account in list
        return accounts[-1]

    def execute_blocking(self, network_risks: list, transactions: list,
                         n_networks_to_block: int = 2) -> dict:
        """
        Step 2: Block top N networks.
        For each blocked network:
        - Mark all accounts as BLOCKED
        - Select one as CANARY (not blocked — monitored)
        Returns blocking decisions.
        """
        blocking_decisions = {}
        networks_blocked = 0

        for network in network_risks:
            if networks_blocked >= n_networks_to_block:
                break

            cluster = network['cluster']
            cluster_id = network['cluster_id']
            accounts = cluster.get('accounts', [])

            if not accounts:
                continue

            # Select canary
            canary = self.select_canary(cluster, transactions)

            # Block all except canary
            account_statuses = {}
            blocked = []
            for acc in accounts:
                if acc == canary:
                    account_statuses[acc] = "CANARY"
                else:
                    account_statuses[acc] = "BLOCKED"
                    blocked.append(acc)

            self.blocked_networks[cluster_id] = {
                'cluster_id': cluster_id,
                'controller_name': cluster.get('controller_name', 'Unknown'),
                'accounts': accounts,
                'canary': canary,
                'blocked': blocked,
                'account_statuses': account_statuses,
                'combined_risk': network['combined_risk'],
                'avg_mule_probability': network['avg_mule_probability'],
                'blocked_at': datetime.utcnow().isoformat(),
                'canary_hit': False,
                'controller_identified': False,
            }

            blocking_decisions[cluster_id] = {
                'action': 'BLOCKED',
                'blocked_count': len(blocked),
                'canary': canary,
                'risk_score': network['combined_risk'],
            }

            self._log("NETWORK_BLOCKED", {
                "cluster_id": cluster_id,
                "blocked_accounts": len(blocked),
                "canary": canary,
                "risk_score": round(network['combined_risk'], 3),
            })

            networks_blocked += 1

        return blocking_decisions

    def check_canary_hit(self, transaction: dict) -> dict:
        """
        Step 3: Check if a new transaction hits a canary account.
        Called for every new transaction in the system.
        Returns hit details if canary was triggered.
        """
        receiver = transaction.get('receiver_upi', transaction.get('account_id', ''))
        sender = transaction.get('sender_upi', '')

        for cluster_id, network in self.blocked_networks.items():
            canary = network['canary']

            # Check if receiver matches canary
            if receiver == canary or canary in receiver or receiver in canary:
                hit = {
                    'canary_hit': True,
                    'cluster_id': cluster_id,
                    'controller_name': network['controller_name'],
                    'canary_account': canary,
                    'sender_upi': sender,
                    'amount': transaction.get('amount', 0),
                    'timestamp': transaction.get('timestamp', datetime.utcnow().isoformat()),
                    'transaction_id': transaction.get('transaction_id', ''),
                }

                # Update network state
                self.blocked_networks[cluster_id]['canary_hit'] = True
                self.blocked_networks[cluster_id]['last_canary_hit'] = hit
                self.canary_hits.append(hit)

                self._log("CANARY_HIT_DETECTED", {
                    "cluster_id": cluster_id,
                    "sender": sender,
                    "canary": canary,
                    "amount": transaction.get('amount', 0),
                })

                return hit

        return {'canary_hit': False}

    def mark_controller_identified(self, cluster_id: str, controller_details: dict):
        """Mark a network's controller as identified after canary hit + attribution."""
        if cluster_id in self.blocked_networks:
            self.blocked_networks[cluster_id]['controller_identified'] = True
            self.blocked_networks[cluster_id]['controller_details'] = controller_details
            self._log("CONTROLLER_IDENTIFIED", {
                "cluster_id": cluster_id,
                "upi": controller_details.get('upi_handle', ''),
                "confidence": controller_details.get('confidence', 0),
            })

    def get_network_graph_data(self, transactions: list, graphsage_result: dict) -> dict:
        """
        Build complete graph data for frontend visualization.
        Includes node statuses, edge weights, canary positions,
        and controller hit highlights.
        """
        node_results = graphsage_result.get('node_results', {})

        # Build nodes
        nodes = []
        node_status_map = {}

        # Map account statuses from blocked networks
        for cluster_id, network in self.blocked_networks.items():
            for acc, status in network['account_statuses'].items():
                node_status_map[acc] = status

        # Add all nodes from GraphSAGE
        for node, data in node_results.items():
            status = node_status_map.get(node, 'ACTIVE')

            # Check if this is a controller node (high out-degree, low mule prob)
            is_controller = (data['ground_truth_label'] == 0 and
                             data['mule_probability'] < 0.4)

            # Check canary hit
            canary_hit = False
            for network in self.blocked_networks.values():
                if network['canary'] == node and network.get('canary_hit'):
                    canary_hit = True
                    break

            nodes.append({
                'id': node,
                'label': node[:12] + '...' if len(node) > 12 else node,
                'mule_probability': data['mule_probability'],
                'status': status,
                'is_controller': is_controller,
                'canary_hit': canary_hit,
                'ground_truth': data['ground_truth_label'],
                # Visual properties
                'color': _node_color(status, is_controller, canary_hit),
                'size': 20 if is_controller else (15 if status == 'CANARY' else 10),
                'glow': canary_hit or is_controller,
            })

        # Build edges from transactions
        edges = []
        seen_edges = set()
        for txn in transactions:
            sender = txn.get('sender_upi', txn.get('account_id', ''))
            receiver = txn.get('receiver_upi', '')
            amount = float(txn.get('amount', 0))

            if not sender or not receiver:
                continue

            edge_key = f"{sender}→{receiver}"
            if edge_key in seen_edges:
                continue
            seen_edges.add(edge_key)

            # Check if this edge involves a canary hit
            is_canary_edge = any(
                net['canary'] == receiver and net.get('canary_hit')
                for net in self.blocked_networks.values()
            )

            edges.append({
                'source': sender,
                'target': receiver,
                'weight': amount,
                'is_canary_edge': is_canary_edge,
                'color': '#ff2d78' if is_canary_edge else '#302840',
                'width': 3 if is_canary_edge else 1,
            })

        return {
            'nodes': nodes,
            'edges': edges,
            'blocked_networks': list(self.blocked_networks.values()),
            'canary_hits': self.canary_hits,
            'agent_log': self.agent_log[-20:],  # last 20 actions
        }


def _node_color(status: str, is_controller: bool, canary_hit: bool) -> str:
    if canary_hit:
        return '#ff2d78'   # hot pink — controller hit canary
    if is_controller:
        return '#ffe04a'   # yellow — controller node
    if status == 'CANARY':
        return '#00ffcc'   # cyan — canary/honey trap
    if status == 'BLOCKED':
        return '#ff4444'   # red — blocked mule
    return '#5a5068'       # grey — active/unknown


# ── Singleton agent instance ───────────────────────────────────────────────
_agent_instance = None

def get_agent() -> BlockingAgent:
    global _agent_instance
    if _agent_instance is None:
        _agent_instance = BlockingAgent()
    return _agent_instance

def reset_agent():
    global _agent_instance
    _agent_instance = BlockingAgent()
    return _agent_instance


if __name__ == "__main__":
    data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "synthetic_transactions.json")
    clusters_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "clusters.json")

    if not os.path.exists(data_path):
        print("Run generate_synthetic_data.py first.")
        sys.exit(1)

    with open(data_path) as f:
        transactions = json.load(f)

    from graph_sage import run_graphsage_pipeline
    print("Running GraphSAGE...")
    gs_result = run_graphsage_pipeline(transactions)

    clusters = []
    if os.path.exists(clusters_path):
        with open(clusters_path) as f:
            clusters = json.load(f)

    agent = BlockingAgent()
    print("\nAnalyzing networks...")
    network_risks = agent.analyze_networks(gs_result, clusters, transactions)

    print("\nExecuting blocking (top 2 networks)...")
    decisions = agent.execute_blocking(network_risks, transactions, n_networks_to_block=2)

    print("\nBlocking decisions:")
    for cluster_id, decision in decisions.items():
        print(f"  {cluster_id}: blocked {decision['blocked_count']} accounts, canary={decision['canary']}")

    # Simulate canary hit
    print("\nSimulating controller hitting canary...")
    canary = list(agent.blocked_networks.values())[0]['canary']
    fake_txn = {
        'transaction_id': 'txn_test_canary',
        'sender_upi': '9800000001@paytm',
        'receiver_upi': canary,
        'amount': 9500,
        'timestamp': datetime.utcnow().isoformat(),
    }
    hit = agent.check_canary_hit(fake_txn)
    print(f"  Canary hit: {hit['canary_hit']} — cluster: {hit.get('cluster_id', 'N/A')}")
