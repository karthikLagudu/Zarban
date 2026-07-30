"use client";

// System & Audit (Admin only): data-maintenance "danger zone" actions gated by
// a typed confirmation phrase, plus the append-only audit trail of every
// privileged action taken in the console.

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Database,
  History,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useEscapeKey } from "@/lib/use-escape";

interface Counts {
  students: number;
  sessions: number;
  incomplete: number;
  responses: number;
  bkt: number;
  audit: number;
}
interface AuditEntry {
  id: number;
  actorEmail: string;
  action: string;
  target: string | null;
  detail: string | null;
  createdAt: string;
}

interface DangerAction {
  key: string;
  phrase: string;
  title: string;
  description: string;
  impact: (c: Counts) => string;
  cta: string;
}

const ACTION_BADGE: Record<string, string> = {
  "auth.login": "bg-slate-100 text-slate-600",
  "user.create": "bg-emerald-50 text-emerald-700",
  "user.role_change": "bg-indigo-50 text-indigo-700",
  "user.password_reset": "bg-amber-50 text-amber-700",
  "user.delete": "bg-rose-50 text-rose-700",
  "settings.update": "bg-sky-50 text-sky-700",
  "data.reset_learner_history": "bg-rose-100 text-rose-800",
  "data.clear_incomplete_sessions": "bg-amber-100 text-amber-800",
};

export default function SystemPage() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [active, setActive] = useState<DangerAction | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function load() {
    const [m, a] = await Promise.all([
      fetch("/api/admin/maintenance").then((r) => r.json()),
      fetch("/api/admin/audit?limit=50").then((r) => r.json()),
    ]);
    if (m.counts) setCounts(m.counts);
    if (a.entries) setAudit(a.entries);
  }
  useEffect(() => {
    load();
  }, []);

  const DANGER: DangerAction[] = [
    {
      key: "clear_incomplete_sessions",
      phrase: "CLEAR",
      title: "Clear incomplete sessions",
      description:
        "Remove assessment sessions that were started but never finished (and their responses). Completed sessions and reports are kept.",
      impact: (c) => `${c.incomplete} incomplete session${c.incomplete === 1 ? "" : "s"}`,
      cta: "Clear incomplete",
    },
    {
      key: "reset_learner_history",
      phrase: "RESET",
      title: "Reset all learner history",
      description:
        "Permanently delete every student, session, response, and mastery record. The question bank, staff accounts, settings, and this audit log are untouched. Use to clear test data before going live.",
      impact: (c) =>
        `${c.students} students · ${c.sessions} sessions · ${c.responses} responses · ${c.bkt} mastery records`,
      cta: "Reset everything",
    },
  ];

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  return (
    <div className="animate-fade-up mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">System & Audit</h1>
          <p className="mt-1 text-sm text-slate-400">
            High-level data controls and a record of every privileged action.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {toast && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
          {toast}
        </p>
      )}

      {/* Data snapshot */}
      <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-wider text-slate-500">
          <Database className="h-4 w-4 text-slate-400" /> Data snapshot
        </h2>
        {!counts ? (
          <div className="mt-4 flex items-center gap-2 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="Students" value={counts.students} />
            <Stat label="Sessions" value={counts.sessions} />
            <Stat label="Incomplete" value={counts.incomplete} />
            <Stat label="Responses" value={counts.responses} />
            <Stat label="Mastery rows" value={counts.bkt} />
            <Stat label="Audit entries" value={counts.audit} />
          </div>
        )}
      </section>

      {/* Danger zone */}
      <section className="mt-6 rounded-3xl border border-rose-200 bg-rose-50/40 p-6">
        <h2 className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-wider text-rose-600">
          <ShieldAlert className="h-4 w-4" /> Danger zone
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          These actions are irreversible and require typing a confirmation phrase.
        </p>
        <div className="mt-4 space-y-3">
          {DANGER.map((a) => (
            <div
              key={a.key}
              className="flex flex-col gap-3 rounded-2xl border border-rose-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{a.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{a.description}</p>
                {counts && (
                  <p className="mt-1.5 text-xs font-semibold text-rose-600">
                    Will affect: {a.impact(counts)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setActive(a)}
                className="flex shrink-0 items-center gap-2 self-start rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 sm:self-center"
              >
                <Trash2 className="h-4 w-4" /> {a.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Audit log */}
      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <h2 className="flex items-center gap-2.5 border-b border-slate-100 px-6 py-4 text-sm font-bold uppercase tracking-wider text-slate-500">
          <History className="h-4 w-4 text-slate-400" /> Audit log
        </h2>
        {!audit ? (
          <div className="flex items-center gap-2 p-6 text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : audit.length === 0 ? (
          <p className="p-6 text-sm text-slate-400">No actions recorded yet.</p>
        ) : (
          <div className="max-h-[28rem] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                  <th className="px-6 py-3">When</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-6 py-3">Detail</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0 align-top">
                    <td className="px-6 py-3 whitespace-nowrap text-xs text-slate-500">
                      {new Date(e.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-slate-700">{e.actorEmail}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${
                          ACTION_BADGE[e.action] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {e.action}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-slate-500">
                      {e.target && <span className="font-semibold text-slate-700">{e.target}</span>}
                      {e.target && e.detail ? " — " : ""}
                      {e.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {active && (
        <ConfirmModal
          action={active}
          onClose={() => setActive(null)}
          onDone={(detail) => {
            setActive(null);
            flash(detail);
            load();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-xl font-bold text-slate-900 tabular-nums">{value}</p>
    </div>
  );
}

function ConfirmModal({
  action,
  onClose,
  onDone,
}: {
  action: DangerAction;
  onClose: () => void;
  onDone: (detail: string) => void;
}) {
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEscapeKey(onClose);

  async function run() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: action.key, confirm }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error ?? "Action failed");
    onDone(d.detail ?? "Done");
  }

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-pop w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="flex items-center gap-2.5 text-lg font-bold text-rose-700">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          {action.title}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">{action.description}</p>
        <p className="mt-4 text-sm font-medium text-slate-700">
          Type <span className="rounded bg-rose-100 px-1.5 py-0.5 font-mono font-bold text-rose-700">{action.phrase}</span> to confirm.
        </p>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={action.phrase}
          autoFocus
          className="mt-2 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-mono text-sm"
        />
        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3.5 py-2 text-sm text-rose-700">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={run}
            disabled={busy || confirm !== action.phrase}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} {action.cta}
          </button>
        </div>
      </div>
    </div>
  );
}
