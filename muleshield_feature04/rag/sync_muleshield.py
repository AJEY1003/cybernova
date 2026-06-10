import os
import sys
import asyncio
from typing import List
from dotenv import load_dotenv

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

load_dotenv()

from langchain_core.documents import Document
from rag.vector_store import upsert_batch, _get_client
from main import STATE, _initialize_pipeline

async def full_sync():
    print("Initializing MuleShield pipeline to load data...")
    if not STATE["initialized"]:
        await _initialize_pipeline()
    
    print("Flushing old Qdrant collection...")
    client = _get_client()
    collection_name = os.getenv("QDRANT_COLLECTION_NAME", "RAG_CHATBOT")
    try:
        client.delete_collection(collection_name)
    except Exception:
        pass # Might not exist yet

    docs: List[Document] = []

    # 1. Embed Clusters & Controllers
    print(f"Processing {len(STATE['clusters'])} clusters...")
    for cluster in STATE.get("clusters", []):
        cid = cluster.get("cluster_id")
        ctrl = cluster.get("controller_name", "Unknown")
        risk = cluster.get("confidence_score", 0) * 100
        honey = cluster.get("honey_trap_account", "None")
        blocked = [acc for acc, status in cluster.get("account_statuses", {}).items() if status == "BLOCKED"]
        
        content = f"Fraud Syndicate Cluster {cid} controlled by {ctrl}.\n"
        content += f"Risk/Confidence Score: {risk}%.\n"
        content += f"Honey Trap Account: {honey}\n"
        content += f"Total Accounts in Ring: {cluster.get('account_count')}\n"
        content += f"Blocked Accounts: {', '.join(blocked) if blocked else 'None'}\n"
        
        docs.append(Document(
            page_content=content,
            metadata={
                "doc_id": f"cluster_{cid}",
                "doc_type": "cluster",
                "cluster_id": cid,
                "controller": ctrl
            }
        ))

    # 2. Embed Alerts
    print(f"Processing {len(STATE['alerts'])} alerts...")
    for i, alert in enumerate(STATE.get("alerts", [])):
        acc = alert.get("account_id", "Unknown")
        risk = alert.get("risk_assessment", {}).get("composite_score", 0) * 100
        verdict = alert.get("verdict", "Unknown")
        action = alert.get("recommended_action", "Unknown")
        reasons = ", ".join(alert.get("risk_assessment", {}).get("reasons", []))
        
        content = f"Security Alert for account {acc}.\n"
        content += f"Verdict: {verdict}\n"
        content += f"Recommended Action: {action}\n"
        content += f"Risk Score: {risk}%\n"
        content += f"Reasons: {reasons}\n"
        
        docs.append(Document(
            page_content=content,
            metadata={
                "doc_id": f"alert_{i}_{acc}",
                "doc_type": "alert",
                "account_id": acc,
                "is_flagged": True,
                "risk_score": risk
            }
        ))

    # 3. Embed Recent Transaction Flows for Mule Accounts
    print("Processing transaction flows...")
    txns = STATE.get("transactions", [])
    account_flows = {}
    
    for tx in txns:
        sender = tx.get("sender_upi", "Unknown")
        receiver = tx.get("receiver_upi", "Unknown")
        amt = tx.get("amount", 0)
        
        if sender not in account_flows: account_flows[sender] = {"out": 0, "in": 0, "txs": []}
        if receiver not in account_flows: account_flows[receiver] = {"out": 0, "in": 0, "txs": []}
        
        account_flows[sender]["out"] += amt
        account_flows[receiver]["in"] += amt
        
        summary = f"Sent Rs.{amt} to {receiver}"
        account_flows[sender]["txs"].append(summary)
        summary_in = f"Received Rs.{amt} from {sender}"
        account_flows[receiver]["txs"].append(summary_in)

    for acc, flow in account_flows.items():
        # Only embed if they have significant flow
        if len(flow["txs"]) < 2: continue
        
        recent = flow["txs"][-10:] # last 10 transactions
        content = f"Transaction Flow Summary for Account {acc}:\n"
        content += f"Total Money Sent Out: Rs.{flow['out']}\n"
        content += f"Total Money Received: Rs.{flow['in']}\n"
        content += f"Recent Activity:\n- " + "\n- ".join(recent)
        
        docs.append(Document(
            page_content=content,
            metadata={
                "doc_id": f"txflow_{acc}",
                "doc_type": "transaction_flow",
                "account_id": acc
            }
        ))

    print(f"Upserting {len(docs)} documents to Qdrant vector store...")
    upsert_batch(docs)
    print("Sync complete!")

if __name__ == "__main__":
    asyncio.run(full_sync())
