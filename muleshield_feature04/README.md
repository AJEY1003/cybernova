# 🛡 MuleShield Feature 04 — Backend & Dashboard

## Overview

This module implements the full AML (Anti-Money Laundering) pipeline for detecting mule account networks in UPI transactions. It combines graph machine learning, cybersecurity signals, and honey trap attribution to identify and attribute money mule controllers.

---

## Architecture

```
muleshield_feature04/
├── main.py                    # FastAPI app — all endpoints
├── config.py                  # Controller configs & constants
├── requirements.txt
│
├── data/
│   ├── generate_synthetic_data.py   # Generates 500 synthetic UPI transactions
│   └── synthetic_transactions.json  # Generated on first run
│
├── models/
│   ├── graph_sage.py          # GraphSAGE — 2-layer GNN, pure numpy
│   ├── dbscan_clustering.py   # DBSCAN clustering on GraphSAGE embeddings
│   ├── fingerprint_matcher.py # Cosine similarity matching against cluster profiles
│   └── blocking_agent.py      # Blocking agent — decides which accounts to block
│
├── features/
│   └── feature_engineering.py # Extracts 10 behavioral features per account
│
├── graph/
│   └── graph_intelligence.py  # NetworkX graph — community detection, centrality
│
├── cybersecurity/
│   ├── device_fingerprinting.py  # Canvas hash, WebGL, device reuse detection
│   ├── geo_velocity.py           # Impossible travel detection
│   ├── asn_intelligence.py       # ASN/ISP fraud infrastructure scoring
│   ├── emulator_detection.py     # Android emulator heuristics
│   └── session_fingerprinting.py # JA3 hash session correlation
│
├── risk/
│   └── risk_fusion_engine.py  # Fuses all signals → composite risk score (0–1)
│
├── alerts/
│   └── alert_generator.py     # Generates structured LEA alerts with all evidence
│
├── api/
│   ├── razorpay_client.py     # Razorpay order creation & verification
│   ├── ipgeo_client.py        # IP geolocation (ip-api.com)
│   └── ifsc_client.py         # Bank IFSC lookup
│
├── database/
│   └── mongo_client.py        # MongoDB persistence (optional)
│
└── muleshield_frontend/       # React dashboard
    ├── src/
    │   ├── components/
    │   │   ├── NetworkGraph.jsx    # Main graph visualization + focused overlay
    │   │   ├── HoneyTrapDetector.jsx
    │   │   ├── AlertsPanel.jsx
    │   │   └── ...
    │   ├── AppMain.jsx             # Alternative single-page layout
    │   └── App.jsx                 # Router
    └── vite.config.js              # Proxies /api → localhost:8000
```

---

## API Endpoints

### Pipeline
| Method | Path | Description |
|--------|------|-------------|
| POST | `/pipeline/init` | Initialize full pipeline (generate data → features → clustering → graph) |
| POST | `/graph-network/init` | Same, via graph-network namespace |
| POST | `/graph-network/block` | Block top N mule networks |
| GET | `/graph-network/data` | Get graph nodes + edges for visualization |
| GET | `/graph-network/agent-status` | Get blocking agent status + networks |

### Accounts & Clusters
| Method | Path | Description |
|--------|------|-------------|
| GET | `/clusters` | All DBSCAN clusters with fingerprints |
| GET | `/accounts/honey-traps` | All honey trap accounts with their UPI handles |
| GET | `/accounts/blocked` | All blocked accounts |
| PUT | `/accounts/status` | Update account status (BLOCKED/HONEY_TRAP/ACTIVE) |

### Detection
| Method | Path | Description |
|--------|------|-------------|
| POST | `/detect/honey-trap` | Run full attribution when honey trap is hit |
| POST | `/transaction/analyze` | Analyze incoming transaction |
| POST | `/transaction/controller-hit` | Full attribution when controller hits honey trap |

### UPI Ledger (Payment App integration)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/upi/balance` | Get UPI balance |
| POST | `/upi/send` | Send UPI payment (runs full detection pipeline) |
| GET | `/upi/transactions` | Transaction history |
| GET | `/upi/users` | All UPI users |
| POST | `/upi/reset` | Reset ledger for fresh demo |

### Alerts
| Method | Path | Description |
|--------|------|-------------|
| GET | `/alerts` | Get all alerts (includes hardware fingerprint data) |
| GET | `/stats` | Aggregate stats |

---

## Detection Pipeline

```
Incoming UPI Transaction
        ↓
1. Feature Extraction (10 behavioral features)
        ↓
2. GraphSAGE Embeddings (2-layer GNN, numpy)
        ↓
3. DBSCAN Clustering (finds mule network groups)
        ↓
4. Fingerprint Matching (cosine similarity vs cluster profiles)
        ↓
5. Cybersecurity Signals:
   - Device fingerprint (Canvas + WebGL hash)
   - JA3 session hash
   - ASN/ISP scoring
   - Geo-velocity (impossible travel)
   - Emulator detection
        ↓
6. Risk Fusion (weighted composite score 0–1)
        ↓
7. Verdict: CLEAN / SUSPECTED_MULE / CONTROLLER_IDENTIFIED
        ↓
8. Alert Generation (LEA report with all evidence)
```

---

## GraphSAGE Model

- **Architecture:** 2-layer GraphSAGE with mean aggregation, pure NumPy (no PyTorch)
- **Input:** 10 behavioral features per UPI account node
- **Output:** 32-dimensional embedding + mule probability (0–1)
- **Training:** Semi-supervised on structural soft labels (top 25% by heuristic mule score = labeled mule)
- **Adjacency:** Undirected edges from transaction sender→receiver pairs

**10 node features:**
1. Out-degree (normalized)
2. In-degree (normalized)
3. Total amount sent
4. Total amount received
5. Average transaction amount
6. Transaction count
7. Night operation ratio (00:00–05:00)
8. Proxy/VPN usage ratio
9. Unique receiver count
10. Amount standard deviation

---

## Honey Trap Flow

1. MuleShield identifies mule network (CTRL → M1 → M2 → M3)
2. Admin blocks M1 and M2 via the focused overlay
3. Last mule (M3) is set as honey trap (`HONEY_TRAP` status)
4. Controller, unable to reach M1/M2, routes money directly to M3's UPI
5. `/upi/send` detects receiver is honey trap → runs full attribution
6. Alert captures: device fingerprint, JA3 hash, WebGL renderer, screen resolution, CPU cores, battery level, IP address
7. MuleShield dashboard shows 🎯 HONEY TRAP HIT with all hardware details

---

## MongoDB Configuration

The application uses MongoDB to persist transactions, accounts, clusters, and alerts. We are currently using a MongoDB Atlas cloud cluster.

To configure the connection, simply add the database password to your `.env` file:

```bash
# Set in .env
MONGO_PASSWORD=your_mongodb_password
```

If the password is not provided, the app will attempt to fall back to a local instance at `mongodb://localhost:27017`.

---

## Adding Team Features

To add a new feature module from another team member:

1. Create a new folder at repo root: `feature_XX/`
2. Add a FastAPI router in that folder
3. Include it in `muleshield_feature04/main.py`:

```python
from feature_XX.router import router as feature_xx_router
app.include_router(feature_xx_router, prefix="/feature-xx")
```

4. Add a new page/route in `muleshield_feature04/muleshield_frontend/src/App.jsx`
