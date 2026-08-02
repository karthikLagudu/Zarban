// GET /api/admin/db — list every table with its row count (Admin only).
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { listTables } from "@/lib/admin/db-admin";

export async function GET() {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  try {
    const tables = await listTables();
    return NextResponse.json({
      tables,
      totalRows: tables.reduce((a, t) => a + t.rows, 0),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to read schema";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
