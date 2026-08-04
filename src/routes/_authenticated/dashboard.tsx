import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, Flame, Minus, ScanFace, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GlassCard } from "@/components/glass-card";
import { Disclaimer } from "@/components/disclaimer";
import { supabase } from "@/integrations/supabase/client";
import { downloadScanReport } from "@/lib/report-pdf";
import { stressBand } from "@/lib/scoring";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — NeuroFace AI" },
      {
        name: "description",
        content:
          "Track your Stress Index over time with 7 day, 30 day and all-time trends, streaks and past scan details.",
      },
      { property: "og:title", content: "Dashboard — NeuroFace AI" },
      {
        property: "og:description",
        content: "Your NeuroFace AI wellness signal history and trend chart.",
      },
    ],
  }),
  component: DashboardPage,
});

export type ScanRow = {
  id: string;
  stress_index: number;
  fatigue_level: number;
  tension_level: number;
  symmetry_score: number;
  blink_rate: number;
  created_at: string;
};

const RANGES = { "7": 7, "30": 30, all: 0 } as const;
type RangeKey = keyof typeof RANGES;

function DashboardPage() {
  const [range, setRange] = useState<RangeKey>("7");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["scans"],
    queryFn: async (): Promise<ScanRow[]> => {
      const { data, error } = await supabase
        .from("scans")
        .select("id,stress_index,fatigue_level,tension_level,symmetry_score,blink_rate,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const scans = data ?? [];

  const filtered = useMemo(() => {
    const days = RANGES[range];
    if (!days) return scans;
    const cutoff = Date.now() - days * 86_400_000;
    return scans.filter((s) => new Date(s.created_at).getTime() >= cutoff);
  }, [scans, range]);

  const stats = useMemo(() => {
    const latest = scans[0];
    const week = scans.filter(
      (s) => new Date(s.created_at).getTime() >= Date.now() - 7 * 86_400_000,
    );
    const weekAvg = week.length
      ? Math.round(week.reduce((a, s) => a + s.stress_index, 0) / week.length)
      : null;
    const prev = scans[1];
    const delta = latest && prev ? latest.stress_index - prev.stress_index : null;

    const days = new Set(scans.map((s) => new Date(s.created_at).toDateString()));
    let streak = 0;
    for (let i = 0; i < 400; i += 1) {
      const d = new Date(Date.now() - i * 86_400_000).toDateString();
      if (days.has(d)) streak += 1;
      else if (i > 0) break;
    }
    return { latest, weekAvg, delta, streak };
  }, [scans]);

  const chartData = useMemo(
    () =>
      [...filtered].reverse().map((s) => ({
        label: new Date(s.created_at).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        stress: s.stress_index,
      })),
    [filtered],
  );

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-8 w-52" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <GlassCard className="mx-auto max-w-md text-center">
        <h1 className="text-lg font-semibold">Couldn't load your history</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong reaching your data. Please try again.
        </p>
        <Button className="mt-5 min-h-11 w-full" onClick={() => refetch()}>
          Retry
        </Button>
      </GlassCard>
    );
  }

  if (!scans.length) {
    return (
      <div className="mx-auto max-w-md space-y-4 pt-8 text-center">
        <GlassCard glow>
          <ScanFace className="mx-auto size-10 text-primary" aria-hidden="true" />
          <h1 className="mt-4 text-xl font-semibold">No scans yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Take your first 10 second face scan to establish a baseline. Your trend chart appears
            here once you have saved a scan.
          </p>
          <Button asChild className="mt-5 min-h-11 w-full animate-pulse-glow">
            <Link to="/scan">Take your first scan</Link>
          </Button>
        </GlassCard>
        <Disclaimer />
      </div>
    );
  }

  const TrendIcon = stats.delta === null || stats.delta === 0 ? Minus : stats.delta < 0 ? TrendingDown : TrendingUp;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scans.length} saved scan{scans.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link to="/scan">
            <ScanFace aria-hidden="true" />
            New scan
          </Link>
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Latest score</p>
          <p className="mt-2 font-mono text-4xl font-bold">{stats.latest?.stress_index ?? "—"}</p>
          {stats.latest && (
            <Badge variant="outline" className="mt-2">
              {stressBand(stats.latest.stress_index).label}
            </Badge>
          )}
        </GlassCard>
        <GlassCard>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">7-day average</p>
          <p className="mt-2 font-mono text-4xl font-bold">{stats.weekAvg ?? "—"}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <TrendIcon
              className={cn(
                "size-4",
                stats.delta === null || stats.delta === 0
                  ? "text-muted-foreground"
                  : stats.delta < 0
                    ? "text-excellent"
                    : "text-warning",
              )}
              aria-hidden="true"
            />
            {stats.delta === null
              ? "Not enough scans to compare"
              : stats.delta === 0
                ? "No change since last scan"
                : `${Math.abs(stats.delta)} pts ${stats.delta < 0 ? "lower" : "higher"} than last scan`}
          </p>
        </GlassCard>
        <GlassCard>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Check-in streak</p>
          <p className="mt-2 flex items-center gap-2 font-mono text-4xl font-bold">
            <Flame className="size-7 text-moderate" aria-hidden="true" />
            {stats.streak}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {stats.streak === 0
              ? "Scan today to start a streak"
              : `${stats.streak} day${stats.streak === 1 ? "" : "s"} of consistent check-ins`}
          </p>
        </GlassCard>
      </div>

      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Stress Index trend</h2>
          <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey)}>
            <TabsList>
              <TabsTrigger value="7">7 days</TabsTrigger>
              <TabsTrigger value="30">30 days</TabsTrigger>
              <TabsTrigger value="all">All time</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {chartData.length ? (
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: -18, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="stressFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="var(--muted-foreground)"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    color: "var(--popover-foreground)",
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="stress"
                  name="Stress Index"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#stressFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            No scans in this range. Try a wider time window.
          </p>
        )}
      </GlassCard>

      <GlassCard>
        <h2 className="text-base font-semibold">Past scans</h2>
        <ul className="mt-3 divide-y divide-border">
          {filtered.map((s) => {
            const band = stressBand(s.stress_index);
            return (
              <li key={s.id}>
                <Collapsible>
                  <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between gap-3 py-3 text-left">
                    <div>
                      <p className="text-sm font-medium">
                        {new Date(s.created_at).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.created_at).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{band.label}</Badge>
                      <span className="font-mono text-lg font-semibold tabular-nums">
                        {s.stress_index}
                      </span>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <dl className="grid grid-cols-2 gap-3 pb-4 text-sm sm:grid-cols-4">
                      <Detail label="Fatigue" value={s.fatigue_level} />
                      <Detail label="Tension" value={s.tension_level} />
                      <Detail label="Symmetry" value={s.symmetry_score} />
                      <Detail label="Blink /min" value={s.blink_rate} />
                    </dl>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mb-4 min-h-11"
                      onClick={() => downloadScanReport(s)}
                    >
                      <Download aria-hidden="true" />
                      PDF report
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      </GlassCard>

      <Disclaimer />
    </motion.div>
  );
}

function Detail({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-base font-semibold">{value}</dd>
    </div>
  );
}
