from datetime import timedelta
from typing import Any, List
from langchain_core.documents import Document
from sqlalchemy.orm import Session
from sqlalchemy import or_

from models.models import User, Transaction, Alert, RiskScore

def build_account_document(account_id: str, db: Session, neo4j_driver: Any) -> Document:
    """
    Builds a LangChain Document profiling an account's transactional history,
    network relationships, and fraud risk indicators.
    """
    # ── STEP 1: QUERY POSTGRESQL ─────────────────────────────────────────────
    # a) Account details (from User and RiskScore tables)
    user = db.query(User).filter(User.account_id == account_id).first()
    name = user.name if user else "Unknown"
    
    risk_score_rec = db.query(RiskScore).filter(RiskScore.account_id == account_id).first()
    # RiskScore.score in db is fraction (0.0 to 1.0), so scale to 0-100
    cumulative_risk_score = int(risk_score_rec.score * 100) if risk_score_rec else 0
    
    # Check if there is any HIGH risk alert for this account
    high_risk_alert = db.query(Alert).filter(
        Alert.account_id == account_id,
        or_(Alert.risk_level == "HIGH", Alert.risk_score >= 0.5)
    ).first()
    
    is_flagged = (cumulative_risk_score > 50) or (high_risk_alert is not None)
    alert_status = "ALERT" if is_flagged else "CLEAR"

    # b) Last 50 transactions where account is sender or receiver
    transactions = db.query(Transaction).filter(
        or_(Transaction.sender == account_id, Transaction.receiver == account_id)
    ).order_by(Transaction.timestamp.desc()).limit(50).all()

    # Pre-fetch all alerts for this account and potentially transaction counterparts
    # to efficiently compute transaction risk scores.
    # An alert is created when the transaction is made, and transaction.sender is alert.account_id.
    # We can match transaction to an alert by sender and timestamp (within 5 seconds).
    tx_alerts = db.query(Alert).filter(
        Alert.account_id.in_([tx.sender for tx in transactions])
    ).all()

    def get_tx_risk_info(tx: Transaction) -> tuple[int, str]:
        # Look for alert with matching sender and close timestamp
        matched_alert = None
        for alert in tx_alerts:
            if alert.account_id == tx.sender and abs((alert.created_at - tx.timestamp).total_seconds()) < 5:
                matched_alert = alert
                break
        if matched_alert:
            score = int(matched_alert.risk_score * 100)
            status = "ALERT" if score > 50 else "CLEAR"
            return score, status
        else:
            # Fallback calculate using transaction parameters if it was high value
            score = 0
            if tx.amount > 50000:
                score += 30
            # If transaction sender is this account and we have a cumulative score, use a portion of it
            status = "ALERT" if score > 50 else "CLEAR"
            return score, status

    # Process all transactions to add risk info
    processed_txs = []
    total_sent = 0.0
    total_received = 0.0
    high_risk_tx_count = 0

    for tx in transactions:
        t_score, t_status = get_tx_risk_info(tx)
        
        if tx.sender == account_id:
            total_sent += tx.amount
        if tx.receiver == account_id:
            total_received += tx.amount
            
        if t_score > 50:
            high_risk_tx_count += 1
            
        processed_txs.append({
            "txn_id": tx.id,
            "timestamp": tx.timestamp,
            "amount": tx.amount,
            "sender_id": tx.sender,
            "receiver_id": tx.receiver,
            "counterparty_id": tx.receiver if tx.sender == account_id else tx.sender,
            "risk_score": t_score,
            "alert_status": t_status
        })

    # ── STEP 2: QUERY NEO4J ──────────────────────────────────────────────────
    transferred_to_list: List[str] = []
    shared_device_list: List[str] = []
    cycle_detected_str = "No"

    if neo4j_driver:
        try:
            with neo4j_driver.session() as session:
                # a) Direct transfers (1 hop)
                # Try query specified in prompt
                try:
                    result_transfers = session.run(
                        "MATCH (a:Account {id: $id})-[:TRANSFERRED_TO]->(b) RETURN b.id AS id",
                        id=account_id
                    )
                    transferred_to_list = [r["id"] for r in result_transfers if r["id"]]
                except Exception:
                    # Fallback to current database schema
                    result_transfers = session.run(
                        "MATCH (a:Account {account_id: $id})-[:SENT_TO]->(b) RETURN b.account_id AS id",
                        id=account_id
                    )
                    transferred_to_list = [r["id"] for r in result_transfers if r["id"]]

                # b) Shared device connections
                # Try query specified in prompt
                try:
                    result_shared = session.run(
                        "MATCH (a:Account {id: $id})-[:LOGGED_FROM]->(d)<-[:LOGGED_FROM]-(b) "
                        "WHERE b.id <> $id RETURN b.id AS id",
                        id=account_id
                    )
                    shared_device_list = [r["id"] for r in result_shared if r["id"]]
                except Exception:
                    # Fallback to current database schema
                    result_shared = session.run(
                        "MATCH (a:Account {account_id: $id})-[:USED_DEVICE]->(d:Device)<-[:USED_DEVICE]-(b:Account) "
                        "WHERE b.account_id <> $id RETURN b.account_id AS id",
                        id=account_id
                    )
                    shared_device_list = [r["id"] for r in result_shared if r["id"]]

                # c) Cycle detection
                # Try query specified in prompt
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
                    # Fallback to current database schema
                    result_cycle = session.run(
                        "MATCH path=(a:Account {account_id: $id})-[:SENT_TO*2..4]->(a) RETURN path LIMIT 1",
                        id=account_id
                    )
                    record = result_cycle.single()
                    if record and record["path"]:
                        nodes = record["path"].nodes
                        cycle_path = " -> ".join([n["account_id"] for n in nodes])
                        cycle_detected_str = f"Yes - path: {cycle_path}"
        except Exception as e:
            # If Neo4j is offline or error occurs, print warning and proceed with defaults
            print(f"Neo4j connection error during document building for account {account_id}: {e}")

    # ── STEP 3: FRAUD INDICATORS ─────────────────────────────────────────────
    # High frequency check (> 3 transactions in rolling 5 mins)
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

    # Rapid in-out check (received funds and transferred them out within 60 minutes)
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

    # Large spike check (> 50,000)
    large_spike = "Yes" if any(tx["amount"] > 50000 for tx in processed_txs) else "No"

    # Shared device flag check
    shared_device_flag = "Yes" if len(shared_device_list) > 0 else "No"

    # Formatting network lists
    direct_transfers_str = ", ".join(transferred_to_list) if transferred_to_list else "None"
    shared_device_str = ", ".join(shared_device_list) if shared_device_list else "None"

    # Format recent transactions list (last 10)
    recent_txs = processed_txs[:10]
    recent_txs_lines = []
    for tx in recent_txs:
        formatted_ts = tx["timestamp"].strftime("%Y-%m-%d %H:%M:%S")
        direction_label = "To" if tx["sender_id"] == account_id else "From"
        line = f"- TXN {tx['txn_id']} | {formatted_ts} | Rs.{tx['amount']} | {direction_label}: {tx['counterparty_id']} | Risk: {tx['risk_score']} | {tx['alert_status']}"
        recent_txs_lines.append(line)
    recent_txs_str = "\n".join(recent_txs_lines) if recent_txs_lines else "No recent transactions."

    # ── STEP 4: BUILD page_content STRING ──────────────────────────────────
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

    # ── STEP 5: RETURN LANGCHAIN DOCUMENT ──────────────────────────────────
    metadata = {
        "doc_id": f"account_{account_id}",
        "account_id": account_id,
        "holder_name": name,
        "risk_score": cumulative_risk_score,
        "is_flagged": is_flagged,
        "alert_status": alert_status,
        "source": "muledna_postgresql_neo4j"
    }

    return Document(
        page_content=page_content,
        metadata=metadata
    )
