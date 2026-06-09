"""
Synthetic Dataset Generator for MuleDNA ML Phase 7

Features:
  - amount: transaction amount
  - tx_frequency_5min: number of transactions in last 5 mins
  - is_new_beneficiary: 1 if first-time receiver, else 0
  - rapid_in_out: 1 if account received money in last 1 hour
  - hour_of_day: UTC hour of the transaction (0-23)
  - ip_change: 1 if IP changed from last activity
  - device_change: 1 if device changed from last activity
  - num_connections: number of linked accounts via shared device/IP

Label:
  - is_fraud: 1 = fraud, 0 = normal
"""

import pandas as pd
import numpy as np
import os

np.random.seed(42)
N = 1500  # total samples

def generate_fraud_sample():
    return {
        "amount": np.random.choice([
            np.random.uniform(50001, 500000),   # large amount
            np.random.uniform(100, 5000)         # small rapid transfers
        ]),
        "tx_frequency_5min": np.random.randint(3, 10),
        "is_new_beneficiary": 1,
        "rapid_in_out": np.random.choice([0, 1], p=[0.2, 0.8]),
        "hour_of_day": np.random.choice(list(range(0, 5)) + list(range(22, 24))),
        "ip_change": np.random.choice([0, 1], p=[0.1, 0.9]),
        "device_change": np.random.choice([0, 1], p=[0.2, 0.8]),
        "num_connections": np.random.randint(3, 10),
        "is_fraud": 1
    }

def generate_normal_sample():
    return {
        "amount": np.random.uniform(100, 30000),
        "tx_frequency_5min": np.random.randint(0, 2),
        "is_new_beneficiary": np.random.choice([0, 1], p=[0.8, 0.2]),
        "rapid_in_out": 0,
        "hour_of_day": np.random.randint(8, 20),
        "ip_change": 0,
        "device_change": 0,
        "num_connections": np.random.randint(0, 2),
        "is_fraud": 0
    }

fraud_samples = [generate_fraud_sample() for _ in range(N // 3)]
normal_samples = [generate_normal_sample() for _ in range(2 * N // 3)]

df = pd.DataFrame(fraud_samples + normal_samples).sample(frac=1).reset_index(drop=True)

os.makedirs("../ml_models", exist_ok=True)
df.to_csv("../ml_models/training_data.csv", index=False)

print(f"Dataset generated: {len(df)} samples ({df['is_fraud'].sum()} fraud, {(df['is_fraud']==0).sum()} normal)")
print(df.head())
