// QA gate for the generated question bank. Runs the real import-time validator
// plus content-quality checks and prints a report. Exits non-zero on any hard
// failure so it can gate CI / pre-commit.
//
//   npx tsx scripts/verify-workbook.ts

import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { parseWorkbook } from "../src/lib/excel/parser";
import { analyzeContent, type QuestionRec, type SkillRec } from "../src/lib/content/health";

const wbPath = path.join(process.cwd(), "data", "Adaptive_Math_SME_Template_v3_FILLED.xlsx");
if (!fs.existsSync(wbPath)) {
  console.error(`Workbook not found at ${wbPath} — run "npm run generate:workbook" first.`);
  process.exit(1);
}

const buf = fs.readFileSync(wbPath);
const wb = XLSX.read(buf, { type: "buffer" });
const rows = (name: string): Record<string, unknown>[] =>
  XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "" });

const skills = rows("1_Skills");
const questions = rows("2_Questions");
const traps = rows("4_AnswerTraps");
const dims = rows("5_Dimensions");

const s = (v: unknown) => String(v ?? "").trim();
let hardFailures = 0;
const warn = (m: string) => console.log("  ⚠ " + m);
const fail = (m: string) => {
  console.log("  ✗ " + m);
  hardFailures++;
};
const ok = (m: string) => console.log("  ✓ " + m);

console.log("═".repeat(64));
console.log("  ZARBAN QUESTION BANK — QA REPORT");
console.log("═".repeat(64));

// ── 1. Structural validation (the real import validator) ────────────────────
console.log("\n[1] Import-format validation");
const parsed = parseWorkbook(buf);
const errs = parsed.issues.filter((i) => i.severity === "error");
const warns = parsed.issues.filter((i) => i.severity === "warning");
if (errs.length === 0) ok(`No structural errors (${warns.length} non-blocking warnings)`);
else {
  fail(`${errs.length} structural errors`);
  errs.slice(0, 10).forEach((e) => console.log(`      [${e.sheet} r${e.row} ${e.column}] ${e.message}`));
}

// ── 2. Answer & distractor integrity ────────────────────────────────────────
console.log("\n[2] Answer & option integrity");
let badCorrect = 0;
let dupDistractor = 0;
for (const q of questions) {
  const correct = s(q.correct_option).toUpperCase();
  if (!["A", "B", "C", "D"].includes(correct)) {
    badCorrect++;
    continue;
  }
  const opts = ["A", "B", "C", "D"].map((L) => s(q[`option_${L}`]));
  if (opts.some((o) => o === "")) badCorrect++;
  const uniq = new Set(opts.map((o) => o.toLowerCase()));
  if (uniq.size !== 4) dupDistractor++;
}
if (badCorrect === 0) ok("Every question has 4 non-empty options and a valid A–D answer");
else fail(`${badCorrect} questions with a missing option or invalid correct answer`);
if (dupDistractor === 0) ok("No question has duplicate option text");
else fail(`${dupDistractor} questions have duplicate option text`);

// ── 3. Answer-trap coverage (every wrong option is diagnosed) ────────────────
console.log("\n[3] Misconception trap coverage");
const trapByQ = new Map<string, Set<string>>();
const trapTypes = new Map<string, number>();
const remedialActions = new Map<string, number>();
for (const t of traps) {
  const qid = s(t.question_id);
  if (!trapByQ.has(qid)) trapByQ.set(qid, new Set());
  trapByQ.get(qid)!.add(s(t.option_label).toUpperCase());
  trapTypes.set(s(t.trap_type), (trapTypes.get(s(t.trap_type)) ?? 0) + 1);
  remedialActions.set(s(t.remedial_action), (remedialActions.get(s(t.remedial_action)) ?? 0) + 1);
}
let missingTraps = 0;
for (const q of questions) {
  const correct = s(q.correct_option).toUpperCase();
  const wrong = ["A", "B", "C", "D"].filter((L) => L !== correct);
  const have = trapByQ.get(s(q.question_id)) ?? new Set();
  for (const w of wrong) if (!have.has(w)) missingTraps++;
}
if (missingTraps === 0) ok("Every wrong option has a classified misconception trap");
else fail(`${missingTraps} wrong options are missing a trap`);
console.log("      trap types:", [...trapTypes.entries()].map(([k, v]) => `${k}:${v}`).join("  "));
console.log("      remedial actions:", [...remedialActions.entries()].map(([k, v]) => `${k}:${v}`).join("  "));

// ── 4. Dimension tagging ─────────────────────────────────────────────────────
console.log("\n[4] Learning-dimension tagging");
const dimIds = new Set(dims.map((d) => s(d.question_id)));
const untagged = questions.filter((q) => !dimIds.has(s(q.question_id))).length;
if (untagged === 0) ok("Every question is tagged across the 5 learning dimensions");
else fail(`${untagged} questions have no dimension row`);

// ── 5. Twin integrity ────────────────────────────────────────────────────────
console.log("\n[5] Word-problem / equation-twin integrity");
const qIds = new Set(questions.map((q) => s(q.question_id)));
let brokenTwin = 0;
let wpNoTwin = 0;
const wordProblems = questions.filter((q) => /^yes$/i.test(s(q.word_problem_flag)));
for (const q of wordProblems) {
  const twin = s(q.equation_twin_id);
  if (!twin) wpNoTwin++;
  else if (!qIds.has(twin)) brokenTwin++;
}
if (brokenTwin === 0) ok(`All ${wordProblems.length} word problems point to an existing equation twin`);
else fail(`${brokenTwin} word problems reference a missing twin`);
if (wpNoTwin > 0) warn(`${wpNoTwin} word problems have no twin (Twin diagnostic will be skipped)`);

// ── 6. Coverage depth per {skill, band} ─────────────────────────────────────
console.log("\n[6] CAT coverage depth (items per skill × difficulty)");
// Count every servable item (word problems included) per skill × band.
const cell = new Map<string, number>();
for (const q of questions) {
  const key = `${s(q.primary_skill_id)}|${s(q.difficulty_band)}`;
  cell.set(key, (cell.get(key) ?? 0) + 1);
}
const perCell = [...cell.values()];
const minCell = Math.min(...perCell);
const avgCell = (perCell.reduce((a, b) => a + b, 0) / perCell.length).toFixed(1);
if (minCell >= 3) ok(`Every skill×band cell has ≥3 items (min ${minCell}, avg ${avgCell})`);
else warn(`Sparsest skill×band cell has only ${minCell} items (avg ${avgCell})`);

// ── 7. True duplicate items (stem AND options identical) ─────────────────────
// A shared stem with different option values (e.g. "Which is a prime number?"
// with different numbers) is a legitimate distinct item — only a full
// stem+options match is a real duplicate.
console.log("\n[7] Duplicate items (identical stem + options)");
const itemKeys = new Map<string, number>();
let sharedStem = 0;
const stemSeen = new Set<string>();
for (const q of questions) {
  const opts = ["A", "B", "C", "D"].map((L) => s(q[`option_${L}`]).toLowerCase()).sort();
  const key = `${s(q.primary_skill_id)}|${s(q.difficulty_band)}|${s(q.question_text).toLowerCase()}|${opts.join("¦")}`;
  itemKeys.set(key, (itemKeys.get(key) ?? 0) + 1);
  const stemKey = `${s(q.primary_skill_id)}|${s(q.question_text).toLowerCase()}`;
  if (stemSeen.has(stemKey)) sharedStem++;
  stemSeen.add(stemKey);
}
const trueDups = [...itemKeys.values()].filter((c) => c > 1).reduce((a, c) => a + (c - 1), 0);
if (trueDups === 0) ok(`No exact-duplicate items (${sharedStem} share a template with different values)`);
else fail(`${trueDups} exact-duplicate items (identical stem + options)`);

// ── 8. Health analysis (same lib the portal uses) ───────────────────────────
console.log("\n[8] Content health (portal analyzer)");
const trapCount = new Map<string, number>();
for (const t of traps) trapCount.set(s(t.question_id), (trapCount.get(s(t.question_id)) ?? 0) + 1);
const skillRecs: SkillRec[] = skills.map((sk) => ({
  skillId: s(sk.skill_id),
  skillName: s(sk.skill_name),
  gradeLevel: s(sk.grade_level) || null,
  topicArea: s(sk.topic_area) || null,
  prerequisiteSkillIds: s(sk.prerequisite_skill_ids) || null,
}));
const questionRecs: QuestionRec[] = questions.map((q) => ({
  questionId: s(q.question_id),
  primarySkillId: s(q.primary_skill_id) || null,
  gradeLevel: Number(q.grade_level) || null,
  difficultyBand: s(q.difficulty_band) || null,
  wordProblemFlag: /^yes$/i.test(s(q.word_problem_flag)),
  equationTwinId: s(q.equation_twin_id) || null,
  correctOption: s(q.correct_option) || null,
  trapCount: trapCount.get(s(q.question_id)) ?? 0,
  hasDimensions: dimIds.has(s(q.question_id)),
}));
const health = analyzeContent(skillRecs, questionRecs);
if (health.issueCounts.errors === 0) ok(`Health analyzer: 0 errors, ${health.issueCounts.warnings} warnings`);
else fail(`Health analyzer reports ${health.issueCounts.errors} errors`);

// ── Summary ──────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(64));
console.log(`  TOTALS: ${questions.length} questions · ${wordProblems.length} word problems · ${traps.length} traps · ${skills.length} skills`);
console.log(`  by grade:`, health.byGrade.map((g) => `G${g.grade}:${g.questions}`).join("  "));
console.log(`  by topic:`, health.byTopic.map((t) => `${t.topic}:${t.questions}`).join("  "));
console.log("─".repeat(64));
if (hardFailures === 0) {
  console.log("  ✅ QA PASSED — the dataset is sound.");
} else {
  console.log(`  ❌ QA FAILED — ${hardFailures} hard check(s) failed.`);
  process.exit(1);
}
