"use client";

// Content Management Portal shell: author-only surface (Admin or Editor),
// separate from the analytics admin dashboard.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookMarked,
  BookOpen,
  Boxes,
  FileSpreadsheet,
  Layers,
  LayoutGrid,
  LibraryBig,
  LogOut,
  Network,
} from "lucide-react";
import { ContentContext, type ContentUser } from "./content-context";

const NAV = [
  { href: "/content", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/content/syllabus", label: "Syllabus", icon: Layers },
  { href: "/content/curriculum", label: "Curriculum", icon: BookMarked },
  { href: "/content/skills", label: "Skills & Graph", icon: Network },
  { href: "/content/questions", label: "Questions", icon: LibraryBig },
  { href: "/content/import", label: "Import / Export", icon: FileSpreadsheet },
];

export default function ContentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<ContentUser | null>(null);
  const [checked, setChecked] = useState(false);
  const isLogin = pathname === "/content/login";

  useEffect(() => {
    if (isLogin) {
      setChecked(true);
      return;
    }
    fetch("/api/content/me")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = await r.json();
        setUser(d.user);
      })
      .catch(() => router.replace("/content/login"))
      .finally(() => setChecked(true));
  }, [pathname, isLogin, router]);

  if (isLogin) return <>{children}</>;
  if (!checked || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50/70">
        <div className="animate-scale-in flex flex-col items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-200">
            <Boxes className="h-7 w-7 animate-pulse" />
          </span>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            Opening the studio…
          </div>
        </div>
      </main>
    );
  }

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/content/login");
  }

  const initials = (user.name ?? user.email)
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <ContentContext.Provider value={user}>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-200">
              <Boxes className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-lg leading-tight font-bold text-slate-900">
                Content Studio
              </p>
              <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                Zarban CMS
              </p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1 p-3">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  {active && (
                    <span className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-emerald-500 to-teal-600" />
                  )}
                  <item.icon
                    className={`h-[18px] w-[18px] transition ${
                      active ? "text-emerald-600" : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {user.name ?? user.email}
                </p>
                <span className="inline-block rounded-full bg-emerald-100 px-2 py-px text-[10px] font-bold tracking-wide text-emerald-700 uppercase">
                  {user.role}
                </span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between px-1">
              <a
                href="/admin"
                className="flex items-center gap-1 text-xs font-medium text-slate-400 transition hover:text-emerald-600"
              >
                <BookOpen className="h-3 w-3" /> Admin
              </a>
              <button
                onClick={logout}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-rose-500 transition hover:bg-rose-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 bg-slate-50/80 p-8">{children}</main>
      </div>
    </ContentContext.Provider>
  );
}
