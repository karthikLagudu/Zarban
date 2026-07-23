// Pure validation for content-portal question authoring — no DB imports, so
// it stays unit-testable in isolation.

export const TRAP_TYPES = new Set([
  "Calculation_Error",
  "Concept_Error",
  "Sign_Error",
  "Reading_Error",
  "Procedural_Error",
  "Careless_Slip",
]);
export const REMEDIAL_ACTIONS = new Set([
  "serve_same_level",
  "go_down_grade",
  "go_prereq_skill",
  "flag_review",
]);
export const DIMENSIONS = [
  "Reading",
  "Understanding",
  "Application",
  "Calculation",
  "Retention",
];

export interface TrapInput {
  optionLabel: string;
  optionText?: string;
  trapType?: string;
  skillGapId?: string;
  misconception?: string;
  misconceptionDetail?: string;
  remedialAction?: string;
  remedialSkillId?: string;
  remedialGrade?: number | string | null;
}

export interface QuestionContentInput {
  questionId: string;
  questionText: string;
  questionType?: string;
  wordProblemFlag?: boolean;
  equationTwinId?: string | null;
  primarySkillId: string;
  secondarySkillIds?: string;
  gradeLevel: number;
  difficultyBand: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  dimensions?: {
    dimReading?: boolean;
    dimUnderstanding?: boolean;
    dimApplication?: boolean;
    dimCalculation?: boolean;
    dimRetention?: boolean;
    primaryDimension?: string | null;
    wordEqPairId?: string | null;
  };
  qMatrixSkillIds?: string[];
  traps?: TrapInput[];
}

export function validateQuestionContent(body: Partial<QuestionContentInput>): string[] {
  const errors: string[] = [];
  if (!body.questionId) errors.push("questionId is required");
  if (!body.questionText) errors.push("questionText is required");
  if (!body.primarySkillId) errors.push("primarySkillId is required");
  const g = Number(body.gradeLevel);
  if (!Number.isFinite(g) || g < 5 || g > 10) errors.push("gradeLevel must be 5–10");
  if (!["easy", "medium", "hard"].includes(String(body.difficultyBand)))
    errors.push("difficultyBand must be easy|medium|hard");
  for (const k of ["optionA", "optionB", "optionC", "optionD"] as const) {
    if (!body[k]) errors.push(`${k} is required`);
  }
  if (!["A", "B", "C", "D"].includes(String(body.correctOption)))
    errors.push("correctOption must be A|B|C|D");
  for (const t of body.traps ?? []) {
    if (!["A", "B", "C", "D"].includes(t.optionLabel))
      errors.push(`trap optionLabel must be A|B|C|D (got "${t.optionLabel}")`);
    if (t.optionLabel === body.correctOption)
      errors.push(`trap ${t.optionLabel} is the correct option — traps are for wrong options only`);
    if (t.trapType && !TRAP_TYPES.has(t.trapType))
      errors.push(`invalid trap_type "${t.trapType}"`);
    if (t.remedialAction && !REMEDIAL_ACTIONS.has(t.remedialAction))
      errors.push(`invalid remedial_action "${t.remedialAction}"`);
  }
  if (
    body.dimensions?.primaryDimension &&
    !DIMENSIONS.includes(body.dimensions.primaryDimension)
  ) {
    errors.push(`invalid primary_dimension "${body.dimensions.primaryDimension}"`);
  }
  return errors;
}
