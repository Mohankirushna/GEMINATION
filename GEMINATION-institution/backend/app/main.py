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

    # Initialize ML models in background (non-blocking)
    try:
        from .ml.fraud_models import get_ml_predictor
        from .ml.temporal_gnn import get_gnn_classifier
        predictor = get_ml_predictor()
        gnn = get_gnn_classifier()
        logger.info("ML models initialized: predictor=%s, gnn=%s",
                     "trained" if predictor.is_trained else "fallback",
                     "trained" if gnn.is_trained else "fallback")
    except Exception as e:
        logger.warning("ML model initialization failed (will use rule-based fallback): %s", str(e))

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
    """Full transaction graph with centrality metrics. Rebuilds on every call to reflect simulation updates."""
    if not ENABLE_GRAPH_ANALYTICS:
        raise HTTPException(status_code=403, detail="Graph analytics is disabled")

    _ensure_demo_data()
    from .risk_engine.graph_engine import analyze_graph

    txns = _demo_data["transactions"]
    # Include ML-detected labels if available
    ml_labels = _demo_data.get("ml_node_labels", {})
    graph_data = analyze_graph(
        txns,
        known_victims={"acc_victim_1", "acc_victim_2"},
    )

    # Override node labels with ML detections (temporal GNN results)
    if ml_labels:
        for node in graph_data.nodes:
            if node.id in ml_labels:
                node.node_label = ml_labels[node.id]

    # Serialize and add ml_detected flag
    result = graph_data.model_dump(mode="json")
    if ml_labels:
        for node_data in result.get("nodes", []):
            if node_data.get("id") in ml_labels:
                node_data["ml_detected"] = True
            else:
                node_data["ml_detected"] = False

    return result


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
    """Generate AI explanation for an alert. Falls back to rule-based analysis when Gemini is unavailable."""
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

    from .services.gemini_service import generate_alert_explanation, _generate_fallback_explanation

    if not ENABLE_GEMINI:
        # Use rule-based fallback
        result = _generate_fallback_explanation(alert)
        alert.gemini_explanation = result.explanation
        alert.recommended_action = result.recommendation
        return result.model_dump()

    result = await generate_alert_explanation(alert)

    # Cache result
    alert.gemini_explanation = result.explanation
    alert.recommended_action = result.recommendation

    return result.model_dump()


class SMSRequest(BaseModel):
    text: str


@app.post("/api/gemini/analyze-sms")
async def gemini_sms(req: SMSRequest):
    """Check if an SMS is a scam. Falls back to rule-based analysis when Gemini is unavailable."""
    from .services.gemini_service import analyze_sms, _analyze_sms_fallback

    if not ENABLE_GEMINI:
        # Use rule-based fallback instead of returning empty result
        result = _analyze_sms_fallback(req.text)
        return result.model_dump()

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

    # Add ML score if available
    try:
        from .ml.feature_engineering import get_feature_engineer
        from .ml.fraud_models import get_ml_predictor
        fe = get_feature_engineer()
        predictor = get_ml_predictor()
        features = fe.extract_features(account_id, _demo_data["transactions"], _demo_data["cyber_events"])
        ml_result = predictor.predict_single(features)
        score_details["ml_score"] = round(ml_result["combined_score"], 4)
    except Exception:
        pass

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
                    model="gemini-2.5-flash-lite",
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
            # Provide fallback analysis with dynamic confidence based on risk score
            unified_score = event['risk_scores']['unified_score']
            fallback_confidence = round(min(0.95, max(0.5, unified_score + 0.1)), 2)
            event["gemini_analysis"] = {
                "explanation": f"High-risk activity detected (score: {unified_score:.2f}). "
                               f"Changes: {'; '.join(event.get('changes', []))}",
                "recommendation": "Immediately review flagged accounts and consider freezing pending investigation.",
                "confidence": fallback_confidence,
                "key_indicators": event.get("changes", []),
                "str_required": unified_score > 0.8,
            }

    # Inject the new event into the in-memory demo data store
    # Add transaction to the pool so the graph updates dynamically
    try:
        new_txn = FinancialTransaction(**event["transaction"])
        _demo_data["transactions"].append(new_txn)
        # Keep transactions list bounded to avoid memory growth
        if len(_demo_data["transactions"]) > 500:
            _demo_data["transactions"] = _demo_data["transactions"][-400:]
    except Exception as e:
        logger.warning("Failed to store live transaction: %s", str(e))

    # Add cyber event
    try:
        new_ce = CyberEvent(**event["cyber_event"])
        _demo_data["cyber_events"].append(new_ce)
        if len(_demo_data["cyber_events"]) > 500:
            _demo_data["cyber_events"] = _demo_data["cyber_events"][-400:]
    except Exception as e:
        logger.warning("Failed to store live cyber event: %s", str(e))

    # Run temporal GNN classification every 5 ticks to update mule/kingpin labels
    if event["tick"] % 5 == 0:
        try:
            from .ml.temporal_gnn import classify_graph_nodes
            labels = classify_graph_nodes(
                _demo_data["transactions"],
                known_victims={"acc_victim_1", "acc_victim_2"},
            )
            _demo_data["ml_node_labels"] = labels
            # Include ML labels in the event response
            label_summary = {}
            for nid, lbl in labels.items():
                val = lbl.value if hasattr(lbl, 'value') else str(lbl)
                label_summary[nid] = val
            event["ml_node_labels"] = label_summary
        except Exception as e:
            logger.debug("GNN classification skipped: %s", str(e))

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
# USER LIVE SIMULATION (End-user dashboard dynamic events)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/simulation/user-event/{account_id}")
async def user_live_event(account_id: str):
    """
    Generate a single simulation tick for end-user dashboard.
    Simulates geo-location changes, login anomalies, transaction velocity, etc.
    Frontend polls this every 8 seconds.
    """
    _ensure_demo_data()
    from .services.live_simulation import generate_user_live_event

    event = generate_user_live_event(account_id)

    # If medium+ risk and Gemini is enabled, get AI explanation
    if event["requires_gemini"] and ENABLE_GEMINI and event.get("gemini_prompt"):
        try:
            from .services.gemini_service import _get_client, _rate_limit_check, _record_call
            import json as _json

            client = _get_client()
            if client and _rate_limit_check():
                _record_call()
                from google.genai import types
                response = client.models.generate_content(
                    model="gemini-2.5-flash-lite",
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
        except Exception as e:
            logger.warning("Gemini user analysis failed: %s", str(e))

    # If Gemini didn't produce analysis, generate rule-based user explanation
    if event["requires_gemini"] and not event.get("gemini_analysis"):
        event["gemini_analysis"] = _generate_user_fallback_analysis(event)

    # Update risk event in demo data
    try:
        from .models import RiskEvent as RiskEventModel
        re = RiskEventModel(
            id=f"re_{account_id}_{event['tick']}",
            account_id=account_id,
            unified_score=event["risk_scores"]["unified_score"],
            cyber_score=event["risk_scores"]["cyber_score"],
            financial_score=event["risk_scores"]["financial_score"],
            graph_score=event["risk_scores"]["graph_score"],
            explanation=event.get("gemini_analysis", {}).get("explanation", ""),
            recommended_action="; ".join(event.get("procedures", [])),
        )
        _demo_data["risk_events"][account_id] = re
    except Exception:
        pass

    return event


def _generate_user_fallback_analysis(event: dict) -> dict:
    """Generate rule-based user-friendly security explanation."""
    changes = event.get("changes", [])
    warnings = event.get("warnings", [])
    risk = event["risk_scores"]["unified_score"]

    # Determine urgency
    if risk >= 0.7:
        urgency = "dangerous"
    elif risk >= 0.4:
        urgency = "caution"
    else:
        urgency = "safe"

    # Build explanation
    explanations = []
    steps = list(event.get("procedures", []))
    prevention_tips = []
    should_contact_bank = False

    for w in warnings:
        if w["type"] == "impossible_travel":
            explanations.append(
                f"We detected a login from a location that is physically impossible to reach "
                f"from your previous location in the time elapsed."
            )
            should_contact_bank = True
            prevention_tips.append("Always use 2-factor authentication for banking")
            prevention_tips.append("Never share your OTP or login credentials with anyone")
        elif w["type"] == "geo_change":
            explanations.append(
                f"Your account was accessed from a different city than usual. "
                f"This could be you travelling, or someone else accessing your account."
            )
            prevention_tips.append("Set up location-based alerts in your banking app")
        elif w["type"] == "new_device":
            explanations.append(
                f"A device we haven't seen before logged into your account. "
                f"If you recently changed phones, this is normal."
            )
            prevention_tips.append("Regularly review authorized devices in your bank settings")
            prevention_tips.append("Don't log into banking apps on shared or public devices")
        elif w["type"] == "login_velocity":
            explanations.append(
                f"We detected multiple rapid login attempts on your account, "
                f"which could indicate a brute-force attack."
            )
            should_contact_bank = True
            prevention_tips.append("Use a strong, unique password for your banking app")
            prevention_tips.append("Enable biometric authentication (fingerprint/face)")
        elif w["type"] == "txn_velocity":
            explanations.append(
                f"Your account is showing unusually frequent transactions. "
                f"This is significantly above your normal pattern."
            )
            should_contact_bank = risk >= 0.7
            prevention_tips.append("Set daily transaction limits in your banking app")
        elif w["type"] == "unusual_amount":
            explanations.append(
                f"A transaction much larger than your typical spending was detected. "
                f"Unusual amounts are flagged for your security."
            )
            prevention_tips.append("Set up transaction amount alerts for large transfers")
        elif w["type"] == "new_beneficiary":
            explanations.append(
                f"A transfer was made to a beneficiary you've never sent money to before."
            )
            prevention_tips.append("Double-check beneficiary details before confirming transfers")

    if not explanations:
        explanations.append("Unusual activity was detected on your account.")

    if not steps:
        if urgency == "dangerous":
            steps = ["Change your password immediately", "Contact your bank's helpline", "Review all recent transactions"]
        elif urgency == "caution":
            steps = ["Review your recent activity", "Verify any unrecognized transactions", "Consider updating your password"]

    if not prevention_tips:
        prevention_tips = ["Keep your banking app updated", "Never share OTPs or passwords"]

    return {
        "explanation": " ".join(explanations) + f" (Risk score: {risk:.2f})",
        "urgency": urgency,
        "confidence": min(0.75, risk + 0.1),
        "steps_to_take": steps[:5],
        "prevention_tips": prevention_tips[:3],
        "should_contact_bank": should_contact_bank,
    }


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
                    model="gemini-2.5-flash-lite",
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
# ML FRAUD DETECTION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/ml/status")
async def ml_status():
    """Get ML model training status and metrics."""
    try:
        from .ml.fraud_models import get_ml_predictor
        from .ml.temporal_gnn import get_gnn_classifier
        predictor = get_ml_predictor()
        gnn = get_gnn_classifier()
        return {
            "ml_enabled": True,
            "fraud_predictor": {
                "trained": predictor.is_trained,
                "metrics": predictor.training_metrics,
            },
            "temporal_gnn": {
                "trained": gnn.is_trained,
                "metrics": gnn._metrics,
            },
        }
    except Exception as e:
        return {"ml_enabled": False, "error": str(e)}


@app.post("/api/ml/predict/{account_id}")
async def ml_predict(account_id: str):
    """Run ML fraud prediction for a specific account."""
    _ensure_demo_data()

    try:
        from .ml.feature_engineering import get_feature_engineer
        from .ml.fraud_models import get_ml_predictor

        fe = get_feature_engineer()
        predictor = get_ml_predictor()

        features = fe.extract_features(
            account_id,
            _demo_data["transactions"],
            _demo_data["cyber_events"],
        )
        result = predictor.predict_single(features)
        result["account_id"] = account_id
        result["feature_count"] = len(features)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML prediction failed: {str(e)}")


@app.get("/api/ml/graph-classification")
async def ml_graph_classification():
    """Run temporal GNN classification on the current transaction graph."""
    _ensure_demo_data()

    try:
        from .ml.temporal_gnn import classify_graph_nodes
        labels = classify_graph_nodes(
            _demo_data["transactions"],
            known_victims={"acc_victim_1", "acc_victim_2"},
        )
        # Store labels for graph endpoint to use
        _demo_data["ml_node_labels"] = labels

        # Convert NodeLabel enums to strings
        result = {}
        for node_id, label in labels.items():
            result[node_id] = label.value if hasattr(label, 'value') else str(label)

        # Count by type
        counts = {}
        for label in result.values():
            counts[label] = counts.get(label, 0) + 1

        return {
            "classifications": result,
            "counts": counts,
            "total_nodes": len(result),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Graph classification failed: {str(e)}")


@app.post("/api/ml/retrain")
async def ml_retrain():
    """Retrain all ML models on fresh synthetic data."""
    try:
        from .ml.fraud_models import FraudMLPredictor
        from .ml.temporal_gnn import TemporalGNNClassifier

        # Create new model instances and train
        predictor = FraudMLPredictor()
        pred_metrics = predictor.train_all()

        gnn = TemporalGNNClassifier()
        gnn_metrics = gnn.train()

        # Update globals
        import app.ml.fraud_models as fm
        import app.ml.temporal_gnn as tg
        fm._predictor = predictor
        tg._gnn_classifier = gnn

        return {
            "success": True,
            "fraud_predictor": pred_metrics,
            "temporal_gnn": gnn_metrics,
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TIMESERIES DATABASE (Ticks 1-90)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@app.get("/api/timeseries/tick/{tick_number}")
async def get_tick_data(tick_number: int):
    """Get a specific tick by number (1-90)."""
    from .services.timeseries_db import get_tick
    
    tick_data = get_tick(tick_number)
    if not tick_data:
        raise HTTPException(status_code=404, detail=f"Tick {tick_number} not found")
    return tick_data


@app.get("/api/timeseries/range")
async def get_tick_range(start: int = 1, end: int = 90):
    """Get ticks in a range [start, end]."""
    from .services.timeseries_db import get_tick_range
    
    if start < 1 or end > 90 or start > end:
        raise HTTPException(status_code=400, detail="Invalid range. Use 1-90 with start <= end")
    
    ticks = get_tick_range(start, end)
    return {
        "range": f"{start}-{end}",
        "count": len(ticks),
        "ticks": ticks
    }


@app.get("/api/timeseries/all")
async def get_all_ticks():
    """Get all stored ticks (1-90) in chronological order."""
    from .services.timeseries_db import get_all_ticks, get_timeseries_stats
    
    ticks = get_all_ticks()
    stats = get_timeseries_stats()
    
    return {
        "stats": stats,
        "ticks": ticks
    }


@app.get("/api/timeseries/account/{account_id}")
async def get_account_timeseries(account_id: str):
    """Get all ticks where a specific account was involved."""
    from .services.timeseries_db import get_ticks_by_account
    
    ticks = get_ticks_by_account(account_id)
    return {
        "account_id": account_id,
        "event_count": len(ticks),
        "ticks": ticks
    }


@app.get("/api/timeseries/suspicious")
async def get_suspicious_ticks(threshold: float = 0.7):
    """Get all ticks with risk score above threshold."""
    from .services.timeseries_db import get_suspicious_ticks
    
    ticks = get_suspicious_ticks(threshold)
    return {
        "threshold": threshold,
        "count": len(ticks),
        "ticks": ticks
    }


@app.get("/api/timeseries/stats")
async def get_timeseries_statistics():
    """Get statistics about the timeseries database."""
    from .services.timeseries_db import get_timeseries_stats, get_current_tick_number
    
    stats = get_timeseries_stats()
    current_tick = get_current_tick_number()
    
    return {
        **stats,
        "current_tick": current_tick,
        "max_ticks": 90,
        "progress_percentage": round((current_tick / 90) * 100, 1) if current_tick else 0
    }


@app.delete("/api/timeseries/reset")
async def reset_timeseries():
    """Clear all timeseries data (use with caution)."""
    from .services.timeseries_db import reset_database
    
    reset_database()
    return {"success": True, "message": "Timeseries database reset. Simulation will restart from tick 1."}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# ENTRYPOINT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=HOST, port=PORT, reload=True)
