// PUT/DELETE /api/content/skills/:skillId — edit or remove a skill.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireContentRole } from "@/lib/auth";
import { syncPrereqs } from "@/lib/content/skill-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ skillId: string }> }
) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;
  const { skillId } = await params;
  const skill = await prisma.skill.findUnique({
    where: { skillId },
    include: { _count: { select: { questions: true } } },
  });
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ skill });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ skillId: string }> }
) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;

  const { skillId } = await params;
  const existing = await prisma.skill.findUnique({ where: { skillId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  if (!body.skillName) {
    return NextResponse.json({ error: "skillName is required" }, { status: 422 });
  }

  const prereqCsv = String(body.prerequisiteSkillIds ?? "").trim();
  // Guard against a skill listing itself as a prerequisite.
  if (prereqCsv.split(",").map((s: string) => s.trim()).includes(skillId)) {
    return NextResponse.json(
      { error: "A skill cannot be its own prerequisite" },
      { status: 422 }
    );
  }

  await prisma.skill.update({
    where: { skillId },
    data: {
      skillName: body.skillName,
      gradeLevel: body.gradeLevel || null,
      topicArea: body.topicArea || null,
      difficultyBand: body.difficultyBand || null,
      prerequisiteSkillIds: prereqCsv || null,
      notes: body.notes || null,
    },
  });
  await syncPrereqs(skillId, prereqCsv);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ skillId: string }> }
) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;

  const { skillId } = await params;
  const skill = await prisma.skill.findUnique({
    where: { skillId },
    include: {
      _count: { select: { questions: true, qMatrixRows: true, dependents: true } },
    },
  });
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (skill._count.questions > 0) {
    return NextResponse.json(
      { error: `${skillId} is the primary skill of ${skill._count.questions} question(s) — reassign them first` },
      { status: 409 }
    );
  }
  if (skill._count.dependents > 0) {
    return NextResponse.json(
      { error: `${skillId} is a prerequisite of other skills — remove those links first` },
      { status: 409 }
    );
  }

  await prisma.knowledgeGraphEdge.deleteMany({ where: { childSkillId: skillId } });
  await prisma.skill.delete({ where: { skillId } });
  return NextResponse.json({ ok: true });
}
