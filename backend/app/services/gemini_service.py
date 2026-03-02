"""
SurakshaFlow — Gemini AI Service (Backend)
Generates explainable risk analysis and SMS scam detection.
Includes caching and rate limiting.
"""
from __future__ import annotations

import hashlib
import json
import time
from typing import Optional

from google import genai
from google.genai import types

from ..config import GEMINI_API_KEY, ENABLE_GEMINI
from ..models import Alert, GeminiExplanation, SMSAnalysisResult

# ── Rate Limiter ───────────────────────────────────────────────
_call_timestamps: list[float] = []
MAX_CALLS_PER_MINUTE = 10

# ── Cache ──────────────────────────────────────────────────────
_explanation_cache: dict[str, GeminiExplanation] = {}

# ── Client ─────────────────────────────────────────────────────
_client: Optional[genai.Client] = None


def _get_client() -> Optional[genai.Client]:
    """Lazy-initialize Gemini client."""
    global _client
    if not ENABLE_GEMINI or not GEMINI_API_KEY:
        return None
    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)
    return _client


def _rate_limit_check() -> bool:
    """Return True if we can make another call, False if rate-limited."""
    global _call_timestamps
    now = time.time()
    _call_timestamps = [t for t in _call_timestamps if now - t < 60]
    return len(_call_timestamps) < MAX_CALLS_PER_MINUTE


def _record_call():
    _call_timestamps.append(time.time())


def _cache_key(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()[:16]


async def generate_alert_explanation(
    alert: Alert,
    score_details: Optional[dict] = None,
) -> GeminiExplanation:
    """
    Generate an explainable AI analysis for a high-risk alert.
    Uses caching to avoid duplicate API calls.
    """
    # Build the prompt
    prompt_parts = []

    prompt_parts.append("You are an expert Cyber-Financial Intelligence Analyst.")
    prompt_parts.append("Analyze the following alert and provide a concise, actionable explanation.\n")

    # Cyber Signals
    prompt_parts.append("Cyber Signals:")
    if alert.cyber_events:
        for e in alert.cyber_events:
            prompt_parts.append(
                f"  - {e.event_type.value}: device {e.device_id} at {e.ip_geo} "
                f"(anomaly: {e.anomaly_score})"
            )
    else:
        prompt_parts.append("  No cyber events recorded.")

    # Financial Patterns
    prompt_parts.append("\nFinancial Patterns:")
    if alert.financial_transactions:
        for t in alert.financial_transactions:
            prompt_parts.append(
                f"  - ₹{t.amount:,.0f} {t.method.value.upper()} from {t.sender} → {t.receiver}"
            )
    else:
        prompt_parts.append("  No financial transactions recorded.")

    # Score breakdown
    if score_details:
        prompt_parts.append(f"\nGraph Metrics:")
        prompt_parts.append(f"  Cyber Score: {score_details.get('cyber_score', 'N/A')}")
        prompt_parts.append(f"  Financial Score: {score_details.get('financial_score', 'N/A')}")
        prompt_parts.append(f"  Graph Score: {score_details.get('graph_score', 'N/A')}")
        prompt_parts.append(f"  Unified Score: {score_details.get('unified_score', alert.unified_risk_score)}")

    prompt_parts.append(f"\nUnified Risk Score: {alert.unified_risk_score}")

    prompt_parts.append("""
Task:
1. Explain why this account is high risk.
2. Provide a recommended action for a bank compliance officer.
3. List key risk indicators.

Constraints:
- Be concise (2-3 sentences for explanation)
- Be actionable
- No speculation — only cite observed signals
- Estimate your confidence (0.0 to 1.0)

Respond ONLY as a JSON object:
{
  "explanation": "...",
  "recommendation": "...",
  "confidence": 0.0,
  "key_indicators": ["indicator1", "indicator2"]
}""")

    full_prompt = "\n".join(prompt_parts)

    # Check cache
    key = _cache_key(full_prompt)
    if key in _explanation_cache:
        return _explanation_cache[key]

    # Rate limit check
    if not _rate_limit_check():
        return GeminiExplanation(
            explanation="Rate limit reached. Please try again in a moment.",
            recommendation="Wait 60 seconds before requesting another analysis.",
            confidence=0.0,
            key_indicators=["rate_limited"],
        )

    client = _get_client()
    if not client:
        return GeminiExplanation(
            explanation="Gemini API not configured. Unable to generate explanation.",
            recommendation="Configure GEMINI_API_KEY in backend environment.",
            confidence=0.0,
            key_indicators=["api_not_configured"],
        )

    try:
        _record_call()
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=full_prompt,
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

            data = json.loads(clean_text.strip())
            result = GeminiExplanation(
                explanation=data.get("explanation", "No explanation provided."),
                recommendation=data.get("recommendation", "Manual review required."),
                confidence=float(data.get("confidence", 0.7)),
                key_indicators=data.get("key_indicators", []),
            )
            _explanation_cache[key] = result
            return result

    except Exception as e:
        return GeminiExplanation(
            explanation=f"Error generating explanation: {str(e)}",
            recommendation="Manual review required.",
            confidence=0.0,
            key_indicators=["api_error"],
        )

    return GeminiExplanation(
        explanation="Failed to generate explanation.",
        recommendation="Manual review required.",
        confidence=0.0,
        key_indicators=["unknown_error"],
    )


async def analyze_sms(sms_text: str) -> SMSAnalysisResult:
    """Analyze an SMS message for scam indicators using Gemini."""
    prompt = f"""You are a cybersecurity expert specializing in phishing and financial scam detection.

Analyze this SMS message and determine if it's a scam:

"{sms_text}"

Consider:
- Urgency language ("act now", "immediate")
- Suspicious links or shortened URLs
- Request for personal/financial information
- Impersonation of banks/government
- Grammar/spelling patterns typical of scams
- Reward/prize claims
- Threat language

Respond ONLY as JSON:
{{
  "is_scam": true/false,
  "confidence": 0.0 to 1.0,
  "explanation": "Brief explanation",
  "risk_indicators": ["indicator1", "indicator2"]
}}"""

    client = _get_client()
    if not client:
        return SMSAnalysisResult(
            is_scam=False,
            confidence=0.0,
            explanation="Gemini API not configured.",
            risk_indicators=["api_not_configured"],
        )

    if not _rate_limit_check():
        return SMSAnalysisResult(
            is_scam=False,
            confidence=0.0,
            explanation="Rate limited. Try again shortly.",
            risk_indicators=["rate_limited"],
        )

    try:
        _record_call()
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
            if clean_text.startswith("```"):
                clean_text = clean_text.split("\n", 1)[-1]
            if clean_text.endswith("```"):
                clean_text = clean_text[:-3]

            data = json.loads(clean_text.strip())
            return SMSAnalysisResult(
                is_scam=bool(data.get("is_scam", False)),
                confidence=float(data.get("confidence", 0.5)),
                explanation=data.get("explanation", "Unable to determine."),
                risk_indicators=data.get("risk_indicators", []),
            )

    except Exception as e:
        return SMSAnalysisResult(
            is_scam=False,
            confidence=0.0,
            explanation=f"Error: {str(e)}",
            risk_indicators=["api_error"],
        )

    return SMSAnalysisResult(
        is_scam=False,
        confidence=0.0,
        explanation="Analysis failed.",
        risk_indicators=["unknown_error"],
    )
