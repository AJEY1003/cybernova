"""
Graph Service for MuleDNA Phase 6 - Neo4j Network Detection

Graph Schema:
  Nodes:     Account | Device | IP | Beneficiary
  Relations: (Account)-[:SENT_TO]->(Account)
             (Account)-[:USED_DEVICE]->(Device)
             (Account)-[:USED_IP]->(IP)
"""

class GraphService:

    @staticmethod
    def sync_transaction(session, sender: str, receiver: str, device_id: str, ip_address: str):
        """
        Syncs a single transaction to Neo4j graph.
        Creates nodes for Account/Device/IP and relationships between them.
        """
        query = """
        MERGE (sender:Account {account_id: $sender})
        MERGE (receiver:Account {account_id: $receiver})
        MERGE (device:Device {device_id: $device_id})
        MERGE (ip:IP {address: $ip_address})

        MERGE (sender)-[:SENT_TO]->(receiver)
        MERGE (sender)-[:USED_DEVICE]->(device)
        MERGE (sender)-[:USED_IP]->(ip)
        """
        session.run(query, sender=sender, receiver=receiver,
                    device_id=device_id or "UNKNOWN", ip_address=ip_address or "UNKNOWN")

    @staticmethod
    def get_connected_accounts(session, account_id: str):
        """
        Finds all accounts connected to the given account by shared Device or IP.
        Returns a list of connected account IDs and the reason (shared device/IP).
        """
        query = """
        MATCH (a:Account {account_id: $account_id})
        OPTIONAL MATCH (a)-[:USED_DEVICE]->(d:Device)<-[:USED_DEVICE]-(linked:Account)
        WHERE linked.account_id <> $account_id
        OPTIONAL MATCH (a)-[:USED_IP]->(ip:IP)<-[:USED_IP]-(linked2:Account)
        WHERE linked2.account_id <> $account_id
        WITH 
            collect(DISTINCT {account_id: linked.account_id, reason: 'Shared Device: ' + d.device_id}) +
            collect(DISTINCT {account_id: linked2.account_id, reason: 'Shared IP: ' + ip.address}) AS connections
        RETURN connections
        """
        result = session.run(query, account_id=account_id)
        record = result.single()
        if not record:
            return []
        return [c for c in record["connections"] if c["account_id"] is not None]

    @staticmethod
    def detect_clusters(session):
        """
        Detects suspicious account clusters: accounts that share both Device and IP.
        Clusters with 2+ accounts connected = mule ring candidate.
        """
        query = """
        MATCH (a:Account)-[:USED_DEVICE]->(d:Device)<-[:USED_DEVICE]-(b:Account)
        WHERE a.account_id <> b.account_id
        WITH d.device_id AS shared_device, collect(DISTINCT a.account_id) AS accounts
        WHERE size(accounts) >= 2
        RETURN shared_device, accounts, size(accounts) AS cluster_size
        ORDER BY cluster_size DESC
        LIMIT 20
        """
        result = session.run(query)
        clusters = []
        for record in result:
            clusters.append({
                "shared_device": record["shared_device"],
                "accounts": record["accounts"],
                "cluster_size": record["cluster_size"],
                "risk_level": "HIGH" if record["cluster_size"] >= 3 else "MEDIUM"
            })
        return clusters

    @staticmethod
    def get_transaction_path(session, sender: str, receiver: str):
        """
        Finds the shortest transaction path between two accounts.
        Useful for tracing money flow in a mule network.
        """
        query = """
        MATCH path = shortestPath(
            (a:Account {account_id: $sender})-[:SENT_TO*..5]->(b:Account {account_id: $receiver})
        )
        RETURN [node IN nodes(path) | node.account_id] AS path_accounts,
               length(path) AS hops
        """
        result = session.run(query, sender=sender, receiver=receiver)
        record = result.single()
        if not record:
            return None
        return {"path": record["path_accounts"], "hops": record["hops"]}

    @staticmethod
    def get_d3_data(session):
        """
        Fetches all nodes and relationships from Neo4j in a D3-compatible format.
        Nodes: Account, Device, IP
        Links: SENT_TO, USED_DEVICE, USED_IP
        """
        # Fetch all nodes
        nodes_query = """
        MATCH (n)
        RETURN id(n) as internal_id, 
               labels(n)[0] as type, 
               coalesce(n.account_id, n.device_id, n.address) as id
        """
        # Fetch all relationships
        links_query = """
        MATCH (s)-[r]->(t)
        RETURN id(s) as source_internal, 
               id(t) as target_internal, 
               type(r) as type
        """
        
        nodes_result = session.run(nodes_query)
        links_result = session.run(links_query)
        
        nodes = []
        node_map = {} # Map internal ID to the displayed ID/Index for links
        
        for record in nodes_result:
            node_data = {
                "id": record["id"],
                "type": record["type"],
                "internal_id": record["internal_id"]
            }
            nodes.append(node_data)
            node_map[record["internal_id"]] = record["id"]
            
        links = []
        for record in links_result:
            links.append({
                "source": node_map.get(record["source_internal"]),
                "target": node_map.get(record["target_internal"]),
                "type": record["type"]
            })
            
        return {"nodes": nodes, "links": links}
