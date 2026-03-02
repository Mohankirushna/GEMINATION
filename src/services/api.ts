/* ── SurakshaFlow API Service Layer ─────────────────────────
 * All calls go through the Vite dev-proxy  /api → localhost:8000
 * In production, set VITE_API_URL to the real base.
 * ─────────────────────────────────────────────────────────── */
import type {
  Alert,
  CyberEvent,
  FinancialTransaction,
  DashboardSummary,
  GraphData,
  UserRiskResponse,
  GeminiExplanation,
  SMSAnalysisResult,
  SimulationResult,
  STRReportResult,
} from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "/api";

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(opts?.headers as Record<string, string>),
    },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/* ── Normalization helpers (snake_case API → camelCase frontend) ── */

function normalizeCyberEvent(e: any): CyberEvent {
  return {
    id: e.id,
    timestamp: e.timestamp,
    type: e.event_type ?? e.type ?? "login",
    event_type: e.event_type,
    deviceId: e.device_id ?? e.deviceId ?? "",
    device_id: e.device_id,
    ipLocation: e.ip_geo ?? e.ipLocation ?? "",
    ip_geo: e.ip_geo,
    accountId: e.account_id ?? e.accountId ?? "",
    account_id: e.account_id,
    riskScore: e.anomaly_score ?? e.riskScore ?? 0,
    anomaly_score: e.anomaly_score,
    raw_signals: e.raw_signals,
  };
}

function normalizeTransaction(t: any): FinancialTransaction {
  return {
    id: t.id,
    timestamp: t.timestamp,
    senderId: t.sender ?? t.senderId ?? "",
    sender: t.sender,
    receiverId: t.receiver ?? t.receiverId ?? "",
    receiver: t.receiver,
    amount: t.amount ?? 0,
    type: t.method ?? t.type ?? "upi",
    method: t.method,
    riskScore: t.velocity_score ?? t.riskScore ?? 0,
    velocity_score: t.velocity_score,
    risk_flags: t.risk_flags,
  };
}

function normalizeAlert(a: any): Alert {
  return {
    id: a.id,
    timestamp: a.created_at ?? a.timestamp ?? new Date().toISOString(),
    accountId: a.accounts_flagged?.[0] ?? a.accountId ?? a.id,
    accounts_flagged: a.accounts_flagged,
    unifiedRiskScore: a.unified_risk_score ?? a.unifiedRiskScore ?? 0,
    unified_risk_score: a.unified_risk_score,
    cyberEvents: (a.cyber_events ?? a.cyberEvents ?? []).map(
      normalizeCyberEvent,
    ),
    cyber_events: a.cyber_events,
    financialTransactions: (
      a.financial_transactions ??
      a.financialTransactions ??
      []
    ).map(normalizeTransaction),
    financial_transactions: a.financial_transactions,
    status: a.status ?? "new",
    severity: a.severity,
    geminiExplanation: a.gemini_explanation ?? a.geminiExplanation,
    gemini_explanation: a.gemini_explanation,
    recommendedAction: a.recommended_action ?? a.recommendedAction,
    recommended_action: a.recommended_action,
    created_at: a.created_at,
    risk_breakdown: a.risk_breakdown,
  };
}

/* ── Bank Dashboard ──────────────────────────────────────── */
export const fetchBankSummary = () =>
  request<DashboardSummary>("/dashboard/bank/summary");

export const fetchAlerts = async (status?: string): Promise<Alert[]> => {
  const q = status ? `?status=${status}` : "";
  const raw = await request<any[]>(`/dashboard/bank/alerts${q}`);
  return raw.map(normalizeAlert);
};

export const fetchAlertDetail = async (alertId: string): Promise<Alert> => {
  const raw = await request<any>(`/dashboard/bank/alert/${alertId}`);
  return normalizeAlert(raw);
};

export const performAccountAction = (
  alertId: string,
  action: string,
  reason?: string,
) =>
  request<{ success: boolean; message: string }>(
    `/dashboard/bank/alert/${alertId}/action`,
    {
      method: "POST",
      body: JSON.stringify({ action, reason: reason ?? "" }),
    },
  );

/* ── User Dashboard ──────────────────────────────────────── */
export const fetchUserRisk = (accountId: string) =>
  request<UserRiskResponse>(`/dashboard/user/${accountId}/risk`);

export const fetchUserEvents = (accountId: string) =>
  request<{ cyber_events: any[]; financial_transactions: any[] }>(
    `/dashboard/user/${accountId}/events`,
  );

/* ── Graph Intelligence ──────────────────────────────────── */
export const fetchGraphData = () => request<GraphData>("/graph/network");

export const fetchCluster = (accountId: string, hops = 2) =>
  request<GraphData>(`/graph/cluster/${accountId}?hops=${hops}`);

/* ── Gemini AI ───────────────────────────────────────────── */
export const explainAlert = (alertId: string) =>
  request<GeminiExplanation>("/gemini/explain", {
    method: "POST",
    body: JSON.stringify({ alert_id: alertId }),
  });

export const analyzeSMS = (message: string) =>
  request<SMSAnalysisResult>("/gemini/analyze-sms", {
    method: "POST",
    body: JSON.stringify({ text: message }),
  });

/* ── STR Report ──────────────────────────────────────────── */
export const generateSTR = (alertId: string) =>
  request<STRReportResult>(`/str/generate/${alertId}`, { method: "POST" });

export const getSTRDownloadUrl = (reportId: string) =>
  `${BASE}/str/download/${reportId}`;

/* ── Digital Twin Simulation ─────────────────────────────── */
export const runSimulation = (accountId?: string) =>
  request<SimulationResult>("/simulation/digital-twin", {
    method: "POST",
    body: JSON.stringify({ account_to_freeze: accountId ?? "acc_A" }),
  });

/* ── Demo ────────────────────────────────────────────────── */
export const seedDemo = () =>
  request<{ status: string }>("/demo/seed", { method: "POST" });

export const runScenario = () =>
  request<{ status: string }>("/demo/run-scenario", { method: "POST" });

/* ── Live Simulation (polls every 5 seconds) ─────────────── */
export interface LiveEvent {
  tick: number;
  timestamp: string;
  scenario_type: "money_laundering" | "clean";
  is_suspicious: boolean;
  cyber_event: any;
  transaction: any;
  risk_scores: {
    cyber_score: number;
    financial_score: number;
    graph_score: number;
    unified_score: number;
  };
  changes: string[];
  alert: any | null;
  risk_trend: Array<{ time: string; risk: number; alerts?: number }>;
  gemini_prompt: string | null;
  requires_gemini: boolean;
  gemini_analysis?: {
    explanation: string;
    recommendation: string;
    confidence: number;
    key_indicators: string[];
    regulatory_references?: string[];
    immediate_steps?: string[];
    accounts_to_freeze?: string[];
    str_required?: boolean;
  };
}

export const fetchLiveEvent = () =>
  request<LiveEvent>("/simulation/live-event");

/* ── New User Data Generation ────────────────────────────── */
export const generateUserData = (accountId: string, email: string = "") =>
  request<any>("/user/generate-data", {
    method: "POST",
    body: JSON.stringify({ account_id: accountId, email }),
  });

/* ── Email Phishing Analysis ─────────────────────────────── */
export interface EmailAnalysisResult {
  is_phishing: boolean;
  confidence: number;
  explanation: string;
  risk_indicators: string[];
  recommended_action: string;
  threat_type: string;
  analysis_source: string;
}

export const analyzeEmail = (emailContent: string, senderEmail: string = "", subject: string = "") =>
  request<EmailAnalysisResult>("/gemini/analyze-email", {
    method: "POST",
    body: JSON.stringify({ email_content: emailContent, sender_email: senderEmail, subject }),
  });
