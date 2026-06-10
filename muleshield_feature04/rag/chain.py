import os
from collections import deque
from typing import Any, Deque, Dict, List, Tuple

from dotenv import load_dotenv

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough, RunnableLambda
from langchain_core.documents import Document
from langchain_openai import ChatOpenAI

from rag.retriever import get_smart_retriever

# Load environment variables (e.g. OPENAI_API_KEY)
load_dotenv()

# ── LLM (lazy-initialized on first call) ────────────────────────────────────
# Instantiated lazily so that importing this module does NOT require
# API keys to be present at import time — only at request time.
_llm: Any = None

def _get_llm() -> Any:
    global _llm
    if _llm is None:
        provider = os.getenv("LLM_PROVIDER", "openai").lower()
        if provider == "gemini":
            from langchain_google_genai import ChatGoogleGenerativeAI
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                api_key = os.getenv("OPENAI_API_KEY")
            model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            _llm = ChatGoogleGenerativeAI(
                model=model,
                temperature=0.1,
                google_api_key=api_key
            )
        elif provider == "openrouter":
            api_key = os.getenv("OPENROUTER_API_KEY")
            model = os.getenv("OPENROUTER_MODEL", "openai/gpt-3.5-turbo")
            _llm = ChatOpenAI(
                model=model,
                temperature=0.1,
                openai_api_key=api_key,
                base_url="https://openrouter.ai/api/v1"
            )
        elif provider == "ollama":
            from langchain_community.chat_models import ChatOllama
            base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
            model = os.getenv("OLLAMA_MODEL", "llama3")
            _llm = ChatOllama(
                base_url=base_url,
                model=model,
                temperature=0.1
            )
        else:
            # Default to OpenAI
            _llm = ChatOpenAI(
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                temperature=0.1,
            )
    return _llm

# ── SYSTEM PROMPT ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a helpful and knowledgeable forensic fraud analyst assistant for MuleDNA, a real-time bank fraud detection system. 

Your goal is to assist the analyst by explaining findings in a clear, natural, and conversational manner, as if you are discussing the data with a colleague. Avoid rigid, overly structured, or mechanical checklists unless specifically asked.

Follow these strict operational rules:
1. Grounding: Answer the user's questions using ONLY the account and transaction data provided in the context. Never invent, extrapolate, or speculate beyond the provided facts.
2. Direct Citations: Always cite specific Account IDs and Transaction IDs when referring to them.
3. Conversational Flow: Present your insights in well-structured paragraphs with a natural, professional tone. Use lists or bullet points only when naturally presenting multiple distinct items.
4. Risk Exposure: If an account has a risk score > 50, explicitly highlight it as HIGH RISK in your discussion.
5. Pattern Highlight: If a fraud ring, cycle, or other suspicious pattern (like rapid in-out or device sharing) is present in the data, explain the connections and patterns conversationally.
6. Missing/Negative Cases: 
   - If the context has information but the query asks about a risk/pattern that isn't present, state clearly and conversationally that based on the data, no such risk or pattern exists.
   - If the context completely lacks any information to answer the question, state: "Insufficient data in the system for this query."
"""

prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="chat_history"),
    ("human", "Context from MuleDNA:\n{context}\n\nQuestion: {question}")
])

# ── SLIDING-WINDOW MEMORY (k = 6 turns) ──────────────────────────────────────
# LangChain >= 1.x removed the legacy ConversationBufferWindowMemory.
# We implement the same semantics using langchain_core primitives only.
WINDOW_SIZE = 6
_history: Deque[Tuple[str, str]] = deque(maxlen=WINDOW_SIZE)


def _get_chat_history() -> List[BaseMessage]:
    """Return the current windowed history as a list of BaseMessage objects."""
    messages: List[BaseMessage] = []
    for human_msg, ai_msg in _history:
        messages.append(HumanMessage(content=human_msg))
        messages.append(AIMessage(content=ai_msg))
    return messages


def _save_context(human_input: str, ai_output: str) -> None:
    """Append a (human, ai) turn to the sliding window."""
    _history.append((human_input, ai_output))


def clear_memory() -> None:
    """Wipe conversation history."""
    _history.clear()


# ── HELPERS ──────────────────────────────────────────────────────────────────
def format_docs(docs: List[Document]) -> str:
    """Format retrieved documents into a plain text block."""
    if not docs:
        return "No relevant account or transaction documents found."
    return "\n---\n".join(doc.page_content for doc in docs)


# ── CHAIN BUILDER ─────────────────────────────────────────────────────────────
def build_chain(query: str) -> Any:
    """
    Dynamically builds the per-query LCEL pipeline using the smart retriever.
    """
    retriever = get_smart_retriever(query)

    chain = (
        {
            "context": retriever | RunnableLambda(format_docs),
            "question": RunnablePassthrough(),
            "chat_history": RunnableLambda(lambda _: _get_chat_history()),
        }
        | prompt
        | _get_llm()
        | StrOutputParser()
    )
    return chain


# ── PUBLIC API ────────────────────────────────────────────────────────────────
def ask(query: str) -> Dict[str, Any]:
    """
    Invokes the RAG chain, updates the conversation window, and returns
    the answer together with source account IDs and risk-flagged accounts.
    """
    chain = build_chain(query)
    answer = chain.invoke(query)

    # Persist this turn in the sliding window
    _save_context(query, answer)

    # Run retriever independently to surface source metadata
    retriever = get_smart_retriever(query)
    docs = retriever.invoke(query)

    sources = list({
        doc.metadata["account_id"]
        for doc in docs
        if doc.metadata.get("account_id")
    })

    risk_flags = list({
        doc.metadata["account_id"]
        for doc in docs
        if doc.metadata.get("account_id") and doc.metadata.get("risk_score", 0) > 50
    })

    return {
        "answer": answer,
        "sources": sources,
        "risk_flags": risk_flags,
    }

# Trigger hot-reload for configuration updates

