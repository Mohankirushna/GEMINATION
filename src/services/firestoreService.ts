/**
 * SurakshaFlow — Firestore Persistence & Real-time Listeners
 * Provides hooks for real-time Firestore data with graceful fallback to REST API.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  setDoc,
  getDoc,
  getDocs,
  Unsubscribe,
  Timestamp,
  QueryConstraint,
} from "firebase/firestore";
import { getDbInstance, isFirebaseConfigured } from "./firebase";
import type { Alert, DashboardSummary, UserRiskResponse } from "../types";

// ── Check if Firestore is available ──────────────────────────

function getDb() {
  if (!isFirebaseConfigured()) return null;
  return getDbInstance();
}

// ── Real-time Alert Feed ─────────────────────────────────────

export function useRealtimeAlerts(statusFilter?: string) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = getDb();
    if (!db) {
      setLoading(false);
      setError("firestore_unavailable");
      return;
    }

    const constraints: QueryConstraint[] = [
      orderBy("created_at", "desc"),
      limit(50),
    ];

    if (statusFilter) {
      constraints.unshift(where("status", "==", statusFilter));
    }

    const q = query(collection(db, "alerts"), ...constraints);

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((d) => normalizeAlert(d.id, d.data()));
        setAlerts(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn("Firestore alerts listener error:", err.message);
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, [statusFilter]);

  return { alerts, loading, error, isRealtime: error === null };
}

// ── Real-time Dashboard Summary ──────────────────────────────

export function useRealtimeSummary() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = getDb();
    if (!db) {
      setLoading(false);
      setError("firestore_unavailable");
      return;
    }

    // Listen to the alerts collection aggregate
    const q = query(collection(db, "alerts"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const alerts = snapshot.docs.map((d) => d.data());
        const totalAlerts = alerts.length;
        const highRisk = alerts.filter(
          (a) =>
            a.severity === "high" ||
            a.severity === "critical" ||
            (a.unified_risk_score ?? 0) >= 0.7,
        ).length;
        const muleRings = alerts.filter(
          (a) => (a.accounts_flagged ?? []).length >= 3,
        ).length;

        setSummary({
          total_alerts: totalAlerts,
          high_risk_count: highRisk,
          transactions_monitored: 0, // will be enriched by REST call
          active_mule_rings: Math.max(muleRings, 1),
          risk_trend: [],
        });
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn("Firestore summary listener error:", err.message);
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, []);

  return { summary, loading, error, isRealtime: error === null };
}

// ── Real-time User Risk ──────────────────────────────────────

export function useRealtimeUserRisk(accountId: string) {
  const [risk, setRisk] = useState<UserRiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const db = getDb();
    if (!db) {
      setLoading(false);
      setError("firestore_unavailable");
      return;
    }

    // Listen to the risk_events document for this account
    const q = query(
      collection(db, "risk_events"),
      where("account_id", "==", accountId),
      orderBy("created_at", "desc"),
      limit(1),
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const data = snapshot.docs[0].data();
          setRisk({
            account_id: data.account_id ?? accountId,
            unified_score: data.unified_score ?? 0,
            cyber_score: data.cyber_score ?? 0,
            financial_score: data.financial_score ?? 0,
            graph_score: data.graph_score ?? 0,
            risk_level:
              data.unified_score >= 0.7
                ? "high"
                : data.unified_score >= 0.4
                  ? "medium"
                  : "low",
            explanation: data.explanation,
            recommended_action: data.recommended_action,
          });
        }
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn("Firestore user risk listener error:", err.message);
        setError(err.message);
        setLoading(false);
      },
    );

    return unsub;
  }, [accountId]);

  return { risk, loading, error, isRealtime: error === null };
}

// ── Seed Data to Firestore ───────────────────────────────────

export async function seedDemoDataToFirestore(): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    // Call the backend seed endpoint which will also push to Firestore
    const res = await fetch("/api/demo/seed", { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Normalize Firestore doc → frontend Alert type ────────────

function normalizeAlert(id: string, data: any): Alert {
  return {
    id,
    timestamp: data.created_at ?? new Date().toISOString(),
    accountId: data.accounts_flagged?.[0] ?? id,
    accounts_flagged: data.accounts_flagged ?? [],
    unifiedRiskScore: data.unified_risk_score ?? 0,
    unified_risk_score: data.unified_risk_score,
    cyberEvents: (data.cyber_events ?? []).map((e: any) => ({
      id: e.id ?? "",
      timestamp: e.timestamp ?? "",
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
    })),
    financialTransactions: (data.financial_transactions ?? []).map(
      (t: any) => ({
        id: t.id ?? "",
        timestamp: t.timestamp ?? "",
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
      }),
    ),
    status: data.status ?? "new",
    severity: data.severity,
    geminiExplanation: data.gemini_explanation,
    gemini_explanation: data.gemini_explanation,
    recommendedAction: data.recommended_action,
    recommended_action: data.recommended_action,
    created_at: data.created_at,
    risk_breakdown: data.risk_breakdown,
  };
}
