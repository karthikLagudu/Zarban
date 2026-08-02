"use client";

// Database manager (Admin only): browse every table in the D1 database, search
// and page through rows, and edit or delete individual rows. Every write goes
// through /api/admin/db and is recorded in the audit log.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Database,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { useEscapeKey } from "@/lib/use-escape";

interface ColumnInfo {
  name: string;
  type: string;
  notnull: boolean;
  pk: boolean;
}
interface TableSummary {
  name: string;
  rows: number;
}
interface RowsResult {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  ridKey: string;
}

const PAGE_SIZE = 50;

export default function DatabasePage() {
  const [tables, setTables] = useState<TableSummary[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [data, setData] = useState<RowsResult | null>(null);
  const [loadingRows, setLoadingRows] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // debounced/applied search
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [deleting, setDeleting] = useState<Record<string, unknown> | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  };

  const loadTables = useCallback(async () => {
    const r = await fetch("/api/admin/db").then((x) => x.json());
    if (r.tables) setTables(r.tables);
  }, []);

  const loadRows = useCallback(
    async (table: string, pg: number, q: string) => {
      setLoadingRows(true);
      const url = `/api/admin/db/${encodeURIComponent(table)}?page=${pg}&pageSize=${PAGE_SIZE}&search=${encodeURIComponent(q)}`;
      const r = await fetch(url).then((x) => x.json());
      setLoadingRows(false);
      if (r.error) return flash(r.error);
      setData(r);
    },
    []
  );

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (selected) loadRows(selected, page, query);
  }, [selected, page, query, loadRows]);

  function selectTable(name: string) {
    setSelected(name);
    setPage(1);
    setSearch("");
    setQuery("");
    setData(null);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display flex items-center gap-2.5 text-2xl font-bold text-slate-900">
            <Database className="h-6 w-6 text-indigo-500" /> Database
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Browse and manage every table in the live database. Changes are immediate and audited.
          </p>
        </div>
        <button
          onClick={() => {
            loadTables();
            if (selected) loadRows(selected, page, query);
          }}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {toast && (
        <p className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Table list */}
        <aside className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="px-3 py-2 text-[10px] font-bold tracking-widest text-slate-300 uppercase">
            Tables {tables && `· ${tables.length}`}
          </p>
          {!tables ? (
            <div className="space-y-2 p-1">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="skeleton h-9 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="flex max-h-[70vh] flex-col gap-0.5 overflow-y-auto">
              {tables.map((t) => {
                const active = t.name === selected;
                return (
                  <button
                    key={t.name}
                    onClick={() => selectTable(t.name)}
                    className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                      active
                        ? "bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Table2 className={`h-4 w-4 shrink-0 ${active ? "text-indigo-500" : "text-slate-300"}`} />
                      <span className="truncate font-mono text-[13px]">{t.name}</span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${
                        active ? "bg-white text-indigo-600" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {t.rows.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Row viewer */}
        <section className="min-w-0">
          {!selected ? (
            <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <Database className="h-10 w-10 text-slate-200" />
              <p className="mt-3 font-semibold text-slate-500">Pick a table to browse</p>
              <p className="mt-1 text-sm text-slate-400">
                Every row is editable and deletable. Actions are logged in System &amp; Audit.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div className="min-w-0">
                  <h2 className="font-mono text-sm font-bold text-slate-800">{selected}</h2>
                  <p className="text-xs text-slate-400">
                    {data ? `${data.total.toLocaleString()} rows · ${data.columns.length} columns` : "…"}
                  </p>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPage(1);
                    setQuery(search);
                  }}
                  className="flex items-center gap-2"
                >
                  <div className="relative">
                    <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-300" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search rows…"
                      className="w-56 rounded-xl border border-slate-200 py-2 pr-3 pl-9 text-sm focus:border-indigo-300 focus:outline-none"
                    />
                  </div>
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearch("");
                        setQuery("");
                        setPage(1);
                      }}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                      title="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </form>
              </div>

              {/* Grid */}
              {loadingRows && !data ? (
                <div className="space-y-2 p-5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="skeleton h-9 rounded-lg" />
                  ))}
                </div>
              ) : !data || data.rows.length === 0 ? (
                <p className="p-10 text-center text-sm text-slate-400">
                  {query ? "No rows match your search." : "This table is empty."}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/60 text-xs tracking-wider text-slate-400 uppercase">
                        <th className="sticky left-0 z-10 bg-slate-50/60 px-3 py-3" />
                        {data.columns.map((c) => (
                          <th key={c.name} className="px-4 py-3 font-semibold whitespace-nowrap">
                            <span className="flex items-center gap-1.5">
                              {c.name}
                              {c.pk && (
                                <span className="rounded bg-amber-100 px-1 py-px text-[9px] font-bold text-amber-700">
                                  PK
                                </span>
                              )}
                              <span className="font-normal text-slate-300 normal-case">{c.type}</span>
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-indigo-50/30">
                          <td className="sticky left-0 z-10 bg-white px-3 py-2">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setEditing(row)}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-indigo-100 hover:text-indigo-600"
                                title="Edit row"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => setDeleting(row)}
                                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-100 hover:text-rose-600"
                                title="Delete row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                          {data.columns.map((c) => (
                            <td key={c.name} className="max-w-xs px-4 py-2 align-top">
                              <Cell value={row[c.name]} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {data && data.total > 0 && (
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
                  <span className="tabular-nums">
                    Page {data.page} of {totalPages}
                    {loadingRows && <Loader2 className="ml-2 inline h-3.5 w-3.5 animate-spin text-indigo-400" />}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={data.page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      disabled={data.page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold transition hover:bg-slate-50 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {editing && selected && (
        <EditModal
          table={selected}
          columns={data!.columns}
          row={editing}
          ridKey={data!.ridKey}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            flash("Row updated");
            loadRows(selected, page, query);
          }}
        />
      )}
      {deleting && selected && (
        <DeleteModal
          table={selected}
          row={deleting}
          columns={data!.columns}
          ridKey={data!.ridKey}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            flash("Row deleted");
            loadTables();
            loadRows(selected, page, query);
          }}
        />
      )}
    </div>
  );
}

function fmt(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function Cell({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-slate-300 italic">null</span>;
  }
  const text = fmt(value);
  return (
    <span
      className="block max-w-xs truncate font-mono text-[13px] text-slate-700"
      title={text}
    >
      {text || <span className="text-slate-300">·</span>}
    </span>
  );
}

function EditModal({
  table,
  columns,
  row,
  ridKey,
  onClose,
  onSaved,
}: {
  table: string;
  columns: ColumnInfo[];
  row: Record<string, unknown>;
  ridKey: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(columns.map((c) => [c.name, fmt(row[c.name])]))
  );
  const [nulls, setNulls] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(columns.map((c) => [c.name, row[c.name] === null]))
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscapeKey(onClose);

  async function save() {
    setBusy(true);
    setError(null);
    const values: Record<string, unknown> = {};
    for (const c of columns) values[c.name] = nulls[c.name] ? null : form[c.name];
    const r = await fetch(`/api/admin/db/${encodeURIComponent(table)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowid: row[ridKey], values }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error ?? "Update failed");
    onSaved();
  }

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h2 className="flex items-center gap-2 font-bold text-slate-800">
          <Pencil className="h-4 w-4 text-indigo-500" /> Edit row ·{" "}
          <span className="font-mono text-sm">{table}</span>
        </h2>
        <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-5">
        {columns.map((c) => (
          <div key={c.name}>
            <label className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="font-mono">{c.name}</span>
                {c.pk && (
                  <span className="rounded bg-amber-100 px-1 py-px text-[9px] font-bold text-amber-700">
                    PK
                  </span>
                )}
                <span className="font-normal text-slate-300">{c.type}</span>
              </span>
              {!c.notnull && (
                <label className="flex cursor-pointer items-center gap-1 text-[11px] font-medium text-slate-400">
                  <input
                    type="checkbox"
                    checked={nulls[c.name]}
                    onChange={(e) => setNulls((n) => ({ ...n, [c.name]: e.target.checked }))}
                  />
                  null
                </label>
              )}
            </label>
            <input
              value={nulls[c.name] ? "" : form[c.name]}
              disabled={nulls[c.name]}
              onChange={(e) => setForm((f) => ({ ...f, [c.name]: e.target.value }))}
              placeholder={nulls[c.name] ? "null" : ""}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-indigo-300 focus:outline-none disabled:bg-slate-50 disabled:text-slate-300"
            />
          </div>
        ))}
      </div>
      {error && (
        <p className="mx-6 rounded-lg bg-rose-50 px-3.5 py-2 text-sm text-rose-700">{error}</p>
      )}
      <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
          Cancel
        </button>
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
        </button>
      </div>
    </Overlay>
  );
}

function DeleteModal({
  table,
  row,
  columns,
  ridKey,
  onClose,
  onDeleted,
}: {
  table: string;
  row: Record<string, unknown>;
  columns: ColumnInfo[];
  ridKey: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEscapeKey(onClose);

  const label = columns.slice(0, 3).map((c) => `${c.name}=${fmt(row[c.name]) || "∅"}`).join(" · ");

  async function run() {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/db/${encodeURIComponent(table)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rowid: row[ridKey] }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error ?? "Delete failed");
    onDeleted();
  }

  return (
    <Overlay onClose={onClose} narrow>
      <div className="p-7">
        <h2 className="flex items-center gap-2.5 text-lg font-bold text-rose-700">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          Delete this row?
        </h2>
        <p className="mt-4 text-sm text-slate-600">
          Permanently delete one row from <span className="font-mono font-semibold">{table}</span>. This
          cannot be undone.
        </p>
        <p className="mt-2 truncate rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs text-slate-500" title={label}>
          {label}
        </p>
        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3.5 py-2 text-sm text-rose-700">{error}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={run}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-rose-700 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Delete row
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({
  children,
  onClose,
  narrow,
}: {
  children: React.ReactNode;
  onClose: () => void;
  narrow?: boolean;
}) {
  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`animate-pop w-full ${narrow ? "max-w-md" : "max-w-lg"} overflow-hidden rounded-3xl bg-white shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
