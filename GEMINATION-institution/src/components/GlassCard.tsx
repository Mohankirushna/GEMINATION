import { type ReactNode, type HTMLAttributes } from "react";
import { cn } from "../lib/utils";

type GlassCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  hover?: boolean;
  glow?: "gold" | "red" | "emerald" | "cyan";
};

export default function GlassCard({
  children,
  className,
  hover = true,
  glow,
  onClick,
  ...rest
}: GlassCardProps) {
  const glowMap = {
    gold: "glow-gold",
    red: "glow-red",
    emerald: "glow-emerald",
    cyan: "glow-cyan",
  };

  return (
    <div
      {...rest}
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
