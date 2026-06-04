"""
risk_fusion_engine.py
Risk Fusion Engine + Anomaly Scoring
Combines all cybersecurity signals into a single composite fraud score.
Determines controller identification confidence and recommended action.
Cybersecurity technique: Anomaly-Based Detection + Risk Fusion
"""

import sys
import os
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    RISK_WEIGHTS, HIGH_CONFIDENCE_THRESHOLD, SUSPECTED_THRESHOLD
)


def compute_risk_score(signals: dict) -> dict:
    """
    Compute composite fraud risk score from all detection signals.

    signals dict keys:
    - ip_subnet_match: float 0-1
    - upi_pattern_match: float 0-1
    - timing_match: float 0-1
    - amount_match: float 0-1
    - asn_type_match: float 0-1 (0=residential, 1=datacenter/vpn)
    - proxy_flag: float 0-1
    - device_reuse: float 0-1
    - cosine_similarity: float 0-1 (from fingerprint matcher)
    - emulator_risk: float 0-1
    - geo_velocity_risk: float 0-1
    - session_match: float 0-1
    """
    weights = RISK_WEIGHTS.copy()

    # Core weighted score
    weighted_score = sum(
        signals.get(key, 0.0) * weight
        for key, weight in weights.items()
    )

    # Bonus signals (not in base weights — additive bonuses)
    bonus = 0.0
    if signals.get("cosine_similarity", 0) >= 0.85:
        bonus += 0.10
    if signals.get("emulator_risk", 0) >= 0.4:
        bonus += 0.05
    if signals.get("geo_velocity_risk", 0) >= 0.5:
        bonus += 0.05
    if signals.get("session_match", 0) >= 1.0:
        bonus += 0.05

    final_score = min(1.0, weighted_score + bonus)

    # Determine confidence tier
    if final_score >= HIGH_CONFIDENCE_THRESHOLD:
        confidence_tier = "HIGH_CONFIDENCE"
        recommended_action = "FLAG_FOR_LEA"
    elif final_score >= SUSPECTED_THRESHOLD:
        confidence_tier = "SUSPECTED"
        recommended_action = "MONITOR_AND_INVESTIGATE"
    else:
        confidence_tier = "UNRELATED"
        recommended_action = "NO_ACTION"

    # Build signal breakdown
    signal_breakdown = {}
    for key, weight in weights.items():
        val = signals.get(key, 0.0)
        signal_breakdown[key] = {
            "value": round(float(val), 3),
            "weight": weight,
            "contribution": round(float(val) * weight, 4),
        }

    return {
        "composite_score": round(float(final_score), 4),
        "confidence_tier": confidence_tier,
        "recommended_action": recommended_action,
        "signal_breakdown": signal_breakdown,
        "bonus_score": round(float(bonus), 4),
        "weighted_base_score": round(float(weighted_score), 4),
    }


def build_signals_from_pipeline(
    fingerprint_match: dict,
    asn_result: dict,
    device_result: dict,
    geo_result: dict,
    emulator_result: dict,
    session_result: dict,
    transaction: dict,
) -> dict:
    """
    Assemble all pipeline outputs into a unified signals dict for risk scoring.
    """
    is_proxy = transaction.get("is_proxy", False)

    signals = {
        # From fingerprint matcher
        "ip_subnet_match": fingerprint_match.get("ip_subnet_match", 0.0),
        "upi_pattern_match": fingerprint_match.get("upi_pattern_match", 0.0),
        "timing_match": fingerprint_match.get("timing_match", 0.0),
        "amount_match": fingerprint_match.get("amount_match", 0.0),
        "cosine_similarity": fingerprint_match.get("cosine_similarity", 0.0),

        # From ASN intelligence
        "asn_type_match": asn_result.get("asn_risk_score", 0.0),

        # Proxy flag
        "proxy_flag": 1.0 if is_proxy else 0.0,

        # From device fingerprinting
        "device_reuse": device_result.get("device_match_score", 0.0),

        # From geo-velocity
        "geo_velocity_risk": geo_result.get("risk_score", 0.0),

        # From emulator detection
        "emulator_risk": emulator_result.get("risk_score", 0.0),

        # From session fingerprinting
        "session_match": session_result.get("session_match_score", 0.0),
    }

    return signals


def score_honey_trap_transaction(
    transaction: dict,
    matched_cluster: dict,
    all_clusters: list,
    transactions_history: list,
) -> dict:
    """
    Full risk scoring pipeline for a transaction hitting a honey trap account.
    Orchestrates all cybersecurity modules and returns final risk assessment.
    """
    from models.fingerprint_matcher import find_best_cluster_match, extract_transaction_features
    from cybersecurity.asn_intelligence import score_transaction_asn
    from cybersecurity.device_fingerprinting import score_transaction_device
    from cybersecurity.geo_velocity import check_single_transaction_velocity
    from cybersecurity.emulator_detection import detect_emulator
    from cybersecurity.session_fingerprinting import match_session_to_cluster

    # Step 1: Fingerprint match
    match_result = find_best_cluster_match(transaction, all_clusters)
    best_match = match_result["best_match"]

    # Step 2: ASN intelligence
    asn_result = score_transaction_asn(transaction)

    # Step 3: Device fingerprinting
    cluster_fps = {
        c["cluster_id"]: [
            t.get("device_fingerprint", "")
            for t in transactions_history
            if t.get("account_id") in c.get("accounts", [])
        ]
        for c in all_clusters
    }
    device_result = score_transaction_device(transaction, cluster_fps)

    # Step 4: Geo-velocity (compare against last known transaction in cluster)
    cluster_txns = [
        t for t in transactions_history
        if t.get("account_id") in matched_cluster.get("accounts", [])
    ]
    last_txn = sorted(cluster_txns, key=lambda x: x.get("timestamp", ""))[-1] if cluster_txns else {}
    geo_result = check_single_transaction_velocity(transaction, last_txn) if last_txn else {"risk_score": 0.0}

    # Step 5: Emulator detection
    emulator_result = detect_emulator(transaction)

    # Step 6: Session fingerprinting
    cluster_ja3s = {
        c["cluster_id"]: [
            t.get("ja3_hash", "")
            for t in transactions_history
            if t.get("account_id") in c.get("accounts", [])
        ]
        for c in all_clusters
    }
    session_result = match_session_to_cluster(transaction, cluster_ja3s)

    # Step 7: Assemble signals
    signals = build_signals_from_pipeline(
        best_match, asn_result, device_result,
        geo_result, emulator_result, session_result, transaction
    )

    # Step 8: Compute composite score
    risk_assessment = compute_risk_score(signals)

    return {
        "transaction_id": transaction.get("transaction_id", ""),
        "honey_trap_account": transaction.get("account_id", ""),
        "matched_cluster": best_match.get("cluster_id", ""),
        "controller_name": best_match.get("controller_name", "Unknown"),
        "risk_assessment": risk_assessment,
        "signal_details": {
            "fingerprint_match": best_match,
            "asn_intelligence": asn_result,
            "device_fingerprint": device_result,
            "geo_velocity": geo_result,
            "emulator_detection": emulator_result,
            "session_fingerprint": session_result,
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


if __name__ == "__main__":
    # Test with mock signals
    test_signals = {
        "ip_subnet_match": 0.85,
        "upi_pattern_match": 0.90,
        "timing_match": 0.80,
        "amount_match": 0.75,
        "asn_type_match": 0.10,   # residential — low risk
        "proxy_flag": 0.0,
        "device_reuse": 0.80,
        "cosine_similarity": 0.88,
        "emulator_risk": 0.0,
        "geo_velocity_risk": 0.0,
        "session_match": 1.0,
    }

    result = compute_risk_score(test_signals)
    print(f"Composite Score: {result['composite_score']}")
    print(f"Confidence Tier: {result['confidence_tier']}")
    print(f"Recommended Action: {result['recommended_action']}")
    print("\nSignal Breakdown:")
    for signal, data in result["signal_breakdown"].items():
        print(f"  {signal}: {data['value']} × {data['weight']} = {data['contribution']}")
