"""SurakshaFlow — Pydantic schemas matching Firestore document structure."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Enums ──────────────────────────────────────────────────────

class UserRole(str, Enum):
    END_USER = "end_user"
    INSTITUTION = "financial_institution"


class EventType(str, Enum):
    LOGIN = "login"
    MALWARE = "malware"
    IMPOSSIBLE_TRAVEL = "impossible_travel"
    NEW_DEVICE = "new_device"
    PHISHING = "phishing"


class TxMethod(str, Enum):
    UPI = "upi"
    NEFT = "neft"
    IMPS = "imps"


class Severity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AlertStatus(str, Enum):
    NEW = "new"
    INVESTIGATING = "investigating"
    RESOLVED = "resolved"
    ESCALATED = "escalated"


class NodeLabel(str, Enum):
    CLEAN = "clean"
    VICTIM = "victim"
    MULE = "mule"
    KINGPIN = "kingpin"
    COMPROMISED = "compromised"


# ── Firestore Document Models ─────────────────────────────────

class User(BaseModel):
    id: str
    role: UserRole
    email: str
    display_name: str = ""
    linked_accounts: list[str] = Field(default_factory=list)
    risk_level: float = 0.0
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CyberEvent(BaseModel):
    id: str
    account_id: str
    device_id: str
    event_type: EventType
    ip_geo: str = ""
    timestamp: datetime
    anomaly_score: float = 0.0
    raw_signals: dict = Field(default_factory=dict)


class FinancialTransaction(BaseModel):
    id: str
    sender: str
    receiver: str
    amount: float
    currency: str = "INR"
    method: TxMethod = TxMethod.UPI
    timestamp: datetime
    velocity_score: float = 0.0
    risk_flags: list[str] = Field(default_factory=list)


class RiskEvent(BaseModel):
    id: str
    account_id: str
    unified_score: float = 0.0
    cyber_score: float = 0.0
    financial_score: float = 0.0
    graph_score: float = 0.0
    explanation: str = ""
    recommended_action: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Alert(BaseModel):
    id: str
    institution_id: str = "inst_default"
    accounts_flagged: list[str] = Field(default_factory=list)
    severity: Severity = Severity.LOW
    status: AlertStatus = AlertStatus.NEW
    unified_risk_score: float = 0.0
    cyber_events: list[CyberEvent] = Field(default_factory=list)
    financial_transactions: list[FinancialTransaction] = Field(default_factory=list)
    gemini_explanation: str = ""
    recommended_action: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class STRReport(BaseModel):
    id: str
    alert_id: str
    account_id: str
    report_data: dict = Field(default_factory=dict)
    pdf_url: str = ""
    generated_at: datetime = Field(default_factory=datetime.utcnow)


# ── Graph Models ──────────────────────────────────────────────

class GraphNode(BaseModel):
    id: str
    type: str = "account"  # account | device
    risk_score: float = 0.0
    label: str = ""
    node_label: NodeLabel = NodeLabel.CLEAN
    degree_centrality: float = 0.0
    betweenness_centrality: float = 0.0
    pagerank: float = 0.0
    community: int = -1


class GraphEdge(BaseModel):
    source: str
    target: str
    type: str = "transaction"
    weight: float = 0.0
    timestamp: Optional[datetime] = None


class GraphData(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


# ── API Request / Response Models ─────────────────────────────

class DashboardSummary(BaseModel):
    total_alerts: int = 0
    high_risk_count: int = 0
    transactions_monitored: int = 0
    active_mule_rings: int = 0
    risk_trend: list[dict] = Field(default_factory=list)


class GeminiExplanation(BaseModel):
    explanation: str
    recommendation: str
    confidence: float = 0.0
    key_indicators: list[str] = Field(default_factory=list)


class SMSAnalysisResult(BaseModel):
    is_scam: bool
    confidence: float
    explanation: str
    risk_indicators: list[str] = Field(default_factory=list)


class SimulationResult(BaseModel):
    no_action: dict = Field(default_factory=dict)
    optimal_action: dict = Field(default_factory=dict)


class AccountAction(BaseModel):
    action: str  # freeze | monitor | escalate | dismiss
    account_id: str
    alert_id: str
    reason: str = ""


class UserRiskResponse(BaseModel):
    account_id: str
    unified_score: float
    cyber_score: float
    financial_score: float
    graph_score: float
    risk_level: str
    explanation: str = ""
    recommended_action: str = ""
