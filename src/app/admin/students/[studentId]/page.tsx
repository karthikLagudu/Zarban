"use client";

// Student detail: sessions with links to report + replay, and the BKT
// mastery snapshot across every skill they have touched.

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { School } from "lucide-react";
import { useAdmin } from "../../admin-context";

interface Detail {
  student: {
    studentId: string;
    name: string | null;
    email: string | null;
    school: string | null;
    classGrade: number | null;
    classroomId: string | null;
    classroomName: string | null;
    createdAt: string;
  };
  sessions: {
    sessionId: string;
    selectedGrade: number | null;
    status: string;
    startedAt: string;
    endedAt: string | null;
    questions: number;
    accuracy: number;
  }[];
  bkt: {
    skillId: string;
    skillName: string;
    gradeLevel: string | null;
    pMastery: number;
    attempts: number;
  }[];
}

export default function StudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = use(params);
  const me = useAdmin();
  const canEdit = me?.role === "Admin";
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classrooms, setClassrooms] = useState<{ classroomId: string; name: string }[]>([]);
  const [savingRoom, setSavingRoom] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/students/${studentId}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed to load");
        setDetail(d);
      })
      .catch((e) => setError(e.message));
  }, [studentId]);

  useEffect(() => {
    fetch("/api/admin/classrooms")
      .then((r) => r.json())
      .then((d) => setClassrooms(d.classrooms ?? []))
      .catch(() => {});
  }, []);

  async function assignClassroom(classroomId: string) {
    setSavingRoom(true);
    const r = await fetch(`/api/admin/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classroomId: classroomId || null }),
    });
    const d = await r.json();
    setSavingRoom(false);
    if (r.ok) {
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              student: {
                ...prev.student,
                classroomId: d.classroomId,
                classroomName: d.classroomName,
              },
            }
          : prev
      );
    }
  }

  if (error) return <p className="text-rose-600">{error}</p>;
  if (!detail)
    return (
      <div className="mx-auto max-w-5xl">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton mt-3 h-8 w-64" />
        <div className="skeleton mt-6 h-56 rounded-3xl" />
        <div className="skeleton mt-6 h-56 rounded-3xl" />
      </div>
    );

  const { student } = detail;

  return (
    <div className="animate-fade-up mx-auto max-w-5xl">
      <Link href="/admin/students" className="text-sm text-indigo-600 hover:underline">
        ← All students
      </Link>
      <h1 className="font-display mt-2 text-2xl font-bold text-slate-900">
        {student.name ?? "Unnamed student"}
      </h1>
      <p className="text-sm text-slate-500">
        {student.school ?? "No school"} · Grade {student.classGrade ?? "?"} ·{" "}
        {student.email ?? "no email"} · joined{" "}
        {new Date(student.createdAt).toLocaleDateString()}
      </p>

      {/* Classroom assignment */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 shadow-sm">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <School className="h-4 w-4 text-indigo-500" /> Classroom
        </span>
        {canEdit ? (
          <>
            <select
              value={student.classroomId ?? ""}
              onChange={(e) => assignClassroom(e.target.value)}
              disabled={savingRoom}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              <option value="">Unassigned</option>
              {classrooms.map((c) => (
                <option key={c.classroomId} value={c.classroomId}>
                  {c.name}
                </option>
              ))}
            </select>
            {savingRoom && <span className="text-xs text-slate-400">saving…</span>}
            {classrooms.length === 0 && (
              <Link href="/admin/classrooms" className="text-xs text-indigo-600 hover:underline">
                Create a classroom first
              </Link>
            )}
          </>
        ) : student.classroomId ? (
          <Link
            href={`/admin/classrooms/${student.classroomId}`}
            className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100"
          >
            {student.classroomName}
          </Link>
        ) : (
          <span className="text-sm text-slate-400">Unassigned</span>
        )}
      </div>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Assessment sessions
        </h2>
        {detail.sessions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No sessions yet.</p>
        ) : (
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                <th className="py-2 pr-4">Started</th>
                <th className="py-2 pr-4">Grade</th>
                <th className="py-2 pr-4">Questions</th>
                <th className="py-2 pr-4">Accuracy</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {detail.sessions.map((s) => (
                <tr key={s.sessionId} className="border-b border-slate-50">
                  <td className="py-2.5 pr-4 text-slate-600">
                    {new Date(s.startedAt).toLocaleString()}
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums">{s.selectedGrade}</td>
                  <td className="py-2.5 pr-4 tabular-nums">{s.questions}</td>
                  <td className="py-2.5 pr-4 font-semibold tabular-nums">
                    {s.accuracy}%
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        s.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {s.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-2.5">
                    <a
                      href={`/report/${s.sessionId}`}
                      target="_blank"
                      className="mr-3 text-indigo-600 hover:underline"
                    >
                      Report
                    </a>
                    <Link
                      href={`/admin/sessions/${s.sessionId}`}
                      className="text-violet-600 hover:underline"
                    >
                      Replay
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Skill mastery (BKT state)
        </h2>
        {detail.bkt.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">No skill data yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {detail.bkt.map((b) => (
              <li key={b.skillId} className="flex items-center gap-4 py-2.5">
                <div className="w-56 shrink-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {b.skillName}
                  </p>
                  <p className="text-xs text-slate-400">
                    Grade {b.gradeLevel ?? "?"} · {b.attempts} attempts
                  </p>
                </div>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-2.5 rounded-full ${
                      b.pMastery >= 0.95
                        ? "bg-emerald-500"
                        : b.pMastery >= 0.5
                          ? "bg-amber-400"
                          : "bg-rose-500"
                    }`}
                    style={{ width: `${Math.round(b.pMastery * 100)}%` }}
                  />
                </div>
                <span className="w-12 text-right text-sm font-semibold tabular-nums">
                  {Math.round(b.pMastery * 100)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
