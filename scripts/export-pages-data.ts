import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const root = process.cwd();
const workbookPath = path.join(root, "data", "Adaptive_Math_SME_Template_v3_FILLED.xlsx");
const outputPath = path.join(root, "docs", "data.js");

const workbook = XLSX.read(fs.readFileSync(workbookPath));

function rows(name: string): Record<string, unknown>[] {
  const sheet = workbook.Sheets[name];
  if (!sheet) throw new Error(`Missing worksheet: ${name}`);
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

const skills = rows("1_Skills").map((row) => ({
  id: String(row.skill_id),
  name: String(row.skill_name),
  grade: String(row.grade_level),
  topic: String(row.topic_area),
  prerequisites: String(row.prerequisite_skill_ids || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
}));

const trapsByQuestion = new Map<string, Record<string, unknown>>();
for (const row of rows("4_AnswerTraps")) {
  const questionId = String(row.question_id);
  const options = trapsByQuestion.get(questionId) ?? {};
  options[String(row.option_label)] = {
    type: String(row.trap_type),
    misconception: String(row.misconception),
    detail: String(row.misconception_detail),
    action: String(row.remedial_action),
    skill: String(row.remedial_skill_id),
  };
  trapsByQuestion.set(questionId, options);
}

const dimensionsByQuestion = new Map(
  rows("5_Dimensions").map((row) => [
    String(row.question_id),
    {
      reading: Number(row.dim_reading) || 0,
      understanding: Number(row.dim_understanding) || 0,
      application: Number(row.dim_application) || 0,
      calculation: Number(row.dim_calculation) || 0,
      retention: Number(row.dim_retention) || 0,
      primary: String(row.primary_dimension || "Understanding"),
    },
  ])
);

const questions = rows("2_Questions").map((row) => ({
  id: String(row.question_id),
  text: String(row.question_text),
  skill: String(row.primary_skill_id),
  grade: Number(row.grade_level),
  band: String(row.difficulty_band),
  wordProblem: String(row.word_problem_flag).toUpperCase() === "YES",
  twinId: String(row.equation_twin_id || ""),
  options: ["A", "B", "C", "D"].map((label) => ({
    label,
    text: String(row[`option_${label}`]),
  })),
  correct: String(row.correct_option),
  traps: trapsByQuestion.get(String(row.question_id)) ?? {},
  dimensions: dimensionsByQuestion.get(String(row.question_id)),
}));

const payload = {
  version: 1,
  generatedAt: new Date().toISOString(),
  skills,
  questions,
};

fs.writeFileSync(
  outputPath,
  `window.ZARBAN_DATA = ${JSON.stringify(payload)};\n`,
  "utf8"
);

console.log(`Exported ${skills.length} skills and ${questions.length} questions to ${outputPath}`);
