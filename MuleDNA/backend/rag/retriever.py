import re
from typing import Any, Dict
from langchain_core.vectorstores import VectorStoreRetriever

from rag.vector_store import get_retriever

# UUID pattern (case-insensitive)
UUID_PATTERN = r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b"

def parse_intent(query: str) -> Dict[str, Any]:
    """
    Parses a user query to detect intent and extract relevant parameters.
    Supports detecting Account IDs, Transaction IDs, High Risk criteria, or defaulting to Semantic search.
    """
    # a) Account ID check: ACC-\d+, ACC\d+, ACC_\w+, or UUID
    account_match = re.search(rf"\b(ACC-\d+|ACC\d+|ACC_\w+|{UUID_PATTERN})\b", query, re.IGNORECASE)
    if account_match:
        return {"type": "account_id", "value": account_match.group(0)}

    # b) Transaction check: TXN-\d+ or TXN\d+
    txn_match = re.search(r"\b(TXN-\d+|TXN\d+)\b", query, re.IGNORECASE)
    if txn_match:
        return {"type": "txn_id", "value": txn_match.group(0)}

    # c) High risk check: contains "high risk", "flagged", "risk >", "alert"
    query_lower = query.lower()
    if any(keyword in query_lower for keyword in ["high risk", "flagged", "risk >", "alert"]):
        return {"type": "flagged", "value": True}

    # d) Default: Semantic
    return {"type": "semantic", "value": query}

def get_smart_retriever(query: str) -> VectorStoreRetriever:
    """
    Selects and returns a custom-configured VectorStoreRetriever based on the parsed query intent.
    """
    intent = parse_intent(query)
    intent_type = intent["type"]
    
    if intent_type == "account_id":
        # Specific account query, target exactly that account
        return get_retriever(k=1, filter_account_id=intent["value"])
    elif intent_type == "txn_id":
        # Transaction query, retrieve general contexts to find transaction references
        return get_retriever(k=3)
    elif intent_type == "flagged":
        # Risk query, filter by flagged status and min risk score of 50
        return get_retriever(k=5, filter_flagged=True, min_risk_score=50)
    else:
        # Default semantic query, use Maximal Marginal Relevance (MMR) for diversity
        return get_retriever(k=3, search_type="mmr")
