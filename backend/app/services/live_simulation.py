"""
SurakshaFlow — Live Simulation Engine
Generates random money laundering / non-money laundering events dynamically.
Called every 5 seconds to simulate real-time threat intelligence.
"""
from __future__ import annotations

import random
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from ..models import (
    Alert,
    AlertStatus,
    CyberEvent,
    EventType,
    FinancialTransaction,
    GeminiExplanation,
    RiskEvent,
    Severity,
    TxMethod,
)
from ..risk_engine.unified_scorer import compute_unified_score, classify_severity

# ── Configuration ──────────────────────────────────────────────

INDIAN_CITIES = [
    "Mumbai, IN", "Delhi, IN", "Bengaluru, IN", "Chennai, IN",
    "Kolkata, IN", "Hyderabad, IN", "Pune, IN", "Ahmedabad, IN",
    "Jaipur, IN", "Lucknow, IN", "Kochi, IN", "Chandigarh, IN",
    "Bhopal, IN", "Nagpur, IN", "Coimbatore, IN",
]

DEVICE_IDS = [
    "dev_8891", "dev_3345", "dev_7712", "dev_5543",
    "dev_9901", "dev_2234", "dev_6678", "dev_1123",
]

ACCOUNT_IDS = [
    "acc_A", "acc_B", "acc_C", "acc_D", "acc_E", "acc_F",
    "acc_victim_1", "acc_victim_2", "acc_victim_3",
    "acc_kingpin", "acc_clean_1", "acc_clean_2",
]

MULE_ACCOUNTS = ["acc_A", "acc_B", "acc_C", "acc_D", "acc_E", "acc_F"]
VICTIM_ACCOUNTS = ["acc_victim_1", "acc_victim_2", "acc_victim_3"]
KINGPIN_ACCOUNTS = ["acc_kingpin"]

# Track simulation state
_sim_state = {
    "tick": 0,
    "events_history": [],
    "current_scenario": None,
    "risk_trend": [],
}


def _generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def _now() -> datetime:
    return datetime.utcnow()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MONEY LAUNDERING SCENARIO GENERATORS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _generate_ml_cyber_event() -> CyberEvent:
    """Generate a suspicious cyber event indicating money laundering."""
    scenario = random.choice([
        "impossible_travel", "device_reuse", "rapid_login", "phishing"
    ])

    if scenario == "impossible_travel":
        city1, city2 = random.sample(INDIAN_CITIES, 2)
        account = random.choice(MULE_ACCOUNTS)
        return CyberEvent(
            id=_generate_id("ce"),
            account_id=account,
            device_id=random.choice(DEVICE_IDS[:3]),  # reuse known suspicious devices
            event_type=EventType.IMPOSSIBLE_TRAVEL,
            ip_geo=city2,
            timestamp=_now(),
            anomaly_score=round(random.uniform(0.8, 0.98), 2),
            raw_signals={
                "origin": city1,
                "destination": city2,
                "time_diff_min": random.randint(1, 5),
                "scenario": "impossible_travel",
            },
        )

    elif scenario == "device_reuse":
        device = random.choice(DEVICE_IDS[:2])  # known suspicious devices
        account = random.choice(MULE_ACCOUNTS)
        return CyberEvent(
            id=_generate_id("ce"),
            account_id=account,
            device_id=device,
            event_type=EventType.NEW_DEVICE,
            ip_geo=random.choice(INDIAN_CITIES),
            timestamp=_now(),
            anomaly_score=round(random.uniform(0.75, 0.95), 2),
            raw_signals={
                "rapid_switch": True,
                "accounts_in_session": random.randint(2, 5),
                "scenario": "device_reuse",
            },
        )

    elif scenario == "rapid_login":
        device = random.choice(DEVICE_IDS[:3])
        account = random.choice(MULE_ACCOUNTS + VICTIM_ACCOUNTS)
        return CyberEvent(
            id=_generate_id("ce"),
            account_id=account,
            device_id=device,
            event_type=EventType.LOGIN,
            ip_geo=random.choice(INDIAN_CITIES),
            timestamp=_now(),
            anomaly_score=round(random.uniform(0.7, 0.92), 2),
            raw_signals={
                "login_velocity": random.randint(5, 15),
                "failed_attempts": random.randint(2, 8),
                "scenario": "rapid_login",
            },
        )

    else:  # phishing
        account = random.choice(VICTIM_ACCOUNTS)
        return CyberEvent(
            id=_generate_id("ce"),
            account_id=account,
            device_id=f"dev_victim_{random.randint(1, 5)}",
            event_type=EventType.PHISHING,
            ip_geo=random.choice(INDIAN_CITIES),
            timestamp=_now(),
            anomaly_score=round(random.uniform(0.6, 0.85), 2),
            raw_signals={
                "phishing_link": f"https://fake-bank-{random.randint(1,99)}.xyz/verify",
                "scenario": "phishing",
            },
        )


def _generate_ml_transaction() -> FinancialTransaction:
    """Generate a suspicious financial transaction (money laundering pattern)."""
    pattern = random.choice(["layering", "consolidation", "rapid_transfer"])

    if pattern == "layering":
        sender = random.choice(MULE_ACCOUNTS[:3])
        receiver = random.choice(MULE_ACCOUNTS[2:])
        while receiver == sender:
            receiver = random.choice(MULE_ACCOUNTS)
        amount = random.choice([15000, 20000, 25000, 30000, 35000, 45000])
        return FinancialTransaction(
            id=_generate_id("tx"),
            sender=sender,
            receiver=receiver,
            amount=amount,
            method=random.choice([TxMethod.UPI, TxMethod.IMPS]),
            timestamp=_now(),
            velocity_score=round(random.uniform(0.75, 0.95), 2),
            risk_flags=["rapid_transfer", "splitting", "layering"],
        )

    elif pattern == "consolidation":
        sender = random.choice(MULE_ACCOUNTS)
        receiver = random.choice(KINGPIN_ACCOUNTS)
        amount = random.choice([20000, 30000, 40000, 50000, 60000])
        return FinancialTransaction(
            id=_generate_id("tx"),
            sender=sender,
            receiver=receiver,
            amount=amount,
            method=random.choice([TxMethod.IMPS, TxMethod.NEFT]),
            timestamp=_now(),
            velocity_score=round(random.uniform(0.8, 0.98), 2),
            risk_flags=["consolidation", "rapid_withdrawal"],
        )

    else:  # rapid_transfer from victim
        sender = random.choice(VICTIM_ACCOUNTS)
        receiver = random.choice(MULE_ACCOUNTS)
        amount = random.choice([25000, 35000, 50000, 75000, 100000])
        return FinancialTransaction(
            id=_generate_id("tx"),
            sender=sender,
            receiver=receiver,
            amount=amount,
            method=TxMethod.UPI,
            timestamp=_now(),
            velocity_score=round(random.uniform(0.7, 0.9), 2),
            risk_flags=["unusual_amount", "new_beneficiary"],
        )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NON-MONEY LAUNDERING (CLEAN) GENERATORS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _generate_clean_cyber_event() -> CyberEvent:
    """Generate a normal (clean) cyber event."""
    account = random.choice(["acc_clean_1", "acc_clean_2", "acc_clean_3"])
    return CyberEvent(
        id=_generate_id("ce"),
        account_id=account,
        device_id=f"dev_clean_{random.randint(1, 10)}",
        event_type=EventType.LOGIN,
        ip_geo=random.choice(INDIAN_CITIES[:5]),  # consistent locations
        timestamp=_now(),
        anomaly_score=round(random.uniform(0.01, 0.15), 2),
        raw_signals={"scenario": "normal_activity"},
    )


def _generate_clean_transaction() -> FinancialTransaction:
    """Generate a normal (non-suspicious) financial transaction."""
    return FinancialTransaction(
        id=_generate_id("tx"),
        sender=random.choice(["acc_clean_1", "acc_clean_2"]),
        receiver=random.choice(["merchant_grocery", "merchant_fuel", "merchant_online", "merchant_recharge"]),
        amount=random.choice([250, 500, 850, 1200, 2500, 3000, 5000]),
        method=TxMethod.UPI,
        timestamp=_now(),
        velocity_score=round(random.uniform(0.01, 0.1), 2),
        risk_flags=[],
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MAIN SIMULATION TICK
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def generate_live_event() -> dict:
    """
    Generate one simulation tick.
    
    Randomly decides between money-laundering and clean activity.
    Returns the new event data + updated risk metrics.
    
    ML probability: ~60% (to make it interesting for demo)
    """
    _sim_state["tick"] += 1
    tick = _sim_state["tick"]

    # Decide scenario: 60% ML, 40% clean
    is_ml = random.random() < 0.6

    if is_ml:
        cyber_event = _generate_ml_cyber_event()
        transaction = _generate_ml_transaction()
        scenario_type = "money_laundering"
    else:
        cyber_event = _generate_clean_cyber_event()
        transaction = _generate_clean_transaction()
        scenario_type = "clean"

    # Compute risk scores
    cyber_score = cyber_event.anomaly_score
    financial_score = transaction.velocity_score

    # Graph score based on account involvement
    if is_ml:
        graph_score = round(random.uniform(0.6, 0.95), 2)
    else:
        graph_score = round(random.uniform(0.01, 0.15), 2)

    unified_score = compute_unified_score(cyber_score, financial_score, graph_score)

    # Determine what changed
    changes = []
    if cyber_event.event_type == EventType.IMPOSSIBLE_TRAVEL:
        origin = cyber_event.raw_signals.get("origin", "Unknown")
        destination = cyber_event.ip_geo
        changes.append(f"Geo-location change: {origin} → {destination}")
    if cyber_event.raw_signals.get("login_velocity", 0) > 3:
        changes.append(f"Login velocity spike: {cyber_event.raw_signals['login_velocity']} attempts in 5 min")
    if transaction.velocity_score > 0.5:
        changes.append(f"Transaction velocity anomaly: score {transaction.velocity_score:.2f}")
    if cyber_event.event_type == EventType.NEW_DEVICE:
        changes.append(f"New device detected: {cyber_event.device_id} at {cyber_event.ip_geo}")
    if cyber_event.event_type == EventType.PHISHING:
        changes.append(f"Phishing attempt detected targeting {cyber_event.account_id}")
    if "splitting" in transaction.risk_flags:
        changes.append(f"Fund splitting detected: ₹{transaction.amount:,} from {transaction.sender} → {transaction.receiver}")
    if "consolidation" in transaction.risk_flags:
        changes.append(f"Fund consolidation: ₹{transaction.amount:,} flowing to {transaction.receiver}")

    # Update risk trend
    time_str = _now().strftime("%H:%M:%S")
    _sim_state["risk_trend"].append({
        "time": time_str,
        "risk": unified_score,
        "alerts": 1 if unified_score > 0.7 else 0,
    })
    # Keep last 20 trend points
    if len(_sim_state["risk_trend"]) > 20:
        _sim_state["risk_trend"] = _sim_state["risk_trend"][-20:]

    # Build alert if high risk
    alert_data = None
    if unified_score > 0.5:
        alert_data = {
            "id": _generate_id("alert"),
            "accounts_flagged": [cyber_event.account_id, transaction.sender, transaction.receiver],
            "severity": classify_severity(unified_score).value,
            "status": "new",
            "unified_risk_score": unified_score,
            "cyber_events": [cyber_event.model_dump(mode="json")],
            "financial_transactions": [transaction.model_dump(mode="json")],
            "created_at": _now().isoformat(),
            "gemini_explanation": "",
            "recommended_action": "",
        }

    # Build structured prompt for Gemini when risk > 0.7
    gemini_prompt = None
    if unified_score > 0.7:
        gemini_prompt = _build_high_risk_prompt(
            cyber_event, transaction, unified_score, cyber_score,
            financial_score, graph_score, changes
        )

    result = {
        "tick": tick,
        "timestamp": _now().isoformat(),
        "scenario_type": scenario_type,
        "is_suspicious": is_ml,
        "cyber_event": cyber_event.model_dump(mode="json"),
        "transaction": transaction.model_dump(mode="json"),
        "risk_scores": {
            "cyber_score": cyber_score,
            "financial_score": financial_score,
            "graph_score": graph_score,
            "unified_score": unified_score,
        },
        "changes": changes,
        "alert": alert_data,
        "risk_trend": list(_sim_state["risk_trend"]),
        "gemini_prompt": gemini_prompt,
        "requires_gemini": unified_score > 0.7,
    }

    return result


def _build_high_risk_prompt(
    cyber_event: CyberEvent,
    transaction: FinancialTransaction,
    unified_score: float,
    cyber_score: float,
    financial_score: float,
    graph_score: float,
    changes: list,
) -> str:
    """
    Build a structured prompt for Gemini API when unified risk > 0.7.
    Includes changes in geo location, login velocity, and transaction velocity.
    """
    prompt_parts = [
        "You are a Senior Compliance Officer and AML (Anti-Money Laundering) expert at a major Indian bank.",
        "A real-time monitoring system has flagged the following suspicious activity.\n",
        "=== ALERT DETAILS ===",
        f"Unified Risk Score: {unified_score:.2f} (CRITICAL - above 0.7 threshold)",
        f"Cyber Risk Score: {cyber_score:.2f}",
        f"Financial Risk Score: {financial_score:.2f}",
        f"Graph Intelligence Score: {graph_score:.2f}\n",
        "=== DETECTED CHANGES ===",
    ]

    for change in changes:
        prompt_parts.append(f"  • {change}")

    prompt_parts.extend([
        f"\n=== CYBER EVENT ===",
        f"Event Type: {cyber_event.event_type.value}",
        f"Account: {cyber_event.account_id}",
        f"Device: {cyber_event.device_id}",
        f"Location: {cyber_event.ip_geo}",
        f"Anomaly Score: {cyber_event.anomaly_score}",
    ])

    if cyber_event.raw_signals:
        prompt_parts.append(f"Raw Signals: {cyber_event.raw_signals}")

    prompt_parts.extend([
        f"\n=== FINANCIAL TRANSACTION ===",
        f"Amount: ₹{transaction.amount:,.0f}",
        f"Method: {transaction.method.value.upper()}",
        f"Sender: {transaction.sender}",
        f"Receiver: {transaction.receiver}",
        f"Velocity Score: {transaction.velocity_score}",
        f"Risk Flags: {', '.join(transaction.risk_flags) if transaction.risk_flags else 'none'}",
    ])

    prompt_parts.extend([
        "\n=== INSTRUCTIONS ===",
        "Based on the above real-time alert, provide the following as a bank administrator:",
        "",
        "1. **Risk Assessment**: Explain what type of fraud/money laundering this likely represents",
        "2. **Regulatory Compliance**: Which specific RBI/PMLA/FATF regulations and compliances apply",
        "3. **Immediate Actions**: Step-by-step procedures the bank should follow for the involved accounts",
        "4. **STR Filing**: Whether a Suspicious Transaction Report should be filed with FIU-IND",
        "5. **Account Actions**: Which accounts to freeze, monitor, or escalate",
        "6. **Evidence Preservation**: What digital evidence to preserve for investigation",
        "",
        "Respond ONLY as a JSON object:",
        '{',
        '  "explanation": "2-3 sentence summary of the risk and fraud type",',
        '  "recommendation": "Primary recommended action for bank compliance",',
        '  "confidence": 0.0 to 1.0,',
        '  "key_indicators": ["indicator1", "indicator2", ...],',
        '  "regulatory_references": ["RBI circular/PMLA section applicable"],',
        '  "immediate_steps": ["step1", "step2", ...],',
        '  "accounts_to_freeze": ["account_id1", ...],',
        '  "str_required": true/false',
        '}',
    ])

    return "\n".join(prompt_parts)


def generate_initial_data_for_user(account_id: str, email: str = "") -> dict:
    """
    Generate initial dynamic data for a newly signed-up user.
    Returns risk profile and some activity data.
    """
    # Generate some baseline activity
    cyber_events = []
    transactions = []

    # 2-3 normal login events
    for i in range(random.randint(2, 4)):
        cyber_events.append(CyberEvent(
            id=_generate_id("ce"),
            account_id=account_id,
            device_id=f"dev_{account_id}_{i}",
            event_type=EventType.LOGIN,
            ip_geo=random.choice(INDIAN_CITIES[:5]),
            timestamp=_now() - timedelta(hours=random.randint(1, 48)),
            anomaly_score=round(random.uniform(0.01, 0.1), 2),
            raw_signals={"scenario": "initial_setup"},
        ))

    # 3-5 normal transactions
    merchants = ["merchant_grocery", "merchant_fuel", "merchant_online", "merchant_recharge", "merchant_utility"]
    for i in range(random.randint(3, 5)):
        transactions.append(FinancialTransaction(
            id=_generate_id("tx"),
            sender=account_id,
            receiver=random.choice(merchants),
            amount=random.choice([200, 500, 850, 1500, 2500, 3500, 5000]),
            method=TxMethod.UPI,
            timestamp=_now() - timedelta(hours=random.randint(1, 72)),
            velocity_score=round(random.uniform(0.01, 0.08), 2),
            risk_flags=[],
        ))

    # Compute initial risk (should be low for new user)
    cyber_score = round(sum(e.anomaly_score for e in cyber_events) / max(len(cyber_events), 1), 4)
    fin_score = round(sum(t.velocity_score for t in transactions) / max(len(transactions), 1), 4)
    graph_score = round(random.uniform(0.01, 0.05), 4)
    unified = compute_unified_score(cyber_score, fin_score, graph_score)

    risk_event = RiskEvent(
        id=_generate_id("re"),
        account_id=account_id,
        unified_score=unified,
        cyber_score=cyber_score,
        financial_score=fin_score,
        graph_score=graph_score,
        explanation="New account with baseline activity. No suspicious patterns detected.",
        recommended_action="Continue standard monitoring.",
        created_at=_now(),
    )

    return {
        "account_id": account_id,
        "risk_event": risk_event.model_dump(mode="json"),
        "cyber_events": [e.model_dump(mode="json") for e in cyber_events],
        "transactions": [t.model_dump(mode="json") for t in transactions],
        "risk_level": "low",
        "unified_score": unified,
    }


def analyze_email_for_phishing(email_content: str, sender_email: str = "") -> dict:
    """
    Rule-based pre-analysis of email content for phishing indicators.
    Returns structured data for Gemini API prompt enhancement.
    """
    import re

    text_lower = email_content.lower()
    indicators = []
    risk_score = 0.0

    # Urgency language
    urgency = ["immediately", "urgent", "act now", "expires today", "last chance",
               "hurry", "limited time", "within 24 hours", "account suspended",
               "verify immediately", "action required"]
    for word in urgency:
        if word in text_lower:
            indicators.append(f"urgency_language: '{word}'")
            risk_score += 0.12
            break

    # Suspicious links
    urls = re.findall(r'https?://[^\s<>"]+', email_content)
    suspicious_domains = ["bit.ly", "tinyurl", "goo.gl", "t.co", ".xyz", ".tk", ".ml", ".ga"]
    for url in urls:
        for domain in suspicious_domains:
            if domain in url.lower():
                indicators.append(f"suspicious_url: {url}")
                risk_score += 0.2
                break

    # PII/credential requests
    pii_words = ["otp", "pin", "password", "cvv", "card number", "bank account",
                 "aadhaar", "pan number", "social security", "login credentials",
                 "verify your identity", "confirm your details"]
    for word in pii_words:
        if word in text_lower:
            indicators.append(f"credential_request: '{word}'")
            risk_score += 0.2
            break

    # Impersonation of known entities
    impersonation = ["reserve bank", "rbi", "sbi", "hdfc", "icici", "axis bank",
                     "government of india", "income tax", "kyc update", "uidai",
                     "paypal", "amazon", "flipkart", "google pay"]
    for word in impersonation:
        if word in text_lower:
            indicators.append(f"impersonation: '{word}'")
            risk_score += 0.15
            break

    # Threat language
    threats = ["blocked", "suspended", "deactivated", "legal action", "arrest",
               "penalty", "fine", "terminated", "closed permanently"]
    for word in threats:
        if word in text_lower:
            indicators.append(f"threat_language: '{word}'")
            risk_score += 0.18
            break

    # Reward/prize scams
    rewards = ["won", "winner", "prize", "reward", "cashback", "lottery", "jackpot",
               "congratulations", "selected", "free gift"]
    for word in rewards:
        if word in text_lower:
            indicators.append(f"reward_scam: '{word}'")
            risk_score += 0.1
            break

    # Spoofed sender check
    if sender_email:
        sender_lower = sender_email.lower()
        # Check for common spoofing patterns
        spoofed_patterns = ["noreply", "support", "security", "admin", "helpdesk"]
        free_mail = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com"]
        for pattern in spoofed_patterns:
            if pattern in sender_lower:
                for free in free_mail:
                    if free in sender_lower:
                        indicators.append(f"spoofed_sender: official name on free email ({sender_email})")
                        risk_score += 0.15
                        break

    # Attachment mentions
    attachment_words = ["attachment", "attached file", "download", "open the file",
                       "see attached", "invoice attached", "document attached"]
    for word in attachment_words:
        if word in text_lower:
            indicators.append(f"suspicious_attachment_reference: '{word}'")
            risk_score += 0.1
            break

    risk_score = min(risk_score, 1.0)
    is_phishing = risk_score >= 0.35

    return {
        "is_phishing": is_phishing,
        "risk_score": round(risk_score, 2),
        "indicators": indicators,
        "indicator_count": len(indicators),
        "summary": f"{'LIKELY PHISHING' if is_phishing else 'APPEARS SAFE'} — {len(indicators)} indicator(s) detected.",
    }
