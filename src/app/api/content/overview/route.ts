// GET /api/content/overview — content stats, coverage grid and health issues.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireContentRole } from "@/lib/auth";
import { analyzeContent, type QuestionRec, type SkillRec } from "@/lib/content/health";

export async function GET() {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;

  const [skills, questions] = await Promise.all([
    prisma.skill.findMany({ orderBy: { skillId: "asc" } }),
    prisma.question.findMany({
      include: {
        _count: { select: { answerTraps: true } },
        dimensions: { select: { questionId: true } },
      },
    }),
  ]);

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
    trapCount: q._count.answerTraps,
    hasDimensions: q.dimensions !== null,
  }));

  return NextResponse.json(analyzeContent(skillRecs, questionRecs));
}
