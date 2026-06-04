"""
device_fingerprinting.py
Device Fingerprinting + Identity Correlation
Detects device reuse across multiple mule accounts — same physical device
operating under different account identities.
Cybersecurity technique: Identity Correlation + Device Reuse Detection
"""

import hashlib
import json
import sys
import os
from collections import defaultdict

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def compute_device_fingerprint(transaction: dict) -> str:
    """
    Compute a stable device fingerprint from transaction metadata.
    Uses: device_type + ISP + IP /16 subnet + UPI prefix digit
    These are stable across VPN reconnections for the same physical device.
    """
    ip = transaction.get("sender_ip", "")
    subnet = ".".join(ip.split(".")[:2]) if ip else "0.0"
    isp = transaction.get("isp", "unknown").lower().strip()
    device_type = transaction.get("device_type", "unknown")
    upi = transaction.get("sender_upi", "")
    upi_prefix = upi[0] if upi else "0"

    raw = f"{subnet}|{isp}|{device_type}|{upi_prefix}"
    return hashlib.md5(raw.encode()).hexdigest()[:16]


def build_device_account_map(transactions: list) -> dict:
    """
    Build a mapping of device_fingerprint → list of account_ids.
    Identifies which accounts share the same device.
    """
    device_map = defaultdict(set)

    for txn in transactions:
        fp = txn.get("device_fingerprint") or compute_device_fingerprint(txn)
        account_id = txn.get("account_id", "")
        if account_id:
            device_map[fp].add(account_id)

    return {fp: list(accounts) for fp, accounts in device_map.items()}


def detect_device_reuse(transactions: list) -> dict:
    """
    Detect accounts sharing the same device fingerprint.
    Returns:
    - reuse_groups: list of {fingerprint, accounts, reuse_count}
    - account_reuse_flags: {account_id: True/False}
    - reuse_score_per_account: {account_id: 0.0-1.0}
    """
    device_map = build_device_account_map(transactions)

    reuse_groups = []
    account_reuse_flags = {}
    reuse_score_per_account = {}

    for fp, accounts in device_map.items():
        if len(accounts) > 1:
            reuse_groups.append({
                "fingerprint": fp,
                "accounts": accounts,
                "reuse_count": len(accounts),
            })
            for acc in accounts:
                account_reuse_flags[acc] = True
                # Score: more accounts sharing device = higher risk
                reuse_score_per_account[acc] = min(1.0, (len(accounts) - 1) * 0.25)
        else:
            for acc in accounts:
                account_reuse_flags[acc] = False
                reuse_score_per_account[acc] = 0.0

    return {
        "reuse_groups": reuse_groups,
        "account_reuse_flags": account_reuse_flags,
        "reuse_score_per_account": reuse_score_per_account,
        "total_reuse_groups": len(reuse_groups),
    }


def score_transaction_device(transaction: dict, known_fingerprints: dict) -> dict:
    """
    Score a new transaction's device fingerprint against known cluster fingerprints.
    known_fingerprints: {cluster_id: [fp1, fp2, ...]}
    Returns match score and matched cluster.
    """
    fp = transaction.get("device_fingerprint") or compute_device_fingerprint(transaction)

    for cluster_id, fps in known_fingerprints.items():
        if fp in fps:
            return {
                "device_fingerprint": fp,
                "matched_cluster": cluster_id,
                "device_match_score": 1.0,
                "flag": "KNOWN_DEVICE_REUSE",
            }

    return {
        "device_fingerprint": fp,
        "matched_cluster": None,
        "device_match_score": 0.0,
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

    print(f"Analyzing device fingerprints across {len(transactions)} transactions...")
    result = detect_device_reuse(transactions)

    print(f"\nDevice reuse groups found: {result['total_reuse_groups']}")
    for group in result["reuse_groups"][:5]:
        print(f"  Fingerprint {group['fingerprint']}: {group['reuse_count']} accounts → {group['accounts']}")

    flagged = sum(1 for v in result["account_reuse_flags"].values() if v)
    print(f"\nAccounts with device reuse: {flagged}")
