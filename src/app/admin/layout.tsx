"use client";

// Admin shell: sidebar navigation + auth guard (RBAC roles from the JWT).

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  ChartLine,
  FileSpreadsheet,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  Library,
  LibraryBig,
  LogOut,
  Network,
  School,
  Settings,
  ShieldAlert,
  UserCog,
  Users,
} from "lucide-react";
import { AdminContext, type AdminUser } from "./admin-context";

type Access = "any" | "admin" | "content"; // content = Admin or Editor

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  external?: boolean; // leaves the admin console (into the Content Studio)
}

interface NavGroup {
  label: string;
  access: Access;
  items: NavItem[];
}

// One console that reaches every surface. Admin sees all three groups; Teacher
// and Viewer see Analytics; Editor additionally sees Content Studio.
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Analytics",
    access: "any",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
      { href: "/admin/students", label: "Students", icon: Users },
      { href: "/admin/classrooms", label: "Classrooms", icon: School },
      { href: "/admin/analytics", label: "Cohort Analytics", icon: ChartLine },
      { href: "/admin/questions", label: "Question Bank", icon: Library },
      { href: "/admin/syllabus", label: "Syllabus", icon: Layers },
    ],
  },
  {
    label: "Administration",
    access: "admin",
    items: [
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/users", label: "User Access", icon: UserCog },
      { href: "/admin/system", label: "System & Audit", icon: ShieldAlert },
    ],
  },
  {
    label: "Content Studio",
    access: "content",
    items: [
      { href: "/content", label: "Overview", icon: LayoutGrid, external: true },
      { href: "/content/skills", label: "Skills & Graph", icon: Network, external: true },
      { href: "/content/questions", label: "Questions", icon: LibraryBig, external: true },
      { href: "/content/import", label: "Import / Export", icon: FileSpreadsheet, external: true },
    ],
  },
];

function canSee(access: Access, role: string): boolean {
  if (access === "any") return true;
  if (access === "admin") return role === "Admin";
  return role === "Admin" || role === "Editor"; // content
}

const ROLE_BADGE: Record<string, string> = {
  Admin: "bg-indigo-100 text-indigo-700",
  Teacher: "bg-emerald-100 text-emerald-700",
  Viewer: "bg-slate-200 text-slate-600",
  Editor: "bg-amber-100 text-amber-700",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (isLogin) {
      setChecked(true);
      return;
    }
    fetch("/api/admin/auth/me")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const data = await r.json();
        setUser(data.user);
      })
      .catch(() => router.replace("/admin/login"))
      .finally(() => setChecked(true));
  }, [pathname, isLogin, router]);

  if (isLogin) return <>{children}</>;
  if (!checked || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50/70">
        <div className="animate-scale-in flex flex-col items-center gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200">
            <GraduationCap className="h-7 w-7 animate-pulse" />
          </span>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
            Preparing your console…
          </div>
        </div>
      </main>
    );
  }

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  const initials = (user.name ?? user.email)
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <AdminContext.Provider value={user}>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white">
          {/* Brand */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-200">
              <GraduationCap className="h-5 w-5" />
            </span>
            <div>
              <p className="font-display text-lg leading-tight font-bold text-slate-900">
                Zarban
              </p>
              <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                Admin Console
              </p>
            </div>
          </div>

          {/* Nav — grouped so an Admin reaches every surface from one console */}
          <nav className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
            {NAV_GROUPS.filter((g) => canSee(g.access, user.role)).map((group) => (
              <div key={group.label} className="flex flex-col gap-1">
                <p className="px-3.5 pb-1 text-[10px] font-bold tracking-widest text-slate-300 uppercase">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const active =
                    !item.external &&
                    (item.exact ? pathname === item.href : pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                        active
                          ? "bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                      }`}
                    >
                      {active && (
                        <span className="absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-indigo-500 to-violet-600" />
                      )}
                      <item.icon
                        className={`h-[18px] w-[18px] transition ${
                          active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                        }`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.external && (
                        <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 transition group-hover:text-slate-500" />
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* User */}
          <div className="border-t border-slate-100 p-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                {initials}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {user.name ?? user.email}
                </p>
                <span
                  className={`inline-block rounded-full px-2 py-px text-[10px] font-bold tracking-wide uppercase ${ROLE_BADGE[user.role]}`}
                >
                  {user.role}
                </span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between px-1">
              <a
                href="/"
                className="text-xs font-medium text-slate-400 transition hover:text-indigo-600"
              >
                ← Student site
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
    </AdminContext.Provider>
  );
}
