"""
ipgeo_client.py
IP Geolocation + Proxy/VPN detection via ip-api.com (free, no auth).
Also fetches ASN/org data via ipinfo.io (free tier).
Run standalone: python ipgeo_client.py
"""

import requests
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import IPAPI_BASE_URL, IPINFO_BASE_URL

# ip-api.com fields we need
IPAPI_FIELDS = "status,message,country,regionName,city,lat,lon,isp,org,as,mobile,proxy,hosting,query"


def resolve_ip(ip: str) -> dict:
    """
    Resolve IP to geolocation + proxy/VPN flags via ip-api.com.
    Returns normalized dict with all fields needed for fraud scoring.
    """
    try:
        resp = requests.get(
            f"{IPAPI_BASE_URL}/{ip}",
            params={"fields": IPAPI_FIELDS},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") == "fail":
            return _fallback(ip, reason=data.get("message", "unknown"))

        return {
            "ip": ip,
            "city": data.get("city", "Unknown"),
            "state": data.get("regionName", "Unknown"),
            "country": data.get("country", "Unknown"),
            "lat": data.get("lat", 0.0),
            "lon": data.get("lon", 0.0),
            "isp": data.get("isp", "Unknown"),
            "org": data.get("org", "Unknown"),
            "asn": data.get("as", "Unknown"),
            "mobile": data.get("mobile", False),
            "proxy": data.get("proxy", False),
            "hosting": data.get("hosting", False),
            "resolved": True,
        }
    except requests.exceptions.RequestException as e:
        return _fallback(ip, reason=str(e))


def get_asn_info(ip: str) -> dict:
    """
    Fetch ASN + org details via ipinfo.io (free, no auth for basic fields).
    Returns ASN number, org name, and infrastructure type classification.
    """
    try:
        resp = requests.get(
            f"{IPINFO_BASE_URL}/{ip}/json",
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()

        org = data.get("org", "")
        asn = org.split(" ")[0] if org else "Unknown"
        org_name = " ".join(org.split(" ")[1:]) if org else "Unknown"

        infra_type = classify_infrastructure(org_name)

        return {
            "ip": ip,
            "asn": asn,
            "org": org_name,
            "infrastructure_type": infra_type,
            "city": data.get("city", "Unknown"),
            "region": data.get("region", "Unknown"),
            "country": data.get("country", "Unknown"),
            "resolved": True,
        }
    except requests.exceptions.RequestException as e:
        return {
            "ip": ip,
            "asn": "Unknown",
            "org": "Unknown",
            "infrastructure_type": "unknown",
            "resolved": False,
            "error": str(e),
        }


def classify_infrastructure(org_name: str) -> str:
    """
    Classify IP infrastructure type based on ASN org name.
    residential → legitimate user
    mobile      → legitimate mobile user
    datacenter  → fraud infrastructure (VPS, cloud)
    vpn         → VPN provider
    hosting     → hosting/CDN (suspicious)
    """
    org_lower = org_name.lower()

    vpn_keywords = ["nordvpn", "expressvpn", "protonvpn", "mullvad", "surfshark",
                    "vpn", "private internet", "tunnelbear", "cyberghost"]
    datacenter_keywords = ["amazon", "google", "microsoft", "digitalocean", "linode",
                           "vultr", "hetzner", "ovh", "aws", "azure", "gcp", "cloudflare"]
    mobile_keywords = ["jio", "airtel", "vodafone", "bsnl", "vi ", "idea", "reliance",
                       "mobile", "cellular", "wireless"]
    hosting_keywords = ["hosting", "server", "datacenter", "colocation", "colo"]

    for kw in vpn_keywords:
        if kw in org_lower:
            return "vpn"
    for kw in datacenter_keywords:
        if kw in org_lower:
            return "datacenter"
    for kw in hosting_keywords:
        if kw in org_lower:
            return "hosting"
    for kw in mobile_keywords:
        if kw in org_lower:
            return "mobile"

    return "residential"


def _fallback(ip: str, reason: str = "") -> dict:
    return {
        "ip": ip,
        "city": "Unknown",
        "state": "Unknown",
        "country": "Unknown",
        "lat": 0.0,
        "lon": 0.0,
        "isp": "Unknown",
        "org": "Unknown",
        "asn": "Unknown",
        "mobile": False,
        "proxy": False,
        "hosting": False,
        "resolved": False,
        "error": reason,
    }


if __name__ == "__main__":
    test_ips = [
        "49.36.100.1",    # Jio India
        "185.220.101.1",  # Known Tor exit node
        "8.8.8.8",        # Google DNS
    ]
    for ip in test_ips:
        print(f"\nResolving {ip}...")
        geo = resolve_ip(ip)
        asn = get_asn_info(ip)
        print(f"  City: {geo['city']}, ISP: {geo['isp']}, Proxy: {geo['proxy']}")
        print(f"  ASN: {asn['asn']}, Org: {asn['org']}, Type: {asn['infrastructure_type']}")
