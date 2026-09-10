/**
 * NeuroFace AI — transparent scoring engine.
 *
 * Every number below is derived from camera-only facial landmark / blendshape
 * signals computed in the browser. These are approximate, camera-derived proxy
 * signals. They are NOT clinically validated measurements.
 */

export type FrameSample = {
  /** ms timestamp of the sample */
  t: number;
  /** 0..1 eye closure (max of left/right eyeBlink blendshape) */
  blink: number;
  /** 0..1 brow lowering / inner-brow raise composite */
  brow: number;
  /** 0..1 mouth press + jaw clench composite */
  jaw: number;
  /** 0..1 eye squint composite */
  squint: number;
  /** 0..1 left/right blendshape asymmetry */
  asym: number;
  /** 0..1 normalized skin-region luminance variance (experimental proxy) */
  skinVar: number;
};

export type ScanMetrics = {
  stressIndex: number;
  fatigueLevel: number;
  tensionLevel: number;
  symmetryScore: number;
  blinkRate: number;
  raw: {
    durationSec: number;
    frames: number;
    blinkCount: number;
    browTension: number;
    jawTension: number;
    squintAvg: number;
    asymmetryAvg: number;
    microVariance: number;
    skinVariance: number;
    blinkDeviation: number;
    weights: Record<string, number>;
  };
};

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

function stdDev(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = avg(xs);
  return Math.sqrt(avg(xs.map((x) => (x - m) ** 2)));
}

/** Weights are fixed and published in the "How this score is calculated" panel. */
export const STRESS_WEIGHTS = {
  tension: 0.3,
  fatigue: 0.25,
  microExpressionVariance: 0.2,
  asymmetry: 0.15,
  blinkDeviation: 0.1,
} as const;

/** Healthy resting blink range used as the reference band (blinks / minute). */
export const BLINK_REFERENCE = { min: 12, max: 22 } as const;

export function computeMetrics(samples: FrameSample[]): ScanMetrics {
  const frames = samples.length;
  const durationSec = frames > 1 ? (samples[frames - 1]!.t - samples[0]!.t) / 1000 : 0;

  // --- blink detection: rising edge over a 0.5 closure threshold ---
  let blinkCount = 0;
  let closed = false;
  for (const s of samples) {
    if (!closed && s.blink > 0.5) {
      blinkCount += 1;
      closed = true;
    } else if (closed && s.blink < 0.3) {
      closed = false;
    }
  }
  const blinkRate = durationSec > 1 ? (blinkCount / durationSec) * 60 : 0;

  const browTension = avg(samples.map((s) => s.brow));
  const jawTension = avg(samples.map((s) => s.jaw));
  const squintAvg = avg(samples.map((s) => s.squint));
  const asymmetryAvg = avg(samples.map((s) => s.asym));
  const skinVariance = avg(samples.map((s) => s.skinVar));

  // micro-expression variance: instability of the brow/jaw/squint composite
  const composite = samples.map((s) => (s.brow + s.jaw + s.squint) / 3);
  const microVariance = clamp(stdDev(composite) * 420, 0, 100);

  // blink deviation from the reference resting band
  const blinkDeviation = clamp(
    blinkRate < BLINK_REFERENCE.min
      ? ((BLINK_REFERENCE.min - blinkRate) / BLINK_REFERENCE.min) * 100
      : blinkRate > BLINK_REFERENCE.max
        ? ((blinkRate - BLINK_REFERENCE.max) / BLINK_REFERENCE.max) * 100
        : 0,
  );

  // signals now arrive relative to the person's neutral rest level, so the
  // gains are a little higher than the raw-blendshape version
  const tensionLevel = clamp((browTension * 0.55 + jawTension * 0.45) * 175);
  const fatigueLevel = clamp(squintAvg * 68 + blinkDeviation * 0.3 + skinVariance * 20);
  const symmetryScore = clamp(100 - asymmetryAvg * 260);

  const stressIndex = clamp(
    tensionLevel * STRESS_WEIGHTS.tension +
      fatigueLevel * STRESS_WEIGHTS.fatigue +
      microVariance * STRESS_WEIGHTS.microExpressionVariance +
      (100 - symmetryScore) * STRESS_WEIGHTS.asymmetry +
      blinkDeviation * STRESS_WEIGHTS.blinkDeviation,
  );

  return {
    stressIndex: Math.round(stressIndex),
    fatigueLevel: Math.round(fatigueLevel),
    tensionLevel: Math.round(tensionLevel),
    symmetryScore: Math.round(symmetryScore),
    blinkRate: Math.round(blinkRate * 10) / 10,
    raw: {
      durationSec: Math.round(durationSec * 10) / 10,
      frames,
      blinkCount,
      browTension: round3(browTension),
      jawTension: round3(jawTension),
      squintAvg: round3(squintAvg),
      asymmetryAvg: round3(asymmetryAvg),
      microVariance: Math.round(microVariance),
      skinVariance: round3(skinVariance),
      blinkDeviation: Math.round(blinkDeviation),
      weights: { ...STRESS_WEIGHTS },
    },
  };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export type Band = {
  label: string;
  token: "excellent" | "good" | "moderate" | "warning" | "critical";
  summary: string;
};

export function stressBand(score: number): Band {
  if (score < 20)
    return {
      label: "Excellent",
      token: "excellent",
      summary: "Your facial signals look calm and relaxed right now.",
    };
  if (score < 40)
    return {
      label: "Good",
      token: "good",
      summary: "Mild signals of activation. Overall you appear settled.",
    };
  if (score < 60)
    return {
      label: "Moderate",
      token: "moderate",
      summary: "Moderate tension signals detected around the brow and jaw.",
    };
  if (score < 80)
    return {
      label: "Elevated",
      token: "warning",
      summary: "Elevated tension and fatigue signals. A reset break may help.",
    };
  return {
    label: "High",
    token: "critical",
    summary: "High tension signals across several indicators.",
  };
}

/** Inverted bands for scores where higher is better (e.g. symmetry). */
export function positiveBand(score: number): Band["token"] {
  if (score >= 90) return "excellent";
  if (score >= 78) return "good";
  if (score >= 65) return "moderate";
  if (score >= 50) return "warning";
  return "critical";
}

export function suggestionsFor(m: {
  stressIndex: number;
  fatigueLevel: number;
  tensionLevel: number;
  blinkRate: number;
}): string[] {
  const out: string[] = [];
  if (m.tensionLevel >= 45)
    out.push("Unclench your jaw and drop your shoulders — try a 30 second brow-and-jaw release.");
  if (m.fatigueLevel >= 45)
    out.push("Signals suggest tiredness. A short screen break or a 10 minute walk can help.");
  if (m.blinkRate < BLINK_REFERENCE.min)
    out.push("Your blink rate is low, which is common with screen focus. Try the 20-20-20 rule.");
  if (m.blinkRate > BLINK_REFERENCE.max)
    out.push("Frequent blinking can follow eye strain or dryness — rest your eyes and hydrate.");
  if (m.stressIndex >= 60)
    out.push("Try box breathing: inhale 4s, hold 4s, exhale 4s, hold 4s, for 2 minutes.");
  out.push("Drink a glass of water and re-scan later today to see how the trend moves.");
  if (m.stressIndex < 30) out.push("Keep doing what you're doing — your signals look settled.");
  return out.slice(0, 4);
}
