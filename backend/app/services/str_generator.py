"""
SurakshaFlow — STR (Suspicious Transaction Report) Generator
Generates PDF reports for regulatory compliance.
"""
from __future__ import annotations

import io
import uuid
from datetime import datetime
from typing import Optional

from fpdf import FPDF


def _safe_text(text: str) -> str:
    """Sanitize text for fpdf's latin-1 encoding."""
    replacements = {
        "\u2014": "--",   # em dash
        "\u2013": "-",    # en dash
        "\u2018": "'",    # left single quote
        "\u2019": "'",    # right single quote
        "\u201c": '"',    # left double quote
        "\u201d": '"',    # right double quote
        "\u2026": "...",  # ellipsis
        "\u20b9": "Rs.",  # rupee sign
        "\u2022": "*",    # bullet
    }
    for char, repl in replacements.items():
        text = text.replace(char, repl)
    # Strip any remaining non-latin-1 characters
    return text.encode("latin-1", errors="replace").decode("latin-1")


def generate_str_pdf(
    alert_data: dict,
    account_id: str,
    score_details: Optional[dict] = None,
    gemini_explanation: str = "",
) -> bytes:
    """
    Generate a Suspicious Transaction Report as PDF.

    Returns: bytes of the PDF file
    """
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # ── Header ────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(26, 26, 46)
    pdf.cell(0, 12, _safe_text("SUSPICIOUS TRANSACTION REPORT"), new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100, 100, 120)
    pdf.cell(0, 6, "SurakshaFlow - Unified Cyber-Financial Intelligence Platform", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.cell(0, 6, f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}", new_x="LMARGIN", new_y="NEXT", align="C")

    pdf.ln(8)

    # ── Report Metadata ───────────────────────────────────────
    pdf.set_draw_color(200, 200, 220)
    pdf.set_fill_color(245, 245, 252)
    pdf.rect(10, pdf.get_y(), 190, 30, style="DF")
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(26, 26, 46)

    y = pdf.get_y() + 3
    pdf.set_xy(15, y)
    pdf.cell(90, 6, f"Report ID: STR-{uuid.uuid4().hex[:8].upper()}")
    pdf.set_xy(110, y)
    pdf.cell(90, 6, f"Alert ID: {alert_data.get('id', 'N/A')}")
    pdf.set_xy(15, y + 8)
    pdf.cell(90, 6, f"Account: {account_id}")
    pdf.set_xy(110, y + 8)
    risk_score = alert_data.get("unified_risk_score", 0)
    pdf.cell(90, 6, f"Risk Score: {risk_score:.2f}")
    pdf.set_xy(15, y + 16)
    severity = alert_data.get("severity", "N/A")
    pdf.cell(90, 6, f"Severity: {severity.upper()}")
    pdf.set_xy(110, y + 16)
    pdf.cell(90, 6, f"Status: {alert_data.get('status', 'NEW')}")

    pdf.set_y(y + 35)

    # ── Risk Score Breakdown ──────────────────────────────────
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(26, 26, 46)
    pdf.cell(0, 8, "Risk Score Breakdown", new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(100, 100, 200)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(3)

    if score_details:
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(50, 50, 70)
        for label, key in [
            ("Cyber Risk Score", "cyber_score"),
            ("Financial Risk Score", "financial_score"),
            ("Graph Intelligence Score", "graph_score"),
            ("Unified Risk Score", "unified_score"),
        ]:
            val = score_details.get(key, "N/A")
            pdf.cell(0, 6, _safe_text(f"  {label}: {val}"), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)

    # ── Cyber Events ──────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(26, 26, 46)
    pdf.cell(0, 8, "Cyber Events", new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(100, 100, 200)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(3)

    cyber_events = alert_data.get("cyber_events", [])
    if cyber_events:
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(50, 50, 70)
        for ev in cyber_events:
            event_type = ev.get("event_type", ev.get("type", "unknown"))
            device = ev.get("device_id", "N/A")
            location = ev.get("ip_geo", ev.get("ipLocation", "N/A"))
            score = ev.get("anomaly_score", ev.get("riskScore", 0))
            ts = ev.get("timestamp", "N/A")
            pdf.cell(0, 5, _safe_text(f"  [{ts}] {event_type} -- Device: {device}, Location: {location}, Anomaly: {score}"), new_x="LMARGIN", new_y="NEXT")
    else:
        pdf.set_font("Helvetica", "I", 10)
        pdf.cell(0, 6, "  No cyber events recorded.", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(4)

    # ── Financial Transactions ────────────────────────────────
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(26, 26, 46)
    pdf.cell(0, 8, "Financial Transactions", new_x="LMARGIN", new_y="NEXT")
    pdf.set_draw_color(100, 100, 200)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(3)

    txns = alert_data.get("financial_transactions", [])
    if txns:
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(50, 50, 70)
        for tx in txns:
            sender = tx.get("sender", tx.get("senderId", "N/A"))
            receiver = tx.get("receiver", tx.get("receiverId", "N/A"))
            amount = tx.get("amount", 0)
            method = tx.get("method", tx.get("type", "N/A"))
            ts = tx.get("timestamp", "N/A")
            pdf.cell(0, 5, _safe_text(f"  [{ts}] Rs.{amount:,.0f} {str(method).upper()} -- {sender} -> {receiver}"), new_x="LMARGIN", new_y="NEXT")
    else:
        pdf.set_font("Helvetica", "I", 10)
        pdf.cell(0, 6, "  No financial transactions recorded.", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(4)

    # ── AI Analysis ───────────────────────────────────────────
    if gemini_explanation:
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(26, 26, 46)
        pdf.cell(0, 8, "AI-Generated Analysis (Gemini)", new_x="LMARGIN", new_y="NEXT")
        pdf.set_draw_color(100, 100, 200)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(3)

        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(50, 50, 70)
        pdf.multi_cell(0, 5, _safe_text(gemini_explanation))
        pdf.ln(4)

    # ── Recommended Action ────────────────────────────────────
    rec_action = alert_data.get("recommended_action", "")
    if rec_action:
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(200, 50, 50)
        pdf.cell(0, 8, "Recommended Action", new_x="LMARGIN", new_y="NEXT")
        pdf.set_draw_color(200, 50, 50)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(3)

        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(50, 50, 70)
        pdf.multi_cell(0, 5, _safe_text(rec_action))
        pdf.ln(4)

    # ── Footer ────────────────────────────────────────────────
    pdf.set_y(-30)
    pdf.set_font("Helvetica", "I", 8)
    pdf.set_text_color(150, 150, 170)
    pdf.cell(0, 5, "This report is auto-generated by SurakshaFlow for regulatory compliance purposes.", new_x="LMARGIN", new_y="NEXT", align="C")
    pdf.cell(0, 5, "Confidential - Do not distribute without authorization.", align="C")

    return pdf.output()
