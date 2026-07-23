"use client";

// Questions manager — browse/filter the bank and author full questions:
// options, learning dimensions, Q-matrix skills, twin link, and per-option
// misconception "answer traps".

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LibraryBig, Plus, Search } from "lucide-react";

interface Row {
  questionId: string;
  questionText: string;
  wordProblemFlag: boolean;
  equationTwinId: string | null;
  primarySkillId: string | null;
  skillName: string | null;
  gradeLevel: number | null;
  difficultyBand: string | null;
  correctOption: string | null;
  trapCount: number;
  primaryDimension: string | null;
  hasDimensions: boolean;
}
interface SkillOpt {
  skillId: string;
  skillName: string;
  gradeLevel: string | null;
}

const TRAP_TYPES = [
  "Calculation_Error",
  "Concept_Error",
  "Sign_Error",
  "Reading_Error",
  "Procedural_Error",
  "Careless_Slip",
];
const REMEDIAL_ACTIONS = ["serve_same_level", "go_down_grade", "go_prereq_skill", "flag_review"];
const DIMENSIONS = ["Reading", "Understanding", "Application", "Calculation", "Retention"];

interface Trap {
  optionLabel: string;
  optionText: string;
  trapType: string;
  skillGapId: string;
  misconception: string;
  misconceptionDetail: string;
  remedialAction: string;
  remedialSkillId: string;
  remedialGrade: string | number;
}
interface EditorState {
  questionId: string;
  questionText: string;
  wordProblemFlag: boolean;
  equationTwinId: string;
  primarySkillId: string;
  secondarySkillIds: string;
  gradeLevel: number;
  difficultyBand: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  dimensions: {
    dimReading: boolean;
    dimUnderstanding: boolean;
    dimApplication: boolean;
    dimCalculation: boolean;
    dimRetention: boolean;
    primaryDimension: string;
    wordEqPairId: string;
  };
  qMatrixSkillIds: string[];
  traps: Trap[];
}

const emptyEditor = (): EditorState => ({
  questionId: "",
  questionText: "",
  wordProblemFlag: false,
  equationTwinId: "",
  primarySkillId: "",
  secondarySkillIds: "",
  gradeLevel: 7,
  difficultyBand: "medium",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOption: "A",
  dimensions: {
    dimReading: false,
    dimUnderstanding: true,
    dimApplication: false,
    dimCalculation: false,
    dimRetention: false,
    primaryDimension: "Understanding",
    wordEqPairId: "",
  },
  qMatrixSkillIds: [],
  traps: [],
});

export default function QuestionsPage() {
  return (
    <Suspense fallback={<div className="skeleton h-8 w-48" />}>
      <QuestionsInner />
    </Suspense>
  );
}

function QuestionsInner() {
  const params = useSearchParams();
  const focusId = params.get("focus");

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [skills, setSkills] = useState<SkillOpt[]>([]);
  const [filters, setFilters] = useState({ grade: "", skill: "", difficulty: "", word: "", issue: "", q: focusId ?? "" });
  const [editing, setEditing] = useState<EditorState | null>(null);
  const [isNew, setIsNew] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const pageSize = 20;

  useEffect(() => {
    fetch("/api/content/skills")
      .then((r) => r.json())
      .then((d) => setSkills((d.skills ?? []).map((s: SkillOpt) => s)))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (filters.grade) p.set("grade", filters.grade);
    if (filters.skill) p.set("skill_id", filters.skill);
    if (filters.difficulty) p.set("difficulty", filters.difficulty);
    if (filters.word) p.set("word_problem", filters.word);
    if (filters.issue) p.set("issue", filters.issue);
    if (filters.q) p.set("q", filters.q);
    p.set("page", String(page));
    p.set("page_size", String(pageSize));
    fetch(`/api/content/questions?${p}`)
      .then((r) => r.json())
      .then((d) => {
        setRows(d.questions ?? []);
        setTotal(d.total ?? 0);
      })
      .catch(() => {});
  }, [filters, page]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function openEdit(id: string) {
    setError(null);
    const res = await fetch(`/api/content/questions/${encodeURIComponent(id)}`);
    const d = await res.json();
    if (!res.ok) {
      alert(d.error ?? "Load failed");
      return;
    }
    const q = d.question;
    setEditing({
      questionId: q.questionId,
      questionText: q.questionText,
      wordProblemFlag: q.wordProblemFlag,
      equationTwinId: q.equationTwinId ?? "",
      primarySkillId: q.primarySkillId ?? "",
      secondarySkillIds: q.secondarySkillIds ?? "",
      gradeLevel: q.gradeLevel ?? 7,
      difficultyBand: q.difficultyBand ?? "medium",
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctOption: q.correctOption,
      dimensions: {
        dimReading: q.dimensions.dimReading,
        dimUnderstanding: q.dimensions.dimUnderstanding,
        dimApplication: q.dimensions.dimApplication,
        dimCalculation: q.dimensions.dimCalculation,
        dimRetention: q.dimensions.dimRetention,
        primaryDimension: q.dimensions.primaryDimension ?? "",
        wordEqPairId: q.dimensions.wordEqPairId ?? "",
      },
      qMatrixSkillIds: q.qMatrixSkillIds ?? [],
      traps: q.traps ?? [],
    });
    setIsNew(false);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    const url = isNew
      ? "/api/content/questions"
      : `/api/content/questions/${encodeURIComponent(editing.questionId)}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editing),
    });
    const d = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(d.details ? `${d.error}: ${d.details.join("; ")}` : (d.error ?? "Save failed"));
      return;
    }
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm(`Delete question ${id}?`)) return;
    const res = await fetch(`/api/content/questions/${encodeURIComponent(id)}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) alert(d.error ?? "Delete failed");
    load();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="animate-fade-up mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-slate-900">
            <LibraryBig className="h-6 w-6 text-indigo-600" /> Questions
          </h1>
          <p className="mt-1 text-sm text-slate-400">{total} questions in the bank.</p>
        </div>
        <button
          onClick={() => {
            setEditing(emptyEditor());
            setIsNew(true);
            setError(null);
          }}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> New question
        </button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.q}
            onChange={(e) => { setFilters({ ...filters, q: e.target.value }); setPage(1); }}
            placeholder="Search id or text…"
            className="w-56 rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </div>
        <Select value={filters.grade} onChange={(v) => { setFilters({ ...filters, grade: v }); setPage(1); }} placeholder="All grades" options={[5, 6, 7, 8, 9, 10].map((g) => [String(g), `Grade ${g}`])} />
        <Select value={filters.difficulty} onChange={(v) => { setFilters({ ...filters, difficulty: v }); setPage(1); }} placeholder="All bands" options={[["easy", "easy"], ["medium", "medium"], ["hard", "hard"]]} />
        <Select value={filters.word} onChange={(v) => { setFilters({ ...filters, word: v }); setPage(1); }} placeholder="Word + equation" options={[["yes", "Word problems"], ["no", "Equation only"]]} />
        <Select value={filters.issue} onChange={(v) => { setFilters({ ...filters, issue: v }); setPage(1); }} placeholder="Any health" options={[["no_traps", "⚠ Missing traps"], ["no_dimensions", "⚠ Missing dimensions"]]} />
      </div>

      <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-xs uppercase tracking-wider text-slate-400">
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Question</th>
              <th className="px-4 py-3">Skill</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3">Band</th>
              <th className="px-4 py-3">Traps</th>
              <th className="px-4 py-3">Dims</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.questionId} className="border-b border-slate-50 align-top hover:bg-indigo-50/40">
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.questionId}</td>
                <td className="max-w-sm px-4 py-3 text-slate-800"><p className="line-clamp-2">{r.questionText}</p></td>
                <td className="px-4 py-3 text-slate-600">{r.skillName ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums">{r.gradeLevel}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.difficultyBand === "easy" ? "bg-emerald-50 text-emerald-700" : r.difficultyBand === "hard" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>
                    {r.difficultyBand}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`tabular-nums ${r.trapCount === 0 ? "font-bold text-rose-600" : "text-slate-500"}`}>{r.trapCount}</span>
                </td>
                <td className="px-4 py-3">
                  {r.hasDimensions ? <span className="text-xs text-slate-500">{r.primaryDimension}</span> : <span className="text-xs font-bold text-rose-600">none</span>}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <button onClick={() => openEdit(r.questionId)} className="mr-3 text-indigo-600 hover:underline">Edit</button>
                  <button onClick={() => remove(r.questionId)} className="text-rose-500 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
        <span>{total} questions · page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40">← Prev</button>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40">Next →</button>
        </div>
      </div>

      {editing && (
        <QuestionEditor
          state={editing}
          setState={setEditing}
          isNew={isNew}
          skills={skills}
          error={error}
          saving={saving}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Select({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
      <option value="">{placeholder}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

// ── Full question editor ─────────────────────────────────────────────────────

function QuestionEditor({
  state,
  setState,
  isNew,
  skills,
  error,
  saving,
  onSave,
  onClose,
}: {
  state: EditorState;
  setState: (s: EditorState) => void;
  isNew: boolean;
  skills: SkillOpt[];
  error: string | null;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const wrongOptions = useMemo(
    () => (["A", "B", "C", "D"] as const).filter((l) => l !== state.correctOption),
    [state.correctOption]
  );

  function upsertTrap(label: string, patch: Partial<Trap>) {
    const traps = [...state.traps];
    const idx = traps.findIndex((t) => t.optionLabel === label);
    if (idx >= 0) traps[idx] = { ...traps[idx], ...patch };
    else
      traps.push({
        optionLabel: label,
        optionText: "",
        trapType: "",
        skillGapId: "",
        misconception: "",
        misconceptionDetail: "",
        remedialAction: "",
        remedialSkillId: "",
        remedialGrade: "",
        ...patch,
      });
    setState({ ...state, traps });
  }
  const trapFor = (label: string) => state.traps.find((t) => t.optionLabel === label);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 sm:p-8">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-white px-6 py-4">
          <h2 className="font-display text-lg font-bold text-slate-900">
            {isNew ? "New question" : `Edit ${state.questionId}`}
          </h2>
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-700">✕ Close</button>
        </div>

        <div className="space-y-6 p-6">
          {/* Core */}
          <Section title="Question">
            {isNew && (
              <Field label="Question ID (ncrt_{grade}_{topic}_{nnnn})">
                <input value={state.questionId} onChange={(e) => setState({ ...state, questionId: e.target.value })} placeholder="ncrt_7_custom_0001" className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" />
              </Field>
            )}
            <Field label="Question text">
              <textarea value={state.questionText} onChange={(e) => setState({ ...state, questionText: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Primary skill">
                <select value={state.primarySkillId} onChange={(e) => setState({ ...state, primarySkillId: e.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
                  <option value="">Select…</option>
                  {skills.map((s) => <option key={s.skillId} value={s.skillId}>{s.skillId} {s.skillName}</option>)}
                </select>
              </Field>
              <Field label="Grade">
                <select value={state.gradeLevel} onChange={(e) => setState({ ...state, gradeLevel: Number(e.target.value) })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
                  {[5, 6, 7, 8, 9, 10].map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="Difficulty">
                <select value={state.difficultyBand} onChange={(e) => setState({ ...state, difficultyBand: e.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
                  {["easy", "medium", "hard"].map((b) => <option key={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Correct option">
                <select value={state.correctOption} onChange={(e) => setState({ ...state, correctOption: e.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
                  {["A", "B", "C", "D"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {/* Options */}
          <Section title="Answer options">
            <div className="grid gap-2">
              {(["A", "B", "C", "D"] as const).map((label) => {
                const key = `option${label}` as "optionA" | "optionB" | "optionC" | "optionD";
                const correct = state.correctOption === label;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${correct ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500"}`}>{label}</span>
                    <input value={state[key]} onChange={(e) => setState({ ...state, [key]: e.target.value })} placeholder={`Option ${label}${correct ? " (correct)" : ""}`} className={`w-full rounded-lg border px-3 py-2 text-sm ${correct ? "border-emerald-300 bg-emerald-50/40" : "border-slate-300"}`} />
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Dimensions */}
          <Section title="Learning dimensions">
            <div className="flex flex-wrap gap-2">
              {([["dimReading", "Reading"], ["dimUnderstanding", "Understanding"], ["dimApplication", "Application"], ["dimCalculation", "Calculation"], ["dimRetention", "Retention"]] as const).map(([key, label]) => {
                const on = state.dimensions[key];
                return (
                  <button
                    key={key}
                    onClick={() => setState({ ...state, dimensions: { ...state.dimensions, [key]: !on } })}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${on ? "bg-sky-100 text-sky-700 ring-1 ring-sky-300" : "bg-slate-100 text-slate-500"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="Primary dimension">
                <select value={state.dimensions.primaryDimension} onChange={(e) => setState({ ...state, dimensions: { ...state.dimensions, primaryDimension: e.target.value } })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
                  <option value="">—</option>
                  {DIMENSIONS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Word problem?">
                <select value={state.wordProblemFlag ? "yes" : "no"} onChange={(e) => setState({ ...state, wordProblemFlag: e.target.value === "yes" })} className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm">
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </Field>
            </div>
            {state.wordProblemFlag && (
              <Field label="Equation twin question ID (the stripped-of-words version)">
                <input value={state.equationTwinId} onChange={(e) => setState({ ...state, equationTwinId: e.target.value, dimensions: { ...state.dimensions, wordEqPairId: e.target.value } })} placeholder="ncrt_…" className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" />
              </Field>
            )}
          </Section>

          {/* Q-matrix */}
          <Section title="Skills tested (Q-matrix)">
            <p className="mb-2 text-xs text-slate-400">The primary skill is always included. Tick any additional skills this question also tests.</p>
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {skills.map((s) => {
                const on = state.qMatrixSkillIds.includes(s.skillId) || s.skillId === state.primarySkillId;
                const isPrimary = s.skillId === state.primarySkillId;
                return (
                  <button
                    key={s.skillId}
                    disabled={isPrimary}
                    onClick={() => {
                      const set = new Set(state.qMatrixSkillIds);
                      if (set.has(s.skillId)) set.delete(s.skillId);
                      else set.add(s.skillId);
                      setState({ ...state, qMatrixSkillIds: [...set] });
                    }}
                    title={s.skillName}
                    className={`rounded-md px-2 py-1 font-mono text-[11px] transition ${isPrimary ? "bg-emerald-500 text-white" : on ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300" : "bg-slate-100 text-slate-500"}`}
                  >
                    {s.skillId}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Answer traps */}
          <Section title="Misconception traps (wrong options)">
            <p className="mb-3 text-xs text-slate-400">
              For each wrong option, describe the mistake it represents and how the engine should respond. These power the diagnostic report.
            </p>
            <div className="space-y-4">
              {wrongOptions.map((label) => {
                const t = trapFor(label);
                return (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-rose-100 text-xs font-bold text-rose-700">{label}</span>
                      <span className="text-sm font-medium text-slate-600">Trap for option {label}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Trap type">
                        <select value={t?.trapType ?? ""} onChange={(e) => upsertTrap(label, { trapType: e.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                          <option value="">—</option>
                          {TRAP_TYPES.map((x) => <option key={x} value={x}>{x.replace(/_/g, " ")}</option>)}
                        </select>
                      </Field>
                      <Field label="Skill gap (skill ID)">
                        <select value={t?.skillGapId ?? ""} onChange={(e) => upsertTrap(label, { skillGapId: e.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                          <option value="">—</option>
                          {skills.map((s) => <option key={s.skillId} value={s.skillId}>{s.skillId}</option>)}
                        </select>
                      </Field>
                      <Field label="Misconception (short)">
                        <input value={t?.misconception ?? ""} onChange={(e) => upsertTrap(label, { misconception: e.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                      </Field>
                      <Field label="Remedial action">
                        <select value={t?.remedialAction ?? ""} onChange={(e) => upsertTrap(label, { remedialAction: e.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                          <option value="">—</option>
                          {REMEDIAL_ACTIONS.map((x) => <option key={x} value={x}>{x.replace(/_/g, " ")}</option>)}
                        </select>
                      </Field>
                    </div>
                    <Field label="Explanation (why this is wrong — shown in the report)">
                      <textarea value={t?.misconceptionDetail ?? ""} onChange={(e) => upsertTrap(label, { misconceptionDetail: e.target.value })} rows={2} className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                    </Field>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <Field label="Remedial skill ID">
                        <select value={t?.remedialSkillId ?? ""} onChange={(e) => upsertTrap(label, { remedialSkillId: e.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm">
                          <option value="">—</option>
                          {skills.map((s) => <option key={s.skillId} value={s.skillId}>{s.skillId}</option>)}
                        </select>
                      </Field>
                      <Field label="Remedial grade">
                        <input type="number" min={5} max={10} value={t?.remedialGrade ?? ""} onChange={(e) => upsertTrap(label, { remedialGrade: e.target.value })} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          {error && <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>}
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 rounded-b-2xl border-t border-slate-100 bg-white px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={onSave} disabled={saving} className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-6 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
            {saving ? "Saving…" : "Save question"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-500 uppercase">{title}</h3>
      <div className="grid gap-3">{children}</div>
    </section>
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
