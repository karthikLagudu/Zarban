"use client";

// User & Access Management (Admin only): create staff accounts, change roles,
// reset passwords, and remove accounts — with guardrails enforced server-side
// (can't delete yourself or the last Admin).

import { useEffect, useState } from "react";
import { KeyRound, Loader2, ShieldCheck, Trash2, UserPlus, X } from "lucide-react";
import { useAdmin } from "../admin-context";

type Role = "Admin" | "Teacher" | "Viewer" | "Editor";
const ROLES: Role[] = ["Admin", "Teacher", "Viewer", "Editor"];

interface User {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  createdAt: string;
}

const ROLE_BADGE: Record<Role, string> = {
  Admin: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  Teacher: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  Viewer: "bg-slate-200 text-slate-600 ring-slate-300",
  Editor: "bg-amber-100 text-amber-700 ring-amber-200",
};

const ROLE_HELP: Record<Role, string> = {
  Admin: "Full control — dashboards, settings, accounts, data.",
  Teacher: "Read dashboards, students, analytics, replays.",
  Viewer: "Read-only dashboard access.",
  Editor: "Content Studio only — author questions & skills.",
};

export default function UsersPage() {
  const me = useAdmin();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [resetFor, setResetFor] = useState<User | null>(null);

  async function load() {
    const r = await fetch("/api/admin/users");
    const d = await r.json();
    if (!r.ok) return setError(d.error ?? "Failed to load users");
    setUsers(d.users);
  }
  useEffect(() => {
    load();
  }, []);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function changeRole(u: User, role: Role) {
    setError(null);
    const r = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const d = await r.json();
    if (!r.ok) return setError(d.error ?? "Could not change role");
    flash(`${u.email} is now ${role}`);
    load();
  }

  async function remove(u: User) {
    if (!confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    setError(null);
    const r = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
    const d = await r.json();
    if (!r.ok) return setError(d.error ?? "Could not delete user");
    flash(`${u.email} removed`);
    load();
  }

  return (
    <div className="animate-fade-up mx-auto max-w-4xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">User & Access Management</h1>
          <p className="mt-1 text-sm text-slate-400">
            Staff accounts and their roles. Changes take effect on next sign-in.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700"
        >
          <UserPlus className="h-4 w-4" /> New account
        </button>
      </div>

      {/* Role legend */}
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ROLES.map((r) => (
          <div key={r} className="rounded-2xl border border-slate-200 bg-white p-3.5">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${ROLE_BADGE[r]}`}>
              {r}
            </span>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{ROLE_HELP[r]}</p>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-rose-100">
          {error}
        </p>
      )}
      {toast && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 ring-1 ring-emerald-100">
          {toast}
        </p>
      )}

      {/* Users table */}
      <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {!users ? (
          <div className="flex items-center gap-3 p-8 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading accounts…
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
                <th className="px-6 py-3">Account</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSelf = u.email === me?.email;
                return (
                  <tr key={u.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                          {(u.name ?? u.email).slice(0, 2).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">
                            {u.name ?? "—"}
                            {isSelf && (
                              <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
                                YOU
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <select
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value as Role)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ring-1 ${ROLE_BADGE[u.role]}`}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setResetFor(u)}
                          title="Reset password"
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                        >
                          <KeyRound className="h-3.5 w-3.5" /> Reset
                        </button>
                        <button
                          onClick={() => remove(u)}
                          disabled={isSelf}
                          title={isSelf ? "You can't delete yourself" : "Delete account"}
                          className="flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={(email) => {
            setShowCreate(false);
            flash(`Account ${email} created`);
            load();
          }}
        />
      )}
      {resetFor && (
        <ResetModal
          user={resetFor}
          onClose={() => setResetFor(null)}
          onDone={(email) => {
            setResetFor(null);
            flash(`Password reset for ${email}`);
          }}
        />
      )}
    </div>
  );
}

// ── Create-account modal ─────────────────────────────────────────────────────
function CreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("Viewer");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, role, password }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error ?? "Could not create account");
    onCreated(d.user.email);
  }

  return (
    <Modal title="Create staff account" icon={UserPlus} onClose={onClose}>
      <div className="grid gap-3">
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@school.org"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </Field>
        <Field label="Full name (optional)">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </Field>
        <Field label="Role">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r} — {ROLE_HELP[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Temporary password (min 6 chars)">
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Share this with the user"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
          />
        </Field>
      </div>
      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3.5 py-2 text-sm text-rose-700">{error}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create account
        </button>
      </div>
    </Modal>
  );
}

// ── Reset-password modal ─────────────────────────────────────────────────────
function ResetModal({
  user,
  onClose,
  onDone,
}: {
  user: User;
  onClose: () => void;
  onDone: (email: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error ?? "Could not reset password");
    onDone(user.email);
  }

  return (
    <Modal title={`Reset password`} icon={KeyRound} onClose={onClose}>
      <p className="text-sm text-slate-500">
        Set a new password for <span className="font-semibold text-slate-800">{user.email}</span>.
      </p>
      <input
        type="text"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="New password (min 6 chars)"
        className="mt-3 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
      />
      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3.5 py-2 text-sm text-rose-700">{error}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Set password
        </button>
      </div>
    </Modal>
  );
}

// ── Shared bits ──────────────────────────────────────────────────────────────
function Modal({
  title,
  icon: Icon,
  onClose,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="animate-pop w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2.5 text-lg font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
              <Icon className="h-4.5 w-4.5" />
            </span>
            {title}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
        <ShieldCheck className="h-3.5 w-3.5 text-slate-300" /> {label}
      </span>
      {children}
    </label>
  );
}
