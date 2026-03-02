"""
SurakshaFlow — Demo Scenario Definitions
Defines attack chain scenarios for demo/seeding purposes.
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import List

from ..models import (
    Alert,
    AlertStatus,
    CyberEvent,
    EventType,
    FinancialTransaction,
    RiskEvent,
    Severity,
    TxMethod,
    User,
    UserRole,
)

# ── Base timestamp for scenario ────────────────────────────────
_NOW = datetime.utcnow()


def _t(minutes_ago: int) -> datetime:
    """Helper: returns datetime N minutes ago from now."""
    return _NOW - timedelta(minutes=minutes_ago)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SCENARIO 1: Full Mule Ring Attack Chain
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def generate_users() -> List[User]:
    """Generate demo user accounts."""
    return [
        User(id="victim_1", role=UserRole.END_USER, email="victim1@demo.com",
             display_name="Priya Sharma", linked_accounts=["acc_victim_1"], risk_level=0.2),
        User(id="victim_2", role=UserRole.END_USER, email="victim2@demo.com",
             display_name="Raj Patel", linked_accounts=["acc_victim_2"], risk_level=0.15),
        User(id="mule_a", role=UserRole.END_USER, email="mule_a@demo.com",
             display_name="Anil Kumar", linked_accounts=["acc_A"], risk_level=0.85),
        User(id="mule_b", role=UserRole.END_USER, email="mule_b@demo.com",
             display_name="Sunita Devi", linked_accounts=["acc_B"], risk_level=0.88),
        User(id="mule_c", role=UserRole.END_USER, email="mule_c@demo.com",
             display_name="Vikram Singh", linked_accounts=["acc_C"], risk_level=0.82),
        User(id="mule_d", role=UserRole.END_USER, email="mule_d@demo.com",
             display_name="Pooja Reddy", linked_accounts=["acc_D"], risk_level=0.78),
        User(id="kingpin_1", role=UserRole.END_USER, email="kingpin@demo.com",
             display_name="Unknown Entity", linked_accounts=["acc_kingpin"], risk_level=0.99),
        User(id="bank_analyst", role=UserRole.INSTITUTION, email="analyst@demobank.com",
             display_name="Demo Bank Analyst", linked_accounts=[], risk_level=0.0),
        User(id="clean_user_1", role=UserRole.END_USER, email="clean1@demo.com",
             display_name="Meera Gupta", linked_accounts=["acc_clean_1"], risk_level=0.05),
        User(id="clean_user_2", role=UserRole.END_USER, email="clean2@demo.com",
             display_name="Arjun Nair", linked_accounts=["acc_clean_2"], risk_level=0.08),
    ]


def generate_cyber_events() -> List[CyberEvent]:
    """Generate the full attack chain cyber events."""
    return [
        # ── Stage 1: Phishing SMS sent (T-30 min) ────────────
        CyberEvent(
            id="ce_01", account_id="acc_victim_1", device_id="dev_victim_phone",
            event_type=EventType.PHISHING, ip_geo="Mumbai, IN",
            timestamp=_t(30), anomaly_score=0.6,
            raw_signals={"phishing_link": "https://fake-bank-login.xyz/verify", "sms_content": "Your account is blocked. Click to verify."},
        ),
        # ── Stage 2: New device login on victim account ───────
        CyberEvent(
            id="ce_02", account_id="acc_victim_1", device_id="dev_8891",
            event_type=EventType.NEW_DEVICE, ip_geo="Mumbai, IN",
            timestamp=_t(28), anomaly_score=0.75,
            raw_signals={"user_agent": "Android/Chrome", "device_fingerprint": "fp_8891_xxx"},
        ),
        # ── Stage 3: Same device accesses Mule A ─────────────
        CyberEvent(
            id="ce_03", account_id="acc_A", device_id="dev_8891",
            event_type=EventType.LOGIN, ip_geo="Mumbai, IN",
            timestamp=_t(26), anomaly_score=0.85,
            raw_signals={"rapid_switch": True},
        ),
        # ── Stage 4: Same device accesses Mule B ─────────────
        CyberEvent(
            id="ce_04", account_id="acc_B", device_id="dev_8891",
            event_type=EventType.LOGIN, ip_geo="Mumbai, IN",
            timestamp=_t(25), anomaly_score=0.88,
            raw_signals={"rapid_switch": True, "same_session": True},
        ),
        # ── Stage 5: Same device accesses Mule C ─────────────
        CyberEvent(
            id="ce_05", account_id="acc_C", device_id="dev_8891",
            event_type=EventType.LOGIN, ip_geo="Mumbai, IN",
            timestamp=_t(24), anomaly_score=0.9,
            raw_signals={"rapid_switch": True, "accounts_in_session": 3},
        ),
        # ── Stage 6: Impossible travel — Delhi login ─────────
        CyberEvent(
            id="ce_06", account_id="acc_C", device_id="dev_8891",
            event_type=EventType.IMPOSSIBLE_TRAVEL, ip_geo="Delhi, IN",
            timestamp=_t(22), anomaly_score=0.95,
            raw_signals={"origin": "Mumbai, IN", "destination": "Delhi, IN", "time_diff_min": 2},
        ),
        # ── Stage 7: Mule D accessed from different device ───
        CyberEvent(
            id="ce_07", account_id="acc_D", device_id="dev_3345",
            event_type=EventType.NEW_DEVICE, ip_geo="Bengaluru, IN",
            timestamp=_t(20), anomaly_score=0.7,
            raw_signals={"vpn_detected": True},
        ),
        # ── Additional: victim_2 also phished ────────────────
        CyberEvent(
            id="ce_08", account_id="acc_victim_2", device_id="dev_victim2_phone",
            event_type=EventType.PHISHING, ip_geo="Chennai, IN",
            timestamp=_t(35), anomaly_score=0.55,
            raw_signals={"phishing_link": "https://fake-bank-login.xyz/verify2"},
        ),
        CyberEvent(
            id="ce_09", account_id="acc_victim_2", device_id="dev_8891",
            event_type=EventType.NEW_DEVICE, ip_geo="Chennai, IN",
            timestamp=_t(32), anomaly_score=0.72,
            raw_signals={},
        ),
        # ── Clean user activity (for contrast) ───────────────
        CyberEvent(
            id="ce_10", account_id="acc_clean_1", device_id="dev_clean_1",
            event_type=EventType.LOGIN, ip_geo="Pune, IN",
            timestamp=_t(45), anomaly_score=0.05,
            raw_signals={},
        ),
        CyberEvent(
            id="ce_11", account_id="acc_clean_2", device_id="dev_clean_2",
            event_type=EventType.LOGIN, ip_geo="Hyderabad, IN",
            timestamp=_t(40), anomaly_score=0.08,
            raw_signals={},
        ),
    ]


def generate_financial_transactions() -> List[FinancialTransaction]:
    """Generate the full layering transaction chain."""
    return [
        # ── Clean legitimate transactions (baseline) ─────────
        FinancialTransaction(
            id="tx_clean_01", sender="acc_clean_1", receiver="merchant_grocery",
            amount=850, method=TxMethod.UPI, timestamp=_t(120), velocity_score=0.05,
        ),
        FinancialTransaction(
            id="tx_clean_02", sender="acc_clean_2", receiver="merchant_fuel",
            amount=2500, method=TxMethod.UPI, timestamp=_t(90), velocity_score=0.08,
        ),
        FinancialTransaction(
            id="tx_clean_03", sender="acc_clean_1", receiver="acc_clean_2",
            amount=5000, method=TxMethod.NEFT, timestamp=_t(60), velocity_score=0.1,
        ),

        # ── Victim 1 → Mule A (initial fund capture) ────────
        FinancialTransaction(
            id="tx_01", sender="acc_victim_1", receiver="acc_A",
            amount=50000, method=TxMethod.UPI, timestamp=_t(20),
            velocity_score=0.7, risk_flags=["unusual_amount", "new_beneficiary"],
        ),
        # ── Victim 2 → Mule A (second victim) ───────────────
        FinancialTransaction(
            id="tx_02", sender="acc_victim_2", receiver="acc_A",
            amount=35000, method=TxMethod.UPI, timestamp=_t(19),
            velocity_score=0.75, risk_flags=["unusual_amount", "rapid_succession"],
        ),

        # ── Mule A → Mule B (layering - split 1) ────────────
        FinancialTransaction(
            id="tx_03", sender="acc_A", receiver="acc_B",
            amount=25000, method=TxMethod.UPI, timestamp=_t(18),
            velocity_score=0.85, risk_flags=["rapid_transfer", "splitting"],
        ),
        # ── Mule A → Mule C (layering - split 2) ────────────
        FinancialTransaction(
            id="tx_04", sender="acc_A", receiver="acc_C",
            amount=25000, method=TxMethod.UPI, timestamp=_t(18),
            velocity_score=0.85, risk_flags=["rapid_transfer", "splitting"],
        ),
        # ── Mule A → Mule D (layering - split 3) ────────────
        FinancialTransaction(
            id="tx_05", sender="acc_A", receiver="acc_D",
            amount=20000, method=TxMethod.IMPS, timestamp=_t(17),
            velocity_score=0.82, risk_flags=["rapid_transfer", "splitting"],
        ),
        # ── Mule A → Mule B (second layer) ──────────────────
        FinancialTransaction(
            id="tx_06", sender="acc_A", receiver="acc_B",
            amount=15000, method=TxMethod.IMPS, timestamp=_t(16),
            velocity_score=0.88, risk_flags=["repeat_transfer", "velocity_spike"],
        ),

        # ── Mule B → Kingpin (consolidation) ────────────────
        FinancialTransaction(
            id="tx_07", sender="acc_B", receiver="acc_kingpin",
            amount=38000, method=TxMethod.IMPS, timestamp=_t(14),
            velocity_score=0.92, risk_flags=["consolidation", "rapid_withdrawal"],
        ),
        # ── Mule C → Kingpin (consolidation) ────────────────
        FinancialTransaction(
            id="tx_08", sender="acc_C", receiver="acc_kingpin",
            amount=24000, method=TxMethod.IMPS, timestamp=_t(13),
            velocity_score=0.9, risk_flags=["consolidation"],
        ),
        # ── Mule D → Kingpin (consolidation) ────────────────
        FinancialTransaction(
            id="tx_09", sender="acc_D", receiver="acc_kingpin",
            amount=19000, method=TxMethod.NEFT, timestamp=_t(12),
            velocity_score=0.88, risk_flags=["consolidation"],
        ),

        # ── Additional small transactions to obscure trail ───
        FinancialTransaction(
            id="tx_10", sender="acc_B", receiver="merchant_online",
            amount=2000, method=TxMethod.UPI, timestamp=_t(15),
            velocity_score=0.3, risk_flags=["obfuscation"],
        ),
        FinancialTransaction(
            id="tx_11", sender="acc_C", receiver="merchant_recharge",
            amount=500, method=TxMethod.UPI, timestamp=_t(14),
            velocity_score=0.2,
        ),
    ]


def generate_alerts() -> List[Alert]:
    """Generate pre-built alerts for the demo."""
    cyber_events = generate_cyber_events()
    transactions = generate_financial_transactions()

    return [
        # ── High-risk alert: Mule Ring detected ──────────────
        Alert(
            id="alert_001",
            institution_id="inst_default",
            accounts_flagged=["acc_A", "acc_B", "acc_C", "acc_D", "acc_kingpin"],
            severity=Severity.CRITICAL,
            status=AlertStatus.NEW,
            unified_risk_score=0.92,
            cyber_events=[e for e in cyber_events if e.account_id in ("acc_A", "acc_B", "acc_C")],
            financial_transactions=[t for t in transactions if t.sender in ("acc_A", "acc_B", "acc_C", "acc_D")],
            gemini_explanation="Multiple accounts accessed from single device (dev_8891) within 4 minutes, followed by rapid fund layering across 4 intermediary accounts converging to a single endpoint (acc_kingpin). Classic mule network pattern with phishing-initiated account takeover.",
            recommended_action="Immediately freeze acc_A (primary mule). Flag acc_B, acc_C, acc_D for investigation. File STR for acc_kingpin. Notify victim_1 and victim_2 of potential compromise.",
            created_at=_t(10),
        ),
        # ── Medium-risk alert: Single suspicious transfer ────
        Alert(
            id="alert_002",
            institution_id="inst_default",
            accounts_flagged=["acc_victim_1"],
            severity=Severity.MEDIUM,
            status=AlertStatus.INVESTIGATING,
            unified_risk_score=0.55,
            cyber_events=[e for e in cyber_events if e.account_id == "acc_victim_1"],
            financial_transactions=[t for t in transactions if t.sender == "acc_victim_1"],
            gemini_explanation="",
            recommended_action="",
            created_at=_t(25),
        ),
        # ── Low-risk: clean user activity ────────────────────
        Alert(
            id="alert_003",
            institution_id="inst_default",
            accounts_flagged=["acc_clean_1"],
            severity=Severity.LOW,
            status=AlertStatus.RESOLVED,
            unified_risk_score=0.15,
            cyber_events=[e for e in cyber_events if e.account_id == "acc_clean_1"],
            financial_transactions=[t for t in transactions if t.sender == "acc_clean_1"],
            gemini_explanation="",
            recommended_action="",
            created_at=_t(50),
        ),
        # ── High-risk alert: Victim 2 compromise ────────────
        Alert(
            id="alert_004",
            institution_id="inst_default",
            accounts_flagged=["acc_victim_2", "acc_A"],
            severity=Severity.HIGH,
            status=AlertStatus.NEW,
            unified_risk_score=0.78,
            cyber_events=[e for e in cyber_events if e.account_id == "acc_victim_2"],
            financial_transactions=[t for t in transactions if t.sender == "acc_victim_2"],
            gemini_explanation="Account acc_victim_2 was accessed from a new device (dev_8891) — the same device linked to confirmed mule accounts. Funds were transferred to acc_A immediately after the unauthorized login.",
            recommended_action="Freeze acc_victim_2. Contact account holder for verification. Cross-reference with Alert #001.",
            created_at=_t(18),
        ),
    ]


def generate_risk_events() -> List[RiskEvent]:
    """Generate pre-computed risk events for all accounts."""
    return [
        RiskEvent(id="re_victim_1", account_id="acc_victim_1", unified_score=0.35,
                  cyber_score=0.45, financial_score=0.3, graph_score=0.1,
                  explanation="Moderate risk due to phishing attempt and unusual device login.",
                  recommended_action="Monitor account activity.", created_at=_t(20)),
        RiskEvent(id="re_victim_2", account_id="acc_victim_2", unified_score=0.42,
                  cyber_score=0.5, financial_score=0.35, graph_score=0.15,
                  explanation="Second victim in the mule ring.", created_at=_t(19)),
        RiskEvent(id="re_mule_a", account_id="acc_A", unified_score=0.92,
                  cyber_score=0.88, financial_score=0.9, graph_score=0.95,
                  explanation="Primary mule account receiving funds from multiple victims and distributing to sub-mules.",
                  recommended_action="Freeze immediately.", created_at=_t(15)),
        RiskEvent(id="re_mule_b", account_id="acc_B", unified_score=0.85,
                  cyber_score=0.82, financial_score=0.85, graph_score=0.88,
                  explanation="Sub-mule receiving layered funds and forwarding to kingpin.",
                  recommended_action="Freeze and investigate.", created_at=_t(14)),
        RiskEvent(id="re_mule_c", account_id="acc_C", unified_score=0.87,
                  cyber_score=0.9, financial_score=0.82, graph_score=0.85,
                  explanation="Sub-mule with impossible travel anomaly.",
                  recommended_action="Freeze and investigate.", created_at=_t(13)),
        RiskEvent(id="re_mule_d", account_id="acc_D", unified_score=0.78,
                  cyber_score=0.7, financial_score=0.8, graph_score=0.75,
                  explanation="Peripheral mule accessed via VPN.",
                  recommended_action="Flag for investigation.", created_at=_t(12)),
        RiskEvent(id="re_kingpin", account_id="acc_kingpin", unified_score=0.99,
                  cyber_score=0.3, financial_score=0.95, graph_score=1.0,
                  explanation="Terminal node receiving consolidated funds from entire mule network.",
                  recommended_action="Freeze. File STR. Escalate to law enforcement.", created_at=_t(10)),
        RiskEvent(id="re_clean_1", account_id="acc_clean_1", unified_score=0.05,
                  cyber_score=0.02, financial_score=0.05, graph_score=0.01,
                  explanation="Normal account activity.", created_at=_t(50)),
        RiskEvent(id="re_clean_2", account_id="acc_clean_2", unified_score=0.08,
                  cyber_score=0.03, financial_score=0.08, graph_score=0.02,
                  explanation="Normal account activity.", created_at=_t(40)),
    ]


def get_risk_trend_data() -> list[dict]:
    """Generate risk trend data points for the last 30 minutes."""
    return [
        {"time": "10:00", "risk": 0.12, "alerts": 0},
        {"time": "10:02", "risk": 0.15, "alerts": 0},
        {"time": "10:05", "risk": 0.22, "alerts": 1},
        {"time": "10:08", "risk": 0.45, "alerts": 1},
        {"time": "10:10", "risk": 0.68, "alerts": 2},
        {"time": "10:12", "risk": 0.82, "alerts": 3},
        {"time": "10:15", "risk": 0.95, "alerts": 4},
        {"time": "10:18", "risk": 0.92, "alerts": 4},
        {"time": "10:20", "risk": 0.88, "alerts": 4},
        {"time": "10:22", "risk": 0.75, "alerts": 3},
        {"time": "10:25", "risk": 0.55, "alerts": 2},
        {"time": "10:28", "risk": 0.42, "alerts": 2},
        {"time": "10:30", "risk": 0.35, "alerts": 1},
    ]
