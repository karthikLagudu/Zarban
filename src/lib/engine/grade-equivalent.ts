// Grade-equivalent estimation, grounded in observed per-grade accuracy.
//
// Order of evidence, strongest first:
//   1. Demonstrated — highest grade with ≥70% over ≥3 questions (passed in as
//      `demonstrated`).
//   2. Estimated    — highest grade with ≥60% over ≥2 questions.
//   3. Below floor  — failed even the lowest grade attempted (which reaches
//      Grade 5 via prerequisite remediation) → "Below Grade 5".
//   4. Otherwise    — performing just under the lowest grade attempted.
//
// This keeps the headline consistent with the scores shown elsewhere in the
// report and avoids over-claiming from a saturated θ (which marches to ±4 on
// all-correct/all-wrong streaks regardless of the difficulty actually faced).

export interface GradeEquivalent {
  label: string; // "Grade 8" | "≈ Grade 6" | "Below Grade 5" | "Grade 10+"
  short: string; // "G8" | "≈G6" | "<G5" | "G10+"
  grade: number | null;
  basis: "demonstrated" | "estimated" | "below_floor" | "above_ceiling";
}

export function computeGradeEquivalent(
  byGrade: Map<number, { total: number; correct: number }>,
  demonstrated: number | null,
  selectedGrade: number
): GradeEquivalent {
  if (demonstrated !== null) {
    return {
      label: `Grade ${demonstrated}`,
      short: `G${demonstrated}`,
      grade: demonstrated,
      basis: "demonstrated",
    };
  }

  const entries = [...byGrade.entries()].sort((a, b) => a[0] - b[0]);

  // Estimated: highest grade with reasonable evidence of competence.
  let estimated: number | null = null;
  for (const [g, agg] of entries) {
    if (agg.total >= 2 && agg.correct / agg.total >= 0.6) {
      estimated = Math.max(estimated ?? 0, g);
    }
  }
  if (estimated !== null) {
    if (estimated >= 10) {
      return { label: "Grade 10+", short: "G10+", grade: 10, basis: "above_ceiling" };
    }
    return {
      label: `≈ Grade ${estimated}`,
      short: `≈G${estimated}`,
      grade: estimated,
      basis: "estimated",
    };
  }

  // No grade reached competence — locate the floor the student attempted.
  const attempted = entries.filter(([, a]) => a.total >= 1).map(([g]) => g);
  const lowestAttempted = attempted.length ? Math.min(...attempted) : selectedGrade;
  if (lowestAttempted <= 5) {
    return { label: "Below Grade 5", short: "<G5", grade: null, basis: "below_floor" };
  }
  const g = Math.max(5, lowestAttempted - 1);
  return { label: `≈ Grade ${g}`, short: `≈G${g}`, grade: g, basis: "estimated" };
}
