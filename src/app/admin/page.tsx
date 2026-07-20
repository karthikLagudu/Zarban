"use client";

// Dashboard Home (spec 5.2.1): totals, weekly count, average score by grade,
// class-level skill failure heatmap.

import { useEffect, useState } from "react";
import { CalendarClock, Flame, GraduationCap, Users } from "lucide-react";

interface Stats {
  totalStudents: number;
  totalSessions: number;
  sessionsThisWeek: number;
  averageScoreByGrade: { grade: number; sessions: number; averageScore: number }[];
  heatmap: {
    skillId: string;
    skillName: string;
    topicArea: string | null;
    gradeLevel: string | null;
    attempts: number;
    failureRate: number | null;
  }[];
}

export default function AdminHome() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div>
        <div className="skeleton h-8 w-48" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-28 rounded-2xl" />
          <div className="skeleton h-28 rounded-2xl" />
        </div>
        <div className="skeleton mt-8 h-64 rounded-3xl" />
      </div>
    );
  }

  const attempted = stats.heatmap.filter((h) => h.attempts > 0);

  return (
    <div className="animate-fade-up mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-slate-900">Dashboard</h1>
      <p className="mt-1 text-sm text-slate-400">
        A live picture of assessments across the school.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Users}
          tone="from-indigo-500 to-violet-600"
          label="Students assessed"
          value={stats.totalStudents}
        />
        <StatCard
          icon={GraduationCap}
          tone="from-sky-500 to-indigo-500"
          label="Total assessments"
          value={stats.totalSessions}
        />
        <StatCard
          icon={CalendarClock}
          tone="from-emerald-500 to-teal-500"
          label="Assessments this week"
          value={stats.sessionsThisWeek}
        />
      </div>

      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-sm font-bold tracking-wider text-slate-500 uppercase">
          Average score by grade
        </h2>
        {stats.averageScoreByGrade.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No assessments yet.</p>
        ) : (
          <div className="mt-5 grid gap-4">
            {stats.averageScoreByGrade.map((g) => (
              <div key={g.grade} className="flex items-center gap-4">
                <span className="w-20 text-sm font-semibold text-slate-600">
                  Grade {g.grade}
                </span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500 transition-all duration-700"
                    style={{ width: `${g.averageScore}%` }}
                  />
                </div>
                <span className="w-14 text-right text-sm font-bold tabular-nums">
                  {g.averageScore}%
                </span>
                <span className="w-20 text-right text-xs text-slate-400">
                  {g.sessions} session{g.sessions === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-wider text-slate-500 uppercase">
          <Flame className="h-4 w-4 text-rose-500" />
          Skill failure heatmap
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Failure rate across all students — the hottest cells are blocking the
          most learners.
        </p>
        {attempted.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">
            No response data yet — run an assessment first.
          </p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4">
            {attempted.map((h) => {
              const rate = h.failureRate ?? 0;
              const style =
                rate >= 60
                  ? "bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-md shadow-rose-200"
                  : rate >= 40
                    ? "bg-gradient-to-br from-rose-400 to-rose-500 text-white shadow-sm"
                    : rate >= 20
                      ? "bg-gradient-to-br from-amber-200 to-amber-300 text-amber-950"
                      : "bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-950";
              return (
                <div
                  key={h.skillId}
                  title={`${h.skillName} — ${rate}% failure over ${h.attempts} attempts`}
                  className={`rounded-2xl p-4 transition hover:-translate-y-0.5 ${style}`}
                >
                  <p className="truncate text-xs font-bold">{h.skillName}</p>
                  <p className="text-[11px] opacity-75">
                    G{h.gradeLevel} · {h.attempts} attempts
                  </p>
                  <p className="mt-1.5 text-xl font-bold tabular-nums">{rate}%</p>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-md`}
      >
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
          {label}
        </p>
        <p className="mt-0.5 text-3xl leading-none font-bold text-slate-900 tabular-nums">
          {value}
        </p>
      </div>
    </div>
  );
}
