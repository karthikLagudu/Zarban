"use client";

// Post-Assessment Report (spec 5.1.4): hero, radar chart, skill mastery bars,
// root-cause diagnosis, foundational gap chains, recommended focus areas.

import { use, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Check,
  Dice5,
  FileDown,
  GitBranch,
  Gauge,
  ListChecks,
  Microscope,
  Printer,
  Target,
  Timer,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

interface QuestionAnalysisRow {
  order: number;
  questionId: string;
  questionText: string;
  options: { label: string; text: string }[];
  selected: string | null;
  correctOption: string | null;
  isCorrect: boolean;
  twinProbe: boolean;
  skillName: string | null;
  grade: number | null;
  difficulty: string | null;
  primaryDimension: string | null;
  timeMs: number | null;
  pace: "quick" | "steady" | "slow" | null;
  rushed: boolean;
  likelyGuess: boolean;
  trapType: string | null;
  misconception: string | null;
  misconceptionDetail: string | null;
  practiceNext: { skillName: string; grade: number | null } | null;
}

interface Report {
  sessionId: string;
  student: { name: string | null; school: string | null };
  selectedGrade: number;
  status: string;
  terminationReason: string | null;
  durationSeconds: number | null;
  timing: {
    avgMs: number | null;
    fastestMs: number | null;
    slowestMs: number | null;
  };
  performanceByBand: {
    band: string;
    total: number;
    correct: number;
    accuracy: number;
  }[];
  questionAnalysis: QuestionAnalysisRow[];
  gradeEquivalent: {
    label: string;
    short: string;
    grade: number | null;
    basis: "demonstrated" | "estimated" | "below_floor" | "above_ceiling";
  };
  totals: {
    questions: number;
    modelQuestions: number;
    twinProbes: number;
    correct: number;
    accuracy: number;
  };
  theta: number;
  gradeEquivalentLevel: number | null;
  gradeEquivalentByTopic: { topicArea: string; grade: number }[];
  skillMastery: {
    skillId: string;
    skillName: string;
    gradeLevel: string | null;
    pMastery: number;
    attempts: number;
    status: "Mastered" | "Developing" | "Gap";
  }[];
  errorTaxonomy: { trapType: string; count: number; percentage: number }[];
  dimensionScores: { dimension: string; score: number | null }[];
  readingVsMath: {
    readingErrors: number;
    conceptErrors: number;
    wordProblemFailures: number;
    readingGapDetected: boolean;
  };
  foundationalGapChains: string[][];
  behavior: {
    likelyGuesses: number;
    rushedAnswers: number;
    rushedMistakes: number;
    rushFloorMs: number;
    notes: string[];
  };
  narrative: string[];
  focusAreas: {
    skillId: string;
    skillName: string;
    gradeLevel: string | null;
    pMastery: number;
    ncertReference: string | null;
  }[];
}

const STATUS_COLORS: Record<string, string> = {
  Mastered: "bg-gradient-to-r from-emerald-400 to-emerald-500",
  Developing: "bg-gradient-to-r from-amber-300 to-amber-400",
  Gap: "bg-gradient-to-r from-rose-400 to-rose-500",
};
const STATUS_BADGE: Record<string, string> = {
  Mastered: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  Developing: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  Gap: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
};

export default function ReportPage({
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
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Report not found");
        setReport(data);
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
      <main className="mx-auto max-w-4xl px-6 py-10">
        <div className="skeleton h-56 w-full rounded-3xl" />
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="skeleton h-80 rounded-3xl" />
          <div className="skeleton h-80 rounded-3xl" />
        </div>
        <p className="mt-8 text-center text-sm text-slate-400">
          Building your diagnostic report…
        </p>
      </main>
    );
  }

  const radarData = report.dimensionScores.map((d) => ({
    dimension: d.dimension,
    score: d.score ?? 0,
  }));
  const heroTopic = report.gradeEquivalentByTopic[0];

  return (
    <main className="relative min-h-screen">
      <div className="bg-dot-grid absolute inset-0 opacity-30" />
      <div className="relative mx-auto max-w-4xl px-6 py-10">
        {/* Hero */}
        <section className="animate-fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-8 text-white shadow-2xl shadow-indigo-200 sm:p-10">
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-violet-400/20 blur-3xl" />

          <div className="relative flex flex-wrap items-center justify-between gap-8">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold tracking-widest text-indigo-200 uppercase">
                Diagnostic Report · {report.student.name ?? "Student"}
                {report.student.school ? ` · ${report.student.school}` : ""}
              </p>
              <h1 className="mt-3 text-3xl leading-tight font-bold sm:text-4xl">
                {report.gradeEquivalentLevel !== null
                  ? heroTopic
                    ? `You're performing at a Grade ${heroTopic.grade} level in ${heroTopic.topicArea}.`
                    : `You're performing at a Grade ${report.gradeEquivalentLevel} level.`
                  : report.gradeEquivalent.basis === "below_floor"
                    ? `You're currently performing below Grade 5 level.`
                    : report.gradeEquivalent.basis === "above_ceiling"
                      ? `You're performing beyond Grade 10 level.`
                      : `You're performing at about Grade ${report.gradeEquivalent.grade} level.`}
              </h1>
              {report.gradeEquivalent.basis !== "demonstrated" && (
                <p className="mt-2 text-sm text-indigo-200">
                  Estimated from your ability score — measured against the Grade{" "}
                  {report.selectedGrade} syllabus.
                </p>
              )}
              <div className="mt-6 flex flex-wrap gap-3">
                <HeroPill
                  label="Questions"
                  value={`${report.totals.questions}`}
                  sub={
                    report.totals.twinProbes > 0
                      ? `incl. ${report.totals.twinProbes} probe${report.totals.twinProbes === 1 ? "" : "s"}`
                      : undefined
                  }
                />
                <HeroPill
                  label="Grade level"
                  value={report.gradeEquivalent.short}
                  sub={
                    report.gradeEquivalent.basis !== "demonstrated"
                      ? "estimated"
                      : undefined
                  }
                />
                <HeroPill label="Ability θ" value={report.theta.toFixed(2)} />
                <HeroPill
                  label="Time taken"
                  value={
                    report.durationSeconds !== null
                      ? formatDuration(report.durationSeconds)
                      : "—"
                  }
                  sub={
                    report.terminationReason === "time_up"
                      ? "time ran out"
                      : undefined
                  }
                />
              </div>
            </div>
            <ScoreRing value={report.totals.accuracy} />
          </div>
        </section>

        {/* Narrative — root cause diagnosis card */}
        <section className="animate-fade-up delay-1 mt-6 rounded-3xl border border-indigo-100 bg-white/90 p-7 shadow-sm backdrop-blur">
          <SectionTitle icon={BrainCircuit} tone="indigo">
            Root Cause Diagnosis
          </SectionTitle>
          <div className="mt-4 space-y-2.5">
            {report.narrative.map((line, i) => (
              <p key={i} className="text-[15px] leading-relaxed text-slate-700">
                {line}
              </p>
            ))}
          </div>
          {report.readingVsMath.readingGapDetected && (
            <p className="mt-5 flex items-start gap-3 rounded-2xl bg-indigo-50 px-5 py-4 text-sm font-medium text-indigo-900 ring-1 ring-indigo-100">
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" />
              Strong in Math, struggles with English word problems — flagged as a
              reading comprehension gap, not a math gap.
            </p>
          )}
        </section>

        {/* Test-taking behaviour — flukes (lucky guesses) & rushed answers */}
        <BehaviorSection behavior={report.behavior} />

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Radar chart */}
          <section className="animate-fade-up delay-2 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <SectionTitle icon={Activity} tone="violet">
              Five Learning Dimensions
            </SectionTitle>
            <div className="mt-2 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis
                    dataKey="dimension"
                    tick={{ fill: "#475569", fontSize: 12, fontWeight: 600 }}
                  />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    dataKey="score"
                    stroke="#4f46e5"
                    strokeWidth={2}
                    fill="#6366f1"
                    fillOpacity={0.32}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-600">
              {report.dimensionScores.map((d) => (
                <li key={d.dimension} className="flex justify-between border-b border-dashed border-slate-100 pb-1">
                  <span>{d.dimension}</span>
                  <span className="font-bold text-slate-800 tabular-nums">
                    {d.score !== null ? `${Math.round(d.score)}%` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Error taxonomy */}
          <section className="animate-fade-up delay-3 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <SectionTitle icon={AlertTriangle} tone="amber">
              Error Pattern Breakdown
            </SectionTitle>
            {report.errorTaxonomy.length === 0 ? (
              <EmptyNote>No classified errors — clean run! 🎉</EmptyNote>
            ) : (
              <ul className="mt-5 space-y-4">
                {report.errorTaxonomy.map((e) => (
                  <li key={e.trapType}>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-slate-700">
                        {e.trapType.replace(/_/g, " ")}
                      </span>
                      <span className="text-slate-400 tabular-nums">
                        {e.count} · {e.percentage}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-violet-400 to-violet-600 transition-all duration-700"
                        style={{ width: `${e.percentage}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Difficulty + pace insights */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="animate-fade-up delay-3 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <SectionTitle icon={BarChart3} tone="indigo">
              Performance by Difficulty
            </SectionTitle>
            {report.performanceByBand.length === 0 ? (
              <EmptyNote>No data yet.</EmptyNote>
            ) : (
              <ul className="mt-5 space-y-4">
                {report.performanceByBand.map((b) => (
                  <li key={b.band}>
                    <div className="flex justify-between text-sm">
                      <span className="font-semibold text-slate-700 capitalize">
                        {b.band}
                      </span>
                      <span className="text-slate-400 tabular-nums">
                        {b.correct}/{b.total} · {Math.round(b.accuracy)}%
                      </span>
                    </div>
                    <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          b.band === "easy"
                            ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
                            : b.band === "medium"
                              ? "bg-gradient-to-r from-amber-300 to-amber-400"
                              : "bg-gradient-to-r from-rose-400 to-rose-500"
                        }`}
                        style={{ width: `${b.accuracy}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="animate-fade-up delay-3 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <SectionTitle icon={Timer} tone="sky">
              Pace
            </SectionTitle>
            <dl className="mt-5 grid grid-cols-2 gap-4">
              <PaceStat
                label="Total time"
                value={
                  report.durationSeconds !== null
                    ? formatDuration(report.durationSeconds)
                    : "—"
                }
              />
              <PaceStat
                label="Avg per question"
                value={report.timing.avgMs !== null ? formatMs(report.timing.avgMs) : "—"}
              />
              <PaceStat
                label="Fastest answer"
                value={
                  report.timing.fastestMs !== null
                    ? formatMs(report.timing.fastestMs)
                    : "—"
                }
              />
              <PaceStat
                label="Slowest answer"
                value={
                  report.timing.slowestMs !== null
                    ? formatMs(report.timing.slowestMs)
                    : "—"
                }
              />
            </dl>
            {report.terminationReason === "time_up" && (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 ring-1 ring-amber-100">
                ⏱ The test ended because the time limit ran out.
              </p>
            )}
          </section>
        </div>

        {/* Skill mastery table */}
        <section className="animate-fade-up delay-3 mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <SectionTitle icon={Target} tone="emerald">
            Skill Mastery
            <span className="ml-1 hidden text-xs font-medium text-slate-400 normal-case sm:inline">
              · Bayesian Knowledge Tracing
            </span>
          </SectionTitle>
          <ul className="mt-4 divide-y divide-slate-100">
            {report.skillMastery.map((s) => (
              <li key={s.skillId} className="flex items-center gap-4 py-3.5">
                <div className="w-52 shrink-0">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {s.skillName}
                  </p>
                  <p className="text-xs text-slate-400">
                    Grade {s.gradeLevel ?? "?"} · {s.attempts} attempt
                    {s.attempts === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${STATUS_COLORS[s.status]} transition-all duration-700`}
                    style={{ width: `${Math.round(s.pMastery * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-right text-sm font-bold text-slate-700 tabular-nums">
                  {Math.round(s.pMastery * 100)}%
                </span>
                <span
                  className={`hidden w-24 rounded-full px-2 py-1 text-center text-xs font-bold sm:block ${STATUS_BADGE[s.status]}`}
                >
                  {s.status}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Foundational gap chains */}
        {report.foundationalGapChains.length > 0 && (
          <section className="animate-fade-up delay-4 mt-6 rounded-3xl border border-rose-100 bg-rose-50/60 p-7">
            <SectionTitle icon={GitBranch} tone="rose">
              Foundational Gaps Traced
            </SectionTitle>
            <p className="mt-1.5 text-sm text-slate-600">
              When you struggled, the engine walked down the prerequisite chain
              to find the root:
            </p>
            <ul className="mt-4 space-y-2.5">
              {report.foundationalGapChains.map((chain, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl bg-white px-5 py-3.5 text-sm shadow-sm ring-1 ring-rose-100/60"
                >
                  {chain.map((node, j) => (
                    <span key={j} className="flex items-center gap-2">
                      <span
                        className={
                          j === chain.length - 1
                            ? "rounded-lg bg-rose-100 px-2 py-0.5 font-bold text-rose-700"
                            : "font-medium text-slate-600"
                        }
                      >
                        {node}
                      </span>
                      {j < chain.length - 1 && (
                        <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                      )}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Focus areas */}
        <section className="animate-fade-up delay-4 mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <SectionTitle icon={BookOpen} tone="sky">
            Recommended Focus Areas
          </SectionTitle>
          {report.focusAreas.length === 0 ? (
            <EmptyNote>Nothing urgent — keep practising at your grade level.</EmptyNote>
          ) : (
            <ol className="mt-5 grid gap-4 sm:grid-cols-3">
              {report.focusAreas.map((f, i) => (
                <li key={f.skillId}>
                  <a
                    href={`/practice?skill=${encodeURIComponent(f.skillId)}`}
                    className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-5 transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white shadow">
                      {i + 1}
                    </span>
                    <p className="mt-3 font-semibold text-slate-800">{f.skillName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Grade {f.gradeLevel ?? "?"} · mastery {Math.round(f.pMastery * 100)}%
                    </p>
                    {f.ncertReference && (
                      <p className="mt-2.5 border-t border-dashed border-slate-200 pt-2 text-xs leading-relaxed text-slate-400">
                        {f.ncertReference}
                      </p>
                    )}
                    <span className="mt-auto flex items-center gap-1 pt-3 text-xs font-semibold text-indigo-600">
                      <Target className="h-3.5 w-3.5" /> Practise this skill
                    </span>
                  </a>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Question-by-question analysis */}
        <QuestionAnalysis rows={report.questionAnalysis} />

        <footer className="print-hidden mt-8 flex flex-wrap justify-center gap-3 pb-10">
          <a
            href={`/api/session/report/${sessionId}/pdf`}
            download
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-3 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-110"
          >
            <FileDown className="h-5 w-5" />
            Download PDF report
          </a>
          <a
            href={`/report/${sessionId}/analysis`}
            className="flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-3 font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100"
          >
            <Microscope className="h-5 w-5" />
            Detailed analysis
          </a>
          <a
            href="/learn"
            className="flex items-center gap-2 rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-3 font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-100"
          >
            <TrendingUp className="h-5 w-5" />
            My learning
          </a>
          <a
            href="/"
            className="rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            Take another assessment
          </a>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
        </footer>
      </div>
    </main>
  );
}

// ── Test-taking behaviour (flukes + rushing) ─────────────────────────────────

function BehaviorSection({
  behavior,
}: {
  behavior: Report["behavior"];
}) {
  // Nothing noteworthy — steady, considered answers. Keep the report clean.
  if (
    behavior.notes.length === 0 &&
    behavior.likelyGuesses === 0 &&
    behavior.rushedAnswers === 0
  ) {
    return null;
  }
  const seconds = Math.round(behavior.rushFloorMs / 1000);
  return (
    <section className="animate-fade-up delay-1 mt-6 rounded-3xl border border-amber-100 bg-amber-50/50 p-7 shadow-sm">
      <SectionTitle icon={Gauge} tone="amber">
        Test-Taking Behaviour
      </SectionTitle>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 ring-1 ring-amber-100">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <Dice5 className="h-5 w-5" />
          </span>
          <div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {behavior.likelyGuesses}
            </p>
            <p className="text-xs font-medium text-slate-500">
              likely lucky guess{behavior.likelyGuesses === 1 ? "" : "es"}
              <span className="text-slate-400"> · right but very fast</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 ring-1 ring-amber-100">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <Zap className="h-5 w-5" />
          </span>
          <div>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">
              {behavior.rushedAnswers}
            </p>
            <p className="text-xs font-medium text-slate-500">
              rushed answer{behavior.rushedAnswers === 1 ? "" : "s"}
              <span className="text-slate-400">
                {" "}
                · under {seconds}s
                {behavior.rushedMistakes > 0
                  ? `, ${behavior.rushedMistakes} wrong`
                  : ""}
              </span>
            </p>
          </div>
        </div>
      </div>
      {behavior.notes.length > 0 && (
        <div className="mt-3 space-y-2">
          {behavior.notes.map((note, i) => (
            <p
              key={i}
              className="flex items-start gap-2.5 text-[15px] leading-relaxed text-amber-900"
            >
              <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-500" />
              {note}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Question-by-question analysis ────────────────────────────────────────────

function QuestionAnalysis({ rows }: { rows: QuestionAnalysisRow[] }) {
  const [filter, setFilter] = useState<"all" | "mistakes" | "correct">("all");
  const mistakes = rows.filter((r) => !r.isCorrect);
  const corrects = rows.filter((r) => r.isCorrect);
  const shown =
    filter === "all" ? rows : filter === "mistakes" ? mistakes : corrects;
  const slowest = rows.reduce<QuestionAnalysisRow | null>(
    (acc, r) => (r.timeMs !== null && r.timeMs > (acc?.timeMs ?? -1) ? r : acc),
    null
  );

  if (rows.length === 0) return null;

  return (
    <section className="animate-fade-up delay-4 mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle icon={ListChecks} tone="violet">
          Question-by-Question Analysis
        </SectionTitle>
        <div className="print-hidden flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          {(
            [
              ["all", `All (${rows.length})`, "text-slate-900"],
              ["mistakes", `Mistakes (${mistakes.length})`, "text-rose-600"],
              ["correct", `Correct (${corrects.length})`, "text-emerald-600"],
            ] as const
          ).map(([key, label, activeTone]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3.5 py-1.5 transition ${
                filter === key ? `bg-white shadow-sm ${activeTone}` : "text-slate-500"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary strip */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
          <p className="text-[11px] font-bold tracking-wider text-emerald-600 uppercase">
            Correct
          </p>
          <p className="text-xl font-bold text-emerald-800 tabular-nums">
            {corrects.length}
            <span className="text-sm font-semibold text-emerald-500">
              {" "}
              / {rows.length}
            </span>
          </p>
        </div>
        <div className="rounded-2xl bg-rose-50 px-4 py-3 ring-1 ring-rose-100">
          <p className="text-[11px] font-bold tracking-wider text-rose-600 uppercase">
            Mistakes
          </p>
          <p className="text-xl font-bold text-rose-800 tabular-nums">
            {mistakes.length}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <p className="text-[11px] font-bold tracking-wider text-slate-500 uppercase">
            Longest think
          </p>
          <p className="truncate text-xl font-bold text-slate-800 tabular-nums">
            {slowest?.timeMs ? formatMs(slowest.timeMs) : "—"}
            {slowest && (
              <span className="text-xs font-semibold text-slate-400">
                {" "}
                on Q{slowest.order}
              </span>
            )}
          </p>
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyNote>
          {filter === "mistakes"
            ? "No mistakes — every answer was correct. 🎉"
            : "Nothing to show here."}
        </EmptyNote>
      ) : (
        <ol className="mt-5 space-y-4">
          {shown.map((r) => (
            <li
              key={r.order}
              className={`rounded-2xl border-l-4 bg-slate-50/60 p-5 ring-1 ring-slate-100 ${
                r.isCorrect ? "border-emerald-400" : "border-rose-400"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-slate-900 px-2.5 py-1 font-bold text-white">
                  Q{r.order}
                </span>
                <span
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-bold ${
                    r.isCorrect
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {r.isCorrect ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                  {r.isCorrect ? "Correct" : "Wrong"}
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-500 ring-1 ring-slate-200">
                  {r.skillName ?? "—"} · G{r.grade ?? "?"} ·{" "}
                  <span className="capitalize">{r.difficulty ?? "?"}</span>
                </span>
                {r.twinProbe && (
                  <span className="rounded-full bg-violet-100 px-2.5 py-1 font-semibold text-violet-700">
                    ⇄ twin probe
                  </span>
                )}
                {r.primaryDimension && (
                  <span className="rounded-full bg-sky-50 px-2.5 py-1 font-semibold text-sky-700 ring-1 ring-sky-100">
                    {r.primaryDimension}
                  </span>
                )}
                {r.likelyGuess && (
                  <span
                    className="flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 font-semibold text-violet-700"
                    title="Correct, but answered too fast to have worked it out — likely a lucky guess"
                  >
                    <Dice5 className="h-3 w-3" />
                    likely guess
                  </span>
                )}
                {r.rushed && !r.likelyGuess && (
                  <span
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                      r.isCorrect
                        ? "bg-slate-100 text-slate-600"
                        : "bg-rose-100 text-rose-700"
                    }`}
                    title="Answered very fast — likely rushed"
                  >
                    <Zap className="h-3 w-3" />
                    rushed
                  </span>
                )}
                {r.timeMs !== null && (
                  <span
                    className={`ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 tabular-nums ${
                      r.pace === "slow"
                        ? "bg-amber-50 text-amber-600"
                        : r.pace === "quick"
                          ? "bg-emerald-50 text-emerald-600"
                          : "text-slate-400"
                    }`}
                    title={
                      r.pace === "slow"
                        ? "Took longer than your average"
                        : r.pace === "quick"
                          ? "Faster than your average"
                          : undefined
                    }
                  >
                    <Timer className="h-3 w-3" />
                    {formatMs(r.timeMs)}
                    {r.pace === "slow" && " · slow"}
                    {r.pace === "quick" && " · quick"}
                  </span>
                )}
              </div>

              <p className="mt-3 font-medium text-slate-900">{r.questionText}</p>

              <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {r.options.map((o) => {
                  const isCorrectOpt = o.label === r.correctOption;
                  const isChosen = o.label === r.selected;
                  return (
                    <div
                      key={o.label}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                        isCorrectOpt
                          ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-900"
                          : isChosen
                            ? "border-rose-300 bg-rose-50 font-semibold text-rose-900"
                            : "border-slate-200 bg-white text-slate-500"
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                          isCorrectOpt
                            ? "bg-emerald-500 text-white"
                            : isChosen
                              ? "bg-rose-500 text-white"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {o.label}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{o.text}</span>
                      {isCorrectOpt && (
                        <span className="shrink-0 text-[10px] font-bold tracking-wide text-emerald-600 uppercase">
                          Answer
                        </span>
                      )}
                      {isChosen && !isCorrectOpt && (
                        <span className="shrink-0 text-[10px] font-bold tracking-wide text-rose-500 uppercase">
                          Your pick
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {!r.isCorrect && (r.misconception || r.misconceptionDetail) && (
                <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
                  <p className="text-xs font-bold tracking-wide text-amber-700 uppercase">
                    Why this went wrong
                    {r.trapType ? ` · ${r.trapType.replace(/_/g, " ")}` : ""}
                  </p>
                  {r.misconception && (
                    <p className="mt-1 text-sm font-semibold text-amber-900">
                      {r.misconception}
                    </p>
                  )}
                  {r.misconceptionDetail && (
                    <p className="mt-0.5 text-sm leading-relaxed text-amber-800">
                      {r.misconceptionDetail}
                    </p>
                  )}
                  {r.practiceNext && (
                    <p className="mt-2 flex items-center gap-1.5 border-t border-amber-100 pt-2 text-sm font-semibold text-indigo-700">
                      <BookOpen className="h-3.5 w-3.5" />
                      Practice next: {r.practiceNext.skillName}
                      {r.practiceNext.grade ? ` (Grade ${r.practiceNext.grade})` : ""}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

// ── Presentational helpers ───────────────────────────────────────────────────

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return "<1s";
  const s = Math.round(ms / 1000);
  return s >= 60 ? formatDuration(s) : `${s}s`;
}

function PaceStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3.5 ring-1 ring-slate-100">
      <dt className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-xl font-bold text-slate-900 tabular-nums">{value}</dd>
    </div>
  );
}

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
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-xl ${TONE_STYLES[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      {children}
    </h2>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 text-sm text-slate-400">{children}</p>;
}

function HeroPill({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/10 px-5 py-3 ring-1 ring-white/20 backdrop-blur">
      <p className="text-[11px] font-semibold tracking-wider text-indigo-200 uppercase">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-indigo-200">{sub}</p>}
    </div>
  );
}

/** Animated SVG donut showing the overall score. */
function ScoreRing({ value }: { value: number }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(Math.max(value, 0), 100) / 100) * c;
  return (
    <div className="relative h-40 w-40 shrink-0">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="12" />
        <circle
          cx="70"
          cy="70"
          r={r}
          fill="none"
          stroke="white"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
          style={{ transition: "stroke-dasharray 1s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums">{Math.round(value)}%</span>
        <span className="text-[11px] font-semibold tracking-wider text-indigo-200 uppercase">
          Overall
        </span>
      </div>
    </div>
  );
}
