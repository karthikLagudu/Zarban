"use client";

// Detailed Analysis — a deep-dive companion to the diagnostic report:
// the ability (θ) journey, the adaptive path the engine took, pacing,
// skill & topic deep-dives, and a mistakes/misconceptions table.

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Dice5,
  FileDown,
  Gauge,
  LineChart as LineChartIcon,
  Map,
  Microscope,
  Table2,
  TriangleAlert,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface QuestionAnalysisRow {
  order: number;
  questionId: string;
  questionText: string;
  selected: string | null;
  correctOption: string | null;
  isCorrect: boolean;
  twinProbe: boolean;
  skillName: string | null;
  topicArea: string | null;
  grade: number | null;
  difficulty: string | null;
  timeMs: number | null;
  pace: "quick" | "steady" | "slow" | null;
  rushed: boolean;
  likelyGuess: boolean;
  thetaAfter: number | null;
  pMasteryAfter: number | null;
  trapType: string | null;
  misconception: string | null;
  misconceptionDetail: string | null;
  practiceNext: { skillName: string; grade: number | null } | null;
}

interface Report {
  sessionId: string;
  student: { name: string | null; school: string | null };
  selectedGrade: number;
  durationSeconds: number | null;
  timing: { avgMs: number | null; fastestMs: number | null; slowestMs: number | null };
  totals: { questions: number; modelQuestions: number; twinProbes: number; correct: number; accuracy: number };
  theta: number;
  gradeEquivalent: { label: string; short: string };
  questionAnalysis: QuestionAnalysisRow[];
  skillBreakdown: {
    skillId: string;
    skillName: string;
    topicArea: string | null;
    gradeLevel: string | null;
    attempts: number;
    correct: number;
    accuracy: number;
    avgMs: number | null;
    finalMastery: number | null;
  }[];
  topicBreakdown: { topic: string; attempts: number; correct: number; accuracy: number }[];
  behavior: {
    likelyGuesses: number;
    rushedAnswers: number;
    rushedMistakes: number;
    rushFloorMs: number;
    notes: string[];
  };
}

const BAND_COLORS: Record<string, string> = {
  easy: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  medium: "bg-amber-100 text-amber-800 ring-amber-200",
  hard: "bg-rose-100 text-rose-800 ring-rose-200",
};

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}
function formatMs(ms: number | null): string {
  if (ms === null || ms <= 0) return "—";
  if (ms < 1000) return "<1s";
  const s = Math.round(ms / 1000);
  return s >= 60 ? formatDuration(s) : `${s}s`;
}

export default function DetailedAnalysisPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/session/report/${sessionId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Report not found");
        setReport(d);
      })
      .catch((e) => setError(e.message));
  }, [sessionId]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center font-medium text-rose-600">
        {error}
      </main>
    );
  }
  if (!report) {
    return (
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="skeleton h-32 w-full rounded-3xl" />
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="skeleton h-72 rounded-3xl" />
          <div className="skeleton h-72 rounded-3xl" />
        </div>
      </main>
    );
  }

  const rows = report.questionAnalysis;
  const thetaData = rows
    .filter((r) => r.thetaAfter !== null)
    .map((r) => ({ q: `Q${r.order}`, theta: Math.round((r.thetaAfter as number) * 100) / 100 }));
  const timeData = rows.map((r) => ({
    q: `Q${r.order}`,
    seconds: r.timeMs && r.timeMs > 0 ? Math.round(r.timeMs / 100) / 10 : 0,
    correct: r.isCorrect,
  }));
  const avgSeconds = report.timing.avgMs ? Math.round(report.timing.avgMs / 100) / 10 : null;
  const mistakes = rows.filter((r) => !r.isCorrect);

  return (
    <main className="relative min-h-screen">
      <div className="bg-dot-grid absolute inset-0 opacity-30" />
      <div className="relative mx-auto max-w-5xl px-6 py-10">
        {/* Header */}
        <div className="animate-fade-up">
          <Link
            href={`/report/${sessionId}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to report
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display flex items-center gap-2.5 text-3xl font-bold text-slate-900">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-200">
                  <Microscope className="h-6 w-6" />
                </span>
                Detailed Analysis
              </h1>
              <p className="mt-1.5 text-sm text-slate-500">
                {report.student.name ?? "Student"} · Class {report.selectedGrade} — how the
                adaptive engine saw this session, question by question.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatPill label="Score" value={`${Math.round(report.totals.accuracy)}%`} />
              <StatPill label="Level" value={report.gradeEquivalent.short} />
              <StatPill label="Ability θ" value={report.theta.toFixed(2)} />
              <StatPill
                label="Time"
                value={report.durationSeconds !== null ? formatDuration(report.durationSeconds) : "—"}
              />
            </div>
          </div>
        </div>

        {/* θ journey */}
        <section className="animate-fade-up delay-1 mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <SectionTitle icon={LineChartIcon} tone="indigo">
            Ability journey (θ)
          </SectionTitle>
          <p className="mt-1 text-xs text-slate-400">
            The engine's running estimate of ability after each answer — rising on correct
            answers, falling on mistakes, on a −4 to +4 scale.
          </p>
          {thetaData.length === 0 ? (
            <EmptyNote>No ability data recorded for this session.</EmptyNote>
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={thetaData}>
                  <CartesianGrid stroke="#f1f5f9" />
                  <XAxis dataKey="q" tick={{ fontSize: 11, fill: "#94a3b8" }} interval="preserveStartEnd" />
                  <YAxis domain={[-4, 4]} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip />
                  <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="4 4" />
                  <Line
                    dataKey="theta"
                    stroke="#4f46e5"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#4f46e5" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Adaptive path */}
        <section className="animate-fade-up delay-2 mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <SectionTitle icon={Map} tone="violet">
            Adaptive path
          </SectionTitle>
          <p className="mt-1 text-xs text-slate-400">
            Every question the engine served: grade, difficulty band, and outcome. Watch it
            escalate on streaks and step down to prerequisites after mistakes.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {rows.map((r) => (
              <div
                key={r.order}
                title={`Q${r.order} · ${r.skillName ?? "?"} · Grade ${r.grade ?? "?"} · ${r.difficulty ?? "?"}${r.twinProbe ? " · twin probe" : ""}${r.likelyGuess ? " · likely lucky guess" : r.rushed ? " · rushed" : ""}`}
                className={`relative flex min-w-[64px] flex-col items-center rounded-xl px-2.5 py-2 ring-1 ${BAND_COLORS[r.difficulty ?? "medium"] ?? "bg-slate-100 text-slate-700 ring-slate-200"} ${r.twinProbe ? "outline-2 outline-dashed outline-violet-400" : ""}`}
              >
                {r.likelyGuess ? (
                  <Dice5 className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-violet-500 p-0.5 text-white shadow" />
                ) : r.rushed ? (
                  <Zap className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-amber-500 p-0.5 text-white shadow" />
                ) : null}
                <span className="text-[10px] font-bold opacity-70">Q{r.order}</span>
                <span className="text-sm font-bold">G{r.grade ?? "?"}</span>
                <span className={`mt-0.5 text-xs font-bold ${r.isCorrect ? "text-emerald-700" : "text-rose-700"}`}>
                  {r.isCorrect ? "✓" : "✗"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-200" />easy</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-200" />medium</span>
            <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-rose-200" />hard</span>
            <span className="text-violet-500">dashed outline = twin probe</span>
            <span className="flex items-center gap-1 text-violet-600">
              <Dice5 className="h-3.5 w-3.5" /> likely guess
            </span>
            <span className="flex items-center gap-1 text-amber-600">
              <Zap className="h-3.5 w-3.5" /> rushed
            </span>
          </div>
        </section>

        {/* Time per question */}
        <section className="animate-fade-up delay-2 mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <SectionTitle icon={Clock} tone="sky">
            Time per question
          </SectionTitle>
          <p className="mt-1 text-xs text-slate-400">
            Seconds spent on each question — green answered correctly, red answered wrong
            {avgSeconds !== null ? `; the dashed line is your average (${avgSeconds}s)` : ""}.
          </p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeData}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="q" tick={{ fontSize: 11, fill: "#94a3b8" }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} unit="s" />
                <Tooltip formatter={(v) => [`${v}s`, "time"]} />
                {avgSeconds !== null && (
                  <ReferenceLine y={avgSeconds} stroke="#94a3b8" strokeDasharray="5 5" />
                )}
                <Bar dataKey="seconds" radius={[4, 4, 0, 0]}>
                  {timeData.map((d, i) => (
                    <Cell key={i} fill={d.correct ? "#10b981" : "#f43f5e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <BehaviorCallout
            behavior={report.behavior}
            rushedRows={rows.filter((r) => r.rushed)}
            guessRows={rows.filter((r) => r.likelyGuess)}
          />
        </section>

        {/* Skill deep-dive */}
        <section className="animate-fade-up delay-3 mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <SectionTitle icon={Table2} tone="emerald">
            Skill deep-dive
          </SectionTitle>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs tracking-wider text-slate-400 uppercase">
                  <th className="py-2.5 pr-4">Skill</th>
                  <th className="py-2.5 pr-4">Grade</th>
                  <th className="py-2.5 pr-4">Attempts</th>
                  <th className="py-2.5 pr-4">Accuracy</th>
                  <th className="py-2.5 pr-4">Avg time</th>
                  <th className="py-2.5">Mastery</th>
                </tr>
              </thead>
              <tbody>
                {report.skillBreakdown.map((s) => (
                  <tr key={s.skillId} className="border-b border-slate-50 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-slate-800">{s.skillName}</p>
                      <p className="text-xs text-slate-400">{s.topicArea ?? "—"}</p>
                    </td>
                    <td className="py-3 pr-4 tabular-nums">{s.gradeLevel ?? "—"}</td>
                    <td className="py-3 pr-4 tabular-nums">
                      {s.correct}/{s.attempts}
                    </td>
                    <td className="w-48 py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full ${s.accuracy >= 70 ? "bg-emerald-400" : s.accuracy >= 40 ? "bg-amber-400" : "bg-rose-400"}`}
                            style={{ width: `${s.accuracy}%` }}
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-bold tabular-nums">
                          {Math.round(s.accuracy)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-slate-500 tabular-nums">{formatMs(s.avgMs)}</td>
                    <td className="py-3">
                      {s.finalMastery !== null ? (
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            s.finalMastery >= 0.95
                              ? "bg-emerald-50 text-emerald-700"
                              : s.finalMastery >= 0.5
                                ? "bg-amber-50 text-amber-700"
                                : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {Math.round(s.finalMastery * 100)}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Topic breakdown */}
        <section className="animate-fade-up delay-3 mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <SectionTitle icon={BookOpen} tone="amber">
            Topic breakdown
          </SectionTitle>
          <ul className="mt-4 space-y-3">
            {report.topicBreakdown.map((t) => (
              <li key={t.topic} className="flex items-center gap-4">
                <span className="w-28 shrink-0 text-sm font-semibold text-slate-700">{t.topic}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${t.accuracy >= 70 ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : t.accuracy >= 40 ? "bg-gradient-to-r from-amber-300 to-amber-400" : "bg-gradient-to-r from-rose-400 to-rose-500"}`}
                    style={{ width: `${t.accuracy}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-sm text-slate-500 tabular-nums">
                  {t.correct}/{t.attempts} · {Math.round(t.accuracy)}%
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Mistakes & misconceptions */}
        <section className="animate-fade-up delay-4 mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <SectionTitle icon={TriangleAlert} tone="rose">
            Mistakes & misconceptions
          </SectionTitle>
          {mistakes.length === 0 ? (
            <EmptyNote>No mistakes in this session. 🎉</EmptyNote>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs tracking-wider text-slate-400 uppercase">
                    <th className="py-2.5 pr-4">#</th>
                    <th className="py-2.5 pr-4">Question</th>
                    <th className="py-2.5 pr-4">Answer</th>
                    <th className="py-2.5 pr-4">Error type</th>
                    <th className="py-2.5">Practice next</th>
                  </tr>
                </thead>
                <tbody>
                  {mistakes.map((r) => (
                    <tr key={r.order} className="border-b border-slate-50 align-top last:border-0">
                      <td className="py-3 pr-4 font-bold text-slate-400 tabular-nums">Q{r.order}</td>
                      <td className="max-w-md py-3 pr-4">
                        <p className="text-slate-800">{r.questionText}</p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {r.skillName ?? "—"} · G{r.grade ?? "?"} · {r.difficulty ?? "?"}
                        </p>
                        {(r.misconception || r.misconceptionDetail) && (
                          <p className="mt-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs leading-relaxed text-amber-800">
                            {[r.misconception, r.misconceptionDetail].filter(Boolean).join(" — ")}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span className="font-bold text-rose-600">{r.selected ?? "—"}</span>
                        <span className="text-slate-400"> → </span>
                        <span className="font-bold text-emerald-600">{r.correctOption ?? "—"}</span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.trapType ? (
                            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-rose-700">
                              {r.trapType.replace(/_/g, " ")}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                          {r.rushed && (
                            <span
                              className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold whitespace-nowrap text-amber-700"
                              title="Answered very fast — a rushed, careless slip rather than a knowledge gap"
                            >
                              <Zap className="h-3 w-3" /> rushed
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-xs text-slate-600">
                        {r.practiceNext
                          ? `${r.practiceNext.skillName}${r.practiceNext.grade ? ` (G${r.practiceNext.grade})` : ""}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="print-hidden mt-8 flex flex-wrap justify-center gap-3 pb-10">
          <Link
            href={`/report/${sessionId}`}
            className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-3 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-110"
          >
            Back to report
          </Link>
          <a
            href={`/api/session/report/${sessionId}/pdf`}
            download
            className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <FileDown className="h-4 w-4" /> Download PDF
          </a>
        </footer>
      </div>
    </main>
  );
}

// ── Test-taking behaviour callout ────────────────────────────────────────────

function BehaviorCallout({
  behavior,
  rushedRows,
  guessRows,
}: {
  behavior: Report["behavior"];
  rushedRows: QuestionAnalysisRow[];
  guessRows: QuestionAnalysisRow[];
}) {
  if (behavior.likelyGuesses === 0 && behavior.rushedAnswers === 0) {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-100">
        <Gauge className="h-4 w-4 shrink-0 text-emerald-500" />
        Steady, considered pacing — no rushed answers or lucky guesses detected.
      </p>
    );
  }
  const seconds = Math.round(behavior.rushFloorMs / 1000);
  const qList = (rows: QuestionAnalysisRow[]) =>
    rows.map((r) => `Q${r.order}`).join(", ");
  return (
    <div className="mt-4 rounded-2xl bg-amber-50/70 px-5 py-4 ring-1 ring-amber-100">
      <p className="flex items-center gap-2 text-sm font-bold text-amber-800">
        <Gauge className="h-4 w-4 text-amber-500" /> Test-taking behaviour
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {behavior.likelyGuesses > 0 && (
          <p className="flex items-start gap-2 text-sm text-slate-700">
            <Dice5 className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
            <span>
              <span className="font-semibold text-slate-900">
                {behavior.likelyGuesses} likely lucky guess
                {behavior.likelyGuesses === 1 ? "" : "es"}
              </span>{" "}
              — correct but answered in under {seconds}s on harder items
              {guessRows.length > 0 ? ` (${qList(guessRows)})` : ""}.
            </span>
          </p>
        )}
        {behavior.rushedAnswers > 0 && (
          <p className="flex items-start gap-2 text-sm text-slate-700">
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>
              <span className="font-semibold text-slate-900">
                {behavior.rushedAnswers} rushed answer
                {behavior.rushedAnswers === 1 ? "" : "s"}
              </span>{" "}
              — under {seconds}s each
              {behavior.rushedMistakes > 0
                ? `, ${behavior.rushedMistakes} of them wrong`
                : ""}
              {rushedRows.length > 0 ? ` (${qList(rushedRows)})` : ""}.
            </span>
          </p>
        )}
      </div>
      {behavior.notes.map((note, i) => (
        <p key={i} className="mt-2 text-sm leading-relaxed text-amber-900">
          {note}
        </p>
      ))}
    </div>
  );
}

// ── Presentational helpers ───────────────────────────────────────────────────

const TONE_STYLES: Record<string, string> = {
  indigo: "bg-indigo-100 text-indigo-600",
  violet: "bg-violet-100 text-violet-600",
  amber: "bg-amber-100 text-amber-600",
  emerald: "bg-emerald-100 text-emerald-600",
  rose: "bg-rose-100 text-rose-600",
  sky: "bg-sky-100 text-sky-600",
};

function SectionTitle({
  icon: Icon,
  tone,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2.5 text-sm font-bold tracking-wider text-slate-600 uppercase">
      <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${TONE_STYLES[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      {children}
    </h2>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-5 text-sm text-slate-400">{children}</p>;
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
      <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">{label}</p>
      <p className="text-lg leading-tight font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}
