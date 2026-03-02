import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  target: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  decimals?: number;
}

export default function AnimatedCounter({
  target,
  duration = 1200,
  prefix = "",
  suffix = "",
  className = "",
  decimals = 0,
}: AnimatedCounterProps) {
  const [value, setValue] = useState(0);
  const ref = useRef(0);
  const start = useRef(0);
  const raf = useRef<number>();

  useEffect(() => {
    start.current = performance.now();
    ref.current = 0;

    const step = (now: number) => {
      const elapsed = now - start.current;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      ref.current = eased * target;
      setValue(ref.current);
      if (progress < 1) raf.current = requestAnimationFrame(step);
    };

    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);

  const display =
    decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString();

  return (
    <span className={className} style={{ fontFamily: "var(--font-mono)" }}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}
