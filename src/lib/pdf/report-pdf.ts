// Professionally designed PDF export of the diagnostic report.
//
// Layout rules: every block measures its height and calls ensure() first, so
// nothing is ever clipped by a page edge; tables repeat their header after a
// break; page numbers are stamped on every page at the end.

import PDFDocument from "pdfkit";
import * as fs from "fs";
import type { DiagnosticReport } from "@/lib/engine/report";

function fmtDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

function fmtMs(ms: number | null): string {
  if (ms === null || ms <= 0) return "—";
  if (ms < 1000) return "<1s";
  const s = Math.round(ms / 1000);
  return s >= 60 ? fmtDuration(s) : `${s}s`;
}

// ── Palette ──────────────────────────────────────────────────────────────────
const INK = "#0f172a";
const MUTED = "#64748b";
const FAINT = "#94a3b8";
const LINE = "#e2e8f0";
const PANEL = "#f8fafc";
const INDIGO = "#4f46e5";
const VIOLET = "#7c3aed";
const EMERALD = "#10b981";
const AMBER = "#f59e0b";
const ROSE = "#f43f5e";
const WHITE = "#ffffff";

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const M = 48; // margin
const CONTENT_W = PAGE_W - M * 2;
const BOTTOM = PAGE_H - 56; // keep clear of the footer

let unicodeFonts = false;

/** Try to register a Unicode system font (₹ √ θ → …); fall back to Helvetica. */
function registerFonts(doc: PDFKit.PDFDocument) {
  const candidates: [string, string][] = [
    ["C:\\Windows\\Fonts\\arial.ttf", "C:\\Windows\\Fonts\\arialbd.ttf"],
    ["C:\\Windows\\Fonts\\segoeui.ttf", "C:\\Windows\\Fonts\\segoeuib.ttf"],
    [
      "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
      "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ],
    [
      "/System/Library/Fonts/Supplemental/Arial.ttf",
      "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    ],
  ];
  for (const [regular, bold] of candidates) {
    try {
      if (fs.existsSync(regular) && fs.existsSync(bold)) {
        doc.registerFont("Body", regular);
        doc.registerFont("Bold", bold);
        unicodeFonts = true;
        return;
      }
    } catch {
      // try next candidate
    }
  }
  doc.registerFont("Body", "Helvetica");
  doc.registerFont("Bold", "Helvetica-Bold");
  unicodeFonts = false;
}

/** Make text safe for the WinAnsi built-in fonts when no Unicode font exists. */
function T(s: string): string {
  if (unicodeFonts) return s;
  return s
    .replace(/₹/g, "Rs ")
    .replace(/√/g, "sqrt ")
    .replace(/→/g, "->")
    .replace(/⇄/g, "<->")
    .replace(/θ/g, "theta")
    .replace(/π/g, "pi")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/≈/g, "~")
    .replace(/–|—/g, "-")
    .replace(/·/g, "-");
}

function ensure(doc: PDFKit.PDFDocument, needed: number) {
  if (doc.y + needed > BOTTOM) {
    doc.addPage();
    doc.y = M;
  }
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, color = INDIGO) {
  ensure(doc, 40);
  const y = doc.y;
  doc.save();
  doc.roundedRect(M, y, 4, 16, 2).fill(color);
  doc
    .font("Bold")
    .fontSize(11)
    .fillColor(INK)
    .text(title.toUpperCase(), M + 14, y + 2, {
      width: CONTENT_W - 14,
      characterSpacing: 0.8,
    });
  doc.restore();
  doc.y = y + 28;
}

function hBar(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  frac: number,
  color: string
) {
  doc.roundedRect(x, y, w, h, h / 2).fill(LINE);
  const fw = Math.max(w * Math.min(Math.max(frac, 0), 1), h);
  if (frac > 0.001) doc.roundedRect(x, y, fw, h, h / 2).fill(color);
}

function statusColor(status: string): string {
  if (status === "Mastered") return EMERALD;
  if (status === "Developing") return AMBER;
  return ROSE;
}

// ── Main renderer ────────────────────────────────────────────────────────────

export async function renderReportPdf(report: DiagnosticReport): Promise<Buffer> {
  const log = report.questionAnalysis;
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: M, bottom: 0, left: M, right: M },
    bufferPages: true,
    info: {
      Title: `Zarban Diagnostic Report — ${report.student.name ?? "Student"}`,
      Author: "Zarban Adaptive Math Assessment",
      Subject: `Grade ${report.selectedGrade} diagnostic`,
    },
  });
  registerFonts(doc);

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const finished = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(chunks)))
  );

  // ── Header band ────────────────────────────────────────────────────────────
  doc.rect(0, 0, PAGE_W, 128).fill(INDIGO);
  doc.rect(0, 122, PAGE_W, 6).fill(VIOLET);
  doc
    .font("Bold")
    .fontSize(9)
    .fillColor("#c7d2fe")
    .text("ZARBAN  -  ADAPTIVE MATH ASSESSMENT", M, 24, { characterSpacing: 1.4 });
  doc.font("Bold").fontSize(24).fillColor(WHITE).text("Diagnostic Report", M, 40);
  const studentLine = [
    report.student.name ?? "Student",
    report.student.school,
    `Class ${report.selectedGrade}`,
  ]
    .filter(Boolean)
    .join("   |   ");
  doc.font("Body").fontSize(10.5).fillColor("#e0e7ff").text(T(studentLine), M, 74);
  const when = new Date(report.endedAt ?? report.startedAt);
  doc
    .fontSize(9)
    .fillColor("#c7d2fe")
    .text(
      `Generated ${when.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}  ·  Session ${report.sessionId.slice(0, 8)}`,
      M,
      90
    );

  // Score medallion (right side of header).
  const sx = PAGE_W - M - 78;
  doc.circle(sx + 39, 62, 39).fill(WHITE);
  doc.circle(sx + 39, 62, 35).lineWidth(3).stroke(VIOLET);
  doc
    .font("Bold")
    .fontSize(20)
    .fillColor(INDIGO)
    .text(`${Math.round(report.totals.accuracy)}%`, sx, 50, {
      width: 78,
      align: "center",
    });
  doc
    .font("Bold")
    .fontSize(6.5)
    .fillColor(MUTED)
    .text("OVERALL SCORE", sx, 74, { width: 78, align: "center", characterSpacing: 0.6 });

  doc.y = 150;

  // ── Headline ───────────────────────────────────────────────────────────────
  const heroTopic = report.gradeEquivalentByTopic[0];
  const ge = report.gradeEquivalent;
  const headline =
    report.gradeEquivalentLevel !== null
      ? heroTopic
        ? `Performing at a Grade ${heroTopic.grade} level in ${heroTopic.topicArea}.`
        : `Performing at a Grade ${report.gradeEquivalentLevel} level.`
      : ge.basis === "below_floor"
        ? `Currently performing below Grade 5 level (estimated from ability).`
        : ge.basis === "above_ceiling"
          ? `Performing beyond Grade 10 level (estimated from ability).`
          : `Performing at about Grade ${ge.grade} level (estimated from ability).`;
  doc.font("Bold").fontSize(15).fillColor(INK).text(T(headline), M, doc.y, {
    width: CONTENT_W,
  });
  doc.moveDown(0.6);

  // ── Stat cards ─────────────────────────────────────────────────────────────
  const stats: [string, string][] = [
    ["Questions", `${report.totals.questions}${report.totals.twinProbes ? ` (+${report.totals.twinProbes})` : ""}`],
    ["Correct", `${report.totals.correct}`],
    [
      "Grade level",
      ge.basis === "demonstrated" ? ge.label : `${ge.label} (est.)`,
    ],
    ["Ability (theta)", report.theta.toFixed(2)],
    [
      "Time taken",
      report.durationSeconds !== null
        ? fmtDuration(report.durationSeconds) +
          (report.terminationReason === "time_up" ? " (time up)" : "")
        : "—",
    ],
  ];
  const cardW = (CONTENT_W - 4 * 8) / 5;
  const cardY = doc.y;
  stats.forEach(([label, value], i) => {
    const x = M + i * (cardW + 8);
    doc.roundedRect(x, cardY, cardW, 52, 8).fill(PANEL);
    doc.roundedRect(x, cardY, cardW, 52, 8).lineWidth(0.8).stroke(LINE);
    doc
      .font("Bold")
      .fontSize(6.5)
      .fillColor(FAINT)
      .text(T(label).toUpperCase(), x + 10, cardY + 9, { width: cardW - 20, characterSpacing: 0.5 });
    doc
      .font("Bold")
      .fontSize(10.5)
      .fillColor(INK)
      .text(T(value), x + 10, cardY + 21, { width: cardW - 18 });
  });
  doc.y = cardY + 68;

  // ── Root cause diagnosis ───────────────────────────────────────────────────
  sectionTitle(doc, "Root Cause Diagnosis");
  for (const line of report.narrative) {
    const text = T(line);
    const h = doc.font("Body").fontSize(9.5).heightOfString(text, { width: CONTENT_W - 16 });
    ensure(doc, h + 8);
    doc.circle(M + 3, doc.y + 5, 1.8).fill(INDIGO);
    doc
      .font("Body")
      .fontSize(9.5)
      .fillColor("#334155")
      .text(text, M + 14, doc.y, { width: CONTENT_W - 16, lineGap: 1.5 });
    doc.y += 6;
  }
  if (report.readingVsMath.readingGapDetected) {
    const note =
      "Reading-comprehension gap detected: the equation versions of missed word problems were solved correctly. The gap is in decoding language, not in mathematics.";
    const h = doc.font("Body").fontSize(9).heightOfString(T(note), { width: CONTENT_W - 28 });
    ensure(doc, h + 22);
    doc.roundedRect(M, doc.y, CONTENT_W, h + 16, 8).fill("#eef2ff");
    doc
      .font("Bold")
      .fontSize(9)
      .fillColor(INDIGO)
      .text(T(note), M + 14, doc.y + 8, { width: CONTENT_W - 28, lineGap: 1.5 });
    doc.y += h + 24;
  }
  doc.y += 6;

  // ── Learning dimensions ────────────────────────────────────────────────────
  sectionTitle(doc, "Five Learning Dimensions", VIOLET);
  for (const d of report.dimensionScores) {
    ensure(doc, 22);
    const y = doc.y;
    doc.font("Bold").fontSize(9).fillColor("#334155").text(d.dimension, M, y, { width: 110 });
    hBar(doc, M + 118, y + 1, CONTENT_W - 118 - 46, 8, (d.score ?? 0) / 100, VIOLET);
    doc
      .font("Bold")
      .fontSize(9)
      .fillColor(d.score !== null ? INK : FAINT)
      .text(d.score !== null ? `${Math.round(d.score)}%` : "—", PAGE_W - M - 38, y, {
        width: 38,
        align: "right",
      });
    doc.y = y + 19;
  }
  doc.y += 10;

  // ── Error taxonomy ─────────────────────────────────────────────────────────
  sectionTitle(doc, "Error Pattern Breakdown", AMBER);
  if (report.errorTaxonomy.length === 0) {
    ensure(doc, 16);
    doc.font("Body").fontSize(9.5).fillColor(MUTED).text("No classified errors in this session — a clean run.", M, doc.y);
    doc.y += 18;
  } else {
    for (const e of report.errorTaxonomy) {
      ensure(doc, 22);
      const y = doc.y;
      doc
        .font("Bold")
        .fontSize(9)
        .fillColor("#334155")
        .text(e.trapType.replace(/_/g, " "), M, y, { width: 130 });
      hBar(doc, M + 138, y + 1, CONTENT_W - 138 - 78, 8, e.percentage / 100, AMBER);
      doc
        .font("Body")
        .fontSize(8.5)
        .fillColor(MUTED)
        .text(`${e.count} · ${e.percentage}%`, PAGE_W - M - 70, y, { width: 70, align: "right" });
      doc.y = y + 19;
    }
  }
  doc.y += 10;

  // ── Performance by difficulty + pace ───────────────────────────────────────
  if (report.performanceByBand.length > 0) {
    sectionTitle(doc, "Performance by Difficulty", INDIGO);
    for (const b of report.performanceByBand) {
      ensure(doc, 22);
      const y = doc.y;
      const bandColor = b.band === "easy" ? EMERALD : b.band === "medium" ? AMBER : ROSE;
      doc
        .font("Bold")
        .fontSize(9)
        .fillColor("#334155")
        .text(b.band.charAt(0).toUpperCase() + b.band.slice(1), M, y, { width: 90 });
      hBar(doc, M + 98, y + 1, CONTENT_W - 98 - 96, 8, b.accuracy / 100, bandColor);
      doc
        .font("Body")
        .fontSize(8.5)
        .fillColor(MUTED)
        .text(`${b.correct}/${b.total} · ${Math.round(b.accuracy)}%`, PAGE_W - M - 88, y, {
          width: 88,
          align: "right",
        });
      doc.y = y + 19;
    }
    const paceBits: string[] = [];
    if (report.timing.avgMs !== null) paceBits.push(`average ${fmtMs(report.timing.avgMs)} per question`);
    if (report.timing.fastestMs !== null) paceBits.push(`fastest ${fmtMs(report.timing.fastestMs)}`);
    if (report.timing.slowestMs !== null) paceBits.push(`slowest ${fmtMs(report.timing.slowestMs)}`);
    if (paceBits.length > 0) {
      ensure(doc, 14);
      doc
        .font("Body")
        .fontSize(8.5)
        .fillColor(FAINT)
        .text(T(`Pace: ${paceBits.join("  ·  ")}`), M, doc.y, { width: CONTENT_W });
      doc.y += 12;
    }
    doc.y += 8;
  }

  // ── Skill mastery ──────────────────────────────────────────────────────────
  sectionTitle(doc, "Skill Mastery (Bayesian Knowledge Tracing)", EMERALD);
  for (const s of report.skillMastery) {
    ensure(doc, 26);
    const y = doc.y;
    doc.font("Bold").fontSize(9).fillColor(INK).text(T(s.skillName), M, y, {
      width: 168,
      ellipsis: true,
      height: 12,
    });
    doc
      .font("Body")
      .fontSize(7)
      .fillColor(FAINT)
      .text(`Grade ${s.gradeLevel ?? "?"} · ${s.attempts} attempt${s.attempts === 1 ? "" : "s"}`, M, y + 11);
    hBar(doc, M + 178, y + 4, CONTENT_W - 178 - 118, 8, s.pMastery, statusColor(s.status));
    doc
      .font("Bold")
      .fontSize(9)
      .fillColor(INK)
      .text(`${Math.round(s.pMastery * 100)}%`, PAGE_W - M - 108, y + 3, { width: 34, align: "right" });
    doc
      .font("Bold")
      .fontSize(7.5)
      .fillColor(statusColor(s.status))
      .text(s.status.toUpperCase(), PAGE_W - M - 66, y + 4, { width: 66, align: "right", characterSpacing: 0.4 });
    doc.y = y + 25;
  }
  doc.y += 10;

  // ── Foundational gap chains ────────────────────────────────────────────────
  if (report.foundationalGapChains.length > 0) {
    sectionTitle(doc, "Foundational Gap Chains", ROSE);
    const intro =
      "When answers went wrong, the engine walked down the prerequisite chain to locate the root cause:";
    ensure(doc, 16);
    doc.font("Body").fontSize(9).fillColor(MUTED).text(T(intro), M, doc.y, { width: CONTENT_W });
    doc.y += 8;
    for (const chain of report.foundationalGapChains) {
      const text = T(chain.join("  →  "));
      const h = doc.font("Body").fontSize(9).heightOfString(text, { width: CONTENT_W - 28 });
      ensure(doc, h + 20);
      doc.roundedRect(M, doc.y, CONTENT_W, h + 14, 7).fill("#fff1f2");
      doc
        .font("Body")
        .fontSize(9)
        .fillColor("#9f1239")
        .text(text, M + 14, doc.y + 7, { width: CONTENT_W - 28, lineGap: 1.5 });
      doc.y += h + 20;
    }
    doc.y += 8;
  }

  // ── Focus areas ────────────────────────────────────────────────────────────
  sectionTitle(doc, "Recommended Focus Areas", "#0284c7");
  if (report.focusAreas.length === 0) {
    ensure(doc, 16);
    doc
      .font("Body")
      .fontSize(9.5)
      .fillColor(MUTED)
      .text("Nothing urgent — keep practising at grade level.", M, doc.y);
    doc.y += 18;
  } else {
    report.focusAreas.forEach((f, i) => {
      const ref = f.ncertReference ? T(f.ncertReference) : null;
      const refH = ref
        ? doc.font("Body").fontSize(8).heightOfString(ref, { width: CONTENT_W - 60 })
        : 0;
      const blockH = 30 + (ref ? refH + 4 : 0);
      ensure(doc, blockH + 8);
      const y = doc.y;
      doc.roundedRect(M, y, CONTENT_W, blockH, 8).fill(PANEL);
      doc.roundedRect(M, y, CONTENT_W, blockH, 8).lineWidth(0.8).stroke(LINE);
      doc.roundedRect(M + 12, y + 8, 16, 16, 5).fill(INDIGO);
      doc.font("Bold").fontSize(9).fillColor(WHITE).text(String(i + 1), M + 12, y + 12, { width: 16, align: "center" });
      doc
        .font("Bold")
        .fontSize(10)
        .fillColor(INK)
        .text(T(f.skillName), M + 38, y + 8, { width: CONTENT_W - 180 });
      doc
        .font("Body")
        .fontSize(8)
        .fillColor(MUTED)
        .text(`Grade ${f.gradeLevel ?? "?"}  ·  mastery ${Math.round(f.pMastery * 100)}%`, PAGE_W - M - 130, y + 10, { width: 118, align: "right" });
      if (ref) {
        doc.font("Body").fontSize(8).fillColor(FAINT).text(ref, M + 38, y + 24, { width: CONTENT_W - 60 });
      }
      doc.y = y + blockH + 8;
    });
  }
  doc.y += 6;

  // ── Question response analysis (appendix) ─────────────────────────────────
  sectionTitle(doc, "Question Response Analysis", MUTED);
  const cols = [
    { key: "n", label: "#", w: 22 },
    { key: "skill", label: "Skill", w: 96 },
    { key: "lvl", label: "Level", w: 58 },
    { key: "q", label: "Question", w: 163 },
    { key: "ans", label: "Answer", w: 58 },
    { key: "time", label: "Time", w: 36 },
    { key: "result", label: "Result", w: 66 },
  ];
  const tableX = M;

  const drawHead = () => {
    ensure(doc, 24);
    const y = doc.y;
    doc.roundedRect(tableX, y, CONTENT_W, 18, 5).fill("#eef2ff");
    let cx = tableX + 8;
    for (const c of cols) {
      doc
        .font("Bold")
        .fontSize(7.5)
        .fillColor(INDIGO)
        .text(c.label.toUpperCase(), cx, y + 5.5, { width: c.w - 8, characterSpacing: 0.4 });
      cx += c.w;
    }
    doc.y = y + 22;
  };
  drawHead();

  log.forEach((r, idx) => {
    const qText = T(r.questionText);
    const skillText = T(r.skillName ?? "—") + (r.twinProbe ? "  (twin probe)" : "");
    // The "why it went wrong" explanation rides under the row for mistakes.
    const whyText = !r.isCorrect
      ? T(
          [
            r.trapType ? r.trapType.replace(/_/g, " ") : null,
            r.misconception,
            r.misconceptionDetail,
            r.practiceNext
              ? `Next: practise ${r.practiceNext.skillName}${r.practiceNext.grade ? ` (Grade ${r.practiceNext.grade})` : ""}`
              : null,
          ]
            .filter(Boolean)
            .join(" — ")
        )
      : "";
    const qH = doc.font("Body").fontSize(8).heightOfString(qText, { width: cols[3].w - 10 });
    const sH = doc.font("Body").fontSize(8).heightOfString(skillText, { width: cols[1].w - 10 });
    const whyH = whyText
      ? doc.font("Body").fontSize(7).heightOfString(`Why: ${whyText}`, {
          width: CONTENT_W - cols[0].w - 24,
        }) + 6
      : 0;
    const rowH = Math.max(qH, sH, 10) + 10 + whyH;
    if (doc.y + rowH > BOTTOM) {
      doc.addPage();
      doc.y = M;
      drawHead();
    }
    const y = doc.y;
    if (idx % 2 === 0) doc.rect(tableX, y - 2, CONTENT_W, rowH).fill(PANEL);

    let cx = tableX + 8;
    doc.font("Bold").fontSize(8).fillColor(MUTED).text(String(r.order), cx, y + 3, { width: cols[0].w - 8 });
    cx += cols[0].w;
    doc.font("Body").fontSize(8).fillColor(INK).text(skillText, cx, y + 3, { width: cols[1].w - 10 });
    cx += cols[1].w;
    doc
      .font("Body")
      .fontSize(8)
      .fillColor(MUTED)
      .text(T(`G${r.grade ?? "?"} · ${r.difficulty ?? "?"}`), cx, y + 3, { width: cols[2].w - 10 });
    cx += cols[2].w;
    doc.font("Body").fontSize(8).fillColor("#334155").text(qText, cx, y + 3, { width: cols[3].w - 10, lineGap: 1 });
    cx += cols[3].w;
    const ansText = r.isCorrect
      ? `${r.selected ?? "—"}`
      : `${r.selected ?? "—"} (ans ${r.correctOption ?? "—"})`;
    doc.font("Body").fontSize(8).fillColor(MUTED).text(ansText, cx, y + 3, { width: cols[4].w - 10 });
    cx += cols[4].w;
    doc.font("Body").fontSize(8).fillColor(MUTED).text(fmtMs(r.timeMs), cx, y + 3, { width: cols[5].w - 8 });
    cx += cols[5].w;
    doc
      .font("Bold")
      .fontSize(8)
      .fillColor(r.isCorrect ? EMERALD : ROSE)
      .text(r.isCorrect ? "Correct" : "Wrong", cx, y + 3, { width: cols[6].w - 8 });

    if (whyText) {
      const whyY = y + Math.max(qH, sH, 10) + 8;
      doc
        .font("Body")
        .fontSize(7)
        .fillColor("#b45309")
        .text(`Why: ${whyText}`, tableX + cols[0].w + 8, whyY, {
          width: CONTENT_W - cols[0].w - 24,
          lineGap: 1,
        });
    }
    doc.y = y + rowH;
  });

  // ── Footer with page numbers (stamped on every page) ───────────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc
      .font("Body")
      .fontSize(7.5)
      .fillColor(FAINT)
      .text(
        `Zarban · Adaptive Math Assessment  —  ${report.student.name ?? "Student"}, Class ${report.selectedGrade}`,
        M,
        PAGE_H - 34,
        { width: CONTENT_W - 80, lineBreak: false }
      );
    doc
      .font("Body")
      .fontSize(7.5)
      .fillColor(FAINT)
      .text(`Page ${i + 1} of ${range.count}`, PAGE_W - M - 80, PAGE_H - 34, {
        width: 80,
        align: "right",
        lineBreak: false,
      });
    doc
      .moveTo(M, PAGE_H - 42)
      .lineTo(PAGE_W - M, PAGE_H - 42)
      .lineWidth(0.5)
      .stroke(LINE);
  }

  doc.end();
  return finished;
}
