import { cn } from "../lib/utils";

interface SkeletonProps {
  className?: string;
  lines?: number;
}

export default function LoadingSkeleton({
  className,
  lines = 3,
}: SkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton h-4"
          style={{ width: `${85 - i * 15}%` }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("glass-card-static p-6 space-y-4", className)}>
      <div className="flex items-center gap-3">
        <div className="skeleton h-10 w-10 rounded-xl" />
        <div className="space-y-2 flex-1">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-5 w-16" />
        </div>
      </div>
      <div className="skeleton h-3 w-32" />
    </div>
  );
}
