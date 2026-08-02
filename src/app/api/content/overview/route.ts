// GET /api/content/overview — content stats, coverage grid and health issues.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireContentRole } from "@/lib/auth";
import { allSkills } from "@/lib/engine/cache";
import { analyzeContent, type QuestionRec, type SkillRec } from "@/lib/content/health";

export async function GET() {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;

  // Fetch traps and dimensions in bulk and count them in memory, rather than a
  // per-question _count aggregation across the whole (900+) bank. Skills come
  // from the cached reference set. All four reads run in parallel.
  const [skills, questions, traps, dimIds] = await Promise.all([
    allSkills(),
    prisma.question.findMany({
      select: {
        questionId: true,
        primarySkillId: true,
        gradeLevel: true,
        difficultyBand: true,
        wordProblemFlag: true,
        equationTwinId: true,
        correctOption: true,
      },
    }),
    prisma.answerTrap.findMany({ select: { questionId: true } }),
    prisma.questionDimension.findMany({ select: { questionId: true } }),
  ]);

  const trapCount = new Map<string, number>();
  for (const t of traps) trapCount.set(t.questionId, (trapCount.get(t.questionId) ?? 0) + 1);
  const hasDim = new Set(dimIds.map((d) => d.questionId));

  const skillRecs: SkillRec[] = skills.map((s) => ({
    skillId: s.skillId,
    skillName: s.skillName,
    gradeLevel: s.gradeLevel,
    topicArea: s.topicArea,
    prerequisiteSkillIds: s.prerequisiteSkillIds,
  }));
  const questionRecs: QuestionRec[] = questions.map((q) => ({
    questionId: q.questionId,
    primarySkillId: q.primarySkillId,
    gradeLevel: q.gradeLevel,
    difficultyBand: q.difficultyBand,
    wordProblemFlag: q.wordProblemFlag,
    equationTwinId: q.equationTwinId,
    correctOption: q.correctOption,
    trapCount: trapCount.get(q.questionId) ?? 0,
    hasDimensions: hasDim.has(q.questionId),
  }));

  return NextResponse.json(analyzeContent(skillRecs, questionRecs));
}
