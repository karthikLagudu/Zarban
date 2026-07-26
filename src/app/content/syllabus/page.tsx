"use client";

// Syllabus — the NCERT textbooks laid out grade by grade. Pick a grade to see
// its books (per subject) in order, each with its chapters. Textbooks can be
// added or removed to match the exact edition in use.

import { useEffect, useMemo, useState } from "react";
import { BookOpen, Layers, Loader2, Plus, X } from "lucide-react";

interface Chapter {
  topicId: string;
  chapterNo: number | null;
  name: string;
}
interface Textbook {
  textbookId: string;
  name: string;
}
interface SubjectBlock {
  subjectId: string;
  subjectName: string;
  textbooks: Textbook[];
  chapters: Chapter[];
  chapterCount: number;
}
interface GradeBlock {
  grade: number;
  subjects: SubjectBlock[];
  textbookCount: number;
  chapterCount: number;
}

export default function SyllabusPage() {
  const [grades, setGrades] = useState<GradeBlock[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null); // subjectId being edited
  const [addName, setAddName] = useState("");

  async function load() {
    const r = await fetch("/api/content/syllabus");
    const d = await r.json();
    if (!r.ok) return setError(d.error ?? "Failed to load syllabus");
    setGrades(d.grades);
    setActive((prev) => prev ?? d.grades[0]?.grade ?? null);
  }
  useEffect(() => {
    load();
  }, []);

  const current = useMemo(
    () => grades?.find((g) => g.grade === active) ?? null,
    [grades, active]
  );

  async function addTextbook(subjectId: string, grade: number) {
    if (!addName.trim()) return;
    const r = await fetch("/api/content/curriculum/textbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId, grade, name: addName }),
    });
    if (r.ok) {
      setAddName("");
      setAddFor(null);
      load();
    } else {
      const d = await r.json();
      setError(d.error ?? "Could not add textbook");
    }
  }

  async function removeTextbook(id: string) {
    const r = await fetch(`/api/content/curriculum/textbooks/${id}`, { method: "DELETE" });
    if (r.ok) load();
  }

  return (
    <div className="animate-fade-up mx-auto max-w-4xl">
      <div>
        <h1 className="font-display flex items-center gap-2.5 text-2xl font-bold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow">
            <Layers className="h-5 w-5" />
          </span>
          Syllabus
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          NCERT textbooks by grade, in order. Chapters come from the Curriculum catalog.
        </p>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}

      {!grades ? (
        <div className="mt-6 flex items-center gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading syllabus…
        </div>
      ) : grades.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
          No curriculum yet — add subjects and topics in the Curriculum tab.
        </div>
      ) : (
        <>
          {/* Grade tabs */}
          <div className="mt-6 flex flex-wrap gap-2">
            {grades.map((g) => (
              <button
                key={g.grade}
                onClick={() => setActive(g.grade)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  active === g.grade
                    ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                Grade {g.grade}
                <span
                  className={`rounded-full px-1.5 text-xs ${
                    active === g.grade ? "bg-white/20" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {g.textbookCount}
                </span>
              </button>
            ))}
          </div>

          {current && (
            <div className="mt-5">
              <p className="text-sm text-slate-500">
                <span className="font-semibold text-slate-700">Grade {current.grade}</span> ·{" "}
                {current.textbookCount} textbooks · {current.chapterCount} chapters
              </p>

              <div className="mt-4 space-y-4">
                {current.subjects.map((s) => (
                  <section
                    key={s.subjectId}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-6 py-3.5">
                      <h2 className="font-bold text-slate-800">{s.subjectName}</h2>
                      <span className="text-xs font-semibold text-slate-400">
                        {s.chapterCount} chapters
                      </span>
                    </div>

                    {/* Textbooks */}
                    <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
                      {s.textbooks.length === 0 && (
                        <span className="text-xs italic text-slate-400">No textbook listed</span>
                      )}
                      {s.textbooks.map((b) => (
                        <span
                          key={b.textbookId}
                          className="group flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-100"
                        >
                          <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
                          {b.name}
                          <button
                            onClick={() => removeTextbook(b.textbookId)}
                            title="Remove textbook"
                            className="text-emerald-400 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      ))}
                      {addFor === s.subjectId ? (
                        <span className="flex items-center gap-1">
                          <input
                            value={addName}
                            onChange={(e) => setAddName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addTextbook(s.subjectId, current.grade)}
                            placeholder="Textbook name…"
                            autoFocus
                            className="w-44 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                          />
                          <button
                            onClick={() => addTextbook(s.subjectId, current.grade)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-white hover:bg-emerald-700"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setAddFor(null);
                              setAddName("");
                            }}
                            className="rounded-lg px-2 py-1.5 text-slate-400 hover:bg-slate-100"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setAddFor(s.subjectId)}
                          className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-emerald-300 hover:text-emerald-700"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add textbook
                        </button>
                      )}
                    </div>

                    {/* Chapters */}
                    {s.chapters.length > 0 && (
                      <ol className="grid gap-x-6 gap-y-1 px-6 py-4 sm:grid-cols-2">
                        {s.chapters.map((c) => (
                          <li key={c.topicId} className="flex items-baseline gap-2 text-sm text-slate-700">
                            <span className="w-5 shrink-0 text-right text-xs font-bold text-slate-400 tabular-nums">
                              {c.chapterNo ?? "·"}
                            </span>
                            <span className="min-w-0">{c.name}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
