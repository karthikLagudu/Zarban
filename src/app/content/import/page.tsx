"use client";

// Import (validate → preview → commit) and one-click export of the whole
// content bank as the 5-sheet SME workbook.

import { useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";

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

export default function ImportExportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [validated, setValidated] = useState(false);

  async function run(mode: "validate" | "commit") {
    if (!file) return;
    setBusy(true);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/content/import?mode=${mode}`, { method: "POST", body: form });
      const data = (await res.json()) as ImportResult;
      setResult(data);
      setValidated(mode === "validate" && !!data.ok);
      if (mode === "commit" && data.imported) setValidated(false);
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "Upload failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-fade-up mx-auto max-w-3xl">
      <h1 className="font-display flex items-center gap-2 text-2xl font-bold text-slate-900">
        <FileSpreadsheet className="h-6 w-6 text-emerald-600" /> Import / Export
      </h1>
      <p className="mt-1 text-sm text-slate-400">Round-trip the entire content bank as a 5-sheet Excel workbook.</p>

      {/* Export */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-sm font-bold tracking-wider text-slate-500 uppercase">Export</h2>
        <p className="mt-1 text-sm text-slate-500">
          Download every skill, question, answer trap, Q-matrix mapping and dimension tag as a workbook you can edit and re-import.
        </p>
        <a
          href="/api/content/export"
          download
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:brightness-110"
        >
          <Download className="h-4 w-4" /> Download content workbook
        </a>
      </section>

      {/* Import */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-sm font-bold tracking-wider text-slate-500 uppercase">Import</h2>
        <p className="mt-1 text-xs text-slate-400">
          Upload a 5-sheet workbook (1_Skills, 2_Questions, 3_Q_Matrix, 4_AnswerTraps, 5_Dimensions). Validation runs first — nothing is written until you confirm.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); setValidated(false); }}
            className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
          />
          <button onClick={() => run("validate")} disabled={!file || busy} className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">
            <Upload className="h-4 w-4" /> {busy ? "Working…" : "1 · Validate"}
          </button>
          <button onClick={() => run("commit")} disabled={!file || busy || !validated} className="rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50">
            2 · Confirm import
          </button>
        </div>

        {result && (
          <div className="mt-5 space-y-3 text-sm">
            {result.error && !result.errors && <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-rose-700">{result.error}</p>}
            {result.message && (
              <p className={`rounded-lg px-4 py-2.5 font-medium ${result.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{result.message}</p>
            )}
            {result.counts && (
              <p className="text-slate-600">Parsed: {result.counts.skills} skills · {result.counts.questions} questions · {result.counts.traps} traps · {result.counts.qMatrix} Q-matrix · {result.counts.dimensions} dimensions</p>
            )}
            {result.preview && (
              <div className="rounded-lg bg-slate-50 px-4 py-3 text-slate-700">
                <p className="font-semibold">Preview</p>
                <p>Skills: {result.preview.skills.new} new, {result.preview.skills.existing} updated · Questions: {result.preview.questions.new} new, {result.preview.questions.existing} updated</p>
              </div>
            )}
            {result.imported && <p className="rounded-lg bg-emerald-50 px-4 py-2.5 text-emerald-700">Imported: {JSON.stringify(result.imported)}</p>}
            {(result.errors?.length ?? 0) > 0 && <IssueTable title="Errors" tone="rose" issues={result.errors!} />}
            {(result.warnings?.length ?? 0) > 0 && <IssueTable title="Warnings" tone="amber" issues={result.warnings!} />}
          </div>
        )}
      </section>
    </div>
  );
}

function IssueTable({ title, tone, issues }: { title: string; tone: "rose" | "amber"; issues: { sheet: string; row: number; column: string; message: string }[] }) {
  const cls = tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <div className={`rounded-lg border px-4 py-3 ${cls}`}>
      <p className="text-sm font-bold">{title} ({issues.length})</p>
      <div className="mt-2 max-h-56 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead><tr className="opacity-60"><th className="pr-3">Sheet</th><th className="pr-3">Row</th><th className="pr-3">Column</th><th>Message</th></tr></thead>
          <tbody>
            {issues.slice(0, 200).map((i, idx) => (
              <tr key={idx}><td className="pr-3 align-top font-mono">{i.sheet}</td><td className="pr-3 align-top tabular-nums">{i.row}</td><td className="pr-3 align-top font-mono">{i.column}</td><td className="align-top">{i.message}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
