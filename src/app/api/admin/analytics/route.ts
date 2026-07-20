// GET /api/admin/analytics — cohort analytics: performance trends, trap-type
// distribution per grade, prerequisite gap tracker (spec 5.2.3).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const auth = await requireRole("Viewer");
  if ("error" in auth) return auth.error;

  const sessions = await prisma.assessmentSession.findMany({
    include: { responses: true },
    orderBy: { startedAt: "asc" },
  });

  // Grade-level performance trend by week.
  const trend = new Map<string, Map<number, { total: number; correct: number }>>();
  for (const s of sessions) {
    const week = isoWeek(s.startedAt);
    const grade = s.selectedGrade ?? 0;
    if (!trend.has(week)) trend.set(week, new Map());
    const g = trend.get(week)!;
    const agg = g.get(grade) ?? { total: 0, correct: 0 };
    agg.total += s.responses.length;
    agg.correct += s.responses.filter((r) => r.isCorrect).length;
    g.set(grade, agg);
  }
  const performanceTrend = [...trend.entries()].map(([week, grades]) => ({
    week,
    grades: [...grades.entries()]
      .filter(([g]) => g > 0)
      .map(([grade, agg]) => ({
        grade,
        accuracy: agg.total ? Math.round((agg.correct / agg.total) * 1000) / 10 : 0,
      })),
  }));

  // Trap-type distribution, overall and per grade.
  const responses = await prisma.response.findMany({
    where: { trapType: { not: null } },
    include: { session: { select: { selectedGrade: true } }, question: { select: { primarySkillId: true } } },
  });
  const trapCounts = new Map<string, number>();
  const trapByGrade = new Map<number, Map<string, number>>();
  for (const r of responses) {
    const t = r.trapType!;
    trapCounts.set(t, (trapCounts.get(t) ?? 0) + 1);
    const g = r.session.selectedGrade ?? 0;
    if (!trapByGrade.has(g)) trapByGrade.set(g, new Map());
    const m = trapByGrade.get(g)!;
    m.set(t, (m.get(t) ?? 0) + 1);
  }
  const trapDistribution = [...trapCounts.entries()]
    .map(([trapType, count]) => ({ trapType, count }))
    .sort((a, b) => b.count - a.count);
  const trapDistributionByGrade = [...trapByGrade.entries()]
    .filter(([g]) => g > 0)
    .sort((a, b) => a[0] - b[0])
    .map(([grade, m]) => ({
      grade,
      traps: [...m.entries()].map(([trapType, count]) => ({ trapType, count })),
    }));

  // Prerequisite gap tracker: which foundational skills block the most students.
  const traversals = await prisma.traversalEvent.findMany({
    include: { session: { select: { studentId: true } } },
  });
  const gapAgg = new Map<string, Set<string>>();
  for (const t of traversals) {
    if (!gapAgg.has(t.toSkillId)) gapAgg.set(t.toSkillId, new Set());
    gapAgg.get(t.toSkillId)!.add(t.session.studentId);
  }
  const skills = await prisma.skill.findMany();
  const gapTracker = [...gapAgg.entries()]
    .map(([skillId, students]) => {
      const s = skills.find((x) => x.skillId === skillId);
      return {
        skillId,
        skillName: s?.skillName ?? skillId,
        gradeLevel: s?.gradeLevel ?? null,
        blockedStudents: students.size,
      };
    })
    .sort((a, b) => b.blockedStudents - a.blockedStudents)
    .slice(0, 10);

  return NextResponse.json({ performanceTrend, trapDistribution, trapDistributionByGrade, gapTracker });
}

function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
