// GET /api/admin/students/:id — student detail + all sessions + BKT snapshot.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const auth = await requireRole("Viewer");
  if ("error" in auth) return auth.error;

  const { studentId } = await params;
  const student = await prisma.student.findUnique({
    where: { studentId },
    include: {
      sessions: {
        orderBy: { startedAt: "desc" },
        include: { responses: { select: { isCorrect: true, twinProbe: true } } },
      },
      bktStates: { include: { skill: true }, orderBy: { pMastery: "asc" } },
    },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  return NextResponse.json({
    student: {
      studentId: student.studentId,
      name: student.name,
      email: student.email,
      school: student.school,
      classGrade: student.classGrade,
      createdAt: student.createdAt.toISOString(),
    },
    sessions: student.sessions.map((s) => ({
      sessionId: s.sessionId,
      selectedGrade: s.selectedGrade,
      status: s.status,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
      questions: s.responses.length,
      accuracy: s.responses.length
        ? Math.round(
            (s.responses.filter((r) => r.isCorrect).length / s.responses.length) * 1000
          ) / 10
        : 0,
    })),
    bkt: student.bktStates.map((b) => ({
      skillId: b.skillId,
      skillName: b.skill.skillName,
      gradeLevel: b.skill.gradeLevel,
      pMastery: Math.round(b.pMastery * 1000) / 1000,
      attempts: b.attempts,
    })),
  });
}
