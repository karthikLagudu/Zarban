// GET /api/admin/skills — skill list for filters and question forms.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET() {
  const auth = await requireRole("Viewer");
  if ("error" in auth) return auth.error;
  const skills = await prisma.skill.findMany({ orderBy: { skillId: "asc" } });
  return NextResponse.json({
    skills: skills.map((s) => ({
      skillId: s.skillId,
      skillName: s.skillName,
      gradeLevel: s.gradeLevel,
      topicArea: s.topicArea,
      prerequisiteSkillIds: s.prerequisiteSkillIds,
    })),
  });
}
