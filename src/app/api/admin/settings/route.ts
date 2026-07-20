// GET/PUT /api/admin/settings — timer + max question configuration.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

const KEYS = ["max_questions"];

export async function GET() {
  const auth = await requireRole("Viewer");
  if ("error" in auth) return auth.error;
  const settings = await prisma.setting.findMany({ where: { key: { in: KEYS } } });
  return NextResponse.json({
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const updated: Record<string, string> = {};
  for (const key of KEYS) {
    if (body[key] !== undefined) {
      const value = String(parseInt(String(body[key]), 10) || 0);
      await prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
      updated[key] = value;
    }
  }
  return NextResponse.json({ updated });
}
