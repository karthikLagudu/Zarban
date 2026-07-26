"use client";

// Curriculum — the NCERT subject → topic catalog for grades 6–10. Browse by
// subject and grade, and add / remove subjects and topics. Seeded data is a
// starting point; verify against the exact NCERT edition in use.

import { useEffect, useMemo, useState } from "react";
import { BookMarked, Loader2, Plus, Trash2, X } from "lucide-react";

interface Topic {
  topicId: string;
  grade: number;
  name: string;
  chapterNo: number | null;
}
interface Subject {
  subjectId: string;
  name: string;
  topicCount: number;
  topics: Topic[];
}

const GRADES = [6, 7, 8, 9, 10];

export default function CurriculumPage() {
  const [subjects, setSubjects] = useState<Subject[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gradeFilter, setGradeFilter] = useState<number | "all">("all");
  const [error, setError] = useState<string | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [addingSubject, setAddingSubject] = useState(false);
  // Add-topic form state.
  const [topicName, setTopicName] = useState("");
  const [topicGrade, setTopicGrade] = useState(6);
  const [addingTopic, setAddingTopic] = useState(false);

  async function load(keepSelection = true) {
    const r = await fetch("/api/content/curriculum");
    const d = await r.json();
    if (!r.ok) return setError(d.error ?? "Failed to load curriculum");
    setSubjects(d.subjects);
    if (!keepSelection || !selectedId) setSelectedId(d.subjects[0]?.subjectId ?? null);
  }
  useEffect(() => {
    load(false);
  }, []);

  const selected = useMemo(
    () => subjects?.find((s) => s.subjectId === selectedId) ?? null,
    [subjects, selectedId]
  );
  const shownTopics = useMemo(() => {
    if (!selected) return [];
    return selected.topics.filter((t) => gradeFilter === "all" || t.grade === gradeFilter);
  }, [selected, gradeFilter]);
  const byGrade = useMemo(() => {
    const m = new Map<number, Topic[]>();
    for (const t of shownTopics) {
      if (!m.has(t.grade)) m.set(t.grade, []);
      m.get(t.grade)!.push(t);
    }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [shownTopics]);

  async function addSubject() {
    if (!newSubject.trim()) return;
    setAddingSubject(true);
    setError(null);
    const r = await fetch("/api/content/curriculum", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newSubject }),
    });
    const d = await r.json();
    setAddingSubject(false);
    if (!r.ok) return setError(d.error ?? "Could not add subject");
    setNewSubject("");
    await load(true);
    setSelectedId(d.subject.subjectId);
  }

  async function deleteSubject(s: Subject) {
    if (!confirm(`Delete "${s.name}" and its ${s.topicCount} topics?`)) return;
    const r = await fetch(`/api/content/curriculum/subjects/${s.subjectId}`, { method: "DELETE" });
    if (r.ok) {
      setSelectedId(null);
      load(false);
    }
  }

  async function addTopic() {
    if (!selected || !topicName.trim()) return;
    setAddingTopic(true);
    setError(null);
    const r = await fetch("/api/content/curriculum/topics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId: selected.subjectId, grade: topicGrade, name: topicName }),
    });
    const d = await r.json();
    setAddingTopic(false);
    if (!r.ok) return setError(d.error ?? "Could not add topic");
    setTopicName("");
    load(true);
  }

  async function deleteTopic(t: Topic) {
    const r = await fetch(`/api/content/curriculum/topics/${t.topicId}`, { method: "DELETE" });
    if (r.ok) load(true);
  }

  return (
    <div className="animate-fade-up mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Curriculum</h1>
          <p className="mt-1 text-sm text-slate-400">
            NCERT subjects &amp; topics for Grades 6–10. Editable — verify against your edition.
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}

      {!subjects ? (
        <div className="mt-6 flex items-center gap-3 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading curriculum…
        </div>
      ) : (
        <div className="mt-6 grid gap-6 md:grid-cols-[16rem_1fr]">
          {/* Subjects rail */}
          <aside className="space-y-2">
            {subjects.map((s) => (
              <button
                key={s.subjectId}
                onClick={() => setSelectedId(s.subjectId)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                  s.subjectId === selectedId
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-white hover:border-emerald-200"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <BookMarked
                    className={`h-4 w-4 ${s.subjectId === selectedId ? "text-emerald-600" : "text-slate-400"}`}
                  />
                  <span className="font-semibold text-slate-800">{s.name}</span>
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                  {s.topicCount}
                </span>
              </button>
            ))}

            {/* Add subject */}
            <div className="flex gap-2 pt-2">
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSubject()}
                placeholder="New subject…"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                onClick={addSubject}
                disabled={addingSubject || !newSubject.trim()}
                className="flex items-center justify-center rounded-lg bg-emerald-600 px-3 py-2 text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {addingSubject ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
          </aside>

          {/* Topics */}
          <section className="min-w-0">
            {!selected ? (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-400">
                Select or add a subject to see its topics.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">{selected.name}</h2>
                    <span className="text-sm text-slate-400">· {selected.topicCount} topics</span>
                  </div>
                  <button
                    onClick={() => deleteSubject(selected)}
                    className="flex items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete subject
                  </button>
                </div>

                {/* Grade filter */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(["all", ...GRADES] as const).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGradeFilter(g)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                        gradeFilter === g
                          ? "bg-slate-900 text-white"
                          : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {g === "all" ? "All grades" : `Grade ${g}`}
                    </button>
                  ))}
                </div>

                {/* Add topic */}
                <div className="mt-4 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
                  <select
                    value={topicGrade}
                    onChange={(e) => setTopicGrade(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                  <input
                    value={topicName}
                    onChange={(e) => setTopicName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTopic()}
                    placeholder="New topic / chapter name…"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={addTopic}
                    disabled={addingTopic || !topicName.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {addingTopic ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add topic
                  </button>
                </div>

                {/* Topic lists by grade */}
                {byGrade.length === 0 ? (
                  <p className="mt-6 text-sm text-slate-400">No topics for this filter yet.</p>
                ) : (
                  <div className="mt-5 space-y-6">
                    {byGrade.map(([grade, topics]) => (
                      <div key={grade}>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Grade {grade} · {topics.length} chapters
                        </h3>
                        <ul className="mt-2 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                          {topics.map((t) => (
                            <li key={t.topicId} className="group flex items-center gap-3 px-4 py-2.5">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs font-bold text-slate-500">
                                {t.chapterNo ?? "·"}
                              </span>
                              <span className="min-w-0 flex-1 text-sm text-slate-800">{t.name}</span>
                              <button
                                onClick={() => deleteTopic(t)}
                                title="Remove topic"
                                className="rounded-lg p-1.5 text-slate-300 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
