"use client";

// Classrooms: admin-managed rosters. List every classroom with its size, and
// (Admin only) create new ones. Click through to manage a roster.

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Plus, School, Users, X } from "lucide-react";
import { useAdmin } from "../admin-context";

interface Classroom {
  classroomId: string;
  name: string;
  grade: number | null;
  section: string | null;
  studentCount: number;
  createdAt: string;
}

export default function ClassroomsPage() {
  const me = useAdmin();
  const canEdit = me?.role === "Admin";
  const [rooms, setRooms] = useState<Classroom[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/classrooms");
    const d = await r.json();
    if (!r.ok) return setError(d.error ?? "Failed to load classrooms");
    setRooms(d.classrooms);
  }
  useEffect(() => {
    load();
  }, []);

  return (
    <div className="animate-fade-up mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Classrooms</h1>
          <p className="mt-1 text-sm text-slate-400">
            Group students into rosters to track and compare them as a cohort.
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> New classroom
          </button>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}

      {!rooms ? (
        <div className="mt-6 flex items-center gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading classrooms…
        </div>
      ) : rooms.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <School className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-700">No classrooms yet</p>
          <p className="mt-1 text-sm text-slate-400">
            {canEdit
              ? "Create your first classroom to start building a roster."
              : "An admin hasn't set up any classrooms yet."}
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
                <ArrowRight className="h-5 w-5 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
              </div>
              <p className="mt-4 text-lg font-bold text-slate-900">{r.name}</p>
              <p className="mt-0.5 text-xs font-medium text-slate-400">
                {r.grade ? `Grade ${r.grade}${r.section ? ` · Section ${r.section}` : ""}` : "No grade set"}
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
                <Users className="h-4 w-4 text-slate-400" />
                {r.studentCount} student{r.studentCount === 1 ? "" : "s"}
              </p>
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

function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/classrooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, grade, section }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error ?? "Could not create classroom");
    onCreated();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-fade-up w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
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
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3.5 py-2 text-sm text-rose-700">{error}</p>
        )}
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
