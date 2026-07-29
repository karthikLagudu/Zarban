// GET /api/practice
//   (no params)      → catalog of practisable skills with question counts.
//   ?skill=S_xxx     → a shuffled practice set for that skill, WITH the correct
//                      answer and per-option misconception explanations so the
//                      student gets instant feedback (this is practice, not the
//                      graded assessment — revealing answers is the point).
//
// Public, like the diagnostic report — no learner data is exposed.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const skillId = req.nextUrl.searchParams.get("skill");
  const count = Math.min(
    Math.max(parseInt(req.nextUrl.searchParams.get("count") ?? "10", 10) || 10, 1),
    20
  );

  // ── Catalog ────────────────────────────────────────────────────────────────
  if (!skillId) {
    const skills = await prisma.skill.findMany({
      orderBy: [{ gradeLevel: "asc" }, { skillName: "asc" }],
      include: { _count: { select: { questions: true } } },
    });
    return NextResponse.json({
      skills: skills
        .filter((s) => s._count.questions > 0)
        .map((s) => ({
          skillId: s.skillId,
          skillName: s.skillName,
          gradeLevel: s.gradeLevel,
          topicArea: s.topicArea,
          questionCount: s._count.questions,
        })),
    });
  }

  // ── A practice set for one skill ─────────────────────────────────────────────
  const skill = await prisma.skill.findUnique({ where: { skillId } });
  if (!skill) return NextResponse.json({ error: "Skill not found" }, { status: 404 });

  const all = await prisma.question.findMany({
    where: { primarySkillId: skillId },
    include: { answerTraps: true },
  });
  // Shuffle, then take up to `count`; keep an easy → hard lean so early questions
  // build confidence.
  const bandRank: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
  const shuffled = all
    .map((q) => ({ q, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.q)
    .sort((a, b) => (bandRank[a.difficultyBand ?? "medium"] ?? 1) - (bandRank[b.difficultyBand ?? "medium"] ?? 1))
    .slice(0, count);

  const questions = shuffled.map((q) => {
    const traps: Record<string, { trapType: string | null; misconception: string | null; detail: string | null }> = {};
    for (const t of q.answerTraps) {
      traps[t.optionLabel] = {
        trapType: t.trapType,
        misconception: t.misconception,
        detail: t.misconceptionDetail,
      };
    }
    return {
      questionId: q.questionId,
      questionText: q.questionText,
      difficulty: q.difficultyBand,
      options: [
        { label: "A", text: q.optionA ?? "" },
        { label: "B", text: q.optionB ?? "" },
        { label: "C", text: q.optionC ?? "" },
        { label: "D", text: q.optionD ?? "" },
      ].filter((o) => o.text !== ""),
      correctOption: q.correctOption,
      traps,
    };
  });

  return NextResponse.json({
    skill: {
      skillId: skill.skillId,
      skillName: skill.skillName,
      gradeLevel: skill.gradeLevel,
      topicArea: skill.topicArea,
      notes: skill.notes,
    },
    questions,
  });
}
