import { stressBand, suggestionsFor } from "./scoring";

export type ReportScan = {
  created_at: string;
  stress_index: number;
  fatigue_level: number;
  tension_level: number;
  symmetry_score: number;
  blink_rate: number;
};

const INK = "#0a0f1a";

export async function downloadScanReport(scan: ReportScan, name?: string | null) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const band = stressBand(scan.stress_index);
  const when = new Date(scan.created_at).toLocaleString();
  let y = 64;

  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("NeuroFace AI — Wellness Signal Report", 48, y);

  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#555f70");
  doc.text(`${name ? `${name}  ·  ` : ""}${when}`, 48, y);

  y += 34;
  doc.setDrawColor("#c9d3e0");
  doc.line(48, y, 547, y);

  y += 34;
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(48);
  doc.text(String(scan.stress_index), 48, y + 10);
  doc.setFontSize(13);
  doc.text(`Stress Index — ${band.label}`, 132, y - 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor("#555f70");
  doc.text(doc.splitTextToSize(band.summary, 400), 132, y + 12);

  y += 56;
  doc.setTextColor(INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Breakdown", 48, y);

  y += 8;
  const rows: [string, string][] = [
    ["Fatigue level", `${scan.fatigue_level} / 100`],
    ["Tension level", `${scan.tension_level} / 100`],
    ["Symmetry score", `${scan.symmetry_score} / 100`],
    ["Blink rate", `${scan.blink_rate} blinks / min`],
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  for (const [label, value] of rows) {
    y += 22;
    doc.setTextColor("#555f70");
    doc.text(label, 48, y);
    doc.setTextColor(INK);
    doc.text(value, 300, y);
  }

  y += 40;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("General wellness suggestions", 48, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const s of suggestionsFor({
    stressIndex: scan.stress_index,
    fatigueLevel: scan.fatigue_level,
    tensionLevel: scan.tension_level,
    blinkRate: scan.blink_rate,
  })) {
    y += 18;
    doc.setTextColor("#555f70");
    doc.text(doc.splitTextToSize(`•  ${s}`, 470), 48, y);
    y += 4;
  }

  y += 40;
  doc.setDrawColor("#c9d3e0");
  doc.line(48, y, 547, y);
  y += 20;
  doc.setFontSize(9);
  doc.setTextColor("#7b8698");
  doc.text(
    doc.splitTextToSize(
      "Disclaimer: NeuroFace AI provides wellness insights for educational purposes using approximate, camera-derived proxy signals. It is not a medical device and is not a substitute for professional medical advice, diagnosis or treatment.",
      499,
    ),
    48,
    y,
  );

  doc.save(`neuroface-report-${scan.created_at.slice(0, 10)}.pdf`);
}

export function downloadHistoryCsv(scans: ReportScan[]) {
  const header = "date,stress_index,fatigue_level,tension_level,symmetry_score,blink_rate";
  const body = scans
    .map((s) =>
      [
        new Date(s.created_at).toISOString(),
        s.stress_index,
        s.fatigue_level,
        s.tension_level,
        s.symmetry_score,
        s.blink_rate,
      ].join(","),
    )
    .join("\n");
  const blob = new Blob([`${header}\n${body}\n`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "neuroface-history.csv";
  a.click();
  URL.revokeObjectURL(url);
}
