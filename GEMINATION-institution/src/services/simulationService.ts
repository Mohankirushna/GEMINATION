/**
 * SurakshaFlow — Live Simulation Hook
 * Polls the backend every 15 seconds for dynamic ML/non-ML events.
 * Updates dashboard state in real-time.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchLiveEvent, type LiveEvent } from "./api";

const POLL_INTERVAL = 15000; // 15 seconds (4 calls/min to stay under 5/min rate limit)

export interface SimulationState {
  isRunning: boolean;
  currentEvent: LiveEvent | null;
  eventHistory: LiveEvent[];
  riskTrend: Array<{ time: string; risk: number; alerts?: number }>;
  liveAlerts: any[];
  error: string | null;
  totalTicks: number;
  highRiskCount: number;
  transactionsMonitored: number;
  activeMuleRings: number;
}

export function useSimulation(autoStart: boolean = true) {
  const [state, setState] = useState<SimulationState>({
    isRunning: false,
    currentEvent: null,
    eventHistory: [],
    riskTrend: [],
    liveAlerts: [],
    error: null,
    totalTicks: 0,
    highRiskCount: 0,
    transactionsMonitored: 0,
    activeMuleRings: 0,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEvent = useCallback(async () => {
    try {
      const event = await fetchLiveEvent();

      setState((prev) => {
        const newHistory = [event, ...prev.eventHistory].slice(0, 50); // Keep last 50
        const newAlerts = event.alert
          ? [
              {
                id: event.alert.id,
                timestamp: event.alert.created_at,
                accountId:
                  event.alert.accounts_flagged?.[0] || event.alert.id,
                accounts_flagged: event.alert.accounts_flagged,
                unifiedRiskScore: event.alert.unified_risk_score,
                unified_risk_score: event.alert.unified_risk_score,
                cyberEvents: (event.alert.cyber_events || []).map(
                  (e: any) => ({
                    id: e.id,
                    timestamp: e.timestamp,
                    type: e.event_type || e.type || "login",
                    event_type: e.event_type,
                    deviceId: e.device_id || e.deviceId || "",
                    device_id: e.device_id,
                    ipLocation: e.ip_geo || e.ipLocation || "",
                    ip_geo: e.ip_geo,
                    accountId: e.account_id || e.accountId || "",
                    account_id: e.account_id,
                    riskScore: e.anomaly_score || e.riskScore || 0,
                    anomaly_score: e.anomaly_score,
                    raw_signals: e.raw_signals,
                  })
                ),
                financialTransactions: (
                  event.alert.financial_transactions || []
                ).map((t: any) => ({
                  id: t.id,
                  timestamp: t.timestamp,
                  senderId: t.sender || t.senderId || "",
                  sender: t.sender,
                  receiverId: t.receiver || t.receiverId || "",
                  receiver: t.receiver,
                  amount: t.amount || 0,
                  type: t.method || t.type || "upi",
                  method: t.method,
                  riskScore: t.velocity_score || t.riskScore || 0,
                  velocity_score: t.velocity_score,
                  risk_flags: t.risk_flags,
                })),
                status: event.alert.status || "new",
                severity: event.alert.severity,
                geminiExplanation: event.alert.gemini_explanation,
                gemini_explanation: event.alert.gemini_explanation,
                recommendedAction: event.alert.recommended_action,
                recommended_action: event.alert.recommended_action,
                created_at: event.alert.created_at,
                // Include Gemini analysis if available
                gemini_analysis: event.gemini_analysis,
              },
              ...prev.liveAlerts,
            ].slice(0, 30)
          : prev.liveAlerts;

        const newHighRisk =
          prev.highRiskCount +
          (event.risk_scores.unified_score >= 0.7 ? 1 : 0);
        const newTxnCount = prev.transactionsMonitored + 1;

        // Count unique mule ring patterns
        const flaggedSets = newAlerts
          .filter((a: any) => a.unifiedRiskScore >= 0.7)
          .map((a: any) => a.accounts_flagged || [])
          .filter((f: string[]) => f.length >= 3);
        const muleRings = Math.max(
          Math.ceil(flaggedSets.length / 2),
          prev.activeMuleRings
        );

        return {
          ...prev,
          isRunning: true,
          currentEvent: event,
          eventHistory: newHistory,
          riskTrend: event.risk_trend || prev.riskTrend,
          liveAlerts: newAlerts,
          error: null,
          totalTicks: prev.totalTicks + 1,
          highRiskCount: newHighRisk,
          transactionsMonitored: newTxnCount,
          activeMuleRings: muleRings || 1,
        };
      });
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        error: err?.message || "Simulation fetch failed",
      }));
    }
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current) return;
    // Fetch immediately, then every 5 seconds
    fetchEvent();
    intervalRef.current = setInterval(fetchEvent, POLL_INTERVAL);
    setState((prev) => ({ ...prev, isRunning: true }));
  }, [fetchEvent]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  const toggle = useCallback(() => {
    if (intervalRef.current) {
      stop();
    } else {
      start();
    }
  }, [start, stop]);

  useEffect(() => {
    if (autoStart) {
      start();
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoStart, start]);

  return {
    ...state,
    start,
    stop,
    toggle,
  };
}
