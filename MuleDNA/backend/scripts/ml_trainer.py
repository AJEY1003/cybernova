"""
ML Trainer for MuleDNA Phase 7

Trains:
  1. IsolationForest (anomaly detection - unsupervised)
  2. RandomForestClassifier (fraud classification - supervised)

Saves both models to ../ml_models/
"""

import pandas as pd
import numpy as np
import joblib
import os
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, accuracy_score

FEATURES = [
    "amount", "tx_frequency_5min", "is_new_beneficiary",
    "rapid_in_out", "hour_of_day", "ip_change",
    "device_change", "num_connections"
]

os.makedirs("../ml_models", exist_ok=True)

# Load dataset
df = pd.read_csv("../ml_models/training_data.csv")
X = df[FEATURES]
y = df["is_fraud"]

# Scale features
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# --- Model 1: IsolationForest (Anomaly Detection) ---
print("\n--- Training IsolationForest ---")
iso_forest = IsolationForest(n_estimators=100, contamination=0.33, random_state=42)
iso_forest.fit(X_scaled)
iso_preds = iso_forest.predict(X_scaled)
# IsolationForest returns -1 for anomaly, 1 for normal — convert to 0/1
iso_labels = [1 if p == -1 else 0 for p in iso_preds]
print(f"IsolationForest detected {sum(iso_labels)} anomalies out of {len(iso_labels)}")

# --- Model 2: RandomForestClassifier (Supervised) ---
print("\n--- Training RandomForestClassifier ---")
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)
rf_model = RandomForestClassifier(n_estimators=100, random_state=42, class_weight="balanced")
rf_model.fit(X_train, y_train)

y_pred = rf_model.predict(X_test)
print(f"Accuracy: {accuracy_score(y_test, y_pred):.2%}")
print(classification_report(y_test, y_pred, target_names=["Normal", "Fraud"]))

# Feature importance
importances = pd.Series(rf_model.feature_importances_, index=FEATURES).sort_values(ascending=False)
print("\nFeature Importances:")
print(importances)

# --- Save Models ---
joblib.dump(rf_model, "../ml_models/fraud_model.pkl")
joblib.dump(iso_forest, "../ml_models/anomaly_model.pkl")
joblib.dump(scaler, "../ml_models/scaler.pkl")

print("\n✅ Models saved to ml_models/")
print("  - fraud_model.pkl (RandomForest)")
print("  - anomaly_model.pkl (IsolationForest)")
print("  - scaler.pkl (StandardScaler)")
