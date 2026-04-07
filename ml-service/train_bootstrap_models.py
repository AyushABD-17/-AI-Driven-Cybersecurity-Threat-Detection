"""
Bootstrap Model Trainer
Trains Isolation Forest + Random Forest on synthetic data so the ML
service can run immediately — before the KDD Cup dataset is downloaded.

This produces valid .pkl model files that will be overwritten once
proper training is done in notebooks/02_train.ipynb (Phase 2).

Run:
    python train_bootstrap_models.py
"""

import os
import random
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

from feature_engineering import transform_single, ATTACK_LABEL_MAP

RANDOM_STATE = 42
N_NORMAL = 10000
N_ATTACK_PER_CLASS = 1500
MODEL_DIR = "./models"

ATTACK_PROFILES = {
    "DoS": dict(
        protocol="TCP", flag="S0", duration=0.5, bytes_sent=200, bytes_received=10,
        count=450, srv_count=450, num_failed_logins=0, is_host_login=False, is_guest_login=False,
        src_port=55000, dst_port=80,
    ),
    "Probe": dict(
        protocol="UDP", flag="REJ", duration=1.0, bytes_sent=50, bytes_received=0,
        count=300, srv_count=5, num_failed_logins=0, is_host_login=False, is_guest_login=False,
        src_port=60000, dst_port=22,
    ),
    "R2L": dict(
        protocol="TCP", flag="SF", duration=120.0, bytes_sent=3000, bytes_received=1500,
        count=5, srv_count=2, num_failed_logins=10, is_host_login=False, is_guest_login=True,
        src_port=54321, dst_port=22,
    ),
    "U2R": dict(
        protocol="TCP", flag="SF", duration=300.0, bytes_sent=20000, bytes_received=8000,
        count=2, srv_count=1, num_failed_logins=15, is_host_login=True, is_guest_login=False,
        src_port=50000, dst_port=22,
    ),
}


def jitter(val, pct=0.3):
    """Add random jitter to make synthetic training data realistic."""
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        noise = val * random.uniform(-pct, pct)
        return max(0, val + noise)
    return val


def generate_synthetic_samples():
    X, y = [], []

    # Normal traffic
    for _ in range(N_NORMAL):
        log = dict(
            protocol=random.choice(["TCP", "UDP", "ICMP"]),
            flag=random.choice(["SF", "S1"]),
            duration=random.uniform(0, 120),
            bytes_sent=random.randint(64, 50000),
            bytes_received=random.randint(64, 80000),
            count=random.randint(1, 50),
            srv_count=random.randint(1, 30),
            num_failed_logins=0,
            is_host_login=random.random() < 0.05,
            is_guest_login=False,
            src_port=random.randint(1024, 65535),
            dst_port=random.choice([80, 443, 22, 53, 3306]),
        )
        X.append(transform_single(log))
        y.append(ATTACK_LABEL_MAP["normal"])

    # Attack traffic
    for attack_type, profile in ATTACK_PROFILES.items():
        for _ in range(N_ATTACK_PER_CLASS):
            log = {k: jitter(v) for k, v in profile.items()}
            X.append(transform_single(log))
            y.append(ATTACK_LABEL_MAP[attack_type])

    return np.array(X), np.array(y)


def main():
    os.makedirs(MODEL_DIR, exist_ok=True)
    print("[Bootstrap] Generating synthetic training data...")
    X, y = generate_synthetic_samples()

    # ── Isolation Forest (unsupervised — train on normal only) ──────────────
    print("[Bootstrap] Training Isolation Forest...")
    X_normal = X[y == 0]
    iso = IsolationForest(
        n_estimators=200,
        contamination=0.15,
        max_samples="auto",
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    iso.fit(X_normal)
    joblib.dump(iso, os.path.join(MODEL_DIR, "isolation_forest.pkl"))
    print(f"[Bootstrap] Isolation Forest saved → {MODEL_DIR}/isolation_forest.pkl")

    # ── Random Forest Classifier (supervised — attack traffic only) ──────────
    print("[Bootstrap] Training Random Forest Classifier...")
    # Exclude normal class from classifier training (classifier only runs on anomalies)
    mask = y > 0
    X_attack, y_attack = X[mask], y[mask]

    X_train, X_test, y_train, y_test = train_test_split(
        X_attack, y_attack, test_size=0.2, stratify=y_attack, random_state=RANDOM_STATE
    )

    clf = RandomForestClassifier(
        n_estimators=300,
        max_depth=20,
        min_samples_split=5,
        class_weight="balanced",
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    clf.fit(X_train, y_train)

    print("\n[Bootstrap] Classifier evaluation on test set:")
    from feature_engineering import ATTACK_LABEL_REVERSE
    y_pred = clf.predict(X_test)
    target_names = [ATTACK_LABEL_REVERSE[i] for i in sorted(set(y_test))]
    print(classification_report(y_test, y_pred, target_names=target_names))

    joblib.dump(clf, os.path.join(MODEL_DIR, "random_forest.pkl"))
    print(f"[Bootstrap] Random Forest saved → {MODEL_DIR}/random_forest.pkl")
    print("\n[Bootstrap] ✅ Bootstrap models ready. Run notebooks/02_train.ipynb to retrain on KDD Cup data.")


if __name__ == "__main__":
    main()
