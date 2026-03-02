import { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  CreditCard,
  MessageSquareWarning,
  Send,
  ArrowRight,
  Loader2,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { cn } from "../lib/utils";
import {
  generateMockCyberEvents,
  generateMockFinancialTransactions,
} from "../services/mockData";
import {
  CyberEvent,
  FinancialTransaction,
  UserRiskResponse,
  SMSAnalysisResult,
} from "../types";
import { fetchUserRisk, fetchUserEvents, analyzeSMS } from "../services/api";
import GlassCard from "../components/GlassCard";
import RiskGauge from "../components/RiskGauge";
import LoadingSkeleton from "../components/LoadingSkeleton";

const DEMO_ACCOUNT = "acc_priya";

export default function UserDashboard() {
  const [risk, setRisk] = useState<UserRiskResponse | null>(null);
  const [cyberEvents, setCyberEvents] = useState<CyberEvent[]>([]);
  const [financialEvents, setFinancialEvents] = useState<
    FinancialTransaction[]
  >([]);
  const [loading, setLoading] = useState(true);

  // SMS Analyzer
  const [smsText, setSmsText] = useState("");
  const [smsResult, setSmsResult] = useState<SMSAnalysisResult | null>(null);
  const [smsLoading, setSmsLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [r, events] = await Promise.all([
          fetchUserRisk(DEMO_ACCOUNT),
          fetchUserEvents(DEMO_ACCOUNT),
        ]);
        setRisk(r);
        setCyberEvents(events.cyber_events ?? []);
        setFinancialEvents(events.financial_transactions ?? []);
      } catch {
        // Fallback to mock
        setRisk({
          account_id: DEMO_ACCOUNT,
          unified_score: 0.65,
          cyber_score: 0.7,
          financial_score: 0.5,
          graph_score: 0.3,
          risk_level: "medium",
        });
        setCyberEvents(generateMockCyberEvents().slice(0, 2));
        setFinancialEvents(generateMockFinancialTransactions().slice(0, 3));
      }
      setLoading(false);
    })();
  }, []);

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

  const riskScore = risk?.unified_score ?? 0.65;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
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
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          My Security Dashboard
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Monitor your personal risk and account activity.
        </p>
      </div>

      {/* ── Top Row: Gauge + Score Breakdown ────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Gauge */}
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
          <p className="text-sm text-slate-400 mt-4 text-center max-w-xs">
            {riskScore >= 0.7
              ? "High risk detected. Please review recent logins and transactions immediately."
              : riskScore >= 0.4
                ? "Moderate risk. We noticed some unusual activity on your account."
                : "Your account is secure. No unusual activity detected."}
          </p>
        </GlassCard>

        {/* Score Breakdown */}
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
          ].map((item) => (
            <GlassCard key={item.label} hover={false} className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-slate-400">
                  {item.label}
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

          {/* Risk explanation */}
          {risk?.explanation && (
            <GlassCard hover={false} className="p-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                {risk.explanation}
              </p>
            </GlassCard>
          )}
        </div>
      </div>

      {/* ── Activity Rows ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Device Activity */}
        <GlassCard hover={false} className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-cyan-400" />
            Recent Device Activity
          </h3>
          <div className="space-y-2.5">
            {cyberEvents.length === 0 && (
              <p className="text-xs text-slate-600">
                No recent device activity.
              </p>
            )}
            {cyberEvents.map((event) => (
              <div
                key={event.id}
                className="flex justify-between items-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div>
                  <p className="text-xs font-medium text-white">
                    {(event.event_type || event.type || "").replace(/_/g, " ")}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {event.ip_geo || event.ipLocation} •{" "}
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                {(event.anomaly_score ?? event.riskScore) > 0.7 && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Review
                  </span>
                )}
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Recent Transactions */}
        <GlassCard hover={false} className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-amber-400" />
            Recent Transactions
          </h3>
          <div className="space-y-2.5">
            {financialEvents.length === 0 && (
              <p className="text-xs text-slate-600">No recent transactions.</p>
            )}
            {financialEvents.map((tx) => (
              <div
                key={tx.id}
                className="flex justify-between items-center p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div>
                  <p className="text-xs font-medium text-white">
                    To: {tx.receiver || tx.receiverId}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {(tx.method || tx.type || "").toUpperCase()} •{" "}
                    {new Date(tx.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <span className="text-sm font-semibold text-white font-mono">
                  ₹{tx.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* ── SMS Scam Analyzer ───────────────────────────── */}
      <GlassCard hover={false} className="p-5">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <MessageSquareWarning className="h-4 w-4 text-amber-400" />
          SMS / Message Scam Detector
          <span className="text-[10px] font-normal text-slate-500">
            Powered by Gemini AI
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

      {/* ── Early Warning Banner ────────────────────────── */}
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
              Early Warning: Potential Mule Activity
            </h3>
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              We detected a login from an unrecognized device, followed by rapid
              fund transfers. This pattern is often associated with account
              takeovers or money mule recruitment.
            </p>
            <div className="flex gap-3">
              <button className="btn-primary text-xs">Secure My Account</button>
              <button className="btn-ghost text-xs">This was me</button>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
