import { useState, useEffect, useCallback, useRef } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  CreditCard,
  MessageSquareWarning,
  Mail,
  Send,
  Loader2,
  AlertTriangle,
  CheckCircle,
  MapPin,
  TrendingUp,
  Activity,
  Brain,
  Play,
  Pause,
  Radio,
  X,
  Shield,
  Phone,
  ChevronDown,
  ChevronUp,
  Info,
  ClipboardList,
  UserCircle,
  BarChart3,
  Database,
  DatabaseZap,
  Snowflake,
  IndianRupee,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "../lib/utils";
import {
  CyberEvent,
  FinancialTransaction,
  UserRiskResponse,
  SMSAnalysisResult,
} from "../types";
import {
  fetchUserRisk,
  fetchUserEvents,
  analyzeSMS,
  analyzeEmail,
  freezeAccount,
  type EmailAnalysisResult,
  type FreezeResult,
  fetchUserLiveEvent,
  type UserLiveEvent,
} from "../services/api";
import {
  isFirestoreAvailable,
  saveRiskSnapshot,
  saveCyberEvent,
  saveTransaction,
  saveLiveEvent,
  seedUserDataToFirestore,
  useFirestoreRisk,
  useFirestoreCyberEvents,
  useFirestoreTransactions,
} from "../services/userFirestoreService";
import GlassCard from "../components/GlassCard";
import RiskGauge from "../components/RiskGauge";
import LoadingSkeleton from "../components/LoadingSkeleton";

const DEMO_ACCOUNT = "acc_victim_1";
const POLL_INTERVAL = 15000;

type TabKey = "risk" | "transactions";

/* ────────────── helpers ────────────── */
function riskColor(score: number) {
  if (score >= 0.7) return "text-red-400";
  if (score >= 0.4) return "text-amber-400";
  return "text-emerald-400";
}

function severityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "bg-red-500/15 border-red-500/30 text-red-300";
    case "high":
      return "bg-orange-500/15 border-orange-500/30 text-orange-300";
    case "warning":
      return "bg-amber-500/15 border-amber-500/30 text-amber-300";
    case "info":
      return "bg-blue-500/15 border-blue-500/30 text-blue-300";
    default:
      return "bg-white/5 border-white/10 text-gray-300";
  }
}

function severityIcon(severity: string) {
  switch (severity) {
    case "critical":
      return <ShieldAlert className="h-4 w-4 text-red-400" />;
    case "high":
      return <AlertTriangle className="h-4 w-4 text-orange-400" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-amber-400" />;
    case "info":
      return <Info className="h-4 w-4 text-blue-400" />;
    default:
      return <Info className="h-4 w-4 text-gray-400" />;
  }
}

function urgencyBadge(urgency: string) {
  const styles: Record<string, string> = {
    dangerous: "bg-red-500/20 text-red-300 border-red-500/30",
    caution: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    safe: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  };
  return (
    <span
      className={cn(
        "text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase",
        styles[urgency] || styles.safe,
      )}
    >
      {urgency}
    </span>
  );
}

export default function UserDashboard() {
  /* ── Tab state — purely internal toggle ── */
  const [activeTab, setActiveTab] = useState<TabKey>("risk");

  /* ── Data source tracking ── */
  const [dataSource, setDataSource] = useState<
    "firestore" | "api" | "fallback"
  >("api");
  const firestoreAvailable = isFirestoreAvailable();

  /* ── Static initial load ── */
  const [risk, setRisk] = useState<UserRiskResponse | null>(null);
  const [cyberEvents, setCyberEvents] = useState<CyberEvent[]>([]);
  const [financialEvents, setFinancialEvents] = useState<
    FinancialTransaction[]
  >([]);
  const [loading, setLoading] = useState(true);

  /* ── Live simulation state ── */
  const [isRunning, setIsRunning] = useState(true);
  const [currentEvent, setCurrentEvent] = useState<UserLiveEvent | null>(null);
  const [eventHistory, setEventHistory] = useState<UserLiveEvent[]>([]);
  const [liveWarnings, setLiveWarnings] = useState<UserLiveEvent["warnings"]>(
    [],
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── SMS Analyzer ── */
  const [smsText, setSmsText] = useState("");
  const [smsResult, setSmsResult] = useState<SMSAnalysisResult | null>(null);
  const [smsLoading, setSmsLoading] = useState(false);

  /* ── Email Analyzer ── */
  const [emailContent, setEmailContent] = useState("");
  const [emailSender, setEmailSender] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailResult, setEmailResult] = useState<EmailAnalysisResult | null>(
    null,
  );
  const [emailLoading, setEmailLoading] = useState(false);

  /* ── UI ── */
  const [showExplanation, setShowExplanation] = useState(true);
  const [expandedWarning, setExpandedWarning] = useState<number | null>(null);

  /* ── Account Freeze ── */
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [freezeResult, setFreezeResult] = useState<FreezeResult | null>(null);

  /* ── Firestore real-time listeners (graceful — return empty if unavailable) ── */
  const {
    risk: fsRisk,
    firestoreOk: fsRiskOk,
  } = useFirestoreRisk(DEMO_ACCOUNT);
  const {
    events: fsCyberEvents,
    firestoreOk: fsCyberOk,
  } = useFirestoreCyberEvents(DEMO_ACCOUNT);
  const {
    transactions: fsTxns,
    firestoreOk: fsTxnsOk,
  } = useFirestoreTransactions(DEMO_ACCOUNT);

  /* ── Initial data load with Firestore → API → fallback chain ── */
  useEffect(() => {
    (async () => {
      // Try Firestore seeding first
      if (firestoreAvailable) {
        try {
          await seedUserDataToFirestore(DEMO_ACCOUNT);
          setDataSource("firestore");
        } catch {
          // Firestore write failed — will rely on API
        }
      }

      // Always also fetch from API to merge/fallback
      try {
        const [r, events] = await Promise.all([
          fetchUserRisk(DEMO_ACCOUNT),
          fetchUserEvents(DEMO_ACCOUNT),
        ]);
        if (!fsRiskOk) {
          setRisk(r);
          setDataSource("api");
        }
        if (!fsCyberOk) {
          setCyberEvents(events.cyber_events ?? []);
        }
        if (!fsTxnsOk) {
          setFinancialEvents(events.financial_transactions ?? []);
        }
        // Persist to Firestore for future reads
        if (firestoreAvailable) {
          saveRiskSnapshot(DEMO_ACCOUNT, r).catch(() => {});
        }
      } catch {
        if (!fsRiskOk) {
          setRisk({
            account_id: DEMO_ACCOUNT,
            unified_score: 0.15,
            cyber_score: 0.1,
            financial_score: 0.05,
            graph_score: 0.03,
            risk_level: "low",
          });
          setDataSource("fallback");
        }
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Merge Firestore real-time data when available ── */
  useEffect(() => {
    if (fsRiskOk && fsRisk) {
      setRisk(fsRisk);
      setDataSource("firestore");
    }
  }, [fsRisk, fsRiskOk]);

  useEffect(() => {
    if (fsCyberOk && fsCyberEvents.length > 0) {
      setCyberEvents(fsCyberEvents);
    }
  }, [fsCyberEvents, fsCyberOk]);

  useEffect(() => {
    if (fsTxnsOk && fsTxns.length > 0) {
      setFinancialEvents(fsTxns);
    }
  }, [fsTxns, fsTxnsOk]);

  /* ── Live simulation polling ── */
  const fetchEvent = useCallback(async () => {
    try {
      const event = await fetchUserLiveEvent(DEMO_ACCOUNT);
      setCurrentEvent(event);
      setEventHistory((prev) => [event, ...prev].slice(0, 30));

      const newRisk: UserRiskResponse = {
        account_id: DEMO_ACCOUNT,
        unified_score: event.risk_scores.unified_score,
        cyber_score: event.risk_scores.cyber_score,
        financial_score: event.risk_scores.financial_score,
        graph_score: event.risk_scores.graph_score,
        risk_level: event.risk_level,
        explanation:
          event.gemini_analysis?.explanation || risk?.explanation || "",
        recommended_action:
          event.gemini_analysis?.steps_to_take?.join("; ") ||
          risk?.recommended_action ||
          "",
      };
      setRisk(newRisk);

      // Persist to Firestore
      if (firestoreAvailable) {
        saveRiskSnapshot(DEMO_ACCOUNT, newRisk).catch(() => {});
        saveLiveEvent(event).catch(() => {});
      }

      if (event.warnings.length > 0) {
        setLiveWarnings((prev) => [...event.warnings, ...prev].slice(0, 10));
      }

      if (event.cyber_event) {
        const ce = event.cyber_event;
        const cyberEvent: CyberEvent = {
          id: ce.id,
          timestamp: ce.timestamp,
          type: ce.event_type || ce.type || "login",
          event_type: ce.event_type,
          deviceId: ce.device_id || "",
          device_id: ce.device_id,
          ipLocation: ce.ip_geo || "",
          ip_geo: ce.ip_geo,
          accountId: ce.account_id || "",
          account_id: ce.account_id,
          riskScore: ce.anomaly_score || 0,
          anomaly_score: ce.anomaly_score,
          raw_signals: ce.raw_signals,
        };
        setCyberEvents((prev) => [cyberEvent, ...prev].slice(0, 8));
        if (firestoreAvailable) saveCyberEvent(cyberEvent).catch(() => {});
      }

      if (event.transaction) {
        const tx = event.transaction;
        const txn: FinancialTransaction = {
          id: tx.id,
          timestamp: tx.timestamp,
          senderId: tx.sender || "",
          sender: tx.sender,
          receiverId: tx.receiver || "",
          receiver: tx.receiver,
          amount: tx.amount || 0,
          type: tx.method || "upi",
          method: tx.method,
          riskScore: tx.velocity_score || 0,
          velocity_score: tx.velocity_score,
          risk_flags: tx.risk_flags,
        };
        setFinancialEvents((prev) => [txn, ...prev].slice(0, 8));
        if (firestoreAvailable) saveTransaction(txn).catch(() => {});
      }
    } catch (err) {
      console.error("User simulation fetch failed:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestoreAvailable]);

  useEffect(() => {
    if (isRunning) {
      fetchEvent();
      intervalRef.current = setInterval(fetchEvent, POLL_INTERVAL);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, fetchEvent]);

  const toggleSim = () => {
    if (isRunning && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning((prev) => !prev);
  };

  /* ── SMS & Email handlers ── */
  const handleSMSCheck = async () => {
    if (!smsText.trim()) return;
    setSmsLoading(true);
    setSmsResult(null);
    try {
      const result = await analyzeSMS(smsText);
      setSmsResult(result);
    } catch {
      setSmsResult({
        is_scam: false,
        confidence: 0,
        explanation: "Unable to analyze — API unavailable.",
        risk_indicators: [],
      });
    }
    setSmsLoading(false);
  };

  const handleEmailCheck = async () => {
    if (!emailContent.trim()) return;
    setEmailLoading(true);
    setEmailResult(null);
    try {
      const result = await analyzeEmail(
        emailContent,
        emailSender,
        emailSubject,
      );
      setEmailResult(result);
    } catch {
      setEmailResult({
        is_phishing: false,
        confidence: 0,
        explanation: "Unable to analyze — API unavailable.",
        risk_indicators: [],
        recommended_action: "Please try again later.",
        threat_type: "unknown",
        analysis_source: "error",
      });
    }
    setEmailLoading(false);
  };

  /* ── Freeze account handler ── */
  const handleFreeze = async () => {
    setFreezeLoading(true);
    setFreezeResult(null);
    try {
      const res = await freezeAccount(DEMO_ACCOUNT);
      setFreezeResult(res);
    } catch {
      setFreezeResult({
        success: false,
        account_id: DEMO_ACCOUNT,
        status: "error",
        money_saved: 0,
        message: "Unable to freeze account. Please contact your bank immediately.",
        downstream_protected: 0,
        disruption_effectiveness: 0,
      });
    }
    setFreezeLoading(false);
  };

  const riskScore = risk?.unified_score ?? 0.15;
  const geminiAnalysis = currentEvent?.gemini_analysis;
  const changes = currentEvent?.changes ?? [];
  const riskTrendData = currentEvent?.risk_trend ?? [];

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="skeleton h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card-static p-8 flex justify-center">
            <div className="skeleton h-44 w-44 rounded-full" />
          </div>
          <div className="space-y-4">
            <LoadingSkeleton lines={4} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ═══════ Header + Controls ═══════ */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            My Security Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time monitoring of your account security.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Data source badge */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium border",
              dataSource === "firestore"
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : dataSource === "api"
                  ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/20",
            )}
          >
            {dataSource === "firestore" ? (
              <DatabaseZap className="w-3 h-3" />
            ) : (
              <Database className="w-3 h-3" />
            )}
            {dataSource === "firestore"
              ? "Firestore"
              : dataSource === "api"
                ? "REST API"
                : "Offline"}
          </div>

          {/* Simulation controls */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Radio
                className={cn(
                  "w-4 h-4",
                  isRunning
                    ? "text-emerald-400 animate-pulse"
                    : "text-gray-500",
                )}
              />
              {isRunning && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
              )}
            </div>
            <span className="text-xs text-gray-400">
              {isRunning ? "LIVE" : "PAUSED"}
              {currentEvent && ` · Tick #${currentEvent.tick}`}
            </span>
          </div>
          <button
            onClick={toggleSim}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs"
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 text-amber-400" /> Pause
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-emerald-400" /> Resume
              </>
            )}
          </button>
        </div>
      </div>

      {/* ═══════ Tab Toggle ═══════ */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06] w-fit">
        <button
          onClick={() => setActiveTab("risk")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeTab === "risk"
              ? "bg-gradient-to-r from-amber-500/20 to-cyan-500/10 text-white border border-amber-500/20 shadow-lg shadow-amber-500/5"
              : "text-slate-400 hover:text-white hover:bg-white/5",
          )}
        >
          <UserCircle className="w-4 h-4" />
          My Risk
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            activeTab === "transactions"
              ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/10 text-white border border-cyan-500/20 shadow-lg shadow-cyan-500/5"
              : "text-slate-400 hover:text-white hover:bg-white/5",
          )}
        >
          <BarChart3 className="w-4 h-4" />
          Transactions
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════
           TAB: MY RISK
         ═══════════════════════════════════════════════════ */}
      {activeTab === "risk" && (
        <div className="space-y-6">
          {/* Live Event Banner */}
          {currentEvent && changes.length > 0 && (
            <GlassCard
              hover={false}
              className={cn(
                "p-4 border",
                riskScore >= 0.7
                  ? "bg-gradient-to-r from-red-500/10 to-red-900/5 border-red-500/30"
                  : riskScore >= 0.4
                    ? "bg-gradient-to-r from-amber-500/10 to-amber-900/5 border-amber-500/30"
                    : "bg-gradient-to-r from-cyan-500/10 to-cyan-900/5 border-cyan-500/30",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Activity className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-semibold text-white">
                      Security Event Detected
                    </span>
                    {currentEvent.is_anomaly && (
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        ANOMALY
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {changes.map((c, i) => (
                      <span
                        key={i}
                        className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300 flex items-center gap-1"
                      >
                        {c.includes("ocation") || c.includes("travel") ? (
                          <MapPin className="w-3 h-3 text-cyan-400" />
                        ) : c.includes("velocity") || c.includes("spike") ? (
                          <TrendingUp className="w-3 h-3 text-red-400" />
                        ) : c.includes("device") ? (
                          <Smartphone className="w-3 h-3 text-purple-400" />
                        ) : (
                          <Activity className="w-3 h-3 text-amber-400" />
                        )}
                        {c}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <span>
                      Risk:{" "}
                      <span className={cn("font-bold", riskColor(riskScore))}>
                        {(riskScore * 100).toFixed(0)}%
                      </span>
                    </span>
                    <span>
                      Cyber:{" "}
                      <span className="text-cyan-300">
                        {((risk?.cyber_score ?? 0) * 100).toFixed(0)}%
                      </span>
                    </span>
                    <span>
                      Financial:{" "}
                      <span className="text-amber-300">
                        {((risk?.financial_score ?? 0) * 100).toFixed(0)}%
                      </span>
                    </span>
                  </div>
                </div>
                <RiskGauge score={riskScore} size={80} label="Risk" />
              </div>
            </GlassCard>
          )}

          {/* AI Explainability Panel */}
          {geminiAnalysis && showExplanation && (
            <GlassCard
              hover={false}
              className="p-5 border border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-indigo-500/5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-semibold text-purple-300">
                    AI Security Analysis
                  </span>
                  <span className="text-[10px] text-gray-500">
                    confidence:{" "}
                    {((geminiAnalysis.confidence ?? 0) * 100).toFixed(0)}%
                  </span>
                  {geminiAnalysis.urgency &&
                    urgencyBadge(geminiAnalysis.urgency)}
                </div>
                <button
                  onClick={() => setShowExplanation(false)}
                  className="text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                {geminiAnalysis.explanation}
              </p>
              {geminiAnalysis.steps_to_take &&
                geminiAnalysis.steps_to_take.length > 0 && (
                  <div className="mt-3">
                    <span className="text-xs text-amber-300 font-medium">
                      What You Should Do:
                    </span>
                    <ol className="list-decimal list-inside text-xs text-gray-300 mt-1 space-y-0.5">
                      {geminiAnalysis.steps_to_take.map(
                        (step: string, i: number) => (
                          <li key={i}>{step}</li>
                        ),
                      )}
                    </ol>
                  </div>
                )}
              {geminiAnalysis.prevention_tips &&
                geminiAnalysis.prevention_tips.length > 0 && (
                  <div className="mt-3">
                    <span className="text-xs text-cyan-300 font-medium">
                      How To Stay Safe:
                    </span>
                    <ul className="list-disc list-inside text-xs text-gray-400 mt-1 space-y-0.5">
                      {geminiAnalysis.prevention_tips.map(
                        (tip: string, i: number) => (
                          <li key={i}>{tip}</li>
                        ),
                      )}
                    </ul>
                  </div>
                )}
              {currentEvent?.procedures &&
                currentEvent.procedures.length > 0 && (
                  <div className="mt-3">
                    <span className="text-xs text-emerald-300 font-medium flex items-center gap-1">
                      <ClipboardList className="w-3 h-3" /> Recommended
                      Procedures:
                    </span>
                    <ol className="list-decimal list-inside text-xs text-gray-300 mt-1 space-y-0.5">
                      {currentEvent.procedures.map(
                        (proc: string, i: number) => (
                          <li key={i}>{proc}</li>
                        ),
                      )}
                    </ol>
                  </div>
                )}
              {geminiAnalysis.should_contact_bank && (
                <div className="mt-3 flex items-center gap-2 text-xs text-red-300 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
                  <Phone className="w-3.5 h-3.5" />
                  <span className="font-medium">
                    Contact your bank&apos;s helpline immediately
                  </span>
                </div>
              )}
            </GlassCard>
          )}
          {geminiAnalysis && !showExplanation && (
            <button
              onClick={() => setShowExplanation(true)}
              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              <Brain className="w-3 h-3" /> Show AI Analysis
            </button>
          )}

          {/* Gauge + Score Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlassCard
              hover={false}
              className={cn(
                "p-8 flex flex-col items-center justify-center",
                riskScore >= 0.7 && "glow-red",
                riskScore >= 0.4 && riskScore < 0.7 && "glow-gold",
                riskScore < 0.4 && "glow-emerald",
              )}
            >
              <RiskGauge score={riskScore} size={200} />
              <span className="mt-3 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold uppercase">
                🤖 AI-Computed — Isolation Forest + RF/GB Ensemble
              </span>
              <p className="text-sm text-slate-400 mt-4 text-center max-w-xs">
                {riskScore >= 0.7
                  ? "High risk detected. Review recent logins and transactions immediately."
                  : riskScore >= 0.4
                    ? "Moderate risk. We noticed unusual activity on your account."
                    : "Your account is secure. No unusual activity detected."}
              </p>
            </GlassCard>

            <div className="space-y-4">
              {[
                {
                  label: "Cyber Score",
                  score: risk?.cyber_score ?? 0,
                  color: "#06b6d4",
                },
                {
                  label: "Financial Score",
                  score: risk?.financial_score ?? 0,
                  color: "#f59e0b",
                },
                {
                  label: "Graph Score",
                  score: risk?.graph_score ?? 0,
                  color: "#8b5cf6",
                },
                {
                  label: "ML Score",
                  score: risk?.ml_score ?? 0,
                  color: "#a855f7",
                },
              ].map((item) => (
                <GlassCard key={item.label} hover={false} className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                      {item.label}
                      {item.label === "ML Score" && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">AI</span>
                      )}
                    </span>
                    <span
                      className="text-sm font-bold font-mono"
                      style={{ color: item.color }}
                    >
                      {(item.score * 100).toFixed(0)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${item.score * 100}%`,
                        background: `linear-gradient(90deg, ${item.color}33, ${item.color})`,
                      }}
                    />
                  </div>
                </GlassCard>
              ))}
              {risk?.explanation && (
                <GlassCard hover={false} className="p-4">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {risk.explanation}
                  </p>
                </GlassCard>
              )}
            </div>
          </div>

          {/* ═══════ Emergency Freeze (high risk only) ═══════ */}
          {riskScore >= 0.65 && (
            <GlassCard
              hover={false}
              className="p-5 border border-red-500/30 bg-gradient-to-r from-red-500/10 to-orange-500/5"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-red-400" />
                    <span className="text-sm font-bold text-red-300">
                      Emergency Account Protection
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 max-w-md">
                    Your account shows signs of compromise. Freezing your
                    account will immediately block all transactions and protect
                    your funds.
                  </p>
                </div>
                <button
                  onClick={handleFreeze}
                  disabled={freezeLoading || freezeResult?.success === true}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 text-sm font-medium disabled:opacity-50 transition-colors"
                >
                  <Snowflake className="w-4 h-4" />
                  {freezeLoading
                    ? "Freezing…"
                    : freezeResult?.success
                      ? "Account Frozen ✓"
                      : "🚨 Freeze My Account"}
                </button>
              </div>

              {freezeResult && (
                <div
                  className={`mt-3 p-3 rounded-lg border text-xs ${
                    freezeResult.success
                      ? "bg-emerald-500/10 border-emerald-500/20"
                      : "bg-red-500/10 border-red-500/20"
                  }`}
                >
                  <p
                    className={
                      freezeResult.success ? "text-emerald-300" : "text-red-300"
                    }
                  >
                    {freezeResult.message}
                  </p>
                  {freezeResult.success && freezeResult.money_saved > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 text-emerald-300 font-semibold">
                      <IndianRupee className="w-3 h-3" />
                      ₹{freezeResult.money_saved.toLocaleString()} saved by
                      SurakshaFlow
                    </div>
                  )}
                </div>
              )}
            </GlassCard>
          )}

          {/* Risk Trend Chart */}
          {riskTrendData.length > 2 && (
            <GlassCard hover={false} className="p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-cyan-400" />
                Your Risk Trend (Live)
              </h3>
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={riskTrendData}>
                    <defs>
                      <linearGradient
                        id="userRiskGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#f59e0b"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="100%"
                          stopColor="#f59e0b"
                          stopOpacity={0.05}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                    <XAxis
                      dataKey="time"
                      tick={{ fill: "#9ca3af", fontSize: 9 }}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[0, 1]}
                      tick={{ fill: "#9ca3af", fontSize: 9 }}
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
                      stroke="#f59e0b"
                      fill="url(#userRiskGrad)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          )}

          {/* Security Alerts */}
          {liveWarnings.length > 0 && (
            <GlassCard hover={false} className="p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
                Security Alerts
                <span className="ml-auto text-xs text-gray-500">
                  {liveWarnings.length} alert
                  {liveWarnings.length !== 1 ? "s" : ""}
                </span>
              </h3>
              <div className="space-y-2">
                {liveWarnings.map((warning, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "rounded-xl border p-3 transition-all",
                      severityColor(warning.severity),
                      idx === 0 && isRunning && "animate-pulse",
                    )}
                  >
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() =>
                        setExpandedWarning(
                          expandedWarning === idx ? null : idx,
                        )
                      }
                    >
                      <div className="flex items-center gap-2">
                        {severityIcon(warning.severity)}
                        <span className="text-xs font-semibold">
                          {warning.title}
                        </span>
                        <span className="text-[10px] uppercase font-medium opacity-60">
                          {warning.severity}
                        </span>
                      </div>
                      {expandedWarning === idx ? (
                        <ChevronUp className="w-3.5 h-3.5 opacity-50" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                      )}
                    </div>
                    {expandedWarning === idx && (
                      <div className="mt-2 space-y-2 text-xs">
                        <p className="opacity-80">{warning.detail}</p>
                        <p className="font-medium flex items-center gap-1">
                          <Shield className="w-3 h-3" /> {warning.action}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Device Activity */}
          <GlassCard hover={false} className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-cyan-400" />
              Recent Device Activity
              {isRunning && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                  LIVE
                </span>
              )}
            </h3>
            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {cyberEvents.length === 0 && (
                <p className="text-xs text-slate-600">
                  No recent device activity.
                </p>
              )}
              {cyberEvents.map((event, idx) => (
                <div
                  key={event.id || idx}
                  className={cn(
                    "flex justify-between items-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]",
                    idx === 0 && isRunning && "border-cyan-500/20",
                  )}
                >
                  <div>
                    <p className="text-xs font-medium text-white flex items-center gap-1">
                      {(event.event_type || event.type || "").replace(
                        /_/g,
                        " ",
                      )}
                      {(event.anomaly_score ?? event.riskScore) > 0.5 && (
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                      )}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {event.ip_geo || event.ipLocation} •{" "}
                      {event.device_id || event.deviceId} •{" "}
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-md",
                      (event.anomaly_score ?? event.riskScore) > 0.7
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : (event.anomaly_score ?? event.riskScore) > 0.4
                          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                    )}
                  >
                    {((event.anomaly_score ?? event.riskScore) * 100).toFixed(0)}
                    %
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Early Warning Banner */}
          {riskScore >= 0.4 && (
            <GlassCard
              hover={false}
              className="p-5 flex gap-4 items-start glow-gold"
            >
              <div className="p-2 rounded-full bg-amber-500/10 text-amber-400 shrink-0">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-amber-300 mb-1">
                  {riskScore >= 0.7
                    ? "Critical: Immediate Action Required"
                    : "Early Warning: Unusual Activity Detected"}
                </h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  {riskScore >= 0.7
                    ? "Multiple high-risk indicators detected. Your account security may be compromised."
                    : "Unusual patterns detected. Review recent activity to ensure everything is legitimate."}
                </p>
                <div className="flex gap-3">
                  <button className="btn-primary text-xs">
                    Secure My Account
                  </button>
                  <button className="btn-ghost text-xs">This was me</button>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════
           TAB: TRANSACTIONS
         ═══════════════════════════════════════════════════ */}
      {activeTab === "transactions" && (
        <div className="space-y-6">
          {/* Recent Transactions */}
          <GlassCard hover={false} className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-amber-400" />
              Recent Transactions
              {isRunning && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/20">
                  LIVE
                </span>
              )}
              <span className="ml-auto text-xs text-gray-500">
                {financialEvents.length} transaction
                {financialEvents.length !== 1 ? "s" : ""}
              </span>
            </h3>
            <div className="space-y-2.5">
              {financialEvents.length === 0 && (
                <p className="text-xs text-slate-600">
                  No recent transactions.
                </p>
              )}
              {financialEvents.map((tx, idx) => {
                const hasFlags = tx.risk_flags && tx.risk_flags.length > 0;
                return (
                  <div
                    key={tx.id || idx}
                    className={cn(
                      "flex justify-between items-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]",
                      idx === 0 && isRunning && "border-amber-500/20",
                      hasFlags && "border-amber-500/15",
                    )}
                  >
                    <div>
                      <p className="text-xs font-medium text-white flex items-center gap-1">
                        To: {tx.receiver || tx.receiverId}
                        {hasFlags && (
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                        )}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {(tx.method || tx.type || "").toUpperCase()} •{" "}
                        {new Date(tx.timestamp).toLocaleTimeString()}
                        {hasFlags && (
                          <span className="ml-1 text-amber-400">
                            {tx.risk_flags!.join(", ")}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-white font-mono">
                      ₹{tx.amount.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* SMS Scam Analyzer */}
          <GlassCard hover={false} className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <MessageSquareWarning className="h-4 w-4 text-amber-400" />
              SMS / Message Scam Detector
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 font-bold">
                🤖 Gemini 2.5 Flash · LLM
              </span>
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={smsText}
                onChange={(e) => setSmsText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSMSCheck()}
                placeholder="Paste a suspicious SMS or message here..."
                className="auth-input flex-1"
              />
              <button
                onClick={handleSMSCheck}
                disabled={smsLoading || !smsText.trim()}
                className="btn-primary flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
              >
                {smsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Analyze
              </button>
            </div>
            {smsResult && (
              <div
                className={cn(
                  "mt-4 p-4 rounded-xl border",
                  smsResult.is_scam
                    ? "bg-red-500/5 border-red-500/15"
                    : "bg-emerald-500/5 border-emerald-500/15",
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {smsResult.is_scam ? (
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  )}
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      smsResult.is_scam ? "text-red-400" : "text-emerald-400",
                    )}
                  >
                    {smsResult.is_scam ? "Likely Scam" : "Appears Safe"}
                  </span>
                  <span className="text-xs text-slate-500 ml-auto font-mono">
                    {(smsResult.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {smsResult.explanation}
                </p>
                {smsResult.risk_indicators &&
                  smsResult.risk_indicators.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {smsResult.risk_indicators.map((ind, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/[0.06]"
                        >
                          {ind}
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </GlassCard>

          {/* Email Phishing Analyzer */}
          <GlassCard hover={false} className="p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Mail className="h-4 w-4 text-red-400" />
              Email Phishing Detector
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 font-bold">
                🤖 Gemini 2.5 Flash · LLM
              </span>
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="email"
                  value={emailSender}
                  onChange={(e) => setEmailSender(e.target.value)}
                  placeholder="Sender email (optional)"
                  className="auth-input"
                />
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Subject line (optional)"
                  className="auth-input"
                />
              </div>
              <textarea
                value={emailContent}
                onChange={(e) => setEmailContent(e.target.value)}
                placeholder="Paste the suspicious email content here..."
                className="auth-input w-full min-h-[100px] resize-y"
                rows={4}
              />
              <button
                onClick={handleEmailCheck}
                disabled={emailLoading || !emailContent.trim()}
                className="btn-primary flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
              >
                {emailLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Analyze Email
              </button>
            </div>
            {emailResult && (
              <div
                className={cn(
                  "mt-4 p-4 rounded-xl border",
                  emailResult.is_phishing
                    ? "bg-red-500/5 border-red-500/15"
                    : "bg-emerald-500/5 border-emerald-500/15",
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  {emailResult.is_phishing ? (
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  )}
                  <span
                    className={cn(
                      "text-sm font-semibold",
                      emailResult.is_phishing
                        ? "text-red-400"
                        : "text-emerald-400",
                    )}
                  >
                    {emailResult.is_phishing
                      ? "Phishing Email Detected"
                      : "Appears Safe"}
                  </span>
                  <span className="text-xs text-slate-500 ml-auto font-mono">
                    {(emailResult.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
                {emailResult.threat_type &&
                  emailResult.threat_type !== "unknown" && (
                    <p className="text-xs text-amber-400 mb-1">
                      <strong>Threat Type:</strong> {emailResult.threat_type}
                    </p>
                  )}
                <p className="text-xs text-slate-400 leading-relaxed">
                  {emailResult.explanation}
                </p>
                {emailResult.recommended_action && (
                  <p className="text-xs text-cyan-400 mt-1">
                    <strong>Action:</strong> {emailResult.recommended_action}
                  </p>
                )}
                {emailResult.risk_indicators &&
                  emailResult.risk_indicators.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {emailResult.risk_indicators.map((ind, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/[0.06]"
                        >
                          {ind}
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </div>
  );
}
