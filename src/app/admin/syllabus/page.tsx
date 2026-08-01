"use client";

// Syllabus (admin console) — the NCERT textbooks by grade, in order. Readable
// by any staff role; admins can add or remove textbooks inline. The full
// curriculum editor (subjects + chapters) lives in the Content Studio.

import { useEffect, useMemo, useState } from "react";
import { BookOpen, ExternalLink, Layers, Link2, Loader2, Plus, Target, X } from "lucide-react";
import { useAdmin } from "../admin-context";
import { subjectBlurb } from "@/lib/curriculum/subject-blurb";

interface Chapter {
  topicId: string;
  chapterNo: number | null;
  name: string;
}
interface SubjectBlock {
  subjectId: string;
  subjectName: string;
  textbooks: { textbookId: string; name: string; pdfUrl: string | null }[];
  chapters: Chapter[];
  chapterCount: number;
}

// Soft-copy link: the attached URL if set, else a search scoped to the official
// (free) NCERT source. The files themselves are never hosted here.
function softCopyHref(pdfUrl: string | null, grade: number, name: string): string {
  if (pdfUrl) return pdfUrl;
  return `https://www.google.com/search?q=${encodeURIComponent(
    `NCERT Class ${grade} ${name} textbook PDF site:ncert.nic.in`
  )}`;
}
interface GradeBlock {
  grade: number;
  subjects: SubjectBlock[];
  textbookCount: number;
  chapterCount: number;
  assessableSkills: number;
  practiceQuestions: number;
}

export default function AdminSyllabusPage() {
  const me = useAdmin();
  const canEdit = me?.role === "Admin";
  const [grades, setGrades] = useState<GradeBlock[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [editUrlFor, setEditUrlFor] = useState<string | null>(null);
  const [urlValue, setUrlValue] = useState("");

  async function saveUrl(textbookId: string) {
    const r = await fetch(`/api/content/curriculum/textbooks/${textbookId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pdfUrl: urlValue.trim() || null }),
    });
    if (r.ok) {
      setEditUrlFor(null);
      setUrlValue("");
      load();
    } else {
      const d = await r.json();
      setError(d.error ?? "Could not save the link");
    }
  }

  async function load() {
    const r = await fetch("/api/admin/syllabus");
    const d = await r.json();
    if (!r.ok) return setError(d.error ?? "Failed to load syllabus");
    setGrades(d.grades);
    setActive((prev) => prev ?? d.grades[0]?.grade ?? null);
  }
  useEffect(() => {
    load();
  }, []);

  const current = useMemo(() => grades?.find((g) => g.grade === active) ?? null, [grades, active]);

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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display flex items-center gap-2.5 text-2xl font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow">
              <Layers className="h-5 w-5" />
            </span>
            Syllabus
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            NCERT textbooks by grade, in order.
            {canEdit ? " Add or remove books to match your edition." : ""}
          </p>
        </div>
        <a
          href="/content/curriculum"
          className="hidden text-sm font-semibold text-indigo-600 hover:underline sm:inline"
        >
          Edit chapters in Content Studio →
        </a>
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
          No curriculum yet.
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {grades.map((g) => (
              <button
                key={g.grade}
                onClick={() => setActive(g.grade)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  active === g.grade
                    ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md"
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
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-3.5">
                <p className="text-sm text-slate-500">
                  <span className="font-semibold text-slate-700">Grade {current.grade}</span> ·{" "}
                  {current.textbookCount} textbooks · {current.chapterCount} chapters ·{" "}
                  <span className="font-medium text-indigo-700">
                    {current.assessableSkills} assessable skills · {current.practiceQuestions} practice questions
                  </span>
                </p>
                <a
                  href="/practice"
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110"
                >
                  <Target className="h-4 w-4" /> Practise
                </a>
              </div>

              <div className="mt-4 space-y-4">
                {current.subjects.map((s) => (
                  <section
                    key={s.subjectId}
                    className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-6 py-3.5">
                      <div>
                        <h2 className="font-bold text-slate-800">{s.subjectName}</h2>
                        {subjectBlurb(s.subjectName) && (
                          <p className="mt-0.5 text-xs text-slate-400">{subjectBlurb(s.subjectName)}</p>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-400">{s.chapterCount} chapters</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 px-6 pt-4">
                      {s.textbooks.length === 0 && (
                        <span className="text-xs italic text-slate-400">No textbook listed</span>
                      )}
                      {s.textbooks.map((b) =>
                        editUrlFor === b.textbookId ? (
                          <span key={b.textbookId} className="flex items-center gap-1">
                            <input
                              value={urlValue}
                              onChange={(e) => setUrlValue(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && saveUrl(b.textbookId)}
                              placeholder="https://…  (soft-copy link)"
                              autoFocus
                              className="w-64 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                            />
                            <button
                              onClick={() => saveUrl(b.textbookId)}
                              className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditUrlFor(null);
                                setUrlValue("");
                              }}
                              className="rounded-lg px-2 py-1.5 text-slate-400 hover:bg-slate-100"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </span>
                        ) : (
                          <span
                            key={b.textbookId}
                            className="group flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-800 ring-1 ring-indigo-100"
                          >
                            <a
                              href={softCopyHref(b.pdfUrl, current.grade, b.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 hover:underline"
                              title={b.pdfUrl ? "Open the attached soft copy" : "Find the official NCERT PDF"}
                            >
                              <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                              {b.name}
                              <ExternalLink
                                className={`h-3 w-3 ${b.pdfUrl ? "text-indigo-600" : "text-indigo-300"}`}
                              />
                            </a>
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditUrlFor(b.textbookId);
                                    setUrlValue(b.pdfUrl ?? "");
                                  }}
                                  title={b.pdfUrl ? "Edit soft-copy link" : "Attach a soft-copy link"}
                                  className="text-indigo-400 opacity-0 transition hover:text-indigo-700 group-hover:opacity-100"
                                >
                                  <Link2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => removeTextbook(b.textbookId)}
                                  title="Remove textbook"
                                  className="text-indigo-400 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </span>
                        )
                      )}
                      {canEdit &&
                        (addFor === s.subjectId ? (
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
                              className="rounded-lg bg-indigo-600 px-2.5 py-1.5 text-white hover:bg-indigo-700"
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
                            className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-indigo-300 hover:text-indigo-700"
                          >
                            <Plus className="h-3.5 w-3.5" /> Add textbook
                          </button>
                        ))}
                    </div>

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
