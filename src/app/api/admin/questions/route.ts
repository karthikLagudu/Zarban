// GET  /api/admin/questions — browse/filter/search the question bank.
// POST /api/admin/questions — create a question (form validation mirrors the
//                             Excel schema).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { defaultItemParams } from "@/lib/engine/irt";
import { validateQuestionPayload } from "@/lib/validate-question";

export async function GET(req: NextRequest) {
  const auth = await requireRole("Viewer");
  if ("error" in auth) return auth.error;

  const p = req.nextUrl.searchParams;
  const grade = p.get("grade");
  const skillId = p.get("skill_id");
  const difficulty = p.get("difficulty");
  const wordProblem = p.get("word_problem");
  const q = p.get("q")?.trim();
  const page = Math.max(1, parseInt(p.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, parseInt(p.get("page_size") ?? "25", 10) || 25);

  const where = {
    ...(grade ? { gradeLevel: parseInt(grade, 10) } : {}),
    ...(skillId ? { primarySkillId: skillId } : {}),
    ...(difficulty ? { difficultyBand: difficulty } : {}),
    ...(wordProblem === "yes" ? { wordProblemFlag: true } : {}),
    ...(wordProblem === "no" ? { wordProblemFlag: false } : {}),
    ...(q
      ? {
          OR: [
            { questionId: { contains: q } },
            { questionText: { contains: q } },
          ],
        }
      : {}),
  };

  const [total, questions] = await Promise.all([
    prisma.question.count({ where }),
    prisma.question.findMany({
      where,
      include: { primarySkill: true, answerTraps: true, dimensions: true },
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
      questionType: qq.questionType,
      wordProblemFlag: qq.wordProblemFlag,
      equationTwinId: qq.equationTwinId,
      primarySkillId: qq.primarySkillId,
      skillName: qq.primarySkill?.skillName ?? null,
      gradeLevel: qq.gradeLevel,
      difficultyBand: qq.difficultyBand,
      optionA: qq.optionA,
      optionB: qq.optionB,
      optionC: qq.optionC,
      optionD: qq.optionD,
      correctOption: qq.correctOption,
      trapCount: qq.answerTraps.length,
      primaryDimension: qq.dimensions?.primaryDimension ?? null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const errors = validateQuestionPayload(body);
  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 422 });
  }

  const exists = await prisma.question.findUnique({
    where: { questionId: body.questionId },
  });
  if (exists) {
    return NextResponse.json(
      { error: `Question ${body.questionId} already exists` },
      { status: 409 }
    );
  }
  const skill = await prisma.skill.findUnique({
    where: { skillId: body.primarySkillId },
  });
  if (!skill) {
    return NextResponse.json(
      { error: `Unknown primary_skill_id ${body.primarySkillId}` },
      { status: 422 }
    );
  }

  const irt = defaultItemParams(body.gradeLevel, body.difficultyBand, body.questionId);
  const created = await prisma.question.create({
    data: {
      questionId: body.questionId,
      questionText: body.questionText,
      questionType: body.questionType ?? "MCQ",
      wordProblemFlag: !!body.wordProblemFlag,
      equationTwinId: body.equationTwinId || null,
      primarySkillId: body.primarySkillId,
      secondarySkillIds: body.secondarySkillIds || null,
      gradeLevel: body.gradeLevel,
      difficultyBand: body.difficultyBand,
      optionA: body.optionA,
      optionB: body.optionB,
      optionC: body.optionC,
      optionD: body.optionD,
      correctOption: body.correctOption,
      irtA: irt.a,
      irtB: irt.b,
      irtC: irt.c,
    },
  });
  // Q-matrix entry for the primary skill so the CDM can attribute gaps.
  await prisma.qMatrixEntry.upsert({
    where: {
      questionId_skillId: {
        questionId: created.questionId,
        skillId: body.primarySkillId,
      },
    },
    create: { questionId: created.questionId, skillId: body.primarySkillId },
    update: {},
  });

  // Optional traps array.
  if (Array.isArray(body.traps)) {
    for (const t of body.traps) {
      if (!["A", "B", "C", "D"].includes(t.optionLabel)) continue;
      await prisma.answerTrap.create({
        data: {
          questionId: created.questionId,
          optionLabel: t.optionLabel,
          optionText: t.optionText ?? null,
          trapType: t.trapType ?? null,
          skillGapId: t.skillGapId ?? null,
          misconception: t.misconception ?? null,
          misconceptionDetail: t.misconceptionDetail ?? null,
          remedialAction: t.remedialAction ?? null,
          remedialSkillId: t.remedialSkillId ?? null,
          remedialGrade: t.remedialGrade ?? null,
        },
      });
    }
  }

  return NextResponse.json({ ok: true, questionId: created.questionId }, { status: 201 });
}

