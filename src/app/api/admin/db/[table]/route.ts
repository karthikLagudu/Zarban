// Per-table data access for the admin Database manager (Admin only).
//   GET    ?page&pageSize&search  → a page of rows + column metadata
//   PATCH  { rowid, values }      → update one row
//   DELETE { rowid }              → delete one row
// Every write is recorded in the audit log. Identifiers are validated against
// the live schema in db-admin; values are always bound as parameters.
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { deleteRow, fetchRows, updateRow } from "@/lib/admin/db-admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const { table } = await params;
  const sp = req.nextUrl.searchParams;
  try {
    const result = await fetchRows(table, {
      page: Number(sp.get("page") ?? 1),
      pageSize: Number(sp.get("pageSize") ?? 50),
      search: sp.get("search") ?? undefined,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const { table } = await params;
  const body = await req.json().catch(() => ({}));
  const rowid = Number(body.rowid);
  const values = body.values;
  if (!Number.isFinite(rowid) || typeof values !== "object" || values === null) {
    return NextResponse.json({ error: "rowid and values are required" }, { status: 400 });
  }
  try {
    const n = await updateRow(table, rowid, values as Record<string, unknown>);
    await logAudit(
      auth.session,
      "db.update_row",
      `${table}#${rowid}`,
      Object.keys(values).join(", ")
    );
    return NextResponse.json({ updated: n });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ table: string }> }
) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const { table } = await params;
  const body = await req.json().catch(() => ({}));
  const rowid = Number(body.rowid);
  if (!Number.isFinite(rowid)) {
    return NextResponse.json({ error: "rowid is required" }, { status: 400 });
  }
  try {
    const n = await deleteRow(table, rowid);
    await logAudit(auth.session, "db.delete_row", `${table}#${rowid}`, null);
    return NextResponse.json({ deleted: n });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Delete failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
