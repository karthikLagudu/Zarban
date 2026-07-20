"use client";

// Session Replay (spec 5.2.5): full timeline — question served, option
// selected, trap fired, engine's next-question decision.

import Link from "next/link";
import { use, useEffect, useState } from "react";

interface Replay {
  session: {
    sessionId: string;
    student: { name: string | null; studentId: string };
    selectedGrade: number | null;
    status: string;
    theta: number;
    startedAt: string;
    endedAt: string | null;
  };
  timeline: {
    order: number;
    questionId: string;
    questionText: string;
    skillName: string | null;
    servedGrade: number | null;
    servedDifficulty: string | null;
    selectedOption: string | null;
    correctOption: string | null;
    isCorrect: boolean | null;
    twinProbe: boolean;
    trapType: string | null;
    misconception: string | null;
    engineDecision: string | null;
    thetaAfter: number | null;
    pMasteryAfter: number | null;
  }[];
  traversals: { from: string; to: string; reason: string | null }[];
}

export default function SessionReplayPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const [data, setData] = useState<Replay | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/sessions/${sessionId}/replay`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Failed to load replay");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [sessionId]);

  if (error) return <p className="text-rose-600">{error}</p>;
  if (!data) return <p className="text-slate-400">Loading replay…</p>;

  const { session, timeline } = data;

  return (
    <div className="animate-fade-up mx-auto max-w-5xl">
      <Link
        href={`/admin/students/${session.student.studentId}`}
        className="text-sm text-indigo-600 hover:underline"
      >
        ← Back to {session.student.name ?? "student"}
      </Link>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-slate-900">Session Replay</h1>
        <p className="text-sm text-slate-500">
          Grade {session.selectedGrade} · {session.status.replace("_", " ")} · final θ ={" "}
          <span className="font-semibold tabular-nums">{session.theta.toFixed(2)}</span> ·{" "}
          <a
            href={`/report/${session.sessionId}`}
            target="_blank"
            className="font-medium text-indigo-600 hover:underline"
          >
            open report ↗
          </a>
        </p>
      </div>

      {data.traversals.length > 0 && (
        <section className="mt-5 rounded-2xl border border-rose-100 bg-rose-50/50 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-rose-600">
            Knowledge-graph traversals in this session
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {data.traversals.map((t, i) => (
              <li key={i}>
                {t.from} <span className="text-slate-300">→</span>{" "}
                <span className="font-medium">{t.to}</span>
                {t.reason && (
                  <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-rose-500">
                    {t.reason.replace(/_/g, " ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ol className="mt-6 space-y-4">
        {timeline.map((t) => (
          <li
            key={t.order}
            className={`rounded-2xl border bg-white p-5 shadow-sm ${
              t.twinProbe ? "border-violet-200" : "border-slate-200"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-slate-900 px-2.5 py-1 font-bold text-white">
                #{t.order}
              </span>
              {t.twinProbe && (
                <span className="rounded-full bg-violet-100 px-2.5 py-1 font-semibold text-violet-700">
                  ⇄ twin probe
                </span>
              )}
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                {t.skillName ?? "?"} · G{t.servedGrade ?? "?"} · {t.servedDifficulty ?? "?"}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 font-semibold ${
                  t.isCorrect
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {t.isCorrect ? "correct" : "wrong"} — chose {t.selectedOption ?? "—"}
                {!t.isCorrect && t.correctOption ? ` (ans: ${t.correctOption})` : ""}
              </span>
              {t.trapType && (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                  {t.trapType.replace(/_/g, " ")}
                </span>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-800">
              {t.questionText}
            </p>
            {t.misconception && (
              <p className="mt-1 text-xs italic text-slate-400">
                Misconception: {t.misconception}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
              <span>
                Engine decision →{" "}
                <span className="rounded bg-indigo-50 px-2 py-0.5 font-mono font-medium text-indigo-700">
                  {t.engineDecision ?? "—"}
                </span>
              </span>
              {t.thetaAfter !== null && (
                <span className="tabular-nums">θ after: {t.thetaAfter.toFixed(2)}</span>
              )}
              {t.pMasteryAfter !== null && (
                <span className="tabular-nums">
                  P(L) after: {Math.round(t.pMasteryAfter * 100)}%
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
