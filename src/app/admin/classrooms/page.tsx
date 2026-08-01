"use client";

// Classrooms / teacher monitoring. Teachers see "My Classes" (the ones they
// own) with a count of students needing attention; admins see every classroom
// with its teacher, and can create new ones.

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, ArrowRight, Loader2, Plus, School, UserRound, Users, X } from "lucide-react";
import { useAdmin } from "../admin-context";
import { useEscapeKey } from "@/lib/use-escape";

interface Classroom {
  classroomId: string;
  name: string;
  grade: number | null;
  section: string | null;
  teacher: { id: number; name: string } | null;
  studentCount: number;
  attentionCount: number;
  avgLastScore: number | null;
  createdAt: string;
}

export default function ClassroomsPage() {
  const me = useAdmin();
  const isAdmin = me?.role === "Admin";
  const isTeacher = me?.role === "Teacher";
  const [rooms, setRooms] = useState<Classroom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  // Teachers land on their own classes; admins see everything but can scope to
  // the classes they personally own.
  const [scope, setScope] = useState<"all" | "mine">(isTeacher ? "mine" : "all");

  async function load() {
    const r = await fetch(`/api/admin/classrooms${scope === "mine" ? "?mine=1" : ""}`);
    const d = await r.json();
    if (!r.ok) return setError(d.error ?? "Failed to load classrooms");
    setRooms(d.classrooms);
  }
  useEffect(() => {
    load();
  }, [scope]);

  const heading = isTeacher ? "My Classes" : "Classrooms";
  const totalAttention = rooms?.reduce((a, r) => a + r.attentionCount, 0) ?? 0;

  return (
    <div className="animate-fade-up mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{heading}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {isTeacher
              ? "Classes you own — keep an eye on who needs help."
              : "Group students into rosters; assign a teacher to monitor each class."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="flex rounded-xl bg-slate-100 p-1 text-sm font-semibold">
              {(["all", "mine"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    scope === s ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                  }`}
                >
                  {s === "all" ? "All classes" : "Mine"}
                </button>
              ))}
            </div>
          )}
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> New classroom
            </button>
          )}
        </div>
      </div>

      {rooms && rooms.length > 0 && totalAttention > 0 && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 ring-1 ring-amber-100">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          {totalAttention} student{totalAttention === 1 ? "" : "s"} across these classes need attention.
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}

      {!rooms ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-40 rounded-3xl" />
          ))}
        </div>
      ) : rooms.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <School className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-700">
            {scope === "mine" ? "No classes assigned to you yet" : "No classrooms yet"}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {isAdmin
              ? "Create a classroom and assign a teacher to monitor it."
              : "Ask an admin to assign you a class."}
          </p>
        </div>
      ) : (
        <div className="stagger mt-6 grid gap-4 sm:grid-cols-2">
          {rooms.map((r) => (
            <Link
              key={r.classroomId}
              href={`/admin/classrooms/${r.classroomId}`}
              className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow">
                  <School className="h-5 w-5" />
                </span>
                {r.attentionCount > 0 ? (
                  <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                    <AlertTriangle className="h-3 w-3" /> {r.attentionCount} to review
                  </span>
                ) : r.studentCount > 0 ? (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                    all on track
                  </span>
                ) : (
                  <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
                )}
              </div>
              <p className="mt-4 text-lg font-bold text-slate-900">{r.name}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-400">
                {r.grade ? `Grade ${r.grade}${r.section ? ` · Section ${r.section}` : ""}` : "No grade set"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="flex items-center gap-1.5 font-semibold text-slate-600">
                  <Users className="h-4 w-4 text-slate-400" />
                  {r.studentCount} student{r.studentCount === 1 ? "" : "s"}
                </span>
                {r.avgLastScore !== null && (
                  <span className="text-slate-500">avg {r.avgLastScore}%</span>
                )}
              </div>
              {!isTeacher && (
                <p className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                  <UserRound className="h-3.5 w-3.5 text-slate-400" />
                  {r.teacher ? r.teacher.name : <span className="italic text-slate-400">No teacher assigned</span>}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [teachers, setTeachers] = useState<{ id: number; name: string | null; email: string; role: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEscapeKey(onClose);

  useEffect(() => {
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((d) =>
        setTeachers((d.users ?? []).filter((u: any) => u.role === "Teacher" || u.role === "Admin"))
      )
      .catch(() => {});
  }, []);

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/classrooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, grade, section, teacherId: teacherId || null }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error ?? "Could not create classroom");
    onCreated();
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="animate-pop w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2.5 text-lg font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <School className="h-4.5 w-4.5" />
            </span>
            New classroom
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 7A Morning"
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">Grade (optional)</span>
              <input
                type="number"
                min={1}
                max={12}
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="7"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm tabular-nums"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-semibold text-slate-600">Section (optional)</span>
              <input
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="A"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
              />
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Teacher (optional)</span>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
            >
              <option value="">Unassigned</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name ?? t.email} ({t.role})
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="mt-3 rounded-lg bg-rose-50 px-3.5 py-2 text-sm text-rose-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !name.trim()}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create
          </button>
        </div>
      </div>
    </div>
  );
}
