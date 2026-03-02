import { useEffect, useState } from "react";

interface RiskGaugeProps {
  score: number; // 0..1
  size?: number;
  label?: string;
}

export default function RiskGauge({
  score,
  size = 180,
  label,
}: RiskGaugeProps) {
  const [offset, setOffset] = useState(283);
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const arc = circumference * 0.75; // 270° arc

  const color = score >= 0.7 ? "#ef4444" : score >= 0.4 ? "#f59e0b" : "#10b981";

  const gradientId = `gauge-grad-${Math.random().toString(36).slice(2, 6)}`;

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(arc - arc * Math.min(score, 1));
    }, 100);
    return () => clearTimeout(timer);
  }, [score, arc]);

  const level =
    score >= 0.7 ? "HIGH RISK" : score >= 0.4 ? "MEDIUM" : "LOW RISK";

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox="0 0 100 100">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop
              offset="0%"
              stopColor={score >= 0.4 ? "#f59e0b" : "#10b981"}
            />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
          {/* Glow filter */}
          <filter id={`glow-${gradientId}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Track */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          className="risk-gauge-track"
          strokeDasharray={`${arc} ${circumference}`}
          strokeDashoffset={0}
          transform="rotate(135 50 50)"
        />

        {/* Fill */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          className="risk-gauge-fill"
          stroke={`url(#${gradientId})`}
          strokeDasharray={`${arc} ${circumference}`}
          strokeDashoffset={offset}
          transform="rotate(135 50 50)"
          filter={`url(#glow-${gradientId})`}
        />

        {/* Score text */}
        <text
          x="50"
          y="46"
          textAnchor="middle"
          className="fill-white font-bold"
          style={{ fontSize: "18px", fontFamily: "var(--font-mono)" }}
        >
          {Math.round(score * 100)}
        </text>
        <text
          x="50"
          y="58"
          textAnchor="middle"
          style={{ fontSize: "6px", fill: "#94a3b8", letterSpacing: "0.1em" }}
        >
          {level}
        </text>
      </svg>
      {label && <span className="text-xs text-slate-400 mt-1">{label}</span>}
    </div>
  );
}
