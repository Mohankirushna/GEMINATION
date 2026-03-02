"""
SurakshaFlow — Digital Twin Simulation Service
Simulates the impact of freezing accounts on fraud propagation.
"""
from __future__ import annotations

from typing import List, Optional, Set

import networkx as nx

from ..models import FinancialTransaction, SimulationResult
from ..risk_engine.graph_engine import build_graph


def simulate_freeze(
    txns: List[FinancialTransaction],
    freeze_account: str,
    known_victims: Optional[Set[str]] = None,
) -> SimulationResult:
    """
    Digital Twin: simulate what happens if we freeze vs. don't freeze an account.

    Returns comparison of:
      - no_action: downstream accounts affected, total exposure
      - optimal_action: effect of freezing the specified account
    """
    known_victims = known_victims or set()
    G = build_graph(txns)

    if freeze_account not in G:
        return SimulationResult(
            no_action={"downstream_accounts": 0, "total_exposure": 0},
            optimal_action={
                "account_to_freeze": freeze_account,
                "prevented_loss": 0,
                "prevented_percentage": 0,
                "message": "Account not found in transaction graph.",
            },
        )

    # ── No-action scenario: compute downstream exposure ──────
    downstream = set()
    total_exposure = 0.0

    # BFS from freeze_account following outgoing edges
    visited = {freeze_account}
    frontier = [freeze_account]
    while frontier:
        next_frontier = []
        for node in frontier:
            for successor in G.successors(node):
                if successor not in visited and successor not in known_victims:
                    visited.add(successor)
                    downstream.add(successor)
                    edge_data = G[node][successor]
                    total_exposure += edge_data.get("weight", 0)
                    next_frontier.append(successor)
        frontier = next_frontier

    # Also count exposure from the freeze account's own incoming mule flows
    for pred in G.predecessors(freeze_account):
        edge_data = G[pred][freeze_account]
        total_exposure += edge_data.get("weight", 0)

    no_action = {
        "downstream_accounts": len(downstream),
        "total_exposure": total_exposure,
        "affected_accounts": list(downstream)[:10],
    }

    # ── Optimal-action scenario: remove node and recompute ───
    G_modified = G.copy()
    G_modified.remove_node(freeze_account)

    # Recompute downstream from all remaining suspect nodes
    remaining_exposure = 0.0
    for u, v, data in G_modified.edges(data=True):
        if u not in known_victims:
            remaining_exposure += data.get("weight", 0)

    prevented = total_exposure - remaining_exposure
    prevented_pct = (prevented / total_exposure * 100) if total_exposure > 0 else 0

    # Find remaining connected components that contain suspects
    remaining_downstream = set()
    for node in downstream:
        if node in G_modified:
            remaining_downstream.add(node)

    optimal_action = {
        "account_to_freeze": freeze_account,
        "prevented_loss": max(0, prevented),
        "prevented_percentage": round(prevented_pct, 1),
        "remaining_exposure": remaining_exposure,
        "remaining_downstream": len(remaining_downstream),
        "disruption_effectiveness": round(
            (1 - len(remaining_downstream) / max(len(downstream), 1)) * 100, 1
        ),
    }

    return SimulationResult(
        no_action=no_action,
        optimal_action=optimal_action,
    )


def find_optimal_freeze_target(
    txns: List[FinancialTransaction],
    known_victims: Optional[Set[str]] = None,
) -> dict:
    """
    Find the account whose freeze would prevent the most downstream damage.
    """
    known_victims = known_victims or set()
    G = build_graph(txns)

    best_account = ""
    best_prevented = 0.0

    for node in G.nodes:
        if node in known_victims:
            continue

        result = simulate_freeze(txns, node, known_victims)
        prevented = result.optimal_action.get("prevented_loss", 0)
        if prevented > best_prevented:
            best_prevented = prevented
            best_account = node

    return {
        "optimal_freeze_target": best_account,
        "max_preventable_loss": best_prevented,
    }
