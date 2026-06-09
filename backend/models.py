from pydantic import BaseModel
from typing import List

class Transaction(BaseModel):
    id: str
    senderId: str
    receiverId: str
    amount: float
    timestamp: int
    deviceId: str
    ipAddress: str
    geoRegion: str
    type: str
    riskScore: int
    browserFingerprint: str = "unknown"
    userAgent: str = "unknown"
    os: str = "unknown"
    vpnUsage: bool = False

class EchoChain(BaseModel):
    chainId: str
    transactions: List[Transaction]
    startTime: int
    lastUpdateTime: int
    confidenceScore: int
    totalAmount: float
    depth: int

class AccountNode(BaseModel):
    accountId: str
    riskScore: int
    balance: float
    flagged: bool
    incomingChains: List[str]
    outgoingChains: List[str]
