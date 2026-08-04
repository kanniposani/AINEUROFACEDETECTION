import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import { Activity, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GlassCard } from "@/components/glass-card";
import { Disclaimer } from "@/components/disclaimer";
import { useSession } from "@/hooks/use-session";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Sign in — NeuroFace AI" },
      {
        name: "description",
        content:
          "Create your NeuroFace AI account or log in to track your stress and wellness signal history over time.",
      },
      { property: "og:title", content: "Sign in — NeuroFace AI" },
      {
        property: "og:description",
        content: "Log in to NeuroFace AI to run a face scan and follow your wellness trend.",
      },
    ],
  }),
  component: AuthPage,
});

const AGE_RANGES = ["Under 18", "18–24", "25–34", "35–44", "45–54", "55–64", "65+"];

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  useEffect(() => setIsSignup(mode === "signup"), [mode]);

  useEffect(() => {
    if (!sessionLoading && session) navigate({ to: "/dashboard", replace: true });
  }, [session, sessionLoading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setBusy(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName.trim() || null },
          },
        });
        if (error) throw error;
        if (data.session) {
          await saveOnboarding();
          toast.success("Welcome to NeuroFace AI");
        } else {
          setCheckEmail(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        toast.success("Signed in");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveOnboarding() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    await supabase.from("profiles").upsert({
      id: data.user.id,
      full_name: fullName.trim() || null,
      age_range: ageRange || null,
      baseline_notes: notes.trim() || null,
    });
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  if (checkEmail) {
    return (
      <Centered>
        <GlassCard className="w-full max-w-md text-center" glow>
          <h1 className="text-xl font-semibold">Confirm your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to <span className="font-mono">{email}</span>. Click it to
            activate your account, then come back and log in.
          </p>
          <Button
            className="mt-5 min-h-11 w-full"
            variant="outline"
            onClick={() => {
              setCheckEmail(false);
              setIsSignup(false);
            }}
          >
            Back to log in
          </Button>
        </GlassCard>
      </Centered>
    );
  }

  return (
    <Centered>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <Activity className="size-5 text-primary" aria-hidden="true" />
          <span className="font-mono text-sm font-semibold tracking-tight">NEUROFACE AI</span>
        </Link>

        <GlassCard glow>
          <h1 className="text-xl font-semibold">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup
              ? "Your scan history stays private to you."
              : "Log in to continue tracking your signals."}
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="auth-email">Email</Label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-password">Password</Label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {isSignup && (
              <div className="space-y-4 rounded-xl border border-border p-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Optional onboarding
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-name">Name</Label>
                  <Input
                    id="auth-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    maxLength={100}
                    placeholder="How should we greet you?"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-age">Age range</Label>
                  <Select value={ageRange} onValueChange={setAgeRange}>
                    <SelectTrigger id="auth-age" aria-label="Age range">
                      <SelectValue placeholder="Prefer not to say" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGE_RANGES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-notes">Baseline wellness notes</Label>
                  <Textarea
                    id="auth-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={500}
                    rows={3}
                    placeholder="Anything you'd like to remember about your usual baseline (optional)"
                  />
                </div>
              </div>
            )}

            <Button type="submit" disabled={busy} className="min-h-11 w-full">
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isSignup ? "Create account" : "Log in"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="outline"
            className="min-h-11 w-full"
            onClick={handleGoogle}
            disabled={busy}
          >
            Continue with Google
          </Button>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {isSignup ? "Already have an account?" : "New to NeuroFace AI?"}{" "}
            <button
              type="button"
              className="font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setIsSignup((v) => !v)}
            >
              {isSignup ? "Log in" : "Create one"}
            </button>
          </p>
        </GlassCard>

        <Disclaimer className="mt-5" />
      </motion.div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 hero-glow" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 grid-backdrop" aria-hidden="true" />
      <div className="relative flex w-full justify-center">{children}</div>
    </div>
  );
}
