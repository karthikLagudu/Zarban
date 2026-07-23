import { describe, expect, it } from "vitest";
import {
  analyzeContent,
  type QuestionRec,
  type SkillRec,
} from "@/lib/content/health";

const skill = (id: string, over: Partial<SkillRec> = {}): SkillRec => ({
  skillId: id,
  skillName: `Skill ${id}`,
  gradeLevel: "7",
  topicArea: "Algebra",
  prerequisiteSkillIds: null,
  ...over,
});

const q = (id: string, over: Partial<QuestionRec> = {}): QuestionRec => ({
  questionId: id,
  primarySkillId: "S_001",
  gradeLevel: 7,
  difficultyBand: "medium",
  wordProblemFlag: false,
  equationTwinId: null,
  correctOption: "A",
  trapCount: 3,
  hasDimensions: true,
  ...over,
});

describe("content health analysis", () => {
  it("counts totals and root skills", () => {
    const h = analyzeContent(
      [skill("S_001"), skill("S_002", { prerequisiteSkillIds: "S_001" })],
      [q("q1"), q("q2", { wordProblemFlag: true, equationTwinId: "q1" })]
    );
    expect(h.totals.skills).toBe(2);
    expect(h.totals.questions).toBe(2);
    expect(h.totals.rootSkills).toBe(1);
    expect(h.totals.wordProblems).toBe(1);
    expect(h.totals.answerTraps).toBe(6);
  });

  it("flags a skill with no questions as an orphan warning", () => {
    const h = analyzeContent([skill("S_001"), skill("S_999")], [q("q1")]);
    expect(h.totals.orphanSkills).toBe(1);
    expect(h.issues.some((i) => i.kind === "skill-no-questions" && i.ref === "S_999")).toBe(true);
  });

  it("flags unknown prerequisites as errors", () => {
    const h = analyzeContent(
      [skill("S_001", { prerequisiteSkillIds: "S_404" })],
      [q("q1")]
    );
    expect(
      h.issues.some((i) => i.kind === "orphan-prerequisite" && i.severity === "error")
    ).toBe(true);
  });

  it("flags a word problem missing its twin and a broken twin ref", () => {
    const h = analyzeContent(
      [skill("S_001")],
      [
        q("wp1", { wordProblemFlag: true, equationTwinId: null }),
        q("wp2", { wordProblemFlag: true, equationTwinId: "ghost" }),
      ]
    );
    expect(h.issues.some((i) => i.kind === "word-problem-no-twin")).toBe(true);
    expect(
      h.issues.some((i) => i.kind === "twin-missing" && i.severity === "error")
    ).toBe(true);
  });

  it("flags questions with no traps and missing difficulty bands", () => {
    const h = analyzeContent(
      [skill("S_001")],
      [q("q1", { trapCount: 0, difficultyBand: "easy" })]
    );
    expect(h.issues.some((i) => i.kind === "question-no-traps")).toBe(true);
    // only "easy" present → medium + hard missing
    const missing = h.issues.filter((i) => i.kind === "missing-band").map((i) => i.message);
    expect(missing.some((m) => m.includes("medium"))).toBe(true);
    expect(missing.some((m) => m.includes("hard"))).toBe(true);
  });

  it("builds a coverage grid sorted by sparsest skill first", () => {
    const h = analyzeContent(
      [skill("S_001"), skill("S_002")],
      [
        q("a", { primarySkillId: "S_001", difficultyBand: "easy" }),
        q("b", { primarySkillId: "S_001", difficultyBand: "medium" }),
        q("c", { primarySkillId: "S_002", difficultyBand: "hard" }),
      ]
    );
    expect(h.coverage[0].total).toBeLessThanOrEqual(h.coverage[1].total);
    const s1 = h.coverage.find((c) => c.skillId === "S_001")!;
    expect(s1.easy).toBe(1);
    expect(s1.medium).toBe(1);
    expect(s1.total).toBe(2);
  });

  it("sorts errors before warnings", () => {
    const h = analyzeContent(
      [skill("S_001", { prerequisiteSkillIds: "S_404" }), skill("S_002")],
      [q("q1", { trapCount: 0 })]
    );
    const firstError = h.issues.findIndex((i) => i.severity === "error");
    const firstWarning = h.issues.findIndex((i) => i.severity === "warning");
    expect(firstError).toBeLessThan(firstWarning);
    expect(h.issueCounts.errors).toBeGreaterThan(0);
    expect(h.issueCounts.warnings).toBeGreaterThan(0);
  });
});
