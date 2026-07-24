"use client";

// Cohort Analytics (spec 5.2.3): performance trends, trap-type distribution,
// prerequisite gap tracker.

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface Analytics {
  performanceTrend: { week: string; grades: { grade: number; accuracy: number }[] }[];
  trapDistribution: { trapType: string; count: number }[];
  trapDistributionByGrade: {
    grade: number;
    traps: { trapType: string; count: number }[];
  }[];
  gapTracker: {
    skillId: string;
    skillName: string;
    gradeLevel: string | null;
    blockedStudents: number;
  }[];
}

const GRADE_COLORS = ["#4f46e5", "#7c3aed", "#0891b2", "#059669", "#d97706", "#dc2626"];

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data)
    return (
      <div className="mx-auto max-w-5xl">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton mt-6 h-64 rounded-3xl" />
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="skeleton h-72 rounded-3xl" />
          <div className="skeleton h-72 rounded-3xl" />
        </div>
      </div>
    );

  // Pivot trend data for recharts: one row per week, one column per grade.
  const gradesSeen = [
    ...new Set(data.performanceTrend.flatMap((w) => w.grades.map((g) => g.grade))),
  ].sort();
  const trendRows = data.performanceTrend.map((w) => {
    const row: Record<string, string | number> = { week: w.week };
    for (const g of w.grades) row[`G${g.grade}`] = g.accuracy;
    return row;
  });

  return (
    <div className="animate-fade-up mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-slate-900">
        Cohort Analytics
      </h1>
      <p className="mt-1 text-sm text-slate-400">
        Trends, error patterns and the foundational skills blocking progress.
      </p>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Grade-level performance trend
        </h2>
        {trendRows.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No assessment data yet.</p>
        ) : (
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendRows}>
                <CartesianGrid stroke="#f1f5f9" />
                <XAxis dataKey="week" tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#64748b" }} />
                <Tooltip />
                <Legend />
                {gradesSeen.map((g, i) => (
                  <Line
                    key={g}
                    dataKey={`G${g}`}
                    stroke={GRADE_COLORS[i % GRADE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Most common error types
          </h2>
          {data.trapDistribution.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No classified errors yet.</p>
          ) : (
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.trapDistribution.map((t) => ({
                    name: t.trapType.replace(/_/g, " "),
                    count: t.count,
                  }))}
                  layout="vertical"
                  margin={{ left: 40 }}
                >
                  <CartesianGrid stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={120}
                    tick={{ fontSize: 12, fill: "#475569" }}
                  />
                  <Tooltip />
                  <Bar dataKey="count" fill="#7c3aed" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {data.trapDistributionByGrade.length > 0 && (
            <div className="mt-4 space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
              {data.trapDistributionByGrade.map((g) => {
                const top = [...g.traps].sort((a, b) => b.count - a.count)[0];
                const total = g.traps.reduce((a, b) => a + b.count, 0);
                const pct = total ? Math.round((top.count / total) * 100) : 0;
                return (
                  <p key={g.grade}>
                    <span className="font-semibold text-slate-700">Grade {g.grade}:</span>{" "}
                    {pct}% of errors are {top.trapType.replace(/_/g, " ")}s
                  </p>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Prerequisite gap tracker
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Foundational skills that traversals landed on — these are blocking
            higher-grade students.
          </p>
          {data.gapTracker.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No prerequisite traversals recorded yet.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {data.gapTracker.map((g, i) => (
                <li
                  key={g.skillId}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {i + 1}. {g.skillName}
                    </p>
                    <p className="text-xs text-slate-400">Grade {g.gradeLevel ?? "?"}</p>
                  </div>
                  <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-bold text-rose-600 tabular-nums">
                    {g.blockedStudents} student{g.blockedStudents === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
