from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# User & Account Schemas
class UserCreate(BaseModel):
    name: str = Field(..., example="John Doe")
    account_id: str = Field(..., example="ACC12345")

class UserResponse(BaseModel):
    id: int
    name: str
    account_id: str
    created_at: datetime
    class Config:
        from_attributes = True

# Transaction Schemas
class TransactionCreate(BaseModel):
    sender: str = Field(..., example="ACC12345")
    receiver: str = Field(..., example="ACC67890")
    amount: float = Field(..., gt=0, example=500.0)
    device_id: Optional[str] = Field(None, example="DEV_X100")
    ip_address: Optional[str] = Field(None, example="192.168.1.1")

class TransactionResponse(BaseModel):
    id: int
    sender: str
    receiver: str
    amount: float
    timestamp: datetime
    device_id: Optional[str]
    ip_address: Optional[str]
    class Config:
        from_attributes = True

# Alert Schemas
class AlertResponse(BaseModel):
    id: int
    account_id: str
    risk_score: float
    risk_level: str
    reason: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

# Risk Score Schemas
class RiskScoreResponse(BaseModel):
    account_id: str
    score: float
    updated_at: datetime
    class Config:
        from_attributes = True
