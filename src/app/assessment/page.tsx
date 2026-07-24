"use client";

// Assessment Screen (spec 5.1.2): one question at a time, skill breadcrumb,
// a running elapsed-time clock (no countdown, no limit), and no right/wrong
// feedback during the test. Selecting an option (click or A–D key) submits it
// immediately — there is no separate submit button.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Clock, Loader2 } from "lucide-react";

interface ServedQuestion {
  questionId: string;
  questionText: string;
  options: { label: string; text: string }[];
  skillName: string | null;
  topicArea: string | null;
  gradeLevel: number | null;
  difficultyBand: string | null;
  isTwinProbe: boolean;
  questionNumber: number;
  maxQuestions: number;
}

interface Step {
  done: boolean;
  reason?: string;
  decision: string;
  question?: ServedQuestion;
}

interface StoredState {
  sessionId: string;
  studentId: string;
  /** when the test began (client clock, ms) — survives page refreshes */
  startedAtMs: number;
  step: Step;
  studentName: string;
  grade: number;
}

/** Delay between picking an option and submitting, so the choice is visible. */
const SUBMIT_FEEDBACK_MS = 350;

export default function AssessmentPage() {
  const router = useRouter();
  const [state, setState] = useState<StoredState | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const questionStartedAt = useRef<number>(Date.now());
  const submittingRef = useRef(false);

  useEffect(() => {
    const raw = localStorage.getItem("zarban_assessment");
    if (!raw) {
      router.replace("/");
      return;
    }
    const parsed = JSON.parse(raw) as StoredState;
    if (parsed.step.done) {
      router.replace(`/report/${parsed.sessionId}`);
      return;
    }
    setState(parsed);
    questionStartedAt.current = Date.now();
    setElapsedSeconds(
      Math.max(0, Math.round((Date.now() - parsed.startedAtMs) / 1000))
    );
  }, [router]);

  const submit = useCallback(
    async (option: string | null) => {
      if (!state?.step.question || submittingRef.current) return;
      submittingRef.current = true;
      setBusy(true);
      setError(null);
      const body = JSON.stringify({
        session_id: state.sessionId,
        question_id: state.step.question.questionId,
        // Timer expiry with no choice submits "X" — always wrong, so the
        // engine treats it as an incorrect response and adapts.
        selected_option: option ?? "X",
        response_time_ms: Date.now() - questionStartedAt.current,
      });
      // One silent retry so a momentary network blip never strands the student.
      const post = () =>
        fetch("/api/session/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
      try {
        let res: Response;
        try {
          res = await post();
        } catch {
          await new Promise((r) => setTimeout(r, 800));
          res = await post();
        }
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) throw new Error(data.error ?? `Could not submit (${res.status})`);
        const step: Step = data.step;
        const next: StoredState = { ...state, step };
        if (step.done) {
          localStorage.removeItem("zarban_assessment");
          router.push(`/report/${state.sessionId}`);
          return;
        }
        localStorage.setItem("zarban_assessment", JSON.stringify(next));
        setState(next);
        setSelected(null);
        questionStartedAt.current = Date.now();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        setSelected(null);
      } finally {
        submittingRef.current = false;
        setBusy(false);
      }
    },
    [state, router]
  );

  /** Selecting an answer records it immediately (brief highlight first). */
  const choose = useCallback(
    (label: string) => {
      if (busy || submittingRef.current) return;
      setSelected(label);
      window.setTimeout(() => void submit(label), SUBMIT_FEEDBACK_MS);
    },
    [busy, submit]
  );

  // Elapsed-time clock — a simple stopwatch, re-derived from the absolute
  // start time so background tabs and refreshes stay accurate. No limit.
  useEffect(() => {
    if (!state) return;
    const t = setInterval(() => {
      setElapsedSeconds(
        Math.max(0, Math.round((Date.now() - state.startedAtMs) / 1000))
      );
    }, 1000);
    return () => clearInterval(t);
  }, [state]);

  // Keyboard: A–D answers instantly.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!state?.step.question || busy) return;
      const k = e.key.toUpperCase();
      if (["A", "B", "C", "D"].includes(k)) {
        if (state.step.question.options.some((o) => o.label === k)) choose(k);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, busy, choose]);

  if (!state?.step.question) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-10">
        <div className="skeleton h-5 w-64" />
        <div className="skeleton mt-3 h-1.5 w-full" />
        <div className="skeleton mt-12 h-72 w-full rounded-3xl" />
      </main>
    );
  }

  const q = state.step.question;
  const progress = Math.min(q.questionNumber / q.maxQuestions, 1);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="bg-dot-grid absolute inset-0 opacity-30" />
      <div className="animate-blob-slow absolute -top-40 right-0 h-96 w-96 rounded-full bg-indigo-100/60 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-8">
        {/* Header: breadcrumb + timer + question number */}
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
              {state.studentName} · Class {state.grade}
            </p>
            <p className="mt-1 flex items-center gap-1.5 truncate text-sm font-semibold text-indigo-700">
              <span className="text-slate-400">Topic:</span> {q.topicArea ?? "Math"}
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              {q.skillName ?? "…"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <ElapsedClock seconds={elapsedSeconds} />
            <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-500 tabular-nums ring-1 ring-slate-200">
              Q{q.questionNumber}
            </span>
          </div>
        </header>
        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-200/80">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-700 ease-out"
            style={{ width: `${Math.max(progress * 100, 3)}%` }}
          />
        </div>

        {/* Question card */}
        <section
          key={q.questionId}
          className="animate-fade-up mt-10 rounded-3xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/50 sm:p-10"
        >
          <p className="text-xl leading-relaxed font-medium text-slate-900 sm:text-[22px]">
            {q.questionText}
          </p>

          <div className="mt-8 grid gap-3">
            {q.options.map((opt) => {
              const active = selected === opt.label;
              return (
                <button
                  key={opt.label}
                  onClick={() => choose(opt.label)}
                  disabled={busy}
                  className={`group flex items-center gap-4 rounded-2xl border px-5 py-4 text-left text-lg transition-all ${
                    active
                      ? "border-indigo-500 bg-indigo-50/70 shadow-md shadow-indigo-100 ring-2 ring-indigo-200"
                      : busy
                        ? "border-slate-200 bg-white opacity-50"
                        : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md hover:shadow-slate-100"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold transition ${
                      active
                        ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow"
                        : "bg-slate-100 text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600"
                    }`}
                  >
                    {active ? <Check className="h-5 w-5" /> : opt.label}
                  </span>
                  <span className="text-slate-800">{opt.text}</span>
                </button>
              );
            })}
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
              {error} — tap an option to try again.
            </p>
          )}

          <div className="mt-7 flex h-6 items-center justify-center text-sm text-slate-400">
            {busy ? (
              <span className="flex items-center gap-2 font-medium text-indigo-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Recording your answer…
              </span>
            ) : (
              <span>Tap an option — your answer is recorded instantly.</span>
            )}
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-slate-400">
          Press <Kbd>A</Kbd>–<Kbd>D</Kbd> to answer · answers are never marked
          right or wrong on screen — the test adapts to you.
        </p>
      </div>
    </main>
  );
}

/** Running clock: elapsed time since the test began. Purely informational —
 *  there is no countdown and no time pressure. */
function ElapsedClock({ seconds }: { seconds: number }) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const text =
    h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
      : `${m}:${String(s).padStart(2, "0")}`;
  return (
    <div
      className="flex items-center gap-2 rounded-full bg-white py-1.5 pr-4 pl-3 ring-1 ring-slate-200"
      title="Time on test so far"
    >
      <Clock className="h-4 w-4 text-indigo-500" />
      <div className="leading-tight">
        <span className="block text-sm font-bold text-slate-700 tabular-nums">
          {text}
        </span>
        <span className="block text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
          Time on test
        </span>
      </div>
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
