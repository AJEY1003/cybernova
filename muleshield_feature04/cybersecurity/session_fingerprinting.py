"""
session_fingerprinting.py
Session Fingerprinting + TLS/JA3 Correlation
Correlates sessions across transactions using JA3-style fingerprints
and behavioral session patterns to link activity to a single operator.
Cybersecurity technique: Session Fingerprinting + TLS/JA3 Correlation
"""

import hashlib
import json
import sys
import os
from collections import defaultdict

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def compute_ja3_fingerprint(transaction: dict) -> str:
    """
    Compute a JA3-style session fingerprint.
    In a real TLS context, JA3 uses: SSLVersion, Ciphers, Extensions, EllipticCurves, EllipticCurvePointFormats
    Here we simulate it using available transaction metadata that is stable per device/session:
    - device_type + isp + IP /16 subnet (stable per device)
    This produces a fingerprint that persists across VPN reconnections.
    """
    ip = transaction.get("sender_ip", "")
    subnet = ".".join(ip.split(".")[:2]) if ip else "0.0"
    device_type = transaction.get("device_type", "unknown")
    isp = transaction.get("isp", "unknown").lower().strip()

    # JA3-style: concatenate stable session attributes
    ja3_raw = f"{device_type}|{isp}|{subnet}"
    return hashlib.sha256(ja3_raw.encode()).hexdigest()[:32]


def build_session_map(transactions: list) -> dict:
    """
    Build a map of ja3_hash → {accounts, controller_ids, transaction_ids}.
    Reveals which sessions (devices) are shared across accounts.
    """
    session_map = defaultdict(lambda: {
        "accounts": set(),
        "controller_ids": set(),
        "transaction_ids": [],
        "transaction_count": 0,
    })

    for txn in transactions:
        ja3 = txn.get("ja3_hash") or compute_ja3_fingerprint(txn)
        account_id = txn.get("account_id", "")
        ctrl_id = txn.get("controller_id", "")

        session_map[ja3]["accounts"].add(account_id)
        session_map[ja3]["controller_ids"].add(ctrl_id)
        session_map[ja3]["transaction_ids"].append(txn.get("transaction_id", ""))
        session_map[ja3]["transaction_count"] += 1

    # Convert sets to lists for JSON serialization
    return {
        ja3: {
            "ja3_hash": ja3,
            "accounts": list(v["accounts"]),
            "controller_ids": list(v["controller_ids"]),
            "transaction_count": v["transaction_count"],
            "shared_across_accounts": len(v["accounts"]) > 1,
        }
        for ja3, v in session_map.items()
    }


def detect_session_correlation(transactions: list) -> dict:
    """
    Detect sessions shared across multiple accounts — strong indicator
    that one operator controls multiple accounts.
    """
    session_map = build_session_map(transactions)

    correlated_sessions = [
        s for s in session_map.values() if s["shared_across_accounts"]
    ]

    # Build account → correlated accounts mapping
    account_correlations = defaultdict(set)
    for session in correlated_sessions:
        accounts = session["accounts"]
        for acc in accounts:
            for other in accounts:
                if other != acc:
                    account_correlations[acc].add(other)

    return {
        "total_sessions": len(session_map),
        "correlated_sessions": len(correlated_sessions),
        "correlated_session_details": correlated_sessions[:10],  # top 10
        "account_correlations": {
            acc: list(others) for acc, others in account_correlations.items()
        },
    }


def match_session_to_cluster(new_txn: dict, cluster_ja3_hashes: dict) -> dict:
    """
    Match a new transaction's session fingerprint against known cluster JA3 hashes.
    cluster_ja3_hashes: {cluster_id: [ja3_hash1, ja3_hash2, ...]}
    """
    ja3 = new_txn.get("ja3_hash") or compute_ja3_fingerprint(new_txn)

    for cluster_id, hashes in cluster_ja3_hashes.items():
        if ja3 in hashes:
            return {
                "ja3_hash": ja3,
                "matched_cluster": cluster_id,
                "session_match_score": 1.0,
                "flag": "SESSION_FINGERPRINT_MATCH",
            }

    return {
        "ja3_hash": ja3,
        "matched_cluster": None,
        "session_match_score": 0.0,
        "flag": None,
    }


if __name__ == "__main__":
    data_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "data", "synthetic_transactions.json"
    )
    if not os.path.exists(data_path):
        print("Run generate_synthetic_data.py first.")
        sys.exit(1)

    with open(data_path) as f:
        transactions = json.load(f)

    print(f"Analyzing session fingerprints across {len(transactions)} transactions...")
    result = detect_session_correlation(transactions)

    print(f"Total unique sessions: {result['total_sessions']}")
    print(f"Sessions shared across multiple accounts: {result['correlated_sessions']}")
    print(f"\nTop correlated sessions:")
    for s in result["correlated_session_details"][:3]:
        print(f"  JA3: {s['ja3_hash'][:16]}... → accounts: {s['accounts']}")
