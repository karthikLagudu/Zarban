// GET  /api/content/questions — filtered/paginated list.
// POST /api/content/questions — create a full question (options, traps,
//      dimensions, Q-matrix) in one call.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireContentRole } from "@/lib/auth";
import {
  upsertQuestionContent,
  validateQuestionContent,
  type QuestionContentInput,
} from "@/lib/content/question-helpers";

export async function GET(req: NextRequest) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;

  const p = req.nextUrl.searchParams;
  const grade = p.get("grade");
  const skillId = p.get("skill_id");
  const difficulty = p.get("difficulty");
  const wordProblem = p.get("word_problem");
  const issue = p.get("issue"); // "no_traps" | "no_dimensions"
  const q = p.get("q")?.trim();
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, parseInt(p.get("page_size") ?? "20", 10) || 20);

  const where = {
    ...(grade ? { gradeLevel: parseInt(grade, 10) } : {}),
    ...(skillId ? { primarySkillId: skillId } : {}),
    ...(difficulty ? { difficultyBand: difficulty } : {}),
    ...(wordProblem === "yes" ? { wordProblemFlag: true } : {}),
    ...(wordProblem === "no" ? { wordProblemFlag: false } : {}),
    ...(issue === "no_dimensions" ? { dimensions: { is: null } } : {}),
    ...(issue === "no_traps" ? { answerTraps: { none: {} } } : {}),
    ...(q
      ? { OR: [{ questionId: { contains: q } }, { questionText: { contains: q } }] }
      : {}),
  };

  const [total, questions] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      include: {
        primarySkill: true,
        _count: { select: { answerTraps: true } },
        dimensions: { select: { primaryDimension: true } },
      },
      orderBy: { questionId: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize,
    questions: questions.map((qq) => ({
      questionId: qq.questionId,
      questionText: qq.questionText,
      wordProblemFlag: qq.wordProblemFlag,
      equationTwinId: qq.equationTwinId,
      primarySkillId: qq.primarySkillId,
      skillName: qq.primarySkill?.skillName ?? null,
      gradeLevel: qq.gradeLevel,
      difficultyBand: qq.difficultyBand,
      correctOption: qq.correctOption,
      trapCount: qq._count.answerTraps,
      primaryDimension: qq.dimensions?.primaryDimension ?? null,
      hasDimensions: qq.dimensions !== null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;

  const body = (await req.json().catch(() => null)) as QuestionContentInput | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const errors = validateQuestionContent(body);
  if (errors.length) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 422 });
  }
  const exists = await prisma.question.findUnique({ where: { questionId: body.questionId } });
  if (exists) {
    return NextResponse.json({ error: `Question ${body.questionId} already exists` }, { status: 409 });
  }
  const skill = await prisma.skill.findUnique({ where: { skillId: body.primarySkillId } });
  if (!skill) {
    return NextResponse.json({ error: `Unknown primary skill ${body.primarySkillId}` }, { status: 422 });
  }

  await upsertQuestionContent({ ...body, gradeLevel: Number(body.gradeLevel) });
  return NextResponse.json({ ok: true, questionId: body.questionId }, { status: 201 });
}
