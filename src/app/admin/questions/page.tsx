"use client";

// Question Bank Manager (spec 5.2.4): Excel import panel with validation
// report + preview diff, browse/filter/search, manual add/edit/delete.

import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "../admin-context";

interface QuestionRow {
  questionId: string;
  questionText: string;
  questionType: string | null;
  wordProblemFlag: boolean;
  equationTwinId: string | null;
  primarySkillId: string | null;
  skillName: string | null;
  gradeLevel: number | null;
  difficultyBand: string | null;
  optionA: string | null;
  optionB: string | null;
  optionC: string | null;
  optionD: string | null;
  correctOption: string | null;
  trapCount: number;
}

interface SkillOpt {
  skillId: string;
  skillName: string;
  gradeLevel: string | null;
}

interface ImportResult {
  fileName?: string;
  ok?: boolean;
  message?: string;
  error?: string;
  errors?: { sheet: string; row: number; column: string; message: string }[];
  warnings?: { sheet: string; row: number; column: string; message: string }[];
  counts?: Record<string, number>;
  preview?: {
    skills: { new: number; existing: number };
    questions: { new: number; existing: number };
    sampleNewQuestions: string[];
  };
  imported?: Record<string, number>;
}

const emptyForm = {
  questionId: "",
  questionText: "",
  primarySkillId: "",
  gradeLevel: 7,
  difficultyBand: "medium",
  wordProblemFlag: false,
  equationTwinId: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOption: "A",
};

export default function QuestionBankPage() {
  const admin = useAdmin();
  const canEdit = admin?.role === "Admin";

  const [tab, setTab] = useState<"browse" | "import">("browse");
  const [skills, setSkills] = useState<SkillOpt[]>([]);

  // Browse state
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ grade: "", skill: "", difficulty: "", word: "", q: "" });
  const pageSize = 25;

  // Editor state
  const [editing, setEditing] = useState<typeof emptyForm | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(true);

  // Import state
  const [file, setFile] = useState<File | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [validated, setValidated] = useState(false);

  useEffect(() => {
    fetch("/api/admin/skills")
      .then((r) => r.json())
      .then((d) => setSkills(d.skills ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.grade) params.set("grade", filters.grade);
    if (filters.skill) params.set("skill_id", filters.skill);
    if (filters.difficulty) params.set("difficulty", filters.difficulty);
    if (filters.word) params.set("word_problem", filters.word);
    if (filters.q) params.set("q", filters.q);
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    fetch(`/api/admin/questions?${params}`)
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

  async function saveQuestion() {
    if (!editing) return;
    setEditorError(null);
    const payload = { ...editing, gradeLevel: Number(editing.gradeLevel) };
    const url = isNew
      ? "/api/admin/questions"
      : `/api/admin/questions/${encodeURIComponent(editing.questionId)}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setEditorError(
        data.details ? `${data.error}: ${data.details.join("; ")}` : (data.error ?? "Save failed")
      );
      return;
    }
    setEditing(null);
    load();
  }

  async function deleteQuestion(id: string) {
    if (!confirm(`Delete question ${id}? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/questions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) alert(data.error ?? "Delete failed");
    load();
  }

  async function runImport(mode: "validate" | "commit") {
    if (!file) return;
    setImportBusy(true);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/admin/import?mode=${mode}`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as ImportResult;
      setImportResult(data);
      setValidated(mode === "validate" && !!data.ok);
      if (mode === "commit" && data.imported) {
        setValidated(false);
        load();
      }
    } catch (e) {
      setImportResult({ error: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setImportBusy(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="animate-fade-up mx-auto max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-slate-900">Question Bank</h1>
        <div className="flex gap-2">
          <TabButton active={tab === "browse"} onClick={() => setTab("browse")}>
            Browse ({total})
          </TabButton>
          <TabButton active={tab === "import"} onClick={() => setTab("import")}>
            Excel Import
          </TabButton>
        </div>
      </div>

      {tab === "import" ? (
        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
            Import 5-sheet SME workbook
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Sheets required: 1_Skills, 2_Questions, 3_Q_Matrix, 4_AnswerTraps,
            5_Dimensions. Validation runs first; nothing is written until you
            confirm.
          </p>
          {!canEdit && (
            <p className="mt-3 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
              Importing requires the Admin role — you are signed in as {admin?.role}.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setImportResult(null);
                setValidated(false);
              }}
              className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
            />
            <button
              onClick={() => runImport("validate")}
              disabled={!file || importBusy || !canEdit}
              className="rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
            >
              {importBusy ? "Working…" : "1 · Validate & preview"}
            </button>
            <button
              onClick={() => runImport("commit")}
              disabled={!file || importBusy || !validated || !canEdit}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              2 · Confirm import
            </button>
          </div>

          {importResult && (
            <div className="mt-5 space-y-4">
              {importResult.error && !importResult.errors && (
                <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                  {importResult.error}
                </p>
              )}
              {importResult.message && (
                <p
                  className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
                    importResult.ok
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {importResult.message}
                </p>
              )}
              {importResult.counts && (
                <p className="text-sm text-slate-600">
                  Parsed: {importResult.counts.skills} skills ·{" "}
                  {importResult.counts.questions} questions ·{" "}
                  {importResult.counts.traps} answer traps ·{" "}
                  {importResult.counts.qMatrix} Q-matrix links ·{" "}
                  {importResult.counts.dimensions} dimension rows
                </p>
              )}
              {importResult.preview && (
                <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <p className="font-semibold">Preview diff</p>
                  <p>
                    Skills: {importResult.preview.skills.new} new,{" "}
                    {importResult.preview.skills.existing} updated · Questions:{" "}
                    {importResult.preview.questions.new} new,{" "}
                    {importResult.preview.questions.existing} updated
                  </p>
                  {importResult.preview.sampleNewQuestions.length > 0 && (
                    <p className="mt-1 text-xs text-slate-400">
                      New e.g. {importResult.preview.sampleNewQuestions.join(", ")}
                    </p>
                  )}
                </div>
              )}
              {importResult.imported && (
                <p className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
                  Imported: {JSON.stringify(importResult.imported)}
                </p>
              )}
              {(importResult.errors?.length ?? 0) > 0 && (
                <IssueTable title="Errors" tone="rose" issues={importResult.errors!} />
              )}
              {(importResult.warnings?.length ?? 0) > 0 && (
                <IssueTable title="Warnings" tone="amber" issues={importResult.warnings!} />
              )}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Filters */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <select
              value={filters.grade}
              onChange={(e) => {
                setFilters({ ...filters, grade: e.target.value });
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All grades</option>
              {[5, 6, 7, 8, 9, 10].map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
            <select
              value={filters.skill}
              onChange={(e) => {
                setFilters({ ...filters, skill: e.target.value });
                setPage(1);
              }}
              className="max-w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All skills</option>
              {skills.map((s) => (
                <option key={s.skillId} value={s.skillId}>
                  {s.skillId} · {s.skillName}
                </option>
              ))}
            </select>
            <select
              value={filters.difficulty}
              onChange={(e) => {
                setFilters({ ...filters, difficulty: e.target.value });
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">All difficulties</option>
              <option value="easy">easy</option>
              <option value="medium">medium</option>
              <option value="hard">hard</option>
            </select>
            <select
              value={filters.word}
              onChange={(e) => {
                setFilters({ ...filters, word: e.target.value });
                setPage(1);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Word + equation</option>
              <option value="yes">Word problems</option>
              <option value="no">Equation only</option>
            </select>
            <input
              value={filters.q}
              onChange={(e) => {
                setFilters({ ...filters, q: e.target.value });
                setPage(1);
              }}
              placeholder="Search text or id…"
              className="w-56 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            {canEdit && (
              <button
                onClick={() => {
                  setEditing({ ...emptyForm });
                  setIsNew(true);
                  setEditorError(null);
                }}
                className="ml-auto rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                + Add question
              </button>
            )}
          </div>

          {/* Table */}
          <div className="mt-4 overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Question</th>
                  <th className="px-4 py-3">Skill</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Band</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Traps</th>
                  {canEdit && <th className="px-4 py-3">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.questionId} className="border-b border-slate-50 align-top hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {r.questionId}
                    </td>
                    <td className="max-w-md px-4 py-3 text-slate-800">
                      <p className="line-clamp-2">{r.questionText}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.skillName ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{r.gradeLevel}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          r.difficultyBand === "easy"
                            ? "bg-emerald-50 text-emerald-700"
                            : r.difficultyBand === "hard"
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {r.difficultyBand}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {r.wordProblemFlag ? "Word" : "Equation"}
                      {r.equationTwinId && (
                        <span className="ml-1 text-violet-500">⇄ twin</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{r.trapCount}</td>
                    {canEdit && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            setEditing({
                              questionId: r.questionId,
                              questionText: r.questionText,
                              primarySkillId: r.primarySkillId ?? "",
                              gradeLevel: r.gradeLevel ?? 7,
                              difficultyBand: r.difficultyBand ?? "medium",
                              wordProblemFlag: r.wordProblemFlag,
                              equationTwinId: r.equationTwinId ?? "",
                              optionA: r.optionA ?? "",
                              optionB: r.optionB ?? "",
                              optionC: r.optionC ?? "",
                              optionD: r.optionD ?? "",
                              correctOption: r.correctOption ?? "A",
                            });
                            setIsNew(false);
                            setEditorError(null);
                          }}
                          className="mr-2 text-indigo-600 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteQuestion(r.questionId)}
                          className="text-rose-500 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
            <span>
              {total} question{total === 1 ? "" : "s"} · page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}

      {/* Editor modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              {isNew ? "Add question" : `Edit ${editing.questionId}`}
            </h2>
            <div className="mt-4 grid gap-3">
              {isNew && (
                <Field label="Question ID (ncrt_{grade}_{topic}_{nnnn})">
                  <input
                    value={editing.questionId}
                    onChange={(e) => setEditing({ ...editing, questionId: e.target.value })}
                    placeholder="ncrt_7_custom_0001"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </Field>
              )}
              <Field label="Question text">
                <textarea
                  value={editing.questionText}
                  onChange={(e) => setEditing({ ...editing, questionText: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Field label="Primary skill">
                  <select
                    value={editing.primarySkillId}
                    onChange={(e) =>
                      setEditing({ ...editing, primarySkillId: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="">Select…</option>
                    {skills.map((s) => (
                      <option key={s.skillId} value={s.skillId}>
                        {s.skillId} {s.skillName}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Grade">
                  <select
                    value={editing.gradeLevel}
                    onChange={(e) =>
                      setEditing({ ...editing, gradeLevel: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  >
                    {[5, 6, 7, 8, 9, 10].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Difficulty">
                  <select
                    value={editing.difficultyBand}
                    onChange={(e) =>
                      setEditing({ ...editing, difficultyBand: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="easy">easy</option>
                    <option value="medium">medium</option>
                    <option value="hard">hard</option>
                  </select>
                </Field>
                <Field label="Correct option">
                  <select
                    value={editing.correctOption}
                    onChange={(e) =>
                      setEditing({ ...editing, correctOption: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  >
                    {["A", "B", "C", "D"].map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["A", "B", "C", "D"] as const).map((label) => {
                  const key = `option${label}` as "optionA" | "optionB" | "optionC" | "optionD";
                  return (
                    <Field key={label} label={`Option ${label}`}>
                      <input
                        value={editing[key]}
                        onChange={(e) => setEditing({ ...editing, [key]: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </Field>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Word problem?">
                  <select
                    value={editing.wordProblemFlag ? "yes" : "no"}
                    onChange={(e) =>
                      setEditing({ ...editing, wordProblemFlag: e.target.value === "yes" })
                    }
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-sm"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
                <Field label="Equation twin ID (optional)">
                  <input
                    value={editing.equationTwinId}
                    onChange={(e) =>
                      setEditing({ ...editing, equationTwinId: e.target.value })
                    }
                    placeholder="ncrt_…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                  />
                </Field>
              </div>
              {editorError && (
                <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
                  {editorError}
                </p>
              )}
              <div className="mt-2 flex justify-end gap-3">
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveQuestion}
                  className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Save question
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-indigo-600 text-white shadow-sm"
          : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
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

function IssueTable({
  title,
  tone,
  issues,
}: {
  title: string;
  tone: "rose" | "amber";
  issues: { sheet: string; row: number; column: string; message: string }[];
}) {
  const toneClasses =
    tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <div className={`rounded-lg border px-4 py-3 ${toneClasses}`}>
      <p className="text-sm font-bold">
        {title} ({issues.length})
      </p>
      <div className="mt-2 max-h-56 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="opacity-60">
              <th className="pr-3">Sheet</th>
              <th className="pr-3">Row</th>
              <th className="pr-3">Column</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {issues.slice(0, 200).map((i, idx) => (
              <tr key={idx}>
                <td className="pr-3 align-top font-mono">{i.sheet}</td>
                <td className="pr-3 align-top tabular-nums">{i.row}</td>
                <td className="pr-3 align-top font-mono">{i.column}</td>
                <td className="align-top">{i.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
