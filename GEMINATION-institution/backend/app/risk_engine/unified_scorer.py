"""
SurakshaFlow — Unified Risk Scorer
Combines cyber, financial, graph, and ML scores into a single unified risk score.
ML models provide anomaly detection and classification-based fraud scoring.
"""
from __future__ import annotations

import logging
from typing import List, Optional

from ..models import (
    CyberEvent,
    FinancialTransaction,
    RiskEvent,
    Severity,
)
from .cyber_engine import compute_cyber_score, compute_cyber_score_detailed
from .financial_engine import compute_financial_score, compute_financial_score_detailed
from .graph_engine import analyze_graph

logger = logging.getLogger("surakshaflow.scorer")

# ── Weights (with ML) ─────────────────────────────────────────
# When ML is available: Cyber 30%, Financial 25%, Graph 20%, ML 25%
# When ML is unavailable: Cyber 40%, Financial 35%, Graph 25%
CYBER_WEIGHT = 0.40
FINANCIAL_WEIGHT = 0.35
GRAPH_WEIGHT = 0.25

CYBER_WEIGHT_ML = 0.30
FINANCIAL_WEIGHT_ML = 0.25
GRAPH_WEIGHT_ML = 0.20
ML_WEIGHT = 0.25

# ── Thresholds ─────────────────────────────────────────────────
HIGH_RISK_THRESHOLD = 0.7
MEDIUM_RISK_THRESHOLD = 0.4


def classify_risk(score: float) -> str:
    """Convert numeric score to risk level string."""
    if score >= HIGH_RISK_THRESHOLD:
        return "high"
    elif score >= MEDIUM_RISK_THRESHOLD:
        return "medium"
    return "low"


def classify_severity(score: float) -> Severity:
    """Convert numeric score to Severity enum."""
    if score >= 0.85:
        return Severity.CRITICAL
    elif score >= HIGH_RISK_THRESHOLD:
        return Severity.HIGH
    elif score >= MEDIUM_RISK_THRESHOLD:
        return Severity.MEDIUM
    return Severity.LOW


def compute_unified_score(
    cyber_score: float,
    financial_score: float,
    graph_score: float,
    ml_score: Optional[float] = None,
) -> float:
    """
    Unified Score combining all engines.
    With ML: 0.30*cyber + 0.25*financial + 0.20*graph + 0.25*ml
    Without: 0.40*cyber + 0.35*financial + 0.25*graph
    """
    if ml_score is not None:
        score = (
            CYBER_WEIGHT_ML * cyber_score
            + FINANCIAL_WEIGHT_ML * financial_score
            + GRAPH_WEIGHT_ML * graph_score
            + ML_WEIGHT * ml_score
        )
    else:
        score = (
            CYBER_WEIGHT * cyber_score
            + FINANCIAL_WEIGHT * financial_score
            + GRAPH_WEIGHT * graph_score
        )
    return round(min(1.0, max(0.0, score)), 4)


def _get_ml_score(
    account_id: str,
    cyber_events: List[CyberEvent],
    financial_txns: List[FinancialTransaction],
) -> Optional[float]:
    """Get ML fraud score for an account. Returns None if ML is unavailable."""
    try:
        from ..ml.feature_engineering import get_feature_engineer
        from ..ml.fraud_models import get_ml_predictor

        fe = get_feature_engineer()
        predictor = get_ml_predictor()

        features = fe.extract_features(account_id, financial_txns, cyber_events)
        result = predictor.predict_single(features)
        return result["combined_score"]
    except Exception as e:
        logger.debug("ML scoring unavailable for %s: %s", account_id, str(e))
        return None


def score_account(
    account_id: str,
    cyber_events: List[CyberEvent],
    financial_txns: List[FinancialTransaction],
    all_txns: Optional[List[FinancialTransaction]] = None,
    known_victims: Optional[set[str]] = None,
) -> dict:
    """
    Full scoring pipeline for a single account.

    Returns a dict with:
      - unified_score
      - cyber_score + factors
      - financial_score + factors
      - graph_score
      - ml_score (if available)
      - risk_level
      - severity
    """
    # Cyber score (only events for this account)
    account_cyber = [e for e in cyber_events if e.account_id == account_id]
    cyber_detail = compute_cyber_score_detailed(account_cyber)

    # Financial score (transactions involving this account)
    account_txns = [
        t for t in financial_txns
        if t.sender == account_id or t.receiver == account_id
    ]
    fin_detail = compute_financial_score_detailed(account_txns)

    # Graph score (from full transaction graph, not just account's)
    graph_txns = all_txns or financial_txns
    graph_data = analyze_graph(graph_txns, known_victims)
    graph_score = 0.0
    for node in graph_data.nodes:
        if node.id == account_id:
            graph_score = node.risk_score
            break

    # ML score (optional)
    ml_score = _get_ml_score(account_id, cyber_events, financial_txns)

    unified = compute_unified_score(
        cyber_detail["cyber_score"],
        fin_detail["financial_score"],
        graph_score,
        ml_score,
    )

    result = {
        "account_id": account_id,
        "unified_score": unified,
        "cyber_score": cyber_detail["cyber_score"],
        "cyber_factors": cyber_detail["factors"],
        "financial_score": fin_detail["financial_score"],
        "financial_factors": fin_detail["factors"],
        "graph_score": graph_score,
        "risk_level": classify_risk(unified),
        "severity": classify_severity(unified).value,
    }

    if ml_score is not None:
        result["ml_score"] = ml_score
        result["ml_enabled"] = True
    else:
        result["ml_enabled"] = False

    return result


def should_trigger_gemini(unified_score: float) -> bool:
    """Check if the unified score warrants a Gemini explanation."""
    return unified_score >= HIGH_RISK_THRESHOLD
