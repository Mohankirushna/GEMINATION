/**
 * SurakshaFlow — Bank Intelligence Dashboard
 * Dynamic simulation every 5s with ML/non-ML scenarios.
 * Unified risk factor updated dynamically; Gemini explains when > 0.7.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  ShieldAlert,
  AlertTriangle,
  Activity,
  Network,
  Play,
  Pause,
  Eye,
  FileText,
  MapPin,
  Zap,
  Brain,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Download,
  X,
  Clock,
  Radio,
  Snowflake,
  History,
  Calendar,
  IndianRupee,
  Cpu,
  Layers,
  GitBranch,
  Sparkles,
  RefreshCw,
} from "lucide-react";

import GlassCard from "../components/GlassCard";
import AnimatedCounter from "../components/AnimatedCounter";
import RiskBadge, { scoreToBadgeLevel } from "../components/RiskBadge";
import RiskGauge from "../components/RiskGauge";
import { CardSkeleton } from "../components/LoadingSkeleton";

import { useSimulation } from "../services/simulationService";
import {
  fetchAlertDetail,
  performAccountAction,
  explainAlert,
  generateSTR,
  getSTRDownloadUrl,
  runSimulation,
  freezeAccount,
  startSession,
  getSessionHistory,
  fetchMLStatus,
  fetchMLGraphClassification,
  retrainMLModels,
} from "../services/api";
import type { Alert, SimulationResult, GeminiExplanation } from "../types";
import type { FreezeResult, SessionHistory, MLModelStatus, MLGraphClassification } from "../services/api";

/* ────────────── helpers ────────────── */

function riskColor(score: number) {
  if (score >= 0.7) return "text-red-400";
  if (score >= 0.4) return "text-amber-400";
  return "text-emerald-400";
}

function riskBg(score: number) {
  if (score >= 0.7) return "from-red-500/20 to-red-900/10 border-red-500/30";
  if (score >= 0.4)
    return "from-amber-500/20 to-amber-900/10 border-amber-500/30";
  return "from-emerald-500/20 to-emerald-900/10 border-emerald-500/30";
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
}

/* ━━━━━━ MEMOISED ML PANEL (does not re-render on simulation ticks) ━━━━━━ */

const MLInsightsPanel = React.memo(function MLInsightsPanel({
  mlStatus,
  mlGraphClass,
  mlRetraining,
  onRetrain,
  onLoadClassification,
}: {
  mlStatus: MLModelStatus | null;
  mlGraphClass: MLGraphClassification | null;
  mlRetraining: boolean;
  onRetrain: () => void;
  onLoadClassification: () => void;
}) {
  return (
    <GlassCard hover={false} className="border border-purple-500/20">
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            ML &amp; AI Models — Live Status
            {mlStatus ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase font-bold">
                {mlStatus.ml_enabled ? "Models Online" : "Fallback Mode"}
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30 uppercase font-bold animate-pulse">
                Loading…
              </span>
            )}
          </h3>
          <button
            onClick={onRetrain}
            disabled={mlRetraining}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-xs border border-purple-500/20 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${mlRetraining ? "animate-spin" : ""}`} />
            {mlRetraining ? "Retraining…" : "Retrain Models"}
          </button>
        </div>

        {/* Model Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Isolation Forest */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-900/10 border border-violet-500/20 space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-violet-500/20">
                <Layers className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <span className="text-xs font-semibold text-violet-300">Isolation Forest</span>
            </div>
            <p className="text-[10px] text-gray-400">Unsupervised anomaly detection — 200 tree ensemble</p>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">Status</span>
              <span className={`font-semibold ${mlStatus?.fraud_predictor?.trained ? "text-emerald-400" : "text-amber-400"}`}>
                {mlStatus?.fraud_predictor?.trained ? "✓ Trained" : mlStatus ? "Fallback" : "—"}
              </span>
            </div>
            {mlStatus?.fraud_predictor?.metrics?.isolation_forest && (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-500">Anomaly Rate</span>
                <span className="text-violet-300 font-mono">
                  {((mlStatus.fraud_predictor.metrics.isolation_forest.anomaly_rate ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">Samples</span>
              <span className="text-gray-300 font-mono">
                {mlStatus?.fraud_predictor?.metrics?.isolation_forest?.n_samples ?? "—"}
              </span>
            </div>
            {(mlStatus?.fraud_predictor?.metrics?.real_samples ?? 0) > 0 && (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-500">Data Mix</span>
                <span className="text-violet-200 font-mono text-[9px]">
                  {mlStatus?.fraud_predictor?.metrics?.real_samples} real + {mlStatus?.fraud_predictor?.metrics?.synthetic_samples} syn
                </span>
              </div>
            )}
          </div>

          {/* 2. Random Forest + Gradient Boosting */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/10 to-blue-900/10 border border-cyan-500/20 space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/20">
                <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <span className="text-xs font-semibold text-cyan-300">RF + GB Ensemble</span>
            </div>
            <p className="text-[10px] text-gray-400">Supervised fraud classifier — RF (200 trees) + GB (150 trees)</p>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">Status</span>
              <span className={`font-semibold ${mlStatus?.fraud_predictor?.trained ? "text-emerald-400" : "text-amber-400"}`}>
                {mlStatus?.fraud_predictor?.trained ? "✓ Trained" : mlStatus ? "Fallback" : "—"}
              </span>
            </div>
            {mlStatus?.fraud_predictor?.metrics?.classifier && (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-500">AUC-ROC</span>
                <span className="text-cyan-300 font-mono">
                  {(mlStatus.fraud_predictor.metrics.classifier.auc_roc ?? 0).toFixed(3)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">Train / Test</span>
              <span className="text-gray-300 font-mono">
                {mlStatus?.fraud_predictor?.metrics?.classifier
                  ? `${mlStatus.fraud_predictor.metrics.classifier.n_train} / ${mlStatus.fraud_predictor.metrics.classifier.n_test}`
                  : "—"}
              </span>
            </div>
            {(mlStatus?.fraud_predictor?.metrics?.new_real_samples ?? 0) > 0 && (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-500">New Real</span>
                <span className="text-cyan-200 font-mono text-[9px]">
                  +{mlStatus?.fraud_predictor?.metrics?.new_real_samples} accounts
                </span>
              </div>
            )}
          </div>

          {/* 3. Temporal GNN Classifier */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-900/10 border border-amber-500/20 space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/20">
                <Network className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-xs font-semibold text-amber-300">Temporal GNN</span>
            </div>
            <p className="text-[10px] text-gray-400">Graph neural network — mule &amp; kingpin node classification</p>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">Status</span>
              <span className={`font-semibold ${mlStatus?.temporal_gnn?.trained ? "text-emerald-400" : "text-amber-400"}`}>
                {mlStatus?.temporal_gnn?.trained ? "✓ Trained" : mlStatus ? "Fallback" : "—"}
              </span>
            </div>
            {mlStatus?.temporal_gnn?.metrics && (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-500">Accuracy</span>
                <span className="text-amber-300 font-mono">
                  {((mlStatus.temporal_gnn.metrics.accuracy ?? 0) * 100).toFixed(1)}%
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">Samples</span>
              <span className="text-gray-300 font-mono">
                {mlStatus?.temporal_gnn?.metrics?.n_samples ?? "—"}
              </span>
            </div>
            {(mlStatus?.temporal_gnn?.metrics?.real_nodes ?? 0) > 0 && (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-gray-500">Real Nodes</span>
                <span className="text-amber-200 font-mono text-[9px]">
                  {mlStatus?.temporal_gnn?.metrics?.real_nodes} from live graph
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">Classes</span>
              <span className="text-gray-300 text-[9px]">
                {mlStatus?.temporal_gnn?.metrics?.classes?.join(" · ") ?? "—"}
              </span>
            </div>
          </div>

          {/* 4. Gemini AI */}
          <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-900/10 border border-emerald-500/20 space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/20">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="text-xs font-semibold text-emerald-300">Gemini 2.5 Flash</span>
            </div>
            <p className="text-[10px] text-gray-400">LLM-powered alert explanation, SMS &amp; email phishing analysis</p>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">Status</span>
              <span className="text-emerald-400 font-semibold">✓ Active</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">Trigger</span>
              <span className="text-gray-300">Risk &gt; 70%</span>
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-500">Capabilities</span>
              <span className="text-gray-300 text-[9px]">AML · STR · SMS · Email</span>
            </div>
          </div>
        </div>

        {/* ML Graph Classification Summary — loaded on demand */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5">
          <span className="text-xs text-gray-500">Graph ML Classification:</span>
          {mlGraphClass ? (
            <>
              {Object.entries(mlGraphClass.counts).map(([label, count]) => (
                <span
                  key={label}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    label === "kingpin"
                      ? "bg-red-500/20 text-red-300"
                      : label === "mule"
                        ? "bg-amber-500/20 text-amber-300"
                        : label === "victim"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  {label}: {count}
                </span>
              ))}
              <span className="text-[10px] text-gray-600 ml-auto">
                {mlGraphClass.total_nodes} nodes classified
              </span>
            </>
          ) : (
            <button
              onClick={onLoadClassification}
              className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20 transition-colors"
            >
              Run Classification
            </button>
          )}
        </div>

        {/* Risk Scoring Formula */}
        <div className="pt-2 border-t border-white/5">
          <p className="text-[10px] text-gray-500 flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            Unified Score = 0.30 × Cyber + 0.25 × Financial + 0.20 × Graph + 0.25 × ML
            <span className="text-purple-400 ml-1">(when ML available)</span>
          </p>
        </div>
      </div>
    </GlassCard>
  );
});

/* ━━━━━━━━━━━━━ COMPONENT ━━━━━━━━━━━━━ */

export default function BankDashboard() {
  /* ── Simulation hook (polls every 5 s) ── */
  const sim = useSimulation(true);

  /* ── Local UI state ── */
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [geminiResult, setGeminiResult] = useState<GeminiExplanation | null>(
    null
  );
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [strUrl, setStrUrl] = useState<string | null>(null);
  const [strLoading, setStrLoading] = useState(false);
  const [twinResult, setTwinResult] = useState<SimulationResult | null>(null);
  const [twinLoading, setTwinLoading] = useState(false);
  const [showGeminiPanel, setShowGeminiPanel] = useState(true);

  /* ── Session & Filter state ── */
  const [timeFilter, setTimeFilter] = useState<"all" | "daily" | "weekly" | "monthly">("all");
  const [sessionId, setSessionId] = useState("");
  const [sessionStart, setSessionStart] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<SessionHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [freezeResult, setFreezeResult] = useState<FreezeResult | null>(null);

  /* ── ML Model Status ── */
  const [mlStatus, setMlStatus] = useState<MLModelStatus | null>(null);
  const [mlGraphClass, setMlGraphClass] = useState<MLGraphClassification | null>(null);
  const [mlRetraining, setMlRetraining] = useState(false);

  /* ── Start session on mount ── */
  useEffect(() => {
    startSession()
      .then((info) => {
        setSessionId(info.session_id);
        setSessionStart(info.started_at);
      })
      .catch(() => {
        setSessionId(`session_${Date.now().toString(36)}`);
        setSessionStart(new Date().toISOString());
      });
    // Fetch ML model status (lightweight) — graph classification deferred
    fetchMLStatus().then(setMlStatus).catch(() => {});
  }, []);

  const handleLoadClassification = useCallback(async () => {
    try {
      const gc = await fetchMLGraphClassification();
      setMlGraphClass(gc);
    } catch {}
  }, []);

  const handleRetrain = useCallback(async () => {
    setMlRetraining(true);
    try {
      await retrainMLModels();
      const status = await fetchMLStatus();
      setMlStatus(status);
    } catch {}
    setMlRetraining(false);
  }, []);

  /* ── Derived data ── */
  const currentEvent = sim.currentEvent;
  const riskScores = currentEvent?.risk_scores;
  const unifiedScore = riskScores?.unified_score ?? 0;
  const geminiAnalysis = currentEvent?.gemini_analysis;
  const changes = currentEvent?.changes ?? [];

  /* ── Stat cards data ── */
  const stats = useMemo(
    () => [
      {
        label: "Total Alerts",
        value: sim.liveAlerts.length,
        icon: ShieldAlert,
        color: "text-cyan-400",
        glow: "cyan" as const,
      },
      {
        label: "High Risk",
        value: sim.highRiskCount,
        icon: AlertTriangle,
        color: "text-red-400",
        glow: "red" as const,
      },
      {
        label: "Monitored",
        value: sim.transactionsMonitored,
        icon: Activity,
        color: "text-emerald-400",
        glow: "emerald" as const,
      },
      {
        label: "Mule Rings",
        value: sim.activeMuleRings,
        icon: Network,
        color: "text-amber-400",
        glow: "gold" as const,
      },
    ],
    [
      sim.liveAlerts.length,
      sim.highRiskCount,
      sim.transactionsMonitored,
      sim.activeMuleRings,
    ]
  );

  /* ── Alert detail ── */
  const openAlert = useCallback(async (alert: any) => {
    setDetailLoading(true);
    setGeminiResult(null);
    setStrUrl(null);
    setTwinResult(null);
    try {
      const detail = await fetchAlertDetail(alert.id);
      setSelectedAlert(detail);
    } catch {
      // Use the alert object directly if the API doesn't have it
      setSelectedAlert({
        id: alert.id,
        timestamp: alert.timestamp || alert.created_at || new Date().toISOString(),
        accountId: alert.accountId || alert.accounts_flagged?.[0] || alert.id,
        accounts_flagged: alert.accounts_flagged,
        unifiedRiskScore: alert.unifiedRiskScore || alert.unified_risk_score || 0,
        cyberEvents: alert.cyberEvents || [],
        financialTransactions: alert.financialTransactions || [],
        status: alert.status || "new",
        severity: alert.severity,
        geminiExplanation: alert.geminiExplanation || alert.gemini_explanation,
        recommendedAction: alert.recommendedAction || alert.recommended_action,
      });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleExplain = useCallback(async () => {
    if (!selectedAlert) return;
    setGeminiLoading(true);
    try {
      const res = await explainAlert(selectedAlert.id);
      setGeminiResult(res);
    } catch {
      setGeminiResult({
        explanation: "Unable to get AI explanation at this time.",
        recommendation: "Please review the alert manually.",
        confidence: 0,
        key_indicators: [],
      });
    } finally {
      setGeminiLoading(false);
    }
  }, [selectedAlert]);

  const handleSTR = useCallback(async () => {
    if (!selectedAlert) return;
    setStrLoading(true);
    try {
      const res = await generateSTR(selectedAlert.id);
      setStrUrl(getSTRDownloadUrl(res.report_id));
    } catch {
      setStrUrl(null);
    } finally {
      setStrLoading(false);
    }
  }, [selectedAlert]);

  const handleTwin = useCallback(async () => {
    if (!selectedAlert) return;
    setTwinLoading(true);
    try {
      const accountId =
        selectedAlert.accounts_flagged?.[0] || selectedAlert.accountId;
      const res = await runSimulation(accountId);
      setTwinResult(res);
    } catch {
      setTwinResult(null);
    } finally {
      setTwinLoading(false);
    }
  }, [selectedAlert]);

  /* ── Risk trend data for chart ── */
  const riskTrendData = useMemo(() => {
    if (sim.riskTrend.length > 0) return sim.riskTrend;
    return sim.eventHistory
      .slice(0, 20)
      .reverse()
      .map((e, i) => ({
        time: `T${i + 1}`,
        risk: e.risk_scores.unified_score,
        alerts: e.alert ? 1 : 0,
      }));
  }, [sim.riskTrend, sim.eventHistory]);

  /* ── Time-filtered alerts ── */
  const filteredAlerts = useMemo(() => {
    if (timeFilter === "all") return sim.liveAlerts;
    const now = Date.now();
    const cutoffs: Record<string, number> = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };
    const cutoff = now - cutoffs[timeFilter];
    return sim.liveAlerts.filter((a: any) => {
      const ts = new Date(a.timestamp || a.created_at).getTime();
      return ts >= cutoff;
    });
  }, [sim.liveAlerts, timeFilter]);

  /* ── Freeze account handler ── */
  const handleFreeze = useCallback(async () => {
    if (!selectedAlert) return;
    setFreezeLoading(true);
    setFreezeResult(null);
    try {
      const accountId =
        selectedAlert.accounts_flagged?.[0] || selectedAlert.accountId;
      const res = await freezeAccount(accountId);
      setFreezeResult(res);
    } catch {
      setFreezeResult({
        success: false,
        account_id: selectedAlert.accountId,
        status: "error",
        money_saved: 0,
        message: "Failed to freeze account. Please try again.",
        downstream_protected: 0,
        disruption_effectiveness: 0,
      });
    } finally {
      setFreezeLoading(false);
    }
  }, [selectedAlert]);

  /* ── Session history handler ── */
  const loadHistory = useCallback(
    async (period: string = timeFilter) => {
      setHistoryLoading(true);
      try {
        const data = await getSessionHistory(period);
        setHistoryData(data);
      } catch {
        setHistoryData(null);
      } finally {
        setHistoryLoading(false);
      }
    },
    [timeFilter]
  );

  /* ── Loading state ── */
  if (!currentEvent && sim.totalTicks === 0) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 mb-4">
          <Radio className="w-5 h-5 text-cyan-400 animate-pulse" />
          <span className="text-cyan-300 font-medium">
            Initializing live simulation…
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 relative">
      {/* ═══════ TOP BAR: Simulation Controls ═══════ */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Radio
              className={`w-5 h-5 ${
                sim.isRunning ? "text-emerald-400 animate-pulse" : "text-gray-500"
              }`}
            />
            {sim.isRunning && (
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
            )}
          </div>
          <h1 className="text-xl font-bold text-white">
            Intelligence Dashboard
          </h1>
          <span className="badge badge-high text-xs flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            LIVE
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            Tick #{sim.totalTicks} ·{" "}
            {currentEvent?.scenario_type === "money_laundering"
              ? "🔴 ML Scenario"
              : "🟢 Clean"}
          </span>
          <button
            onClick={sim.toggle}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm"
          >
            {sim.isRunning ? (
              <>
                <Pause className="w-4 h-4 text-amber-400" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-emerald-400" /> Resume
              </>
            )}
          </button>
        </div>
      </div>

      {/* ═══════ SESSION & FILTER BAR ═══════ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Session: <span className="text-cyan-400 font-mono">{sessionId.slice(0, 16) || "—"}</span>
          </span>
          {sessionStart && (
            <span className="text-xs text-gray-600">
              Started {new Date(sessionStart).toLocaleTimeString("en-IN")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Time filter */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-0.5">
            {(["daily", "weekly", "monthly", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTimeFilter(f)}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                  timeFilter === f
                    ? "bg-cyan-500/20 text-cyan-300 font-medium"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {f === "all" ? "All Time" : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* History button */}
          <button
            onClick={() => {
              setShowHistory(!showHistory);
              if (!showHistory) loadHistory();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs text-gray-300"
          >
            <History className="w-3.5 h-3.5" />
            History
          </button>
        </div>
      </div>

      {/* ═══════ HISTORY PANEL ═══════ */}
      {showHistory && (
        <GlassCard hover={false}>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                Session History
              </h3>
              <button
                onClick={() => setShowHistory(false)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {historyLoading ? (
              <p className="text-xs text-gray-500 text-center py-4">Loading history…</p>
            ) : historyData ? (
              <div className="space-y-3">
                {/* Current session summary */}
                <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-cyan-300">
                      Current Session
                    </span>
                    <span className="badge badge-high text-[10px]">ACTIVE</span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-400">
                    <span>Alerts: <strong className="text-white">{historyData.current_session.alert_count}</strong></span>
                    <span>High Risk: <strong className="text-red-400">{historyData.current_session.high_risk_count}</strong></span>
                  </div>
                </div>

                {/* Past sessions */}
                {historyData.past_sessions.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500">Past Sessions ({historyData.past_sessions.length})</p>
                    {historyData.past_sessions.map((session, i) => (
                      <div
                        key={session.session_id || i}
                        className="p-2 rounded bg-white/5 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="text-gray-300 font-mono">
                            {session.session_id}
                          </span>
                          <span className="text-gray-600 ml-2">
                            {new Date(session.ended_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex gap-3 text-gray-400">
                          <span>{session.alert_count} alerts</span>
                          <span className="text-red-400">
                            {session.high_risk_count} high risk
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 text-center py-2">
                    No past sessions recorded yet.
                  </p>
                )}

                <div className="text-xs text-gray-500 text-right">
                  Total historical alerts: {historyData.total_historical_alerts}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-600 text-center py-4">
                No history data available.
              </p>
            )}
          </div>
        </GlassCard>
      )}

      {/* ═══════ LIVE EVENT BANNER ═══════ */}
      {currentEvent && (
        <GlassCard
          className={`border bg-gradient-to-r ${riskBg(unifiedScore)} p-4`}
          hover={false}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            {/* Left: Event info */}
            <div className="space-y-2 flex-1 min-w-[200px]">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-white">
                  Live Event — Tick #{currentEvent.tick}
                </span>
                <RiskBadge level={scoreToBadgeLevel(unifiedScore)} />
              </div>

              {/* Change indicators */}
              {changes.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {changes.map((c, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300 flex items-center gap-1"
                    >
                      {c.includes("eo") || c.includes("location") ? (
                        <MapPin className="w-3 h-3 text-cyan-400" />
                      ) : c.includes("velocity") || c.includes("spike") ? (
                        <TrendingUp className="w-3 h-3 text-red-400" />
                      ) : (
                        <Activity className="w-3 h-3 text-amber-400" />
                      )}
                      {c}
                    </span>
                  ))}
                </div>
              )}

              {/* Risk scores row */}
              <div className="flex flex-wrap gap-4 text-xs">
                <span>
                  Unified:{" "}
                  <span className={`font-bold ${riskColor(unifiedScore)}`}>
                    {(unifiedScore * 100).toFixed(0)}%
                  </span>
                </span>
                <span>
                  Cyber:{" "}
                  <span className="text-cyan-300">
                    {((riskScores?.cyber_score ?? 0) * 100).toFixed(0)}%
                  </span>
                </span>
                <span>
                  Financial:{" "}
                  <span className="text-amber-300">
                    {((riskScores?.financial_score ?? 0) * 100).toFixed(0)}%
                  </span>
                </span>
                <span>
                  Graph:{" "}
                  <span className="text-purple-300">
                    {((riskScores?.graph_score ?? 0) * 100).toFixed(0)}%
                  </span>
                </span>
              </div>
            </div>

            {/* Right: Unified gauge */}
            <div className="flex-shrink-0">
              <RiskGauge score={unifiedScore} size={100} label="Unified" />
            </div>
          </div>

          {/* ── Gemini Analysis (when risk > 0.7) ── */}
          {geminiAnalysis && showGeminiPanel && (
            <div className="mt-4 p-3 rounded-lg bg-black/30 border border-purple-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-semibold text-purple-300">
                    Gemini AI Analysis
                  </span>
                  <span className="text-xs text-gray-500">
                    (confidence:{" "}
                    {((geminiAnalysis.confidence ?? 0) * 100).toFixed(0)}%)
                  </span>
                </div>
                <button
                  onClick={() => setShowGeminiPanel(false)}
                  className="text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                {geminiAnalysis.explanation}
              </p>
              {geminiAnalysis.recommendation && (
                <p className="text-xs text-amber-300">
                  <strong>Recommendation:</strong>{" "}
                  {geminiAnalysis.recommendation}
                </p>
              )}
              {geminiAnalysis.key_indicators &&
                geminiAnalysis.key_indicators.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {geminiAnalysis.key_indicators.map((ind, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300"
                      >
                        {ind}
                      </span>
                    ))}
                  </div>
                )}
              {geminiAnalysis.immediate_steps &&
                geminiAnalysis.immediate_steps.length > 0 && (
                  <div className="mt-1">
                    <span className="text-xs text-gray-400 font-medium">
                      Immediate Steps:
                    </span>
                    <ul className="list-disc list-inside text-xs text-gray-300 mt-0.5">
                      {geminiAnalysis.immediate_steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ul>
                  </div>
                )}
              {geminiAnalysis.str_required && (
                <span className="inline-block text-xs px-2 py-0.5 bg-red-500/20 text-red-300 rounded mt-1">
                  ⚠ STR Filing Required
                </span>
              )}
            </div>
          )}
          {geminiAnalysis && !showGeminiPanel && (
            <button
              onClick={() => setShowGeminiPanel(true)}
              className="mt-2 text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              <Brain className="w-3 h-3" /> Show AI Analysis
            </button>
          )}
        </GlassCard>
      )}

      {/* ═══════ STAT CARDS ═══════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <GlassCard key={s.label} glow={s.glow} hover={false}>
            <div className="p-4 flex items-center gap-4">
              <div className={`p-2.5 rounded-xl bg-white/5 ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider">
                  {s.label}
                </p>
                <AnimatedCounter
                  target={s.value}
                  className={`text-2xl font-bold ${s.color}`}
                />
              </div>
            </div>
          </GlassCard>
        ))}
      </div>

      {/* ═══════ CHARTS ROW ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk Trend */}
        <GlassCard hover={false}>
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Live Risk Trend
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={riskTrendData}>
                  <defs>
                    <linearGradient
                      id="riskGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                      <stop
                        offset="100%"
                        stopColor="#ef4444"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 1]}
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e1e2e",
                      border: "1px solid #333",
                      borderRadius: 8,
                    }}
                    formatter={(v: number) => [
                      `${(v * 100).toFixed(0)}%`,
                      "Risk",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="risk"
                    stroke="#ef4444"
                    fill="url(#riskGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassCard>

        {/* Risk Breakdown Bar */}
        <GlassCard hover={false}>
          <div className="p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              Current Risk Breakdown
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    {
                      name: "Cyber",
                      score: riskScores?.cyber_score ?? 0,
                      fill: "#06b6d4",
                    },
                    {
                      name: "Financial",
                      score: riskScores?.financial_score ?? 0,
                      fill: "#f59e0b",
                    },
                    {
                      name: "Graph",
                      score: riskScores?.graph_score ?? 0,
                      fill: "#a855f7",
                    },
                    {
                      name: "Unified",
                      score: riskScores?.unified_score ?? 0,
                      fill:
                        (riskScores?.unified_score ?? 0) >= 0.7
                          ? "#ef4444"
                          : "#10b981",
                    },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 1]}
                    tick={{ fill: "#9ca3af", fontSize: 10 }}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e1e2e",
                      border: "1px solid #333",
                      borderRadius: 8,
                    }}
                    formatter={(v: number) => [
                      `${(v * 100).toFixed(0)}%`,
                      "Score",
                    ]}
                  />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {[0, 1, 2, 3].map((i) => (
                      <Cell
                        key={i}
                        fill={
                          ["#06b6d4", "#f59e0b", "#a855f7", "#ef4444"][i]
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ═══════ ML / AI INSIGHTS PANEL ═══════ */}
      <MLInsightsPanel
        mlStatus={mlStatus}
        mlGraphClass={mlGraphClass}
        mlRetraining={mlRetraining}
        onRetrain={handleRetrain}
        onLoadClassification={handleLoadClassification}
      />

      {/* ═══════ ALERTS TABLE ═══════ */}
      <GlassCard hover={false}>
        <div className="p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            Live Alerts Feed
            <span className="ml-auto text-xs text-gray-500">
              {filteredAlerts.length} alerts
              {timeFilter !== "all" && (
                <span className="text-gray-600 ml-1">
                  ({timeFilter})
                </span>
              )}
            </span>
          </h3>

          {filteredAlerts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Waiting for suspicious activity…
            </p>
          ) : (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-900/80 backdrop-blur">
                  <tr className="text-gray-400 uppercase tracking-wider">
                    <th className="text-left py-2 px-3">Time</th>
                    <th className="text-left py-2 px-3">Account</th>
                    <th className="text-left py-2 px-3">Risk</th>
                    <th className="text-left py-2 px-3">Status</th>
                    <th className="text-left py-2 px-3">Source</th>
                    <th className="text-right py-2 px-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredAlerts.map((alert: any, idx: number) => {
                    const score =
                      alert.unifiedRiskScore ?? alert.unified_risk_score ?? 0;
                    const isNew = idx === 0 && sim.isRunning;
                    return (
                      <tr
                        key={alert.id || idx}
                        className={`hover:bg-white/5 transition-colors ${
                          isNew ? "animate-pulse bg-cyan-500/5" : ""
                        }`}
                      >
                        <td className="py-2 px-3 text-gray-400 whitespace-nowrap">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {formatTime(alert.timestamp || alert.created_at)}
                        </td>
                        <td className="py-2 px-3 text-white font-mono">
                          {alert.accountId ||
                            alert.accounts_flagged?.[0] ||
                            "—"}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`font-bold ${riskColor(score)}`}>
                            {(score * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <RiskBadge level={scoreToBadgeLevel(score)} />
                        </td>
                        <td className="py-2 px-3">
                          {isNew && (
                            <span className="badge badge-high text-[10px] mr-1">
                              LIVE
                            </span>
                          )}
                          {alert.gemini_analysis && (
                            <span className="text-purple-400 text-[10px]">
                              🧠 AI
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => openAlert(alert)}
                            className="p-1 rounded hover:bg-white/10 text-cyan-400"
                            title="View Detail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ═══════ ALERT DETAIL SLIDE-OVER ═══════ */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedAlert(null)}
          />
          <div className="relative w-full max-w-lg bg-gray-900/95 border-l border-white/10 overflow-y-auto p-6 space-y-5 animate-slide-in">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-400" />
                Alert Detail
              </h2>
              <button
                onClick={() => setSelectedAlert(null)}
                className="p-1 rounded hover:bg-white/10"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {detailLoading ? (
              <CardSkeleton />
            ) : (
              <>
                {/* Summary */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <RiskGauge
                      score={selectedAlert.unifiedRiskScore}
                      size={80}
                    />
                    <div>
                      <p className="text-sm text-gray-400">
                        Account:{" "}
                        <span className="text-white font-mono">
                          {selectedAlert.accountId}
                        </span>
                      </p>
                      <p className="text-sm text-gray-400">
                        Status:{" "}
                        <RiskBadge
                          level={scoreToBadgeLevel(
                            selectedAlert.unifiedRiskScore
                          )}
                        />
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTime(selectedAlert.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Cyber Events */}
                {selectedAlert.cyberEvents.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                      Cyber Events ({selectedAlert.cyberEvents.length})
                    </h4>
                    <div className="space-y-1">
                      {selectedAlert.cyberEvents.map((e) => (
                        <div
                          key={e.id}
                          className="text-xs p-2 rounded bg-white/5 flex justify-between"
                        >
                          <span className="text-gray-300">
                            {e.type} — {e.ipLocation || e.ip_geo || "N/A"}
                          </span>
                          <span className={riskColor(e.riskScore)}>
                            {(e.riskScore * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transactions */}
                {selectedAlert.financialTransactions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                      Financial Transactions (
                      {selectedAlert.financialTransactions.length})
                    </h4>
                    <div className="space-y-1">
                      {selectedAlert.financialTransactions.map((t) => (
                        <div
                          key={t.id}
                          className="text-xs p-2 rounded bg-white/5 flex justify-between"
                        >
                          <span className="text-gray-300">
                            {t.senderId} → {t.receiverId}{" "}
                            <span className="text-amber-300">
                              ₹{t.amount.toLocaleString()}
                            </span>
                          </span>
                          <span className={riskColor(t.riskScore)}>
                            {(t.riskScore * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Explanation from alert */}
                {selectedAlert.geminiExplanation && (
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <p className="text-xs text-purple-300">
                      <Brain className="w-3 h-3 inline mr-1" />
                      {selectedAlert.geminiExplanation}
                    </p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleExplain}
                    disabled={geminiLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 text-xs disabled:opacity-50"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    {geminiLoading ? "Analyzing…" : "AI Explain"}
                  </button>
                  <button
                    onClick={handleSTR}
                    disabled={strLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-xs disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {strLoading ? "Generating…" : "Generate STR"}
                  </button>
                  <button
                    onClick={handleTwin}
                    disabled={twinLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs disabled:opacity-50"
                  >
                    <Network className="w-3.5 h-3.5" />
                    {twinLoading ? "Simulating…" : "Digital Twin"}
                  </button>

                  {/* Emergency Freeze — for high risk alerts */}
                  {selectedAlert.unifiedRiskScore >= 0.6 && (
                    <button
                      onClick={handleFreeze}
                      disabled={freezeLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs disabled:opacity-50 border border-red-500/30"
                    >
                      <Snowflake className="w-3.5 h-3.5" />
                      {freezeLoading ? "Freezing…" : "🚨 Freeze Account"}
                    </button>
                  )}
                </div>

                {/* Freeze result */}
                {freezeResult && (
                  <div
                    className={`p-3 rounded-lg border space-y-1 ${
                      freezeResult.success
                        ? "bg-emerald-500/10 border-emerald-500/20"
                        : "bg-red-500/10 border-red-500/20"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Snowflake
                        className={`w-4 h-4 ${
                          freezeResult.success ? "text-emerald-400" : "text-red-400"
                        }`}
                      />
                      <span
                        className={`text-xs font-semibold ${
                          freezeResult.success ? "text-emerald-300" : "text-red-300"
                        }`}
                      >
                        {freezeResult.success ? "Account Frozen" : "Freeze Failed"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300">{freezeResult.message}</p>
                    {freezeResult.success && freezeResult.money_saved > 0 && (
                      <div className="flex items-center gap-2 mt-1">
                        <IndianRupee className="w-3 h-3 text-emerald-400" />
                        <span className="text-xs text-emerald-300 font-bold">
                          ₹{freezeResult.money_saved.toLocaleString()} saved by SurakshaFlow
                        </span>
                      </div>
                    )}
                    {freezeResult.downstream_protected > 0 && (
                      <p className="text-xs text-gray-400">
                        {freezeResult.downstream_protected} downstream accounts protected
                      </p>
                    )}
                  </div>
                )}

                {/* Gemini detail result */}
                {geminiResult && (
                  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 space-y-2">
                    <h4 className="text-xs font-semibold text-purple-300 flex items-center gap-1">
                      <Brain className="w-3 h-3" /> AI Explanation
                    </h4>
                    <p className="text-xs text-gray-300">
                      {geminiResult.explanation}
                    </p>
                    <p className="text-xs text-amber-300">
                      <strong>Recommendation:</strong>{" "}
                      {geminiResult.recommendation}
                    </p>
                    {geminiResult.key_indicators.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {geminiResult.key_indicators.map((k, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* STR download */}
                {strUrl && (
                  <a
                    href={strUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-xs w-fit"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download STR Report
                  </a>
                )}

                {/* Digital twin result */}
                {twinResult && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
                    <h4 className="text-xs font-semibold text-amber-300">
                      Digital Twin Simulation
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400">No Action Exposure</p>
                        <p className="text-red-300 font-bold">
                          ₹
                          {twinResult.no_action.total_exposure.toLocaleString()}
                        </p>
                        <p className="text-gray-500">
                          {twinResult.no_action.downstream_accounts} accounts
                          affected
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Optimal Freeze</p>
                        <p className="text-emerald-300 font-bold">
                          ₹
                          {twinResult.optimal_action.prevented_loss.toLocaleString()}{" "}
                          saved
                        </p>
                        <p className="text-gray-500">
                          Freeze:{" "}
                          {twinResult.optimal_action.account_to_freeze}
                        </p>
                      </div>
                    </div>

                    {/* Money saved by SurakshaFlow highlight */}
                    {twinResult.optimal_action.money_saved_by_surakshaflow != null &&
                      twinResult.optimal_action.money_saved_by_surakshaflow > 0 && (
                        <div className="mt-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                          <IndianRupee className="w-4 h-4 text-emerald-400" />
                          <div>
                            <p className="text-xs text-emerald-300 font-bold">
                              ₹{twinResult.optimal_action.money_saved_by_surakshaflow.toLocaleString()} saved by SurakshaFlow
                            </p>
                            {twinResult.optimal_action.message && (
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                {twinResult.optimal_action.message}
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Error display ── */}
      {sim.error && (
        <div className="fixed bottom-4 right-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-red-300 text-xs max-w-xs z-40">
          <strong>Simulation Error:</strong> {sim.error}
        </div>
      )}
    </div>
  );
}
