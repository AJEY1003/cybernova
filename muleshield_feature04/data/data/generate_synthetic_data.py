"""
generate_synthetic_data.py
Generates 500 synthetic CBS-style transactions across 4 controller archetypes.
Each transaction follows Razorpay payment object schema.
Run: python generate_synthetic_data.py
"""

import json
import random
import hashlib
from datetime import datetime, timedelta
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import CONTROLLERS

# ── Seed for reproducibility ───────────────────────────────────────────────
random.seed(42)

# ── Static lookup tables ───────────────────────────────────────────────────
IFSC_CODES = [
    "IOBA0001234", "IOBA0005678", "IOBA0009012",
    "SBIN0001234", "HDFC0001234", "ICIC0001234",
    "UTIB0001234", "KKBK0001234", "PUNB0001234",
]

UPI_SUFFIXES = ["@paytm", "@ybl", "@okaxis", "@okhdfcbank", "@oksbi", "@ibl"]

DEVICE_TYPES = ["mobile", "mobile", "mobile", "broadband", "tablet"]

EMULATOR_SUBNETS = ["10.0.2", "192.168.56"]  # known Android emulator subnets

CITY_IP_MAP = {
    "Mumbai":    ("49.36", "103.21"),
    "Delhi":     ("122.161", "117.196"),
    "Chennai":   ("49.204", "103.217"),
    "Bangalore": ("49.37", "103.22"),
    "Hyderabad": ("49.205", "103.218"),
    "Kolkata":   ("49.38", "103.23"),
    "Rotating":  None,  # Ghost uses VPN — random subnets
}

VPN_SUBNETS = ["185.220", "194.165", "45.142", "23.129", "198.98"]

ISP_MAP = {
    "Mumbai":    "Jio Mobile",
    "Delhi":     "Airtel Broadband",
    "Chennai":   "BSNL",
    "Rotating":  None,
}

ROTATING_ISPS = ["NordVPN", "ExpressVPN", "ProtonVPN", "Mullvad", "Surfshark"]
ROTATING_CITIES = ["London", "Frankfurt", "Singapore", "Amsterdam", "Tokyo"]
ROTATING_STATES = ["England", "Hesse", "Central Region", "North Holland", "Tokyo"]


def generate_ip(controller_id: str, is_proxy: bool) -> str:
    cfg = CONTROLLERS[controller_id]
    city = cfg["location"]["city"]

    if is_proxy or city == "Rotating":
        subnet = random.choice(VPN_SUBNETS)
        return f"{subnet}.{random.randint(1,254)}.{random.randint(1,254)}"

    subnets = CITY_IP_MAP.get(city)
    if subnets:
        subnet = random.choice(subnets)
        return f"{subnet}.{random.randint(1,254)}.{random.randint(1,254)}"

    return f"49.{random.randint(1,254)}.{random.randint(1,254)}.{random.randint(1,254)}"


def generate_upi(controller_id: str, account_num: int) -> str:
    """Controller-specific UPI prefix pattern for identity correlation."""
    prefixes = {
        "CTRL_001": "9",    # Night Owl — 9XXXXXXX@paytm
        "CTRL_002": "8",    # Splitter  — 8XXXXXXX@ybl
        "CTRL_003": "7",    # Ghost     — 7XXXXXXX@okaxis (rotates suffix)
        "CTRL_004": "6",    # Local     — 6XXXXXXX@ibl
    }
    suffix_map = {
        "CTRL_001": "@paytm",
        "CTRL_002": "@ybl",
        "CTRL_003": random.choice(UPI_SUFFIXES),
        "CTRL_004": "@ibl",
    }
    phone = prefixes[controller_id] + str(random.randint(1000000, 9999999))
    return f"{phone}{suffix_map[controller_id]}"


def generate_controller_upi(controller_id: str) -> str:
    """Stable UPI for the controller themselves (sender)."""
    seeds = {
        "CTRL_001": "9800000001@paytm",
        "CTRL_002": "8700000002@ybl",
        "CTRL_003": "7600000003@okaxis",
        "CTRL_004": "6500000004@ibl",
    }
    return seeds[controller_id]


def generate_device_fingerprint(ip: str, isp: str, device_type: str) -> str:
    raw = f"{ip.rsplit('.', 2)[0]}|{isp}|{device_type}"
    return hashlib.md5(raw.encode()).hexdigest()[:16]


def generate_timestamp(controller_id: str, base_date: datetime, txn_index: int) -> str:
    cfg = CONTROLLERS[controller_id]
    pattern = cfg["pattern"]
    h_start, h_end = cfg["hours"]

    if pattern == "rapid_fire":
        # All mules funded within 20 minutes of each other
        hour = random.randint(h_start, h_end)
        minute = txn_index * 4  # 4 min apart
        if minute >= 60:
            minute = minute % 60
        dt = base_date.replace(hour=hour, minute=minute, second=random.randint(0, 59))

    elif pattern == "split_equal":
        # 1 hour apart
        hour = h_start + (txn_index % (h_end - h_start + 1))
        dt = base_date.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))

    elif pattern == "random_gaps":
        # Long random gaps
        offset_hours = random.randint(0, 23)
        offset_mins = random.randint(0, 59)
        dt = base_date + timedelta(hours=offset_hours, minutes=offset_mins)

    elif pattern == "weekly_cycle":
        # Same weekday, evening
        days_offset = (txn_index // cfg["mule_count"]) * 7
        hour = random.randint(h_start, h_end)
        dt = base_date + timedelta(days=days_offset)
        dt = dt.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))

    else:
        dt = base_date.replace(
            hour=random.randint(h_start, h_end),
            minute=random.randint(0, 59),
            second=random.randint(0, 59)
        )

    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def generate_location(controller_id: str, is_proxy: bool) -> dict:
    cfg = CONTROLLERS[controller_id]
    city = cfg["location"]["city"]

    if is_proxy or city == "Rotating":
        r_city = random.choice(ROTATING_CITIES)
        r_state = ROTATING_STATES[ROTATING_CITIES.index(r_city)]
        return {
            "city": r_city,
            "state": r_state,
            "country": "Unknown",
            "lat": round(random.uniform(-90, 90), 4),
            "lon": round(random.uniform(-180, 180), 4),
            "proxy": True,
        }

    coords = {
        "Mumbai":    (19.0760, 72.8777),
        "Delhi":     (28.6139, 77.2090),
        "Chennai":   (13.0827, 80.2707),
        "Bangalore": (12.9716, 77.5946),
    }
    lat, lon = coords.get(city, (20.5937, 78.9629))
    return {
        "city": city,
        "state": cfg["location"]["state"],
        "country": "India",
        "lat": round(lat + random.uniform(-0.05, 0.05), 4),
        "lon": round(lon + random.uniform(-0.05, 0.05), 4),
        "proxy": False,
    }


def generate_transactions() -> list:
    transactions = []
    base_date = datetime(2025, 5, 1)
    txn_counter = 1

    # Distribute 500 transactions across 4 controllers
    txn_counts = {
        "CTRL_001": 125,
        "CTRL_002": 125,
        "CTRL_003": 150,  # Ghost has more (6 mules)
        "CTRL_004": 100,
    }

    for ctrl_id, count in txn_counts.items():
        cfg = CONTROLLERS[ctrl_id]
        mule_count = cfg["mule_count"]
        is_proxy = cfg["proxy"]

        # Generate stable mule account IDs for this controller
        mule_accounts = [f"ACC_{ctrl_id}_{str(i+1).zfill(3)}" for i in range(mule_count)]

        # Generate stable ISP (70% same ISP across transactions)
        base_isp = cfg["isp"]

        for i in range(count):
            mule_account = random.choice(mule_accounts)
            mule_index = mule_accounts.index(mule_account)

            # Amount generation
            a_min, a_max = cfg["amount_range"]
            amount = random.randint(a_min, a_max)

            # ISP — 70% consistent
            if is_proxy:
                isp = random.choice(ROTATING_ISPS)
            else:
                isp = base_isp if random.random() < 0.70 else random.choice(
                    ["Vodafone", "BSNL", "Airtel Mobile", "Tata Sky"]
                )

            # IP generation
            sender_ip = generate_ip(ctrl_id, is_proxy)
            receiver_ip = generate_ip(ctrl_id, False)

            # Device
            device_type = "mobile" if "Mobile" in isp or is_proxy else random.choice(DEVICE_TYPES)

            # Timestamp
            day_offset = random.randint(0, 29)
            txn_date = base_date + timedelta(days=day_offset)
            timestamp = generate_timestamp(ctrl_id, txn_date, i % mule_count)

            # Location
            location = generate_location(ctrl_id, is_proxy)

            # UPI handles
            sender_upi = generate_controller_upi(ctrl_id)
            receiver_upi = generate_upi(ctrl_id, mule_index)

            # Device fingerprint
            device_fp = generate_device_fingerprint(sender_ip, isp, device_type)

            # IFSC
            bank_ifsc = random.choice(IFSC_CODES)

            # Session fingerprint (simulated JA3-style hash)
            ja3_raw = f"{device_type}|{isp}|{sender_ip.rsplit('.', 2)[0]}"
            ja3_hash = hashlib.sha256(ja3_raw.encode()).hexdigest()[:32]

            txn = {
                "transaction_id": f"txn_{str(txn_counter).zfill(5)}",
                "account_id": mule_account,
                "controller_id": ctrl_id,
                "amount": amount,
                "currency": "INR",
                "timestamp": timestamp,
                "sender_upi": sender_upi,
                "receiver_upi": receiver_upi,
                "sender_ip": sender_ip,
                "receiver_ip": receiver_ip,
                "method": "UPI",
                "bank_ifsc": bank_ifsc,
                "device_type": device_type,
                "isp": isp,
                "location": location,
                "is_mule": True,
                "is_proxy": is_proxy or location["proxy"],
                "device_fingerprint": device_fp,
                "ja3_hash": ja3_hash,
                "status": "captured",
                "account_status": "ACTIVE",  # will be updated post-clustering
            }
            transactions.append(txn)
            txn_counter += 1

    # Shuffle to mix controllers
    random.shuffle(transactions)
    return transactions


if __name__ == "__main__":
    print("Generating 500 synthetic transactions...")
    txns = generate_transactions()

    # Validate counts
    from collections import Counter
    ctrl_counts = Counter(t["controller_id"] for t in txns)
    print(f"Total transactions: {len(txns)}")
    for ctrl_id, cnt in sorted(ctrl_counts.items()):
        print(f"  {ctrl_id} ({CONTROLLERS[ctrl_id]['name']}): {cnt} transactions")

    # Save
    out_path = os.path.join(os.path.dirname(__file__), "synthetic_transactions.json")
    with open(out_path, "w") as f:
        json.dump(txns, f, indent=2)

    print(f"\nSaved to {out_path}")
    print("Sample transaction:")
    print(json.dumps(txns[0], indent=2))
