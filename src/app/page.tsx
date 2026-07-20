"use client";

// Landing / Grade Selection (spec 5.1.1): name, school, grade cards.

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  BrainCircuit,
  ChartSpline,
  Compass,
  GraduationCap,
  Loader2,
  Sparkles,
} from "lucide-react";

const GRADES = [5, 6, 7, 8, 9, 10];

const FEATURES = [
  {
    icon: Compass,
    title: "Adapts as you answer",
    text: "Questions get easier or harder based on how you're doing — no two tests are the same.",
  },
  {
    icon: BrainCircuit,
    title: "Finds the why, not just the what",
    text: "Every wrong option is mapped to a specific misconception, so the report explains your mistakes.",
  },
  {
    icon: ChartSpline,
    title: "A report worth reading",
    text: "Skill mastery, five learning dimensions, and the exact foundations to strengthen next.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    if (!name.trim() || grade === null) {
      setError("Please enter your name and pick your class.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, school, grade }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not start the assessment");
      sessionStorage.setItem(
        "zarban_assessment",
        JSON.stringify({
          sessionId: data.session_id,
          studentId: data.student_id,
          startedAtMs: Date.now(),
          step: data.step,
          studentName: name,
          grade,
        })
      );
      router.push("/assessment");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Backdrop */}
      <div className="bg-dot-grid absolute inset-0 opacity-40" />
      <div className="animate-blob absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-200/50 blur-3xl" />
      <div className="animate-blob-slow absolute top-1/3 -right-40 h-[28rem] w-[28rem] rounded-full bg-violet-200/50 blur-3xl" />
      <div className="animate-blob absolute -bottom-40 left-1/4 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl" />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-14 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        {/* Left: pitch */}
        <div className="animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/70 px-4 py-1.5 text-sm font-semibold text-indigo-700 shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4" />
            Zarban · Adaptive Math Assessment
          </div>
          <h1 className="mt-6 text-4xl leading-[1.1] font-bold text-slate-900 sm:text-5xl">
            Find out exactly where your{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              math stands
            </span>
            .
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            A smart diagnostic for Grades 5–10, aligned to the NCERT syllabus.
            Around 20–30 questions, about 15 minutes — and a personal report
            that shows your strengths, your gaps, and what to study next.
          </p>

          <ul className="mt-10 hidden space-y-5 lg:block">
            {FEATURES.map((f, i) => (
              <li
                key={f.title}
                className={`animate-fade-up delay-${i + 1} flex items-start gap-4`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-200">
                  <f.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-semibold text-slate-800">{f.title}</p>
                  <p className="mt-0.5 max-w-md text-sm leading-relaxed text-slate-500">
                    {f.text}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: start card */}
        <div className="animate-fade-up delay-2">
          <div className="rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl shadow-indigo-100/60 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
                <GraduationCap className="h-6 w-6" />
              </span>
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Start your assessment
                </h2>
                <p className="text-xs text-slate-400">
                  No marks shown during the test — just answer honestly.
                </p>
              </div>
            </div>

            <div className="mt-7 grid gap-5">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-700">Your name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aarav Sharma"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-700">
                  School{" "}
                  <span className="font-normal text-slate-400">(optional)</span>
                </span>
                <input
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder="e.g. DAV Public School"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
              </label>
              <div className="grid gap-1.5">
                <span className="text-sm font-medium text-slate-700">Your class</span>
                <div className="grid grid-cols-6 gap-2">
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGrade(g)}
                      className={`group relative rounded-xl border px-2 py-3 text-center transition-all ${
                        grade === g
                          ? "border-transparent bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200"
                          : "border-slate-200 bg-white text-slate-700 shadow-sm hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md"
                      }`}
                    >
                      <span className="text-lg font-bold">{g}</span>
                      <span
                        className={`block text-[10px] font-medium tracking-wide uppercase ${
                          grade === g ? "text-indigo-100" : "text-slate-400"
                        }`}
                      >
                        Class
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
                  {error}
                </p>
              )}

              <button
                onClick={start}
                disabled={busy}
                className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3.5 text-lg font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Preparing your first question…
                  </>
                ) : (
                  "Start Assessment"
                )}
              </button>
              <p className="text-center text-xs text-slate-400">
                Powered by CAT · IRT · CDM · BKT diagnostics
              </p>
            </div>
          </div>

          <footer className="mt-6 text-center text-xs text-slate-400">
            Teachers:{" "}
            <a
              href="/admin"
              className="font-semibold text-indigo-500 transition hover:text-indigo-700 hover:underline"
            >
              open the admin dashboard →
            </a>
          </footer>
        </div>
      </div>
    </main>
  );
}
