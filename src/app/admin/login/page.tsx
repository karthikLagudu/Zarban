"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GraduationCap, Loader2, Lock, Mail } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Login failed");
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="bg-dot-grid absolute inset-0 opacity-40" />
      <div className="animate-blob absolute -top-24 -left-24 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl" />
      <div className="animate-blob-slow absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl" />

      <form
        onSubmit={login}
        className="animate-fade-up relative w-full max-w-sm rounded-3xl border border-white/60 bg-white/85 p-8 shadow-xl shadow-indigo-100/60 backdrop-blur"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900">
              Admin sign-in
            </h1>
            <p className="text-xs text-slate-400">
              Role-based access · Admin, Teacher, Viewer
            </p>
          </div>
        </div>

        <label className="mt-7 grid gap-1.5">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@zarban.local"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </div>
        </label>
        <label className="mt-4 grid gap-1.5">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-4 pl-10 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            />
          </div>
        </label>

        {error && (
          <p className="mt-4 rounded-xl bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
        <p className="mt-4 text-center text-xs text-slate-400">
          Demo: admin@zarban.local / admin123
        </p>
      </form>
    </main>
  );
}
