"""
SurakshaFlow — FastAPI Application
Main entry point for the backend API server.
"""
from __future__ import annotations

import io
import uuid
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import CORS_ORIGINS, HOST, PORT, ENABLE_GEMINI, ENABLE_DIGITAL_TWIN, ENABLE_GRAPH_ANALYTICS
from .models import (
    AccountAction,
    Alert,
    AlertStatus,
    CyberEvent,
    DashboardSummary,
    EventType,
    FinancialTransaction,
    GeminiExplanation,
    GraphData,
    RiskEvent,
    SMSAnalysisResult,
    Severity,
    SimulationResult,
    TxMethod,
    UserRiskResponse,
)
from .data_generator.scenarios import (
    generate_alerts,
    generate_cyber_events,
    generate_financial_transactions,
    generate_risk_events,
    generate_users,
    get_risk_trend_data,
)

# ── App Initialization ────────────────────────────────────────

app = FastAPI(
    title="SurakshaFlow API",
    description="Unified Cyber-Financial Intelligence Platform — Backend API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory demo data store (used when Firestore is unavailable) ──
_demo_data: dict = {}


def _ensure_demo_data():
    """Populate in-memory demo data if not already loaded."""
    if _demo_data.get("loaded"):
        return

    _demo_data["users"] = {u.id: u for u in generate_users()}
    _demo_data["cyber_events"] = generate_cyber_events()
    _demo_data["transactions"] = generate_financial_transactions()
    _demo_data["alerts"] = {a.id: a for a in generate_alerts()}
    _demo_data["risk_events"] = {r.account_id: r for r in generate_risk_events()}
    _demo_data["risk_trend"] = get_risk_trend_data()
    _demo_data["loaded"] = True


@app.on_event("startup")
async def startup():
    _ensure_demo_data()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# HEALTH CHECK
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# BANK DASHBOARD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/dashboard/bank/summary")
async def bank_summary():
    """Aggregate stats for the bank dashboard."""
    _ensure_demo_data()

    alerts = list(_demo_data["alerts"].values())
    txns = _demo_data["transactions"]
    high_risk = sum(1 for a in alerts if a.unified_risk_score >= 0.7)
    mule_rings = sum(1 for a in alerts if len(a.accounts_flagged) >= 3)

    return {
        "total_alerts": len(alerts),
        "high_risk_count": high_risk,
        "transactions_monitored": len(txns),
        "active_mule_rings": max(mule_rings, 1),
        "risk_trend": _demo_data["risk_trend"],
    }


@app.get("/api/dashboard/bank/alerts")
async def bank_alerts(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
):
    """Paginated alerts with optional filters."""
    _ensure_demo_data()

    alerts = list(_demo_data["alerts"].values())
    if severity:
        alerts = [a for a in alerts if a.severity.value == severity]
    if status:
        alerts = [a for a in alerts if a.status.value == status]

    alerts.sort(key=lambda a: a.created_at, reverse=True)
    result = []
    for a in alerts[:limit]:
        result.append(a.model_dump(mode="json"))
    return result


@app.get("/api/dashboard/bank/alert/{alert_id}")
async def bank_alert_detail(alert_id: str):
    """Single alert with full detail."""
    _ensure_demo_data()

    alert = _demo_data["alerts"].get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    data = alert.model_dump(mode="json")

    # Add risk breakdown for flagged accounts
    risk_breakdown = {}
    for acc in alert.accounts_flagged:
        re = _demo_data["risk_events"].get(acc)
        if re:
            risk_breakdown[acc] = re.model_dump(mode="json")
    data["risk_breakdown"] = risk_breakdown

    return data


class ActionRequest(BaseModel):
    action: str
    reason: str = ""


@app.post("/api/dashboard/bank/alert/{alert_id}/action")
async def bank_alert_action(alert_id: str, req: ActionRequest):
    """Perform action on an alert: freeze / monitor / escalate / dismiss."""
    _ensure_demo_data()

    alert = _demo_data["alerts"].get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    action_map = {
        "freeze": AlertStatus.RESOLVED,
        "monitor": AlertStatus.INVESTIGATING,
        "escalate": AlertStatus.ESCALATED,
        "dismiss": AlertStatus.RESOLVED,
    }

    new_status = action_map.get(req.action)
    if not new_status:
        raise HTTPException(status_code=400, detail=f"Unknown action: {req.action}")

    alert.status = new_status
    return {
        "success": True,
        "alert_id": alert_id,
        "action": req.action,
        "new_status": new_status.value,
        "message": f"Alert {alert_id}: {req.action} executed successfully.",
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# USER DASHBOARD
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/dashboard/user/{uid}/risk")
async def user_risk(uid: str):
    """Get user's current risk score and breakdown."""
    _ensure_demo_data()

    # Find risk event for this user's account
    user = _demo_data["users"].get(uid)
    if not user:
        # Try to find by account ID directly
        re = _demo_data["risk_events"].get(uid)
        if re:
            return UserRiskResponse(
                account_id=uid,
                unified_score=re.unified_score,
                cyber_score=re.cyber_score,
                financial_score=re.financial_score,
                graph_score=re.graph_score,
                risk_level="high" if re.unified_score >= 0.7 else "medium" if re.unified_score >= 0.4 else "low",
                explanation=re.explanation,
                recommended_action=re.recommended_action,
            ).model_dump()
        raise HTTPException(status_code=404, detail="User not found")

    # Get risk for first linked account
    account_id = user.linked_accounts[0] if user.linked_accounts else uid
    re = _demo_data["risk_events"].get(account_id)

    if re:
        return UserRiskResponse(
            account_id=account_id,
            unified_score=re.unified_score,
            cyber_score=re.cyber_score,
            financial_score=re.financial_score,
            graph_score=re.graph_score,
            risk_level="high" if re.unified_score >= 0.7 else "medium" if re.unified_score >= 0.4 else "low",
            explanation=re.explanation,
            recommended_action=re.recommended_action,
        ).model_dump()

    return UserRiskResponse(
        account_id=account_id,
        unified_score=0.0,
        cyber_score=0.0,
        financial_score=0.0,
        graph_score=0.0,
        risk_level="low",
    ).model_dump()


@app.get("/api/dashboard/user/{uid}/events")
async def user_events(uid: str):
    """Get user's cyber events and transactions."""
    _ensure_demo_data()

    user = _demo_data["users"].get(uid)
    account_ids = set()
    if user:
        account_ids = set(user.linked_accounts) | {uid}
    else:
        account_ids = {uid}

    cyber = [
        e.model_dump(mode="json")
        for e in _demo_data["cyber_events"]
        if e.account_id in account_ids
    ]
    txns = [
        t.model_dump(mode="json")
        for t in _demo_data["transactions"]
        if t.sender in account_ids or t.receiver in account_ids
    ]

    return {"cyber_events": cyber, "financial_transactions": txns}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GRAPH INTELLIGENCE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/graph/network")
async def graph_network():
    """Full transaction graph with centrality metrics."""
    if not ENABLE_GRAPH_ANALYTICS:
        raise HTTPException(status_code=403, detail="Graph analytics is disabled")

    _ensure_demo_data()
    from .risk_engine.graph_engine import analyze_graph

    txns = _demo_data["transactions"]
    # Convert to model objects for the graph engine
    graph_data = analyze_graph(
        txns,
        known_victims={"acc_victim_1", "acc_victim_2"},
    )
    return graph_data.model_dump(mode="json")


@app.get("/api/graph/cluster/{account_id}")
async def graph_cluster(account_id: str, depth: int = Query(default=2, le=5)):
    """Subgraph around a specific account."""
    if not ENABLE_GRAPH_ANALYTICS:
        raise HTTPException(status_code=403, detail="Graph analytics is disabled")

    _ensure_demo_data()
    from .risk_engine.graph_engine import get_subgraph

    graph_data = get_subgraph(
        _demo_data["transactions"],
        account_id,
        depth=depth,
        known_victims={"acc_victim_1", "acc_victim_2"},
    )
    return graph_data.model_dump(mode="json")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RISK SCORING
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.post("/api/risk/score/{account_id}")
async def trigger_scoring(account_id: str):
    """Trigger re-scoring for an account."""
    _ensure_demo_data()
    from .risk_engine.unified_scorer import score_account

    result = score_account(
        account_id=account_id,
        cyber_events=_demo_data["cyber_events"],
        financial_txns=_demo_data["transactions"],
        all_txns=_demo_data["transactions"],
        known_victims={"acc_victim_1", "acc_victim_2"},
    )
    return result


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GEMINI AI
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class ExplainRequest(BaseModel):
    alert_id: str


@app.post("/api/gemini/explain")
async def gemini_explain(req: ExplainRequest):
    """Generate AI explanation for an alert."""
    if not ENABLE_GEMINI:
        return GeminiExplanation(
            explanation="Gemini AI is disabled via feature flag.",
            recommendation="Enable ENABLE_GEMINI in environment.",
        ).model_dump()

    _ensure_demo_data()
    alert = _demo_data["alerts"].get(req.alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Return cached explanation if available
    if alert.gemini_explanation:
        return GeminiExplanation(
            explanation=alert.gemini_explanation,
            recommendation=alert.recommended_action,
            confidence=0.92,
            key_indicators=["device_reuse", "rapid_layering", "mule_network"],
        ).model_dump()

    from .services.gemini_service import generate_alert_explanation
    result = await generate_alert_explanation(alert)

    # Cache result
    alert.gemini_explanation = result.explanation
    alert.recommended_action = result.recommendation

    return result.model_dump()


class SMSRequest(BaseModel):
    text: str


@app.post("/api/gemini/analyze-sms")
async def gemini_sms(req: SMSRequest):
    """Check if an SMS is a scam."""
    if not ENABLE_GEMINI:
        return SMSAnalysisResult(
            is_scam=False, confidence=0, explanation="Gemini AI is disabled.",
        ).model_dump()

    from .services.gemini_service import analyze_sms
    result = await analyze_sms(req.text)
    return result.model_dump()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STR REPORT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.post("/api/str/generate/{alert_id}")
async def generate_str(alert_id: str):
    """Generate a Suspicious Transaction Report PDF."""
    _ensure_demo_data()

    alert = _demo_data["alerts"].get(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    from .services.str_generator import generate_str_pdf

    alert_dict = alert.model_dump(mode="json")
    account_id = alert.accounts_flagged[0] if alert.accounts_flagged else "unknown"

    # Get score details
    score_details = {}
    re = _demo_data["risk_events"].get(account_id)
    if re:
        score_details = re.model_dump(mode="json")

    pdf_bytes = generate_str_pdf(
        alert_data=alert_dict,
        account_id=account_id,
        score_details=score_details,
        gemini_explanation=alert.gemini_explanation,
    )

    report_id = f"str_{uuid.uuid4().hex[:8]}"
    # Store in memory for download
    _demo_data.setdefault("str_reports", {})[report_id] = pdf_bytes

    return {
        "report_id": report_id,
        "alert_id": alert_id,
        "download_url": f"/api/str/download/{report_id}",
    }


@app.get("/api/str/download/{report_id}")
async def download_str(report_id: str):
    """Download a generated STR report PDF."""
    _ensure_demo_data()

    pdf_bytes = _demo_data.get("str_reports", {}).get(report_id)
    if not pdf_bytes:
        raise HTTPException(status_code=404, detail="Report not found")

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=STR_{report_id}.pdf",
        },
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DIGITAL TWIN SIMULATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class SimulationRequest(BaseModel):
    account_to_freeze: str


@app.post("/api/simulation/digital-twin")
async def digital_twin(req: SimulationRequest):
    """Run a digital twin simulation."""
    if not ENABLE_DIGITAL_TWIN:
        raise HTTPException(status_code=403, detail="Digital twin simulation is disabled")

    _ensure_demo_data()
    from .services.digital_twin import simulate_freeze

    result = simulate_freeze(
        txns=_demo_data["transactions"],
        freeze_account=req.account_to_freeze,
        known_victims={"acc_victim_1", "acc_victim_2"},
    )
    return result.model_dump()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DEMO CONTROLS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.post("/api/demo/seed")
async def demo_seed():
    """Reset and re-seed demo data."""
    _demo_data.clear()
    _ensure_demo_data()
    return {"success": True, "message": "Demo data re-seeded."}


@app.post("/api/demo/run-scenario")
async def demo_run_scenario():
    """Trigger the demo attack chain scenario."""
    _demo_data.clear()
    _ensure_demo_data()
    return {
        "success": True,
        "message": "Attack chain scenario loaded.",
        "timeline": [
            {"t": "T+0s", "event": "Phishing SMS sent to victim_1"},
            {"t": "T+2min", "event": "Device login anomaly on victim account"},
            {"t": "T+4min", "event": "Same device accesses mule accounts A, B, C"},
            {"t": "T+6min", "event": "Impossible travel detected (Mumbai → Delhi)"},
            {"t": "T+10min", "event": "Funds transferred: victim → Mule A (₹50K + ₹35K)"},
            {"t": "T+12min", "event": "Rapid layering: Mule A → B, C, D"},
            {"t": "T+16min", "event": "Consolidation: Mules → Kingpin"},
            {"t": "T+18min", "event": "Unified Risk Score > 0.9 → Gemini explanation generated"},
            {"t": "T+20min", "event": "Alert created → Bank dashboard updated"},
        ],
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENTRYPOINT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
