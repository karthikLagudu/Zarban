// Topic (skill) sequencing helpers over the knowledge graph.

import type { Skill } from "@/generated/prisma/client";

async function getPrisma() {
  return (await import("@/lib/db")).prisma;
}

/**
 * A skill's grade_level is a string like "5", "9-10", or "7,8". Returns true
 * when the given numeric grade falls inside it.
 */
export function gradeMatches(gradeLevel: string | null, grade: number): boolean {
  if (!gradeLevel) return false;
  const text = gradeLevel.trim();
  for (const part of text.split(",")) {
    const p = part.trim();
    const range = p.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const lo = parseInt(range[1], 10);
      const hi = parseInt(range[2], 10);
      if (grade >= lo && grade <= hi) return true;
    } else if (parseInt(p, 10) === grade) {
      return true;
    }
  }
  return false;
}

/** Representative numeric grade for a skill (lowest grade it appears in). */
export function skillBaseGrade(gradeLevel: string | null, fallback = 5): number {
  if (!gradeLevel) return fallback;
  const nums = gradeLevel.match(/\d+/g);
  if (!nums || nums.length === 0) return fallback;
  return Math.min(...nums.map((n) => parseInt(n, 10)));
}

/** Ordered list of topic-model skills for a grade (skill_id order = SME order). */
export async function getTopicsForGrade(grade: number): Promise<Skill[]> {
  const prisma = await getPrisma();
  const skills = await prisma.skill.findMany({ orderBy: { skillId: "asc" } });
  return skills.filter((s) => gradeMatches(s.gradeLevel, grade));
}

export async function getFirstTopic(grade: number): Promise<Skill | null> {
  const topics = await getTopicsForGrade(grade);
  return topics[0] ?? null;
}

/** Next topic at the grade that has not been visited yet this session. */
export async function getNextTopic(
  grade: number,
  visitedSkillIds: string[]
): Promise<Skill | null> {
  const topics = await getTopicsForGrade(grade);
  return topics.find((t) => !visitedSkillIds.includes(t.skillId)) ?? null;
}

/**
 * First prerequisite of a skill from the knowledge graph. When several exist,
 * prefer the one with the highest base grade (nearest ancestor), matching the
 * "drop one grade at a time" traversal described in the spec.
 */
export async function getPrerequisite(skillId: string): Promise<Skill | null> {
  const prisma = await getPrisma();
  const edges = await prisma.knowledgeGraphEdge.findMany({
    where: { childSkillId: skillId },
    include: { parent: true },
  });
  if (edges.length === 0) return null;
  const parents = edges.map((e) => e.parent);
  parents.sort(
    (a, b) => skillBaseGrade(b.gradeLevel) - skillBaseGrade(a.gradeLevel)
  );
  return parents[0];
}
