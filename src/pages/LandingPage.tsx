import { Link } from "react-router-dom";
import {
  Shield,
  Building2,
  UserCircle,
  Zap,
  Network,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import GlassCard from "../components/GlassCard";

const features = [
  {
    icon: <ShieldAlert className="h-5 w-5" />,
    title: "Unified Risk Engine",
    desc: "Fuse cyber signals with financial anomalies into a single 0-100 score using weighted ML scoring.",
  },
  {
    icon: <Network className="h-5 w-5" />,
    title: "Graph Intelligence",
    desc: "Detect mule rings via centrality, PageRank, and Louvain community detection on live txn graphs.",
  },
  {
    icon: <Sparkles className="h-5 w-5" />,
    title: "Gemini 2.5 Flash AI",
    desc: "Natural-language alert explanations, SMS scam detection, and STR report auto-generation.",
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Digital Twin Simulation",
    desc: 'Model "what-if" freeze scenarios to find the optimal intervention point before acting.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-cyan-500/10 via-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl w-full space-y-16 text-center">
        {/* ── Hero ─────────────────────────────────────────── */}
        <div className="space-y-6">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Shield className="h-10 w-10 text-[#0a0e1a]" />
              </div>
              <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-400 border-2 border-[#0a0e1a] pulse-dot" />
            </div>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            <span className="text-gradient">SurakshaFlow</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Unified Cyber-Financial Intelligence Platform. Fusing SOC signals
            with AML monitoring to detect and disrupt money mule networks in{" "}
            <span className="text-amber-400 font-medium">real-time</span>.
          </p>
        </div>

        {/* ── Role Cards ──────────────────────────────────── */}
        <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
          <Link to="/auth">
            <GlassCard className="p-8 group text-left h-full" glow="cyan">
              <div className="h-14 w-14 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <Building2 className="h-7 w-7 text-cyan-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                Financial Institution
                <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-cyan-400" />
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Monitor unified risk scores, view graph analytics, generate STR
                reports, and act on Gemini AI-powered alerts.
              </p>
            </GlassCard>
          </Link>

          <Link to="/auth">
            <GlassCard className="p-8 group text-left h-full" glow="emerald">
              <div className="h-14 w-14 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                <UserCircle className="h-7 w-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2 flex items-center gap-2">
                End User
                <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-emerald-400" />
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                View your personal risk meter, check SMS scam detection, monitor
                linked accounts, and receive early warnings.
              </p>
            </GlassCard>
          </Link>
        </div>

        {/* ── Features Grid ───────────────────────────────── */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {features.map((f) => (
            <GlassCard key={f.title} hover={false} className="p-5 text-left">
              <div className="h-9 w-9 rounded-lg bg-white/[0.05] flex items-center justify-center text-amber-400 mb-3">
                {f.icon}
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">
                {f.title}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
            </GlassCard>
          ))}
        </div>

        {/* ── Footer ──────────────────────────────────────── */}
        <p className="text-xs text-slate-600 pt-4">
          Built for the Google × TiDB Future of AI Hackathon • Powered by Gemini
          2.5 Flash + Firebase + FastAPI
        </p>
      </div>
    </div>
  );
}
