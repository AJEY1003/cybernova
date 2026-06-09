"""
ML Prediction Service for MuleDNA Phase 7
Loads trained models and makes fraud predictions on new transactions.
"""

import joblib
import numpy as np
import os

MODEL_DIR = os.path.join(os.path.dirname(__file__), "../../ml_models")

FEATURES = [
    "amount", "tx_frequency_5min", "is_new_beneficiary",
    "rapid_in_out", "hour_of_day", "ip_change",
    "device_change", "num_connections"
]

class MLService:
    _rf_model = None
    _iso_model = None
    _scaler = None
    _loaded = False

    @classmethod
    def load_models(cls):
        rf_path = os.path.join(MODEL_DIR, "fraud_model.pkl")
        iso_path = os.path.join(MODEL_DIR, "anomaly_model.pkl")
        scaler_path = os.path.join(MODEL_DIR, "scaler.pkl")

        if not os.path.exists(rf_path):
            raise FileNotFoundError(
                "ML models not found. Please run: python scripts/generate_dataset.py && python scripts/ml_trainer.py"
            )
        
        cls._rf_model = joblib.load(rf_path)
        cls._iso_model = joblib.load(iso_path)
        cls._scaler = joblib.load(scaler_path)
        cls._loaded = True

    @classmethod
    def predict(cls, features: dict) -> dict:
        if not cls._loaded:
            cls.load_models()

        # Build feature vector in correct order
        x = np.array([[features.get(f, 0) for f in FEATURES]])
        x_scaled = cls._scaler.transform(x)

        # RandomForest: fraud probability
        rf_proba = cls._rf_model.predict_proba(x_scaled)[0][1]  # prob of class 1 (fraud)
        rf_label = int(rf_proba >= 0.5)

        # IsolationForest: anomaly (-1=anomaly, 1=normal)
        iso_pred = cls._iso_model.predict(x_scaled)[0]
        is_anomaly = int(iso_pred == -1)

        # Combined score: weight RF more
        combined_score = round((rf_proba * 0.7 + is_anomaly * 0.3), 4)

        return {
            "fraud_probability": round(float(rf_proba), 4),
            "is_anomaly": bool(is_anomaly),
            "combined_risk_score": combined_score,
            "verdict": "FRAUD" if combined_score >= 0.5 else "NORMAL",
            "confidence": "HIGH" if combined_score >= 0.7 or combined_score <= 0.2 else "MEDIUM"
        }
