"""
asn_intelligence.py
ASN Intelligence + Infrastructure Profiling
Classifies IP infrastructure type and scores fraud risk based on network ownership.
Cybersecurity technique: Network Traffic Analysis (NTA) + Infrastructure Profiling
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.ipgeo_client import get_asn_info, classify_infrastructure

# Infrastructure risk scores
INFRA_RISK_SCORES = {
    "residential": 0.0,   # legitimate — no risk
    "mobile":      0.1,   # legitimate mobile — low risk
    "hosting":     0.6,   # hosting/CDN — medium-high risk
    "datacenter":  0.8,   # cloud/VPS — high risk (fraud infra)
    "vpn":         0.9,   # VPN provider — very high risk
    "unknown":     0.5,   # unknown — medium risk
}

# Known fraud infrastructure ASN prefixes
KNOWN_FRAUD_ASNS = {
    "AS60068",  # CDN77 (used by fraud ops)
    "AS209588", # Flyservers (bulletproof hosting)
    "AS202425", # IP Volume (bulletproof)
    "AS9009",   # M247 (VPN/proxy heavy)
}


def analyze_ip_infrastructure(ip: str) -> dict:
    """
    Full ASN intelligence analysis for a given IP.
    Returns infrastructure type, risk score, and fraud flags.
    """
    asn_data = get_asn_info(ip)
    infra_type = asn_data.get("infrastructure_type", "unknown")
    asn = asn_data.get("asn", "Unknown")

    risk_score = INFRA_RISK_SCORES.get(infra_type, 0.5)

    # Boost risk if known fraud ASN
    is_known_fraud_asn = asn in KNOWN_FRAUD_ASNS
    if is_known_fraud_asn:
        risk_score = min(1.0, risk_score + 0.2)

    flags = []
    if infra_type in ("datacenter", "vpn"):
        flags.append("FRAUD_INFRASTRUCTURE_DETECTED")
    if infra_type == "hosting":
        flags.append("HOSTING_IP_SUSPICIOUS")
    if is_known_fraud_asn:
        flags.append("KNOWN_FRAUD_ASN")

    return {
        "ip": ip,
        "asn": asn,
        "org": asn_data.get("org", "Unknown"),
        "infrastructure_type": infra_type,
        "risk_score": round(risk_score, 3),
        "is_fraud_infrastructure": infra_type in ("datacenter", "vpn", "hosting"),
        "is_known_fraud_asn": is_known_fraud_asn,
        "flags": flags,
        "city": asn_data.get("city", "Unknown"),
        "country": asn_data.get("country", "Unknown"),
    }


def score_transaction_asn(transaction: dict) -> dict:
    """
    Score a transaction's ASN risk.
    Used in the risk fusion engine.
    """
    sender_ip = transaction.get("sender_ip", "")
    if not sender_ip:
        return {"asn_risk_score": 0.5, "infrastructure_type": "unknown", "flags": []}

    analysis = analyze_ip_infrastructure(sender_ip)
    return {
        "asn_risk_score": analysis["risk_score"],
        "infrastructure_type": analysis["infrastructure_type"],
        "asn": analysis["asn"],
        "org": analysis["org"],
        "flags": analysis["flags"],
        "is_fraud_infrastructure": analysis["is_fraud_infrastructure"],
    }


if __name__ == "__main__":
    test_ips = [
        ("49.36.100.1", "Jio India — expected: mobile"),
        ("185.220.101.1", "Tor exit — expected: vpn/hosting"),
        ("34.100.0.1", "Google Cloud — expected: datacenter"),
    ]
    for ip, label in test_ips:
        result = analyze_ip_infrastructure(ip)
        print(f"\n{label}")
        print(f"  IP: {ip}")
        print(f"  ASN: {result['asn']} | Org: {result['org']}")
        print(f"  Type: {result['infrastructure_type']} | Risk: {result['risk_score']}")
        print(f"  Flags: {result['flags']}")
