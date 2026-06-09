import socketio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import ValidationError
from typing import List, Dict, Any

from models import Transaction, EchoChain
from engine import EchoTracker

# Create FastAPI app
fastapi_app = FastAPI()

# Enable CORS for REST endpoints
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create Socket.IO async server
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

# Wrap FastAPI with ASGI app for Socket.IO
app = socketio.ASGIApp(sio, fastapi_app)

tracker = EchoTracker()

@fastapi_app.get("/api/health")
async def health_check():
    return {"status": "ok"}

@fastapi_app.get("/api/chains")
async def get_chains():
    return [chain.model_dump() for chain in tracker.get_active_chains()]

@fastapi_app.get("/api/stats")
async def get_stats():
    device_to_accounts_serializable = {k: list(v) for k, v in tracker.device_to_accounts.items()}
    ip_to_accounts_serializable = {k: list(v) for k, v in tracker.ip_to_accounts.items()}
    
    shared_devices = {k: v for k, v in device_to_accounts_serializable.items() if len(v) >= 2}
    
    most_reused_ip = "None"
    max_ip_accounts = 0
    for ip, accounts in ip_to_accounts_serializable.items():
        if len(accounts) > max_ip_accounts:
            max_ip_accounts = len(accounts)
            most_reused_ip = ip
            
    top_suspicious_device = "None"
    max_device_accounts = 0
    for dev, accounts in device_to_accounts_serializable.items():
        if len(accounts) > max_device_accounts:
            max_device_accounts = len(accounts)
            top_suspicious_device = dev
            
    return {
        "sharedDevicesCount": len(shared_devices),
        "mostReusedIp": f"{most_reused_ip} ({max_ip_accounts} accounts)" if max_ip_accounts > 0 else "None",
        "topSuspiciousDevice": f"{top_suspicious_device} ({max_device_accounts} accounts)" if max_device_accounts > 0 else "None",
        "deviceToAccounts": device_to_accounts_serializable,
        "ipToAccounts": ip_to_accounts_serializable,
        "deviceVpnStatus": tracker.device_vpn_status
    }

@fastapi_app.post("/api/transactions")
async def process_transaction(tx: Transaction):
    try:
        updated_chains = tracker.process_transaction(tx)
        
        # Emit real-time events to all connected clients
        await sio.emit('new_transaction', tx.model_dump())
        
        if len(updated_chains) > 0:
            await sio.emit('fraud_alert', [chain.model_dump() for chain in updated_chains])
            
        return {"success": True, "fraudDetected": len(updated_chains) > 0}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@sio.event
async def connect(sid, environ):
    print("Client connected:", sid)
    # Send initial state
    await sio.emit('initial_chains', [chain.model_dump() for chain in tracker.get_active_chains()], to=sid)

@sio.event
async def disconnect(sid):
    print("Client disconnected:", sid)

# The server can be run with: uvicorn main:app --port 4000
