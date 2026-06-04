"""
razorpay_client.py
Razorpay Test API integration.
Flow:
  1. create_payment_order()  — POST /v1/orders  (controller sends to mule)
  2. fetch_order()           — GET  /v1/orders/{id}
  3. fetch_all_orders()      — GET  /v1/orders
  4. fetch_payments()        — GET  /v1/payments
  5. simulate_payment_flow() — creates order + enriches with fraud metadata
Run standalone: python razorpay_client.py
"""

import requests
import json
import sys
import os
import ssl
from datetime import datetime

import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_BASE_URL

AUTH    = (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)
HEADERS = {"Content-Type": "application/json"}
VERIFY  = False  # Windows SSL fix for Razorpay test API


def create_payment_order(
    amount_inr: float,
    sender_upi: str,
    receiver_upi: str,
    sender_ip: str,
    isp: str,
    device_type: str,
    is_proxy: bool,
    controller_id: str = "",
    account_id: str = "",
    receipt: str = None,
) -> dict:
    """
    Create a Razorpay test order representing a controller → mule payment.
    All fraud-relevant metadata is embedded in the notes field.
    Returns the created order with full metadata.
    """
    if receipt is None:
        receipt = f"muleshield_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"

    payload = {
        "amount":   int(amount_inr * 100),  # paise
        "currency": "INR",
        "receipt":  receipt,
        "notes": {
            # Fraud detection metadata embedded in order
            "sender_upi":    sender_upi,
            "receiver_upi":  receiver_upi,
            "sender_ip":     sender_ip,
            "isp":           isp,
            "device_type":   device_type,
            "is_proxy":      str(is_proxy),
            "controller_id": controller_id,
            "account_id":    account_id,
            "source":        "MuleShield_AML",
            "created_at":    datetime.utcnow().isoformat(),
        },
    }

    try:
        resp = requests.post(
            f"{RAZORPAY_BASE_URL}/orders",
            auth=AUTH,
            headers=HEADERS,
            json=payload,
            timeout=10,
            verify=VERIFY,
        )
        resp.raise_for_status()
        order = resp.json()
        return {
            "success": True,
            "order_id":   order.get("id"),
            "amount_inr": amount_inr,
            "status":     order.get("status"),
            "receipt":    order.get("receipt"),
            "created_at": datetime.fromtimestamp(order.get("created_at", 0)).isoformat(),
            "notes":      order.get("notes", {}),
            "raw":        order,
        }
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": str(e)}


def fetch_order(order_id: str) -> dict:
    """Fetch a specific order by ID."""
    try:
        resp = requests.get(
            f"{RAZORPAY_BASE_URL}/orders/{order_id}",
            auth=AUTH,
            timeout=10,
            verify=VERIFY,
        )
        resp.raise_for_status()
        return {"success": True, "data": resp.json()}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": str(e)}


def fetch_all_orders(count: int = 20) -> dict:
    """Fetch recent orders from Razorpay dashboard."""
    try:
        resp = requests.get(
            f"{RAZORPAY_BASE_URL}/orders",
            auth=AUTH,
            params={"count": count},
            timeout=10,
            verify=VERIFY,
        )
        resp.raise_for_status()
        return {"success": True, "data": resp.json()}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": str(e)}


def fetch_payments(count: int = 20) -> dict:
    """Fetch recent payments."""
    try:
        resp = requests.get(
            f"{RAZORPAY_BASE_URL}/payments",
            auth=AUTH,
            params={"count": count},
            timeout=10,
            verify=VERIFY,
        )
        resp.raise_for_status()
        return {"success": True, "data": resp.json()}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": str(e)}


# Keep backward compat alias
def create_order(amount_inr, receipt, notes=None):
    payload = {
        "amount":   int(amount_inr * 100),
        "currency": "INR",
        "receipt":  receipt,
        "notes":    notes or {},
    }
    try:
        resp = requests.post(
            f"{RAZORPAY_BASE_URL}/orders",
            auth=AUTH, headers=HEADERS, json=payload, timeout=10, verify=VERIFY,
        )
        resp.raise_for_status()
        return {"success": True, "data": resp.json()}
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": str(e)}


def fetch_orders(count: int = 20) -> dict:
    return fetch_all_orders(count)


def enrich_order_with_fraud_metadata(order: dict) -> dict:
    """
    Extract fraud-relevant fields from a Razorpay order's notes.
    Returns a transaction-like dict ready for the detection pipeline.
    """
    notes = order.get("notes", {})
    return {
        "transaction_id":  order.get("receipt", order.get("id", "")),
        "razorpay_order_id": order.get("id", ""),
        "amount":          order.get("amount", 0) / 100,
        "currency":        order.get("currency", "INR"),
        "status":          order.get("status", ""),
        "created_at":      datetime.fromtimestamp(order.get("created_at", 0)).isoformat(),
        # Fraud metadata from notes
        "sender_upi":      notes.get("sender_upi", ""),
        "receiver_upi":    notes.get("receiver_upi", ""),
        "sender_ip":       notes.get("sender_ip", ""),
        "isp":             notes.get("isp", ""),
        "device_type":     notes.get("device_type", "mobile"),
        "is_proxy":        notes.get("is_proxy", "false").lower() == "true",
        "controller_id":   notes.get("controller_id", ""),
        "account_id":      notes.get("account_id", ""),
        "method":          "UPI",
        "bank_ifsc":       "IOBA0001234",
    }


def create_mule_simulation_orders(transactions: list) -> list:
    """
    Create Razorpay test orders for a sample of synthetic transactions.
    Picks 3 per controller for live demo.
    """
    from collections import defaultdict
    by_ctrl = defaultdict(list)
    for t in transactions:
        by_ctrl[t["controller_id"]].append(t)

    selected = []
    for ctrl_id, txns in by_ctrl.items():
        selected.extend(txns[:3])

    created = []
    for txn in selected:
        result = create_payment_order(
            amount_inr=txn["amount"],
            sender_upi=txn["sender_upi"],
            receiver_upi=txn["receiver_upi"],
            sender_ip=txn["sender_ip"],
            isp=txn["isp"],
            device_type=txn["device_type"],
            is_proxy=txn.get("is_proxy", False),
            controller_id=txn["controller_id"],
            account_id=txn["account_id"],
            receipt=txn["transaction_id"],
        )
        if result["success"]:
            created.append({
                "razorpay_order_id": result["order_id"],
                "transaction_id":    txn["transaction_id"],
                "amount_inr":        txn["amount"],
                "controller_id":     txn["controller_id"],
                "account_id":        txn["account_id"],
                "status":            result["status"],
                "created_at":        result["created_at"],
            })
            print(f"  ✓ Order {result['order_id']} | {txn['transaction_id']} | ₹{txn['amount']}")
        else:
            print(f"  ✗ Failed {txn['transaction_id']}: {result['error']}")

    return created


if __name__ == "__main__":
    print("Testing Razorpay payment order creation...")

    result = create_payment_order(
        amount_inr=9500,
        sender_upi="9800000001@paytm",
        receiver_upi="mule_acc_001@paytm",
        sender_ip="49.36.100.50",
        isp="Jio Mobile",
        device_type="mobile",
        is_proxy=False,
        controller_id="CTRL_001",
        account_id="ACC_CTRL_001_001",
    )

    if result["success"]:
        print(f"Order created: {result['order_id']}")
        print(f"Amount: ₹{result['amount_inr']}")
        print(f"Status: {result['status']}")
        print(f"Notes: {result['notes']}")

        # Fetch it back
        fetched = fetch_order(result["order_id"])
        if fetched["success"]:
            enriched = enrich_order_with_fraud_metadata(fetched["data"])
            print(f"\nEnriched for detection:")
            print(f"  Sender UPI: {enriched['sender_upi']}")
            print(f"  Sender IP:  {enriched['sender_ip']}")
            print(f"  ISP:        {enriched['isp']}")
            print(f"  Proxy:      {enriched['is_proxy']}")
    else:
        print(f"Error: {result['error']}")

    # Fetch all orders
    print("\nFetching all orders...")
    orders = fetch_all_orders(count=5)
    if orders["success"]:
        items = orders["data"].get("items", [])
        print(f"Total orders: {len(items)}")
        for o in items[:3]:
            print(f"  {o['id']} — ₹{o['amount']//100} — {o['status']}")
