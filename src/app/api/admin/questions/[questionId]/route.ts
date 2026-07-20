// GET/PUT/DELETE /api/admin/questions/:id — single-question management.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { validateQuestionPayload } from "@/lib/validate-question";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const auth = await requireRole("Viewer");
  if ("error" in auth) return auth.error;

  const { questionId } = await params;
  const q = await prisma.question.findUnique({
    where: { questionId },
    include: { answerTraps: true, dimensions: true, primarySkill: true },
  });
  if (!q) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ question: q });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;

  const { questionId } = await params;
  const existing = await prisma.question.findUnique({ where: { questionId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const errors = validateQuestionPayload({ ...body, questionId });
  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 422 });
  }

  await prisma.question.update({
    where: { questionId },
    data: {
      questionText: body.questionText,
      questionType: body.questionType ?? existing.questionType,
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
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;

  const { questionId } = await params;
  const existing = await prisma.question.findUnique({
    where: { questionId },
    include: { responses: { take: 1 }, wordVersions: { take: 1 } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.responses.length > 0) {
    return NextResponse.json(
      { error: "Question has recorded responses and cannot be deleted" },
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
