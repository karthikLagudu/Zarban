"use client";

// Assessment configuration: max questions per session + optional per-question
// timer (spec 5.1.2 "configurable by admin").

import { useEffect, useState } from "react";
import { useAdmin } from "../admin-context";

export default function SettingsPage() {
  const admin = useAdmin();
  const canEdit = admin?.role === "Admin";
  const [maxQuestions, setMaxQuestions] = useState("30");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings?.max_questions) setMaxQuestions(d.settings.max_questions);
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaved(false);
    setError(null);
    const res = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        max_questions: maxQuestions,
      }),
    });
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Save failed");
      return;
    }
    setSaved(true);
  }

  return (
    <div className="animate-fade-up max-w-xl">
      <h1 className="font-display text-2xl font-bold text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-400">Assessment configuration for every new session.</p>
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            Maximum questions per session
          </span>
          <span className="text-xs text-slate-400">
            The session ends when this count is reached (twin probes don&apos;t count).
          </span>
          <input
            type="number"
            min={5}
            max={100}
            value={maxQuestions}
            onChange={(e) => setMaxQuestions(e.target.value)}
            disabled={!canEdit}
            className="w-40 rounded-lg border border-slate-300 px-4 py-2.5 tabular-nums disabled:bg-slate-50"
          />
        </label>
        <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
          ⏱ Students see a running clock during the test (time elapsed, not a
          countdown). There is no time limit — the session ends by topic
          coverage, mastery, or the question cap above.
        </p>

        {!canEdit && (
          <p className="mt-5 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
            Only the Admin role can change settings.
          </p>
        )}
        {error && (
          <p className="mt-5 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            {error}
          </p>
        )}
        {saved && (
          <p className="mt-5 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
            Settings saved.
          </p>
        )}
        <button
          onClick={save}
          disabled={!canEdit}
          className="mt-6 rounded-xl bg-indigo-600 px-6 py-2.5 font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
        >
          Save settings
        </button>
      </section>
    </div>
  );
}
