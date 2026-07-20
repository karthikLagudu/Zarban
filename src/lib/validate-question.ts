// Shared form validation for manual question create/edit — mirrors the Excel
// schema rules (spec 5.2.4).

export function validateQuestionPayload(body: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!body.questionId || typeof body.questionId !== "string")
    errors.push("questionId is required");
  if (!body.questionText) errors.push("questionText is required");
  if (!body.primarySkillId) errors.push("primarySkillId is required");
  const grade = Number(body.gradeLevel);
  if (!Number.isFinite(grade) || grade < 5 || grade > 10)
    errors.push("gradeLevel must be 5–10");
  if (!["easy", "medium", "hard"].includes(String(body.difficultyBand)))
    errors.push("difficultyBand must be easy|medium|hard");
  for (const k of ["optionA", "optionB", "optionC", "optionD"]) {
    if (!body[k]) errors.push(`${k} is required`);
  }
  if (!["A", "B", "C", "D"].includes(String(body.correctOption)))
    errors.push("correctOption must be A|B|C|D");
  return errors;
}
