"""
graph_intelligence.py
Graph Intelligence + Community Detection
Builds a directed transaction graph and applies community detection
to reveal hidden mule network relationships and identify controller nodes.
Cybersecurity technique: Graph-Based Threat Detection + Community Detection
"""

import json
import sys
import os
from collections import defaultdict

import networkx as nx

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def build_transaction_graph(transactions: list) -> nx.DiGraph:
    """
    Build a directed graph where:
    - Nodes = UPI handles (accounts)
    - Edges = money transfers (sender → receiver)
    - Edge weight = transaction amount
    """
    G = nx.DiGraph()

    for txn in transactions:
        sender = txn.get("sender_upi", "")
        receiver = txn.get("receiver_upi", "")
        amount = txn.get("amount", 0)
        ctrl_id = txn.get("controller_id", "")
        account_id = txn.get("account_id", "")

        if not sender or not receiver:
            continue

        # Add/update nodes
        if not G.has_node(sender):
            G.add_node(sender, node_type="controller", controller_id=ctrl_id)
        if not G.has_node(receiver):
            G.add_node(receiver, node_type="mule", account_id=account_id, controller_id=ctrl_id)

        # Add/update edge
        if G.has_edge(sender, receiver):
            G[sender][receiver]["weight"] += amount
            G[sender][receiver]["count"] += 1
        else:
            G.add_edge(sender, receiver, weight=amount, count=1, controller_id=ctrl_id)

    return G


def detect_communities(G: nx.DiGraph) -> dict:
    """
    Detect communities in the transaction graph using connected components.
    Each community likely represents one controller's mule network.
    Returns community assignments per node.
    """
    # Use undirected version for community detection
    G_undirected = G.to_undirected()

    communities = {}
    for i, component in enumerate(nx.connected_components(G_undirected)):
        for node in component:
            communities[node] = f"COMMUNITY_{i+1:03d}"

    return communities


def find_controller_nodes(G: nx.DiGraph) -> list:
    """
    Identify controller nodes using betweenness centrality.
    Controllers have high out-degree (send to many mules) and
    high betweenness centrality (central to the network).
    """
    if len(G.nodes) == 0:
        return []

    # Out-degree: controllers send to many accounts
    out_degrees = dict(G.out_degree())

    # Betweenness centrality: how central is this node
    try:
        betweenness = nx.betweenness_centrality(G, normalized=True)
    except Exception:
        betweenness = {n: 0.0 for n in G.nodes}

    # Score each node
    controller_scores = []
    for node in G.nodes:
        out_deg = out_degrees.get(node, 0)
        centrality = betweenness.get(node, 0.0)
        node_data = G.nodes[node]

        # Controllers have high out-degree and centrality
        score = (out_deg * 0.6) + (centrality * 100 * 0.4)

        controller_scores.append({
            "node": node,
            "out_degree": out_deg,
            "betweenness_centrality": round(centrality, 4),
            "controller_score": round(score, 3),
            "node_type": node_data.get("node_type", "unknown"),
            "controller_id": node_data.get("controller_id", ""),
        })

    # Sort by score descending
    controller_scores.sort(key=lambda x: x["controller_score"], reverse=True)
    return controller_scores


def analyze_mule_network(transactions: list) -> dict:
    """
    Full graph intelligence analysis.
    Returns graph stats, communities, controller nodes, and cluster summaries.
    """
    print("Building transaction graph...")
    G = build_transaction_graph(transactions)

    print(f"Graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")

    communities = detect_communities(G)
    controller_nodes = find_controller_nodes(G)

    # Summarize each community
    community_summary = defaultdict(lambda: {
        "nodes": [], "total_flow": 0, "transaction_count": 0
    })
    for node, community in communities.items():
        community_summary[community]["nodes"].append(node)

    for u, v, data in G.edges(data=True):
        comm = communities.get(u, "UNKNOWN")
        community_summary[comm]["total_flow"] += data.get("weight", 0)
        community_summary[comm]["transaction_count"] += data.get("count", 0)

    return {
        "node_count": G.number_of_nodes(),
        "edge_count": G.number_of_edges(),
        "community_count": len(set(communities.values())),
        "communities": dict(community_summary),
        "top_controller_nodes": controller_nodes[:10],
        "graph": G,  # networkx graph object for visualization
    }


def get_graph_data_for_viz(G: nx.DiGraph, communities: dict) -> dict:
    """
    Export graph data in a format suitable for Plotly/Streamlit visualization.
    """
    nodes = []
    for node in G.nodes(data=True):
        nodes.append({
            "id": node[0],
            "community": communities.get(node[0], "UNKNOWN"),
            "node_type": node[1].get("node_type", "unknown"),
            "out_degree": G.out_degree(node[0]),
            "in_degree": G.in_degree(node[0]),
        })

    edges = []
    for u, v, data in G.edges(data=True):
        edges.append({
            "source": u,
            "target": v,
            "weight": data.get("weight", 0),
            "count": data.get("count", 0),
        })

    return {"nodes": nodes, "edges": edges}


if __name__ == "__main__":
    data_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "data", "synthetic_transactions.json"
    )
    if not os.path.exists(data_path):
        print("Run generate_synthetic_data.py first.")
        sys.exit(1)

    with open(data_path) as f:
        transactions = json.load(f)

    result = analyze_mule_network(transactions)

    print(f"\nCommunities detected: {result['community_count']}")
    for comm, data in list(result["communities"].items())[:4]:
        print(f"  {comm}: {len(data['nodes'])} nodes, ₹{data['total_flow']:,} total flow")

    print(f"\nTop controller nodes by centrality:")
    for node in result["top_controller_nodes"][:5]:
        print(f"  {node['node']}: out_degree={node['out_degree']}, score={node['controller_score']}")
