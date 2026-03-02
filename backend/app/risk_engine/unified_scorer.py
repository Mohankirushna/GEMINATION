"""
SurakshaFlow — Unified Risk Scorer
Combines cyber, financial, and graph scores into a single unified risk score.
"""
from __future__ import annotations

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


# ── Weights ────────────────────────────────────────────────────
CYBER_WEIGHT = 0.40
FINANCIAL_WEIGHT = 0.35
GRAPH_WEIGHT = 0.25

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
) -> float:
    """
    Unified Score = 0.4 * cyber + 0.35 * financial + 0.25 * graph
    Returns: float in [0, 1]
    """
    score = (
        CYBER_WEIGHT * cyber_score
        + FINANCIAL_WEIGHT * financial_score
        + GRAPH_WEIGHT * graph_score
    )
    return round(min(1.0, max(0.0, score)), 4)


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

    unified = compute_unified_score(
        cyber_detail["cyber_score"],
        fin_detail["financial_score"],
        graph_score,
    )

    return {
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


def should_trigger_gemini(unified_score: float) -> bool:
    """Check if the unified score warrants a Gemini explanation."""
    return unified_score >= HIGH_RISK_THRESHOLD
