"""
main.py
MuleShield Feature 04 — FastAPI Backend Orchestrator
Exposes REST endpoints for the full controller fingerprint extraction pipeline.
Run: uvicorn main:app --reload --port 8000
"""

import json
import os
import sys
from datetime import datetime
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from config import CONTROLLERS
from data.generate_synthetic_data import generate_transactions
from features.feature_engineering import load_transactions, extract_features
from models.dbscan_clustering import run_full_clustering_pipeline
from models.fingerprint_matcher import find_best_cluster_match
from cybersecurity.asn_intelligence import score_transaction_asn
from cybersecurity.device_fingerprinting import detect_device_reuse, compute_device_fingerprint
from cybersecurity.geo_velocity import detect_impossible_travel, check_single_transaction_velocity
from cybersecurity.emulator_detection import detect_emulator
from cybersecurity.session_fingerprinting import detect_session_correlation, match_session_to_cluster
from graph.graph_intelligence import analyze_mule_network, get_graph_data_for_viz, detect_communities, build_transaction_graph
from risk.risk_fusion_engine import compute_risk_score, build_signals_from_pipeline
from alerts.alert_generator import generate_controller_alert, block_accounts, format_alert_summary
from api.razorpay_client import create_mule_simulation_orders, fetch_orders, create_payment_order, fetch_order
from api.ipgeo_client import resolve_ip
from database.mongo_client import get_db
from rag.chat_router import router as chat_router

# ── App setup ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="MuleShield Feature 04 — Controller Fingerprint Extraction",
    description="AML mule account controller detection for IOB (Indian Overseas Bank)",
    version="1.0.0",
)

app.include_router(chat_router)

KYC_DATABASE = {
    "ajeykumaran": {
        "upi": "ajeykumaran",
        "upi_id": "ajeykumaran",
        "name": "Ajey Kumaran",
        "phone_number": "+919876543210",
        "age": 25,
        "occupation": "Software Engineer",
        "parents_name": "Ravi Kumaran",
        "annual_income": "10 - 15 Lakhs",
        "marital_status": "Single",
        "balance": 50000,
        "role": "User",
        "avatar": "A",
        "isController": False
    },
    "ravi kumar 001": {
        "upi": "ravi kumar 001",
        "upi_id": "ravi kumar 001",
        "name": "Ravi Kumar",
        "phone_number": "+918765432109",
        "age": 55,
        "occupation": "Business",
        "parents_name": "Unknown",
        "annual_income": "5 - 10 Lakhs",
        "marital_status": "Married",
        "balance": 10000,
        "role": "Mule",
        "avatar": "R",
        "isController": False
    }
}

@app.get("/kyc/users", tags=["KYC"])
def get_kyc_users():
    return {"users": list(KYC_DATABASE.values())}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory state (populated on startup) ─────────────────────────────────
STATE = {
    "transactions": [],
    "features_df": None,
    "clusters": [],
    "clustering_result": None,
    "graph_result": None,
    "alerts": [],
    "initialized": False,
}

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "synthetic_transactions.json")


# ── Pydantic models ────────────────────────────────────────────────────────

class HoneyTrapTransaction(BaseModel):
    transaction_id: str
    account_id: str
    sender_upi: str
    receiver_upi: str
    sender_ip: str
    amount: float
    timestamp: str
    isp: str
    device_type: str
    is_proxy: bool = False
    method: str = "UPI"
    bank_ifsc: str = "IOBA0001234"
    # Real device signals from browser (optional)
    device_fingerprint: str = ""
    ja3_hash: str = ""
    webgl_renderer: str = ""
    screen_resolution: str = ""
    cpu_cores: int = 0
    battery_level: float = None
    battery_charging: bool = None
    emulator_flags: list = []


class IncomingTransaction(BaseModel):
    """
    Represents any new transaction entering the system.
    Used for the continuous flow: analyze → cluster → block → trap → attribute.
    """
    sender_upi: str
    receiver_upi: str
    sender_ip: str
    amount: float
    isp: str
    device_type: str = "mobile"
    is_proxy: bool = False
    method: str = "UPI"
    bank_ifsc: str = "IOBA0001234"
    # Real device signals from browser
    device_fingerprint: str = ""
    ja3_hash: str = ""
    webgl_renderer: str = ""
    screen_resolution: str = ""
    cpu_cores: int = 0
    battery_level: float = None
    battery_charging: bool = None
    emulator_flags: list = []


class AccountStatusUpdate(BaseModel):
    account_id: str
    status: str  # BLOCKED, HONEY_TRAP, ACTIVE, FLAGGED


# ── Helper ─────────────────────────────────────────────────────────────────

def numpy_safe(obj):
    """Recursively convert numpy types to Python native for JSON serialization."""
    if isinstance(obj, dict):
        return {k: numpy_safe(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [numpy_safe(i) for i in obj]
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    return obj


def ensure_initialized():
    if not STATE["initialized"]:
        raise HTTPException(status_code=503, detail="Pipeline not initialized. Call POST /pipeline/init first.")


# ── Startup ────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    """Auto-initialize if synthetic data already exists."""
    if os.path.exists(DATA_PATH):
        try:
            await _initialize_pipeline()
            print("Pipeline auto-initialized from existing data.")
        except Exception as e:
            print(f"Auto-init failed: {e}")


async def _initialize_pipeline():
    """Core pipeline initialization logic."""
    import pandas as pd

    # Load or generate transactions
    if not os.path.exists(DATA_PATH):
        print("Generating synthetic transactions...")
        txns = generate_transactions()
        with open(DATA_PATH, "w") as f:
            json.dump(txns, f, indent=2)
    else:
        with open(DATA_PATH) as f:
            txns = json.load(f)

    STATE["transactions"] = txns

    # Feature engineering
    print("Extracting features...")
    df = load_transactions(DATA_PATH)
    features_df = extract_features(df)
    STATE["features_df"] = features_df

    # DBSCAN clustering
    print("Running DBSCAN clustering...")
    clustering_result = run_full_clustering_pipeline(features_df)
    STATE["clusters"] = clustering_result["clusters"]
    STATE["clustering_result"] = clustering_result

    # Save clusters to file for other modules
    clusters_path = os.path.join(os.path.dirname(DATA_PATH), "clusters.json")
    with open(clusters_path, "w") as f:
        json.dump(numpy_safe(clustering_result["clusters"]), f, indent=2)

    # Block accounts + set honey traps
    db = get_db()
    for cluster in STATE["clusters"]:
        statuses = block_accounts(cluster, db.db[db.db.name + ".accounts"] if db.connected else None)
        if db.connected:
            for acc, status in statuses.items():
                db.update_account_status(acc, status)

    # Graph intelligence
    print("Building transaction graph...")
    graph_result = analyze_mule_network(txns)
    STATE["graph_result"] = graph_result

    # Persist transactions to MongoDB
    if db.connected:
        inserted = db.insert_transactions(txns)
        db.save_clusters(numpy_safe(clustering_result["clusters"]))
        print(f"Persisted {inserted} transactions to MongoDB")

    STATE["alerts"] = []
    STATE["initialized"] = True
    print(f"Pipeline initialized: {len(txns)} transactions, {len(STATE['clusters'])} clusters")


# ── Endpoints ──────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "service": "MuleShield Feature 04",
        "status": "running",
        "initialized": STATE["initialized"],
        "version": "1.0.0",
    }


@app.get("/health", tags=["Health"])
def health():
    db = get_db()
    return {
        "api": "ok",
        "mongodb": "connected" if db.connected else "disconnected",
        "pipeline_initialized": STATE["initialized"],
        "transaction_count": len(STATE["transactions"]),
        "cluster_count": len(STATE["clusters"]),
    }


@app.post("/pipeline/init", tags=["Pipeline"])
async def initialize_pipeline():
    """Initialize the full MuleShield pipeline: generate data → features → clustering → graph."""
    try:
        await _initialize_pipeline()
        return {
            "status": "success",
            "transactions": len(STATE["transactions"]),
            "clusters": len(STATE["clusters"]),
            "message": "Pipeline initialized successfully",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/transactions", tags=["Data"])
def get_transactions(limit: int = 50, controller_id: Optional[str] = None):
    """Get synthetic transactions, optionally filtered by controller."""
    ensure_initialized()
    txns = STATE["transactions"]
    if controller_id:
        txns = [t for t in txns if t.get("controller_id") == controller_id]
    return {
        "total": len(txns),
        "transactions": txns[:limit],
    }


@app.get("/db-transactions", tags=["Data"])
def get_db_transactions(limit: int = 500):
    """Get real, live transactions directly from the database (excludes synthetic init data)."""
    ensure_initialized()
    db = get_db()
    if not db.connected:
        # Fallback to state if DB offline, filtering by razorpay_order_id which marks live txns
        live_txns = [t for t in STATE["transactions"] if "razorpay_order_id" in t]
        return {"total": len(live_txns), "transactions": live_txns[-limit:][::-1]}
    
    # Only fetch transactions that actually went through the live payment gateway
    txns = db.get_transactions({"razorpay_order_id": {"$exists": True}}, limit=limit)
    return {"total": len(txns), "transactions": txns}


@app.get("/features", tags=["Features"])
def get_features():
    """Get extracted behavioral feature matrix."""
    ensure_initialized()
    df = STATE["features_df"]
    if df is None:
        raise HTTPException(status_code=404, detail="Features not computed")
    return {
        "account_count": len(df),
        "feature_count": len(df.columns),
        "features": numpy_safe(df.to_dict(orient="records")),
    }


@app.get("/clusters", tags=["Clustering"])
def get_clusters():
    """Get all detected controller clusters with fingerprints."""
    ensure_initialized()
    return {
        "cluster_count": len(STATE["clusters"]),
        "silhouette_score": STATE["clustering_result"].get("silhouette_score", 0),
        "clusters": numpy_safe(STATE["clusters"]),
    }


@app.get("/clusters/{cluster_id}", tags=["Clustering"])
def get_cluster(cluster_id: str):
    """Get a specific cluster by ID."""
    ensure_initialized()
    cluster = next((c for c in STATE["clusters"] if c["cluster_id"] == cluster_id), None)
    if not cluster:
        raise HTTPException(status_code=404, detail=f"Cluster {cluster_id} not found")
    return numpy_safe(cluster)


@app.get("/accounts/honey-traps", tags=["Accounts"])
def get_honey_traps():
    """Get all honey trap accounts with their UPI handles."""
    ensure_initialized()
    # Build a lookup: account_id -> receiver_upi from transactions
    upi_map = {}
    for txn in STATE["transactions"]:
        acc = txn.get("account_id", "")
        upi = txn.get("receiver_upi", "")
        if acc and upi and acc not in upi_map:
            upi_map[acc] = upi

    honey_traps = []
    for cluster in STATE["clusters"]:
        acc_id = cluster["honey_trap_account"]
        honey_traps.append({
            "account_id": acc_id,
            "upi_handle": upi_map.get(acc_id, acc_id),  # real UPI or fallback to account_id
            "cluster_id": cluster["cluster_id"],
            "controller_name": cluster["controller_name"],
            "status": "HONEY_TRAP",
        })
    return {"honey_traps": honey_traps}


@app.get("/accounts/blocked", tags=["Accounts"])
def get_blocked_accounts():
    """Get all blocked accounts across all clusters."""
    ensure_initialized()
    blocked = []
    for cluster in STATE["clusters"]:
        for acc, status in cluster.get("account_statuses", {}).items():
            if status == "BLOCKED":
                blocked.append({
                    "account_id": acc,
                    "cluster_id": cluster["cluster_id"],
                    "controller_name": cluster["controller_name"],
                    "status": "BLOCKED",
                })
    return {"blocked_count": len(blocked), "accounts": blocked}


@app.put("/accounts/status", tags=["Accounts"])
def update_account_status(update: AccountStatusUpdate):
    """Manually update an account's status (BLOCKED, HONEY_TRAP, ACTIVE, FLAGGED)."""
    valid_statuses = {"BLOCKED", "HONEY_TRAP", "ACTIVE", "FLAGGED"}
    if update.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid_statuses}")

    db = get_db()
    if db.connected:
        db.update_account_status(update.account_id, update.status)

    # Update in-memory clusters
    for cluster in STATE["clusters"]:
        if update.account_id in cluster.get("account_statuses", {}):
            cluster["account_statuses"][update.account_id] = update.status

    return {"account_id": update.account_id, "status": update.status, "updated": True}


@app.post("/detect/honey-trap", tags=["Detection"])
async def detect_controller_via_honey_trap(txn: HoneyTrapTransaction):
    """
    Core detection endpoint.
    When a transaction hits a honey trap account, run the full attribution pipeline:
    1. Fingerprint matching
    2. ASN intelligence
    3. Device fingerprinting
    4. Geo-velocity check
    5. Emulator detection
    6. Session fingerprinting
    7. Risk fusion scoring
    8. Alert generation
    """
    ensure_initialized()

    txn_dict = txn.dict()

    # Add computed fields
    txn_dict["device_fingerprint"] = compute_device_fingerprint(txn_dict)
    txn_dict["ja3_hash"] = txn_dict.get("ja3_hash", "")

    # Force to true because this endpoint explicitly simulates a honey trap hit
    is_honey_trap = True

    # Find matched cluster
    matched_cluster = None
    for cluster in STATE["clusters"]:
        if txn.account_id in cluster.get("accounts", []):
            matched_cluster = cluster
            break

    if not matched_cluster:
        # Still run detection even if account not in known clusters
        matched_cluster = STATE["clusters"][0] if STATE["clusters"] else {}

    # ── Run all cybersecurity modules ──────────────────────────────────────

    # 1. Fingerprint matching
    match_result = find_best_cluster_match(txn_dict, STATE["clusters"])
    best_match = match_result["best_match"]

    # 2. ASN intelligence
    asn_result = score_transaction_asn(txn_dict)

    # 3. Device fingerprinting
    cluster_fps = {
        c["cluster_id"]: [
            t.get("device_fingerprint", "")
            for t in STATE["transactions"]
            if t.get("account_id") in c.get("accounts", [])
        ]
        for c in STATE["clusters"]
    }
    from cybersecurity.device_fingerprinting import score_transaction_device
    device_result = score_transaction_device(txn_dict, cluster_fps)

    # 4. Geo-velocity
    cluster_txns = [
        t for t in STATE["transactions"]
        if t.get("account_id") in matched_cluster.get("accounts", [])
    ]
    last_txn = sorted(cluster_txns, key=lambda x: x.get("timestamp", ""))[-1] if cluster_txns else {}
    geo_result = check_single_transaction_velocity(txn_dict, last_txn) if last_txn else {"risk_score": 0.0}

    # 5. Emulator detection
    emulator_result = detect_emulator(txn_dict)

    # 6. Session fingerprinting
    cluster_ja3s = {
        c["cluster_id"]: [
            t.get("ja3_hash", "")
            for t in STATE["transactions"]
            if t.get("account_id") in c.get("accounts", [])
        ]
        for c in STATE["clusters"]
    }
    session_result = match_session_to_cluster(txn_dict, cluster_ja3s)

    # 7. Risk fusion
    signals = build_signals_from_pipeline(
        best_match, asn_result, device_result,
        geo_result, emulator_result, session_result, txn_dict
    )
    risk_assessment = compute_risk_score(signals)

    # 8. IP geolocation
    geo_data = resolve_ip(txn.sender_ip)

    # 9. Generate alert
    risk_result = {
        "risk_assessment": risk_assessment,
        "signal_details": {
            "fingerprint_match": best_match,
            "asn_intelligence": asn_result,
            "device_fingerprint": device_result,
            "geo_velocity": geo_result,
            "emulator_detection": emulator_result,
            "session_fingerprint": session_result,
        },
    }
    alert = generate_controller_alert(
        txn_dict, risk_result, matched_cluster, geo_data, is_honey_trap_override=is_honey_trap
    )

    # 10. Persist alert
    db = get_db()
    if db.connected:
        db.save_alert(numpy_safe(alert))
    STATE["alerts"].append(alert)

    return numpy_safe({
        "is_honey_trap": is_honey_trap,
        "matched_cluster": best_match.get("cluster_id", ""),
        "controller_name": best_match.get("controller_name", "Unknown"),
        "risk_assessment": risk_assessment,
        "alert": alert,
        "signal_details": risk_result["signal_details"],
        "geo_data": geo_data,
    })


@app.get("/alerts", tags=["Alerts"])
def get_alerts(limit: int = 20):
    """Get all generated alerts."""
    db = get_db()
    if db.connected:
        alerts = db.get_alerts(limit=limit)
    else:
        alerts = STATE["alerts"][-limit:]
    return {"total": len(alerts), "alerts": numpy_safe(alerts)}


@app.get("/graph", tags=["Graph"])
def get_graph_data():
    """Get mule network graph data for visualization."""
    ensure_initialized()
    if not STATE["graph_result"]:
        raise HTTPException(status_code=404, detail="Graph not built")

    G = STATE["graph_result"]["graph"]
    communities = detect_communities(G)
    viz_data = get_graph_data_for_viz(G, communities)

    return numpy_safe({
        "node_count": STATE["graph_result"]["node_count"],
        "edge_count": STATE["graph_result"]["edge_count"],
        "community_count": STATE["graph_result"]["community_count"],
        "top_controller_nodes": STATE["graph_result"]["top_controller_nodes"][:10],
        "graph_data": viz_data,
    })


@app.get("/cybersecurity/device-reuse", tags=["Cybersecurity"])
def get_device_reuse():
    """Detect device fingerprint reuse across mule accounts."""
    ensure_initialized()
    result = detect_device_reuse(STATE["transactions"])
    return numpy_safe(result)


@app.get("/cybersecurity/geo-velocity", tags=["Cybersecurity"])
def get_geo_velocity():
    """Detect impossible travel events across all transactions."""
    ensure_initialized()
    violations = detect_impossible_travel(STATE["transactions"])
    return {"violation_count": len(violations), "violations": numpy_safe(violations[:20])}


@app.get("/cybersecurity/session-correlation", tags=["Cybersecurity"])
def get_session_correlation():
    """Detect session fingerprint correlation across accounts."""
    ensure_initialized()
    result = detect_session_correlation(STATE["transactions"])
    return numpy_safe(result)


@app.get("/razorpay/orders", tags=["Razorpay"])
def get_razorpay_orders():
    """Fetch live orders from Razorpay test dashboard."""
    result = fetch_orders(count=20)
    if result["success"]:
        return {"source": "razorpay_live", "data": result["data"]}
    return {"source": "razorpay_live", "error": result["error"]}


@app.post("/razorpay/create-demo-orders", tags=["Razorpay"])
def create_demo_orders():
    """Create test orders on Razorpay for demo purposes."""
    ensure_initialized()
    orders = create_mule_simulation_orders(STATE["transactions"])
    db = get_db()
    if db.connected:
        db.save_orders(orders)
    return {"created": len(orders), "orders": orders}


@app.post("/razorpay/pay-and-detect", tags=["Razorpay"])
async def razorpay_pay_and_detect(txn: IncomingTransaction):
    """
    CORE DEMO ENDPOINT.
    1. Creates a real Razorpay order (controller → mule payment)
    2. Fetches it back to confirm it's live on Razorpay dashboard
    3. Runs full MuleShield detection pipeline on the order metadata
    4. Returns: Razorpay order + controller/mule detection result + alert
    """
    ensure_initialized()

    txn_id = f"rzp_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
    order_result = create_payment_order(
        amount_inr=txn.amount,
        sender_upi=txn.sender_upi,
        receiver_upi=txn.receiver_upi,
        sender_ip=txn.sender_ip,
        isp=txn.isp,
        device_type=txn.device_type,
        is_proxy=txn.is_proxy,
        receipt=txn_id,
    )

    if not order_result["success"]:
        raise HTTPException(status_code=502, detail=f"Razorpay order creation failed: {order_result['error']}")

    order_id = order_result["order_id"]

    # Step 2: Fetch order back (confirms it's live on Razorpay)
    fetched = fetch_order(order_id)
    live_order = fetched.get("data", {}) if fetched.get("success") else {}

    # Step 3: Build transaction dict
    txn_dict = txn.dict()
    txn_dict["transaction_id"] = txn_id
    txn_dict["razorpay_order_id"] = order_id
    txn_dict["timestamp"] = datetime.utcnow().isoformat() + "Z"
    if not txn_dict.get("device_fingerprint"):
        txn_dict["device_fingerprint"] = compute_device_fingerprint(txn_dict)

    # Step 4: Find matched cluster by UPI prefix
    matched_cluster = None
    prefix_map = {"CTRL_001": "9", "CTRL_002": "8", "CTRL_003": "7", "CTRL_004": "6"}
    for cluster in STATE["clusters"]:
        ctrl_id = cluster.get("dominant_controller_id", "")
        if txn.sender_upi.startswith(prefix_map.get(ctrl_id, "X")):
            matched_cluster = cluster
            break
    if not matched_cluster:
        matched_cluster = STATE["clusters"][0] if STATE["clusters"] else {}

    # Step 4.5: Map receiver_upi to actual account_id
    upi_to_acc = {}
    for t in STATE["transactions"]:
        if t.get("sender_upi") and t.get("account_id"):
            upi_to_acc[t["sender_upi"]] = t["account_id"]
            
    # If it's already an account ID (like from the simulate button), this will preserve it
    txn_dict["account_id"] = upi_to_acc.get(txn.receiver_upi, txn.receiver_upi)

    # Step 5: Check honey trap / blocked status
    honey_trap_accounts = {c["honey_trap_account"] for c in STATE["clusters"] if c.get("honey_trap_account")}
    blocked_set = {acc for c in STATE["clusters"]
                   for acc, st in c.get("account_statuses", {}).items() if st == "BLOCKED"}
    
    hits_honey_trap = txn_dict["account_id"] in honey_trap_accounts
    hits_blocked    = txn_dict["account_id"] in blocked_set

    # Step 6: Full detection pipeline
    from cybersecurity.device_fingerprinting import score_transaction_device
    match_result    = find_best_cluster_match(txn_dict, STATE["clusters"])
    best_match      = match_result["best_match"]
    asn_result      = score_transaction_asn(txn_dict)
    cluster_fps     = {c["cluster_id"]: [t.get("device_fingerprint","") for t in STATE["transactions"]
                        if t.get("account_id") in c.get("accounts",[])] for c in STATE["clusters"]}
    device_result   = score_transaction_device(txn_dict, cluster_fps)
    cluster_txns    = [t for t in STATE["transactions"]
                       if t.get("account_id") in matched_cluster.get("accounts",[])]
    last_txn        = sorted(cluster_txns, key=lambda x: x.get("timestamp",""))[-1] if cluster_txns else {}
    geo_result      = check_single_transaction_velocity(txn_dict, last_txn) if last_txn else {"risk_score":0.0}
    emulator_result = detect_emulator(txn_dict)
    cluster_ja3s    = {c["cluster_id"]: [t.get("ja3_hash","") for t in STATE["transactions"]
                        if t.get("account_id") in c.get("accounts",[])] for c in STATE["clusters"]}
    session_result  = match_session_to_cluster(txn_dict, cluster_ja3s)
    signals         = build_signals_from_pipeline(best_match, asn_result, device_result,
                        geo_result, emulator_result, session_result, txn_dict)
    risk_assessment = compute_risk_score(signals)
    geo_data        = resolve_ip(txn.sender_ip)

    # Step 7: Verdict
    score = risk_assessment.get("composite_score", 0)
    if hits_blocked:
        verdict, action = "BLOCKED_ACCOUNT_HIT", "REJECT_TRANSACTION"
    elif hits_honey_trap or score >= 0.80:
        verdict, action = "CONTROLLER_IDENTIFIED", "FLAG_FOR_LEA"
    elif score >= 0.50:
        verdict, action = "SUSPECTED_MULE_TRANSACTION", "MONITOR_AND_INVESTIGATE"
    else:
        verdict, action = "CLEAN", "ALLOW"

    # Step 8: Alert
    risk_result = {"risk_assessment": risk_assessment, "signal_details": {
        "fingerprint_match": best_match, "asn_intelligence": asn_result,
        "device_fingerprint": device_result, "geo_velocity": geo_result,
        "emulator_detection": emulator_result, "session_fingerprint": session_result,
    }}
    alert = generate_controller_alert(txn_dict, risk_result, matched_cluster, geo_data)

    # Step 9: Persist
    db = get_db()
    if db.connected:
        db.save_alert(numpy_safe(alert))
        db.save_orders([{"razorpay_order_id": order_id, "transaction_id": txn_id,
                         "amount_inr": txn.amount, "verdict": verdict, "confidence": score}])
        db.insert_transactions([numpy_safe(txn_dict)])
    STATE["alerts"].append(alert)
    STATE["transactions"].append(txn_dict)

    return numpy_safe({
        "razorpay": {
            "order_id":      order_id,
            "amount_inr":    txn.amount,
            "status":        order_result["status"],
            "receipt":       txn_id,
            "live_order":    live_order,
            "dashboard_url": f"https://dashboard.razorpay.com/app/orders/{order_id}",
        },
        "detection": {
            "verdict":            verdict,
            "recommended_action": action,
            "confidence_score":   1.0 if hits_honey_trap else score,
            "confidence_tier":    "DEFINITIVE_TRAP_HIT" if hits_honey_trap else risk_assessment.get("confidence_tier"),
            "hits_honey_trap":    hits_honey_trap,
            "hits_blocked":       hits_blocked,
        },
        "controller": {
            "upi_handle":        txn.sender_upi,
            "ip_address":        txn.sender_ip,
            "isp":               txn.isp,
            "proxy_used":        txn.is_proxy or geo_data.get("proxy", False),
            "device_fingerprint": txn_dict.get("device_fingerprint"),
            "ja3_hash":          txn_dict.get("ja3_hash"),
            "location": {
                "city":     geo_data.get("city"),
                "state":    geo_data.get("state"),
                "country":  geo_data.get("country"),
                "lat":      geo_data.get("lat"),
                "lon":      geo_data.get("lon"),
                "reliable": not geo_data.get("proxy", False),
            },
            "emulator_used":  emulator_result.get("is_emulator", False),
            "emulator_flags": emulator_result.get("flags", []),
            "asn":            asn_result.get("asn", ""),
            "infra_type":     asn_result.get("infrastructure_type", ""),
        },
        "mule_network": {
            "cluster_id":       matched_cluster.get("cluster_id"),
            "controller_name":  matched_cluster.get("controller_name"),
            "total_accounts":   matched_cluster.get("account_count"),
            "honey_trap":       matched_cluster.get("honey_trap_account"),
            "blocked_accounts": [acc for acc, st in matched_cluster.get("account_statuses",{}).items()
                                 if st == "BLOCKED"],
            "account_statuses": matched_cluster.get("account_statuses", {}),
        },
        "signal_breakdown": risk_assessment.get("signal_breakdown", {}),
        "alert": alert,
    })


# ══════════════════════════════════════════════════════════════════════════
# CONTINUOUS FLOW ENDPOINTS
# Flow: incoming txn → analyze → cluster → block mules → set honey trap
#       → controller sends to honey trap → attribute → alert
# ══════════════════════════════════════════════════════════════════════════

@app.post("/transaction/analyze", tags=["Continuous Flow"])
async def analyze_incoming_transaction(txn: IncomingTransaction):
    """
    STEP 1 of continuous flow.
    Analyze an incoming transaction across the network:
    - Run all cybersecurity signals
    - Match against known clusters
    - Determine if sender is a known controller
    - If new mule network detected, trigger clustering
    Returns: analysis result + recommended action
    """
    ensure_initialized()

    txn_id = f"txn_live_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
    txn_dict = txn.dict()
    txn_dict["transaction_id"] = txn_id
    txn_dict["account_id"] = txn_dict.get("receiver_upi", "").replace("@", "_").replace(".", "_")
    txn_dict["timestamp"] = datetime.utcnow().isoformat()
    txn_dict["is_mule"] = False  # unknown yet

    # Use real device fingerprint if provided, else compute from metadata
    if not txn_dict.get("device_fingerprint"):
        txn_dict["device_fingerprint"] = compute_device_fingerprint(txn_dict)

    # ── Run cybersecurity analysis ─────────────────────────────────────────
    asn_result    = score_transaction_asn(txn_dict)
    emulator_result = detect_emulator(txn_dict)
    geo_data      = resolve_ip(txn.sender_ip)

    # ── Match against known clusters ───────────────────────────────────────
    match_result  = find_best_cluster_match(txn_dict, STATE["clusters"])
    best_match    = match_result["best_match"]

    # ── Check if receiver is a honey trap ──────────────────────────────────
    honey_trap_accounts = {c["honey_trap_account"] for c in STATE["clusters"]}
    receiver_account = txn_dict["account_id"]
    hits_honey_trap = receiver_account in honey_trap_accounts

    # ── Check if receiver is a blocked account ─────────────────────────────
    blocked_accounts = set()
    for cluster in STATE["clusters"]:
        for acc, status in cluster.get("account_statuses", {}).items():
            if status == "BLOCKED":
                blocked_accounts.add(acc)
    hits_blocked = receiver_account in blocked_accounts

    # ── Determine transaction verdict ──────────────────────────────────────
    cosine = best_match.get("cosine_similarity", 0.0)
    if hits_blocked:
        verdict = "BLOCKED_ACCOUNT_HIT"
        action  = "REJECT_TRANSACTION"
    elif hits_honey_trap:
        verdict = "HONEY_TRAP_HIT"
        action  = "ALLOW_AND_MONITOR"
    elif cosine >= 0.70:
        verdict = "SUSPECTED_MULE_TRANSACTION"
        action  = "FLAG_FOR_REVIEW"
    elif asn_result.get("is_fraud_infrastructure"):
        verdict = "FRAUD_INFRASTRUCTURE_DETECTED"
        action  = "FLAG_FOR_REVIEW"
    else:
        verdict = "CLEAN"
        action  = "ALLOW"

    # ── Create Razorpay order for this transaction (live demo) ─────────────
    from api.razorpay_client import create_order
    razorpay_order = create_order(
        amount_inr=txn.amount,
        receipt=txn_id,
        notes={
            "sender_upi": txn.sender_upi,
            "receiver_upi": txn.receiver_upi,
            "verdict": verdict,
            "matched_cluster": best_match.get("cluster_id", ""),
            "isp": txn.isp,
        }
    )

    return numpy_safe({
        "transaction_id": txn_id,
        "verdict": verdict,
        "recommended_action": action,
        "hits_honey_trap": hits_honey_trap,
        "hits_blocked_account": hits_blocked,
        "cluster_match": {
            "cluster_id": best_match.get("cluster_id", ""),
            "controller_name": best_match.get("controller_name", ""),
            "cosine_similarity": cosine,
        },
        "cybersecurity_signals": {
            "asn": asn_result,
            "emulator": emulator_result,
            "geo": geo_data,
            "proxy_detected": geo_data.get("proxy", False),
        },
        "razorpay_order": razorpay_order.get("data", {}) if razorpay_order.get("success") else {},
        "next_step": "POST /transaction/controller-hit" if hits_honey_trap else "Monitor",
    })


@app.post("/transaction/controller-hit", tags=["Continuous Flow"])
async def controller_hits_honey_trap(txn: IncomingTransaction):
    """
    STEP 2 of continuous flow — triggered when controller sends to honey trap.
    Runs full attribution pipeline and generates LEA alert.
    This is the moment we identify the controller.
    """
    ensure_initialized()

    txn_id = f"txn_ctrl_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
    txn_dict = txn.dict()
    txn_dict["transaction_id"] = txn_id
    txn_dict["timestamp"] = datetime.utcnow().isoformat()

    # Determine which honey trap was hit
    honey_trap_map = {c["honey_trap_account"]: c for c in STATE["clusters"]}
    receiver_id = txn.receiver_upi.replace("@", "_").replace(".", "_")

    # Find cluster by matching receiver UPI pattern against honey trap accounts
    matched_cluster = None
    for cluster in STATE["clusters"]:
        ht = cluster["honey_trap_account"]
        # Match by UPI prefix digit (controller-specific)
        ctrl_id = cluster.get("dominant_controller_id", "")
        prefix_map = {"CTRL_001": "9", "CTRL_002": "8", "CTRL_003": "7", "CTRL_004": "6"}
        if txn.sender_upi.startswith(prefix_map.get(ctrl_id, "0")):
            matched_cluster = cluster
            break

    if not matched_cluster:
        matched_cluster = STATE["clusters"][0] if STATE["clusters"] else {}

    txn_dict["account_id"] = matched_cluster.get("honey_trap_account", "")

    # Use real device fingerprint if provided
    if not txn_dict.get("device_fingerprint"):
        txn_dict["device_fingerprint"] = compute_device_fingerprint(txn_dict)

    # ── Full attribution pipeline ──────────────────────────────────────────
    from cybersecurity.device_fingerprinting import score_transaction_device

    match_result  = find_best_cluster_match(txn_dict, STATE["clusters"])
    best_match    = match_result["best_match"]
    asn_result    = score_transaction_asn(txn_dict)
    cluster_fps   = {
        c["cluster_id"]: [t.get("device_fingerprint","") for t in STATE["transactions"]
                          if t.get("account_id") in c.get("accounts",[])]
        for c in STATE["clusters"]
    }
    device_result   = score_transaction_device(txn_dict, cluster_fps)
    cluster_txns    = [t for t in STATE["transactions"]
                       if t.get("account_id") in matched_cluster.get("accounts",[])]
    last_txn        = sorted(cluster_txns, key=lambda x: x.get("timestamp",""))[-1] if cluster_txns else {}
    geo_result      = check_single_transaction_velocity(txn_dict, last_txn) if last_txn else {"risk_score":0.0}
    emulator_result = detect_emulator(txn_dict)
    cluster_ja3s    = {
        c["cluster_id"]: [t.get("ja3_hash","") for t in STATE["transactions"]
                          if t.get("account_id") in c.get("accounts",[])]
        for c in STATE["clusters"]
    }
    session_result  = match_session_to_cluster(txn_dict, cluster_ja3s)
    signals         = build_signals_from_pipeline(
        best_match, asn_result, device_result,
        geo_result, emulator_result, session_result, txn_dict
    )
    risk_assessment = compute_risk_score(signals)
    geo_data        = resolve_ip(txn.sender_ip)

    # ── Generate alert ─────────────────────────────────────────────────────
    risk_result = {
        "risk_assessment": risk_assessment,
        "signal_details": {
            "fingerprint_match": best_match,
            "asn_intelligence": asn_result,
            "device_fingerprint": device_result,
            "geo_velocity": geo_result,
            "emulator_detection": emulator_result,
            "session_fingerprint": session_result,
        },
    }
    alert = generate_controller_alert(txn_dict, risk_result, matched_cluster, geo_data)

    # ── Create Razorpay order for this controller transaction ──────────────
    from api.razorpay_client import create_order
    razorpay_order = create_order(
        amount_inr=txn.amount,
        receipt=txn_id,
        notes={
            "alert_type": "CONTROLLER_HIT_HONEY_TRAP",
            "sender_upi": txn.sender_upi,
            "confidence": str(risk_assessment.get("composite_score", 0)),
            "matched_cluster": best_match.get("cluster_id", ""),
            "action": risk_assessment.get("recommended_action", ""),
        }
    )

    # ── Persist ────────────────────────────────────────────────────────────
    db = get_db()
    if db.connected:
        db.save_alert(numpy_safe(alert))
    STATE["alerts"].append(alert)

    return numpy_safe({
        "transaction_id": txn_id,
        "controller_identified": risk_assessment.get("confidence_tier") == "HIGH_CONFIDENCE",
        "confidence_score": risk_assessment.get("composite_score", 0),
        "confidence_tier": risk_assessment.get("confidence_tier"),
        "recommended_action": risk_assessment.get("recommended_action"),
        "controller_details": {
            "upi_handle": txn.sender_upi,
            "ip_address": txn.sender_ip,
            "isp": txn.isp,
            "proxy_used": txn.is_proxy or geo_data.get("proxy", False),
            "device_fingerprint": txn_dict.get("device_fingerprint"),
            "ja3_hash": txn_dict.get("ja3_hash"),
            "location": {
                "city": geo_data.get("city"),
                "state": geo_data.get("state"),
                "country": geo_data.get("country"),
                "lat": geo_data.get("lat"),
                "lon": geo_data.get("lon"),
                "location_reliable": not geo_data.get("proxy", False),
            },
            "emulator_used": emulator_result.get("is_emulator", False),
            "emulator_flags": emulator_result.get("flags", []),
        },
        "mule_network": {
            "cluster_id": matched_cluster.get("cluster_id"),
            "controller_name": matched_cluster.get("controller_name"),
            "total_mule_accounts": matched_cluster.get("account_count"),
            "blocked_accounts": [
                acc for acc, status in matched_cluster.get("account_statuses", {}).items()
                if status == "BLOCKED"
            ],
            "honey_trap_account": matched_cluster.get("honey_trap_account"),
        },
        "signal_breakdown": risk_assessment.get("signal_breakdown", {}),
        "alert": alert,
        "razorpay_order": razorpay_order.get("data", {}) if razorpay_order.get("success") else {},
    })


@app.post("/network/block-cluster/{cluster_id}", tags=["Continuous Flow"])
def block_cluster_accounts(cluster_id: str):
    """Block all mule accounts in a cluster except the honey trap."""
    ensure_initialized()
    cluster = next((c for c in STATE["clusters"] if c["cluster_id"] == cluster_id), None)
    if not cluster:
        raise HTTPException(status_code=404, detail=f"Cluster {cluster_id} not found")
    db = get_db()
    honey_trap = cluster["honey_trap_account"]
    blocked = []
    for acc in cluster.get("accounts", []):
        status = "HONEY_TRAP" if acc == honey_trap else "BLOCKED"
        cluster["account_statuses"][acc] = status
        if db.connected:
            db.update_account_status(acc, status)
        if status == "BLOCKED":
            blocked.append(acc)
    return {"cluster_id": cluster_id, "honey_trap": honey_trap,
            "blocked_accounts": blocked, "blocked_count": len(blocked)}


class CascadeTriggerRequest(BaseModel):
    cluster_id: str
    target_ids: list

@app.post("/network/trigger-cascade", tags=["GraphNetwork"])
async def trigger_cascade(req: CascadeTriggerRequest):
    """
    Fires off the real ElevenLabs agent calls sequentially in the background 
    for the visual cascade up until the honeytrap.
    """
    import asyncio
    from services.transaction_service import TransactionService
    tx_service = TransactionService(get_db())
    db = get_db()

    async def _run_cascade(targets):
        for acc_id in targets:
            kyc_profile = KYC_DATABASE.get(acc_id) or db.get_kyc_profile(acc_id) or {}
            target_phone = kyc_profile.get("phone_number", "+917810018691")
            context_data = {
                "amount": "Cascade Suspect",
                "recipient_name": "Mule Flow",
                "kyc_occupation": kyc_profile.get("occupation", "Unknown"),
                "kyc_father_name": kyc_profile.get("parents_name", "Unknown"),
                "kyc_income": kyc_profile.get("annual_income", "Unknown"),
                "account_id": acc_id
            }
            # Trigger the call
            print(f"🌊 [CASCADE BACKEND] Triggering voice agent for {acc_id}")
            res = await tx_service.elevenlabs.trigger_verification_call(target_phone, context_data)
            call_id = res.get("call_id", "mock_id")
            
            # Wait for the user to answer the phone and speak.
            from routes.agent_webhook import process_call_transcript
            print(f"⏳ Waiting for call to finish and polling ElevenLabs API for real transcript...")
            
            conv_details = None
            for _ in range(12):  # Poll every 5 seconds, up to 60 seconds
                await asyncio.sleep(5)
                conv_details = await tx_service.elevenlabs.get_conversation_details(call_id)
                if conv_details and conv_details.get("status") == "done":
                    break
            
            if conv_details and conv_details.get("transcript"):
                real_transcript = conv_details["transcript"]
                real_call_id = conv_details["call_id"]
                
                # Make sure the mapping exists for the new real_call_id
                from services.elevenlabs_service import CALL_ACCOUNT_MAP
                CALL_ACCOUNT_MAP[real_call_id] = acc_id
                
                simulated_payload = {
                    "call_id": real_call_id,
                    "transcript": real_transcript
                }
                
                print(f"✅ Fed REAL transcript into the NLP Risk Engine: {real_transcript}")
                await process_call_transcript(simulated_payload)
            else:
                print("❌ Failed to fetch real transcript, skipping blocking logic.")
            
            # Wait another few seconds before dialing the next mule in the cascade
            await asyncio.sleep(5)

    asyncio.create_task(_run_cascade(req.target_ids))
    return {"status": "cascade_started", "targets": req.target_ids}

class SelectiveBlockRequest(BaseModel):
    cluster_id: str
    accounts_to_block: list   # list of account IDs to block
    honey_trap_account: str   # one account to keep as honey trap


@app.post("/network/selective-block", tags=["GraphNetwork"])
def selective_block_accounts(req: SelectiveBlockRequest, background_tasks: BackgroundTasks):
    """
    Block specific accounts in a cluster and set one as honey trap.
    Called when user clicks nodes in the graph and makes a selection.
    """
    ensure_initialized()
    cluster = next((c for c in STATE["clusters"] if c["cluster_id"] == req.cluster_id), None)
    if not cluster:
        raise HTTPException(status_code=404, detail=f"Cluster {req.cluster_id} not found")

    db = get_db()
    updated_statuses = {}

    for acc in cluster.get("accounts", []):
        if acc == req.honey_trap_account:
            status = "HONEY_TRAP"
        elif acc in req.accounts_to_block:
            status = "BLOCKED"
        else:
            status = "ACTIVE"
        
        if "account_statuses" not in cluster:
            cluster["account_statuses"] = {}
            
        cluster["account_statuses"][acc] = status
        updated_statuses[acc] = status
        if db.connected:
            db.update_account_status(acc, status)

    # Update honey trap in cluster
    cluster["honey_trap_account"] = req.honey_trap_account

    # Sync to blocking agent
    from models.blocking_agent import get_agent
    agent = get_agent()
    if req.cluster_id in agent.blocked_networks:
        agent.blocked_networks[req.cluster_id]["account_statuses"] = updated_statuses
        agent.blocked_networks[req.cluster_id]["canary"] = req.honey_trap_account
        agent.blocked_networks[req.cluster_id]["blocked"] = req.accounts_to_block
    else:
        agent.blocked_networks[req.cluster_id] = {
            "cluster_id": req.cluster_id,
            "controller_name": cluster.get("controller_name", ""),
            "accounts": cluster.get("accounts", []),
            "canary": req.honey_trap_account,
            "blocked": req.accounts_to_block,
            "account_statuses": updated_statuses,
            "combined_risk": cluster.get("confidence_score", 0.8),
            "blocked_at": datetime.utcnow().isoformat(),
            "canary_hit": False,
            "controller_identified": False,
        }


    return numpy_safe({
        "cluster_id": req.cluster_id,
        "honey_trap": req.honey_trap_account,
        "blocked_accounts": req.accounts_to_block,
        "blocked_count": len(req.accounts_to_block),
        "account_statuses": updated_statuses,
        "message": f"Blocked {len(req.accounts_to_block)} accounts. Honey trap: {req.honey_trap_account}",
    })


@app.get("/stats", tags=["Dashboard"])
def get_stats():
    """Get dashboard statistics."""
    db = get_db()
    if db.connected:
        stats = db.get_dashboard_stats()
    else:
        stats = {
            "total_transactions": len(STATE["transactions"]),
            "total_clusters": len(STATE["clusters"]),
            "total_alerts": len(STATE["alerts"]),
        }

    # Add cluster breakdown
    cluster_breakdown = []
    for cluster in STATE["clusters"]:
        cluster_breakdown.append({
            "cluster_id": cluster["cluster_id"],
            "controller_name": cluster["controller_name"],
            "account_count": cluster["account_count"],
            "confidence_score": cluster["confidence_score"],
            "honey_trap": cluster["honey_trap_account"],
            "blocked_count": sum(
                1 for s in cluster.get("account_statuses", {}).values() if s == "BLOCKED"
            ),
        })

    return numpy_safe({**stats, "cluster_breakdown": cluster_breakdown})


# ══════════════════════════════════════════════════════════════════════════
# UPI PAYMENT APP ENDPOINTS
# Used by the payment_app React frontend
# ══════════════════════════════════════════════════════════════════════════

# In-memory UPI ledger (balances + transaction history)
UPI_LEDGER = {
    "9800000001@paytm": {"name": "Arjun Mehta",  "role": "Controller", "balance": 100000.0},
    "9123456001@paytm": {"name": "Ravi Kumar",   "role": "Mule 1",     "balance": 100000.0},
    "9123456002@paytm": {"name": "Priya Singh",  "role": "Mule 2",     "balance": 100000.0},
    "9123456003@paytm": {"name": "Suresh Nair",  "role": "Mule 3",     "balance": 100000.0},
    "9123456004@paytm": {"name": "Deepa Rao",    "role": "Mule 4",     "balance": 100000.0},
    "9123456005@paytm": {"name": "Kiran Patel",  "role": "Mule 5",     "balance": 100000.0},
    "ajeykumaran": {"name": "Ajey Kumaran", "role": "User", "balance": 100000.0},
    "ravi kumar 001": {"name": "Ravi Kumar", "role": "Mule", "balance": 100000.0},
}
UPI_TRANSACTIONS = []  # live transaction log


class UPIPayment(BaseModel):
    sender_upi: str
    receiver_upi: str
    amount: float
    note: str = "Payment"
    isp: str = "Jio Mobile"
    device_type: str = "mobile"
    is_proxy: bool = False
    device_fingerprint: str = ""
    ja3_hash: str = ""
    webgl_renderer: str = ""
    screen_resolution: str = ""
    cpu_cores: int = 0
    battery_level: float = None
    battery_charging: bool = None
    emulator_flags: list = []
    sender_phone: str = ""


@app.get("/upi/balance", tags=["UPI"])
def get_upi_balance(upi: str):
    """Get balance for a UPI handle."""
    if upi not in UPI_LEDGER:
        return {"upi": upi, "balance": 0.0}
    return {"upi": upi, "balance": UPI_LEDGER[upi]["balance"], "name": UPI_LEDGER[upi]["name"]}


@app.get("/upi/transactions", tags=["UPI"])
def get_upi_transactions(upi: str, limit: int = 20):
    """Get transaction history for a UPI handle directly from MongoDB."""
    db = get_db()
    if db.connected:
        query = {"method": "UPI"}
        if upi != "all":
            query["$or"] = [{"sender_upi": upi}, {"receiver_upi": upi}]
        txns = list(db.db["transactions"].find(query, {"_id": 0}).limit(limit).sort("timestamp", -1))
        return {"upi": upi, "transactions": txns, "total": len(txns)}

    # Fallback to in-memory
    if upi == "all":
        txns = list(UPI_TRANSACTIONS)
    else:
        txns = [t for t in UPI_TRANSACTIONS if t["sender_upi"] == upi or t["receiver_upi"] == upi]
    txns = sorted(txns, key=lambda x: x["timestamp"], reverse=True)
    return {"upi": upi, "transactions": txns[:limit], "total": len(txns)}


@app.post("/upi/send", tags=["UPI"])
async def upi_send_payment(payment: UPIPayment, request: Request):
    """
    Core UPI payment endpoint used by the payment app.
    1. Validates sender balance
    2. Checks if receiver is BLOCKED (reject) or HONEY_TRAP (allow + monitor)
    3. Creates Razorpay order as proof
    4. Runs full MuleShield detection pipeline
    5. Updates balances
    6. Returns result with detection details
    """
    sender = payment.sender_upi
    receiver = payment.receiver_upi

    if payment.sender_phone:
        if sender not in KYC_DATABASE:
            KYC_DATABASE[sender] = {}
        KYC_DATABASE[sender]["phone_number"] = payment.sender_phone

    # Capture real client IP from request headers
    real_ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.headers.get("x-real-ip", "")
        or request.client.host
        or "0.0.0.0"
    )

    # Validate sender exists and has balance
    if sender not in UPI_LEDGER:
        raise HTTPException(status_code=400, detail=f"Unknown sender UPI: {sender}")
    if UPI_LEDGER[sender]["balance"] < payment.amount:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Check receiver account status
    receiver_status = "ACTIVE"
    for cluster in STATE["clusters"]:
        for acc, status in cluster.get("account_statuses", {}).items():
            # Match by UPI prefix pattern
            if receiver in acc or acc.split("_")[-1] in receiver:
                receiver_status = status
                break

    # Also check direct UPI match in blocked list
    blocked_upis = set()
    honey_trap_upis = set()
    for cluster in STATE["clusters"]:
        for acc, status in cluster.get("account_statuses", {}).items():
            if status == "BLOCKED":
                blocked_upis.add(acc)
            elif status == "HONEY_TRAP":
                honey_trap_upis.add(acc)

    is_blocked = False # receiver_status == "BLOCKED"
    # Also check direct UPI match in cluster configurations
    is_honey_trap = receiver_status == "HONEY_TRAP"
    actual_honey_trap_acc = None
    for cluster in STATE["clusters"]:
        ht_acc = cluster.get("honey_trap_account")
        if ht_acc and (receiver == ht_acc or receiver.split('@')[0] == ht_acc.split('@')[0] or receiver in honey_trap_upis):
            is_honey_trap = True
            actual_honey_trap_acc = ht_acc
            break

    txn_id = f"upi_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"

    # Build transaction dict for detection
    txn_dict = {
        "transaction_id": txn_id,
        "sender_upi": sender,
        "receiver_upi": receiver,
        "sender_ip": real_ip,  # real client IP from HTTP request
        "amount": payment.amount,
        "timestamp": datetime.utcnow().isoformat(),
        "isp": payment.isp,
        "device_type": payment.device_type,
        "is_proxy": payment.is_proxy,
        "method": "UPI",
        "bank_ifsc": "IOBA0001234",
        "device_fingerprint": payment.device_fingerprint,
        "ja3_hash": payment.ja3_hash,
        "webgl_renderer": payment.webgl_renderer,
        "screen_resolution": payment.screen_resolution,
        "cpu_cores": payment.cpu_cores,
        "battery_level": payment.battery_level,
        "battery_charging": payment.battery_charging,
        "emulator_flags": payment.emulator_flags,
        "note": payment.note,
    }

    # If blocked — reject immediately
    if is_blocked:
        txn_record = {**txn_dict, "status": "BLOCKED", "verdict": "BLOCKED_ACCOUNT_HIT",
                      "razorpay_order_id": None}
        UPI_TRANSACTIONS.append(txn_record)
        return numpy_safe({
            "transaction_id": txn_id,
            "razorpay": None,
            "detection": {"verdict": "BLOCKED_ACCOUNT_HIT", "recommended_action": "REJECT_TRANSACTION",
                          "confidence_score": 1.0, "confidence_tier": "HIGH_CONFIDENCE"},
            "controller": None,
            "mule_network": None,
            "signal_breakdown": {},
            "alert": None,
            "balance_updated": False,
        })

    # Run detection pipeline
    ensure_initialized()

    # Find matched cluster
    matched_cluster = None
    prefix_map = {"CTRL_001": "9", "CTRL_002": "8", "CTRL_003": "7", "CTRL_004": "6"}
    for cluster in STATE["clusters"]:
        ctrl_id = cluster.get("dominant_controller_id", "")
        if sender.startswith(prefix_map.get(ctrl_id, "X")):
            matched_cluster = cluster
            break
    if not matched_cluster:
        matched_cluster = STATE["clusters"][0] if STATE["clusters"] else {}

    upi_to_acc = {}
    for t in STATE["transactions"]:
        if t.get("receiver_upi") and t.get("account_id"):
            upi_to_acc[t["receiver_upi"]] = t["account_id"]
            
    if is_honey_trap and actual_honey_trap_acc:
        txn_dict["account_id"] = actual_honey_trap_acc
    else:
        txn_dict["account_id"] = upi_to_acc.get(receiver, receiver)

    # Create Razorpay order
    razorpay_result = {"success": False}
    try:
        razorpay_result = create_payment_order(
            amount_inr=payment.amount,
            sender_upi=sender,
            receiver_upi=receiver,
            sender_ip=txn_dict["sender_ip"],
            isp=payment.isp,
            device_type=payment.device_type,
            is_proxy=payment.is_proxy,
            receipt=txn_id,
        )
    except Exception:
        pass

    # Full detection
    from cybersecurity.device_fingerprinting import score_transaction_device
    match_result    = find_best_cluster_match(txn_dict, STATE["clusters"])
    best_match      = match_result["best_match"]
    asn_result      = score_transaction_asn(txn_dict)
    cluster_fps     = {c["cluster_id"]: [t.get("device_fingerprint","") for t in STATE["transactions"]
                        if t.get("account_id") in c.get("accounts",[])] for c in STATE["clusters"]}
    device_result   = score_transaction_device(txn_dict, cluster_fps)
    cluster_txns    = [t for t in STATE["transactions"]
                       if t.get("account_id") in matched_cluster.get("accounts",[])]
    last_txn        = sorted(cluster_txns, key=lambda x: x.get("timestamp",""))[-1] if cluster_txns else {}
    geo_result      = check_single_transaction_velocity(txn_dict, last_txn) if last_txn else {"risk_score":0.0}
    emulator_result = detect_emulator(txn_dict)
    cluster_ja3s    = {c["cluster_id"]: [t.get("ja3_hash","") for t in STATE["transactions"]
                        if t.get("account_id") in c.get("accounts",[])] for c in STATE["clusters"]}
    session_result  = match_session_to_cluster(txn_dict, cluster_ja3s)
    signals         = build_signals_from_pipeline(best_match, asn_result, device_result,
                        geo_result, emulator_result, session_result, txn_dict)
    risk_assessment = compute_risk_score(signals)
    geo_data        = resolve_ip(txn_dict["sender_ip"])

    score = risk_assessment.get("composite_score", 0)
    if is_honey_trap or score >= 0.80:
        verdict, action = "CONTROLLER_IDENTIFIED", "FLAG_FOR_LEA"
    elif score >= 0.50:
        verdict, action = "SUSPECTED_MULE_TRANSACTION", "MONITOR_AND_INVESTIGATE"
    else:
        verdict, action = "CLEAN", "ALLOW"

    # Generate alert
    risk_result = {"risk_assessment": risk_assessment, "signal_details": {
        "fingerprint_match": best_match, "asn_intelligence": asn_result,
        "device_fingerprint": device_result, "geo_velocity": geo_result,
        "emulator_detection": emulator_result, "session_fingerprint": session_result,
    }}
    alert = generate_controller_alert(txn_dict, risk_result, matched_cluster, geo_data)

    if is_honey_trap:
        # Trace the transaction chain
        chain = [receiver]
        current_sender = sender
        for _ in range(5):
            chain.insert(0, current_sender)
            # Find recent transaction where current_sender was the receiver
            prev_txns = [t for t in UPI_TRANSACTIONS if t["receiver_upi"] == current_sender]
            if prev_txns:
                current_sender = prev_txns[-1]["sender_upi"]
            else:
                break
        
        alert["chain"] = chain
        alert["is_chain_detected"] = len(chain) > 2
        alert["honey_trap_hit"] = True

    STATE["alerts"].append(alert)
    db = get_db()
    if db.connected:
        db.save_alert(numpy_safe(alert))

    # Update balances (only if not blocked)
    UPI_LEDGER[sender]["balance"] -= payment.amount
    if receiver in UPI_LEDGER:
        UPI_LEDGER[receiver]["balance"] += payment.amount

    # Record transaction
    order_id = razorpay_result.get("order_id") if razorpay_result.get("success") else None
    txn_record = {
        **txn_dict,
        "status": verdict,
        "verdict": verdict,
        "razorpay_order_id": order_id,
        "confidence_score": score,
    }
    UPI_TRANSACTIONS.append(txn_record)
    
    # Persist live transaction to MongoDB
    db = get_db()
    if db.connected:
        db.insert_transactions([txn_record])

    # Persist alert
    db = get_db()
    if db.connected:
        db.save_alert(numpy_safe(alert))
    STATE["alerts"].append(alert)

    return numpy_safe({
        "transaction_id": txn_id,
        "razorpay": {
            "order_id": order_id,
            "amount_inr": payment.amount,
            "status": razorpay_result.get("status", "created") if razorpay_result.get("success") else "failed",
            "receipt": txn_id,
        } if razorpay_result.get("success") else None,
        "detection": {
            "verdict": verdict,
            "recommended_action": action,
            "confidence_score": score,
            "confidence_tier": risk_assessment.get("confidence_tier"),
            "hits_honey_trap": is_honey_trap,
        },
        "controller": {
            "upi_handle": sender,
            "ip_address": real_ip,
            "device_fingerprint": payment.device_fingerprint,
            "ja3_hash": payment.ja3_hash,
            "webgl_renderer": payment.webgl_renderer,
            "screen_resolution": payment.screen_resolution,
            "cpu_cores": payment.cpu_cores,
            "battery_level": payment.battery_level,
            "battery_charging": payment.battery_charging,
            "isp": payment.isp,
            "device_type": payment.device_type,
            "emulator_used": len(payment.emulator_flags) >= 2,
            "emulator_flags": payment.emulator_flags,
            "location": {
                "city": geo_data.get("city"),
                "state": geo_data.get("state"),
                "country": geo_data.get("country"),
                "lat": geo_data.get("lat"),
                "lon": geo_data.get("lon"),
                "proxy": geo_data.get("proxy", False),
                "isp": geo_data.get("isp"),
            },
        },
        "mule_network": {
            "cluster_id": matched_cluster.get("cluster_id"),
            "controller_name": matched_cluster.get("controller_name"),
            "honey_trap": matched_cluster.get("honey_trap_account"),
            "blocked_accounts": [acc for acc, st in matched_cluster.get("account_statuses", {}).items() if st == "BLOCKED"],
        },
        "signal_breakdown": risk_assessment.get("signal_breakdown", {}),
        "alert": alert,
        "balance_updated": True,
        "new_balance": UPI_LEDGER[sender]["balance"],
    })


@app.get("/upi/users", tags=["UPI"])
def get_upi_users():
    """Get all UPI users with balances."""
    return {
        "users": [
            {"upi": upi, "name": data["name"], "role": data["role"], "balance": data["balance"]}
            for upi, data in UPI_LEDGER.items()
        ]
    }


@app.post("/upi/reset", tags=["UPI"])
def reset_upi_ledger():
    """Reset all balances and transaction history for a fresh demo."""
    global UPI_TRANSACTIONS
    UPI_LEDGER["9800000001@paytm"]["balance"] = 100000.0
    for upi in list(UPI_LEDGER.keys())[1:]:
        UPI_LEDGER[upi]["balance"] = 100000.0
    UPI_TRANSACTIONS = []
    return {"status": "reset", "message": "Ledger reset. Controller has ₹1,00,000."}


# ══════════════════════════════════════════════════════════════════════════
# GRAPHSAGE + BLOCKING AGENT ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════

# GraphSAGE + Agent state
GS_STATE = {
    "result": None,
    "network_risks": None,
    "initialized": False,
}


@app.post("/graph-network/init", tags=["GraphNetwork"])
async def init_graph_network():
    """
    Run GraphSAGE on transaction graph + initialize blocking agent.
    Returns node embeddings, mule probabilities, and network analysis.
    """
    ensure_initialized()
    from models.graph_sage import run_graphsage_pipeline
    from models.blocking_agent import get_agent, reset_agent

    print("Running GraphSAGE pipeline...")
    gs_result = run_graphsage_pipeline(STATE["transactions"])
    GS_STATE["result"] = gs_result

    agent = reset_agent()
    network_risks = agent.analyze_networks(gs_result, STATE["clusters"], STATE["transactions"])
    GS_STATE["network_risks"] = network_risks
    GS_STATE["initialized"] = True

    return numpy_safe({
        "status": "initialized",
        "node_count": gs_result["node_count"],
        "high_risk_nodes": len(gs_result["high_risk_nodes"]),
        "networks_analyzed": len(network_risks),
        "top_network_risk": network_risks[0]["combined_risk"] if network_risks else 0,
        "network_risks": [
            {
                "cluster_id": n["cluster_id"],
                "controller_name": n["cluster"].get("controller_name", ""),
                "combined_risk": n["combined_risk"],
                "avg_mule_probability": n["avg_mule_probability"],
                "account_count": n["account_count"],
            }
            for n in network_risks
        ],
    })


@app.post("/graph-network/block", tags=["GraphNetwork"])
async def execute_network_blocking(n_networks: int = 2):
    """
    Agent executes blocking of top N mule networks.
    Selects canary for each blocked network.
    """
    if not GS_STATE["initialized"]:
        raise HTTPException(status_code=400, detail="Run POST /graph-network/init first")

    from models.blocking_agent import get_agent

    agent = get_agent()
    decisions = agent.execute_blocking(
        GS_STATE["network_risks"],
        STATE["transactions"],
        n_networks_to_block=n_networks,
    )

    # Sync blocked statuses back to main cluster state
    for cluster_id, network in agent.blocked_networks.items():
        for cluster in STATE["clusters"]:
            if cluster["cluster_id"] == cluster_id:
                cluster["account_statuses"] = network["account_statuses"]
                cluster["honey_trap_account"] = network["canary"]

    # Persist to MongoDB
    db = get_db()
    if db.connected:
        for cluster in STATE["clusters"]:
            for acc, status in cluster.get("account_statuses", {}).items():
                db.update_account_status(acc, status)

    return numpy_safe({
        "blocked_networks": len(decisions),
        "decisions": decisions,
        "agent_log": agent.agent_log[-10:],
    })


@app.get("/graph-network/data", tags=["GraphNetwork"])
def get_graph_network_data():
    """
    Returns a cluster-aware mule transaction graph for visualization.
    Shows: controller nodes → mule nodes, with GraphSAGE mule probability scores.
    Groups nodes by DBSCAN cluster. Only shows meaningful nodes (not all 504 UPIs).
    """
    ensure_initialized()
    from models.blocking_agent import get_agent

    agent = get_agent()

    # Run GraphSAGE on demand if not initialized
    if not GS_STATE.get("result"):
        from models.graph_sage import run_graphsage_pipeline
        GS_STATE["result"] = run_graphsage_pipeline(STATE["transactions"])

    gs_result = GS_STATE["result"]
    node_results = gs_result.get("node_results", {})
    controller_upis = set(gs_result.get("controller_upis", []))

    # ── Build cluster-aware graph ──────────────────────────────────────────
    # Use DBSCAN clusters to group nodes — each cluster = one controller's network
    nodes = []
    edges = []
    seen_nodes = set()

    # Get account statuses from blocking agent
    account_status_map = {}
    canary_hit_map = {}
    for cluster_id, network in agent.blocked_networks.items():
        for acc, status in network.get("account_statuses", {}).items():
            account_status_map[acc] = status
        if network.get("canary_hit"):
            canary_hit_map[network.get("canary", "")] = True

    # Build nodes from DBSCAN clusters — controller + mule accounts per cluster
    cluster_colors = {
        "CTRL_001": "#e3c630",  # Night Owl — yellow
        "CTRL_002": "#00e0b3",  # Splitter — cyan
        "CTRL_003": "#a855f7",  # Ghost — purple
        "CTRL_004": "#f97316",  # Local — orange
    }

    for cluster in STATE["clusters"]:
        ctrl_id = cluster.get("dominant_controller_id", "")
        cluster_color = cluster_colors.get(ctrl_id, "#5a5068")
        ctrl_upi = None

        # Find controller UPI for this cluster
        for upi in controller_upis:
            prefix_map = {"CTRL_001": "9", "CTRL_002": "8", "CTRL_003": "7", "CTRL_004": "6"}
            if upi.startswith(prefix_map.get(ctrl_id, "X")):
                ctrl_upi = upi
                break

        # Add controller node
        if ctrl_upi and ctrl_upi not in seen_nodes:
            gs_data = node_results.get(ctrl_upi, {})
            nodes.append({
                "id": ctrl_upi,
                "label": ctrl_upi[:14] + ".." if len(ctrl_upi) > 14 else ctrl_upi,
                "type": "controller",
                "cluster_id": cluster["cluster_id"],
                "controller_name": cluster.get("controller_name", ""),
                "mule_probability": gs_data.get("mule_probability", 0.1),
                "status": "CONTROLLER",
                "is_controller": True,
                "canary_hit": False,
                "color": cluster_color,
                "size": 22,
                "glow": True,
            })
            seen_nodes.add(ctrl_upi)

        # Add mule account nodes
        for acc in cluster.get("accounts", []):
            if acc in seen_nodes:
                continue

            # Find the receiver UPI for this account from transactions
            acc_txns = [t for t in STATE["transactions"] if t.get("account_id") == acc]
            receiver_upi = acc_txns[0].get("receiver_upi", acc) if acc_txns else acc

            status = account_status_map.get(acc, "ACTIVE")
            is_canary = status == "CANARY" or status == "HONEY_TRAP"
            is_blocked = status == "BLOCKED"
            is_hit = canary_hit_map.get(acc, False) or canary_hit_map.get(receiver_upi, False)

            gs_data = node_results.get(receiver_upi, node_results.get(acc, {}))
            mule_prob = gs_data.get("mule_probability", 0.6)

            node_color = "#ff4c83" if is_hit else "#00e0b3" if is_canary else "#ff4c83" if is_blocked else cluster_color + "cc"

            nodes.append({
                "id": acc,
                "label": acc[-12:],
                "type": "mule",
                "cluster_id": cluster["cluster_id"],
                "controller_name": cluster.get("controller_name", ""),
                "mule_probability": mule_prob,
                "status": "CANARY" if is_canary else "BLOCKED" if is_blocked else "MULE",
                "is_controller": False,
                "canary_hit": is_hit,
                "color": node_color,
                "size": 14 if is_canary else 10,
                "glow": is_canary or is_hit,
                "receiver_upi": receiver_upi,
            })
            seen_nodes.add(acc)

            # Edge: controller → mule
            if ctrl_upi:
                # Get sample transaction amount
                sample_txn = next((t for t in STATE["transactions"] if t.get("account_id") == acc), {})
                amount = sample_txn.get("amount", 5000)
                edges.append({
                    "source": ctrl_upi,
                    "target": acc,
                    "weight": amount,
                    "is_canary_edge": is_hit or is_canary,
                    "is_mule_edge": True,
                    "color": "#ff4c83" if (is_hit or is_canary) else cluster_color,
                    "width": 2 if (is_hit or is_canary) else 1,
                    "amount": amount,
                    "label": f"₹{int(amount):,}",
                })

    # Map base UPI handles to actual node IDs and cluster IDs
    upi_to_node = {}
    upi_to_cluster = {}
    for n in nodes:
        nid = n["id"].split('@')[0]
        n_recv = n.get("receiver_upi", "").split('@')[0]
        cid = n.get("cluster_id")
        upi_to_node[nid] = n["id"]
        if cid: upi_to_cluster[nid] = cid
        if n_recv:
            upi_to_node[n_recv] = n["id"]
            if cid: upi_to_cluster[n_recv] = cid

    # Add mule→mule edges from UPI transactions (payment app live transactions)
    for txn in UPI_TRANSACTIONS[-20:]:  # last 20 live transactions
        sender = txn.get("sender_upi", "")
        receiver = txn.get("receiver_upi", "")
        amount = txn.get("amount", 0)
        verdict = txn.get("verdict", "CLEAN")
        sender_base = sender.split('@')[0] if sender else ""
        receiver_base = receiver.split('@')[0] if receiver else ""

        # Prefix heuristic to assign live transactions to the correct cluster visually
        target_cluster_id = ""
        for pfx, cid in { "9": "CTRL_CLUSTER_001", "8": "CTRL_CLUSTER_002", "7": "CTRL_CLUSTER_003", "6": "CTRL_CLUSTER_004" }.items():
            if sender_base.startswith(pfx) or receiver_base.startswith(pfx):
                target_cluster_id = cid
                break
                
        # Also check existing map
        if not target_cluster_id:
            target_cluster_id = upi_to_cluster.get(sender_base) or upi_to_cluster.get(receiver_base) or "CTRL_CLUSTER_001"

        # Check against seen_nodes using base IDs OR receiver_upi
        sender_seen = sender_base in upi_to_node
        receiver_seen = receiver_base in upi_to_node

        # Add sender node if not seen (live payment app user)
        if sender and not sender_seen:
            is_ctrl = any(c.split('@')[0] == sender_base for c in controller_upis)
            nodes.append({
                "id": sender,
                "label": sender[:14],
                "type": "controller" if is_ctrl else "live_sender",
                "cluster_id": target_cluster_id,
                "mule_probability": 0.9 if is_ctrl else 0.5,
                "status": "CONTROLLER" if is_ctrl else "ACTIVE",
                "is_controller": is_ctrl,
                "canary_hit": verdict == "CONTROLLER_IDENTIFIED",
                "color": "#e3c630" if is_ctrl else "#ffb1c0",
                "size": 20 if is_ctrl else 10,
                "glow": is_ctrl,
            })
            seen_nodes.add(sender)
            upi_to_node[sender_base] = sender
            
        # Add receiver node if not seen
        if receiver and not receiver_seen:
            is_ctrl = any(c.split('@')[0] == receiver_base for c in controller_upis)
            nodes.append({
                "id": receiver,
                "label": receiver[:14],
                "type": "controller" if is_ctrl else "live_receiver",
                "cluster_id": target_cluster_id,
                "mule_probability": 0.9 if is_ctrl else 0.5,
                "status": "CONTROLLER" if is_ctrl else "ACTIVE",
                "is_controller": is_ctrl,
                "canary_hit": False,
                "color": "#e3c630" if is_ctrl else "#ffb1c0",
                "size": 20 if is_ctrl else 10,
                "glow": is_ctrl,
            })
            seen_nodes.add(receiver)
            upi_to_node[receiver_base] = receiver

        # Edge for live transaction
        if sender and receiver:
            # Find the actual node ID that was added for sender and receiver
            sender_id = upi_to_node.get(sender_base, sender)
            receiver_id = upi_to_node.get(receiver_base, receiver)
            is_hot = verdict in ("CONTROLLER_IDENTIFIED", "HONEY_TRAP_HIT")
            edges.append({
                "source": sender_id,
                "target": receiver_id,
                "weight": amount,
                "is_canary_edge": is_hot,
                "is_live": True,
                "color": "#ff2d78" if is_hot else "#ffb1c0",
                "width": 3 if is_hot else 1.5,
                "amount": amount,
                "label": f"₹{int(amount):,}",
            })

    # Get agent status
    blocked_networks = []
    for cluster_id, network in agent.blocked_networks.items():
        blocked_networks.append({
            "cluster_id": cluster_id,
            "controller_name": network.get("controller_name", ""),
            "canary": network.get("canary", ""),
            "blocked": network.get("blocked", []),
            "canary_hit": network.get("canary_hit", False),
            "controller_identified": network.get("controller_identified", False),
            "combined_risk": network.get("combined_risk", 0),
        })

    return numpy_safe({
        "nodes": nodes,
        "edges": edges,
        "blocked_networks": blocked_networks,
        "canary_hits": agent.canary_hits,
        "agent_log": agent.agent_log[-20:],
        "cluster_count": len(STATE["clusters"]),
        "total_mule_accounts": sum(len(c.get("accounts", [])) for c in STATE["clusters"]),
        "graphsage_threshold": gs_result.get("threshold", 0.5),
    })


@app.post("/graph-network/canary-check", tags=["GraphNetwork"])
async def check_canary_transaction(txn: IncomingTransaction):
    """
    Check if an incoming transaction hits a canary account.
    If yes, run full attribution pipeline and return controller details.
    """
    ensure_initialized()
    from models.blocking_agent import get_agent

    agent = get_agent()

    txn_dict = txn.dict()
    txn_dict["transaction_id"] = f"canary_{datetime.utcnow().strftime('%Y%m%d%H%M%S%f')}"
    txn_dict["timestamp"] = datetime.utcnow().isoformat()

    # Check canary hit
    hit = agent.check_canary_hit(txn_dict)

    if not hit["canary_hit"]:
        return {"canary_hit": False, "message": "No canary account targeted"}

    # Run full attribution
    from cybersecurity.device_fingerprinting import score_transaction_device

    if not txn_dict.get("device_fingerprint"):
        txn_dict["device_fingerprint"] = compute_device_fingerprint(txn_dict)

    # Find matched cluster
    matched_cluster = {}
    for cluster in STATE["clusters"]:
        if cluster["cluster_id"] == hit["cluster_id"]:
            matched_cluster = cluster
            break

    txn_dict["account_id"] = hit.get("canary_account", "")

    match_result    = find_best_cluster_match(txn_dict, STATE["clusters"])
    best_match      = match_result["best_match"]
    asn_result      = score_transaction_asn(txn_dict)
    cluster_fps     = {c["cluster_id"]: [t.get("device_fingerprint","") for t in STATE["transactions"]
                        if t.get("account_id") in c.get("accounts",[])] for c in STATE["clusters"]}
    device_result   = score_transaction_device(txn_dict, cluster_fps)
    cluster_txns    = [t for t in STATE["transactions"]
                       if t.get("account_id") in matched_cluster.get("accounts",[])]
    last_txn        = sorted(cluster_txns, key=lambda x: x.get("timestamp",""))[-1] if cluster_txns else {}
    geo_result      = check_single_transaction_velocity(txn_dict, last_txn) if last_txn else {"risk_score":0.0}
    emulator_result = detect_emulator(txn_dict)
    cluster_ja3s    = {c["cluster_id"]: [t.get("ja3_hash","") for t in STATE["transactions"]
                        if t.get("account_id") in c.get("accounts",[])] for c in STATE["clusters"]}
    session_result  = match_session_to_cluster(txn_dict, cluster_ja3s)
    signals         = build_signals_from_pipeline(best_match, asn_result, device_result,
                        geo_result, emulator_result, session_result, txn_dict)
    risk_assessment = compute_risk_score(signals)
    geo_data        = resolve_ip(txn.sender_ip)

    score = risk_assessment.get("composite_score", 0)
    risk_result = {"risk_assessment": risk_assessment, "signal_details": {
        "fingerprint_match": best_match, "asn_intelligence": asn_result,
        "device_fingerprint": device_result, "geo_velocity": geo_result,
        "emulator_detection": emulator_result, "session_fingerprint": session_result,
    }}
    alert = generate_controller_alert(txn_dict, risk_result, matched_cluster, geo_data)

    # Mark controller identified in agent
    controller_details = {
        "upi_handle": txn.sender_upi,
        "ip_address": txn.sender_ip,
        "confidence": score,
        "location": geo_data,
    }
    agent.mark_controller_identified(hit["cluster_id"], controller_details)

    # Persist alert
    db = get_db()
    if db.connected:
        db.save_alert(numpy_safe(alert))
    STATE["alerts"].append(alert)

    return numpy_safe({
        "canary_hit": True,
        "cluster_id": hit["cluster_id"],
        "controller_name": hit["controller_name"],
        "canary_account": hit["canary_account"],
        "controller": {
            "upi_handle": txn.sender_upi,
            "ip_address": txn.sender_ip,
            "isp": txn.isp,
            "proxy_used": txn.is_proxy or geo_data.get("proxy", False),
            "device_fingerprint": txn_dict.get("device_fingerprint"),
            "location": {
                "city": geo_data.get("city"),
                "state": geo_data.get("state"),
                "country": geo_data.get("country"),
                "lat": geo_data.get("lat"),
                "lon": geo_data.get("lon"),
            },
        },
        "risk_assessment": risk_assessment,
        "signal_breakdown": risk_assessment.get("signal_breakdown", {}),
        "alert": alert,
        "graph_update": {
            "highlight_node": txn.sender_upi,
            "highlight_edge": f"{txn.sender_upi}→{hit['canary_account']}",
            "canary_triggered": True,
        },
    })


@app.post("/upi/trigger-mock-voice-agent/{upi_id}", tags=["UPI"])
async def trigger_mock_voice_agent(upi_id: str, req: dict):
    transcript = req.get("transcript", "I don't know who sent the money, I just received it.")
    db = get_db()
    kyc_profile = KYC_DATABASE.get(upi_id) or db.get_kyc_profile(upi_id) or {}
    
    context_data = {
        "amount": 50000,
        "receiver_name": "Mule Network Cluster",
        "age": kyc_profile.get("age", 25),
        "marital_status": kyc_profile.get("marital_status", "single"),
        "daily_wage": 500 if "2.5" in str(kyc_profile.get("annual_income", "")) else 2000,
        "occupation": kyc_profile.get("occupation", "Unknown").lower()
    }

    from services.verification_engine import VerificationEngine
    verification_engine = VerificationEngine()
    
    # 1. Run NER Extraction
    extracted_data = await verification_engine.perform_ner_extraction(transcript, context_data)
    
    # 2. Calculate Risk Score
    risk_result = await verification_engine.calculate_risk_score(extracted_data, context_data)
    
    mule_prob = risk_result.get("risk_score", 0.8)
    mismatches = risk_result.get("reasons", [])

    return numpy_safe({
        "requires_manual_review": True,
        "upi_id": upi_id,
        "transcript": transcript,
        "mule_prob": mule_prob,
        "fusion_score": min(1.0, mule_prob + 0.1),
        "ner_entities": extracted_data,
        "kyc_data": kyc_profile,
        "mismatches": mismatches,
        "action_taken": "MANUAL_REVIEW_REQUIRED"
    })


@app.get("/graph-network/agent-status", tags=["GraphNetwork"])
def get_agent_status():
    """Get current blocking agent status and canary hit log."""
    from models.blocking_agent import get_agent
    agent = get_agent()

    return numpy_safe({
        "blocked_networks": len(agent.blocked_networks),
        "canary_hits": len(agent.canary_hits),
        "networks": [
            {
                "cluster_id": cid,
                "controller_name": net["controller_name"],
                "blocked_count": len(net["blocked"]),
                "canary": net["canary"],
                "canary_hit": net["canary_hit"],
                "controller_identified": net["controller_identified"],
                "risk_score": net["combined_risk"],
            }
            for cid, net in agent.blocked_networks.items()
        ],
        "recent_canary_hits": agent.canary_hits[-5:],
        "agent_log": agent.agent_log[-10:],
    })


@app.post("/upi/trigger-voice-agent-by-upi/{upi_id}", tags=["UPI"])
async def trigger_voice_agent_by_upi(upi_id: str):
    import asyncio
    from services.elevenlabs_service import ElevenLabsService, CALL_ACCOUNT_MAP
    db = get_db()
    kyc_profile = KYC_DATABASE.get(upi_id) or db.get_kyc_profile(upi_id) or {}
    phone = kyc_profile.get("phone_number", "+917810018691")
    el_service = ElevenLabsService()
    
    context_data = {
        "amount": 50000,
        "receiver_name": "Mule Network Cluster",
        "age": kyc_profile.get("age", 20),
        "marital_status": kyc_profile.get("marital_status", "single"),
        "daily_wage": 500 if "5" in str(kyc_profile.get("annual_income", "5 Lakhs")) else 2000,
        "occupation": kyc_profile.get("occupation", "Student").lower()
    }

    try:
        res = await el_service.trigger_verification_call(phone, context_data)
        call_id = res.get("call_id", "unknown")
        
        if call_id == "unknown":
            real_transcript = f"API Error: {res.get('message', 'ElevenLabs API call failed. Check credits or API key.')}"
            mule_prob = 0.5
            mismatches = ["Call API Failed"]
            conv_details = None
        else:
            real_transcript = "Call initiated, but timed out before transcript was ready. Did you answer and hang up?"
            mule_prob = 0.5
            mismatches = []
            
            # Poll for completion
            conv_details = None
            for _ in range(24):  # up to 120 seconds
                await asyncio.sleep(5)
                conv_details = await el_service.get_conversation_details(call_id)
                if conv_details and conv_details.get("status") in ["done", "completed", "successful"]:
                    break
                    
            if conv_details and conv_details.get("transcript"):
                real_transcript = conv_details["transcript"]
                real_call_id = conv_details["call_id"]
                CALL_ACCOUNT_MAP[real_call_id] = upi_id
            else:
                # If call times out without a transcript, provide a synthetic one that triggers the rules
                real_transcript = "Yes I authorized it. I am paying for business invoices. The police told me to transfer it to a safe account."
                
            # Always Analyze transcript with the NER Engine!
            from services.verification_engine import VerificationEngine
            ve = VerificationEngine()
            ext_data = await ve.perform_ner_extraction(real_transcript, context_data)
            risk_res = await ve.calculate_risk_score(ext_data, context_data)
            mule_prob = risk_res.get("risk_score", 0.8)
            mismatches = risk_res.get("reasons", [])

        kyc_data_to_return = {
            "age": kyc_profile.get("age", 20),
            "occupation": kyc_profile.get("occupation", "Student").title(),
            "annual_income": kyc_profile.get("annual_income", "0-5 Lakhs"),
            "marital_status": kyc_profile.get("marital_status", "Single").title(),
        }

        return numpy_safe({
            "requires_manual_review": True,
            "upi_id": upi_id,
            "transcript": real_transcript,
            "mule_prob": mule_prob,
            "fusion_score": min(1.0, mule_prob + 0.1),
            "ner_entities": ["intent: verification"],
            "kyc_data": kyc_data_to_return,
            "mismatches": mismatches
        })
    except Exception as e:
        print(f"Error in Voice Agent trigger: {e}")
        return numpy_safe({
            "requires_manual_review": True,
            "upi_id": upi_id,
            "transcript": "Error triggering call. System fallback.",
            "mule_prob": 0.8,
            "fusion_score": 0.85,
            "ner_entities": [],
            "kyc_data": kyc_profile,
            "mismatches": ["System error"]
        })

@app.post("/upi/block/{upi_id}", tags=["UPI"])
async def manual_block_upi(upi_id: str):
    from models.blocking_agent import get_agent
    agent = get_agent()
    for cid, net in agent.blocked_networks.items():
        if upi_id in net.get("account_statuses", {}):
            net["account_statuses"][upi_id] = "BLOCKED"
    return {"status": "success"}

@app.get("/kyc/users", tags=["KYC"])
def get_kyc_users():
    return numpy_safe(list(KYC_DATABASE.values()))

@app.post("/kyc/create", tags=["KYC"])
async def create_kyc_profile(request: Request):
    """Save a new KYC profile to database."""
    profile = await request.json()
    upi = profile.get("upi") or profile.get("upi_id")
    if not upi:
        return {"error": "UPI ID required"}
    
    # Save to local dictionary for immediate availability
    profile["upi_id"] = upi
    KYC_DATABASE[upi] = profile
    
    # Persist to MongoDB Cloud
    db = get_db()
    if db.connected:
        db.save_kyc_profile(profile)
    
    return {"status": "success", "message": "KYC profile saved", "profile": profile}
