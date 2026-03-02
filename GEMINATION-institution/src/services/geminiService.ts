import { GoogleGenAI } from '@google/genai';
import { Alert } from '../types';

let ai: GoogleGenAI | null = null;

export const getGeminiService = () => {
  if (!ai) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('VITE_GEMINI_API_KEY is not set. Explainable AI will not work.');
      return null;
    }
    ai = new GoogleGenAI({ apiKey: apiKey });
  }
  return ai;
};

export const generateAlertExplanation = async (alert: Alert): Promise<{ explanation: string; recommendation: string }> => {
  const service = getGeminiService();
  if (!service) {
    // Rule-based fallback when Gemini is not configured
    return generateFallbackExplanation(alert);
  }

  const prompt = `You are an expert Cyber-Financial Intelligence Analyst.
Analyze the following alert data and provide a concise explanation of the risk and a recommended action.

Alert ID: ${alert.id}
Unified Risk Score: ${alert.unifiedRiskScore}

Cyber Events:
${alert.cyberEvents.map(e => `- ${e.type} from device ${e.deviceId} at ${e.ipLocation} (Risk: ${e.riskScore})`).join('\n')}

Financial Transactions:
${alert.financialTransactions.map(t => `- ${t.amount} ${t.type} from ${t.senderId} to ${t.receiverId} (Risk: ${t.riskScore})`).join('\n')}

Format your response as a valid JSON object with exactly two keys:
{
  "explanation": "A 1-2 sentence explanation of why this is suspicious (e.g., mule network, account takeover).",
  "recommendation": "A specific, actionable recommendation for the financial institution."
}

Respond ONLY with the JSON object, no other text.`;

  try {
    const response = await service.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    if (response.text) {
      // Clean the response text (remove any markdown code blocks if present)
      let cleanText = response.text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const result = JSON.parse(cleanText);
      return {
        explanation: result.explanation || 'No explanation provided.',
        recommendation: result.recommendation || 'No recommendation provided.',
      };
    }
  } catch (error: any) {
    console.error('Gemini API Error:', {
      message: error.message,
      status: error.status,
      details: error.errorDetails,
    });
    return {
      explanation: `Error: ${error.message || 'Unable to connect to Gemini API'}`,
      recommendation: 'Manual review required.',
    };
  }

  return {
    explanation: 'Failed to generate explanation.',
    recommendation: 'Manual review required.',
  };
};

/**
 * Rule-based fallback when Gemini API is unavailable.
 * Generates meaningful explanations based on alert data.
 */
function generateFallbackExplanation(alert: Alert): { explanation: string; recommendation: string } {
  const indicators: string[] = [];
  const score = alert.unifiedRiskScore ?? 0;

  // Analyze cyber events
  if (alert.cyberEvents?.length) {
    const deviceIds = new Set(alert.cyberEvents.map(e => e.deviceId));
    if (deviceIds.size === 1 && alert.cyberEvents.length > 1) {
      indicators.push('single device accessing multiple accounts');
    }
    const types = alert.cyberEvents.map(e => e.type?.toLowerCase() ?? '');
    if (types.some(t => t.includes('impossible_travel'))) indicators.push('impossible travel detected');
    if (types.some(t => t.includes('phishing'))) indicators.push('phishing activity observed');
    if (types.some(t => t.includes('new_device'))) indicators.push('login from a new device');
  }

  // Analyze financial transactions
  if (alert.financialTransactions?.length) {
    const totalAmount = alert.financialTransactions.reduce((s, t) => s + (t.amount ?? 0), 0);
    const uniqueReceivers = new Set(alert.financialTransactions.map(t => t.receiverId));
    if (uniqueReceivers.size >= 3) indicators.push(`rapid fund distribution to ${uniqueReceivers.size} accounts`);
    if (totalAmount > 50000) indicators.push(`high-value transfers totalling ₹${totalAmount.toLocaleString()}`);
  }

  // Determine level and recommendation
  let level: string, recommendation: string;
  if (score >= 0.8) {
    level = 'Critical';
    recommendation = 'Immediately freeze flagged accounts and file STR.';
  } else if (score >= 0.6) {
    level = 'High';
    recommendation = 'Escalate to compliance team for urgent review and consider temporary hold.';
  } else if (score >= 0.4) {
    level = 'Medium';
    recommendation = 'Continue monitoring and gather additional evidence before action.';
  } else {
    level = 'Low';
    recommendation = 'Log for periodic review. No immediate action required.';
  }

  const explanation = `${level} risk alert (score: ${score.toFixed(2)}). ${
    indicators.length
      ? 'Key findings: ' + indicators.join('; ') + '.'
      : 'Multiple risk signals detected across flagged accounts.'
  } (Analysis via rule-based engine)`;

  return { explanation, recommendation };
}
