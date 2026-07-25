// GET/POST /api/admin/maintenance — data-maintenance controls (Admin only).
//
// GET  returns live counts so the UI can show what a reset would remove.
// POST performs a destructive action, gated behind a typed confirmation phrase.
// Curriculum (skills/questions/traps), staff accounts, settings, and the audit
// trail are never touched here.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const [students, sessions, incomplete, responses, bkt, audit] = await Promise.all([
    prisma.student.count(),
    prisma.assessmentSession.count(),
    prisma.assessmentSession.count({ where: { status: { not: "completed" } } }),
    prisma.response.count(),
    prisma.bktState.count(),
    prisma.adminAuditLog.count(),
  ]);
  return NextResponse.json({
    counts: { students, sessions, incomplete, responses, bkt, audit },
  });
}

// Delete the session-scoped tables for a set of session ids (explicit order so
// it works regardless of how the connector emulates ON DELETE CASCADE).
async function purgeSessions(where: object) {
  const ids = (
    await prisma.assessmentSession.findMany({ where, select: { sessionId: true } })
  ).map((s) => s.sessionId);
  if (ids.length === 0) return 0;
  const sessionId = { in: ids };
  await prisma.response.deleteMany({ where: { sessionId } });
  await prisma.dimensionScore.deleteMany({ where: { sessionId } });
  await prisma.traversalEvent.deleteMany({ where: { sessionId } });
  await prisma.reviewFlag.deleteMany({ where: { sessionId } });
  await prisma.assessmentSession.deleteMany({ where: { sessionId } });
  return ids.length;
}

const ACTIONS: Record<
  string,
  { phrase: string; label: string; run: () => Promise<string> }
> = {
  reset_learner_history: {
    phrase: "RESET",
    label: "all learner history",
    run: async () => {
      const sessions = await purgeSessions({});
      await prisma.bktState.deleteMany({});
      const students = (await prisma.student.deleteMany({})).count;
      return `Removed ${students} students and ${sessions} sessions with all responses and mastery state`;
    },
  },
  clear_incomplete_sessions: {
    phrase: "CLEAR",
    label: "incomplete sessions",
    run: async () => {
      const n = await purgeSessions({ status: { not: "completed" } });
      return `Removed ${n} in-progress sessions`;
    },
  },
};

export async function POST(req: NextRequest) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const confirm = String(body.confirm ?? "");

  const spec = ACTIONS[action];
  if (!spec) {
    return NextResponse.json({ error: "Unknown maintenance action" }, { status: 400 });
  }
  if (confirm !== spec.phrase) {
    return NextResponse.json(
      { error: `Type "${spec.phrase}" to confirm this action` },
      { status: 400 }
    );
  }

  const detail = await spec.run();
  await logAudit(auth.session, `data.${action}`, spec.label, detail);
  return NextResponse.json({ ok: true, detail });
}
