"use client";

// Classroom roster manager: view a classroom's students with light stats, and
// (Admin) add existing or brand-new students, remove them, or delete the room.

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAdmin } from "../../admin-context";

interface RosterStudent {
  studentId: string;
  name: string | null;
  email: string | null;
  classGrade: number | null;
  sessionCount: number;
  lastAssessmentAt: string | null;
  lastScore: number | null;
  lastSessionId: string | null;
}
interface Detail {
  classroom: {
    classroomId: string;
    name: string;
    grade: number | null;
    section: string | null;
    createdAt: string;
  };
  students: RosterStudent[];
  stats: { studentCount: number; assessedCount: number; avgLastScore: number | null };
}

export default function ClassroomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const me = useAdmin();
  const canEdit = me?.role === "Admin";
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  async function load() {
    const r = await fetch(`/api/admin/classrooms/${id}`);
    const d = await r.json();
    if (!r.ok) return setError(d.error ?? "Failed to load classroom");
    setData(d);
  }
  useEffect(() => {
    load();
  }, [id]);

  async function removeStudent(s: RosterStudent) {
    if (!confirm(`Remove ${s.name ?? "this student"} from the classroom? Their history is kept.`)) return;
    const r = await fetch(`/api/admin/classrooms/${id}/students/${s.studentId}`, {
      method: "DELETE",
    });
    if (r.ok) load();
  }

  async function deleteClassroom() {
    if (!data) return;
    if (!confirm(`Delete "${data.classroom.name}"? Students are kept but unassigned.`)) return;
    const r = await fetch(`/api/admin/classrooms/${id}`, { method: "DELETE" });
    if (r.ok) window.location.href = "/admin/classrooms";
  }

  if (error) return <p className="text-rose-600">{error}</p>;
  if (!data)
    return (
      <div className="mx-auto max-w-4xl">
        <div className="skeleton h-6 w-32" />
        <div className="skeleton mt-3 h-24 rounded-3xl" />
        <div className="skeleton mt-6 h-72 rounded-3xl" />
      </div>
    );

  const { classroom, students, stats } = data;

  return (
    <div className="animate-fade-up mx-auto max-w-4xl">
      <Link
        href="/admin/classrooms"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> All classrooms
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{classroom.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {classroom.grade
              ? `Grade ${classroom.grade}${classroom.section ? ` · Section ${classroom.section}` : ""}`
              : "No grade set"}{" "}
            · created {new Date(classroom.createdAt).toLocaleDateString()}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700"
            >
              <UserPlus className="h-4 w-4" /> Add students
            </button>
            <button
              onClick={deleteClassroom}
              className="flex items-center gap-2 rounded-xl border border-rose-200 px-3.5 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Students" value={stats.studentCount} />
        <Stat label="Assessed" value={stats.assessedCount} />
        <Stat
          label="Avg last score"
          value={stats.avgLastScore !== null ? `${stats.avgLastScore}%` : "—"}
        />
      </div>

      {/* Roster */}
      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {students.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto h-9 w-9 text-slate-300" />
            <p className="mt-3 font-semibold text-slate-700">No students yet</p>
            <p className="mt-1 text-sm text-slate-400">
              {canEdit ? "Use “Add students” to build the roster." : "This classroom has no students."}
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-6 py-3">Student</th>
                <th className="px-4 py-3">Sessions</th>
                <th className="px-4 py-3">Last score</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.studentId} className="border-b border-slate-50 last:border-0">
                  <td className="px-6 py-3.5">
                    <Link
                      href={`/admin/students/${s.studentId}`}
                      className="font-semibold text-slate-800 hover:text-indigo-600 hover:underline"
                    >
                      {s.name ?? "Unnamed"}
                    </Link>
                    <p className="text-xs text-slate-400">
                      {s.email ?? "no email"}
                      {s.classGrade ? ` · Grade ${s.classGrade}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-slate-600">{s.sessionCount}</td>
                  <td className="px-4 py-3.5">
                    {s.lastScore !== null ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          s.lastScore >= 70
                            ? "bg-emerald-50 text-emerald-700"
                            : s.lastScore >= 40
                              ? "bg-amber-50 text-amber-700"
                              : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {s.lastScore}%
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">not assessed</span>
                    )}
                  </td>
                  <td className="px-6 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      {s.lastSessionId && (
                        <a
                          href={`/report/${s.lastSessionId}`}
                          target="_blank"
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-slate-50"
                        >
                          Report
                        </a>
                      )}
                      {canEdit && (
                        <button
                          onClick={() => removeStudent(s)}
                          title="Remove from classroom"
                          className="rounded-lg border border-slate-200 p-1.5 text-slate-400 transition hover:border-rose-200 hover:text-rose-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showAdd && (
        <AddStudentsModal
          classroomId={id}
          currentIds={new Set(students.map((s) => s.studentId))}
          onClose={() => setShowAdd(false)}
          onDone={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

// ── Add students (existing or new) ───────────────────────────────────────────
interface PickStudent {
  studentId: string;
  name: string | null;
  email: string | null;
  classGrade: number | null;
  classroomName: string | null;
}

function AddStudentsModal({
  classroomId,
  currentIds,
  onClose,
  onDone,
}: {
  classroomId: string;
  currentIds: Set<string>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [tab, setTab] = useState<"existing" | "new">("existing");
  const [all, setAll] = useState<PickStudent[] | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // New-student form.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [grade, setGrade] = useState("");

  useEffect(() => {
    fetch("/api/admin/students")
      .then((r) => r.json())
      .then((d) => setAll(d.students ?? []))
      .catch(() => setAll([]));
  }, []);

  const available = useMemo(
    () => (all ?? []).filter((s) => !currentIds.has(s.studentId)),
    [all, currentIds]
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available;
    return available.filter(
      (s) =>
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.email ?? "").toLowerCase().includes(q)
    );
  }, [available, query]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function assignExisting() {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/classrooms/${classroomId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentIds: [...picked] }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error ?? "Could not add students");
    onDone();
  }

  async function createNew() {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/classrooms/${classroomId}/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, grade }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error ?? "Could not add student");
    onDone();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-fade-up flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl bg-white p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2.5 text-lg font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <UserPlus className="h-4.5 w-4.5" />
            </span>
            Add students
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
          {(["existing", "new"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg px-3 py-1.5 transition ${
                tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {t === "existing" ? "Assign existing" : "Add new student"}
            </button>
          ))}
        </div>

        {tab === "existing" ? (
          <>
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search students by name or email…"
                className="w-full rounded-lg border border-slate-300 py-2.5 pl-9 pr-3 text-sm"
              />
            </div>
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-100">
              {all === null ? (
                <div className="flex items-center gap-2 p-4 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : filtered.length === 0 ? (
                <p className="p-4 text-sm text-slate-400">
                  {available.length === 0
                    ? "Every student is already in a classroom or none exist yet — use “Add new student”."
                    : "No students match your search."}
                </p>
              ) : (
                <ul className="divide-y divide-slate-50">
                  {filtered.map((s) => (
                    <li key={s.studentId}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={picked.has(s.studentId)}
                          onChange={() => toggle(s.studentId)}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {s.name ?? "Unnamed"}
                          </p>
                          <p className="truncate text-xs text-slate-400">
                            {s.email ?? "no email"}
                            {s.classGrade ? ` · Grade ${s.classGrade}` : ""}
                          </p>
                        </div>
                        {s.classroomName && (
                          <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            in {s.classroomName}
                          </span>
                        )}
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-400">{picked.size} selected</span>
              <button
                onClick={assignExisting}
                disabled={busy || picked.size === 0}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Add {picked.size || ""} to classroom
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-600">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  autoFocus
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-600">Email (optional)</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@school.org"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-slate-600">Grade (optional)</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="Defaults to the classroom's grade"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm tabular-nums"
                />
              </label>
            </div>
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
            <div className="mt-4 flex justify-end">
              <button
                onClick={createNew}
                disabled={busy || !name.trim()}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create & add
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
