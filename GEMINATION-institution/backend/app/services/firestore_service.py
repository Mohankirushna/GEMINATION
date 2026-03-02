"""
SurakshaFlow — Firestore Service
CRUD operations for all Firestore collections.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from ..config import get_firestore_client
from ..models import (
    Alert,
    AlertStatus,
    CyberEvent,
    FinancialTransaction,
    RiskEvent,
    Severity,
    User,
)

# ── Helpers ────────────────────────────────────────────────────

def _to_dict(obj) -> dict:
    """Convert a Pydantic model to a Firestore-friendly dict."""
    d = obj.model_dump()
    # Convert datetime to ISO string
    for k, v in d.items():
        if isinstance(v, datetime):
            d[k] = v.isoformat()
        elif isinstance(v, list):
            d[k] = [
                item.isoformat() if isinstance(item, datetime)
                else (item.model_dump() if hasattr(item, "model_dump") else item)
                for item in v
            ]
    return d


# ── Users ──────────────────────────────────────────────────────

def get_user(uid: str) -> Optional[dict]:
    db = get_firestore_client()
    doc = db.collection("users").document(uid).get()
    return doc.to_dict() if doc.exists else None


def create_user(user: User) -> str:
    db = get_firestore_client()
    db.collection("users").document(user.id).set(_to_dict(user))
    return user.id


def update_user_risk(uid: str, risk_level: float):
    db = get_firestore_client()
    db.collection("users").document(uid).update({"risk_level": risk_level})


# ── Cyber Events ───────────────────────────────────────────────

def get_cyber_events(account_id: Optional[str] = None, limit: int = 100) -> List[dict]:
    db = get_firestore_client()
    ref = db.collection("cyber_events")
    if account_id:
        ref = ref.where("account_id", "==", account_id)
    ref = ref.order_by("timestamp", direction="DESCENDING").limit(limit)
    return [doc.to_dict() for doc in ref.stream()]


def add_cyber_event(event: CyberEvent) -> str:
    db = get_firestore_client()
    db.collection("cyber_events").document(event.id).set(_to_dict(event))
    return event.id


# ── Financial Transactions ─────────────────────────────────────

def get_transactions(
    account_id: Optional[str] = None,
    limit: int = 100,
) -> List[dict]:
    db = get_firestore_client()
    ref = db.collection("financial_transactions")
    if account_id:
        # Get txns where account is sender OR receiver (two queries)
        sender_q = ref.where("sender", "==", account_id).limit(limit)
        receiver_q = ref.where("receiver", "==", account_id).limit(limit)
        results = {}
        for doc in sender_q.stream():
            results[doc.id] = doc.to_dict()
        for doc in receiver_q.stream():
            results[doc.id] = doc.to_dict()
        return list(results.values())
    ref = ref.order_by("timestamp", direction="DESCENDING").limit(limit)
    return [doc.to_dict() for doc in ref.stream()]


def get_all_transactions(limit: int = 500) -> List[dict]:
    db = get_firestore_client()
    ref = db.collection("financial_transactions").limit(limit)
    return [doc.to_dict() for doc in ref.stream()]


def add_transaction(tx: FinancialTransaction) -> str:
    db = get_firestore_client()
    db.collection("financial_transactions").document(tx.id).set(_to_dict(tx))
    return tx.id


# ── Risk Events ────────────────────────────────────────────────

def get_risk_event(account_id: str) -> Optional[dict]:
    db = get_firestore_client()
    ref = (
        db.collection("risk_events")
        .where("account_id", "==", account_id)
        .order_by("created_at", direction="DESCENDING")
        .limit(1)
    )
    docs = list(ref.stream())
    return docs[0].to_dict() if docs else None


def save_risk_event(event: RiskEvent) -> str:
    db = get_firestore_client()
    db.collection("risk_events").document(event.id).set(_to_dict(event))
    return event.id


# ── Alerts ─────────────────────────────────────────────────────

def get_alerts(
    institution_id: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = 50,
) -> List[dict]:
    db = get_firestore_client()
    ref = db.collection("alerts")
    if institution_id:
        ref = ref.where("institution_id", "==", institution_id)
    if status:
        ref = ref.where("status", "==", status)
    if severity:
        ref = ref.where("severity", "==", severity)
    ref = ref.order_by("created_at", direction="DESCENDING").limit(limit)
    return [doc.to_dict() for doc in ref.stream()]


def get_alert(alert_id: str) -> Optional[dict]:
    db = get_firestore_client()
    doc = db.collection("alerts").document(alert_id).get()
    return doc.to_dict() if doc.exists else None


def save_alert(alert: Alert) -> str:
    db = get_firestore_client()
    db.collection("alerts").document(alert.id).set(_to_dict(alert))
    return alert.id


def update_alert_status(alert_id: str, status: str, **extra):
    db = get_firestore_client()
    data = {"status": status}
    data.update(extra)
    db.collection("alerts").document(alert_id).update(data)


# ── STR Reports ────────────────────────────────────────────────

def save_str_report(report: dict) -> str:
    db = get_firestore_client()
    doc_ref = db.collection("str_reports").document(report["id"])
    doc_ref.set(report)
    return report["id"]


def get_str_report(report_id: str) -> Optional[dict]:
    db = get_firestore_client()
    doc = db.collection("str_reports").document(report_id).get()
    return doc.to_dict() if doc.exists else None


# ── Dashboard Aggregations ─────────────────────────────────────

def get_dashboard_summary() -> dict:
    """Aggregate stats for the bank dashboard."""
    db = get_firestore_client()

    # Count alerts by severity
    all_alerts = list(db.collection("alerts").stream())
    total = len(all_alerts)
    high_risk = sum(
        1 for a in all_alerts
        if a.to_dict().get("severity") in ("high", "critical")
    )

    # Count transactions
    tx_count = len(list(db.collection("financial_transactions").limit(1000).stream()))

    # Count distinct mule rings (alerts with >2 accounts flagged)
    mule_rings = sum(
        1 for a in all_alerts
        if len(a.to_dict().get("accounts_flagged", [])) >= 3
    )

    return {
        "total_alerts": total,
        "high_risk_count": high_risk,
        "transactions_monitored": tx_count,
        "active_mule_rings": max(mule_rings, 1),  # at least 1 for demo
    }


# ── Batch Operations ──────────────────────────────────────────

def clear_all_collections():
    """Delete all documents from all collections. Use for demo reset."""
    db = get_firestore_client()
    collections = [
        "users", "cyber_events", "financial_transactions",
        "risk_events", "alerts", "str_reports",
    ]
    for coll in collections:
        docs = db.collection(coll).limit(500).stream()
        for doc in docs:
            doc.reference.delete()
