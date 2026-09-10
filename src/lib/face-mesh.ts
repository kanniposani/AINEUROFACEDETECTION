/**
 * Browser-only MediaPipe face landmark loader (468-point face mesh + blendshapes).
 * Must only be called after hydration — it dynamically imports the WASM runtime.
 */
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

export async function loadFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_BASE);
      return vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false,
      });
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

/** Subset of the 468-point mesh drawn as a light wireframe overlay. */
export function drawMesh(
  ctx: CanvasRenderingContext2D,
  landmarks: { x: number; y: number }[],
  width: number,
  height: number,
  color: string,
) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.75;

  for (let i = 0; i < landmarks.length; i += 1) {
    const p = landmarks[i]!;
    const x = p.x * width;
    const y = p.y * height;
    ctx.beginPath();
    ctx.arc(x, y, i % 6 === 0 ? 1.6 : 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // sparse connective lines for the "mesh" look
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 0.6;
  for (let i = 0; i < landmarks.length - 8; i += 8) {
    const a = landmarks[i]!;
    const b = landmarks[i + 8]!;
    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export type BlendshapeMap = Record<string, number>;

export function toBlendshapeMap(
  categories: { categoryName?: string; displayName?: string; score: number }[],
): BlendshapeMap {
  const map: BlendshapeMap = {};
  for (const c of categories) {
    const key = c.categoryName || c.displayName;
    if (key) map[key] = c.score;
  }
  return map;
}

const g = (m: BlendshapeMap, k: string) => m[k] ?? 0;

/**
 * Brow tension. Only *lowering* / inner-brow knitting counts as tension —
 * outer-brow raise is surprise, not stress, so it is no longer mixed in
 * (that cancellation was blurring real brow activity).
 */
export function browSignal(m: BlendshapeMap) {
  const down = (g(m, "browDownLeft") + g(m, "browDownRight")) / 2;
  const knit = g(m, "browInnerUp");
  return Math.min(1, down * 0.8 + knit * 0.35);
}

export function jawSignal(m: BlendshapeMap) {
  const press = (g(m, "mouthPressLeft") + g(m, "mouthPressRight")) / 2;
  const frown = (g(m, "mouthFrownLeft") + g(m, "mouthFrownRight")) / 2;
  const tighten = Math.max(g(m, "mouthShrugLower"), g(m, "mouthStretchLeft"), g(m, "mouthStretchRight"));
  // an open/talking mouth is not a clench — discount it
  const open = Math.max(g(m, "jawOpen"), g(m, "mouthFunnel"));
  const raw = press * 0.6 + frown * 0.3 + g(m, "jawForward") * 0.3 + tighten * 0.2;
  return Math.min(1, Math.max(0, raw * (1 - Math.min(1, open * 1.2))));
}

export function squintSignal(m: BlendshapeMap) {
  const squint = (g(m, "eyeSquintLeft") + g(m, "eyeSquintRight")) / 2;
  const lidDroop = 1 - Math.min(1, (g(m, "eyeWideLeft") + g(m, "eyeWideRight")) / 2 + 0.5) + 0.5;
  return Math.min(1, squint * 0.85 + (g(m, "cheekSquintLeft") + g(m, "cheekSquintRight")) / 2 * 0.15) * lidDroop;
}

/** Exponential moving average — smooths per-frame blendshape jitter. */
export function smooth(prev: number | undefined, next: number, alpha = 0.35) {
  return prev === undefined ? next : prev + alpha * (next - prev);
}

/** Subtract a per-face neutral baseline; expression is the rise above rest. */
export function aboveBaseline(value: number, baseline: number) {
  const b = Math.min(0.9, baseline);
  return Math.min(1, Math.max(0, (value - b) / (1 - b)));
}

export function blinkSignal(m: BlendshapeMap) {
  return Math.max(g(m, "eyeBlinkLeft"), g(m, "eyeBlinkRight"));
}

const PAIRS = [
  "eyeSquint",
  "eyeBlink",
  "browDown",
  "browOuterUp",
  "mouthPress",
  "mouthSmile",
  "mouthFrown",
  "cheekSquint",
  "noseSneer",
];

export function asymmetrySignal(m: BlendshapeMap) {
  let total = 0;
  for (const p of PAIRS) total += Math.abs(g(m, `${p}Left`) - g(m, `${p}Right`));
  return Math.min(1, total / PAIRS.length);
}

/**
 * Experimental proxy: normalized luminance variance across forehead/cheek
 * regions. Sensitive to lighting — labelled experimental in the UI.
 */
export function skinVarianceSignal(
  video: HTMLVideoElement,
  scratch: HTMLCanvasElement,
  landmarks: { x: number; y: number }[],
): number {
  const ctx = scratch.getContext("2d", { willReadFrequently: true });
  if (!ctx || !landmarks.length) return 0;
  const w = 64;
  const h = 64;
  scratch.width = w;
  scratch.height = h;
  const forehead = landmarks[10] ?? { x: 0.5, y: 0.3 };
  const cheekL = landmarks[234] ?? { x: 0.35, y: 0.5 };
  const cheekR = landmarks[454] ?? { x: 0.65, y: 0.5 };
  const xs = [forehead.x, cheekL.x, cheekR.x];
  const ys = [forehead.y, cheekL.y, cheekR.y];
  const sx = Math.max(0, Math.min(...xs) * video.videoWidth);
  const sy = Math.max(0, Math.min(...ys) * video.videoHeight);
  const sw = Math.max(8, (Math.max(...xs) - Math.min(...xs)) * video.videoWidth);
  const sh = Math.max(8, (Math.max(...ys) - Math.min(...ys)) * video.videoHeight);
  try {
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let sum = 0;
    let sumSq = 0;
    let n = 0;
    for (let i = 0; i < data.length; i += 16) {
      const lum = (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!) / 255;
      sum += lum;
      sumSq += lum * lum;
      n += 1;
    }
    if (!n) return 0;
    const mean = sum / n;
    return Math.min(1, Math.sqrt(Math.max(0, sumSq / n - mean * mean)) * 3);
  } catch {
    return 0;
  }
}
