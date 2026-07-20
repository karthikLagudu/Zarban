// SME workbook (5-sheet) parser + validator (spec Part 1 & Part 7.6).
// Produces either a detailed row/column-level validation error report or a
// normalized payload ready for bulk import.

import * as XLSX from "xlsx";

export interface ValidationIssue {
  sheet: string;
  row: number; // 1-based data row (excluding header), 0 = sheet-level
  column: string;
  severity: "error" | "warning";
  message: string;
}

export interface ParsedSkill {
  skill_id: string;
  skill_name: string;
  grade_level: string;
  topic_area: string;
  difficulty_band: string;
  prerequisite_skill_ids: string;
  notes: string;
}

export interface ParsedQuestion {
  question_id: string;
  question_text: string;
  question_type: string;
  word_problem_flag: boolean;
  equation_twin_id: string | null;
  primary_skill_id: string;
  secondary_skill_ids: string[];
  grade_level: number;
  difficulty_band: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
}

export interface ParsedTrap {
  question_id: string;
  option_label: string;
  option_text: string;
  trap_type: string;
  skill_gap_id: string | null;
  misconception: string;
  misconception_detail: string;
  remedial_action: string;
  remedial_skill_id: string | null;
  remedial_grade: number | null;
}

export interface ParsedDimension {
  question_id: string;
  dim_reading: boolean;
  dim_understanding: boolean;
  dim_application: boolean;
  dim_calculation: boolean;
  dim_retention: boolean;
  primary_dimension: string;
  word_eq_pair_id: string | null;
}

export interface ParsedWorkbook {
  skills: ParsedSkill[];
  questions: ParsedQuestion[];
  qMatrix: { question_id: string; skill_id: string }[];
  traps: ParsedTrap[];
  dimensions: ParsedDimension[];
  issues: ValidationIssue[];
  ok: boolean; // no blocking errors
}

const REQUIRED_SHEETS = [
  "1_Skills",
  "2_Questions",
  "3_Q_Matrix",
  "4_AnswerTraps",
  "5_Dimensions",
];

const TRAP_TYPES = new Set([
  "Calculation_Error",
  "Concept_Error",
  "Sign_Error",
  "Reading_Error",
  "Procedural_Error",
  "Careless_Slip",
]);
const REMEDIAL_ACTIONS = new Set([
  "serve_same_level",
  "go_down_grade",
  "go_prereq_skill",
  "flag_review",
]);
const BANDS = new Set(["easy", "medium", "hard"]);

const s = (v: unknown): string => (v === null || v === undefined ? "" : String(v).trim());
const yes = (v: unknown): boolean => /^(yes|true|1|y)$/i.test(s(v));

export function parseWorkbook(buffer: Buffer | Uint8Array): ParsedWorkbook {
  const issues: ValidationIssue[] = [];
  const result: ParsedWorkbook = {
    skills: [],
    questions: [],
    qMatrix: [],
    traps: [],
    dimensions: [],
    issues,
    ok: false,
  };

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "buffer" });
  } catch (e) {
    issues.push({
      sheet: "(workbook)",
      row: 0,
      column: "",
      severity: "error",
      message: `File could not be read as an Excel workbook: ${e instanceof Error ? e.message : e}`,
    });
    return result;
  }

  // Part 7.6 — every required sheet must exist.
  for (const name of REQUIRED_SHEETS) {
    if (!wb.SheetNames.includes(name)) {
      issues.push({
        sheet: name,
        row: 0,
        column: "",
        severity: "error",
        message: `Required sheet "${name}" is missing. Found sheets: ${wb.SheetNames.join(", ")}`,
      });
    }
  }
  if (issues.some((i) => i.severity === "error")) return result;

  const rows = (name: string): Record<string, unknown>[] =>
    XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" });

  // ── Sheet 1: Skills ────────────────────────────────────────────────────────
  const skillIds = new Set<string>();
  rows("1_Skills").forEach((r, idx) => {
    const row = idx + 1;
    const skill_id = s(r["skill_id"]);
    const skill_name = s(r["skill_name"]);
    if (!skill_id) {
      issues.push({ sheet: "1_Skills", row, column: "skill_id", severity: "error", message: "skill_id is required" });
      return;
    }
    if (skillIds.has(skill_id)) {
      issues.push({ sheet: "1_Skills", row, column: "skill_id", severity: "error", message: `Duplicate skill_id ${skill_id}` });
      return;
    }
    if (!skill_name) {
      issues.push({ sheet: "1_Skills", row, column: "skill_name", severity: "error", message: `skill_name is required for ${skill_id}` });
    }
    skillIds.add(skill_id);
    result.skills.push({
      skill_id,
      skill_name,
      grade_level: s(r["grade_level"]),
      topic_area: s(r["topic_area"]),
      difficulty_band: s(r["difficulty_band"]),
      prerequisite_skill_ids: s(r["prerequisite_skill_ids"]),
      notes: s(r["notes"]),
    });
  });

  // Prerequisite references must resolve.
  result.skills.forEach((sk, idx) => {
    for (const p of sk.prerequisite_skill_ids.split(",").map((x) => x.trim()).filter(Boolean)) {
      if (!skillIds.has(p)) {
        issues.push({
          sheet: "1_Skills",
          row: idx + 1,
          column: "prerequisite_skill_ids",
          severity: "error",
          message: `${sk.skill_id} lists unknown prerequisite "${p}"`,
        });
      }
    }
  });

  // ── Sheet 2: Questions ─────────────────────────────────────────────────────
  const questionIds = new Set<string>();
  rows("2_Questions").forEach((r, idx) => {
    const row = idx + 1;
    const question_id = s(r["question_id"]);
    if (!question_id) {
      issues.push({ sheet: "2_Questions", row, column: "question_id", severity: "error", message: "question_id is required" });
      return;
    }
    if (questionIds.has(question_id)) {
      issues.push({ sheet: "2_Questions", row, column: "question_id", severity: "error", message: `Duplicate question_id ${question_id}` });
      return;
    }
    const question_text = s(r["question_text"]);
    if (!question_text) {
      issues.push({ sheet: "2_Questions", row, column: "question_text", severity: "error", message: `question_text is required for ${question_id}` });
    }
    const primary_skill_id = s(r["primary_skill_id"]);
    if (!primary_skill_id) {
      issues.push({ sheet: "2_Questions", row, column: "primary_skill_id", severity: "error", message: `primary_skill_id is required for ${question_id}` });
    } else if (!skillIds.has(primary_skill_id)) {
      issues.push({ sheet: "2_Questions", row, column: "primary_skill_id", severity: "error", message: `${question_id}: unknown primary_skill_id "${primary_skill_id}"` });
    }
    const grade = parseInt(s(r["grade_level"]), 10);
    if (!Number.isFinite(grade) || grade < 5 || grade > 10) {
      issues.push({ sheet: "2_Questions", row, column: "grade_level", severity: "error", message: `${question_id}: grade_level must be 5–10 (got "${s(r["grade_level"])}")` });
    }
    const band = s(r["difficulty_band"]).toLowerCase();
    if (!BANDS.has(band)) {
      issues.push({ sheet: "2_Questions", row, column: "difficulty_band", severity: "error", message: `${question_id}: difficulty_band must be easy|medium|hard` });
    }
    const correct = s(r["correct_option"]).toUpperCase();
    if (!["A", "B", "C", "D"].includes(correct)) {
      issues.push({ sheet: "2_Questions", row, column: "correct_option", severity: "error", message: `${question_id}: correct_option must be A, B, C or D` });
    }
    const opts = ["option_A", "option_B", "option_C", "option_D"].map((k) => s(r[k]));
    if (opts.some((o) => !o)) {
      issues.push({ sheet: "2_Questions", row, column: "option_A..D", severity: "error", message: `${question_id}: all four MCQ options are required` });
    }
    const secondary = s(r["secondary_skill_ids"]).split(",").map((x) => x.trim()).filter(Boolean);
    for (const sec of secondary) {
      if (!skillIds.has(sec)) {
        issues.push({ sheet: "2_Questions", row, column: "secondary_skill_ids", severity: "error", message: `${question_id}: unknown secondary skill "${sec}"` });
      }
    }
    questionIds.add(question_id);
    result.questions.push({
      question_id,
      question_text,
      question_type: s(r["question_type"]) || "MCQ",
      word_problem_flag: yes(r["word_problem_flag"]),
      equation_twin_id: s(r["equation_twin_id"]) || null,
      primary_skill_id,
      secondary_skill_ids: secondary,
      grade_level: grade,
      difficulty_band: band,
      option_a: opts[0],
      option_b: opts[1],
      option_c: opts[2],
      option_d: opts[3],
      correct_option: correct,
    });
  });

  // Twin references (Part 7.4: missing twin is a warning — the engine skips
  // the diagnostic — but a twin id pointing nowhere is an error).
  result.questions.forEach((qq, idx) => {
    if (qq.equation_twin_id && !questionIds.has(qq.equation_twin_id)) {
      issues.push({
        sheet: "2_Questions",
        row: idx + 1,
        column: "equation_twin_id",
        severity: "error",
        message: `${qq.question_id}: equation_twin_id "${qq.equation_twin_id}" does not exist in 2_Questions`,
      });
    }
    if (qq.word_problem_flag && !qq.equation_twin_id) {
      issues.push({
        sheet: "2_Questions",
        row: idx + 1,
        column: "equation_twin_id",
        severity: "warning",
        message: `${qq.question_id}: word problem has no equation twin — the Twin Question diagnostic will be skipped for it`,
      });
    }
  });

  // ── Sheet 3: Q-Matrix ──────────────────────────────────────────────────────
  rows("3_Q_Matrix").forEach((r, idx) => {
    const row = idx + 1;
    const question_id = s(r["question_id"]);
    if (!question_id) {
      issues.push({ sheet: "3_Q_Matrix", row, column: "question_id", severity: "error", message: "question_id is required" });
      return;
    }
    if (!questionIds.has(question_id)) {
      issues.push({ sheet: "3_Q_Matrix", row, column: "question_id", severity: "error", message: `Unknown question_id "${question_id}"` });
      return;
    }
    let count = 0;
    for (const key of Object.keys(r)) {
      if (/^S_\d+$/i.test(key) && s(r[key]) === "1") {
        if (!skillIds.has(key)) {
          issues.push({ sheet: "3_Q_Matrix", row, column: key, severity: "error", message: `Column "${key}" is not a known skill` });
          continue;
        }
        result.qMatrix.push({ question_id, skill_id: key });
        count += 1;
      }
    }
    if (count === 0) {
      issues.push({ sheet: "3_Q_Matrix", row, column: "S_*", severity: "warning", message: `${question_id} tests no skills in the Q-Matrix` });
    }
  });

  // ── Sheet 4: Answer Traps ──────────────────────────────────────────────────
  const trapKeys = new Set<string>();
  rows("4_AnswerTraps").forEach((r, idx) => {
    const row = idx + 1;
    const question_id = s(r["question_id"]);
    const option_label = s(r["option_label"]).toUpperCase();
    if (!question_id || !questionIds.has(question_id)) {
      issues.push({ sheet: "4_AnswerTraps", row, column: "question_id", severity: "error", message: `Unknown or missing question_id "${question_id}"` });
      return;
    }
    if (!["A", "B", "C", "D"].includes(option_label)) {
      issues.push({ sheet: "4_AnswerTraps", row, column: "option_label", severity: "error", message: `${question_id}: option_label must be A–D` });
      return;
    }
    const key = `${question_id}:${option_label}`;
    if (trapKeys.has(key)) {
      issues.push({ sheet: "4_AnswerTraps", row, column: "option_label", severity: "error", message: `Duplicate trap for ${key}` });
      return;
    }
    trapKeys.add(key);
    const trap_type = s(r["trap_type"]);
    if (trap_type && !TRAP_TYPES.has(trap_type)) {
      issues.push({ sheet: "4_AnswerTraps", row, column: "trap_type", severity: "error", message: `${question_id}: invalid trap_type "${trap_type}"` });
    }
    const remedial_action = s(r["remedial_action"]);
    if (remedial_action && !REMEDIAL_ACTIONS.has(remedial_action)) {
      issues.push({ sheet: "4_AnswerTraps", row, column: "remedial_action", severity: "error", message: `${question_id}: invalid remedial_action "${remedial_action}"` });
    }
    const skill_gap_id = s(r["skill_gap_id"]) || null;
    if (skill_gap_id && !skillIds.has(skill_gap_id)) {
      issues.push({ sheet: "4_AnswerTraps", row, column: "skill_gap_id", severity: "error", message: `${question_id}: unknown skill_gap_id "${skill_gap_id}"` });
    }
    const remedial_skill_id = s(r["remedial_skill_id"]) || null;
    if (remedial_skill_id && !skillIds.has(remedial_skill_id)) {
      issues.push({ sheet: "4_AnswerTraps", row, column: "remedial_skill_id", severity: "error", message: `${question_id}: unknown remedial_skill_id "${remedial_skill_id}"` });
    }
    const rg = s(r["remedial_grade"]);
    const remedial_grade = rg ? parseInt(rg, 10) : null;
    result.traps.push({
      question_id,
      option_label,
      option_text: s(r["option_text"]),
      trap_type,
      skill_gap_id,
      misconception: s(r["misconception"]),
      misconception_detail: s(r["misconception_detail"]),
      remedial_action,
      remedial_skill_id,
      remedial_grade: Number.isFinite(remedial_grade as number) ? remedial_grade : null,
    });
  });

  // ── Sheet 5: Dimensions ────────────────────────────────────────────────────
  const dimIds = new Set<string>();
  rows("5_Dimensions").forEach((r, idx) => {
    const row = idx + 1;
    const question_id = s(r["question_id"]);
    if (!question_id || !questionIds.has(question_id)) {
      issues.push({ sheet: "5_Dimensions", row, column: "question_id", severity: "error", message: `Unknown or missing question_id "${question_id}"` });
      return;
    }
    if (dimIds.has(question_id)) {
      issues.push({ sheet: "5_Dimensions", row, column: "question_id", severity: "error", message: `Duplicate dimensions row for ${question_id}` });
      return;
    }
    dimIds.add(question_id);
    result.dimensions.push({
      question_id,
      dim_reading: s(r["dim_reading"]) === "1",
      dim_understanding: s(r["dim_understanding"]) === "1",
      dim_application: s(r["dim_application"]) === "1",
      dim_calculation: s(r["dim_calculation"]) === "1",
      dim_retention: s(r["dim_retention"]) === "1",
      primary_dimension: s(r["primary_dimension"]),
      word_eq_pair_id: s(r["word_eq_pair_id"]) || null,
    });
  });

  result.ok = !issues.some((i) => i.severity === "error");
  return result;
}
