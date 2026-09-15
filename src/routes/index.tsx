import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Activity, BarChart3, Brain, Lock, ScanFace, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/glass-card";
import { Disclaimer } from "@/components/disclaimer";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NeuroFace AI — Facial Stress & Wellness Screening" },
      {
        name: "description",
        content:
          "Scan your face with your device camera and get an instant Stress Index from 468 real-time facial landmarks. Private, in-browser, educational wellness screening.",
      },
      { property: "og:title", content: "NeuroFace AI — Facial Stress & Wellness Screening" },
      {
        property: "og:description",
        content:
          "Estimate stress, fatigue, tension and facial symmetry signals in seconds. All processing happens in your browser — no video is ever uploaded.",
      },
    ],
  }),
  component: Landing,
});

const STEPS = [
  {
    icon: ScanFace,
    title: "Scan",
    body: "Your camera streams locally while a 468-point face mesh locks onto your features.",
  },
  {
    icon: Brain,
    title: "Analyze",
    body: "Blink rate, brow and jaw tension, micro-expression variance and symmetry are measured.",
  },
  {
    icon: BarChart3,
    title: "Results",
    body: "A transparent Stress Index plus sub-metrics, suggestions and a downloadable report.",
  },
];

function Landing() {
  const { session } = useSession();

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 grid-backdrop" aria-hidden="true" />

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-primary" aria-hidden="true" />
          <span className="font-mono text-sm font-semibold tracking-tight">NEUROFACE AI</span>
        </div>
        <nav aria-label="Account" className="flex items-center gap-2">
          {session ? (
            <Button asChild size="sm">
              <Link to="/dashboard">Go to dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="min-h-11">
                <Link to="/auth" search={{ mode: "login" }}>
                  Sign in
                </Link>
              </Button>
              <Button asChild size="sm" className="min-h-11">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Sign up
                </Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <section className="relative mx-auto w-full max-w-3xl px-4 pb-16 pt-12 text-center sm:pt-20">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground"
        >
          <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
          Real-time facial landmark ML, running in your browser
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-6 text-4xl font-bold leading-[1.1] tracking-tight sm:text-6xl"
        >
          Read your <span className="neon-text">stress signals</span> from a 10 second face scan
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mx-auto mt-5 max-w-xl text-base text-muted-foreground"
        >
          NeuroFace AI tracks 468 facial landmarks live to estimate a Stress Index alongside
          fatigue, tension, symmetry and blink-rate indicators — with a fully documented scoring
          formula.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.18 }}
          className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button asChild size="lg" className="min-h-11 w-full animate-pulse-glow sm:w-auto">
            {session ? (
              <Link to="/scan">
                <ScanFace aria-hidden="true" />
                Start scan
              </Link>
            ) : (
              <Link to="/auth" search={{ mode: "signup" }}>
                <ScanFace aria-hidden="true" />
                Start scan
              </Link>
            )}
          </Button>

          <Button asChild variant="outline" size="lg" className="min-h-11 w-full sm:w-auto">
            <Link to="/auth" search={{ mode: "login" }}>
              I already have an account
            </Link>
          </Button>
        </motion.div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden="true" />
          No video or images leave your device — only derived numbers are saved.
        </p>
      </section>

      <section className="relative mx-auto w-full max-w-5xl px-4 pb-16">
        <h2 className="text-center text-sm font-semibold uppercase tracking-[0.25em] text-muted-foreground">
          How it works
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.li
              key={step.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <GlassCard className="h-full">
                <span className="font-mono text-xs text-primary">STEP {i + 1}</span>
                <step.icon className="mt-3 size-6 text-accent" aria-hidden="true" />
                <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
              </GlassCard>
            </motion.li>
          ))}
        </ol>
      </section>

      <section className="relative mx-auto w-full max-w-3xl px-4 pb-20">
        <Disclaimer />
      </section>

      <section className="relative mx-auto w-full max-w-4xl px-4 pb-20">
        <GlassCard className="text-center">
          <h2 className="text-2xl font-bold tracking-tight">About me</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            We are builders and wellness-tech enthusiasts who created NeuroFace AI to make biometric
            self-awareness more accessible. We believe small, measurable signals — like the tension
            we hold in our face — can help people notice stress earlier and build healthier habits.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            This project combines computer vision, transparent scoring, and privacy-first design. It
            is intentionally an educational tool: a way to explore how machine perception can
            support, not replace, your own sense of wellbeing.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Got feedback or ideas? I'd love to hear from you.
          </p>
        </GlassCard>
      </section>

      <footer className="relative border-t border-border py-6 text-center text-xs text-muted-foreground">
        NeuroFace AI · educational wellness screening · built for awareness, not diagnosis
      </footer>
    </div>
  );
}
