// GET /api/admin/sessions/:id/replay — full timeline: question served, option
// selected, trap fired, and the engine's next-question decision (spec 5.2.5).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireRole("Viewer");
  if ("error" in auth) return auth.error;

  const { sessionId } = await params;
  const session = await prisma.assessmentSession.findUnique({
    where: { sessionId },
    include: {
      student: true,
      responses: {
        orderBy: { responseId: "asc" },
        include: { question: { include: { primarySkill: true } } },
      },
      traversals: { orderBy: { id: "asc" } },
    },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const skills = await prisma.skill.findMany();
  const skillName = (id: string | null) =>
    id ? (skills.find((s) => s.skillId === id)?.skillName ?? id) : null;

  return NextResponse.json({
    session: {
      sessionId: session.sessionId,
      student: { name: session.student.name, studentId: session.studentId },
      selectedGrade: session.selectedGrade,
      status: session.status,
      theta: session.currentTheta,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
    },
    timeline: session.responses.map((r, idx) => ({
      order: idx + 1,
      questionId: r.questionId,
      questionText: r.question.questionText,
      skillId: r.question.primarySkillId,
      skillName: r.question.primarySkill?.skillName ?? null,
      servedGrade: r.servedGrade,
      servedDifficulty: r.servedDifficulty,
      selectedOption: r.selectedOption,
      correctOption: r.question.correctOption,
      isCorrect: r.isCorrect,
      twinProbe: r.twinProbe,
      trapType: r.trapType,
      misconception: r.misconception,
      engineDecision: r.engineDecision,
      thetaAfter: r.thetaAfter,
      pMasteryAfter: r.pMasteryAfter,
      respondedAt: r.respondedAt.toISOString(),
    })),
    traversals: session.traversals.map((t) => ({
      from: `${skillName(t.fromSkillId)} (Grade ${t.fromGrade ?? "?"})`,
      to: `${skillName(t.toSkillId)} (Grade ${t.toGrade ?? "?"})`,
      reason: t.reason,
    })),
  });
}
