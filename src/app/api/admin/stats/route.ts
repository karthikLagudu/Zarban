// GET /api/admin/stats — dashboard home: totals, weekly count, average score
// by grade, and the class-level skill failure heatmap.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { allSkills } from "@/lib/engine/cache";

export async function GET() {
  const auth = await requireRole("Viewer");
  if ("error" in auth) return auth.error;

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  // Everything the dashboard needs is independent — one parallel batch instead
  // of four sequential round trips. Skills come from the cached reference set.
  const [totalStudents, totalSessions, sessionsThisWeek, sessions, responses, skills] =
    await Promise.all([
      prisma.student.count(),
      prisma.assessmentSession.count(),
      prisma.assessmentSession.count({ where: { startedAt: { gte: weekAgo } } }),
      prisma.assessmentSession.findMany({
        include: { responses: { select: { isCorrect: true } } },
      }),
      prisma.response.findMany({
        select: {
          isCorrect: true,
          servedSkillId: true,
          question: { select: { primarySkillId: true } },
        },
      }),
      allSkills(),
    ]);

  // Average accuracy by selected grade.
  const byGrade = new Map<number, { total: number; correct: number; sessions: number }>();
  for (const s of sessions) {
    const g = s.selectedGrade ?? 0;
    const agg = byGrade.get(g) ?? { total: 0, correct: 0, sessions: 0 };
    agg.sessions += 1;
    agg.total += s.responses.length;
    agg.correct += s.responses.filter((r) => r.isCorrect).length;
    byGrade.set(g, agg);
  }
  const averageScoreByGrade = [...byGrade.entries()]
    .filter(([g]) => g > 0)
    .map(([grade, agg]) => ({
      grade,
      sessions: agg.sessions,
      averageScore: agg.total ? Math.round((agg.correct / agg.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => a.grade - b.grade);

  // Skill failure heatmap: failure rate per skill across all responses.
  const skillAgg = new Map<string, { total: number; wrong: number }>();
  for (const r of responses) {
    const sk = r.question.primarySkillId ?? r.servedSkillId;
    if (!sk) continue;
    const agg = skillAgg.get(sk) ?? { total: 0, wrong: 0 };
    agg.total += 1;
    if (r.isCorrect === false) agg.wrong += 1;
    skillAgg.set(sk, agg);
  }
  const heatmap = skills
    .map((s) => {
      const agg = skillAgg.get(s.skillId) ?? { total: 0, wrong: 0 };
      return {
        skillId: s.skillId,
        skillName: s.skillName,
        topicArea: s.topicArea,
        gradeLevel: s.gradeLevel,
        attempts: agg.total,
        failureRate: agg.total ? Math.round((agg.wrong / agg.total) * 1000) / 10 : null,
      };
    })
    .sort((a, b) => (b.failureRate ?? -1) - (a.failureRate ?? -1));

  return NextResponse.json({
    totalStudents,
    totalSessions,
    sessionsThisWeek,
    averageScoreByGrade,
    heatmap,
  });
}
