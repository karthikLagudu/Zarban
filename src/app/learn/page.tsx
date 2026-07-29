"use client";

// My Learning — a returning student's progress hub: score trend across
// assessments, current skill mastery, what to practise next, and links to
// every past report. Keyed by the student id saved on this device.

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  LineChart as LineChartIcon,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Progress {
  student: {
    studentId: string;
    name: string | null;
    school: string | null;
    classGrade: number | null;
    classroomName: string | null;
  };
  summary: {
    assessments: number;
    bestScore: number | null;
    latestScore: number | null;
    skillsTracked: number;
    skillsMastered: number;
  };
  trend: { label: string; score: number }[];
  sessions: {
    sessionId: string;
    order: number;
    grade: number | null;
    status: string;
    startedAt: string;
    questions: number;
    score: number | null;
  }[];
  skills: {
    skillId: string;
    skillName: string;
    topicArea: string | null;
    gradeLevel: string | null;
    pMastery: number;
    attempts: number;
    status: string;
  }[];
  recommendations: {
    skillId: string;
    skillName: string;
    gradeLevel: string | null;
    pMastery: number;
    topicArea: string | null;
  }[];
}

const STATUS_BAR: Record<string, string> = {
  Mastered: "bg-gradient-to-r from-emerald-400 to-emerald-500",
  Developing: "bg-gradient-to-r from-amber-300 to-amber-400",
  Gap: "bg-gradient-to-r from-rose-400 to-rose-500",
};

export default function LearnPage() {
  const [studentId, setStudentId] = useState<string | null | undefined>(undefined);
  const [data, setData] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let id: string | null = null;
    try {
      const profile = localStorage.getItem("zarban_profile");
      if (profile) id = JSON.parse(profile).studentId ?? null;
      if (!id) {
        const a = localStorage.getItem("zarban_assessment");
        if (a) id = JSON.parse(a).studentId ?? null;
      }
    } catch {
      /* ignore corrupted storage */
    }
    setStudentId(id);
  }, []);

  useEffect(() => {
    if (!studentId) return;
    fetch(`/api/learn/${studentId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load your progress");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [studentId]);

  // No identity on this device yet.
  if (studentId === null) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
            <Sparkles className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-xl font-bold text-slate-900">No progress yet on this device</h2>
          <p className="mt-2 text-sm text-slate-500">
            Take an assessment and your learning journey — score trend, mastery, and what to
            practise next — will show up right here.
          </p>
          <a
            href="/"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-110"
          >
            Start an assessment <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </Shell>
    );
  }
  if (error) {
    return (
      <Shell>
        <div className="mx-auto max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center">
          <p className="font-medium text-rose-600">{error}</p>
          <a href="/" className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:underline">
            ← Back home
          </a>
        </div>
      </Shell>
    );
  }
  if (studentId === undefined || !data) {
    return (
      <Shell>
        <div className="mx-auto max-w-4xl">
          <div className="skeleton h-28 rounded-3xl" />
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div className="skeleton h-72 rounded-3xl" />
            <div className="skeleton h-72 rounded-3xl" />
          </div>
        </div>
      </Shell>
    );
  }

  const { student, summary, trend, sessions, skills, recommendations } = data;

  return (
    <Shell>
      <div className="mx-auto max-w-4xl">
        {/* Hero */}
        <section className="animate-fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 p-8 text-white shadow-2xl shadow-indigo-200">
          <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200">My Learning</p>
          <h1 className="mt-2 text-3xl font-bold">Hi {student.name ?? "there"} 👋</h1>
          <p className="mt-1 text-sm text-indigo-100">
            {student.classroomName ? `${student.classroomName} · ` : ""}
            {student.classGrade ? `Class ${student.classGrade}` : "Keep going — every attempt sharpens the picture."}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <HeroStat label="Assessments" value={`${summary.assessments}`} />
            <HeroStat label="Best score" value={summary.bestScore !== null ? `${summary.bestScore}%` : "—"} />
            <HeroStat label="Latest" value={summary.latestScore !== null ? `${summary.latestScore}%` : "—"} />
            <HeroStat label="Skills mastered" value={`${summary.skillsMastered}/${summary.skillsTracked}`} />
          </div>
        </section>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Score trend */}
          <section className="animate-fade-up delay-1 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <SectionTitle icon={TrendingUp} tone="indigo">Score over time</SectionTitle>
            {trend.length >= 2 ? (
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend}>
                    <CartesianGrid stroke="#f1f5f9" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#94a3b8" }} unit="%" />
                    <Tooltip formatter={(v) => [`${v}%`, "score"]} />
                    <Line dataKey="score" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3, fill: "#4f46e5" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="mt-6 text-sm text-slate-400">
                Take one more assessment to see your progress trend.
              </p>
            )}
          </section>

          {/* Recommendations */}
          <section className="animate-fade-up delay-2 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <SectionTitle icon={Target} tone="rose">Practise next</SectionTitle>
            {recommendations.length === 0 ? (
              <p className="mt-6 text-sm text-slate-400">
                Nothing flagged yet — great work! Keep assessing to find your next target.
              </p>
            ) : (
              <ol className="mt-4 space-y-3">
                {recommendations.map((r, i) => (
                  <li key={r.skillId}>
                    <a
                      href={`/practice?skill=${encodeURIComponent(r.skillId)}`}
                      className="group flex items-center gap-3 rounded-2xl bg-slate-50 p-3.5 ring-1 ring-slate-100 transition hover:bg-indigo-50 hover:ring-indigo-200"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{r.skillName}</p>
                        <p className="text-xs text-slate-400">
                          {r.topicArea ?? "—"}
                          {r.gradeLevel ? ` · Grade ${r.gradeLevel}` : ""} · mastery {Math.round(r.pMastery * 100)}%
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 opacity-0 transition group-hover:opacity-100">
                        Practise <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* Skill mastery */}
        {skills.length > 0 && (
          <section className="animate-fade-up delay-2 mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
            <SectionTitle icon={Target} tone="emerald">Skill mastery</SectionTitle>
            <ul className="mt-4 divide-y divide-slate-100">
              {skills.slice(0, 12).map((s) => (
                <li key={s.skillId} className="flex items-center gap-4 py-2.5">
                  <div className="w-52 shrink-0">
                    <p className="truncate text-sm font-medium text-slate-800">{s.skillName}</p>
                    <p className="text-xs text-slate-400">{s.topicArea ?? "—"}</p>
                  </div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${STATUS_BAR[s.status]}`}
                      style={{ width: `${Math.round(s.pMastery * 100)}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-sm font-bold text-slate-700 tabular-nums">
                    {Math.round(s.pMastery * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* History */}
        <section className="animate-fade-up delay-3 mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <SectionTitle icon={LineChartIcon} tone="violet">Assessment history</SectionTitle>
          {sessions.length === 0 ? (
            <p className="mt-6 text-sm text-slate-400">No assessments yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {sessions.map((s) => (
                <li key={s.sessionId} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">
                      {new Date(s.startedAt).toLocaleDateString()} · Class {s.grade ?? "?"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {s.questions} questions ·{" "}
                      {s.status === "completed" ? "completed" : "in progress"}
                    </p>
                  </div>
                  {s.score !== null && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        s.score >= 70
                          ? "bg-emerald-50 text-emerald-700"
                          : s.score >= 40
                            ? "bg-amber-50 text-amber-700"
                            : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      {s.score}%
                    </span>
                  )}
                  <a
                    href={`/report/${s.sessionId}`}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-slate-50"
                  >
                    View report <ArrowRight className="h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-8 mb-10 flex justify-center">
          <a
            href="/"
            className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-7 py-3 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-110"
          >
            Take another assessment <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen">
      <div className="bg-dot-grid absolute inset-0 opacity-30" />
      <header className="relative z-10 mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <a href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold text-slate-900">Zarban</span>
        </a>
        <a href="/" className="text-sm font-semibold text-slate-500 transition hover:text-indigo-700">
          ← Home
        </a>
      </header>
      <div className="relative px-6 pb-6">{children}</div>
    </main>
  );
}

const TONE: Record<string, string> = {
  indigo: "bg-indigo-100 text-indigo-600",
  violet: "bg-violet-100 text-violet-600",
  emerald: "bg-emerald-100 text-emerald-600",
  rose: "bg-rose-100 text-rose-600",
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
    <h2 className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-wider text-slate-600">
      <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${TONE[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      {children}
    </h2>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-5 py-3 ring-1 ring-white/20 backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-200">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
