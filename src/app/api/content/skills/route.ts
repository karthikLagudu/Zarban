// GET  /api/content/skills — full skill list with question counts.
// POST /api/content/skills — create a skill (+ knowledge-graph edges).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireContentRole } from "@/lib/auth";
import { syncPrereqs, validateSkill } from "@/lib/content/skill-helpers";

export async function GET() {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;

  const skills = await prisma.skill.findMany({
    orderBy: { skillId: "asc" },
    include: { _count: { select: { questions: true } } },
  });
  return NextResponse.json({
    skills: skills.map((s) => ({
      skillId: s.skillId,
      skillName: s.skillName,
      gradeLevel: s.gradeLevel,
      topicArea: s.topicArea,
      difficultyBand: s.difficultyBand,
      prerequisiteSkillIds: s.prerequisiteSkillIds ?? "",
      notes: s.notes,
      questionCount: s._count.questions,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const errors = validateSkill(body);
  if (errors.length) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 422 });
  }
  const exists = await prisma.skill.findUnique({ where: { skillId: body.skillId } });
  if (exists) {
    return NextResponse.json({ error: `Skill ${body.skillId} already exists` }, { status: 409 });
  }

  const prereqCsv = String(body.prerequisiteSkillIds ?? "").trim();
  await prisma.skill.create({
    data: {
      skillId: body.skillId,
      skillName: body.skillName,
      gradeLevel: body.gradeLevel || null,
      topicArea: body.topicArea || null,
      difficultyBand: body.difficultyBand || null,
      prerequisiteSkillIds: prereqCsv || null,
      notes: body.notes || null,
    },
  });
  await syncPrereqs(body.skillId, prereqCsv);
  return NextResponse.json({ ok: true, skillId: body.skillId }, { status: 201 });
}
