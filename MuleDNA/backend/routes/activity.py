from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database.connection import get_db
from services.behavioral_analyzer import BehavioralAnalyzer
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

class ActivityLog(BaseModel):
    account_id: str
    event_type: str  # "login", "transaction", "logout"
    ip_address: Optional[str] = None
    device_id: Optional[str] = None

@router.post("/log_activity")
def log_activity(activity: ActivityLog, db: Session = Depends(get_db)):
    behavioral_score, reasons = BehavioralAnalyzer.log_and_score(
        db,
        account_id=activity.account_id,
        event_type=activity.event_type,
        ip_address=activity.ip_address or "unknown",
        device_id=activity.device_id or "unknown"
    )
    return {
        "status": "logged",
        "account_id": activity.account_id,
        "behavioral_risk_score": behavioral_score,
        "flags": reasons,
        "flagged": behavioral_score > 0
    }

@router.get("/activity/{account_id}")
def get_activity(account_id: str, db: Session = Depends(get_db)):
    from models.models import UserActivity
    events = db.query(UserActivity).filter(
        UserActivity.account_id == account_id
    ).order_by(UserActivity.timestamp.desc()).limit(50).all()
    return [
        {
            "id": e.id,
            "event_type": e.event_type,
            "ip_address": e.ip_address,
            "device_id": e.device_id,
            "timestamp": e.timestamp
        }
        for e in events
    ]
