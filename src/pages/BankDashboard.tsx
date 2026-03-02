import { useState, useEffect } from "react";
import {
  ShieldAlert,
  Activity,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  Sparkles,
  FileText,
  Zap,
  ChevronRight,
  Download,
} from "lucide-react";
import {
  Alert,
  DashboardSummary,
  SimulationResult,
  GeminiExplanation,
} from "../types";
import { cn } from "../lib/utils";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import GlassCard from "../components/GlassCard";
import RiskBadge, { scoreToBadgeLevel } from "../components/RiskBadge";
import AnimatedCounter from "../components/AnimatedCounter";
import LoadingSkeleton, { CardSkeleton } from "../components/LoadingSkeleton";
import {
  fetchBankSummary,
  fetchAlerts,
  explainAlert,
  generateSTR,
  getSTRDownloadUrl,
  runSimulation,
  runScenario,
} from "../services/api";
import { getMockAlerts } from "../services/mockData";

const fallbackTrend = [
  { time: "10:00", risk: 0.2 },
  { time: "10:05", risk: 0.3 },
  { time: "10:10", risk: 0.8 },
  { time: "10:15", risk: 0.95 },
  { time: "10:20", risk: 0.9 },
  { time: "10:25", risk: 0.4 },
  { time: "10:30", risk: 0.2 },
];

export default function BankDashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [explanation, setExplanation] = useState<GeminiExplanation | null>(
    null,
  );
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [loadingSim, setLoadingSim] = useState(false);
  const [loadingSTR, setLoadingSTR] = useState(false);
  const [strUrl, setStrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Fetch data from API, fallback to mock
  useEffect(() => {
    (async () => {
      try {
        const [s, a] = await Promise.all([
          fetchBankSummary(),
          fetchAlerts(filterStatus || undefined),
        ]);
        setSummary(s);
        setAlerts(a);
      } catch {
        // Fallback to mock data if API unavailable
        setSummary({
          total_alerts: 24,
          high_risk_count: 8,
          transactions_monitored: 14205,
          active_mule_rings: 3,
          risk_trend: fallbackTrend,
        });
        setAlerts(getMockAlerts());
      }
      setLoading(false);
    })();
  }, [filterStatus]);

  const handleAlertClick = async (alert: Alert) => {
    setSelectedAlert(alert);
    setExplanation(null);
    setSimulation(null);
    setStrUrl(null);
    if (alert.unifiedRiskScore > 0.5) {
      setLoadingExplanation(true);
      try {
        const expl = await explainAlert(alert.id);
        setExplanation(expl);
      } catch {
        // Use existing explanation if API fails
        if (alert.geminiExplanation) {
          setExplanation({
            explanation: alert.geminiExplanation,
            recommendation: alert.recommendedAction || "",
            confidence: 0.85,
            key_indicators: [],
          });
        }
      }
      setLoadingExplanation(false);
    }
  };

  const handleSimulation = async () => {
    if (!selectedAlert) return;
    setLoadingSim(true);
    try {
      const sim = await runSimulation(selectedAlert.accountId);
      setSimulation(sim);
    } catch {
      setSimulation({
        no_action: { downstream_accounts: 4, total_exposure: 148000 },
        optimal_action: {
          account_to_freeze: selectedAlert.accountId,
          prevented_loss: 122000,
          prevented_percentage: 82.4,
        },
      });
    }
    setLoadingSim(false);
  };

  const handleSTR = async () => {
    if (!selectedAlert) return;
    setLoadingSTR(true);
    try {
      const result = await generateSTR(selectedAlert.id);
      setStrUrl(getSTRDownloadUrl(result.report_id));
    } catch {
      // noop
    }
    setLoadingSTR(false);
  };

  const trend = summary?.risk_trend ?? fallbackTrend;

  const stats = [
    {
      label: "High Risk Alerts",
      value: summary?.high_risk_count ?? 0,
      icon: <ShieldAlert className="h-5 w-5" />,
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      change: "+12%",
      changeUp: true,
    },
    {
      label: "Transactions Monitored",
      value: summary?.transactions_monitored ?? 0,
      icon: <Activity className="h-5 w-5" />,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
      change: "+5%",
      changeUp: true,
    },
    {
      label: "Active Mule Rings",
      value: summary?.active_mule_rings ?? 0,
      icon: <Users className="h-5 w-5" />,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      change: "-1 today",
      changeUp: false,
    },
  ];

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="skeleton h-8 w-80" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Unified Intelligence Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time fusion of Cyber and Financial signals
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() =>
              runScenario()
                .then(() => window.location.reload())
                .catch(() => {})
            }
            className="btn-ghost text-xs flex items-center gap-2"
          >
            <Zap className="h-3.5 w-3.5" />
            Run Demo
          </button>
        </div>
      </div>

      {/* ── Stat Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {stats.map((s) => (
          <GlassCard key={s.label} className="p-5 flex flex-col" hover={false}>
            <div className="flex items-center gap-3 mb-3">
              <div
                className={cn(
                  "p-2.5 rounded-xl border",
                  s.bg,
                  s.border,
                  s.color,
                )}
              >
                {s.icon}
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400">{s.label}</p>
                <div className="text-2xl font-bold text-white">
                  <AnimatedCounter target={s.value} />
                </div>
              </div>
            </div>
            <div
              className={cn(
                "mt-auto flex items-center text-xs font-medium",
                s.changeUp ? "text-red-400" : "text-emerald-400",
              )}
            >
              {s.changeUp ? (
                <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5 mr-1" />
              )}
              {s.change}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* ── Main Grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Alert Feed + Trend */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Alert Feed */}
          <GlassCard hover={false} className="overflow-hidden">
            <div className="p-5 border-b border-white/[0.06] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-red-500 pulse-dot" />
                <h2 className="text-sm font-semibold text-white">
                  Live Alert Feed
                </h2>
              </div>
              <div className="flex gap-1.5">
                {["", "new", "investigating", "escalated"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterStatus(f)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                      filterStatus === f
                        ? "bg-white/10 text-white"
                        : "text-slate-500 hover:text-slate-300",
                    )}
                  >
                    {f || "All"}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-white/[0.04] max-h-[420px] overflow-y-auto">
              {alerts.length === 0 && (
                <div className="p-8 text-center text-sm text-slate-500">
                  No alerts found.
                </div>
              )}
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "p-4 cursor-pointer transition-colors hover:bg-white/[0.03]",
                    selectedAlert?.id === alert.id &&
                      "bg-white/[0.05] border-l-2 border-l-amber-400",
                  )}
                  onClick={() => handleAlertClick(alert)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          alert.unifiedRiskScore > 0.8
                            ? "bg-red-500"
                            : alert.unifiedRiskScore > 0.4
                              ? "bg-amber-500"
                              : "bg-emerald-500",
                        )}
                      />
                      <span className="text-sm font-medium text-white">
                        {alert.accountId ||
                          alert.accounts_flagged?.[0] ||
                          alert.id}
                      </span>
                      <RiskBadge
                        level={scoreToBadgeLevel(alert.unifiedRiskScore)}
                      />
                    </div>
                    <div className="text-right">
                      <div
                        className={cn(
                          "text-lg font-bold font-mono",
                          alert.unifiedRiskScore > 0.8
                            ? "text-red-400"
                            : alert.unifiedRiskScore > 0.4
                              ? "text-amber-400"
                              : "text-emerald-400",
                        )}
                      >
                        {(alert.unifiedRiskScore * 100).toFixed(0)}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" />
                      {alert.cyberEvents.length} Cyber
                    </span>
                    <span className="flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      {alert.financialTransactions.length} Financial
                    </span>
                    <span>
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Risk Trend Chart */}
          <GlassCard hover={false} className="p-5">
            <h2 className="text-sm font-semibold text-white mb-5">
              System Risk Trend
            </h2>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="rgba(255,255,255,0.04)"
                  />
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#64748b", fontSize: 11 }}
                    dx={-8}
                    domain={[0, 1]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#111827",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      color: "#f1f5f9",
                      fontSize: "12px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="risk"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#riskGrad)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: "#f59e0b",
                      stroke: "#0a0e1a",
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>

        {/* ── Detail Panel ────────────────────────────────── */}
        <div className="lg:col-span-1">
          {selectedAlert ? (
            <GlassCard hover={false} className="overflow-hidden sticky top-24">
              {/* Header */}
              <div className="p-5 border-b border-white/[0.06]">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-sm font-semibold text-white">
                    Alert Detail
                  </h2>
                  <RiskBadge
                    level={scoreToBadgeLevel(selectedAlert.unifiedRiskScore)}
                  />
                </div>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedAlert.id}
                </p>
              </div>

              <div className="p-5 space-y-5 max-h-[calc(100vh-220px)] overflow-y-auto">
                {/* AI Analysis */}
                <div>
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    Gemini AI Analysis
                  </h3>
                  {loadingExplanation ? (
                    <LoadingSkeleton />
                  ) : explanation ? (
                    <div className="space-y-3">
                      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-xs text-slate-300 leading-relaxed">
                        {explanation.explanation}
                      </div>
                      {explanation.recommendation && (
                        <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/10 text-xs">
                          <span className="font-semibold text-red-400 block mb-1">
                            Recommended:
                          </span>
                          <span className="text-slate-400">
                            {explanation.recommendation}
                          </span>
                        </div>
                      )}
                      {explanation.key_indicators &&
                        explanation.key_indicators.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {explanation.key_indicators.map((k, i) => (
                              <span
                                key={i}
                                className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/[0.06]"
                              >
                                {k}
                              </span>
                            ))}
                          </div>
                        )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 italic">
                      Select a high-risk alert for AI analysis.
                    </p>
                  )}
                </div>

                {/* Cyber Signals */}
                <div className="border-t border-white/[0.06] pt-4">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Cyber Signals ({selectedAlert.cyberEvents.length})
                  </h3>
                  {selectedAlert.cyberEvents.length > 0 ? (
                    <ul className="space-y-2">
                      {selectedAlert.cyberEvents.map((e) => (
                        <li
                          key={e.id}
                          className="flex justify-between items-start p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                        >
                          <div>
                            <span className="text-xs font-medium text-white block">
                              {(e.event_type || e.type || "").replace(
                                /_/g,
                                " ",
                              )}
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {e.device_id || e.deviceId} •{" "}
                              {e.ip_geo || e.ipLocation}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-400">
                            {((e.anomaly_score ?? e.riskScore) * 100).toFixed(
                              0,
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-600">None</p>
                  )}
                </div>

                {/* Financial Signals */}
                <div className="border-t border-white/[0.06] pt-4">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                    Financial Signals (
                    {selectedAlert.financialTransactions.length})
                  </h3>
                  {selectedAlert.financialTransactions.length > 0 ? (
                    <ul className="space-y-2">
                      {selectedAlert.financialTransactions.map((tx) => (
                        <li
                          key={tx.id}
                          className="flex justify-between items-start p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                        >
                          <div>
                            <span className="text-xs font-medium text-white block">
                              ₹{tx.amount.toLocaleString()}{" "}
                              <span className="text-slate-500 font-normal">
                                ({(tx.method || tx.type || "").toUpperCase()})
                              </span>
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {tx.sender || tx.senderId} →{" "}
                              {tx.receiver || tx.receiverId}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-white/[0.05] text-slate-400">
                            {(
                              (tx.velocity_score ?? tx.riskScore) * 100
                            ).toFixed(0)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-600">None</p>
                  )}
                </div>

                {/* Digital Twin */}
                <div className="border-t border-white/[0.06] pt-4">
                  <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-cyan-400" />
                    Digital Twin Simulation
                  </h3>
                  {simulation ? (
                    <div className="space-y-2">
                      <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                        <div className="text-[10px] text-slate-500 mb-0.5">
                          Without action
                        </div>
                        <div className="text-sm font-bold text-red-400 font-mono">
                          ₹
                          {simulation.no_action.total_exposure.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {simulation.no_action.downstream_accounts} downstream
                          accounts at risk
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                        <div className="text-[10px] text-slate-500 mb-0.5">
                          Optimal freeze
                        </div>
                        <div className="text-sm font-bold text-emerald-400 font-mono">
                          ₹
                          {simulation.optimal_action.prevented_loss.toLocaleString()}{" "}
                          saved
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Freeze{" "}
                          <span className="text-emerald-400 font-mono">
                            {simulation.optimal_action.account_to_freeze}
                          </span>{" "}
                          —{" "}
                          {simulation.optimal_action.prevented_percentage.toFixed(
                            1,
                          )}
                          % disruption
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleSimulation}
                      disabled={loadingSim}
                      className="btn-ghost w-full text-xs flex items-center justify-center gap-2"
                    >
                      {loadingSim ? "Simulating..." : "Run Simulation"}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-3 flex gap-2">
                  <button
                    onClick={handleSTR}
                    disabled={loadingSTR}
                    className="flex-1 btn-primary text-xs flex items-center justify-center gap-1.5"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {loadingSTR ? "Generating..." : "Generate STR"}
                  </button>
                  <button className="flex-1 btn-danger text-xs">
                    Freeze Account
                  </button>
                </div>
                {strUrl && (
                  <a
                    href={strUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 mt-2"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download STR Report
                  </a>
                )}
              </div>
            </GlassCard>
          ) : (
            <GlassCard
              hover={false}
              className="p-8 text-center h-80 flex flex-col items-center justify-center"
            >
              <ShieldAlert className="h-10 w-10 text-slate-700 mb-4" />
              <p className="text-sm text-slate-500">
                Select an alert from the feed to view AI analysis, risk signals,
                and run digital twin simulations.
              </p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
