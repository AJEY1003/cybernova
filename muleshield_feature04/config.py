# MuleShield Feature 04 — Configuration
# Controller Fingerprint Extraction for IOB (Indian Overseas Bank)

import os
from urllib.parse import quote_plus
from dotenv import load_dotenv

load_dotenv()

# ── Razorpay Test Credentials ──────────────────────────────────────────────
RAZORPAY_KEY_ID     = os.getenv("RAZORPAY_KEY_ID", "rzp_test_SpegemwVehfUj6")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "J8d7ztscCF20seANfjfhz397")
RAZORPAY_BASE_URL   = "https://api.razorpay.com/v1"
RAZORPAY_IFSC_URL   = "https://api.razorpay.com/v1/ifsc"

# ── IP Intelligence APIs (Free, No Auth) ───────────────────────────────────
IPAPI_BASE_URL      = "http://ip-api.com/json"          # proxy, isp, city
IPINFO_BASE_URL     = "https://ipinfo.io"               # ASN, org, hosting

# ── MongoDB (Local Compass or Cloud) ────────────────────────────────────────────────
_mongo_password = os.getenv("MONGO_PASSWORD", "")
if _mongo_password:
    _encoded = quote_plus(_mongo_password)
    MONGO_URI = f"mongodb+srv://apriyadharshini334_db_user:{_encoded}@muledna.6ce7sdr.mongodb.net/?retryWrites=true&w=majority&appName=muledna"
else:
    MONGO_URI = "mongodb://localhost:27017"

MONGO_DB_NAME       = "muleshield"

# Collections
COL_TRANSACTIONS    = "transactions"
COL_ACCOUNTS        = "accounts"
COL_CLUSTERS        = "clusters"
COL_ALERTS          = "alerts"
COL_ORDERS          = "razorpay_orders"
COL_KYC             = "kyc_profiles"

# ── Detection Thresholds ───────────────────────────────────────────────────
HIGH_CONFIDENCE_THRESHOLD   = 0.80   # > this → CONTROLLER IDENTIFIED
SUSPECTED_THRESHOLD         = 0.50   # > this → SUSPECTED, MONITOR
COSINE_SIMILARITY_THRESHOLD = 0.85   # fingerprint match threshold

# ── Risk Fusion Weights ────────────────────────────────────────────────────
RISK_WEIGHTS = {
    "ip_subnet_match":   0.20,
    "upi_pattern_match": 0.20,
    "timing_match":      0.20,
    "amount_match":      0.15,
    "asn_type_match":    0.10,
    "proxy_flag":        0.10,
    "device_reuse":      0.05,
}

# ── DBSCAN Parameters ──────────────────────────────────────────────────────
DBSCAN_EPS          = 0.5
DBSCAN_MIN_SAMPLES  = 2
PCA_COMPONENTS      = 10

# ── Geo-Velocity ───────────────────────────────────────────────────────────
GEO_VELOCITY_MAX_KM_PER_MIN = 10    # impossible travel threshold

# ── Amount Alert Threshold ─────────────────────────────────────────────────
ALERT_THRESHOLD_AMOUNT = 10000      # ₹10,000 — RBI reporting threshold

# ── Controller Archetypes (for synthetic data generation) ──────────────────
CONTROLLERS = {
    "CTRL_001": {
        "name": "The Night Owl",
        "hours": (1, 4),
        "amount_range": (9000, 9999),
        "mule_count": 5,
        "location": {"city": "Mumbai", "state": "Maharashtra"},
        "isp": "Jio Mobile",
        "pattern": "rapid_fire",
        "proxy": False,
    },
    "CTRL_002": {
        "name": "The Splitter",
        "hours": (10, 12),
        "amount_range": (4500, 5500),
        "mule_count": 4,
        "location": {"city": "Delhi", "state": "Delhi"},
        "isp": "Airtel Broadband",
        "pattern": "split_equal",
        "proxy": False,
    },
    "CTRL_003": {
        "name": "The Ghost",
        "hours": (0, 23),
        "amount_range": (1000, 50000),
        "mule_count": 6,
        "location": {"city": "Rotating", "state": "Rotating"},
        "isp": "Rotating",
        "pattern": "random_gaps",
        "proxy": True,
    },
    "CTRL_004": {
        "name": "The Local",
        "hours": (18, 21),
        "amount_range": (2000, 3000),
        "mule_count": 3,
        "location": {"city": "Chennai", "state": "Tamil Nadu"},
        "isp": "BSNL",
        "pattern": "weekly_cycle",
        "proxy": False,
    },
}
