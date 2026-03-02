"""
SurakshaFlow — Feature Engineering Pipeline
Extracts temporal, amount, behavioral, network, and velocity features
from raw transaction and cyber event data for ML model input.
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple

import numpy as np

from ..models import CyberEvent, FinancialTransaction


class FeatureEngineer:
    """
    Extracts features from raw transaction & cyber event data.
    Produces a feature vector per account suitable for Isolation Forest,
    Random Forest, and LSTM input.
    """

    # Feature names (in order) for the output vector
    FEATURE_NAMES = [
        # Temporal features
        "tx_count_1h", "tx_count_6h", "tx_count_24h",
        "avg_time_between_tx_s", "std_time_between_tx_s",
        "night_tx_ratio",  # % of tx between 23:00-05:00
        # Amount features
        "total_amount_out", "total_amount_in", "net_flow",
        "avg_tx_amount", "std_tx_amount", "max_tx_amount",
        "amount_zscore_max",  # z-score of max tx vs mean
        # Velocity features
        "tx_velocity_1h", "amount_velocity_1h",
        "unique_receivers_1h", "unique_senders_1h",
        # Behavioral features
        "unique_devices", "unique_locations",
        "device_switch_rate",  # device changes / session count
        "login_failure_rate",
        "anomaly_score_mean", "anomaly_score_max",
        # Network features
        "out_degree", "in_degree", "degree_ratio",
        "fan_out_ratio",  # unique receivers / total out tx
        "fan_in_ratio",   # unique senders / total in tx
        # Pattern features
        "has_round_amounts", "has_splitting",
        "has_rapid_succession",  # >3 tx in 5 min
    ]

    def __init__(self):
        self._account_features: Dict[str, np.ndarray] = {}

    def extract_features(
        self,
        account_id: str,
        transactions: List[FinancialTransaction],
        cyber_events: List[CyberEvent],
        window_hours: int = 24,
    ) -> np.ndarray:
        """
        Extract a fixed-size feature vector for a given account.
        Returns np.ndarray of shape (len(FEATURE_NAMES),).
        """
        now = datetime.utcnow()
        cutoff = now - timedelta(hours=window_hours)

        # Filter relevant data
        out_txns = [t for t in transactions if t.sender == account_id and t.timestamp >= cutoff]
        in_txns = [t for t in transactions if t.receiver == account_id and t.timestamp >= cutoff]
        all_txns = out_txns + in_txns
        all_txns.sort(key=lambda t: t.timestamp)

        events = [e for e in cyber_events if e.account_id == account_id and e.timestamp >= cutoff]

        features = np.zeros(len(self.FEATURE_NAMES), dtype=np.float32)

        # ── Temporal Features ──────────────────────────────
        h1 = now - timedelta(hours=1)
        h6 = now - timedelta(hours=6)
        features[0] = sum(1 for t in all_txns if t.timestamp >= h1)
        features[1] = sum(1 for t in all_txns if t.timestamp >= h6)
        features[2] = len(all_txns)

        if len(all_txns) >= 2:
            deltas = [
                (all_txns[i + 1].timestamp - all_txns[i].timestamp).total_seconds()
                for i in range(len(all_txns) - 1)
            ]
            features[3] = float(np.mean(deltas))
            features[4] = float(np.std(deltas)) if len(deltas) > 1 else 0.0
        
        # Night ratio
        if all_txns:
            night_count = sum(1 for t in all_txns if t.timestamp.hour >= 23 or t.timestamp.hour < 5)
            features[5] = night_count / len(all_txns)

        # ── Amount Features ────────────────────────────────
        out_amounts = [t.amount for t in out_txns]
        in_amounts = [t.amount for t in in_txns]
        all_amounts = [t.amount for t in all_txns]

        features[6] = sum(out_amounts) if out_amounts else 0.0
        features[7] = sum(in_amounts) if in_amounts else 0.0
        features[8] = features[7] - features[6]  # net flow

        if all_amounts:
            features[9] = float(np.mean(all_amounts))
            features[10] = float(np.std(all_amounts)) if len(all_amounts) > 1 else 0.0
            features[11] = max(all_amounts)
            if features[10] > 0:
                features[12] = (features[11] - features[9]) / features[10]
            else:
                features[12] = 0.0

        # ── Velocity Features ─────────────────────────────
        txns_1h = [t for t in all_txns if t.timestamp >= h1]
        features[13] = len(txns_1h)
        features[14] = sum(t.amount for t in txns_1h)
        features[15] = len(set(t.receiver for t in out_txns if t.timestamp >= h1))
        features[16] = len(set(t.sender for t in in_txns if t.timestamp >= h1))

        # ── Behavioral Features ───────────────────────────
        if events:
            features[17] = len(set(e.device_id for e in events))
            features[18] = len(set(e.ip_geo for e in events))
            # Device switch rate
            if len(events) >= 2:
                switches = sum(
                    1 for i in range(len(events) - 1)
                    if events[i].device_id != events[i + 1].device_id
                )
                features[19] = switches / len(events)
            # Login failure rate
            login_events = [e for e in events if e.event_type.value in ("login", "failed_login")]
            if login_events:
                failed = sum(1 for e in login_events if e.anomaly_score > 0.5)
                features[20] = failed / len(login_events)
            # Anomaly scores
            scores = [e.anomaly_score for e in events]
            features[21] = float(np.mean(scores))
            features[22] = max(scores)

        # ── Network Features ──────────────────────────────
        receivers = set(t.receiver for t in out_txns)
        senders = set(t.sender for t in in_txns)
        features[23] = len(receivers)  # out-degree
        features[24] = len(senders)    # in-degree
        total_deg = features[23] + features[24]
        features[25] = features[23] / total_deg if total_deg > 0 else 0.5  # degree ratio

        if out_txns:
            features[26] = len(receivers) / len(out_txns)  # fan-out
        if in_txns:
            features[27] = len(senders) / len(in_txns)    # fan-in

        # ── Pattern Features ──────────────────────────────
        # Round amounts (multiples of 1000, 5000, 10000)
        if all_amounts:
            round_count = sum(1 for a in all_amounts if a % 1000 == 0 and a >= 5000)
            features[28] = 1.0 if round_count > len(all_amounts) * 0.5 else 0.0

        # Splitting: one large in → multiple small outs within 30min
        if in_txns and len(out_txns) >= 3:
            for it in in_txns:
                splits = [
                    ot for ot in out_txns
                    if 0 < (ot.timestamp - it.timestamp).total_seconds() <= 1800
                ]
                if len(splits) >= 3:
                    features[29] = 1.0
                    break

        # Rapid succession: >3 tx in 5 min
        if len(all_txns) >= 3:
            for i in range(len(all_txns) - 2):
                delta = (all_txns[i + 2].timestamp - all_txns[i].timestamp).total_seconds()
                if delta <= 300:
                    features[30] = 1.0
                    break

        self._account_features[account_id] = features
        return features

    def extract_batch(
        self,
        account_ids: List[str],
        transactions: List[FinancialTransaction],
        cyber_events: List[CyberEvent],
    ) -> Dict[str, np.ndarray]:
        """Extract features for multiple accounts."""
        result = {}
        for aid in account_ids:
            result[aid] = self.extract_features(aid, transactions, cyber_events)
        return result

    def get_feature_matrix(
        self,
        account_ids: List[str],
        transactions: List[FinancialTransaction],
        cyber_events: List[CyberEvent],
    ) -> Tuple[np.ndarray, List[str]]:
        """
        Build (N, D) feature matrix and ordered account_id list.
        """
        features = self.extract_batch(account_ids, transactions, cyber_events)
        ids = list(features.keys())
        X = np.vstack([features[aid] for aid in ids])
        return X, ids


# Module-level singleton
_feature_engineer = FeatureEngineer()


def get_feature_engineer() -> FeatureEngineer:
    return _feature_engineer
