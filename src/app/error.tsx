"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="bg-dot-grid absolute inset-0 opacity-40" />
      <div className="animate-blob absolute -top-24 -left-24 h-80 w-80 rounded-full bg-rose-200/50 blur-3xl" />

      <div className="animate-fade-up relative max-w-md rounded-3xl border border-white/60 bg-white/85 p-10 text-center shadow-xl shadow-rose-100/60 backdrop-blur">
        <p className="text-5xl">⚠️</p>
        <h1 className="mt-4 font-display text-xl font-bold text-slate-900">
          Something went wrong.
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          An unexpected error occurred. You can try again, and your progress is
          saved.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-110"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            Back to start
          </a>
        </div>
      </div>
    </main>
  );
}
