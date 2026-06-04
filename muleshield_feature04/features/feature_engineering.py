"""
feature_engineering.py
Extracts 20+ behavioral fingerprint features per account from transaction data.
These features feed into DBSCAN clustering and controller attribution.
Run standalone: python feature_engineering.py
"""

import json
import math
import re
import sys
import os
from collections import Counter
from datetime import datetime

import pandas as pd
import numpy as np

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import ALERT_THRESHOLD_AMOUNT


def load_transactions(path: str) -> pd.DataFrame:
    with open(path) as f:
        data = json.load(f)
    df = pd.DataFrame(data)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek
    df["amount"] = df["amount"].astype(float)
    return df


def shannon_entropy(values: list) -> float:
    """Shannon entropy — measures how spread/random a distribution is."""
    if not values:
        return 0.0
    counts = Counter(values)
    total = len(values)
    return -sum((c / total) * math.log2(c / total) for c in counts.values() if c > 0)


def extract_upi_pattern(upi: str) -> dict:
    """Extract prefix digit and suffix provider from UPI handle."""
    match = re.match(r"^(\d+)(@\w+)$", str(upi))
    if match:
        return {
            "upi_prefix_digit": match.group(1)[0],
            "upi_suffix": match.group(2),
            "upi_length": len(match.group(1)),
        }
    return {"upi_prefix_digit": "0", "upi_suffix": "@unknown", "upi_length": 0}


def extract_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extract behavioral fingerprint features per account_id.
    Returns a DataFrame with one row per account and all feature columns.
    """
    records = []

    for account_id, grp in df.groupby("account_id"):
        grp = grp.sort_values("timestamp")
        hours = grp["hour"].tolist()
        amounts = grp["amount"].tolist()
        days = grp["day_of_week"].tolist()
        timestamps = grp["timestamp"].tolist()
        isps = grp["isp"].tolist()
        ips = grp["sender_ip"].tolist()
        devices = grp["device_type"].tolist()
        proxies = grp["is_proxy"].tolist()
        ifsc_list = grp["bank_ifsc"].tolist()
        receiver_upis = grp["receiver_upi"].tolist()
        sender_upis = grp["sender_upi"].tolist()
        locations = grp["location"].apply(lambda x: x if isinstance(x, dict) else {}).tolist()
        device_fps = grp["device_fingerprint"].tolist() if "device_fingerprint" in grp.columns else []

        n = len(grp)

        # ── Temporal Features ──────────────────────────────────────────────
        preferred_hour_mean = float(np.mean(hours))
        preferred_hour_std = float(np.std(hours))
        day_of_week_entropy = shannon_entropy(days)
        night_ratio = sum(1 for h in hours if 0 <= h < 5) / n

        # Inter-transaction gaps (minutes)
        if len(timestamps) > 1:
            gaps = [
                (timestamps[i+1] - timestamps[i]).total_seconds() / 60
                for i in range(len(timestamps) - 1)
            ]
            gap_mean = float(np.mean(gaps))
            gap_std = float(np.std(gaps))
        else:
            gap_mean = 0.0
            gap_std = 0.0

        # ── Amount Features ────────────────────────────────────────────────
        amount_mean = float(np.mean(amounts))
        amount_std = float(np.std(amounts))
        round_number_ratio = sum(
            1 for a in amounts if a % 1000 == 0 or a % 500 == 0
        ) / n
        just_below_threshold_ratio = sum(
            1 for a in amounts if ALERT_THRESHOLD_AMOUNT * 0.9 <= a < ALERT_THRESHOLD_AMOUNT
        ) / n
        amount_cluster_tightness = (amount_std / amount_mean) if amount_mean > 0 else 0.0

        # ── Network / Routing Features ─────────────────────────────────────
        unique_beneficiary_count = len(set(receiver_upis))
        ifsc_diversity = len(set(ifsc_list))

        # UPI handle pattern from sender
        upi_info = extract_upi_pattern(sender_upis[0] if sender_upis else "")
        upi_prefix_digit = upi_info["upi_prefix_digit"]
        upi_suffix = upi_info["upi_suffix"]

        # ── Device / Identity Features ─────────────────────────────────────
        # IP subnet consistency (/16 — first two octets)
        subnets = [".".join(ip.split(".")[:2]) for ip in ips]
        most_common_subnet = Counter(subnets).most_common(1)[0][0] if subnets else ""
        ip_subnet_consistency = subnets.count(most_common_subnet) / n

        # ISP consistency
        most_common_isp = Counter(isps).most_common(1)[0][0] if isps else ""
        isp_consistency = isps.count(most_common_isp) / n

        # Device type (most common)
        device_type = Counter(devices).most_common(1)[0][0] if devices else "unknown"

        # Proxy usage ratio
        proxy_usage_ratio = sum(1 for p in proxies if p) / n

        # Location entropy
        cities = [loc.get("city", "Unknown") for loc in locations]
        location_entropy = shannon_entropy(cities)

        # Device fingerprint reuse (unique fps / total — lower = more reuse)
        if device_fps:
            device_fp_reuse = 1.0 - (len(set(device_fps)) / n)
        else:
            device_fp_reuse = 0.0

        # Ground truth (for evaluation)
        controller_id = grp["controller_id"].iloc[0] if "controller_id" in grp.columns else "UNKNOWN"

        records.append({
            "account_id": account_id,
            "controller_id": controller_id,
            "transaction_count": n,
            # Temporal
            "preferred_hour_mean": preferred_hour_mean,
            "preferred_hour_std": preferred_hour_std,
            "day_of_week_entropy": day_of_week_entropy,
            "inter_transaction_gap_mean": gap_mean,
            "inter_transaction_gap_std": gap_std,
            "night_transaction_ratio": night_ratio,
            # Amount
            "amount_mean": amount_mean,
            "amount_std": amount_std,
            "round_number_ratio": round_number_ratio,
            "just_below_threshold_ratio": just_below_threshold_ratio,
            "amount_cluster_tightness": amount_cluster_tightness,
            # Network
            "unique_beneficiary_count": unique_beneficiary_count,
            "ifsc_diversity": ifsc_diversity,
            "upi_prefix_digit": upi_prefix_digit,
            "upi_suffix": upi_suffix,
            # Device / Identity
            "ip_subnet_consistency": ip_subnet_consistency,
            "isp_consistency": isp_consistency,
            "device_type": device_type,
            "proxy_usage_ratio": proxy_usage_ratio,
            "location_entropy": location_entropy,
            "device_fp_reuse": device_fp_reuse,
            # Raw for attribution
            "dominant_isp": most_common_isp,
            "dominant_subnet": most_common_subnet,
        })

    return pd.DataFrame(records)


if __name__ == "__main__":
    data_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "data", "synthetic_transactions.json"
    )
    if not os.path.exists(data_path):
        print("Run generate_synthetic_data.py first.")
        sys.exit(1)

    print("Loading transactions...")
    df = load_transactions(data_path)
    print(f"Loaded {len(df)} transactions across {df['account_id'].nunique()} accounts")

    print("Extracting features...")
    features = extract_features(df)
    print(f"Feature matrix shape: {features.shape}")
    print("\nFeature columns:")
    print([c for c in features.columns if c not in ["account_id", "controller_id"]])
    print("\nSample (first 3 accounts):")
    print(features[["account_id", "controller_id", "preferred_hour_mean",
                     "amount_mean", "proxy_usage_ratio", "isp_consistency"]].head(3).to_string())

    # Save feature matrix
    out_path = os.path.join(os.path.dirname(data_path), "feature_matrix.json")
    features.to_json(out_path, orient="records", indent=2)
    print(f"\nSaved feature matrix to {out_path}")
