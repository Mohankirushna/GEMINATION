"""
SurakshaFlow — Graph Intelligence Engine
Builds a directed transaction graph using NetworkX.
Computes centrality metrics, PageRank, and community detection.
Labels nodes as victim / mule / kingpin.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Dict, List, Optional

import networkx as nx

try:
    import community as community_louvain  # python-community-louvain
except ImportError:
    community_louvain = None  # graceful degradation

from ..models import FinancialTransaction, GraphData, GraphEdge, GraphNode, NodeLabel


def build_graph(txns: List[FinancialTransaction]) -> nx.DiGraph:
    """Build a weighted directed graph from financial transactions."""
    G = nx.DiGraph()
    for tx in txns:
        if G.has_edge(tx.sender, tx.receiver):
            G[tx.sender][tx.receiver]["weight"] += tx.amount
            G[tx.sender][tx.receiver]["count"] += 1
        else:
            G.add_edge(
                tx.sender,
                tx.receiver,
                weight=tx.amount,
                count=1,
                method=tx.method.value if hasattr(tx.method, "value") else str(tx.method),
            )
    return G


def compute_centrality(G: nx.DiGraph) -> Dict[str, dict]:
    """Compute degree centrality, betweenness centrality, and PageRank."""
    if len(G.nodes) == 0:
        return {}

    in_degree = dict(G.in_degree(weight="weight"))
    out_degree = dict(G.out_degree(weight="weight"))
    degree_cent = nx.degree_centrality(G)
    betweenness = nx.betweenness_centrality(G, weight="weight")
    pagerank = nx.pagerank(G, weight="weight", alpha=0.85)

    metrics: Dict[str, dict] = {}
    for node in G.nodes:
        metrics[node] = {
            "in_degree": in_degree.get(node, 0),
            "out_degree": out_degree.get(node, 0),
            "degree_centrality": round(degree_cent.get(node, 0), 4),
            "betweenness_centrality": round(betweenness.get(node, 0), 4),
            "pagerank": round(pagerank.get(node, 0), 4),
        }

    return metrics


def detect_communities(G: nx.DiGraph) -> Dict[str, int]:
    """Detect communities using Louvain method on undirected projection."""
    if community_louvain is None or len(G.nodes) < 2:
        # Fallback: each node in its own community
        return {n: i for i, n in enumerate(G.nodes)}

    undirected = G.to_undirected()
    partition = community_louvain.best_partition(undirected)
    return partition


def label_nodes(
    G: nx.DiGraph,
    metrics: Dict[str, dict],
    known_victims: Optional[set[str]] = None,
) -> Dict[str, NodeLabel]:
    """
    Label each node based on its structural role in the mule network.

    Heuristics:
      - High in-degree from victims → "mule"
      - High in-degree from mules  → "kingpin"
      - Node only sends, never receives from mules → "victim"
      - Otherwise → "clean" or "compromised"
    """
    labels: Dict[str, NodeLabel] = {}
    known_victims = known_victims or set()

    in_deg = dict(G.in_degree(weight="weight"))
    out_deg = dict(G.out_degree(weight="weight"))

    # Nodes that only send → likely victims
    for node in G.nodes:
        if node in known_victims:
            labels[node] = NodeLabel.VICTIM
        elif in_deg.get(node, 0) == 0 and out_deg.get(node, 0) > 0:
            labels[node] = NodeLabel.VICTIM
        else:
            labels[node] = NodeLabel.CLEAN

    # Nodes receiving from victims → mules
    for node in G.nodes:
        predecessors = list(G.predecessors(node))
        victim_inputs = sum(1 for p in predecessors if labels.get(p) == NodeLabel.VICTIM)
        if victim_inputs > 0 and out_deg.get(node, 0) > 0:
            labels[node] = NodeLabel.MULE

    # Nodes receiving from mules → kingpin
    for node in G.nodes:
        predecessors = list(G.predecessors(node))
        mule_inputs = sum(1 for p in predecessors if labels.get(p) == NodeLabel.MULE)
        if mule_inputs >= 2:
            labels[node] = NodeLabel.KINGPIN
        elif mule_inputs == 1 and in_deg.get(node, 0) > out_deg.get(node, 0):
            labels[node] = NodeLabel.KINGPIN

    return labels


def compute_graph_score(
    G: nx.DiGraph,
    metrics: Dict[str, dict],
    labels: Dict[str, NodeLabel],
) -> Dict[str, float]:
    """
    Compute a graph-based risk score (0–1) for each node.

    Combines: degree_centrality (0.3) + betweenness (0.3) + pagerank (0.2) + label bonus (0.2)
    """
    scores: Dict[str, float] = {}

    # Normalize pagerank to [0,1] range
    pr_values = [m["pagerank"] for m in metrics.values()] if metrics else [0]
    max_pr = max(pr_values) if pr_values else 1.0
    if max_pr == 0:
        max_pr = 1.0

    label_bonus = {
        NodeLabel.CLEAN: 0.0,
        NodeLabel.VICTIM: 0.1,
        NodeLabel.MULE: 0.7,
        NodeLabel.KINGPIN: 1.0,
        NodeLabel.COMPROMISED: 0.5,
    }

    for node in G.nodes:
        m = metrics.get(node, {})
        dc = m.get("degree_centrality", 0)
        bc = m.get("betweenness_centrality", 0)
        pr = m.get("pagerank", 0) / max_pr
        lb = label_bonus.get(labels.get(node, NodeLabel.CLEAN), 0)

        score = 0.3 * dc + 0.3 * bc + 0.2 * pr + 0.2 * lb
        scores[node] = round(min(1.0, max(0.0, score)), 4)

    return scores


def analyze_graph(
    txns: List[FinancialTransaction],
    known_victims: Optional[set[str]] = None,
) -> GraphData:
    """
    Full graph analysis pipeline:
    1. Build directed graph
    2. Compute centrality metrics
    3. Detect communities
    4. Label nodes (victim / mule / kingpin)
    5. Compute per-node graph scores
    6. Return GraphData with enriched nodes and edges
    """
    G = build_graph(txns)

    if len(G.nodes) == 0:
        return GraphData(nodes=[], edges=[])

    metrics = compute_centrality(G)
    communities = detect_communities(G)
    labels = label_nodes(G, metrics, known_victims)
    scores = compute_graph_score(G, metrics, labels)

    nodes = []
    for node in G.nodes:
        m = metrics.get(node, {})
        nodes.append(
            GraphNode(
                id=node,
                type="account",
                risk_score=scores.get(node, 0),
                label=node,
                node_label=labels.get(node, NodeLabel.CLEAN),
                degree_centrality=m.get("degree_centrality", 0),
                betweenness_centrality=m.get("betweenness_centrality", 0),
                pagerank=m.get("pagerank", 0),
                community=communities.get(node, -1),
            )
        )

    edges = []
    for u, v, data in G.edges(data=True):
        edges.append(
            GraphEdge(
                source=u,
                target=v,
                type="transaction",
                weight=data.get("weight", 0),
            )
        )

    return GraphData(nodes=nodes, edges=edges)


def get_subgraph(
    txns: List[FinancialTransaction],
    account_id: str,
    depth: int = 2,
    known_victims: Optional[set[str]] = None,
) -> GraphData:
    """Get the subgraph centered on a specific account up to N hops."""
    G = build_graph(txns)

    if account_id not in G:
        return GraphData(nodes=[], edges=[])

    # BFS to get nodes within `depth` hops
    visited: set[str] = {account_id}
    frontier: set[str] = {account_id}
    for _ in range(depth):
        next_frontier: set[str] = set()
        for node in frontier:
            next_frontier |= set(G.successors(node))
            next_frontier |= set(G.predecessors(node))
        visited |= next_frontier
        frontier = next_frontier - visited | next_frontier

    sub_G = G.subgraph(visited).copy()
    sub_txns = [
        tx for tx in txns
        if tx.sender in visited and tx.receiver in visited
    ]

    return analyze_graph(sub_txns, known_victims)
