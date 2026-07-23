import { describe, expect, it } from "vitest";
import { computeGradeEquivalent } from "@/lib/engine/grade-equivalent";

type Agg = { total: number; correct: number };
const byGrade = (rows: [number, number, number][]) =>
  new Map<number, Agg>(rows.map(([g, t, c]) => [g, { total: t, correct: c }]));

describe("grade equivalent (data-grounded)", () => {
  it("uses the demonstrated grade when the strict rule passed", () => {
    const ge = computeGradeEquivalent(byGrade([[8, 12, 12]]), 8, 8);
    expect(ge).toMatchObject({ grade: 8, basis: "demonstrated", label: "Grade 8" });
  });

  it("estimates the highest grade with ≥60% over ≥2 questions", () => {
    // 100% at Grade 7 (only 1 Q, no demonstrated), 68% at Grade 8 over 19.
    const ge = computeGradeEquivalent(
      byGrade([
        [5, 1, 0],
        [7, 1, 1],
        [8, 19, 13],
      ]),
      null,
      8
    );
    expect(ge).toMatchObject({ grade: 8, basis: "estimated" });
  });

  it("reports Below Grade 5 when the student fails down to the floor", () => {
    const ge = computeGradeEquivalent(
      byGrade([
        [5, 2, 0],
        [6, 2, 1],
        [9, 18, 7],
      ]),
      null,
      9
    );
    expect(ge).toMatchObject({ grade: null, basis: "below_floor", label: "Below Grade 5" });
  });

  it("places a mid student just under their weakest attempted grade", () => {
    // Never remediated below Grade 9; 44% there → about Grade 8.
    const ge = computeGradeEquivalent(byGrade([[9, 9, 4]]), null, 9);
    expect(ge).toMatchObject({ grade: 8, basis: "estimated" });
  });

  it("never contradicts a strong demonstrated grade with a low estimate", () => {
    const ge = computeGradeEquivalent(byGrade([[10, 5, 5]]), null, 10);
    expect(ge.basis).toBe("above_ceiling");
    expect(ge.grade).toBe(10);
  });

  it("empty history falls back to below floor via the selected grade", () => {
    const ge = computeGradeEquivalent(byGrade([]), null, 5);
    expect(ge.basis).toBe("below_floor");
  });
});
