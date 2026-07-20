// GET /api/admin/students — table with name, grade, last assessment, score, status.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireRole("Viewer");
  if ("error" in auth) return auth.error;

  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const students = await prisma.student.findMany({
    include: {
      sessions: {
        orderBy: { startedAt: "desc" },
        include: { responses: { select: { isCorrect: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = students
    .filter(
      (st) =>
        !q ||
        (st.name ?? "").toLowerCase().includes(q) ||
        (st.school ?? "").toLowerCase().includes(q) ||
        (st.email ?? "").toLowerCase().includes(q)
    )
    .map((st) => {
      const last = st.sessions[0] ?? null;
      const lastScore = last
        ? last.responses.length
          ? Math.round(
              (last.responses.filter((r) => r.isCorrect).length /
                last.responses.length) *
                1000
            ) / 10
          : 0
        : null;
      return {
        studentId: st.studentId,
        name: st.name,
        school: st.school,
        classGrade: st.classGrade,
        sessionCount: st.sessions.length,
        lastAssessmentAt: last?.startedAt.toISOString() ?? null,
        lastScore,
        lastStatus: last?.status ?? null,
        lastSessionId: last?.sessionId ?? null,
      };
    });

  return NextResponse.json({ students: rows });
}
