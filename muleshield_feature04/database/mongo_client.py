"""
mongo_client.py
MongoDB connection and CRUD operations for MuleShield.
Uses local MongoDB on port 27017 (MongoDB Compass).
"""

import sys
import os
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import (
    MONGO_URI, MONGO_DB_NAME,
    COL_TRANSACTIONS, COL_ACCOUNTS, COL_CLUSTERS, COL_ALERTS, COL_ORDERS
)

try:
    from pymongo import MongoClient, ASCENDING, DESCENDING
    from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError
    MONGO_AVAILABLE = True
except ImportError:
    MONGO_AVAILABLE = False


class MuleShieldDB:
    def __init__(self):
        self.client = None
        self.db = None
        self.connected = False

        if not MONGO_AVAILABLE:
            print("pymongo not installed. Run: pip install pymongo")
            return

        try:
            self.client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
            self.client.admin.command("ping")
            self.db = self.client[MONGO_DB_NAME]
            self.connected = True
            print(f"MongoDB connected: {MONGO_URI} / {MONGO_DB_NAME}")
            self._create_indexes()
        except (ConnectionFailure, ServerSelectionTimeoutError) as e:
            print(f"MongoDB connection failed: {e}")
            print("Continuing without persistence.")

    def _create_indexes(self):
        """Create indexes for fast querying."""
        if not self.connected:
            return
        self.db[COL_TRANSACTIONS].create_index([("transaction_id", ASCENDING)], unique=True)
        self.db[COL_TRANSACTIONS].create_index([("account_id", ASCENDING)])
        self.db[COL_TRANSACTIONS].create_index([("controller_id", ASCENDING)])
        self.db[COL_ACCOUNTS].create_index([("account_id", ASCENDING)], unique=True)
        self.db[COL_CLUSTERS].create_index([("cluster_id", ASCENDING)], unique=True)
        self.db[COL_ALERTS].create_index([("alert_id", ASCENDING)], unique=True)

    # ── Transactions ───────────────────────────────────────────────────────

    def insert_transactions(self, transactions: list) -> int:
        if not self.connected:
            return 0
        inserted = 0
        for txn in transactions:
            try:
                self.db[COL_TRANSACTIONS].update_one(
                    {"transaction_id": txn["transaction_id"]},
                    {"$set": txn},
                    upsert=True,
                )
                inserted += 1
            except Exception:
                pass
        return inserted

    def get_transactions(self, filter_dict: dict = None, limit: int = 100) -> list:
        if not self.connected:
            return []
        return list(self.db[COL_TRANSACTIONS].find(
            filter_dict or {}, {"_id": 0}
        ).limit(limit).sort("timestamp", DESCENDING))

    def get_transactions_by_account(self, account_id: str) -> list:
        return self.get_transactions({"account_id": account_id}, limit=500)

    # ── Accounts ───────────────────────────────────────────────────────────

    def upsert_account(self, account_id: str, data: dict):
        if not self.connected:
            return
        data["account_id"] = account_id
        data["updated_at"] = datetime.utcnow().isoformat()
        self.db[COL_ACCOUNTS].update_one(
            {"account_id": account_id}, {"$set": data}, upsert=True
        )

    def update_account_status(self, account_id: str, status: str):
        """Update account status: ACTIVE, BLOCKED, HONEY_TRAP, FLAGGED."""
        if not self.connected:
            return
        self.db[COL_ACCOUNTS].update_one(
            {"account_id": account_id},
            {"$set": {
                "account_status": status,
                "status_updated_at": datetime.utcnow().isoformat(),
            }},
            upsert=True,
        )

    def get_honey_trap_accounts(self) -> list:
        if not self.connected:
            return []
        return list(self.db[COL_ACCOUNTS].find(
            {"account_status": "HONEY_TRAP"}, {"_id": 0}
        ))

    def get_blocked_accounts(self) -> list:
        if not self.connected:
            return []
        return list(self.db[COL_ACCOUNTS].find(
            {"account_status": "BLOCKED"}, {"_id": 0}
        ))

    # ── Clusters ───────────────────────────────────────────────────────────

    def save_clusters(self, clusters: list):
        if not self.connected:
            return
        for cluster in clusters:
            self.db[COL_CLUSTERS].update_one(
                {"cluster_id": cluster["cluster_id"]},
                {"$set": cluster},
                upsert=True,
            )

    def get_clusters(self) -> list:
        if not self.connected:
            return []
        return list(self.db[COL_CLUSTERS].find({}, {"_id": 0}))

    def get_cluster_by_id(self, cluster_id: str) -> dict:
        if not self.connected:
            return {}
        return self.db[COL_CLUSTERS].find_one({"cluster_id": cluster_id}, {"_id": 0}) or {}

    # ── Alerts ─────────────────────────────────────────────────────────────

    def save_alert(self, alert: dict):
        if not self.connected:
            return
        self.db[COL_ALERTS].update_one(
            {"alert_id": alert["alert_id"]},
            {"$set": alert},
            upsert=True,
        )

    def get_alerts(self, limit: int = 50) -> list:
        if not self.connected:
            return []
        return list(self.db[COL_ALERTS].find(
            {}, {"_id": 0}
        ).limit(limit).sort("alert_timestamp", DESCENDING))

    def get_high_confidence_alerts(self) -> list:
        if not self.connected:
            return []
        return list(self.db[COL_ALERTS].find(
            {"confidence_tier": "HIGH_CONFIDENCE"}, {"_id": 0}
        ).sort("alert_timestamp", DESCENDING))

    # ── Razorpay Orders ────────────────────────────────────────────────────

    def save_orders(self, orders: list):
        if not self.connected:
            return
        for order in orders:
            self.db[COL_ORDERS].update_one(
                {"razorpay_order_id": order.get("razorpay_order_id", "")},
                {"$set": order},
                upsert=True,
            )

    def get_orders(self, limit: int = 20) -> list:
        if not self.connected:
            return []
        return list(self.db[COL_ORDERS].find({}, {"_id": 0}).limit(limit))

    # ── Stats ──────────────────────────────────────────────────────────────

    def get_dashboard_stats(self) -> dict:
        if not self.connected:
            return {}
        return {
            "total_transactions": self.db[COL_TRANSACTIONS].count_documents({}),
            "total_accounts": self.db[COL_ACCOUNTS].count_documents({}),
            "blocked_accounts": self.db[COL_ACCOUNTS].count_documents({"account_status": "BLOCKED"}),
            "honey_trap_accounts": self.db[COL_ACCOUNTS].count_documents({"account_status": "HONEY_TRAP"}),
            "total_clusters": self.db[COL_CLUSTERS].count_documents({}),
            "total_alerts": self.db[COL_ALERTS].count_documents({}),
            "high_confidence_alerts": self.db[COL_ALERTS].count_documents({"confidence_tier": "HIGH_CONFIDENCE"}),
        }


# Singleton instance
_db_instance = None

def get_db() -> MuleShieldDB:
    global _db_instance
    if _db_instance is None:
        _db_instance = MuleShieldDB()
    return _db_instance


if __name__ == "__main__":
    db = get_db()
    if db.connected:
        stats = db.get_dashboard_stats()
        print("Dashboard stats:", stats)
    else:
        print("MongoDB not available — check if MongoDB is running on port 27017")
