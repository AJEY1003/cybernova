# ── INTEGRATE INTO EXISTING main.py ──────────────────────
# 1. from rag.chat_router import router as chat_router
#    app.include_router(chat_router)
#
# 2. Seed Qdrant once before first run:
#    python -m rag.sync_trigger
#
# 3. Start Qdrant via Docker:
#    docker run -p 6333:6333 qdrant/qdrant
#
# 4. Add to Kafka consumer (after fraud engine runs):
#    from rag.sync import sync_single_account
#    sync_single_account(sender_id, db, neo4j_driver)
#    sync_single_account(receiver_id, db, neo4j_driver)
#
# 5. Add to .env file:
#    OPENAI_API_KEY=sk-...
# ─────────────────────────────────────────────────────────

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from qdrant_client import QdrantClient

from langchain_core.messages import HumanMessage
from rag.chain import ask, clear_memory, _get_chat_history
from rag.vector_store import _get_client

router = APIRouter(prefix="/api/chat", tags=["RAG Chatbot"])

class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    answer: str
    sources: List[str]
    risk_flags: List[str]

@router.post("/", response_model=ChatResponse)
def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """
    POST endpoint to interact with the RAG chatbot.
    Retrieves relevant account information, checks fraud indicators,
    and runs the forensic LLM chain.
    """
    try:
        res = ask(request.query)
        return ChatResponse(
            answer=res["answer"],
            sources=res["sources"],
            risk_flags=res["risk_flags"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG Chain Error: {str(e)}")

@router.get("/health")
def health_endpoint() -> Dict[str, str]:
    """
    GET endpoint to perform health checks, verifying connections
    to Qdrant and returning embedder model details.
    """
    try:
        # Ping Qdrant using the configured client (embedded or remote)
        client = _get_client()
        client.get_collections()
        qdrant_status = "connected"
    except Exception:
        qdrant_status = "disconnected"

    return {
        "status": "ok",
        "qdrant": qdrant_status,
        "model": "all-MiniLM-L6-v2"
    }

@router.get("/history", response_model=List[Dict[str, str]])
def get_history_endpoint() -> List[Dict[str, str]]:
    """
    GET endpoint to retrieve the active windowed conversation history (up to k=6).
    """
    history = []
    try:
        for msg in _get_chat_history():
            role = "human" if isinstance(msg, HumanMessage) else "ai"
            history.append({"role": role, "content": msg.content})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading chat history: {str(e)}")
    return history

@router.delete("/history")
def delete_history_endpoint() -> Dict[str, str]:
    """
    DELETE endpoint to clear the conversation window memory.
    """
    try:
        clear_memory()
        return {"status": "conversation cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing history: {str(e)}")
