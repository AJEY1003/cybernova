"""
fingerprint_matcher.py
Controller Attribution via Fingerprint Matching
When a new transaction hits a honey trap account, this module:
1. Extracts features from the transaction
2. Compares against cluster centroid using cosine similarity
3. Returns match score and attribution decision
Cybersecurity technique: Adversary Attribution + Identity Correlation
"""

import json
import math
import re
import sys
import os
from datetime import datetime

import numpy as np

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import COSINE_SIMILARITY_THRESHOLD, CONTROLLERS


def cosine_similarity(vec_a: list, vec_b: list) -> float:
    """Compute cosine similarity between two vectors."""
    a = np.array(vec_a, dtype=float)
    b = np.array(vec_b, dtype=float)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def extract_transaction_features(txn: dict) -> dict:
    """
    Extract behavioral features from a single transaction for attribution matching.
    """
    ts = txn.get("timestamp", "")
    try:
        dt = datetime.fromisoformat(ts)
        hour = dt.hour
        day_of_week = dt.weekday()
    except Exception:
        hour = 0
        day_of_week = 0

    amount = float(txn.get("amount", 0))
    ip = txn.get("sender_ip", "")
    subnet = ".".join(ip.split(".")[:2]) if ip else "0.0"
    isp = txn.get("isp", "unknown")
    device_type = txn.get("device_type", "unknown")
    is_proxy = txn.get("is_proxy", False)
    upi = txn.get("sender_upi", "")

    # UPI prefix digit
    upi_match = re.match(r"^(\d)", upi)
    upi_prefix_digit = upi_match.group(1) if upi_match else "0"

    # UPI suffix
    suffix_match = re.search(r"(@\w+)$", upi)
    upi_suffix = suffix_match.group(1) if suffix_match else "@unknown"

    # Night transaction flag
    night_flag = 1.0 if 0 <= hour < 5 else 0.0

    # Just below threshold
    just_below = 1.0 if 9000 <= amount < 10000 else 0.0

    return {
        "hour": hour,
        "day_of_week": day_of_week,
        "amount": amount,
        "night_flag": night_flag,
        "just_below_threshold": just_below,
        "ip_subnet": subnet,
        "isp": isp,
        "device_type": device_type,
        "is_proxy": float(is_proxy),
        "upi_prefix_digit": upi_prefix_digit,
        "upi_suffix": upi_suffix,
    }


def match_against_cluster(txn_features: dict, cluster: dict) -> dict:
    """
    Match transaction features against a cluster's centroid and fingerprint.
    Returns per-signal match scores and overall cosine similarity.
    """
    centroid = cluster.get("centroid", {})
    fingerprint = cluster.get("controller_fingerprint", {})

    # ── Signal 1: IP Subnet Match ──────────────────────────────────────────
    # Check if transaction subnet matches cluster's dominant subnet
    # We use centroid's ip_subnet_consistency as proxy
    ip_subnet_match = centroid.get("ip_subnet_consistency", 0.5)

    # ── Signal 2: UPI Pattern Match ────────────────────────────────────────
    cluster_upi_suffix = fingerprint.get("upi_suffix", "@unknown")
    cluster_ctrl_id = cluster.get("dominant_controller_id", "")
    ctrl_config = CONTROLLERS.get(cluster_ctrl_id, {})

    # Check UPI prefix digit matches controller's known pattern
    expected_prefix = {
        "CTRL_001": "9", "CTRL_002": "8", "CTRL_003": "7", "CTRL_004": "6"
    }.get(cluster_ctrl_id, "0")

    upi_prefix_match = 1.0 if txn_features["upi_prefix_digit"] == expected_prefix else 0.0
    upi_suffix_match = 1.0 if txn_features["upi_suffix"] == cluster_upi_suffix else 0.5
    upi_pattern_match = (upi_prefix_match * 0.7 + upi_suffix_match * 0.3)

    # ── Signal 3: Timing Match ─────────────────────────────────────────────
    cluster_hour = centroid.get("preferred_hour_mean", 12)
    cluster_hour_std = centroid.get("preferred_hour_std", 3)
    txn_hour = txn_features["hour"]

    hour_diff = abs(txn_hour - cluster_hour)
    # Circular hour distance
    hour_diff = min(hour_diff, 24 - hour_diff)
    timing_match = max(0.0, 1.0 - (hour_diff / max(cluster_hour_std * 2, 3)))

    # ── Signal 4: Amount Match ─────────────────────────────────────────────
    cluster_amount_mean = centroid.get("amount_mean", 5000)
    cluster_amount_std = centroid.get("amount_std", 1000)
    txn_amount = txn_features["amount"]

    if cluster_amount_std > 0:
        z_score = abs(txn_amount - cluster_amount_mean) / cluster_amount_std
        amount_match = max(0.0, 1.0 - (z_score / 3))
    else:
        amount_match = 1.0 if txn_amount == cluster_amount_mean else 0.0

    # ── Cosine Similarity against centroid vector ──────────────────────────
    centroid_keys = [
        "preferred_hour_mean", "amount_mean", "night_transaction_ratio",
        "just_below_threshold_ratio", "ip_subnet_consistency", "isp_consistency",
        "proxy_usage_ratio",
    ]
    centroid_vec = [centroid.get(k, 0.0) for k in centroid_keys]
    txn_vec = [
        txn_features["hour"] / 24,
        txn_features["amount"] / 50000,
        txn_features["night_flag"],
        txn_features["just_below_threshold"],
        ip_subnet_match,
        1.0 if txn_features["isp"] == fingerprint.get("isp", "") else 0.0,
        txn_features["is_proxy"],
    ]
    cosine_sim = cosine_similarity(txn_vec, centroid_vec)

    return {
        "cluster_id": cluster["cluster_id"],
        "controller_name": cluster.get("controller_name", "Unknown"),
        "ip_subnet_match": round(ip_subnet_match, 3),
        "upi_pattern_match": round(upi_pattern_match, 3),
        "timing_match": round(timing_match, 3),
        "amount_match": round(amount_match, 3),
        "cosine_similarity": round(cosine_sim, 3),
        "fingerprint_match": cosine_sim >= COSINE_SIMILARITY_THRESHOLD,
    }


def find_best_cluster_match(txn: dict, clusters: list) -> dict:
    """
    Match a transaction against all clusters and return the best match.
    """
    txn_features = extract_transaction_features(txn)
    matches = [match_against_cluster(txn_features, cluster) for cluster in clusters]

    # Sort by cosine similarity
    matches.sort(key=lambda x: x["cosine_similarity"], reverse=True)
    best = matches[0] if matches else {}

    return {
        "transaction_id": txn.get("transaction_id", ""),
        "honey_trap_account": txn.get("account_id", ""),
        "best_match": best,
        "all_matches": matches,
        "txn_features": txn_features,
    }


if __name__ == "__main__":
    # Test with a known controller transaction
    test_txn = {
        "transaction_id": "txn_test_001",
        "account_id": "ACC_CTRL_001_001",
        "sender_upi": "9800000001@paytm",
        "receiver_upi": "9123456@paytm",
        "sender_ip": "49.36.100.50",
        "amount": 9500,
        "timestamp": "2025-05-15T02:30:00",
        "isp": "Jio Mobile",
        "device_type": "mobile",
        "is_proxy": False,
    }

    # Load clusters if available
    clusters_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "data", "clusters.json"
    )
    if os.path.exists(clusters_path):
        with open(clusters_path) as f:
            clusters = json.load(f)
        result = find_best_cluster_match(test_txn, clusters)
        print(f"Best match: {result['best_match']['cluster_id']}")
        print(f"Cosine similarity: {result['best_match']['cosine_similarity']}")
        print(f"Fingerprint match: {result['best_match']['fingerprint_match']}")
    else:
        print("Run dbscan_clustering.py first to generate clusters.json")
        features = extract_transaction_features(test_txn)
        print(f"Extracted features: {features}")
