import { Info } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BLINK_REFERENCE, STRESS_WEIGHTS } from "@/lib/scoring";

const ROWS: { key: keyof typeof STRESS_WEIGHTS; label: string; how: string }[] = [
  {
    key: "tension",
    label: "Tension level",
    how: "Brow-lowering and mouth-press / jaw-forward blendshape intensity, averaged across all captured frames.",
  },
  {
    key: "fatigue",
    label: "Fatigue level",
    how: "Eye-squint intensity, blink-rate deviation, and the experimental skin luminance-variance proxy.",
  },
  {
    key: "microExpressionVariance",
    label: "Micro-expression variance",
    how: "Standard deviation of the brow/jaw/squint composite over the capture window — instability, not intensity.",
  },
  {
    key: "asymmetry",
    label: "Asymmetry (100 − symmetry)",
    how: "Mean absolute left/right difference across nine paired facial signals.",
  },
  {
    key: "blinkDeviation",
    label: "Blink-rate deviation",
    how: `Distance from the ${BLINK_REFERENCE.min}–${BLINK_REFERENCE.max} blinks/min resting reference band.`,
  },
];

export function FormulaPanel() {
  return (
    <Accordion type="single" collapsible className="rounded-xl border border-border px-4">
      <AccordionItem value="formula" className="border-0">
        <AccordionTrigger className="text-sm">
          <span className="flex items-center gap-2">
            <Info className="size-4 text-primary" aria-hidden="true" />
            How this score is calculated
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <p className="text-sm text-muted-foreground">
            The Stress Index is a weighted sum of five normalised sub-signals. Nothing is hidden in
            a black box — these are the exact weights used:
          </p>
          <ul className="mt-3 space-y-3">
            {ROWS.map((r) => (
              <li key={r.key} className="rounded-lg bg-muted/40 p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{r.label}</span>
                  <span className="font-mono text-sm text-primary">
                    ×{STRESS_WEIGHTS[r.key].toFixed(2)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.how}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            stress = 0.30·tension + 0.25·fatigue + 0.20·microVariance + 0.15·(100−symmetry) +
            0.10·blinkDeviation
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Skin colour/texture variance is an <strong>experimental</strong> proxy and is highly
            sensitive to lighting. Treat every number here as an approximate, camera-derived
            indicator.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
