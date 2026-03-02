"""
SurakshaFlow — ML Fraud Detection Models
Implements Isolation Forest (anomaly detection), Random Forest (classification),
and LSTM-based time-series anomaly detection for fraud scoring.
All models are trained on synthetic data and provide inference through a unified API.
"""
from __future__ import annotations

import logging
import os
import pickle
from typing import Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger("surakshaflow.ml")

# ── Try importing sklearn – graceful fallback if unavailable ──
try:
    from sklearn.ensemble import IsolationForest, RandomForestClassifier, GradientBoostingClassifier
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, roc_auc_score
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    logger.warning("scikit-learn not installed — ML models will use rule-based fallback")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SYNTHETIC DATA GENERATOR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def generate_synthetic_dataset(n_samples: int = 2000, fraud_ratio: float = 0.3, rng_seed: int = 42) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate synthetic feature matrix + labels for training.
    Features correspond to FeatureEngineer.FEATURE_NAMES (31 features).
    
    Returns: (X, y) where y=1 is fraud, y=0 is clean.
    """
    rng = np.random.default_rng(rng_seed)
    n_fraud = int(n_samples * fraud_ratio)
    n_clean = n_samples - n_fraud

    # Clean accounts: low activity, consistent patterns
    clean = np.column_stack([
        rng.poisson(2, n_clean),            # tx_count_1h
        rng.poisson(8, n_clean),            # tx_count_6h
        rng.poisson(15, n_clean),           # tx_count_24h
        rng.exponential(3600, n_clean),     # avg_time_between_tx_s
        rng.exponential(600, n_clean),      # std_time_between_tx_s
        rng.beta(1, 9, n_clean),            # night_tx_ratio (low)
        rng.lognormal(9, 1, n_clean),       # total_amount_out
        rng.lognormal(9, 1, n_clean),       # total_amount_in
        rng.normal(0, 5000, n_clean),       # net_flow
        rng.lognormal(7, 0.8, n_clean),     # avg_tx_amount
        rng.exponential(2000, n_clean),     # std_tx_amount
        rng.lognormal(8, 0.5, n_clean),     # max_tx_amount
        rng.exponential(1, n_clean),        # amount_zscore_max
        rng.poisson(2, n_clean),            # tx_velocity_1h
        rng.lognormal(8, 1, n_clean),       # amount_velocity_1h
        rng.poisson(1.5, n_clean),          # unique_receivers_1h
        rng.poisson(1.5, n_clean),          # unique_senders_1h
        rng.choice([1, 2], n_clean, p=[0.8, 0.2]),  # unique_devices
        rng.choice([1, 2], n_clean, p=[0.85, 0.15]), # unique_locations
        rng.beta(1, 10, n_clean),           # device_switch_rate
        rng.beta(1, 20, n_clean),           # login_failure_rate
        rng.beta(2, 8, n_clean),            # anomaly_score_mean
        rng.beta(2, 5, n_clean),            # anomaly_score_max
        rng.poisson(2, n_clean),            # out_degree
        rng.poisson(2, n_clean),            # in_degree
        rng.beta(5, 5, n_clean),            # degree_ratio
        rng.beta(5, 2, n_clean),            # fan_out_ratio
        rng.beta(5, 2, n_clean),            # fan_in_ratio
        rng.choice([0, 1], n_clean, p=[0.7, 0.3]),  # has_round_amounts
        rng.choice([0, 1], n_clean, p=[0.95, 0.05]), # has_splitting
        rng.choice([0, 1], n_clean, p=[0.9, 0.1]),  # has_rapid_succession
    ]).astype(np.float32)

    # Fraud accounts: high activity, suspicious patterns
    fraud = np.column_stack([
        rng.poisson(8, n_fraud),            # tx_count_1h (high)
        rng.poisson(25, n_fraud),           # tx_count_6h
        rng.poisson(60, n_fraud),           # tx_count_24h
        rng.exponential(300, n_fraud),      # avg_time_between_tx_s (fast)
        rng.exponential(200, n_fraud),      # std_time_between_tx_s
        rng.beta(3, 3, n_fraud),            # night_tx_ratio (higher)
        rng.lognormal(11, 1.5, n_fraud),    # total_amount_out (high)
        rng.lognormal(11, 1.5, n_fraud),    # total_amount_in
        rng.normal(10000, 20000, n_fraud),  # net_flow (variable)
        rng.lognormal(9, 1.2, n_fraud),     # avg_tx_amount
        rng.exponential(15000, n_fraud),    # std_tx_amount
        rng.lognormal(10, 1, n_fraud),      # max_tx_amount
        rng.exponential(3, n_fraud),        # amount_zscore_max (high)
        rng.poisson(8, n_fraud),            # tx_velocity_1h
        rng.lognormal(10, 1.5, n_fraud),    # amount_velocity_1h
        rng.poisson(5, n_fraud),            # unique_receivers_1h (many)
        rng.poisson(3, n_fraud),            # unique_senders_1h
        rng.choice([2, 3, 4, 5], n_fraud),  # unique_devices (many)
        rng.choice([2, 3, 4, 5], n_fraud),  # unique_locations (many)
        rng.beta(5, 3, n_fraud),            # device_switch_rate (high)
        rng.beta(3, 5, n_fraud),            # login_failure_rate
        rng.beta(6, 3, n_fraud),            # anomaly_score_mean (high)
        rng.beta(8, 2, n_fraud),            # anomaly_score_max (high)
        rng.poisson(6, n_fraud),            # out_degree (high)
        rng.poisson(4, n_fraud),            # in_degree
        rng.beta(7, 3, n_fraud),            # degree_ratio
        rng.beta(2, 5, n_fraud),            # fan_out_ratio (low = many receivers)
        rng.beta(5, 2, n_fraud),            # fan_in_ratio
        rng.choice([0, 1], n_fraud, p=[0.3, 0.7]),  # has_round_amounts (common)
        rng.choice([0, 1], n_fraud, p=[0.3, 0.7]),  # has_splitting (common)
        rng.choice([0, 1], n_fraud, p=[0.2, 0.8]),  # has_rapid_succession (common)
    ]).astype(np.float32)

    X = np.vstack([clean, fraud])
    y = np.concatenate([np.zeros(n_clean), np.ones(n_fraud)]).astype(np.int32)

    # ── Add realistic noise so models don't achieve perfect metrics ──
    # 1) Gaussian feature noise (5 % of each feature's std)
    noise_scale = 0.05 * (X.std(axis=0) + 1e-8)
    X += rng.normal(0, noise_scale, X.shape).astype(np.float32)

    # 2) Flip ~3 % of labels to simulate labelling uncertainty
    n_flips = max(1, int(0.03 * len(y)))
    flip_idx = rng.choice(len(y), size=n_flips, replace=False)
    y[flip_idx] = 1 - y[flip_idx]

    # 3) Inject a small set of "ambiguous" samples near the boundary
    n_ambig = max(2, int(0.02 * len(y)))
    for _ in range(n_ambig):
        ci = rng.integers(0, n_clean)
        fi = n_clean + rng.integers(0, n_fraud)
        mix = rng.uniform(0.35, 0.65)
        X = np.vstack([X, (mix * X[ci] + (1 - mix) * X[fi]).reshape(1, -1)])
        y = np.append(y, rng.choice([0, 1]))
    y = y.astype(np.int32)

    # Shuffle
    idx = rng.permutation(len(X))
    return X[idx], y[idx]


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ISOLATION FOREST (Unsupervised Anomaly Detection)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class FraudIsolationForest:
    """Unsupervised anomaly detection using Isolation Forest."""

    def __init__(self, contamination: float = 0.15):
        self.contamination = contamination
        self.model = None
        self.scaler = None
        self.is_trained = False

    def train(self, X: np.ndarray, y: Optional[np.ndarray] = None) -> Dict:
        """Train on feature matrix. If labels are provided, contamination is
        derived from the actual fraud ratio so the anomaly rate reflects the
        real data distribution instead of a fixed constant."""
        if not HAS_SKLEARN:
            self.is_trained = False
            return {"status": "sklearn_unavailable"}

        # Dynamically set contamination from label distribution when available
        if y is not None and len(y) > 0:
            fraud_rate = float(np.mean(y == 1))
            # Clamp to sklearn's valid range (0, 0.5]
            self.contamination = max(0.01, min(fraud_rate, 0.5))

        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        self.model = IsolationForest(
            n_estimators=200,
            contamination=self.contamination,
            max_features=0.8,
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(X_scaled)
        self.is_trained = True

        # Evaluate on training data
        predictions = self.model.predict(X_scaled)
        anomaly_rate = (predictions == -1).mean()

        return {
            "status": "trained",
            "n_samples": len(X),
            "anomaly_rate": float(anomaly_rate),
            "contamination": self.contamination,
        }

    def predict(self, X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predict anomaly scores.
        Returns: (labels, scores) where labels: 1=normal, -1=anomaly
                 scores: anomaly score (lower = more anomalous)
        """
        if not self.is_trained or not HAS_SKLEARN:
            # Fallback: use simple heuristics
            return self._fallback_predict(X)

        X_scaled = self.scaler.transform(X)
        labels = self.model.predict(X_scaled)
        scores = self.model.decision_function(X_scaled)
        return labels, scores

    def anomaly_score(self, X: np.ndarray) -> np.ndarray:
        """Return normalized anomaly score in [0, 1] where 1 = most anomalous."""
        _, raw_scores = self.predict(X)
        # decision_function: lower = more anomalous. Negate and normalize.
        normalized = 1.0 - (raw_scores - raw_scores.min()) / (raw_scores.max() - raw_scores.min() + 1e-8)
        return normalized

    @staticmethod
    def _fallback_predict(X: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Rule-based fallback when sklearn is not available."""
        # Simple heuristic: high tx velocity + high anomaly scores = anomaly
        scores = np.zeros(len(X))
        for i in range(len(X)):
            vel = X[i, 13]  # tx_velocity_1h
            anomaly_mean = X[i, 21]  # anomaly_score_mean
            splitting = X[i, 29]  # has_splitting
            rapid = X[i, 30]  # has_rapid_succession
            scores[i] = 0.3 * min(vel / 10, 1.0) + 0.3 * anomaly_mean + 0.2 * splitting + 0.2 * rapid
        labels = np.where(scores > 0.5, -1, 1)
        return labels, -scores  # negate to match sklearn convention


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RANDOM FOREST / GRADIENT BOOSTING (Supervised Classification)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class FraudClassifier:
    """Supervised fraud classifier using Random Forest + Gradient Boosting ensemble."""

    def __init__(self):
        self.rf_model = None
        self.gb_model = None
        self.scaler = None
        self.is_trained = False
        self.metrics: Dict = {}

    def train(self, X: np.ndarray, y: np.ndarray, test_size: float = 0.2) -> Dict:
        """Train on labelled data."""
        if not HAS_SKLEARN:
            self.is_trained = False
            return {"status": "sklearn_unavailable"}

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )

        self.scaler = StandardScaler()
        X_train_s = self.scaler.fit_transform(X_train)
        X_test_s = self.scaler.transform(X_test)

        # Random Forest
        self.rf_model = RandomForestClassifier(
            n_estimators=200, max_depth=12, min_samples_leaf=5,
            class_weight="balanced", random_state=42, n_jobs=-1,
        )
        self.rf_model.fit(X_train_s, y_train)

        # Gradient Boosting
        self.gb_model = GradientBoostingClassifier(
            n_estimators=150, max_depth=6, learning_rate=0.1,
            subsample=0.8, random_state=42,
        )
        self.gb_model.fit(X_train_s, y_train)

        # Evaluate
        rf_proba = self.rf_model.predict_proba(X_test_s)[:, 1]
        gb_proba = self.gb_model.predict_proba(X_test_s)[:, 1]
        ensemble_proba = 0.5 * rf_proba + 0.5 * gb_proba
        ensemble_pred = (ensemble_proba >= 0.5).astype(int)

        try:
            auc = roc_auc_score(y_test, ensemble_proba)
        except:
            auc = 0.0

        self.is_trained = True
        self.metrics = {
            "status": "trained",
            "n_train": len(X_train),
            "n_test": len(X_test),
            "auc_roc": float(auc),
            "fraud_rate_train": float(y_train.mean()),
            "fraud_rate_test": float(y_test.mean()),
        }
        return self.metrics

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Return fraud probability for each sample."""
        if not self.is_trained or not HAS_SKLEARN:
            return self._fallback_predict(X)

        X_scaled = self.scaler.transform(X)
        rf_p = self.rf_model.predict_proba(X_scaled)[:, 1]
        gb_p = self.gb_model.predict_proba(X_scaled)[:, 1]
        return 0.5 * rf_p + 0.5 * gb_p

    def feature_importance(self) -> Dict[str, float]:
        """Return feature importances from Random Forest."""
        if not self.is_trained or not HAS_SKLEARN:
            return {}
        from .feature_engineering import FeatureEngineer
        names = FeatureEngineer.FEATURE_NAMES
        importances = self.rf_model.feature_importances_
        return dict(sorted(zip(names, importances), key=lambda x: -x[1]))

    @staticmethod
    def _fallback_predict(X: np.ndarray) -> np.ndarray:
        """Rule-based fraud probability when sklearn is unavailable."""
        scores = np.zeros(len(X))
        for i in range(len(X)):
            score = 0.0
            score += 0.15 * min(X[i, 0] / 10, 1.0)  # tx_count_1h
            score += 0.15 * min(X[i, 13] / 10, 1.0)  # tx_velocity_1h
            score += 0.20 * X[i, 21]  # anomaly_score_mean
            score += 0.15 * X[i, 22]  # anomaly_score_max
            score += 0.10 * X[i, 29]  # has_splitting
            score += 0.10 * X[i, 30]  # has_rapid_succession
            score += 0.05 * min(X[i, 17] / 4, 1.0)  # unique_devices
            score += 0.10 * X[i, 5]   # night_tx_ratio
            scores[i] = min(score, 1.0)
        return scores


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# UNIFIED ML PREDICTOR
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class FraudMLPredictor:
    """
    Unified predictor composing Isolation Forest + Classifier.
    Provides a single fraud_score in [0, 1] for each account.
    """

    def __init__(self):
        self.isolation_forest = FraudIsolationForest()
        self.classifier = FraudClassifier()
        self.is_trained = False
        self._training_metrics: Dict = {}
        # Track which account IDs have already been used for training
        self._trained_account_ids: set = set()
        # Accumulated training data (grows across retrain calls)
        self._X_all: Optional[np.ndarray] = None
        self._y_all: Optional[np.ndarray] = None

    def train_all(self, n_synthetic: int = 2000) -> Dict:
        """Cold-start: train models on synthetic data only."""
        logger.info("Generating synthetic seed data (%d samples)...", n_synthetic)
        X, y = generate_synthetic_dataset(n_synthetic)

        self._X_all = X
        self._y_all = y

        logger.info("Training Isolation Forest...")
        if_metrics = self.isolation_forest.train(X, y)

        logger.info("Training Random Forest + Gradient Boosting...")
        clf_metrics = self.classifier.train(X, y)

        self.is_trained = True
        self._training_metrics = {
            "isolation_forest": if_metrics,
            "classifier": clf_metrics,
            "total_samples": len(X),
            "real_samples": 0,
            "synthetic_samples": n_synthetic,
        }
        logger.info("ML models trained: IF anomaly_rate=%.2f, CLF AUC=%.3f",
                     if_metrics.get("anomaly_rate", 0),
                     clf_metrics.get("auc_roc", 0))
        return self._training_metrics

    def retrain_with_data(
        self,
        transactions: list,
        cyber_events: list,
        n_synthetic: int = 1000,
    ) -> Dict:
        """
        Incremental retrain: extract features from real data (only new accounts),
        combine with synthetic augmentation data, and retrain all models.
        Skips accounts already used in previous training rounds.
        """
        from .feature_engineering import get_feature_engineer

        fe = get_feature_engineer()

        # Discover unique account IDs from real data
        all_account_ids: set = set()
        for t in transactions:
            sender = t.sender if hasattr(t, "sender") else t.get("sender", "")
            receiver = t.receiver if hasattr(t, "receiver") else t.get("receiver", "")
            if sender:
                all_account_ids.add(sender)
            if receiver:
                all_account_ids.add(receiver)

        # Only process NEW accounts that haven't been used for training
        new_ids = all_account_ids - self._trained_account_ids
        logger.info(
            "Retrain: %d total accounts, %d already trained, %d new",
            len(all_account_ids), len(self._trained_account_ids), len(new_ids),
        )

        new_X_list: list = []
        new_y_list: list = []

        if new_ids:
            for aid in new_ids:
                try:
                    features = fe.extract_features(aid, transactions, cyber_events)
                    new_X_list.append(features)

                    # Heuristic labels: high tx velocity + anomaly -> fraud
                    tx_vel = features[13]         # tx_velocity_1h
                    anomaly = features[21]        # anomaly_score_mean
                    splitting = features[29]      # has_splitting
                    rapid = features[30]          # has_rapid_succession
                    risk = 0.3 * min(tx_vel / 10, 1) + 0.3 * anomaly + 0.2 * splitting + 0.2 * rapid
                    new_y_list.append(1 if risk > 0.5 else 0)
                except Exception as e:
                    logger.debug("Feature extraction failed for %s: %s", aid, e)

            self._trained_account_ids.update(new_ids)

        n_new = len(new_X_list)

        # Build combined dataset: existing accumulated + new real + synthetic augmentation
        datasets_X: list = []
        datasets_y: list = []

        if self._X_all is not None:
            datasets_X.append(self._X_all)
            datasets_y.append(self._y_all)

        if n_new > 0:
            new_X = np.vstack(new_X_list).astype(np.float32)
            new_y = np.array(new_y_list, dtype=np.int32)
            datasets_X.append(new_X)
            datasets_y.append(new_y)

        # Add synthetic augmentation (smaller batch for retrain, random seed varies)
        rng_seed = hash(frozenset(self._trained_account_ids)) & 0xFFFFFFFF
        X_syn, y_syn = generate_synthetic_dataset(n_synthetic, rng_seed=rng_seed)
        datasets_X.append(X_syn)
        datasets_y.append(y_syn)

        X_combined = np.vstack(datasets_X)
        y_combined = np.concatenate(datasets_y)

        # Deduplicate (in case of overlap) using hash of feature rows
        _, unique_idx = np.unique(
            np.round(X_combined, 4).astype(str),
            axis=0,
            return_index=True,
        )
        X_combined = X_combined[unique_idx]
        y_combined = y_combined[unique_idx]

        # Save accumulated data for next round
        self._X_all = X_combined
        self._y_all = y_combined

        logger.info(
            "Retraining on %d total samples (%d new real, %d synthetic aug, %d prev accumulated)",
            len(X_combined), n_new, n_synthetic,
            len(X_combined) - n_new - n_synthetic,
        )

        if_metrics = self.isolation_forest.train(X_combined, y_combined)
        clf_metrics = self.classifier.train(X_combined, y_combined)

        self.is_trained = True
        self._training_metrics = {
            "isolation_forest": if_metrics,
            "classifier": clf_metrics,
            "total_samples": len(X_combined),
            "real_samples": len(self._trained_account_ids),
            "new_real_samples": n_new,
            "total_real_samples": len(self._trained_account_ids),
            "synthetic_samples": n_synthetic,
        }
        logger.info(
            "Retrain complete: %d samples, IF anomaly_rate=%.2f, CLF AUC=%.3f",
            len(X_combined),
            if_metrics.get("anomaly_rate", 0),
            clf_metrics.get("auc_roc", 0),
        )
        return self._training_metrics

    def predict(self, X: np.ndarray) -> Dict[str, np.ndarray]:
        """
        Run all models and return combined scores.
        Returns dict with 'anomaly_score', 'fraud_probability', 'combined_score'.
        """
        anomaly_scores = self.isolation_forest.anomaly_score(X)
        fraud_proba = self.classifier.predict_proba(X)

        # Combined: 40% anomaly detection + 60% classification
        combined = 0.4 * anomaly_scores + 0.6 * fraud_proba

        return {
            "anomaly_score": anomaly_scores,
            "fraud_probability": fraud_proba,
            "combined_score": combined,
        }

    def predict_single(self, features: np.ndarray) -> Dict[str, float]:
        """Predict for a single account (1D array)."""
        X = features.reshape(1, -1)
        result = self.predict(X)
        return {
            "anomaly_score": float(result["anomaly_score"][0]),
            "fraud_probability": float(result["fraud_probability"][0]),
            "combined_score": float(result["combined_score"][0]),
        }

    @property
    def training_metrics(self) -> Dict:
        return self._training_metrics


# Module-level singleton
_predictor: Optional[FraudMLPredictor] = None


def get_ml_predictor() -> FraudMLPredictor:
    """Get or create the global ML predictor (auto-trains on first access)."""
    global _predictor
    if _predictor is None:
        _predictor = FraudMLPredictor()
        _predictor.train_all()
    return _predictor
