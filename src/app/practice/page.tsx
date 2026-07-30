"use client";

// Practice Mode — the learning half of the loop. Pick a skill and drill it: each
// answer gives instant feedback and, when wrong, the specific misconception
// behind the option you chose. Unlike the graded assessment, this teaches.

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GraduationCap,
  Loader2,
  RotateCcw,
  Sparkles,
  Target,
  Trophy,
  X,
} from "lucide-react";

interface CatalogSkill {
  skillId: string;
  skillName: string;
  gradeLevel: string | null;
  topicArea: string | null;
  questionCount: number;
}
interface PQuestion {
  questionId: string;
  questionText: string;
  difficulty: string | null;
  options: { label: string; text: string }[];
  correctOption: string | null;
  traps: Record<string, { trapType: string | null; misconception: string | null; detail: string | null }>;
}
interface PayLoad {
  skill: { skillId: string; skillName: string; gradeLevel: string | null; topicArea: string | null; notes: string | null };
  questions: PQuestion[];
}

const TOPIC: Record<string, string> = {
  Arithmetic: "from-sky-500 to-blue-600",
  Algebra: "from-indigo-500 to-violet-600",
  Geometry: "from-amber-500 to-orange-600",
  Statistics: "from-emerald-500 to-teal-600",
};
const topicGrad = (t: string | null) => TOPIC[t ?? ""] ?? "from-slate-500 to-slate-600";

export default function PracticePage() {
  const [skillId, setSkillId] = useState<string | null | undefined>(undefined);
  const [catalog, setCatalog] = useState<CatalogSkill[] | null>(null);
  const [payload, setPayload] = useState<PayLoad | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSkillId(new URLSearchParams(window.location.search).get("skill"));
  }, []);

  useEffect(() => {
    if (skillId === null) {
      fetch("/api/practice")
        .then((r) => r.json())
        .then((d) => setCatalog(d.skills ?? []))
        .catch(() => setCatalog([]));
    }
  }, [skillId]);

  useEffect(() => {
    if (!skillId) return;
    setPayload(null);
    setError(null);
    fetch(`/api/practice?skill=${encodeURIComponent(skillId)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Could not load practice");
        setPayload(d);
      })
      .catch((e) => setError(e.message));
  }, [skillId]);

  function pick(id: string) {
    window.history.pushState(null, "", `/practice?skill=${encodeURIComponent(id)}`);
    setSkillId(id);
  }
  function backToPicker() {
    window.history.pushState(null, "", "/practice");
    setSkillId(null);
    setPayload(null);
  }

  if (skillId === undefined)
    return (
      <Shell>
        <div className="skeleton mx-auto h-40 max-w-3xl rounded-3xl" />
      </Shell>
    );

  if (skillId) {
    if (error)
      return (
        <Shell>
          <div className="mx-auto max-w-md rounded-3xl border border-rose-200 bg-white p-8 text-center">
            <p className="font-medium text-rose-600">{error}</p>
            <button onClick={backToPicker} className="mt-4 text-sm font-semibold text-indigo-600 hover:underline">
              ← Choose another skill
            </button>
          </div>
        </Shell>
      );
    if (!payload)
      return (
        <Shell>
          <div className="mx-auto flex max-w-3xl items-center gap-3 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Building your practice set…
          </div>
        </Shell>
      );
    return (
      <Shell>
        <Runner payload={payload} onExit={backToPicker} />
      </Shell>
    );
  }

  return (
    <Shell>
      <Picker catalog={catalog} onPick={pick} />
    </Shell>
  );
}

// ── Picker ───────────────────────────────────────────────────────────────────
function Picker({ catalog, onPick }: { catalog: CatalogSkill[] | null; onPick: (id: string) => void }) {
  if (!catalog)
    return (
      <div className="mx-auto flex max-w-3xl items-center gap-3 text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading skills…
      </div>
    );

  const byGrade = new Map<string, CatalogSkill[]>();
  for (const s of catalog) {
    const g = s.gradeLevel ?? "?";
    if (!byGrade.has(g)) byGrade.set(g, []);
    byGrade.get(g)!.push(s);
  }
  const grades = [...byGrade.keys()].sort((a, b) => parseInt(a) - parseInt(b));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-semibold text-indigo-700 ring-1 ring-indigo-100">
          <Target className="h-4 w-4" /> Practice Mode
        </span>
        <h1 className="mt-4 text-3xl font-bold text-slate-900">Pick a skill to practise</h1>
        <p className="mt-2 text-slate-500">
          Every answer is checked instantly — and when you slip, we show you exactly why.
        </p>
      </div>

      {grades.map((g) => (
        <section key={g} className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Grade {g}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {byGrade.get(g)!.map((s) => (
              <button
                key={s.skillId}
                onClick={() => onPick(s.skillId)}
                className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${topicGrad(s.topicArea)} text-white shadow`}>
                  <GraduationCap className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-slate-800">{s.skillName}</span>
                  <span className="block text-xs text-slate-400">
                    {s.topicArea ?? "—"} · {s.questionCount} questions
                  </span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// ── Runner ───────────────────────────────────────────────────────────────────
function Runner({ payload, onExit }: { payload: PayLoad; onExit: () => void }) {
  const { skill, questions } = payload;
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  const q = questions[i];

  function reset() {
    setI(0);
    setSelected(null);
    setRevealed(false);
    setCorrect(0);
    setDone(false);
  }
  function check() {
    if (!selected || revealed) return;
    setRevealed(true);
    if (selected === q.correctOption) setCorrect((c) => c + 1);
  }
  function next() {
    if (i + 1 >= questions.length) {
      setDone(true);
      return;
    }
    setI(i + 1);
    setSelected(null);
    setRevealed(false);
  }

  // Keyboard: 1–4 or A–D to choose, Enter to check, then Enter for the next one.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || !q) return;
      if (revealed) {
        if (e.key === "Enter") {
          e.preventDefault();
          next();
        }
        return;
      }
      let label: string | undefined;
      if (/^[1-4]$/.test(e.key)) label = q.options[parseInt(e.key, 10) - 1]?.label;
      else {
        const k = e.key.toUpperCase();
        if (["A", "B", "C", "D"].includes(k)) label = q.options.find((o) => o.label === k)?.label;
      }
      if (label) {
        e.preventDefault();
        setSelected(label);
      } else if (e.key === "Enter" && selected) {
        e.preventDefault();
        check();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (questions.length === 0)
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        No questions for this skill yet.
        <button onClick={onExit} className="mt-4 block w-full text-sm font-semibold text-indigo-600 hover:underline">
          ← Choose another skill
        </button>
      </div>
    );

  if (done) {
    const pct = Math.round((correct / questions.length) * 100);
    const great = pct >= 80;
    return (
      <div className="animate-fade-up mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${great ? "from-emerald-400 to-teal-600" : "from-indigo-500 to-violet-600"} text-white shadow-lg`}>
          <Trophy className="h-8 w-8" />
        </span>
        <h2 className="mt-4 text-2xl font-bold text-slate-900">
          {correct} / {questions.length} correct
        </h2>
        <p className="mt-1 text-slate-500">
          {great ? "Excellent — this skill is looking strong! 🎉" : "Good effort — a bit more practice and you'll own this."}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={reset}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-110"
          >
            <RotateCcw className="h-4 w-4" /> Practise again
          </button>
          <button onClick={onExit} className="rounded-2xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-600 transition hover:bg-slate-50">
            Choose another skill
          </button>
          <a href="/learn" className="mt-1 text-sm font-semibold text-indigo-600 hover:underline">
            See my progress →
          </a>
        </div>
      </div>
    );
  }

  const trap = selected ? q.traps[selected] : null;
  const isRight = revealed && selected === q.correctOption;

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={onExit} className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> All skills
      </button>

      {/* Progress */}
      <div className="mt-3 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-500"
            style={{ width: `${((i + (revealed ? 1 : 0)) / questions.length) * 100}%` }}
          />
        </div>
        <span className="text-sm font-semibold tabular-nums text-slate-500">
          {i + 1}/{questions.length}
        </span>
      </div>

      <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-slate-700">{skill.skillName}</span>
          {q.difficulty && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold capitalize text-slate-500">
              {q.difficulty}
            </span>
          )}
          <span className="ml-auto font-semibold text-emerald-600">Score {correct}</span>
        </div>

        <p className="mt-3 text-lg font-medium text-slate-900">{q.questionText}</p>

        <div className="mt-4 grid gap-2.5">
          {q.options.map((o) => {
            const isCorrect = o.label === q.correctOption;
            const isChosen = o.label === selected;
            let cls = "border-slate-200 bg-white hover:border-indigo-300";
            if (revealed) {
              if (isCorrect) cls = "border-emerald-400 bg-emerald-50";
              else if (isChosen) cls = "border-rose-400 bg-rose-50";
              else cls = "border-slate-200 bg-white opacity-70";
            } else if (isChosen) {
              cls = "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200";
            }
            return (
              <button
                key={o.label}
                disabled={revealed}
                onClick={() => setSelected(o.label)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${cls}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                  revealed && isCorrect
                    ? "bg-emerald-500 text-white"
                    : revealed && isChosen
                      ? "bg-rose-500 text-white"
                      : "bg-slate-100 text-slate-600"
                }`}>
                  {revealed && isCorrect ? <Check className="h-4 w-4" /> : revealed && isChosen ? <X className="h-4 w-4" /> : o.label}
                </span>
                <span className="min-w-0 flex-1 text-slate-800">{o.text}</span>
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {revealed && (
          <div
            className={`mt-4 rounded-2xl px-5 py-4 ${
              isRight ? "bg-emerald-50 ring-1 ring-emerald-100" : "bg-amber-50 ring-1 ring-amber-100"
            }`}
          >
            {isRight ? (
              <p className="flex items-center gap-2 font-semibold text-emerald-800">
                <Sparkles className="h-4 w-4" /> Correct — nicely done!
              </p>
            ) : (
              <>
                <p className="font-semibold text-amber-900">
                  Not quite. The answer is <span className="font-bold">{q.correctOption}</span>.
                </p>
                {trap?.misconception && (
                  <p className="mt-1.5 text-sm font-medium text-amber-900">{trap.misconception}</p>
                )}
                {trap?.detail && <p className="mt-0.5 text-sm leading-relaxed text-amber-800">{trap.detail}</p>}
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex justify-end">
          {!revealed ? (
            <button
              onClick={check}
              disabled={!selected}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2.5 font-semibold text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Check answer
            </button>
          ) : (
            <button
              onClick={next}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-2.5 font-semibold text-white shadow-md transition hover:bg-slate-800"
            >
              {i + 1 >= questions.length ? "Finish" : "Next question"} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-slate-400">
        Press <Kbd>1</Kbd>–<Kbd>4</Kbd> to choose · <Kbd>Enter</Kbd> to{" "}
        {revealed ? "continue" : "check"}
      </p>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-500 shadow-sm">
      {children}
    </kbd>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen">
      <div className="bg-dot-grid absolute inset-0 opacity-30" />
      <header className="relative z-10 mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
        <a href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
            <GraduationCap className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-bold text-slate-900">Zarban</span>
        </a>
        <div className="flex items-center gap-4 text-sm font-semibold text-slate-500">
          <a href="/learn" className="transition hover:text-indigo-700">My progress</a>
          <a href="/" className="transition hover:text-indigo-700">Home</a>
        </div>
      </header>
      <div className="relative px-6 pb-12">{children}</div>
    </main>
  );
}
