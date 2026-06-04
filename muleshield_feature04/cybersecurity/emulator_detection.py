"""
emulator_detection.py
Emulator Detection + Anti-Tampering Analysis
Detects transactions originating from Android emulators, rooted devices,
or tampered environments used to automate mule account operations.
Cybersecurity technique: Emulator Detection + Anti-Tampering Analysis
"""

import json
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Known Android emulator IP subnets
EMULATOR_SUBNETS = {
    "10.0.2",    # Android Studio AVD default
    "10.0.3",    # Genymotion
    "192.168.56", # VirtualBox (BlueStacks, NoxPlayer)
    "192.168.57",
    "172.17.0",  # Docker (sometimes used for automation)
}

# Known emulator/automation ISP patterns
EMULATOR_ISP_PATTERNS = [
    "virtualbox", "vmware", "qemu", "android sdk",
    "bluestacks", "noxplayer", "ldplayer", "memu",
]

# Suspicious device type + ISP combinations
SUSPICIOUS_COMBOS = [
    ("broadband", "Jio Mobile"),   # broadband device on mobile ISP — mismatch
    ("mobile", "Airtel Broadband"), # mobile device on broadband — mismatch
]


def detect_emulator(transaction: dict) -> dict:
    """
    Analyze a transaction for emulator/automation indicators.
    Returns risk score and specific flags triggered.
    """
    flags = []
    risk_score = 0.0

    ip = transaction.get("sender_ip", "")
    isp = transaction.get("isp", "").lower()
    device_type = transaction.get("device_type", "")

    # Check 1: Known emulator IP subnet
    ip_prefix_2 = ".".join(ip.split(".")[:2]) if ip else ""
    ip_prefix_3 = ".".join(ip.split(".")[:3]) if ip else ""

    for subnet in EMULATOR_SUBNETS:
        if ip_prefix_3.startswith(subnet) or ip_prefix_2 == subnet:
            flags.append("EMULATOR_IP_SUBNET")
            risk_score += 0.5
            break

    # Check 2: ISP name matches known emulator/VM software
    for pattern in EMULATOR_ISP_PATTERNS:
        if pattern in isp:
            flags.append("EMULATOR_ISP_DETECTED")
            risk_score += 0.4
            break

    # Check 3: Device type / ISP mismatch (anti-tampering signal)
    for dev, isp_pattern in SUSPICIOUS_COMBOS:
        if device_type == dev and isp_pattern.lower() in isp:
            flags.append("DEVICE_ISP_MISMATCH")
            risk_score += 0.3
            break

    # Check 4: Private/reserved IP ranges (internal network — automation)
    if ip.startswith("10.") or ip.startswith("172.16.") or ip.startswith("192.168."):
        if not any(ip.startswith(s.replace(".", ".")) for s in ["192.168.56", "10.0.2"]):
            flags.append("PRIVATE_IP_RANGE")
            risk_score += 0.2

    # Check 5: Proxy + mobile device (VPN on mobile = likely automation)
    is_proxy = transaction.get("is_proxy", False)
    if is_proxy and device_type == "mobile":
        flags.append("PROXY_ON_MOBILE_DEVICE")
        risk_score += 0.2

    risk_score = min(1.0, risk_score)
    is_emulator = risk_score >= 0.4

    return {
        "transaction_id": transaction.get("transaction_id", ""),
        "is_emulator": is_emulator,
        "risk_score": round(risk_score, 3),
        "flags": flags,
        "device_type": device_type,
        "isp": transaction.get("isp", ""),
        "ip": ip,
    }


def analyze_account_emulator_risk(transactions: list, account_id: str) -> dict:
    """
    Aggregate emulator risk across all transactions for an account.
    """
    account_txns = [t for t in transactions if t.get("account_id") == account_id]
    if not account_txns:
        return {"account_id": account_id, "emulator_risk_score": 0.0, "flags": []}

    results = [detect_emulator(t) for t in account_txns]
    emulator_ratio = sum(1 for r in results if r["is_emulator"]) / len(results)
    all_flags = list(set(f for r in results for f in r["flags"]))
    avg_risk = sum(r["risk_score"] for r in results) / len(results)

    return {
        "account_id": account_id,
        "emulator_risk_score": round(avg_risk, 3),
        "emulator_transaction_ratio": round(emulator_ratio, 3),
        "flags": all_flags,
        "is_high_risk": avg_risk >= 0.4,
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

    print(f"Analyzing {len(transactions)} transactions for emulator usage...")
    flagged = [detect_emulator(t) for t in transactions if detect_emulator(t)["is_emulator"]]
    print(f"Emulator-flagged transactions: {len(flagged)}")
    for r in flagged[:5]:
        print(f"  {r['transaction_id']}: risk={r['risk_score']} flags={r['flags']}")
