import { GoogleGenAI } from '@google/genai';
import { Alert } from '../types';

let ai: GoogleGenAI | null = null;

export const getGeminiService = () => {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not set. Explainable AI will not work.');
      return null;
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

export const generateAlertExplanation = async (alert: Alert): Promise<{ explanation: string; recommendation: string }> => {
  const service = getGeminiService();
  if (!service) {
    return {
      explanation: 'Gemini API key not configured. Unable to generate explanation.',
      recommendation: 'Please configure GEMINI_API_KEY in the environment variables.',
    };
  }

  const prompt = `
    You are an expert Cyber-Financial Intelligence Analyst.
    Analyze the following alert data and provide a concise explanation of the risk and a recommended action.
    
    Alert ID: ${alert.id}
    Unified Risk Score: ${alert.unifiedRiskScore}
    
    Cyber Events:
    ${alert.cyberEvents.map(e => `- ${e.type} from device ${e.deviceId} at ${e.ipLocation} (Risk: ${e.riskScore})`).join('\n')}
    
    Financial Transactions:
    ${alert.financialTransactions.map(t => `- ${t.amount} ${t.type} from ${t.senderId} to ${t.receiverId} (Risk: ${t.riskScore})`).join('\n')}
    
    Format your response as JSON with two keys:
    - "explanation": A 1-2 sentence explanation of why this is suspicious (e.g., mule network, account takeover).
    - "recommendation": A specific, actionable recommendation for the financial institution.
  `;

  try {
    const response = await service.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      return {
        explanation: result.explanation || 'No explanation provided.',
        recommendation: result.recommendation || 'No recommendation provided.',
      };
    }
  } catch (error) {
    console.error('Error generating explanation:', error);
    return {
      explanation: 'Error generating explanation from Gemini.',
      recommendation: 'Manual review required.',
    };
  }

  return {
    explanation: 'Failed to generate explanation.',
    recommendation: 'Manual review required.',
  };
};
