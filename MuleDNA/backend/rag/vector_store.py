import os
import uuid
from typing import List, Optional
from dotenv import load_dotenv
from langchain_core.documents import Document
from langchain_core.vectorstores import VectorStoreRetriever
from langchain_qdrant import QdrantVectorStore
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, Filter, FieldCondition, MatchValue, Range

# Load .env so env vars are available even when this module is imported directly
load_dotenv()

from rag.embedder import embeddings

# Embedding dimension for all-MiniLM-L6-v2
EMBEDDING_DIM = 384

_EMBEDDED_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "qdrant_data")


_qdrant_client_instance = None

def _get_client() -> QdrantClient:
    """Return a QdrantClient — reads env vars lazily so dotenv always takes effect."""
    global _qdrant_client_instance
    if _qdrant_client_instance is not None:
        return _qdrant_client_instance

    # Read lazily so .env is loaded before these are evaluated
    qdrant_url = os.getenv("QDRANT_URL", "")
    qdrant_api_key = os.getenv("QDRANT_API_KEY", "")

    if qdrant_url:
        if qdrant_api_key:
            _qdrant_client_instance = QdrantClient(url=qdrant_url, api_key=qdrant_api_key, check_compatibility=False)
        else:
            _qdrant_client_instance = QdrantClient(url=qdrant_url, check_compatibility=False)
    else:
        # Embedded mode: data stored at backend/qdrant_data/ — no Docker needed
        _qdrant_client_instance = QdrantClient(path=_EMBEDDED_PATH)
    return _qdrant_client_instance


def _ensure_collection(client: QdrantClient, collection_name: str = None) -> None:
    """Create the Qdrant collection if it does not already exist."""
    if collection_name is None:
        collection_name = os.getenv("QDRANT_COLLECTION_NAME", "RAG_CHATBOT")
    try:
        exists = client.collection_exists(collection_name=collection_name)
    except Exception:
        # Fallback for older qdrant-client versions
        try:
            names = [c.name for c in client.get_collections().collections]
            exists = collection_name in names
        except Exception:
            exists = False

    if not exists:
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )


def get_vectorstore() -> QdrantVectorStore:
    """Return a QdrantVectorStore, creating the collection on first call."""
    collection_name = os.getenv("QDRANT_COLLECTION_NAME", "RAG_CHATBOT")
    client = _get_client()
    _ensure_collection(client, collection_name)
    return QdrantVectorStore(
        client=client,
        collection_name=collection_name,
        embedding=embeddings,
    )



def upsert_account(doc: Document) -> None:
    """Upsert a single account document, using a deterministic UUID to prevent duplicates."""
    vs = get_vectorstore()
    doc_id = doc.metadata.get("doc_id", f"account_{doc.metadata.get('account_id')}")
    # Generate deterministic UUID from doc_id to satisfy Qdrant's ID constraints
    qdrant_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, doc_id))
    vs.add_documents([doc], ids=[qdrant_id])


def upsert_batch(docs: List[Document]) -> None:
    """Upsert a batch of account documents to Qdrant."""
    if not docs:
        return
    vs = get_vectorstore()
    ids = []
    for doc in docs:
        doc_id = doc.metadata.get("doc_id", f"account_{doc.metadata.get('account_id')}")
        # Generate deterministic UUID from doc_id to satisfy Qdrant's ID constraints
        qdrant_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, doc_id))
        ids.append(qdrant_id)
    vs.add_documents(docs, ids=ids)
    print(f"Upserted {len(docs)} account documents to Qdrant.")


def get_retriever(
    search_type: str = "similarity",
    k: int = 3,
    filter_account_id: Optional[str] = None,
    min_risk_score: Optional[int] = None,
    filter_flagged: Optional[bool] = None,
) -> VectorStoreRetriever:
    """
    Build a retriever with optional Qdrant metadata filters.
    LangChain-Qdrant stores user metadata under the 'metadata' payload key.
    """
    conditions = []

    if filter_account_id is not None:
        conditions.append(
            FieldCondition(
                key="metadata.account_id",
                match=MatchValue(value=filter_account_id),
            )
        )
    if filter_flagged is not None:
        conditions.append(
            FieldCondition(
                key="metadata.is_flagged",
                match=MatchValue(value=filter_flagged),
            )
        )
    if min_risk_score is not None:
        conditions.append(
            FieldCondition(
                key="metadata.risk_score",
                range=Range(gte=min_risk_score),
            )
        )

    filter_obj = Filter(must=conditions) if conditions else None

    search_kwargs: dict = {"k": k}
    if filter_obj is not None:
        search_kwargs["filter"] = filter_obj

    return get_vectorstore().as_retriever(
        search_type=search_type,
        search_kwargs=search_kwargs,
    )
