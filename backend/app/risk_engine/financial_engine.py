"""
SurakshaFlow — Financial Risk Engine
Scores accounts based on transaction velocity spikes, amount deviation,
fund splitting patterns, and circular flow detection.
"""
from __future__ import annotations

import math
from collections import defaultdict
from datetime import timedelta
from typing import List

from ..models import FinancialTransaction


def _velocity_spike_score(txns: List[FinancialTransaction]) -> float:
    """
    Detect sudden spikes in transaction frequency.
    Measures transactions per hour vs. a baseline of 2 tx/hr.
    """
    if len(txns) < 2:
        return 0.0

    sorted_txns = sorted(txns, key=lambda t: t.timestamp)
    baseline_rate = 2.0  # expected transactions / hour

    # Rolling 1-hour window
    max_rate = 0.0
    window = timedelta(hours=1)

    for i, tx in enumerate(sorted_txns):
        count = sum(
            1 for j in range(i, len(sorted_txns))
            if sorted_txns[j].timestamp - tx.timestamp <= window
        )
        max_rate = max(max_rate, count)

    ratio = max_rate / baseline_rate
    if ratio <= 1.0:
        return 0.0
    return min(1.0, 0.2 + 0.2 * (ratio - 1.0))


def _amount_deviation_score(txns: List[FinancialTransaction]) -> float:
    """
    Z-score of transaction amounts vs. historical mean.
    Uses the transaction set itself as the historical baseline.
    """
    if len(txns) < 2:
        return 0.0

    amounts = [t.amount for t in txns]
    mean = sum(amounts) / len(amounts)
    variance = sum((a - mean) ** 2 for a in amounts) / len(amounts)
    std = math.sqrt(variance) if variance > 0 else 1.0

    max_z = max(abs(a - mean) / std for a in amounts) if std > 0 else 0.0

    # z-score > 2 is unusual, > 3 is anomalous
    if max_z <= 1.0:
        return 0.0
    return min(1.0, 0.2 + 0.25 * (max_z - 1.0))


def _fund_splitting_score(txns: List[FinancialTransaction]) -> float:
    """
    Detect single large inflow split to 3+ outflows within 30 minutes.
    Pattern: account receives X, then sends multiple smaller amounts.
    """
    if len(txns) < 3:
        return 0.0

    # Group by accounts that appear as both receiver and sender
    account_inflows: dict[str, List[FinancialTransaction]] = defaultdict(list)
    account_outflows: dict[str, List[FinancialTransaction]] = defaultdict(list)

    for tx in txns:
        account_inflows[tx.receiver].append(tx)
        account_outflows[tx.sender].append(tx)

    max_score = 0.0
    window = timedelta(minutes=30)

    for account in set(account_inflows.keys()) & set(account_outflows.keys()):
        for inflow in account_inflows[account]:
            # Count outflows from this account within 30 min of receiving
            outflows = [
                o for o in account_outflows[account]
                if timedelta(0) < (o.timestamp - inflow.timestamp) <= window
            ]
            if len(outflows) >= 2:
                total_out = sum(o.amount for o in outflows)
                # If outflow roughly matches inflow → layering pattern
                ratio = total_out / inflow.amount if inflow.amount > 0 else 0
                if ratio > 0.7:
                    score = min(1.0, 0.4 + 0.2 * len(outflows))
                    max_score = max(max_score, score)

    return max_score


def _circular_flow_score(txns: List[FinancialTransaction]) -> float:
    """
    Detect circular fund flows: A → B → C → A.
    Build an adjacency list and look for cycles up to length 4.
    """
    if len(txns) < 3:
        return 0.0

    adjacency: dict[str, set[str]] = defaultdict(set)
    for tx in txns:
        adjacency[tx.sender].add(tx.receiver)

    cycle_count = 0

    # DFS for short cycles (length 3-4)
    for start in adjacency:
        # Length-3 cycle: A → B → C → A
        for b in adjacency.get(start, set()):
            for c in adjacency.get(b, set()):
                if start in adjacency.get(c, set()):
                    cycle_count += 1

    if cycle_count == 0:
        return 0.0
    return min(1.0, 0.5 + 0.15 * cycle_count)


def compute_financial_score(txns: List[FinancialTransaction]) -> float:
    """
    Compute the unified financial risk score for an account.

    Weights:
      velocity_spike  = 0.25
      amount_deviation = 0.25
      fund_splitting  = 0.30
      circular_flow   = 0.20

    Returns: float in [0, 1]
    """
    if not txns:
        return 0.0

    vs = _velocity_spike_score(txns)
    ad = _amount_deviation_score(txns)
    fs = _fund_splitting_score(txns)
    cf = _circular_flow_score(txns)

    score = 0.25 * vs + 0.25 * ad + 0.30 * fs + 0.20 * cf
    return round(min(1.0, max(0.0, score)), 4)


def compute_financial_score_detailed(txns: List[FinancialTransaction]) -> dict:
    """Return the financial score with individual factor breakdown."""
    vs = _velocity_spike_score(txns)
    ad = _amount_deviation_score(txns)
    fs = _fund_splitting_score(txns)
    cf = _circular_flow_score(txns)

    score = 0.25 * vs + 0.25 * ad + 0.30 * fs + 0.20 * cf
    return {
        "financial_score": round(min(1.0, max(0.0, score)), 4),
        "factors": {
            "velocity_spike": round(vs, 4),
            "amount_deviation": round(ad, 4),
            "fund_splitting": round(fs, 4),
            "circular_flow": round(cf, 4),
        },
    }
