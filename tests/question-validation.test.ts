import { describe, expect, it } from "vitest";
import {
  validateQuestionContent,
  type QuestionContentInput,
} from "@/lib/content/question-validate";

const base: QuestionContentInput = {
  questionId: "ncrt_7_custom_0001",
  questionText: "What is 2 + 2?",
  primarySkillId: "S_002",
  gradeLevel: 7,
  difficultyBand: "medium",
  optionA: "4",
  optionB: "3",
  optionC: "5",
  optionD: "22",
  correctOption: "A",
};

describe("question content validation", () => {
  it("accepts a well-formed question", () => {
    expect(validateQuestionContent(base)).toEqual([]);
  });

  it("requires all four options and a correct answer", () => {
    const errs = validateQuestionContent({ ...base, optionC: "", correctOption: "Z" });
    expect(errs.some((e) => e.includes("optionC"))).toBe(true);
    expect(errs.some((e) => e.includes("correctOption"))).toBe(true);
  });

  it("rejects grades outside 5–10 and bad bands", () => {
    const errs = validateQuestionContent({ ...base, gradeLevel: 12, difficultyBand: "extreme" });
    expect(errs.some((e) => e.includes("gradeLevel"))).toBe(true);
    expect(errs.some((e) => e.includes("difficultyBand"))).toBe(true);
  });

  it("rejects a trap placed on the correct option", () => {
    const errs = validateQuestionContent({
      ...base,
      traps: [{ optionLabel: "A", trapType: "Concept_Error" }],
    });
    expect(errs.some((e) => e.includes("correct option"))).toBe(true);
  });

  it("rejects invalid trap types and remedial actions", () => {
    const errs = validateQuestionContent({
      ...base,
      traps: [{ optionLabel: "B", trapType: "Nonsense_Error", remedialAction: "teleport" }],
    });
    expect(errs.some((e) => e.includes("trap_type"))).toBe(true);
    expect(errs.some((e) => e.includes("remedial_action"))).toBe(true);
  });

  it("accepts valid traps on wrong options", () => {
    const errs = validateQuestionContent({
      ...base,
      traps: [
        { optionLabel: "B", trapType: "Calculation_Error", remedialAction: "serve_same_level" },
        { optionLabel: "C", trapType: "Concept_Error", remedialAction: "go_down_grade" },
      ],
    });
    expect(errs).toEqual([]);
  });

  it("rejects an unknown primary dimension", () => {
    const errs = validateQuestionContent({
      ...base,
      dimensions: { primaryDimension: "Telepathy" },
    });
    expect(errs.some((e) => e.includes("primary_dimension"))).toBe(true);
  });
});
