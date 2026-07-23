"use client";

// Content overview: totals, coverage gaps, and a prioritised health checklist.

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  LibraryBig,
  Network,
  Puzzle,
  TriangleAlert,
} from "lucide-react";

interface Health {
  totals: {
    skills: number;
    questions: number;
    wordProblems: number;
    answerTraps: number;
    rootSkills: number;
    orphanSkills: number;
  };
  issues: { severity: "error" | "warning"; kind: string; message: string; ref: string }[];
  issueCounts: { errors: number; warnings: number };
  coverage: {
    skillId: string;
    skillName: string;
    gradeLevel: string | null;
    easy: number;
    medium: number;
    hard: number;
    total: number;
  }[];
  byGrade: { grade: number; questions: number }[];
  byTopic: { topic: string; questions: number }[];
}

export default function ContentOverview() {
  const [h, setH] = useState<Health | null>(null);

  useEffect(() => {
    fetch("/api/content/overview")
      .then((r) => r.json())
      .then(setH)
      .catch(() => {});
  }, []);

  if (!h) {
    return (
      <div>
        <div className="skeleton h-8 w-48" />
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton mt-6 h-64 rounded-3xl" />
      </div>
    );
  }

  const gaps = h.coverage.filter((c) => c.total === 0 || c.easy === 0 || c.medium === 0 || c.hard === 0);

  return (
    <div className="animate-fade-up mx-auto max-w-5xl">
      <h1 className="font-display text-2xl font-bold text-slate-900">Content Overview</h1>
      <p className="mt-1 text-sm text-slate-400">
        The health of your question bank and knowledge graph, at a glance.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Network} tone="from-emerald-500 to-teal-600" label="Skills" value={h.totals.skills} sub={`${h.totals.rootSkills} root`} />
        <Stat icon={LibraryBig} tone="from-indigo-500 to-violet-600" label="Questions" value={h.totals.questions} sub={`${h.totals.wordProblems} word problems`} />
        <Stat icon={Puzzle} tone="from-sky-500 to-indigo-500" label="Answer traps" value={h.totals.answerTraps} sub="misconceptions" />
        <Stat
          icon={h.issueCounts.errors ? TriangleAlert : CheckCircle2}
          tone={h.issueCounts.errors ? "from-rose-500 to-rose-600" : "from-emerald-500 to-teal-600"}
          label="Issues"
          value={h.issueCounts.errors + h.issueCounts.warnings}
          sub={`${h.issueCounts.errors} errors · ${h.issueCounts.warnings} warnings`}
        />
      </div>

      {/* Health checklist */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold tracking-wider text-slate-500 uppercase">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Health checklist
        </h2>
        {h.issues.length === 0 ? (
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-emerald-600">
            <CheckCircle2 className="h-4 w-4" /> Everything checks out — no content issues found.
          </p>
        ) : (
          <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto pr-1">
            {h.issues.slice(0, 200).map((i, idx) => (
              <li
                key={idx}
                className={`flex items-start gap-3 rounded-xl px-4 py-2.5 text-sm ring-1 ${
                  i.severity === "error"
                    ? "bg-rose-50 text-rose-800 ring-rose-100"
                    : "bg-amber-50 text-amber-800 ring-amber-100"
                }`}
              >
                <span
                  className={`mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    i.severity === "error" ? "bg-rose-200 text-rose-800" : "bg-amber-200 text-amber-800"
                  }`}
                >
                  {i.severity}
                </span>
                <span className="flex-1">{i.message}</span>
                {i.ref.startsWith("S_") ? (
                  <Link href="/content/skills" className="shrink-0 font-mono text-xs underline opacity-70">
                    {i.ref}
                  </Link>
                ) : (
                  <Link
                    href={`/content/questions?focus=${encodeURIComponent(i.ref)}`}
                    className="shrink-0 font-mono text-xs underline opacity-70"
                  >
                    {i.ref}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Coverage gaps */}
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-sm font-bold tracking-wider text-slate-500 uppercase">
            Coverage gaps
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Skills missing questions in one or more difficulty bands.
          </p>
          {gaps.length === 0 ? (
            <p className="mt-4 text-sm text-emerald-600">Every skill has all three bands. 🎉</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-slate-400">
                    <th className="pb-2">Skill</th>
                    <th className="pb-2 text-center">Easy</th>
                    <th className="pb-2 text-center">Med</th>
                    <th className="pb-2 text-center">Hard</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.slice(0, 12).map((c) => (
                    <tr key={c.skillId} className="border-t border-slate-50">
                      <td className="py-2 pr-2">
                        <span className="font-medium text-slate-700">{c.skillName}</span>
                        <span className="ml-1 text-xs text-slate-400">G{c.gradeLevel}</span>
                      </td>
                      {[c.easy, c.medium, c.hard].map((n, i) => (
                        <td key={i} className="py-2 text-center">
                          <span
                            className={`inline-block w-7 rounded-md py-0.5 text-xs font-bold ${
                              n === 0 ? "bg-rose-100 text-rose-700" : "bg-emerald-50 text-emerald-700"
                            }`}
                          >
                            {n}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Distributions */}
        <section className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-sm font-bold tracking-wider text-slate-500 uppercase">
            Question distribution
          </h2>
          <p className="mt-4 text-xs font-semibold text-slate-400">BY GRADE</p>
          <div className="mt-2 space-y-1.5">
            {h.byGrade.map((g) => {
              const max = Math.max(...h.byGrade.map((x) => x.questions), 1);
              return (
                <div key={g.grade} className="flex items-center gap-3 text-sm">
                  <span className="w-16 text-slate-500">Grade {g.grade}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500"
                      style={{ width: `${(g.questions / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-semibold tabular-nums">{g.questions}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs font-semibold text-slate-400">BY TOPIC</p>
          <div className="mt-2 space-y-1.5">
            {h.byTopic.map((t) => {
              const max = Math.max(...h.byTopic.map((x) => x.questions), 1);
              return (
                <div key={t.topic} className="flex items-center gap-3 text-sm">
                  <span className="w-24 truncate text-slate-500">{t.topic}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-violet-500"
                      style={{ width: `${(t.questions / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right font-semibold tabular-nums">{t.questions}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  tone,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${tone} text-white shadow-md`}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">{label}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
    </div>
  );
}
