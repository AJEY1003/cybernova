"""
dbscan_clustering.py
DBSCAN Clustering — Threat Actor Profiling
Groups mule accounts by controller using behavioral feature vectors.
No pre-specified cluster count — finds controllers automatically.
Cybersecurity technique: Adversary Attribution (MITRE ATT&CK aligned)
"""

import json
import sys
import os
import numpy as np
import pandas as pd

from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.decomposition import PCA
from sklearn.cluster import DBSCAN
from sklearn.metrics import silhouette_score

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import DBSCAN_EPS, DBSCAN_MIN_SAMPLES, PCA_COMPONENTS, CONTROLLERS

# Numeric features used for clustering
NUMERIC_FEATURES = [
    "preferred_hour_mean",
    "preferred_hour_std",
    "day_of_week_entropy",
    "inter_transaction_gap_mean",
    "inter_transaction_gap_std",
    "night_transaction_ratio",
    "amount_mean",
    "amount_std",
    "round_number_ratio",
    "just_below_threshold_ratio",
    "amount_cluster_tightness",
    "ip_subnet_consistency",
    "isp_consistency",
    "proxy_usage_ratio",
    "location_entropy",
    "device_fp_reuse",
]

CATEGORICAL_FEATURES = ["device_type", "upi_suffix"]


def prepare_feature_matrix(features_df: pd.DataFrame):
    """
    Prepare feature matrix for DBSCAN:
    - Encode categoricals
    - Scale numerics
    - PCA reduction
    """
    df = features_df.copy()

    # Encode categoricals
    le = LabelEncoder()
    for col in CATEGORICAL_FEATURES:
        if col in df.columns:
            df[col + "_enc"] = le.fit_transform(df[col].astype(str))

    # Select all numeric + encoded columns
    numeric_cols = NUMERIC_FEATURES + [c + "_enc" for c in CATEGORICAL_FEATURES if c in df.columns]
    numeric_cols = [c for c in numeric_cols if c in df.columns]

    X = df[numeric_cols].fillna(0).values

    # Scale
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # PCA
    n_components = min(PCA_COMPONENTS, X_scaled.shape[1], X_scaled.shape[0] - 1)
    pca = PCA(n_components=n_components)
    X_pca = pca.fit_transform(X_scaled)

    return X_scaled, X_pca, scaler, pca, numeric_cols


def run_dbscan(X: np.ndarray, eps: float = None, min_samples: int = None) -> np.ndarray:
    """Run DBSCAN and return cluster labels."""
    eps = eps or DBSCAN_EPS
    min_samples = min_samples or DBSCAN_MIN_SAMPLES
    db = DBSCAN(eps=eps, min_samples=min_samples, metric="euclidean")
    return db.fit_predict(X)


def tune_dbscan(X: np.ndarray, target_clusters: int = 4) -> tuple:
    """
    Tune DBSCAN eps to find the target number of clusters.
    Returns best (eps, labels, silhouette_score).
    """
    best_eps = DBSCAN_EPS
    best_labels = None
    best_score = -1
    best_n_clusters = 0

    for eps in np.arange(0.3, 2.0, 0.1):
        labels = run_dbscan(X, eps=round(eps, 2))
        n_clusters = len(set(labels)) - (1 if -1 in labels else 0)

        if n_clusters < 2:
            continue

        try:
            score = silhouette_score(X, labels)
        except Exception:
            score = -1

        # Prefer target cluster count, then best silhouette
        if n_clusters == target_clusters and score > best_score:
            best_score = score
            best_eps = round(eps, 2)
            best_labels = labels
            best_n_clusters = n_clusters

    # Fallback: best silhouette regardless of cluster count
    if best_labels is None:
        for eps in np.arange(0.3, 2.0, 0.1):
            labels = run_dbscan(X, eps=round(eps, 2))
            n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
            if n_clusters < 2:
                continue
            try:
                score = silhouette_score(X, labels)
                if score > best_score:
                    best_score = score
                    best_eps = round(eps, 2)
                    best_labels = labels
                    best_n_clusters = n_clusters
            except Exception:
                continue

    return best_eps, best_labels if best_labels is not None else run_dbscan(X), best_score


def build_cluster_fingerprints(features_df: pd.DataFrame, labels: np.ndarray) -> list:
    """
    Build controller fingerprint for each cluster.
    Returns list of cluster fingerprint dicts.
    """
    df = features_df.copy()
    df["cluster_label"] = labels

    clusters = []
    for label in sorted(set(labels)):
        if label == -1:
            continue  # noise points

        cluster_df = df[df["cluster_label"] == label]
        accounts = cluster_df["account_id"].tolist()
        ctrl_ids = cluster_df["controller_id"].value_counts()
        dominant_ctrl = ctrl_ids.index[0] if len(ctrl_ids) > 0 else "UNKNOWN"

        # Compute centroid vector
        numeric_cols = [c for c in NUMERIC_FEATURES if c in cluster_df.columns]
        centroid = cluster_df[numeric_cols].mean().to_dict()

        # Confidence: ratio of accounts matching dominant controller
        confidence = ctrl_ids.iloc[0] / len(cluster_df) if len(ctrl_ids) > 0 else 0.0

        # Honey trap: account with highest transaction count
        txn_counts = cluster_df.set_index("account_id")["transaction_count"]
        honey_trap = txn_counts.idxmax() if len(txn_counts) > 0 else accounts[0]

        # Account statuses
        account_statuses = {}
        for acc in accounts:
            account_statuses[acc] = "HONEY_TRAP" if acc == honey_trap else "BLOCKED"

        # Fingerprint summary
        ctrl_config = CONTROLLERS.get(dominant_ctrl, {})
        fingerprint = {
            "cluster_id": f"CTRL_CLUSTER_{str(label+1).zfill(3)}",
            "cluster_label": int(label),
            "dominant_controller_id": dominant_ctrl,
            "controller_name": ctrl_config.get("name", "Unknown"),
            "account_count": len(accounts),
            "accounts": accounts,
            "account_statuses": account_statuses,
            "honey_trap_account": honey_trap,
            "confidence_score": round(float(confidence), 3),
            "centroid": {k: round(float(v), 4) for k, v in centroid.items()},
            "controller_fingerprint": {
                "preferred_hour": f"{int(cluster_df['preferred_hour_mean'].mean())}:00",
                "amount_mean": round(float(cluster_df["amount_mean"].mean()), 2),
                "amount_std": round(float(cluster_df["amount_std"].mean()), 2),
                "isp": cluster_df["dominant_isp"].mode()[0] if "dominant_isp" in cluster_df.columns else "Unknown",
                "proxy_user": bool(cluster_df["proxy_usage_ratio"].mean() > 0.5),
                "night_operator": bool(cluster_df["night_transaction_ratio"].mean() > 0.3),
                "upi_suffix": cluster_df["upi_suffix"].mode()[0] if "upi_suffix" in cluster_df.columns else "Unknown",
            },
        }
        clusters.append(fingerprint)

    return clusters


def run_full_clustering_pipeline(features_df: pd.DataFrame) -> dict:
    """
    Full clustering pipeline: prepare → tune → cluster → fingerprint.
    """
    print("Preparing feature matrix...")
    X_scaled, X_pca, scaler, pca, feature_cols = prepare_feature_matrix(features_df)

    print("Tuning DBSCAN for 4 clusters...")
    best_eps, labels, sil_score = tune_dbscan(X_pca, target_clusters=4)

    n_clusters = len(set(labels)) - (1 if -1 in labels else 0)
    n_noise = list(labels).count(-1)

    print(f"Best eps: {best_eps} | Clusters: {n_clusters} | Noise: {n_noise} | Silhouette: {round(sil_score, 3)}")

    print("Building cluster fingerprints...")
    clusters = build_cluster_fingerprints(features_df, labels)

    return {
        "clusters": clusters,
        "labels": labels.tolist(),
        "n_clusters": n_clusters,
        "n_noise": n_noise,
        "silhouette_score": round(float(sil_score), 3),
        "best_eps": best_eps,
        "X_pca": X_pca,
        "scaler": scaler,
        "pca": pca,
        "feature_cols": feature_cols,
    }


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from features.feature_engineering import load_transactions, extract_features

    data_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)), "data", "synthetic_transactions.json"
    )
    if not os.path.exists(data_path):
        print("Run generate_synthetic_data.py first.")
        sys.exit(1)

    df = load_transactions(data_path)
    features_df = extract_features(df)

    result = run_full_clustering_pipeline(features_df)

    print(f"\nClustering complete: {result['n_clusters']} clusters found")
    for cluster in result["clusters"]:
        print(f"\n  {cluster['cluster_id']} — {cluster['controller_name']}")
        print(f"    Accounts: {cluster['account_count']} | Confidence: {cluster['confidence_score']}")
        print(f"    Honey Trap: {cluster['honey_trap_account']}")
        print(f"    Fingerprint: {cluster['controller_fingerprint']}")
