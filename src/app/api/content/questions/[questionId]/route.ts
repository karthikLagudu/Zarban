// GET/PUT/DELETE /api/content/questions/:questionId — full editor payload.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireContentRole } from "@/lib/auth";
import {
  upsertQuestionContent,
  validateQuestionContent,
  type QuestionContentInput,
} from "@/lib/content/question-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;

  const { questionId } = await params;
  const q = await prisma.question.findUnique({
    where: { questionId },
    include: {
      answerTraps: { orderBy: { optionLabel: "asc" } },
      dimensions: true,
      qMatrixRows: { select: { skillId: true } },
    },
  });
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    question: {
      questionId: q.questionId,
      questionText: q.questionText,
      questionType: q.questionType,
      wordProblemFlag: q.wordProblemFlag,
      equationTwinId: q.equationTwinId ?? "",
      primarySkillId: q.primarySkillId ?? "",
      secondarySkillIds: q.secondarySkillIds ?? "",
      gradeLevel: q.gradeLevel ?? 7,
      difficultyBand: q.difficultyBand ?? "medium",
      optionA: q.optionA ?? "",
      optionB: q.optionB ?? "",
      optionC: q.optionC ?? "",
      optionD: q.optionD ?? "",
      correctOption: q.correctOption ?? "A",
      irt: { a: q.irtA, b: q.irtB, c: q.irtC },
      dimensions: {
        dimReading: q.dimensions?.dimReading ?? false,
        dimUnderstanding: q.dimensions?.dimUnderstanding ?? false,
        dimApplication: q.dimensions?.dimApplication ?? false,
        dimCalculation: q.dimensions?.dimCalculation ?? false,
        dimRetention: q.dimensions?.dimRetention ?? false,
        primaryDimension: q.dimensions?.primaryDimension ?? "",
        wordEqPairId: q.dimensions?.wordEqPairId ?? "",
      },
      qMatrixSkillIds: q.qMatrixRows.map((r) => r.skillId),
      traps: q.answerTraps.map((t) => ({
        optionLabel: t.optionLabel,
        optionText: t.optionText ?? "",
        trapType: t.trapType ?? "",
        skillGapId: t.skillGapId ?? "",
        misconception: t.misconception ?? "",
        misconceptionDetail: t.misconceptionDetail ?? "",
        remedialAction: t.remedialAction ?? "",
        remedialSkillId: t.remedialSkillId ?? "",
        remedialGrade: t.remedialGrade ?? "",
      })),
    },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;

  const { questionId } = await params;
  const existing = await prisma.question.findUnique({ where: { questionId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as QuestionContentInput | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const payload = { ...body, questionId, gradeLevel: Number(body.gradeLevel) };
  const errors = validateQuestionContent(payload);
  if (errors.length) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 422 });
  }
  const skill = await prisma.skill.findUnique({ where: { skillId: payload.primarySkillId } });
  if (!skill) {
    return NextResponse.json({ error: `Unknown primary skill ${payload.primarySkillId}` }, { status: 422 });
  }

  await upsertQuestionContent(payload);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;

  const { questionId } = await params;
  const existing = await prisma.question.findUnique({
    where: { questionId },
    include: { responses: { take: 1 }, wordVersions: { take: 1 } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.responses.length > 0) {
    return NextResponse.json(
      { error: "Question has recorded student responses and cannot be deleted" },
      { status: 409 }
    );
  }
  if (existing.wordVersions.length > 0) {
    return NextResponse.json(
      { error: "Question is referenced as an equation twin — unlink it first" },
      { status: 409 }
    );
  }
  await prisma.question.delete({ where: { questionId } });
  return NextResponse.json({ ok: true });
}
