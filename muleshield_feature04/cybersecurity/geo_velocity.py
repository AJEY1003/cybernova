"""
geo_velocity.py
Geo-Velocity Detection — Impossible Travel Analysis
Detects when the same account/controller appears in two geographically
distant locations within an impossibly short time window.
Cybersecurity technique: Impossible Travel Detection
"""

import math
import json
import sys
import os
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import GEO_VELOCITY_MAX_KM_PER_MIN


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance between two coordinates in km."""
    R = 6371  # Earth radius in km
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def detect_impossible_travel(transactions: list) -> list:
    """
    Detect impossible travel events across all transactions grouped by sender_upi.
    Returns list of violation events with details.
    """
    from collections import defaultdict

    # Group by sender UPI (controller identity)
    by_sender = defaultdict(list)
    for txn in transactions:
        upi = txn.get("sender_upi", "")
        loc = txn.get("location", {})
        ts = txn.get("timestamp", "")
        if upi and loc and ts:
            by_sender[upi].append({
                "transaction_id": txn.get("transaction_id"),
                "account_id": txn.get("account_id"),
                "timestamp": datetime.fromisoformat(ts),
                "lat": loc.get("lat", 0.0),
                "lon": loc.get("lon", 0.0),
                "city": loc.get("city", "Unknown"),
                "proxy": loc.get("proxy", False),
            })

    violations = []

    for upi, events in by_sender.items():
        events.sort(key=lambda x: x["timestamp"])

        for i in range(len(events) - 1):
            e1, e2 = events[i], events[i + 1]

            # Skip if either is a proxy (location unreliable)
            if e1["proxy"] or e2["proxy"]:
                continue

            time_diff_min = (e2["timestamp"] - e1["timestamp"]).total_seconds() / 60
            if time_diff_min <= 0:
                continue

            dist_km = haversine_km(e1["lat"], e1["lon"], e2["lat"], e2["lon"])
            speed_km_per_min = dist_km / time_diff_min

            if speed_km_per_min > GEO_VELOCITY_MAX_KM_PER_MIN and dist_km > 100:
                violations.append({
                    "sender_upi": upi,
                    "event_1": {
                        "transaction_id": e1["transaction_id"],
                        "city": e1["city"],
                        "timestamp": e1["timestamp"].isoformat(),
                    },
                    "event_2": {
                        "transaction_id": e2["transaction_id"],
                        "city": e2["city"],
                        "timestamp": e2["timestamp"].isoformat(),
                    },
                    "distance_km": round(dist_km, 2),
                    "time_diff_minutes": round(time_diff_min, 2),
                    "speed_km_per_min": round(speed_km_per_min, 2),
                    "flag": "IMPOSSIBLE_TRAVEL_DETECTED",
                    "risk_score": min(1.0, speed_km_per_min / 100),
                })

    return violations


def check_single_transaction_velocity(
    new_txn: dict,
    last_txn: dict,
) -> dict:
    """
    Check geo-velocity between a new transaction and the last known transaction
    for the same sender. Used in real-time attribution pipeline.
    """
    loc1 = last_txn.get("location", {})
    loc2 = new_txn.get("location", {})

    if not loc1 or not loc2:
        return {"velocity_flag": False, "risk_score": 0.0}

    if loc1.get("proxy") or loc2.get("proxy"):
        return {"velocity_flag": False, "risk_score": 0.0, "note": "proxy_location_unreliable"}

    ts1 = datetime.fromisoformat(last_txn["timestamp"])
    ts2 = datetime.fromisoformat(new_txn["timestamp"])
    time_diff_min = abs((ts2 - ts1).total_seconds()) / 60

    if time_diff_min <= 0:
        return {"velocity_flag": False, "risk_score": 0.0}

    dist_km = haversine_km(
        loc1.get("lat", 0), loc1.get("lon", 0),
        loc2.get("lat", 0), loc2.get("lon", 0),
    )
    speed = dist_km / time_diff_min

    flag = speed > GEO_VELOCITY_MAX_KM_PER_MIN and dist_km > 100

    return {
        "velocity_flag": flag,
        "distance_km": round(dist_km, 2),
        "time_diff_minutes": round(time_diff_min, 2),
        "speed_km_per_min": round(speed, 2),
        "risk_score": min(1.0, speed / 100) if flag else 0.0,
        "flag": "IMPOSSIBLE_TRAVEL_DETECTED" if flag else None,
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

    print("Running geo-velocity analysis...")
    violations = detect_impossible_travel(transactions)
    print(f"Impossible travel violations found: {len(violations)}")
    for v in violations[:3]:
        print(f"  {v['sender_upi']}: {v['event_1']['city']} → {v['event_2']['city']}")
        print(f"    Distance: {v['distance_km']} km in {v['time_diff_minutes']} min")
        print(f"    Speed: {v['speed_km_per_min']} km/min — {v['flag']}")
