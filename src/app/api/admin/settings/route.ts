// GET/PUT /api/admin/settings — assessment configuration.
//   max_questions      — session ends after this many model questions.
//   test_timer_minutes — overall time limit in minutes (0 = no limit).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { invalidateSettings } from "@/lib/engine/cache";

// Each key with the clamp applied when it is saved.
const KEYS: Record<string, { min: number; max: number }> = {
  max_questions: { min: 5, max: 100 },
  test_timer_minutes: { min: 0, max: 180 },
};

export async function GET() {
  const auth = await requireRole("Viewer");
  if ("error" in auth) return auth.error;
  const settings = await prisma.setting.findMany({
    where: { key: { in: Object.keys(KEYS) } },
  });
  return NextResponse.json({
    settings: Object.fromEntries(settings.map((s) => [s.key, s.value])),
  });
}

export async function PUT(req: NextRequest) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const updated: Record<string, string> = {};
  const changes: string[] = [];
  for (const [key, { min, max }] of Object.entries(KEYS)) {
    if (body[key] !== undefined) {
      const n = parseInt(String(body[key]), 10);
      const clamped = Math.min(Math.max(Number.isFinite(n) ? n : min, min), max);
      const value = String(clamped);
      await prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
      updated[key] = value;
      changes.push(`${key}=${value}`);
    }
  }
  if (changes.length) {
    invalidateSettings(); // take effect immediately, not after the cache TTL
    await logAudit(auth.session, "settings.update", null, changes.join(", "));
  }
  return NextResponse.json({ updated });
}
