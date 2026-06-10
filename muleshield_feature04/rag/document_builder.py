from datetime import timedelta
from typing import Any, List
from langchain_core.documents import Document

def build_account_document(account_id: str, db, neo4j_driver: Any) -> Document:
    user = db.users.find_one({"account_id": account_id})
    name = user.get("name") if user else "Unknown"
    
    risk_score_rec = db.risk_scores.find_one({"account_id": account_id})
    cumulative_risk_score = int(risk_score_rec.get("score", 0) * 100) if risk_score_rec else 0
    
    high_risk_alert = db.alerts.find_one({
        "account_id": account_id,
        "$or": [{"risk_level": "HIGH"}, {"risk_score": {"$gte": 0.5}}]
    })
    
    is_flagged = (cumulative_risk_score > 50) or (high_risk_alert is not None)
    alert_status = "ALERT" if is_flagged else "CLEAR"

    transactions = list(db.transactions.find({
        "$or": [{"sender": account_id}, {"receiver": account_id}]
    }).sort("timestamp", -1).limit(50))

    tx_alerts = list(db.alerts.find({
        "account_id": {"$in": [tx.get("sender") for tx in transactions if tx.get("sender")]}
    }))

    def get_tx_risk_info(tx) -> tuple[int, str]:
        matched_alert = None
        for alert in tx_alerts:
            if alert.get("account_id") == tx.get("sender"):
                time_diff = abs((alert.get("created_at", tx.get("timestamp")) - tx.get("timestamp")).total_seconds())
                if time_diff < 5:
                    matched_alert = alert
                    break
        if matched_alert:
            score = int(matched_alert.get("risk_score", 0) * 100)
            status = "ALERT" if score > 50 else "CLEAR"
            return score, status
        else:
            score = 0
            if tx.get("amount", 0) > 50000:
                score += 30
            status = "ALERT" if score > 50 else "CLEAR"
            return score, status

    processed_txs = []
    total_sent = 0.0
    total_received = 0.0
    high_risk_tx_count = 0

    for tx in transactions:
        t_score, t_status = get_tx_risk_info(tx)
        
        if tx.get("sender") == account_id:
            total_sent += tx.get("amount", 0)
        if tx.get("receiver") == account_id:
            total_received += tx.get("amount", 0)
            
        if t_score > 50:
            high_risk_tx_count += 1
            
        processed_txs.append({
            "txn_id": tx.get("_id") or tx.get("id", "Unknown"),
            "timestamp": tx.get("timestamp"),
            "amount": tx.get("amount", 0),
            "sender_id": tx.get("sender"),
            "receiver_id": tx.get("receiver"),
            "counterparty_id": tx.get("receiver") if tx.get("sender") == account_id else tx.get("sender"),
            "risk_score": t_score,
            "alert_status": t_status
        })

    transferred_to_list: List[str] = []
    shared_device_list: List[str] = []
    cycle_detected_str = "No"

    if neo4j_driver:
        try:
            with neo4j_driver.session() as session:
                try:
                    result_transfers = session.run(
                        "MATCH (a:Account {id: $id})-[:TRANSFERRED_TO]->(b) RETURN b.id AS id",
                        id=account_id
                    )
                    transferred_to_list = [r["id"] for r in result_transfers if r["id"]]
                except Exception:
                    pass

                try:
                    result_shared = session.run(
                        "MATCH (a:Account {id: $id})-[:LOGGED_FROM]->(d)<-[:LOGGED_FROM]-(b) "
                        "WHERE b.id <> $id RETURN b.id AS id",
                        id=account_id
                    )
                    shared_device_list = [r["id"] for r in result_shared if r["id"]]
                except Exception:
                    pass

                try:
                    result_cycle = session.run(
                        "MATCH path=(a:Account {id: $id})-[:TRANSFERRED_TO*2..4]->(a) RETURN path LIMIT 1",
                        id=account_id
                    )
                    record = result_cycle.single()
                    if record and record["path"]:
                        nodes = record["path"].nodes
                        cycle_path = " -> ".join([n["id"] for n in nodes])
                        cycle_detected_str = f"Yes - path: {cycle_path}"
                except Exception:
                    pass
        except Exception as e:
            print(f"Neo4j connection error: {e}")

    high_freq = "No"
    sent_txs = sorted([tx for tx in processed_txs if tx["sender_id"] == account_id], key=lambda x: x["timestamp"])
    for i in range(len(sent_txs)):
        window_end = sent_txs[i]["timestamp"] + timedelta(minutes=5)
        count = 1
        for j in range(i + 1, len(sent_txs)):
            if sent_txs[j]["timestamp"] <= window_end:
                count += 1
            else:
                break
        if count >= 3:
            high_freq = "Yes"
            break

    rapid_in_out = "No"
    all_txs_chrono = sorted(processed_txs, key=lambda x: x["timestamp"])
    for i, rx in enumerate(all_txs_chrono):
        if rx["receiver_id"] == account_id:
            for sx in all_txs_chrono[i+1:]:
                if sx["sender_id"] == account_id and (sx["timestamp"] - rx["timestamp"]).total_seconds() <= 3600:
                    rapid_in_out = "Yes"
                    break
            if rapid_in_out == "Yes":
                break

    large_spike = "Yes" if any(tx["amount"] > 50000 for tx in processed_txs) else "No"
    shared_device_flag = "Yes" if len(shared_device_list) > 0 else "No"

    direct_transfers_str = ", ".join(transferred_to_list) if transferred_to_list else "None"
    shared_device_str = ", ".join(shared_device_list) if shared_device_list else "None"

    recent_txs = processed_txs[:10]
    recent_txs_lines = []
    for tx in recent_txs:
        formatted_ts = tx["timestamp"].strftime("%Y-%m-%d %H:%M:%S") if tx.get("timestamp") else "Unknown"
        direction_label = "To" if tx["sender_id"] == account_id else "From"
        line = f"- TXN {tx['txn_id']} | {formatted_ts} | Rs.{tx['amount']} | {direction_label}: {tx['counterparty_id']} | Risk: {tx['risk_score']} | {tx['alert_status']}"
        recent_txs_lines.append(line)
    recent_txs_str = "\n".join(recent_txs_lines) if recent_txs_lines else "No recent transactions."

    page_content = f"""ACCOUNT PROFILE
Account ID    : {account_id}
Holder Name   : {name}
Flagged       : {"Yes" if is_flagged else "No"}
Risk Score    : {cumulative_risk_score}/100

TRANSACTION SUMMARY
Total transactions : {len(processed_txs)}
Total sent         : Rs.{total_sent:.2f}
Total received     : Rs.{total_received:.2f}
High risk txns     : {high_risk_tx_count}

RECENT TRANSACTIONS (last 10)
{recent_txs_str}

NETWORK CONNECTIONS
Direct transfers to  : {direct_transfers_str}
Shared device with   : {shared_device_str}
Cycle detected       : {cycle_detected_str}

FRAUD INDICATORS
High frequency       : {high_freq}
Rapid in-out         : {rapid_in_out}
Large spike          : {large_spike}
Shared device flag   : {shared_device_flag}"""

    metadata = {
        "doc_id": f"account_{account_id}",
        "account_id": account_id,
        "holder_name": name,
        "risk_score": cumulative_risk_score,
        "is_flagged": is_flagged,
        "alert_status": alert_status,
        "source": "muledna_mongodb_neo4j"
    }

    return Document(
        page_content=page_content,
        metadata=metadata
    )
