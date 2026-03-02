"""
SurakshaFlow — FastAPI Application
Main entry point for the backend API server.
"""
from __future__ import annotations

import io
import logging
import sys
import uuid
from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Request, Response
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

# ── Logging Setup ─────────────────────────────────────────────

LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

logging.basicConfig(
    level=logging.INFO,
    format=LOG_FORMAT,
    datefmt=DATE_FORMAT,
    handlers=[
        logging.StreamHandler(sys.stdout),
    ],
)

logger = logging.getLogger("surakshaflow")
logger.setLevel(logging.INFO)

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


# ── Request Logging Middleware ────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log every incoming request and its response status."""
    import time
    start = time.perf_counter()
    logger.info("→ %s %s", request.method, request.url.path)
    try:
        response = await call_next(request)
        elapsed = (time.perf_counter() - start) * 1000
        logger.info(
            "← %s %s → %d (%.1fms)",
            request.method,
            request.url.path,
            response.status_code,
            elapsed,
        )
        return response
    except Exception as exc:
        elapsed = (time.perf_counter() - start) * 1000
        logger.error(
            "✗ %s %s → ERROR (%.1fms): %s",
            request.method,
            request.url.path,
            elapsed,
            str(exc),
        )
        raise

# ── In-memory demo data store (used when Firestore is unavailable) ──
_demo_data: dict = {}


def _ensure_demo_data():
    """Populate in-memory demo data if not already loaded."""
    if _demo_data.get("loaded"):
        return

    logger.info("Loading demo data into memory...")
    _demo_data["users"] = {u.id: u for u in generate_users()}
    _demo_data["cyber_events"] = generate_cyber_events()
    _demo_data["transactions"] = generate_financial_transactions()
    _demo_data["alerts"] = {a.id: a for a in generate_alerts()}
    _demo_data["risk_events"] = {r.account_id: r for r in generate_risk_events()}
    _demo_data["risk_trend"] = get_risk_trend_data()
    _demo_data["loaded"] = True
    logger.info(
        "Demo data loaded: %d users, %d alerts, %d cyber events, %d transactions, %d risk events",
        len(_demo_data["users"]),
        len(_demo_data["alerts"]),
        len(_demo_data["cyber_events"]),
        len(_demo_data["transactions"]),
        len(_demo_data["risk_events"]),
    )


@app.on_event("startup")
async def startup():
    logger.info("SurakshaFlow API starting up...")
    logger.info("Features — Gemini: %s | Digital Twin: %s | Graph: %s", ENABLE_GEMINI, ENABLE_DIGITAL_TWIN, ENABLE_GRAPH_ANALYTICS)
    _ensure_demo_data()
    logger.info("SurakshaFlow API ready on %s:%s", HOST, PORT)


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
    logger.info("User risk lookup for uid=%s", uid)

    # Find risk event for this user's account
    user = _demo_data["users"].get(uid)
    if not user:
        # Try to find by account ID directly
        re = _demo_data["risk_events"].get(uid)
        if re:
            logger.info("Found risk event directly for account_id=%s, score=%.2f", uid, re.unified_score)
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
        logger.warning("User not found: uid=%s (available users: %s)", uid, list(_demo_data["users"].keys())[:5])
        raise HTTPException(status_code=404, detail=f"User not found: {uid}")

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
        content=bytes(pdf_bytes),
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
# LIVE SIMULATION (Dynamic 5-second polling)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/simulation/live-event")
async def live_event():
    """
    Generate a single simulation tick with random ML/non-ML activity.
    Frontend polls this every 5 seconds for dynamic dashboard updates.
    """
    _ensure_demo_data()
    from .services.live_simulation import generate_live_event

    event = generate_live_event()

    # If high risk and Gemini is enabled, get AI explanation
    if event["requires_gemini"] and ENABLE_GEMINI and event.get("gemini_prompt"):
        try:
            from .services.gemini_service import _get_client, _rate_limit_check, _record_call
            import json as _json

            client = _get_client()
            if client and _rate_limit_check():
                _record_call()
                from google.genai import types
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=event["gemini_prompt"],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.3,
                    ),
                )
                if response.text:
                    clean_text = response.text.strip()
                    if clean_text.startswith("```json"):
                        clean_text = clean_text[7:]
                    if clean_text.startswith("```"):
                        clean_text = clean_text[3:]
                    if clean_text.endswith("```"):
                        clean_text = clean_text[:-3]
                    gemini_result = _json.loads(clean_text.strip())
                    event["gemini_analysis"] = gemini_result

                    # Update the alert with Gemini explanation
                    if event.get("alert"):
                        event["alert"]["gemini_explanation"] = gemini_result.get("explanation", "")
                        event["alert"]["recommended_action"] = gemini_result.get("recommendation", "")
        except Exception as e:
            logger.warning("Gemini live analysis failed: %s", str(e))
            # Provide fallback analysis
            event["gemini_analysis"] = {
                "explanation": f"High-risk activity detected (score: {event['risk_scores']['unified_score']:.2f}). "
                               f"Changes: {'; '.join(event.get('changes', []))}",
                "recommendation": "Immediately review flagged accounts and consider freezing pending investigation.",
                "confidence": 0.7,
                "key_indicators": event.get("changes", []),
                "str_required": event["risk_scores"]["unified_score"] > 0.8,
            }

    # Inject the new event into the in-memory demo data store
    if event.get("alert"):
        alert_id = event["alert"]["id"]
        # Create a proper Alert model for storage
        try:
            from .models import Alert as AlertModel, Severity as SeverityModel, AlertStatus as AlertStatusModel
            alert_obj = AlertModel(
                id=alert_id,
                accounts_flagged=event["alert"]["accounts_flagged"],
                severity=SeverityModel(event["alert"]["severity"]),
                status=AlertStatusModel.NEW,
                unified_risk_score=event["alert"]["unified_risk_score"],
                cyber_events=[CyberEvent(**event["cyber_event"])],
                financial_transactions=[FinancialTransaction(**event["transaction"])],
                gemini_explanation=event["alert"].get("gemini_explanation", ""),
                recommended_action=event["alert"].get("recommended_action", ""),
                created_at=datetime.fromisoformat(event["alert"]["created_at"]),
            )
            _demo_data["alerts"][alert_id] = alert_obj
        except Exception as e:
            logger.warning("Failed to store live alert: %s", str(e))

    return event


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NEW USER DATA GENERATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class NewUserRequest(BaseModel):
    account_id: str
    email: str = ""


@app.post("/api/user/generate-data")
async def generate_user_data(req: NewUserRequest):
    """Generate initial dynamic data for a newly signed-up user."""
    from .services.live_simulation import generate_initial_data_for_user

    data = generate_initial_data_for_user(req.account_id, req.email)

    # Store in demo data
    _ensure_demo_data()
    account_id = req.account_id

    # Add risk event
    from .models import RiskEvent as RiskEventModel
    re = RiskEventModel(**data["risk_event"])
    _demo_data["risk_events"][account_id] = re

    return data


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# EMAIL PHISHING ANALYSIS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class EmailAnalysisRequest(BaseModel):
    email_content: str
    sender_email: str = ""
    subject: str = ""


@app.post("/api/gemini/analyze-email")
async def analyze_email(req: EmailAnalysisRequest):
    """Analyze an email for phishing/spam indicators."""
    from .services.live_simulation import analyze_email_for_phishing

    # First do rule-based pre-analysis
    pre_analysis = analyze_email_for_phishing(req.email_content, req.sender_email)

    # If Gemini is enabled, get AI analysis
    if ENABLE_GEMINI:
        try:
            from .services.gemini_service import _get_client, _rate_limit_check, _record_call
            import json as _json

            client = _get_client()
            if client and _rate_limit_check():
                _record_call()
                prompt = f"""You are a cybersecurity expert specializing in email phishing and financial fraud detection.

Analyze this email for phishing, spam, or fraud indicators:

Subject: {req.subject}
From: {req.sender_email}
Content:
\"\"\"{req.email_content}\"\"\"

Pre-analysis indicators found: {pre_analysis['indicators']}

Consider:
- Urgency or threatening language
- Suspicious links or domains
- Request for personal/financial information
- Impersonation of known organizations
- Grammar and formatting anomalies
- Social engineering tactics
- Attachment-based threats
- Spoofed sender addresses

Respond ONLY as JSON:
{{
  "is_phishing": true/false,
  "confidence": 0.0 to 1.0,
  "explanation": "Detailed explanation of findings",
  "risk_indicators": ["indicator1", "indicator2"],
  "recommended_action": "What the user should do",
  "threat_type": "phishing|spam|scam|legitimate|unknown"
}}"""
                from google.genai import types
                response = client.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.2,
                    ),
                )
                if response.text:
                    clean_text = response.text.strip()
                    if clean_text.startswith("```json"):
                        clean_text = clean_text[7:]
                    if clean_text.startswith("```"):
                        clean_text = clean_text[3:]
                    if clean_text.endswith("```"):
                        clean_text = clean_text[:-3]
                    gemini_result = _json.loads(clean_text.strip())
                    return {
                        **gemini_result,
                        "analysis_source": "gemini_ai",
                        "pre_analysis": pre_analysis,
                    }
        except Exception as e:
            logger.warning("Gemini email analysis failed: %s", str(e))

    # Fallback to rule-based analysis
    return {
        "is_phishing": pre_analysis["is_phishing"],
        "confidence": pre_analysis["risk_score"],
        "explanation": pre_analysis["summary"],
        "risk_indicators": pre_analysis["indicators"],
        "recommended_action": "Delete this email and do not click any links." if pre_analysis["is_phishing"] else "This email appears safe, but remain vigilant.",
        "threat_type": "phishing" if pre_analysis["is_phishing"] else "legitimate",
        "analysis_source": "rule_based",
        "pre_analysis": pre_analysis,
    }


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENTRYPOINT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
