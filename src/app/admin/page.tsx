"use client";

// Dashboard Home — a command center: totals, overall + per-grade scores, the
// hottest skill gaps, a role-aware quick-actions launchpad, and the class-level
// skill failure heatmap.

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarClock,
  ChartLine,
  Flame,
  GraduationCap,
  Layers,
  Library,
  School,
  ShieldAlert,
  TrendingUp,
  UserCog,
  Users,
} from "lucide-react";
import { useAdmin } from "./admin-context";

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

type Access = "any" | "admin" | "content";
const QUICK: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; access: Access; tone: string }[] = [
  { href: "/admin/students", label: "Students", icon: Users, access: "any", tone: "text-indigo-600 bg-indigo-50" },
  { href: "/admin/classrooms", label: "Classrooms", icon: School, access: "any", tone: "text-violet-600 bg-violet-50" },
  { href: "/admin/analytics", label: "Analytics", icon: ChartLine, access: "any", tone: "text-sky-600 bg-sky-50" },
  { href: "/admin/questions", label: "Question Bank", icon: Library, access: "any", tone: "text-emerald-600 bg-emerald-50" },
  { href: "/admin/syllabus", label: "Syllabus", icon: Layers, access: "any", tone: "text-amber-600 bg-amber-50" },
  { href: "/admin/users", label: "User Access", icon: UserCog, access: "admin", tone: "text-indigo-600 bg-indigo-50" },
  { href: "/admin/system", label: "System & Audit", icon: ShieldAlert, access: "admin", tone: "text-rose-600 bg-rose-50" },
  { href: "/content", label: "Content Studio", icon: Boxes, access: "content", tone: "text-teal-600 bg-teal-50" },
];

export default function AdminHome() {
  const admin = useAdmin();
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
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton mt-6 h-20 rounded-2xl" />
        <div className="skeleton mt-8 h-64 rounded-3xl" />
      </div>
    );
  }

  const attempted = stats.heatmap.filter((h) => h.attempts > 0);
  const totalGradeSessions = stats.averageScoreByGrade.reduce((a, g) => a + g.sessions, 0);
  const overallAvg = totalGradeSessions
    ? Math.round(
        stats.averageScoreByGrade.reduce((a, g) => a + g.averageScore * g.sessions, 0) / totalGradeSessions
      )
    : null;
  const topGaps = attempted
    .slice()
    .sort((a, b) => (b.failureRate ?? 0) - (a.failureRate ?? 0))
    .filter((g) => (g.failureRate ?? 0) >= 50)
    .slice(0, 4);

  const canSee = (a: Access) =>
    a === "any" ||
    (a === "admin" && admin?.role === "Admin") ||
    (a === "content" && (admin?.role === "Admin" || admin?.role === "Editor"));
  const firstName = (admin?.name ?? admin?.email ?? "there").split(/[\s@.]/)[0];

  return (
    <div className="animate-fade-up mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-slate-900">
        Welcome back, <span className="text-gradient">{firstName}</span>
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        A live picture of assessments across the school.
      </p>

      {/* Stats */}
      <div className="stagger mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} tone="from-indigo-500 to-violet-600" label="Students assessed" value={stats.totalStudents} />
        <StatCard icon={GraduationCap} tone="from-sky-500 to-indigo-500" label="Total assessments" value={stats.totalSessions} />
        <StatCard icon={CalendarClock} tone="from-emerald-500 to-teal-500" label="This week" value={stats.sessionsThisWeek} />
        <StatCard icon={TrendingUp} tone="from-amber-500 to-orange-500" label="Average score" value={overallAvg !== null ? `${overallAvg}%` : "—"} />
      </div>

      {/* Top gaps alert */}
      {topGaps.length > 0 && (
        <div className="animate-fade-up mt-6 rounded-2xl bg-rose-50 px-5 py-4 ring-1 ring-rose-100">
          <p className="flex items-center gap-2 text-sm font-bold text-rose-800">
            <AlertTriangle className="h-4 w-4" /> Top skill gaps right now
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {topGaps.map((g) => (
              <span key={g.skillId} className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-rose-700 ring-1 ring-rose-100">
                {g.skillName} · {g.failureRate}% failing
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <section className="mt-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick actions</h2>
        <div className="stagger mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {QUICK.filter((q) => canSee(q.access)).map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="hover-lift group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${q.tone}`}>
                <q.icon className="h-4.5 w-4.5" />
              </span>
              <span className="flex-1 text-sm font-semibold text-slate-800">{q.label}</span>
              <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
            </Link>
          ))}
        </div>
      </section>

      {/* Average score by grade */}
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
                <span className="w-20 text-sm font-semibold text-slate-600">Grade {g.grade}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500 transition-all duration-700"
                    style={{ width: `${g.averageScore}%` }}
                  />
                </div>
                <span className="w-14 text-right text-sm font-bold tabular-nums">{g.averageScore}%</span>
                <span className="w-20 text-right text-xs text-slate-400">
                  {g.sessions} session{g.sessions === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Skill failure heatmap */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-wider text-slate-500 uppercase">
          <Flame className="h-4 w-4 text-rose-500" />
          Skill failure heatmap
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Failure rate across all students — the hottest cells are blocking the most learners.
        </p>
        {attempted.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No response data yet — run an assessment first.</p>
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
                  <p className="text-[11px] opacity-75">G{h.gradeLevel} · {h.attempts} attempts</p>
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
  value: number | string;
}) {
  return (
    <div className="hover-lift flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-md`}>
        <Icon className="h-6 w-6" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold tracking-wider text-slate-400 uppercase">{label}</p>
        <p className="mt-0.5 text-3xl leading-none font-bold text-slate-900 tabular-nums">{value}</p>
      </div>
    </div>
  );
}
