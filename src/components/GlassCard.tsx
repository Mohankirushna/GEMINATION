import { ReactNode } from "react";
import { cn } from "../lib/utils";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: "gold" | "red" | "emerald" | "cyan";
  onClick?: () => void;
}

export default function GlassCard({
  children,
  className,
  hover = true,
  glow,
  onClick,
}: GlassCardProps) {
  const glowMap = {
    gold: "glow-gold",
    red: "glow-red",
    emerald: "glow-emerald",
    cyan: "glow-cyan",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        hover ? "glass-card" : "glass-card-static",
        glow && glowMap[glow],
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}
