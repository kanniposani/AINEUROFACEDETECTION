import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function Disclaimer({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground",
        className,
      )}
    >
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-moderate" aria-hidden="true" />
      <span>
        This tool provides wellness insights for educational purposes and is not a substitute for
        professional medical advice. Signals are approximate, camera-derived proxies — not
        clinically validated measurements.
      </span>
    </p>
  );
}
