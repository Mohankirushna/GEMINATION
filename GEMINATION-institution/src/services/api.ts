/* ── SurakshaFlow API Service Layer ─────────────────────────
 * PRODUCTION HARDCODED VERSION
 * Backend: https://gemination.onrender.com
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

/* 🔥 HARDCODED BACKEND BASE */
const BASE = "https://gemination.onrender.com/api";

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

export const fetchAlerts = (status?: string) =>
  request<Alert[]>(
    `/dashboard/bank/alerts${status ? `?status=${status}` : ""}`,
  );

export const fetchAlertDetail = (alertId: string) =>
  request<Alert>(`/dashboard/bank/alert/${alertId}`);

export const performAccountAction = (
  alertId: string,
  action: string,
  reason?: string,
) =>
  request(`/dashboard/bank/alert/${alertId}/action`, {
    method: "POST",
    body: JSON.stringify({ action, reason: reason ?? "" }),
  });

/* ── User Dashboard ──────────────────────────────────────── */

export const fetchUserRisk = (accountId: string) =>
  request<UserRiskResponse>(`/dashboard/user/${accountId}/risk`);

export const fetchUserEvents = (accountId: string) =>
  request<{ cyber_events: any[]; financial_transactions: any[] }>(
    `/dashboard/user/${accountId}/events`,
  );

/* ── Graph Intelligence ──────────────────────────────────── */

export const fetchGraphData = () =>
  request<GraphData>("/graph/network");

export const fetchCluster = (accountId: string, hops = 2) =>
  request<GraphData>(`/graph/cluster/${accountId}?depth=${hops}`);

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
  request<STRReportResult>(`/str/generate/${alertId}`, {
    method: "POST",
  });

export const getSTRDownloadUrl = (reportId: string) =>
  `${BASE}/str/download/${reportId}`;

/* ── Digital Twin Simulation ─────────────────────────────── */

export const runSimulation = (accountId?: string) =>
  request<SimulationResult>("/simulation/digital-twin", {
    method: "POST",
    body: JSON.stringify({ account_to_freeze: accountId ?? "acc_A" }),
  });

/* ── Demo Controls ───────────────────────────────────────── */

export const seedDemo = () =>
  request("/demo/seed", { method: "POST" });

export const runScenario = () =>
  request("/demo/run-scenario", { method: "POST" });

/* ── Live Simulation (poll every 5s) ─────────────────────── */

export const fetchLiveEvent = () =>
  request("/simulation/live-event");

/* ── User Live Simulation ────────────────────────────────── */

export const fetchUserLiveEvent = (accountId: string) =>
  request(`/simulation/user-event/${accountId}`);

/* ── New User Data ───────────────────────────────────────── */

export const generateUserData = (accountId: string, email = "") =>
  request("/user/generate-data", {
    method: "POST",
    body: JSON.stringify({ account_id: accountId, email }),
  });

/* ── Email Phishing Analysis ─────────────────────────────── */

export const analyzeEmail = (
  emailContent: string,
  senderEmail = "",
  subject = "",
) =>
  request("/gemini/analyze-email", {
    method: "POST",
    body: JSON.stringify({
      email_content: emailContent,
      sender_email: senderEmail,
      subject,
    }),
  });
