# 🛡 MuleShield — AML Mule Network Detection System

**CyberNova | Feature 04 — Controller Fingerprint Extraction & Graph Intelligence**

MuleShield detects money mule networks in UPI transaction graphs using GraphSAGE embeddings, DBSCAN clustering, device fingerprinting, and honey trap attribution. When a controller routes money through mule accounts, the system identifies the chain, blocks mules, sets a honey trap on the last account, and captures the controller's hardware fingerprint when they inevitably send to it.

---

## Repository Structure

```
cybernova/
├── muleshield_feature04/        # Backend (FastAPI) + MuleShield Dashboard (React)
│   ├── main.py                  # FastAPI backend — all API endpoints
│   ├── requirements.txt         # Python dependencies
│   ├── muleshield_frontend/     # MuleShield dashboard (React + Vite)
│   └── ...                      # ML models, cybersecurity modules, data
│
├── payment_app/                 # Simulated UPI Payment App (React + Vite)
│   ├── src/
│   └── ...
│
└── README.md                    # This file
```

---

## Quick Start

### 1. Backend (FastAPI)

```bash
cd muleshield_feature04
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend runs at **http://localhost:8000**  
API docs at **http://localhost:8000/docs**

### 2. MuleShield Dashboard (React)

```bash
cd muleshield_feature04/muleshield_frontend
npm install
npm run dev
```

Dashboard runs at **http://localhost:3000**

### 3. Payment App (React)

```bash
cd payment_app
npm install
npm run dev
```

Payment app runs at **http://localhost:3001**

> Both frontends proxy `/api` → `http://localhost:8000` via Vite config. Start the backend first.

---

## Environment Variables

Create `muleshield_feature04/.env` (optional — app works without it using fallbacks):

```env
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
IPGEO_API_KEY=your_ipgeo_key
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=muleshield
```

MongoDB is optional — the app runs fully in-memory without it.

---

## How It Works

See [`muleshield_feature04/README.md`](muleshield_feature04/README.md) for the full technical walkthrough.

---

## Team Integration

- This repo is the **main branch** — `muleshield_feature04/` is Feature 04
- Other team features should be added as separate folders at the root level
- The shared backend is `muleshield_feature04/main.py` — add new route files and include them via `app.include_router()`
- Frontend routes can be added to `muleshield_feature04/muleshield_frontend/src/App.jsx`
