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
    return {
      explanation: 'Gemini API key not configured. Unable to generate explanation.',
      recommendation: 'Please configure VITE_GEMINI_API_KEY in the environment variables.',
    };
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
