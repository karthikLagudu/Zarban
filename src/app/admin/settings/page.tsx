"use client";

// Assessment configuration: max questions per session and an optional overall
// time limit (spec 5.1.2 "configurable by admin"). Admin-only to save.

import { useEffect, useState } from "react";
import { useAdmin } from "../admin-context";

export default function SettingsPage() {
  const admin = useAdmin();
  const canEdit = admin?.role === "Admin";
  const [maxQuestions, setMaxQuestions] = useState("30");
  const [timerMinutes, setTimerMinutes] = useState("0");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings?.max_questions) setMaxQuestions(d.settings.max_questions);
        if (d.settings?.test_timer_minutes !== undefined)
          setTimerMinutes(d.settings.test_timer_minutes);
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
        test_timer_minutes: timerMinutes,
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
      <section className="mt-6 space-y-6 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium text-slate-700">
            Maximum questions per session
          </span>
          <span className="text-xs text-slate-400">
            The session ends when this count is reached (twin probes don&apos;t count). 5–100.
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

        <label className="grid gap-1.5 border-t border-slate-100 pt-6">
          <span className="text-sm font-medium text-slate-700">
            Overall time limit (minutes)
          </span>
          <span className="text-xs text-slate-400">
            Ends the session when the limit is reached. Set to <strong>0</strong> for no limit.
            0–180.
          </span>
          <input
            type="number"
            min={0}
            max={180}
            value={timerMinutes}
            onChange={(e) => setTimerMinutes(e.target.value)}
            disabled={!canEdit}
            className="w-40 rounded-lg border border-slate-300 px-4 py-2.5 tabular-nums disabled:bg-slate-50"
          />
        </label>

        <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
          ⏱ Students always see a running clock during the test (time elapsed). With a limit
          set, the session also ends automatically once the time is up.
        </p>

        {!canEdit && (
          <p className="rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-700">
            Only the Admin role can change settings.
          </p>
        )}
        {error && (
          <p className="rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</p>
        )}
        {saved && (
          <p className="rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
            Settings saved.
          </p>
        )}
        <button
          onClick={save}
          disabled={!canEdit}
          className="rounded-xl bg-indigo-600 px-6 py-2.5 font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
        >
          Save settings
        </button>
      </section>
    </div>
  );
}
