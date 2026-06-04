"""
ifsc_client.py
Fetches bank branch metadata via Razorpay IFSC API (free, no auth).
Run standalone: python ifsc_client.py
"""

import requests
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import RAZORPAY_IFSC_URL

_cache = {}  # simple in-memory cache to avoid repeated calls


def get_ifsc_details(ifsc_code: str) -> dict:
    """
    Fetch bank branch details for a given IFSC code.
    Returns bank name, branch, city, state, address.
    """
    if ifsc_code in _cache:
        return _cache[ifsc_code]

    try:
        resp = requests.get(
            f"{RAZORPAY_IFSC_URL}/{ifsc_code}",
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()

        result = {
            "ifsc": ifsc_code,
            "bank": data.get("BANK", "Unknown"),
            "branch": data.get("BRANCH", "Unknown"),
            "city": data.get("CITY", "Unknown"),
            "state": data.get("STATE", "Unknown"),
            "address": data.get("ADDRESS", "Unknown"),
            "contact": data.get("CONTACT", ""),
            "resolved": True,
        }
        _cache[ifsc_code] = result
        return result

    except requests.exceptions.RequestException as e:
        fallback = {
            "ifsc": ifsc_code,
            "bank": "Unknown",
            "branch": "Unknown",
            "city": "Unknown",
            "state": "Unknown",
            "address": "Unknown",
            "contact": "",
            "resolved": False,
            "error": str(e),
        }
        _cache[ifsc_code] = fallback
        return fallback


if __name__ == "__main__":
    test_codes = ["IOBA0001234", "SBIN0001234", "HDFC0001234"]
    for code in test_codes:
        details = get_ifsc_details(code)
        print(f"{code}: {details['bank']} — {details['branch']}, {details['city']}")
