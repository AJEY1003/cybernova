from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import time

from database.connection import get_db, engine
from models.models import User, Transaction, Alert, RiskScore, UserActivity, Base
from schemas.schemas import UserCreate, UserResponse, TransactionCreate, TransactionResponse, AlertResponse, RiskScoreResponse
from routes.activity import router as activity_router
from routes.graph import router as graph_router
from routes.ml import router as ml_router
from kafka_client.producer import publish_transaction
from kafka_client.consumer import start_consumer_thread
from rag.chat_router import router as chat_router

app = FastAPI(title="MuleDNA API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(activity_router)
app.include_router(graph_router)
app.include_router(ml_router)
app.include_router(chat_router)  # RAG Forensic Chatbot

@app.on_event("startup")
def startup():
    # Auto-create any new tables without touching existing ones
    Base.metadata.create_all(bind=engine)
    # Start Kafka consumer as background daemon thread
    start_consumer_thread()

@app.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": time.time()}

from services.fraud_detector import FraudDetector

# --- User & Account APIs ---
@app.post("/create_account", response_model=UserResponse)
def create_account(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.account_id == user.account_id).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Account ID already registered")
    
    new_user = User(name=user.name, account_id=user.account_id)
    db.add(new_user)
    
    # Initialize a default risk score
    new_risk = RiskScore(account_id=user.account_id, score=0.0)
    db.add(new_risk)
    
    db.commit()
    db.refresh(new_user)
    return new_user

# --- Transaction APIs ---
@app.post("/add_transaction", response_model=TransactionResponse)
def add_transaction(tx: TransactionCreate, db: Session = Depends(get_db)):
    new_tx = Transaction(
        sender=tx.sender,
        receiver=tx.receiver,
        amount=tx.amount,
        device_id=tx.device_id,
        ip_address=tx.ip_address
    )
    db.add(new_tx)
    
    # Process Fraud Detection (New logic)
    is_alert, risk_score, reasons = FraudDetector.process_transaction(db, new_tx)

    db.commit()
    db.refresh(new_tx)

    # Publish to Kafka for async real-time processing
    publish_transaction({
        "id": new_tx.id,
        "sender": new_tx.sender,
        "receiver": new_tx.receiver,
        "amount": new_tx.amount,
        "device_id": new_tx.device_id,
        "ip_address": new_tx.ip_address,
        "timestamp": str(new_tx.timestamp)
    })

    return new_tx

@app.get("/transactions", response_model=List[TransactionResponse])
def get_transactions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(Transaction).offset(skip).limit(limit).all()

# --- Risk & Alert APIs ---
@app.get("/risk_score/{account_id}", response_model=RiskScoreResponse)
def get_risk_score(account_id: str, db: Session = Depends(get_db)):
    risk = db.query(RiskScore).filter(RiskScore.account_id == account_id).first()
    if not risk:
        raise HTTPException(status_code=404, detail="Risk score not found for this account")
    return risk

@app.get("/alerts", response_model=List[AlertResponse])
def get_alerts(db: Session = Depends(get_db)):
    return db.query(Alert).order_by(Alert.created_at.desc()).all()

# --- WebSocket ---
@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # For now, just echo. In next phases, we will push actual alerts here.
            data = await websocket.receive_text()
            await websocket.send_text(f"MuleDNA Monitoring Active: {data}")
    except WebSocketDisconnect:
        print("Frontend disconnected from WebSocket")
