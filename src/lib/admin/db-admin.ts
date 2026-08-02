// Generic read/write access to the underlying D1 (SQLite) tables for the admin
// Database manager. SECURITY: table and column identifiers are ALWAYS validated
// against the live schema before being interpolated into SQL, and every row
// value is ALWAYS bound as a parameter — never interpolated. Rows are addressed
// by SQLite's implicit `rowid`, so edit/delete work uniformly even on tables
// with composite primary keys.

import { prisma } from "@/lib/db";

// Infrastructure tables — real data lives elsewhere; keep these out of the UI.
const HIDDEN = new Set(["sqlite_sequence", "_cf_KV", "d1_migrations", "_cf_METADATA"]);

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
function quoteIdent(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Illegal identifier: ${name}`);
  return `"${name}"`;
}

export interface ColumnInfo {
  name: string;
  type: string;
  notnull: boolean;
  pk: boolean;
}

export interface TableSummary {
  name: string;
  rows: number;
}

export interface RowsResult {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  ridKey: string; // property on each row that holds its rowid
}

const RID = "_rid_";

/** Make a raw D1 row safe to JSON-serialize (BigInt, blobs). */
function jsonSafe(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "bigint") out[k] = Number.isSafeInteger(Number(v)) ? Number(v) : v.toString();
    else if (v instanceof Uint8Array) out[k] = `‹blob ${v.byteLength}B›`;
    else out[k] = v;
  }
  return out;
}

/** Manageable user tables, name-sorted. */
export async function listTableNames(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<{ name: string }[]>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  return rows.map((r) => r.name).filter((n) => !HIDDEN.has(n));
}

/** Throw unless `table` is a real, manageable table; returns the safe name. */
export async function assertTable(table: string): Promise<string> {
  if (!(await listTableNames()).includes(table)) throw new Error(`Unknown table: ${table}`);
  return table;
}

export async function columnsOf(table: string): Promise<ColumnInfo[]> {
  const rows = await prisma.$queryRawUnsafe<
    { name: string; type: string; notnull: number | bigint; pk: number | bigint }[]
  >(`SELECT name, type, "notnull", pk FROM pragma_table_info(${quoteIdent(table)})`);
  return rows.map((r) => ({
    name: r.name,
    type: r.type,
    notnull: Number(r.notnull) > 0,
    pk: Number(r.pk) > 0,
  }));
}

/** All tables with their row counts (counts run in parallel). */
export async function listTables(): Promise<TableSummary[]> {
  const names = await listTableNames();
  return Promise.all(
    names.map(async (name) => {
      const r = await prisma.$queryRawUnsafe<{ c: number | bigint }[]>(
        `SELECT COUNT(*) AS c FROM ${quoteIdent(name)}`
      );
      return { name, rows: Number(r[0]?.c ?? 0) };
    })
  );
}

/** A page of rows for a table, optionally text-searched across all columns. */
export async function fetchRows(
  table: string,
  opts: { page?: number; pageSize?: number; search?: string }
): Promise<RowsResult> {
  await assertTable(table);
  const columns = await columnsOf(table);
  const qt = quoteIdent(table);
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(opts.pageSize ?? 50)));
  const offset = (page - 1) * pageSize;

  const params: unknown[] = [];
  let whereSql = "";
  const search = opts.search?.trim();
  if (search) {
    const clauses = columns.map((c) => `CAST(${quoteIdent(c.name)} AS TEXT) LIKE ?`);
    for (const _c of columns) params.push(`%${search}%`);
    whereSql = ` WHERE (${clauses.join(" OR ")})`;
  }

  const countRes = await prisma.$queryRawUnsafe<{ c: number | bigint }[]>(
    `SELECT COUNT(*) AS c FROM ${qt}${whereSql}`,
    ...params
  );
  const total = Number(countRes[0]?.c ?? 0);

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT rowid AS ${RID}, * FROM ${qt}${whereSql} ORDER BY rowid LIMIT ? OFFSET ?`,
    ...params,
    pageSize,
    offset
  );
  return { columns, rows: rows.map(jsonSafe), total, page, pageSize, ridKey: RID };
}

function coerce(v: unknown): unknown {
  if (typeof v === "boolean") return v ? 1 : 0; // SQLite stores booleans as 0/1
  return v; // strings/numbers/null pass through; column affinity handles casts
}

/** Update one row (addressed by rowid). Only real columns are written. */
export async function updateRow(
  table: string,
  rowid: number,
  values: Record<string, unknown>
): Promise<number> {
  await assertTable(table);
  const valid = new Set((await columnsOf(table)).map((c) => c.name));
  const entries = Object.entries(values).filter(([k]) => valid.has(k) && k !== RID);
  if (entries.length === 0) return 0;
  const setSql = entries.map(([k]) => `${quoteIdent(k)} = ?`).join(", ");
  const params = [...entries.map(([, v]) => coerce(v)), rowid];
  return prisma.$executeRawUnsafe(
    `UPDATE ${quoteIdent(table)} SET ${setSql} WHERE rowid = ?`,
    ...params
  );
}

/** Delete one row (addressed by rowid). Returns affected count. */
export async function deleteRow(table: string, rowid: number): Promise<number> {
  await assertTable(table);
  return prisma.$executeRawUnsafe(`DELETE FROM ${quoteIdent(table)} WHERE rowid = ?`, rowid);
}
