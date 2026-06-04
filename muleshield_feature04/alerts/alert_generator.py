"""
alert_generator.py
Alert Generation — Structured output for Law Enforcement Agency (LEA)
Generates final controller identification alert with all evidence.
Also handles account blocking (FLAG status updates).
"""

import json
import sys
import os
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.ipgeo_client import resolve_ip


def generate_controller_alert(
    transaction: dict,
    risk_result: dict,
    cluster: dict,
    geo_data: dict = None,
) -> dict:
    """
    Generate a structured LEA alert when controller is identified.
    """
    if geo_data is None:
        geo_data = resolve_ip(transaction.get("sender_ip", ""))

    risk = risk_result.get("risk_assessment", {})
    score = risk.get("composite_score", 0.0)
    tier = risk.get("confidence_tier", "UNKNOWN")
    action = risk.get("recommended_action", "NO_ACTION")

    # Determine alert type
    if tier == "HIGH_CONFIDENCE":
        alert_type = "CONTROLLER_IDENTIFIED"
    elif tier == "SUSPECTED":
        alert_type = "SUSPECTED_CONTROLLER"
    else:
        alert_type = "UNRELATED_TRANSACTION"

    alert = {
        "alert_id": f"ALERT_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}_{transaction.get('transaction_id', '')}",
        "alert_type": alert_type,
        "alert_timestamp": datetime.utcnow().isoformat(),
        "confidence": score,
        "confidence_tier": tier,

        # Controller identity — full hardware fingerprint
        "controller": {
            "upi_handle": transaction.get("sender_upi", ""),
            "ip_address": transaction.get("sender_ip", ""),
            "isp": transaction.get("isp", ""),
            "device_type": transaction.get("device_type", ""),
            "proxy_used": transaction.get("is_proxy", False),
            "device_fingerprint": transaction.get("device_fingerprint", ""),
            "ja3_hash": transaction.get("ja3_hash", ""),
            # Hardware details from browser fingerprint
            "webgl_renderer": transaction.get("webgl_renderer", ""),
            "screen_resolution": transaction.get("screen_resolution", ""),
            "cpu_cores": transaction.get("cpu_cores", 0),
            "battery_level": transaction.get("battery_level"),
            "battery_charging": transaction.get("battery_charging"),
            "emulator_flags": transaction.get("emulator_flags", []),
            "emulator_used": len(transaction.get("emulator_flags", [])) >= 2,
        },

        # Geolocation (best effort — flagged if proxy)
        "location": {
            "city": geo_data.get("city", "Unknown"),
            "state": geo_data.get("state", "Unknown"),
            "country": geo_data.get("country", "Unknown"),
            "lat": geo_data.get("lat", 0.0),
            "lon": geo_data.get("lon", 0.0),
            "location_reliable": not geo_data.get("proxy", False),
            "note": "Location unreliable — VPN/proxy detected" if geo_data.get("proxy") else "Location resolved",
        },

        # Matched cluster
        "matched_cluster": {
            "cluster_id": cluster.get("cluster_id", ""),
            "controller_name": cluster.get("controller_name", ""),
            "account_count": cluster.get("account_count", 0),
            "fingerprint": cluster.get("controller_fingerprint", {}),
        },

        # Mule network — accounts to block
        "mule_network": {
            "total_accounts": len(cluster.get("accounts", [])),
            "honey_trap_account": cluster.get("honey_trap_account", ""),
            "accounts_to_block": [
                acc for acc in cluster.get("accounts", [])
                if acc != cluster.get("honey_trap_account")
            ],
            "account_statuses": cluster.get("account_statuses", {}),
        },

        # Evidence signals
        "evidence": {
            "cosine_similarity": risk_result.get("signal_details", {}).get(
                "fingerprint_match", {}
            ).get("cosine_similarity", 0.0),
            "signal_breakdown": risk.get("signal_breakdown", {}),
            "flags": _collect_all_flags(risk_result),
        },

        # Transaction that triggered the alert
        "trigger_transaction": {
            "transaction_id": transaction.get("transaction_id", ""),
            "amount": transaction.get("amount", 0),
            "timestamp": transaction.get("timestamp", ""),
            "sender_upi": transaction.get("sender_upi", ""),
            "receiver_upi": transaction.get("receiver_upi", ""),
            "method": transaction.get("method", "UPI"),
        },

        "recommended_action": action,
        "lea_reference": f"IOB-AML-{datetime.utcnow().strftime('%Y%m%d')}-{cluster.get('cluster_id', 'UNKNOWN')}",
    }

    return alert


def _collect_all_flags(risk_result: dict) -> list:
    """Collect all cybersecurity flags from all signal modules."""
    flags = []
    details = risk_result.get("signal_details", {})

    for module_name, module_data in details.items():
        if isinstance(module_data, dict):
            module_flags = module_data.get("flags", [])
            if isinstance(module_flags, list):
                flags.extend(module_flags)
            flag = module_data.get("flag")
            if flag:
                flags.append(flag)

    return list(set(flags))  # deduplicate


def block_accounts(cluster: dict, db_collection=None) -> dict:
    """
    Mark all non-honey-trap accounts in a cluster as BLOCKED.
    Updates in-memory cluster and optionally persists to MongoDB.
    Returns updated account statuses.
    """
    honey_trap = cluster.get("honey_trap_account", "")
    accounts = cluster.get("accounts", [])
    updated_statuses = {}

    for acc in accounts:
        if acc == honey_trap:
            updated_statuses[acc] = "HONEY_TRAP"
        else:
            updated_statuses[acc] = "BLOCKED"

    cluster["account_statuses"] = updated_statuses

    # Persist to MongoDB if collection provided
    if db_collection is not None:
        for acc, status in updated_statuses.items():
            db_collection.update_one(
                {"account_id": acc},
                {"$set": {"account_status": status, "blocked_at": datetime.utcnow().isoformat()}},
                upsert=True,
            )

    return updated_statuses


def format_alert_summary(alert: dict) -> str:
    """Human-readable alert summary for dashboard display."""
    lines = [
        f"{'='*60}",
        f"ALERT: {alert['alert_type']}",
        f"ID: {alert['alert_id']}",
        f"Confidence: {alert['confidence']:.2%} ({alert['confidence_tier']})",
        f"{'='*60}",
        f"Controller UPI: {alert['controller']['upi_handle']}",
        f"Controller IP:  {alert['controller']['ip_address']}",
        f"ISP:            {alert['controller']['isp']}",
        f"Proxy Used:     {alert['controller']['proxy_used']}",
        f"Location:       {alert['location']['city']}, {alert['location']['state']}",
        f"{'='*60}",
        f"Matched Cluster: {alert['matched_cluster']['cluster_id']} ({alert['matched_cluster']['controller_name']})",
        f"Mule Accounts:   {alert['mule_network']['total_accounts']}",
        f"Honey Trap:      {alert['mule_network']['honey_trap_account']}",
        f"Accounts Blocked: {len(alert['mule_network']['accounts_to_block'])}",
        f"{'='*60}",
        f"Flags: {', '.join(alert['evidence']['flags']) or 'None'}",
        f"Recommended Action: {alert['recommended_action']}",
        f"LEA Reference: {alert['lea_reference']}",
        f"{'='*60}",
    ]
    return "\n".join(lines)


if __name__ == "__main__":
    # Test with mock data
    mock_txn = {
        "transaction_id": "txn_test_001",
        "account_id": "ACC_CTRL_001_005",
        "sender_upi": "9800000001@paytm",
        "receiver_upi": "9123456@paytm",
        "sender_ip": "49.36.100.50",
        "amount": 9500,
        "timestamp": "2025-05-15T02:30:00",
        "isp": "Jio Mobile",
        "device_type": "mobile",
        "is_proxy": False,
        "device_fingerprint": "abc123def456",
        "ja3_hash": "a1b2c3d4e5f6",
        "method": "UPI",
    }

    mock_risk = {
        "risk_assessment": {
            "composite_score": 0.92,
            "confidence_tier": "HIGH_CONFIDENCE",
            "recommended_action": "FLAG_FOR_LEA",
            "signal_breakdown": {},
        },
        "signal_details": {
            "fingerprint_match": {"cosine_similarity": 0.91},
            "asn_intelligence": {"flags": []},
            "geo_velocity": {"flag": None},
            "emulator_detection": {"flags": []},
            "session_fingerprint": {"flag": "SESSION_FINGERPRINT_MATCH"},
        },
    }

    mock_cluster = {
        "cluster_id": "CTRL_CLUSTER_001",
        "controller_name": "The Night Owl",
        "account_count": 5,
        "accounts": ["ACC_CTRL_001_001", "ACC_CTRL_001_002", "ACC_CTRL_001_003",
                     "ACC_CTRL_001_004", "ACC_CTRL_001_005"],
        "honey_trap_account": "ACC_CTRL_001_005",
        "account_statuses": {},
        "controller_fingerprint": {
            "preferred_hour": "2:00",
            "amount_mean": 9500,
            "isp": "Jio Mobile",
            "proxy_user": False,
        },
    }

    alert = generate_controller_alert(mock_txn, mock_risk, mock_cluster)
    print(format_alert_summary(alert))
    print("\nFull alert JSON:")
    print(json.dumps(alert, indent=2))
