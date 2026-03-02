/* ── SurakshaFlow API Service Layer ─────────────────────────
 * All calls go through the Vite dev-proxy  /api → localhost:8000
 * In production, set VITE_API_URL to the real base.
 * ─────────────────────────────────────────────────────────── */
import type {
  Alert,
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

/* ── Bank Dashboard ──────────────────────────────────────── */
export const fetchBankSummary = () =>
  request<DashboardSummary>("/dashboard/bank/summary");

export const fetchAlerts = (status?: string) => {
  const q = status ? `?status=${status}` : "";
  return request<Alert[]>(`/dashboard/bank/alerts${q}`);
};

export const fetchAlertDetail = (alertId: string) =>
  request<Alert>(`/dashboard/bank/alert/${alertId}`);

export const performAccountAction = (
  alertId: string,
  action: string,
  reason?: string,
) =>
  request<{ status: string; message: string }>(`/dashboard/bank/action`, {
    method: "POST",
    body: JSON.stringify({ alert_id: alertId, action, reason }),
  });

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
    body: JSON.stringify({ message }),
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
    body: JSON.stringify(accountId ? { account_id: accountId } : {}),
  });

/* ── Demo ────────────────────────────────────────────────── */
export const seedDemo = () =>
  request<{ status: string }>("/demo/seed", { method: "POST" });

export const runScenario = () =>
  request<{ status: string }>("/demo/run-scenario", { method: "POST" });
