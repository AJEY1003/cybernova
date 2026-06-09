from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from database.neo4j_connection import driver
from services.graph_service import GraphService
from models.models import Transaction
from pydantic import BaseModel

router = APIRouter(prefix="/graph", tags=["Graph"])

def get_graph_session():
    session = driver.session()
    try:
        yield session
    finally:
        session.close()

@router.post("/sync")
def sync_to_neo4j(db: Session = Depends(get_db), g_session=Depends(get_graph_session)):
    """
    Reads all transactions from PostgreSQL and syncs them to Neo4j graph.
    """
    try:
        transactions = db.query(Transaction).all()
        count = 0
        for tx in transactions:
            GraphService.sync_transaction(
                g_session,
                sender=tx.sender,
                receiver=tx.receiver,
                device_id=tx.device_id,
                ip_address=tx.ip_address
            )
            count += 1
        return {"status": "synced", "transactions_synced": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/connected/{account_id}")
def get_connected_accounts(account_id: str, g_session=Depends(get_graph_session)):
    """
    Returns all accounts connected to the given account via shared Device or IP.
    """
    connections = GraphService.get_connected_accounts(g_session, account_id)
    return {
        "account_id": account_id,
        "connected_accounts": connections,
        "total_connections": len(connections),
        "risk_level": "HIGH" if len(connections) >= 3 else "MEDIUM" if len(connections) >= 1 else "LOW"
    }

@router.get("/clusters")
def detect_clusters(g_session=Depends(get_graph_session)):
    """
    Detects suspicious clusters of accounts sharing devices or IPs — typical mule ring pattern.
    """
    clusters = GraphService.detect_clusters(g_session)
    return {
        "total_clusters": len(clusters),
        "clusters": clusters
    }

@router.get("/path/{sender}/{receiver}")
def trace_path(sender: str, receiver: str, g_session=Depends(get_graph_session)):
    """
    Traces the shortest money-flow path between two accounts.
    """
    path = GraphService.get_transaction_path(g_session, sender, receiver)
    if not path:
        raise HTTPException(status_code=404, detail="No transaction path found between these accounts")
    return path

@router.get("/data")
def get_d3_data(g_session=Depends(get_graph_session)):
    """
    Returns nodes and links for D3.js force-directed graph.
    """
    return GraphService.get_d3_data(g_session)
