# MuleDNA — Real-time Bank Fraud Detection & Forensic Intelligence

MuleDNA is a real-time bank fraud detection system equipped with an intelligent Retrieval-Augmented Generation (RAG) forensic chatbot. It analyzes transaction streams, calculates risk scores, identifies suspicious clusters/cycles, and provides analysts with natural language forensic reports.

---

## Features

- **Real-Time Ingestion**: Transaction streams processed in real-time via Kafka.
- **Graph Analytics**: Identifies device-sharing networks and transaction cycles using Neo4j.
- **Machine Learning**: Anomaly detection and fraud classification models.
- **Forensic Intelligence (RAG Chatbot)**:
  - Natural language conversational assistant powered by live database profiles.
  - Automatically retrieves relevant account history, transaction lists, and risk factors.
  - Highlights high-risk entities and transaction cycles conversationally.
  - Supports multiple LLM backends (OpenRouter, Gemini, OpenAI, Ollama).

---

## Directory Structure

```text
MuleDNA/
├── backend/
│   ├── database/          # PostgreSQL & Neo4j database connections
│   ├── kafka_client/      # Kafka producers & consumers
│   ├── models/            # SQLAlchemy schemas
│   ├── rag/               # RAG chatbot engine (chains, retrievers, builders, sync hooks)
│   ├── routes/            # API endpoints (activity, graph, ML, chat)
│   ├── schemas/           # Pydantic schemas
│   ├── scripts/           # DB initialization and model training scripts
│   ├── services/          # Fraud engines, graph services, and ML inference
│   ├── main.py            # FastAPI entrypoint
│   └── requirements.txt   # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/    # Layout, NetworkVisualizer, Sidebar
│   │   ├── pages/         # ChatBot, Home, SecurityCenter, Transactions, Transfer
│   │   └── services/      # API wrappers and WebSocket connections
│   └── package.json       # React Vite config & dependencies
└── ml_models/             # Trained serialization pickles (anomaly, classifier, scaler)
```

---

## Getting Started

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- Docker (for Qdrant & Kafka)

### 2. Backend Setup
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Seed the PostgreSQL/Neo4j database and train ML models:
   ```bash
   python -m scripts.init_db
   python -m scripts.generate_dataset
   python -m scripts.ml_trainer
   ```
4. Configure environment variables in `.env` (refer to `.env.example`).
5. Seed Qdrant vector store:
   ```bash
   python -m rag.sync_trigger
   ```
6. Start the server:
   ```bash
   uvicorn main:app --reload
   ```

### 3. Frontend Setup
1. Navigate to the frontend folder:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
