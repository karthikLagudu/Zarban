"use client";

// Student List & Search (spec 5.2.2).

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

interface Row {
  studentId: string;
  name: string | null;
  school: string | null;
  classGrade: number | null;
  sessionCount: number;
  lastAssessmentAt: string | null;
  lastScore: number | null;
  lastStatus: string | null;
}

const AVATAR_TONES = [
  "from-indigo-500 to-violet-600",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
];

export default function StudentsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      fetch(`/api/admin/students?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d) => setRows(d.students ?? []))
        .catch(() => setRows([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="animate-fade-up mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Students</h1>
          <p className="mt-1 text-sm text-slate-400">
            Click a student to see their sessions, mastery and reports.
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, school, email…"
            className="w-72 rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs tracking-wider text-slate-400 uppercase">
              <th className="px-5 py-3.5 font-semibold">Name</th>
              <th className="px-5 py-3.5 font-semibold">School</th>
              <th className="px-5 py-3.5 font-semibold">Grade</th>
              <th className="px-5 py-3.5 font-semibold">Assessments</th>
              <th className="px-5 py-3.5 font-semibold">Last assessment</th>
              <th className="px-5 py-3.5 font-semibold">Score</th>
              <th className="px-5 py-3.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows === null ? (
              <tr>
                <td colSpan={7} className="px-5 py-10">
                  <div className="skeleton h-6 w-full" />
                  <div className="skeleton mt-3 h-6 w-full" />
                  <div className="skeleton mt-3 h-6 w-2/3" />
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                  No students found.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={r.studentId}
                  className="border-b border-slate-50 transition last:border-0 hover:bg-indigo-50/40"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/students/${r.studentId}`}
                      className="flex items-center gap-3"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${AVATAR_TONES[i % AVATAR_TONES.length]} text-xs font-bold text-white shadow-sm`}
                      >
                        {(r.name ?? "?")
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((p) => p[0]?.toUpperCase() ?? "")
                          .join("")}
                      </span>
                      <span className="font-semibold text-slate-800 hover:text-indigo-700">
                        {r.name ?? "—"}
                      </span>
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{r.school ?? "—"}</td>
                  <td className="px-5 py-3 font-medium tabular-nums">
                    {r.classGrade ?? "—"}
                  </td>
                  <td className="px-5 py-3 tabular-nums">{r.sessionCount}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {r.lastAssessmentAt
                      ? new Date(r.lastAssessmentAt).toLocaleString()
                      : "—"}
                  </td>
                  <td className="px-5 py-3 font-bold tabular-nums">
                    {r.lastScore !== null ? `${r.lastScore}%` : "—"}
                  </td>
                  <td className="px-5 py-3">
                    {r.lastStatus && (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          r.lastStatus === "completed"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            : "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                        }`}
                      >
                        {r.lastStatus.replace("_", " ")}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
