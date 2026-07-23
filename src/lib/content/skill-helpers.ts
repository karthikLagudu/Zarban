// Shared helpers for content-portal skill management.
import { prisma } from "@/lib/db";

export function validateSkill(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!body.skillId || typeof body.skillId !== "string")
    errors.push("skillId is required");
  else if (!/^S_\d{3,}$/.test(body.skillId as string))
    errors.push('skillId should look like "S_034"');
  if (!body.skillName) errors.push("skillName is required");
  return errors;
}

/** Rebuild knowledge_graph edges for a skill from a comma-separated list.
 *  Silently skips prerequisites that don't exist (validated separately). */
export async function syncPrereqs(skillId: string, prereqCsv: string) {
  await prisma.knowledgeGraphEdge.deleteMany({ where: { childSkillId: skillId } });
  const parents = prereqCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const parentSkillId of parents) {
    const exists = await prisma.skill.findUnique({ where: { skillId: parentSkillId } });
    if (exists) {
      await prisma.knowledgeGraphEdge.create({
        data: { childSkillId: skillId, parentSkillId },
      });
    }
  }
}
