// GET /api/learn/:studentId — a learner's own progress across sessions.
//
// Public and keyed by the opaque student UUID (the same trust model as the
// diagnostic report, which is public by session id). Returns assessment
// history, a score trend, current skill mastery, and what to practise next.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MASTERY_THRESHOLD } from "@/lib/engine/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;

  const student = await prisma.student.findUnique({
    where: { studentId },
    include: {
      classroom: { select: { name: true } },
      sessions: {
        orderBy: { startedAt: "asc" },
        include: { responses: { select: { isCorrect: true, twinProbe: true } } },
      },
      bktStates: { include: { skill: true }, orderBy: { pMastery: "asc" } },
    },
  });
  if (!student) {
    return NextResponse.json({ error: "No learner found" }, { status: 404 });
  }

  const scoreOf = (resp: { isCorrect: boolean | null; twinProbe: boolean }[]) => {
    const scored = resp.filter((r) => !r.twinProbe);
    if (scored.length === 0) return null;
    return Math.round((scored.filter((r) => r.isCorrect).length / scored.length) * 1000) / 10;
  };

  const sessions = student.sessions.map((s, i) => ({
    sessionId: s.sessionId,
    order: i + 1,
    grade: s.selectedGrade,
    status: s.status,
    startedAt: s.startedAt.toISOString(),
    questions: s.responses.filter((r) => !r.twinProbe).length,
    score: scoreOf(s.responses),
  }));
  const completed = sessions.filter((s) => s.status === "completed" && s.score !== null);
  const trend = completed.map((s) => ({ label: `#${s.order}`, score: s.score as number }));
  const scores = completed.map((s) => s.score as number);

  const skills = student.bktStates.map((b) => ({
    skillId: b.skillId,
    skillName: b.skill.skillName,
    topicArea: b.skill.topicArea,
    gradeLevel: b.skill.gradeLevel,
    pMastery: Math.round(b.pMastery * 1000) / 1000,
    attempts: b.attempts,
    status:
      b.pMastery >= MASTERY_THRESHOLD
        ? "Mastered"
        : b.pMastery >= 0.5
          ? "Developing"
          : "Gap",
  }));
  const mastered = skills.filter((s) => s.status === "Mastered").length;

  // What to practise next: the weakest not-yet-mastered skills the learner has
  // actually attempted, with any NCERT reference from the skill notes.
  const recommendations = skills
    .filter((s) => s.status !== "Mastered" && s.attempts > 0)
    .slice(0, 3)
    .map((s) => ({
      skillId: s.skillId,
      skillName: s.skillName,
      gradeLevel: s.gradeLevel,
      pMastery: s.pMastery,
      topicArea: s.topicArea,
    }));

  return NextResponse.json({
    student: {
      studentId: student.studentId,
      name: student.name,
      school: student.school,
      classGrade: student.classGrade,
      classroomName: student.classroom?.name ?? null,
    },
    summary: {
      assessments: completed.length,
      bestScore: scores.length ? Math.max(...scores) : null,
      latestScore: scores.length ? scores[scores.length - 1] : null,
      skillsTracked: skills.length,
      skillsMastered: mastered,
    },
    trend,
    sessions: [...sessions].reverse(), // newest first for the history list
    skills,
    recommendations,
  });
}
