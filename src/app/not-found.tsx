import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-6">
      <div className="bg-dot-grid absolute inset-0 opacity-40" />
      <div className="animate-blob absolute -top-24 -left-24 h-80 w-80 rounded-full bg-indigo-200/50 blur-3xl" />
      <div className="animate-blob-slow absolute -right-24 -bottom-24 h-96 w-96 rounded-full bg-violet-200/50 blur-3xl" />

      <div className="animate-fade-up relative max-w-md rounded-3xl border border-white/60 bg-white/85 p-10 text-center shadow-xl shadow-indigo-100/60 backdrop-blur">
        <p className="font-display bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-7xl font-bold text-transparent">
          404
        </p>
        <h1 className="mt-4 font-display text-xl font-bold text-slate-900">
          This page wandered off.
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          The link may be broken or the page may have moved.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-110"
          >
            Back to start
          </Link>
          <Link
            href="/admin"
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
          >
            Admin dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
