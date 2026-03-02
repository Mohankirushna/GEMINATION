import { cn } from "../lib/utils";

interface RiskBadgeProps {
  level: "critical" | "high" | "medium" | "low";
  className?: string;
}

export default function RiskBadge({ level, className }: RiskBadgeProps) {
  return (
    <span className={cn("badge", `badge-${level}`, className)}>{level}</span>
  );
}

export function scoreToBadgeLevel(
  score: number,
): "critical" | "high" | "medium" | "low" {
  if (score >= 0.85) return "critical";
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}
