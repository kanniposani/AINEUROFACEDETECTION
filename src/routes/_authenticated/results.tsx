import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GlassCard } from "@/components/glass-card";
import { Disclaimer } from "@/components/disclaimer";
import { FormulaPanel } from "@/components/formula-panel";
import { MiniGauge, ScoreMeter } from "@/components/score-meter";
import { supabase } from "@/integrations/supabase/client";
import { downloadScanReport } from "@/lib/report-pdf";
import { stressBand, suggestionsFor, type ScanMetrics } from "@/lib/scoring";
import { SCAN_RESULT_KEY } from "./scan";

export const Route = createFileRoute("/_authenticated/results")({
  head: () => ({
    meta: [
      { title: "Scan Results — NeuroFace AI" },
      {
        name: "description",
        content:
          "Your Stress Index with a full breakdown of fatigue, tension, symmetry and blink-rate signals, plus a downloadable PDF report.",
      },
      { property: "og:title", content: "Scan Results — NeuroFace AI" },
      {
        property: "og:description",
        content: "See your Stress Index breakdown and general wellness suggestions.",
      },
    ],
  }),
  component: ResultsPage,
});

type StoredResult = ScanMetrics & { capturedAt: string };

function ResultsPage() {
  const navigate = useNavigate();
  const [result, setResult] = useState<StoredResult | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem(SCAN_RESULT_KEY);
    if (!raw) {
      setState("empty");
      return;
    }
    try {
      setResult(JSON.parse(raw) as StoredResult);
      setState("ready");
    } catch {
      setState("empty");
    }
  }, []);

  const saveScan = useMutation({
    mutationFn: async (r: StoredResult) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("You need to be signed in to save a scan.");
      const { error } = await supabase.from("scans").insert({
        user_id: userData.user.id,
        stress_index: r.stressIndex,
        fatigue_level: r.fatigueLevel,
        tension_level: r.tensionLevel,
        symmetry_score: r.symmetryScore,
        blink_rate: r.blinkRate,
        raw_metrics: r.raw,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSaved(true);
      toast.success("Scan saved to your history");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not save the scan"),
  });

  if (state === "loading") {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (state === "empty" || !result) {
    return (
      <div className="mx-auto max-w-md pt-10 text-center">
        <GlassCard>
          <h1 className="text-xl font-semibold">No scan result yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Results live only in this browser session until you save them. Run a scan to see your
            Stress Index.
          </p>
          <Button asChild className="mt-5 min-h-11 w-full">
            <Link to="/scan">Start a scan</Link>
          </Button>
        </GlassCard>
      </div>
    );
  }

  const band = stressBand(result.stressIndex);
  const suggestions = suggestionsFor({
    stressIndex: result.stressIndex,
    fatigueLevel: result.fatigueLevel,
    tensionLevel: result.tensionLevel,
    blinkRate: result.blinkRate,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl space-y-5"
    >
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Your scan results</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          {new Date(result.capturedAt).toLocaleString()} · {result.raw.frames} frames ·{" "}
          {result.raw.durationSec}s
        </p>
      </header>

      <GlassCard glow className="flex flex-col items-center gap-4 py-8 text-center">
        <ScoreMeter value={result.stressIndex} />
        <p className="max-w-sm text-sm text-muted-foreground">{band.summary}</p>
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-2">
        <GlassCard className="space-y-4">
          <MiniGauge label="Fatigue level" value={result.fatigueLevel} />
          <MiniGauge label="Tension level" value={result.tensionLevel} />
        </GlassCard>
        <GlassCard className="space-y-4">
          <MiniGauge label="Symmetry score" value={result.symmetryScore} higherIsBetter />
          <MiniGauge
            label="Blink rate"
            value={result.blinkRate}
            suffix=" /min"
            max={40}
          />
        </GlassCard>
      </div>

      <GlassCard>
        <h2 className="text-base font-semibold">What this means</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Your signals sit in the <span className="font-medium text-foreground">{band.label}</span>{" "}
          band. These are general wellness suggestions, not medical advice:
        </p>
        <ul className="mt-3 space-y-2">
          {suggestions.map((s) => (
            <li key={s} className="flex gap-2 text-sm text-muted-foreground">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              {s}
            </li>
          ))}
        </ul>
      </GlassCard>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="min-h-11 flex-1"
          onClick={() => saveScan.mutate(result)}
          disabled={saveScan.isPending || saved}
        >
          {saveScan.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
          {saved ? "Saved to history" : "Save to history"}
        </Button>
        <Button
          variant="outline"
          className="min-h-11 flex-1"
          onClick={() =>
            downloadScanReport({
              created_at: result.capturedAt,
              stress_index: result.stressIndex,
              fatigue_level: result.fatigueLevel,
              tension_level: result.tensionLevel,
              symmetry_score: result.symmetryScore,
              blink_rate: result.blinkRate,
            })
          }
        >
          <Download aria-hidden="true" />
          Download PDF report
        </Button>
        <Button variant="ghost" className="min-h-11" onClick={() => navigate({ to: "/scan" })}>
          <RotateCcw aria-hidden="true" />
          Re-scan
        </Button>
      </div>

      <FormulaPanel />
      <Disclaimer />
    </motion.div>
  );
}
