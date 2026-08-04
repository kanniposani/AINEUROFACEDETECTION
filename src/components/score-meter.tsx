import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { stressBand, positiveBand } from "@/lib/scoring";

const TOKEN_CLASS: Record<string, string> = {
  excellent: "text-excellent",
  good: "text-good",
  moderate: "text-moderate",
  warning: "text-warning",
  critical: "text-critical",
};

const TOKEN_STROKE: Record<string, string> = {
  excellent: "stroke-excellent",
  good: "stroke-good",
  moderate: "stroke-moderate",
  warning: "stroke-warning",
  critical: "stroke-critical",
};

export function ScoreMeter({
  value,
  label = "Stress Index",
  size = 240,
}: {
  value: number;
  label?: string;
  size?: number;
}) {
  const band = stressBand(value);
  const r = size / 2 - 14;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="meter"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${label}: ${value} out of 100, ${band.label}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="stroke-muted"
          strokeWidth={12}
          fill="none"
          opacity={0.6}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className={TOKEN_STROKE[band.token]}
          strokeWidth={12}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (c * value) / 100 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={cn("font-mono text-5xl font-bold tabular-nums", TOKEN_CLASS[band.token])}>
          {value}
        </span>
        <span className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </span>
        <span className={cn("mt-1 text-sm font-medium", TOKEN_CLASS[band.token])}>{band.label}</span>
      </div>
    </div>
  );
}

export function MiniGauge({
  label,
  value,
  suffix = "/100",
  higherIsBetter = false,
  max = 100,
}: {
  label: string;
  value: number;
  suffix?: string;
  higherIsBetter?: boolean;
  max?: number;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const token = higherIsBetter ? positiveBand(value) : stressBand(pct).token;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={cn("font-mono text-lg font-semibold tabular-nums", TOKEN_CLASS[token])}>
          {value}
          <span className="ml-0.5 text-xs text-muted-foreground">{suffix}</span>
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn("h-full rounded-full", {
            "bg-excellent": token === "excellent",
            "bg-good": token === "good",
            "bg-moderate": token === "moderate",
            "bg-warning": token === "warning",
            "bg-critical": token === "critical",
          })}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
