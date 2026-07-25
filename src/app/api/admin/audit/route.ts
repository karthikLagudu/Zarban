// GET /api/admin/audit — recent privileged actions (Admin only).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const limit = Math.min(
    Math.max(parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10) || 50, 1),
    200
  );
  const entries = await prisma.adminAuditLog.findMany({
    orderBy: { id: "desc" },
    take: limit,
  });
  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      actorEmail: e.actorEmail,
      action: e.action,
      target: e.target,
      detail: e.detail,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
