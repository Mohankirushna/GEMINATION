"""
SurakshaFlow — Structured Gemini Prompts
Improved prompts for explainable AI analysis with clear reasoning chains.
"""
from __future__ import annotations

from typing import List, Dict, Any


def build_explainability_prompt(
    tick: int,
    scenario_type: str,
    unified_score: float,
    cyber_score: float,
    financial_score: float,
    graph_score: float,
    changes: List[str],
    cyber_event: Dict[str, Any],
    transaction: Dict[str, Any],
    alert_data: Dict[str, Any],
) -> str:
    """
    Build a comprehensive, structured prompt for Gemini API that produces
    explainable risk analysis with clear reasoning chains.
    """
    
    # Determine risk category based on scores
    if unified_score >= 0.8:
        risk_category = "CRITICAL"
        risk_description = "Immediate action required - potential money laundering or fraud in progress"
    elif unified_score >= 0.7:
        risk_category = "HIGH"
        risk_description = "Elevated risk requiring urgent investigation"
    else:
        risk_category = "MODERATE"
        risk_description = "Unusual activity detected, monitoring recommended"
    
    # Parse event details
    event_type = cyber_event.get("event_type", "unknown")
    account_id = cyber_event.get("account_id", "unknown")
    device_id = cyber_event.get("device_id", "unknown")
    ip_geo = cyber_event.get("ip_geo", "unknown")
    anomaly_score = cyber_event.get("anomaly_score", 0)
    raw_signals = cyber_event.get("raw_signals", {})
    
    # Parse transaction details
    sender = transaction.get("sender", "unknown")
    receiver = transaction.get("receiver", "unknown")
    amount = transaction.get("amount", 0)
    method = transaction.get("method", "unknown")
    velocity_score = transaction.get("velocity_score", 0)
    risk_flags = transaction.get("risk_flags", [])
    
    # Parse alert details
    accounts_flagged = alert_data.get("accounts_flagged", []) if alert_data else []
    severity = alert_data.get("severity", "low") if alert_data else "low"
    
    prompt = f"""You are an expert Anti-Money Laundering (AML) and Cyber-Financial Intelligence Analyst at a major Indian bank.

Your task is to analyze the following real-time security alert and provide a structured, explainable risk assessment.

═══════════════════════════════════════════════════════════════════
                    ALERT SUMMARY (Tick #{tick})
═══════════════════════════════════════════════════════════════════

📊 RISK CLASSIFICATION: {risk_category}
   • Unified Risk Score: {unified_score:.2f} / 1.0
   • Cyber Risk Score: {cyber_score:.2f}
   • Financial Risk Score: {financial_score:.2f}
   • Graph Intelligence Score: {graph_score:.2f}
   • Assessment: {risk_description}

🔍 SCENARIO TYPE: {scenario_type.upper()}

📋 FLAGGED ACCOUNTS: {', '.join(accounts_flagged) if accounts_flagged else 'None'}
   • Severity Level: {severity.upper()}

═══════════════════════════════════════════════════════════════════
                    DETECTED ANOMALIES
═══════════════════════════════════════════════════════════════════

{chr(10).join(f"   • {change}" for change in changes) if changes else "   • No specific changes detected"}

═══════════════════════════════════════════════════════════════════
                    CYBER SECURITY EVENT
═══════════════════════════════════════════════════════════════════

   Event Type: {event_type}
   Account ID: {account_id}
   Device ID: {device_id}
   Location: {ip_geo}
   Anomaly Score: {anomaly_score:.2f}
   
   Raw Signals:
{chr(10).join(f"      - {k}: {v}" for k, v in raw_signals.items()) if raw_signals else "      - None recorded"}

═══════════════════════════════════════════════════════════════════
                    FINANCIAL TRANSACTION
═══════════════════════════════════════════════════════════════════

   Amount: ₹{amount:,}
   Method: {method.upper()}
   Sender: {sender}
   Receiver: {receiver}
   Velocity Score: {velocity_score:.2f}
   Risk Flags: {', '.join(risk_flags) if risk_flags else 'None'}

═══════════════════════════════════════════════════════════════════
                    ANALYSIS FRAMEWORK
═══════════════════════════════════════════════════════════════════

You must analyze this alert using the following structured approach:

1️⃣  PATTERN RECOGNITION
    - Identify the money laundering/fraud typology (e.g., Layering, Structuring, Account Takeover)
    - Explain how the cyber and financial signals correlate
    - Describe the temporal sequence of events

2️⃣  RISK INDICATOR ANALYSIS
    - For each detected change, explain WHY it is suspicious
    - Quantify the risk contribution of each indicator
    - Cross-reference with known AML typologies

3️⃣  REGULATORY CONTEXT
    - Reference applicable RBI guidelines (PMLA 2002, RBI Master Direction on KYC)
    - Mention FATF recommendations if relevant
    - Note STR (Suspicious Transaction Report) requirements

4️⃣  IMPACT ASSESSMENT
    - Estimate potential financial loss if action is not taken
    - Assess reputational risk to the bank
    - Evaluate systemic risk (network effects)

5️⃣  ACTIONABLE RECOMMENDATIONS
    - Immediate steps (next 1-4 hours)
    - Short-term actions (next 24 hours)
    - Long-term monitoring strategy

═══════════════════════════════════════════════════════════════════
                    OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════

Respond ONLY as a valid JSON object with this exact structure:

{{
  "explanation": {{
    "summary": "2-3 sentence executive summary of the threat",
    "pattern_type": "Name of detected money laundering/fraud pattern",
    "reasoning_chain": [
      "Step 1: Observation of signal X...",
      "Step 2: Correlation with signal Y...",
      "Step 3: Pattern matching to known typology...",
      "Step 4: Risk scoring justification..."
    ],
    "risk_factors": [
      {{
        "factor": "Name of risk indicator",
        "severity": "high|medium|low",
        "contribution": "How this factor impacts the overall score",
        "evidence": "Specific data point supporting this factor"
      }}
    ]
  }},
  "recommendation": {{
    "immediate_action": "What to do in the next 1-4 hours",
    "short_term": "Actions for next 24 hours",
    "long_term": "Ongoing monitoring strategy",
    "justification": "Why these actions are appropriate for this risk level"
  }},
  "regulatory": {{
    "compliance_frameworks": ["PMLA 2002", "RBI Master Direction", etc.],
    "str_required": true|false,
    "str_urgency": "immediate|24_hours|72_hours|none",
    "reporting_obligations": ["FIU-IND", "RBI", etc.],
    "documentation_needed": ["List of evidence to preserve"]
  }},
  "confidence": {{
    "overall_score": 0.0 to 1.0,
    "explanation": "Why this confidence level is assigned",
    "uncertainty_factors": ["Any gaps in data or analysis"]
  }},
  "key_indicators": [
    "List of primary risk indicators detected"
  ],
  "accounts_to_freeze": [
    "Account IDs requiring immediate freeze"
  ],
  "accounts_to_monitor": [
    "Account IDs requiring enhanced monitoring"
  ]
}}

═══════════════════════════════════════════════════════════════════
                    CONSTRAINTS
═══════════════════════════════════════════════════════════════════

• Be specific - cite exact account IDs, amounts, and timestamps
• Be actionable - every recommendation must have a clear owner
• Be compliant - follow RBI/FIU-IND reporting guidelines
• Be concise - avoid generic statements, focus on THIS specific alert
• Confidence score must reflect data quality and pattern clarity

Provide your analysis now."""

    return prompt


def build_user_explainability_prompt_v2(
    tick: int,
    account_id: str,
    unified_score: float,
    cyber_score: float,
    financial_score: float,
    changes: List[str],
    warnings: List[Dict[str, Any]],
    cyber_event: Dict[str, Any],
    transaction: Dict[str, Any],
) -> str:
    """
    Build a user-friendly explainability prompt that translates technical
    security alerts into clear, actionable guidance for end users.
    """
    
    # Determine user-friendly risk level
    if unified_score >= 0.7:
        user_risk_level = "HIGH"
        user_message = "We've detected suspicious activity that requires your immediate attention"
    elif unified_score >= 0.4:
        user_risk_level = "MEDIUM"
        user_message = "We've noticed some unusual activity on your account"
    else:
        user_risk_level = "LOW"
        user_message = "Your account security is being monitored"
    
    event_type = cyber_event.get("event_type", "unknown")
    ip_geo = cyber_event.get("ip_geo", "unknown")
    device_id = cyber_event.get("device_id", "unknown")
    amount = transaction.get("amount", 0)
    receiver = transaction.get("receiver", "unknown")
    
    warnings_text = ""
    for w in warnings:
        warnings_text += f"\n   ⚠️  {w['severity'].upper()}: {w['title']}\n      {w['detail']}\n"
    
    prompt = f"""You are a friendly, helpful security assistant for SurakshaFlow, an Indian banking security app.

Your job is to explain a security alert to a regular person (not a technical expert) in simple, reassuring language.

═══════════════════════════════════════════════════════════════════
                    SECURITY ALERT (Event #{tick})
═══════════════════════════════════════════════════════════════════

👤 Account: {account_id}
🔒 Risk Level: {user_risk_level}
📊 Security Score: {(1 - unified_score) * 100:.0f}% Safe / {unified_score * 100:.0f}% At Risk

📝 Message: {user_message}

═══════════════════════════════════════════════════════════════════
                    WHAT HAPPENED
═══════════════════════════════════════════════════════════════════

{chr(10).join(f"   • {change}" for change in changes) if changes else "   • No unusual activity detected"}

═══════════════════════════════════════════════════════════════════
                    DETAILED WARNINGS
═══════════════════════════════════════════════════════════════════
{warnings_text if warnings_text else "   No specific warnings issued."}

═══════════════════════════════════════════════════════════════════
                    TECHNICAL DETAILS (For Reference)
═══════════════════════════════════════════════════════════════════

   Event Type: {event_type}
   Location: {ip_geo}
   Device: {device_id}
   Transaction: ₹{amount:,} to {receiver}
   Cyber Risk: {cyber_score:.2f}
   Financial Risk: {cyber_score:.2f}

═══════════════════════════════════════════════════════════════════
                    YOUR TASK
═══════════════════════════════════════════════════════════════════

Explain this security event to the user in simple, non-technical language:

1. 🤔 WHAT HAPPENED?
   - Describe the event in 2-3 simple sentences
   - Explain why it triggered an alert (without jargon)
   - Reassure if it's likely normal behavior (travel, new phone, etc.)

2. ⚠️ HOW SERIOUS IS THIS?
   - Use one of: "SAFE" / "CAUTION" / "DANGEROUS"
   - Explain what each level means
   - Be honest but not alarmist

3. ✅ WHAT SHOULD I DO?
   - Provide 3-5 clear, step-by-step actions
   - Start with the most important action
   - Include "if this was you..." vs "if this wasn't you..." guidance

4. 🛡️ HOW TO STAY SAFE
   - 2-3 simple prevention tips
   - Focus on practical, actionable advice

5. 📞 DO I NEED TO CALL THE BANK?
   - Clear yes/no answer
   - If yes, explain what to tell them
   - If no, explain how to resolve yourself

═══════════════════════════════════════════════════════════════════
                    OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════

Respond ONLY as valid JSON:

{{
  "explanation": {{
    "what_happened": "Simple description in plain English",
    "why_flagged": "Why our system noticed this",
    "likely_scenarios": [
      "If this was you traveling...",
      "If this was a new device...",
      "If this wasn't you..."
    ]
  }},
  "urgency": "safe|caution|dangerous",
  "urgency_explanation": "What this level means for the user",
  "confidence": {{
    "score": 0.0 to 1.0,
    "explanation": "How sure we are about this assessment"
  }},
  "steps_to_take": [
    {{
      "priority": 1,
      "action": "Clear action to take",
      "why": "Why this helps",
      "if_legitimate": "What to do if this was you",
      "if_fraud": "What to do if this wasn't you"
    }}
  ],
  "prevention_tips": [
    "Practical tip 1",
    "Practical tip 2",
    "Practical tip 3"
  ],
  "should_contact_bank": true|false,
  "contact_reason": "What to tell bank if calling",
  "self_resolution": "How to fix without calling (if possible)",
  "reassurance": "Reassuring closing message"
}}

═══════════════════════════════════════════════════════════════════
                    TONE GUIDELINES
═══════════════════════════════════════════════════════════════════

• Be friendly but professional
• Use "we" and "your" (we're protecting you together)
• Avoid: algorithms, ML, AI, velocity scores, anomaly detection
• Use: patterns, unusual activity, security checks, monitoring
• Always provide hope - even dangerous alerts can be resolved
• Never blame the user - focus on helping them

Provide your explanation now."""

    return prompt
