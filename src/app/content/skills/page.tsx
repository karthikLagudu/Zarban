"use client";

// Skills & Knowledge Graph manager — CRUD skills and edit prerequisite edges.

import { useCallback, useEffect, useState } from "react";
import { Network, Plus, Search } from "lucide-react";

interface SkillRow {
  skillId: string;
  skillName: string;
  gradeLevel: string | null;
  topicArea: string | null;
  difficultyBand: string | null;
  prerequisiteSkillIds: string;
  notes: string | null;
  questionCount: number;
}

const empty = {
  skillId: "",
  skillName: "",
  gradeLevel: "",
  topicArea: "Algebra",
  difficultyBand: "medium",
  prerequisiteSkillIds: "",
  notes: "",
};

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<typeof empty | null>(null);
  const [isNew, setIsNew] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/content/skills")
      .then((r) => r.json())
      .then((d) => setSkills(d.skills ?? []))
      .catch(() => {});
  }, []);
  useEffect(load, [load]);

  const skillNames = new Map(skills.map((s) => [s.skillId, s.skillName]));
  const filtered = skills.filter(
    (s) =>
      !q ||
      s.skillId.toLowerCase().includes(q.toLowerCase()) ||
      s.skillName.toLowerCase().includes(q.toLowerCase())
  );

  async function save() {
    if (!editing) return;
    setError(null);
    const url = isNew
      ? "/api/content/skills"
      : `/api/content/skills/${encodeURIComponent(editing.skillId)}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.details ? `${d.error}: ${d.details.join("; ")}` : (d.error ?? "Save failed"));
      return;
    }
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm(`Delete skill ${id}?`)) return;
    const res = await fetch(`/api/content/skills/${encodeURIComponent(id)}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) alert(d.error ?? "Delete failed");
    load();
  }

  return (
    <div className="animate-fade-up mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Network className="h-6 w-6 text-emerald-600" /> Skills & Knowledge Graph
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {skills.length} skills · prerequisites define how the engine traverses gaps.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search skills…"
              className="w-56 rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            />
          </div>
          <button
            onClick={() => {
              setEditing({ ...empty });
              setIsNew(true);
              setError(null);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
          >
            <Plus className="h-4 w-4" /> New skill
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wider text-slate-400">
              <th className="px-5 py-3">ID</th>
              <th className="px-5 py-3">Skill</th>
              <th className="px-5 py-3">Grade</th>
              <th className="px-5 py-3">Topic</th>
              <th className="px-5 py-3">Prerequisites</th>
              <th className="px-5 py-3">Qs</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.skillId} className="border-b border-slate-50 hover:bg-emerald-50/40">
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{s.skillId}</td>
                <td className="px-5 py-3 font-medium text-slate-800">{s.skillName}</td>
                <td className="px-5 py-3 tabular-nums">{s.gradeLevel}</td>
                <td className="px-5 py-3 text-slate-500">{s.topicArea}</td>
                <td className="px-5 py-3">
                  {s.prerequisiteSkillIds ? (
                    <div className="flex flex-wrap gap-1">
                      {s.prerequisiteSkillIds.split(",").map((p) => (
                        <span
                          key={p.trim()}
                          title={skillNames.get(p.trim()) ?? ""}
                          className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-600"
                        >
                          {p.trim()}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-emerald-600">root</span>
                  )}
                </td>
                <td className="px-5 py-3 tabular-nums">{s.questionCount}</td>
                <td className="px-5 py-3 whitespace-nowrap">
                  <button
                    onClick={() => {
                      setEditing({
                        skillId: s.skillId,
                        skillName: s.skillName,
                        gradeLevel: s.gradeLevel ?? "",
                        topicArea: s.topicArea ?? "Algebra",
                        difficultyBand: s.difficultyBand ?? "medium",
                        prerequisiteSkillIds: s.prerequisiteSkillIds,
                        notes: s.notes ?? "",
                      });
                      setIsNew(false);
                      setError(null);
                    }}
                    className="mr-3 text-emerald-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button onClick={() => remove(s.skillId)} className="text-rose-500 hover:underline">
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {isNew ? "New skill" : `Edit ${editing.skillId}`}
            </h2>
            <div className="mt-4 grid gap-3">
              {isNew && (
                <Field label="Skill ID (e.g. S_034)">
                  <input
                    value={editing.skillId}
                    onChange={(e) => setEditing({ ...editing, skillId: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </Field>
              )}
              <Field label="Skill name">
                <input
                  value={editing.skillName}
                  onChange={(e) => setEditing({ ...editing, skillName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Grade level">
                  <input
                    value={editing.gradeLevel}
                    onChange={(e) => setEditing({ ...editing, gradeLevel: e.target.value })}
                    placeholder="7 or 9-10"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Topic area">
                  <select
                    value={editing.topicArea}
                    onChange={(e) => setEditing({ ...editing, topicArea: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  >
                    {["Arithmetic", "Algebra", "Geometry", "Statistics"].map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Band">
                  <select
                    value={editing.difficultyBand}
                    onChange={(e) => setEditing({ ...editing, difficultyBand: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  >
                    {["easy", "medium", "hard"].map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Prerequisite skill IDs (comma-separated — the knowledge graph)">
                <input
                  value={editing.prerequisiteSkillIds}
                  onChange={(e) => setEditing({ ...editing, prerequisiteSkillIds: e.target.value })}
                  placeholder="S_011, S_013"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                />
              </Field>
              <Field label="Notes (NCERT reference etc.)">
                <textarea
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
              {error && (
                <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>
              )}
              <div className="mt-2 flex justify-end gap-3">
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2 text-sm font-semibold text-white hover:brightness-110"
                >
                  Save skill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
