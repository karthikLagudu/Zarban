// Question retrieval with the fallback ladder required by spec Part 7.1:
// exact {skill, grade, difficulty} → nearest difficulty band → nearest grade.
// Never returns a question already served in the session (Part 7.3).
//
// Within a cell the choice is genuinely adaptive (CAT): among the candidates
// we pick the item whose IRT difficulty (b) sits closest to the student's
// current ability θ — the maximum-information item under the 3PL model —
// breaking ties toward higher discrimination (a). Questions the student has
// seen in *previous* sessions are soft-avoided so retakes stay fresh.

import { prisma } from "@/lib/db";
import type { Question } from "@prisma/client";
import { nearestBands } from "./difficulty";
import { clampGrade, GRADE_CEILING, GRADE_FLOOR } from "./types";

export interface FetchSpec {
  skillId?: string;
  grade?: number;
  difficulty?: string;
  questionId?: string; // direct fetch (twin probes)
  excludeIds: string[]; // hard exclusion — already served this session
  /** current IRT ability estimate; drives max-information selection */
  theta?: number;
  /** soft exclusion — seen in earlier sessions; avoided but allowed as fallback */
  seenBeforeIds?: string[];
}

export interface FetchResult {
  question: Question;
  /** true when the exact requested band/grade wasn't available */
  usedFallback: boolean;
}

/** Rank candidates: max information first (|b−θ| asc), then a desc, then id. */
function pickBest(
  candidates: Question[],
  theta: number,
  seenBefore: Set<string>
): Question | null {
  if (candidates.length === 0) return null;
  const fresh = candidates.filter((q) => !seenBefore.has(q.questionId));
  const pool = fresh.length > 0 ? fresh : candidates;
  return pool.reduce((best, q) => {
    const dq = Math.abs(q.irtB - theta);
    const db = Math.abs(best.irtB - theta);
    if (dq < db - 1e-9) return q;
    if (dq > db + 1e-9) return best;
    if (q.irtA > best.irtA + 1e-9) return q;
    if (q.irtA < best.irtA - 1e-9) return best;
    return q.questionId < best.questionId ? q : best;
  });
}

export async function fetchQuestion(spec: FetchSpec): Promise<FetchResult | null> {
  const { excludeIds } = spec;
  const theta = spec.theta ?? 0;
  const seenBefore = new Set(spec.seenBeforeIds ?? []);

  // Direct fetch by id (twin probe). Repeats are allowed only if unseen.
  if (spec.questionId) {
    const q = await prisma.question.findUnique({
      where: { questionId: spec.questionId },
    });
    if (q && !excludeIds.includes(q.questionId)) {
      return { question: q, usedFallback: false };
    }
    return null;
  }

  const skillId = spec.skillId;
  const grade = clampGrade(spec.grade ?? 7);
  const difficulty = spec.difficulty ?? "medium";

  // Grade fallback order: exact, then progressively nearer grades (below first
  // — remediation pulls downward — then above), clamped to 5..10.
  const gradeOrder: number[] = [grade];
  for (let d = 1; d <= GRADE_CEILING - GRADE_FLOOR; d++) {
    if (grade - d >= GRADE_FLOOR) gradeOrder.push(grade - d);
    if (grade + d <= GRADE_CEILING) gradeOrder.push(grade + d);
  }

  let fallback = false;
  for (const g of gradeOrder) {
    for (const band of nearestBands(difficulty)) {
      const cell = {
        gradeLevel: g,
        difficultyBand: band,
        questionId: { notIn: excludeIds },
      };
      // Preference ladder within a {grade, band} cell:
      //  1. primary-skill match that isn't a reserved equation twin
      //  2. Q-matrix (secondary skill) match that isn't a reserved twin
      //  3. any match including reserved twins (last resort)
      const primaryWhere = skillId ? { ...cell, primarySkillId: skillId } : cell;
      const matrixWhere = skillId
        ? { ...cell, qMatrixRows: { some: { skillId } } }
        : cell;

      for (const where of [
        { ...primaryWhere, wordVersions: { none: {} } },
        { ...matrixWhere, wordVersions: { none: {} } },
        matrixWhere,
      ]) {
        const candidates = await prisma.question.findMany({
          where,
          orderBy: { questionId: "asc" },
          take: 32,
        });
        const q = pickBest(candidates, theta, seenBefore);
        if (q) {
          return {
            question: q,
            usedFallback: fallback || g !== grade || band !== difficulty,
          };
        }
      }
      fallback = true;
    }
  }

  // Last resort: any unseen question for the skill at any grade/band.
  if (skillId) {
    const candidates = await prisma.question.findMany({
      where: {
        OR: [{ primarySkillId: skillId }, { qMatrixRows: { some: { skillId } } }],
        questionId: { notIn: excludeIds },
      },
      orderBy: { questionId: "asc" },
      take: 32,
    });
    const q = pickBest(candidates, theta, seenBefore);
    if (q) return { question: q, usedFallback: true };
  }

  return null;
}
