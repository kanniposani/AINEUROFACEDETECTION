import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CameraOff, Loader2, ScanFace, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GlassCard } from "@/components/glass-card";
import { Disclaimer } from "@/components/disclaimer";
import { FormulaPanel } from "@/components/formula-panel";
import { computeMetrics, type FrameSample, type ScanMetrics } from "@/lib/scoring";
import {
  asymmetrySignal,
  blinkSignal,
  browSignal,
  drawMesh,
  jawSignal,
  loadFaceLandmarker,
  skinVarianceSignal,
  squintSignal,
  toBlendshapeMap,
} from "@/lib/face-mesh";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({
    meta: [
      { title: "Face Scan — NeuroFace AI" },
      {
        name: "description",
        content:
          "Run a 10 second in-browser face scan. NeuroFace AI tracks 468 landmarks locally to estimate your Stress Index.",
      },
      { property: "og:title", content: "Face Scan — NeuroFace AI" },
      {
        property: "og:description",
        content: "Live face-mesh capture with real-time alignment guidance. Nothing is uploaded.",
      },
    ],
  }),
  component: ScanPage,
});

const CONSENT_KEY = "neuroface-camera-consent";
export const SCAN_RESULT_KEY = "neuroface:last-scan";
const CAPTURE_MS = 9000;

type Phase = "consent" | "idle" | "loading" | "aligning" | "countdown" | "capturing" | "error";

function ScanPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const samplesRef = useRef<FrameSample[]>([]);
  const captureStartRef = useRef<number | null>(null);
  const lastTsRef = useRef(-1);
  const phaseRef = useRef<Phase>("idle");

  const [phase, setPhase] = useState<Phase>("idle");
  const [guidance, setGuidance] = useState("Center your face in the frame");
  const [countdown, setCountdown] = useState(3);
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(CONSENT_KEY)) setConsentOpen(true);
  }, []);

  const stopAll = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => stopAll, [stopAll]);

  const finish = useCallback(() => {
    const metrics: ScanMetrics = computeMetrics(samplesRef.current);
    stopAll();
    sessionStorage.setItem(
      SCAN_RESULT_KEY,
      JSON.stringify({ ...metrics, capturedAt: new Date().toISOString() }),
    );
    navigate({ to: "/results" });
  }, [navigate, stopAll]);

  const start = useCallback(async () => {
    setPhaseBoth("loading");
    setErrorMsg("");
    samplesRef.current = [];
    captureStartRef.current = null;
    lastTsRef.current = -1;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera element unavailable");
      video.srcObject = stream;
      await video.play();

      const landmarker = await loadFaceLandmarker();
      if (!scratchRef.current) scratchRef.current = document.createElement("canvas");
      setPhaseBoth("aligning");

      const loop = () => {
        const v = videoRef.current;
        const canvas = canvasRef.current;
        if (!v || !canvas || v.readyState < 2) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        canvas.width = v.videoWidth || 640;
        canvas.height = v.videoHeight || 480;
        const ctx = canvas.getContext("2d");

        const ts = performance.now();
        if (ts <= lastTsRef.current) {
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
        lastTsRef.current = ts;

        const result = landmarker.detectForVideo(v, ts);
        const face = result.faceLandmarks?.[0];

        if (ctx) {
          if (face) {
            drawMesh(
              ctx,
              face,
              canvas.width,
              canvas.height,
              getComputedStyle(document.documentElement).getPropertyValue("--neon-cyan").trim() ||
                "#00F5FF",
            );
          } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        }

        if (!face) {
          setGuidance("No face detected — center your face in the frame");
        } else {
          const nose = face[1]!;
          const offX = Math.abs(nose.x - 0.5);
          const offY = Math.abs(nose.y - 0.5);
          const shapes = result.faceBlendshapes?.[0]?.categories ?? [];
          const map = toBlendshapeMap(shapes);
          const skinVar = skinVarianceSignal(v, scratchRef.current!, face);

          if (offX > 0.14 || offY > 0.16) setGuidance("Center your face in the frame");
          else if (skinVar < 0.03) setGuidance("Ensure good, even lighting on your face");
          else setGuidance("Great — hold still and breathe normally");

          if (phaseRef.current === "capturing") {
            samplesRef.current.push({
              t: ts,
              blink: blinkSignal(map),
              brow: browSignal(map),
              jaw: jawSignal(map),
              squint: squintSignal(map),
              asym: asymmetrySignal(map),
              skinVar,
            });
          }
        }

        if (phaseRef.current === "capturing") {
          if (captureStartRef.current === null) captureStartRef.current = ts;
          const elapsed = ts - captureStartRef.current;
          setProgress(Math.min(100, (elapsed / CAPTURE_MS) * 100));
          if (elapsed >= CAPTURE_MS) {
            if (samplesRef.current.length < 10) {
              setErrorMsg(
                "We couldn't read enough facial signals. Try again with better lighting and your face centered.",
              );
              setPhaseBoth("error");
              stopAll();
              return;
            }
            finish();
            return;
          }
        }

        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      stopAll();
      setErrorMsg(
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera permission was denied. Enable camera access in your browser settings to scan."
          : err instanceof Error
            ? err.message
            : "Could not start the scan.",
      );
      setPhaseBoth("error");
    }
  }, [finish, setPhaseBoth, stopAll]);

  const beginCountdown = useCallback(() => {
    setPhaseBoth("countdown");
    setCountdown(3);
    let n = 3;
    const id = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n <= 0) {
        clearInterval(id);
        captureStartRef.current = null;
        setProgress(0);
        samplesRef.current = [];
        setPhaseBoth("capturing");
      }
    }, 1000);
  }, [setPhaseBoth]);

  function acceptConsent() {
    localStorage.setItem(CONSENT_KEY, new Date().toISOString());
    setConsentOpen(false);
  }

  const live = phase === "aligning" || phase === "countdown" || phase === "capturing";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Face scan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All processing happens on this device. Only the derived numbers can be saved.
        </p>
      </header>

      <GlassCard className="overflow-hidden p-0" glow={phase === "capturing"}>
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          <video
            ref={videoRef}
            playsInline
            muted
            className="absolute inset-0 size-full scale-x-[-1] object-cover"
          />
          <canvas
            ref={canvasRef}
            aria-hidden="true"
            className="absolute inset-0 size-full scale-x-[-1] object-cover"
          />

          {/* face guide ring */}
          {live && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 h-[78%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-primary/50 shadow-neon"
            />
          )}

          {/* animated scan beam */}
          {phase === "capturing" && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
              <div className="absolute inset-x-0 h-24 animate-scanline bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
            </div>
          )}

          <AnimatePresence>
            {phase === "countdown" && (
              <motion.div
                key={countdown}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.4, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <span className="font-mono text-8xl font-bold text-primary">{countdown}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {phase === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <ScanFace className="size-10 text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                Camera is off. Start the scan when you're ready.
              </p>
            </div>
          )}

          {phase === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">Loading face mesh model…</p>
            </div>
          )}

          {phase === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
              <CameraOff className="size-9 text-critical" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">{errorMsg}</p>
            </div>
          )}

          {live && (
            <div
              role="status"
              aria-live="polite"
              className="absolute inset-x-3 bottom-3 rounded-xl bg-background/70 px-3 py-2 text-center text-sm backdrop-blur"
            >
              {phase === "capturing" ? "Analyzing signals — hold still" : guidance}
            </div>
          )}
        </div>

        {phase === "capturing" && (
          <div className="h-1.5 w-full bg-muted">
            <div
              className="h-full bg-primary transition-[width] duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 p-4">
          {(phase === "idle" || phase === "error") && (
            <Button onClick={start} className="min-h-11 flex-1" disabled={consentOpen}>
              <ScanFace aria-hidden="true" />
              {phase === "error" ? "Try again" : "Start camera"}
            </Button>
          )}
          {phase === "aligning" && (
            <Button onClick={beginCountdown} className="min-h-11 flex-1 animate-pulse-glow">
              Begin 9 second scan
            </Button>
          )}
          {(phase === "countdown" || phase === "capturing") && (
            <Button
              variant="outline"
              className="min-h-11 flex-1"
              onClick={() => {
                stopAll();
                setPhaseBoth("idle");
              }}
            >
              Cancel
            </Button>
          )}
          {live && phase === "aligning" && (
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                stopAll();
                setPhaseBoth("idle");
              }}
            >
              Stop camera
            </Button>
          )}
        </div>
      </GlassCard>

      <FormulaPanel />
      <Disclaimer />

      <Dialog open={consentOpen} onOpenChange={setConsentOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              Camera consent
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 pt-2 text-left text-sm text-muted-foreground">
                <p>
                  NeuroFace AI needs your camera to detect facial landmarks. Here is exactly what
                  happens:
                </p>
                <ul className="space-y-1.5">
                  <li>
                    <strong className="text-foreground">Stored:</strong> only the derived numbers —
                    Stress Index, fatigue, tension, symmetry, blink rate and the signal breakdown.
                  </li>
                  <li>
                    <strong className="text-foreground">Never stored or uploaded:</strong> your
                    video, photos, or any image frames. Face detection runs entirely in this
                    browser.
                  </li>
                  <li>
                    <strong className="text-foreground">Your control:</strong> you can delete all
                    history at any time from Settings.
                  </li>
                </ul>
                <p className="flex items-start gap-2 text-xs">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-moderate" aria-hidden="true" />
                  This is a wellness and educational tool, not a medical diagnostic device.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="min-h-11" onClick={() => navigate({ to: "/dashboard" })}>
              Not now
            </Button>
            <Button className="min-h-11" onClick={acceptConsent}>
              I understand — enable camera
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
