// Node-native reseed of prisma/dev.db from the generated workbook.
//
// The standard `npm run seed` imports the Cloudflare Workers DB client and so
// cannot run under Node. This script loads the curriculum (skills, knowledge
// graph, questions, Q-matrix, answer traps, dimensions) straight into the local
// SQLite dev.db via node:sqlite, and ensures the admin accounts + settings
// exist. dev.db is then the source for `scripts/export-d1-migration.py`.
//
//   npx tsx scripts/seed-devdb.ts

import { DatabaseSync } from "node:sqlite";
import * as fs from "fs";
import * as path from "path";
import bcrypt from "bcryptjs";
import { parseWorkbook } from "../src/lib/excel/parser";
import { defaultItemParams } from "../src/lib/engine/irt";

const ROOT = process.cwd();
const DB_PATH = path.join(ROOT, "prisma", "dev.db");
const WB_PATH = path.join(ROOT, "data", "Adaptive_Math_SME_Template_v3_FILLED.xlsx");

if (!fs.existsSync(WB_PATH)) {
  console.error(`Workbook not found at ${WB_PATH} — run "npm run generate:workbook" first.`);
  process.exit(1);
}

const parsed = parseWorkbook(fs.readFileSync(WB_PATH));
const errors = parsed.issues.filter((i) => i.severity === "error");
if (errors.length) {
  console.error(`${errors.length} validation errors — aborting.`);
  for (const e of errors.slice(0, 10)) console.error(`  [${e.sheet} r${e.row} ${e.column}] ${e.message}`);
  process.exit(1);
}

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = OFF");
db.exec("BEGIN");

try {
  // Wipe learner history + curriculum; keep admin_users and settings.
  for (const t of [
    "responses", "bkt_state", "dimension_scores", "traversal_events", "review_flags",
    "sessions", "students",
    "answer_traps", "q_matrix", "question_dimensions", "knowledge_graph", "questions", "skills",
  ]) {
    db.exec(`DELETE FROM "${t}"`);
  }

  // Skills.
  const insSkill = db.prepare(
    `INSERT INTO skills (skill_id, skill_name, grade_level, topic_area, difficulty_band, prerequisite_skill_ids, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const s of parsed.skills) {
    insSkill.run(s.skill_id, s.skill_name, s.grade_level || null, s.topic_area || null,
      s.difficulty_band || null, s.prerequisite_skill_ids || null, s.notes || null);
  }

  // Knowledge graph from prerequisite_skill_ids.
  const skillIds = new Set(parsed.skills.map((s) => s.skill_id));
  const insEdge = db.prepare(`INSERT INTO knowledge_graph (child_skill_id, parent_skill_id) VALUES (?, ?)`);
  for (const s of parsed.skills) {
    for (const p of (s.prerequisite_skill_ids || "").split(",").map((x) => x.trim()).filter(Boolean)) {
      if (skillIds.has(p)) insEdge.run(s.skill_id, p);
    }
  }

  // Questions (IRT params calibrated per item, matching the importer).
  const insQ = db.prepare(
    `INSERT INTO questions (question_id, question_text, question_type, word_problem_flag,
       equation_twin_id, primary_skill_id, secondary_skill_ids, grade_level, difficulty_band,
       option_a, option_b, option_c, option_d, correct_option, irt_a, irt_b, irt_c)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  for (const q of parsed.questions) {
    const irt = defaultItemParams(q.grade_level, q.difficulty_band, q.question_id);
    insQ.run(q.question_id, q.question_text, q.question_type, q.word_problem_flag ? 1 : 0,
      q.equation_twin_id, q.primary_skill_id, q.secondary_skill_ids.join(", ") || null,
      q.grade_level, q.difficulty_band, q.option_a, q.option_b, q.option_c, q.option_d,
      q.correct_option, irt.a, irt.b, irt.c);
  }

  // Q-matrix.
  const insQM = db.prepare(`INSERT INTO q_matrix (question_id, skill_id) VALUES (?, ?)`);
  for (const m of parsed.qMatrix) insQM.run(m.question_id, m.skill_id);

  // Answer traps.
  const insTrap = db.prepare(
    `INSERT INTO answer_traps (question_id, option_label, option_text, trap_type, skill_gap_id,
       misconception, misconception_detail, remedial_action, remedial_skill_id, remedial_grade)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  );
  for (const t of parsed.traps) {
    insTrap.run(t.question_id, t.option_label, t.option_text || null, t.trap_type || null,
      t.skill_gap_id, t.misconception || null, t.misconception_detail || null,
      t.remedial_action || null, t.remedial_skill_id, t.remedial_grade);
  }

  // Dimensions.
  const insDim = db.prepare(
    `INSERT INTO question_dimensions (question_id, dim_reading, dim_understanding, dim_application,
       dim_calculation, dim_retention, primary_dimension, word_eq_pair_id)
     VALUES (?,?,?,?,?,?,?,?)`
  );
  for (const d of parsed.dimensions) {
    insDim.run(d.question_id, d.dim_reading ? 1 : 0, d.dim_understanding ? 1 : 0,
      d.dim_application ? 1 : 0, d.dim_calculation ? 1 : 0, d.dim_retention ? 1 : 0,
      d.primary_dimension || null, d.word_eq_pair_id);
  }

  // Admin accounts (upsert) + settings.
  const accounts = [
    ["admin@zarban.local", "Admin", "Admin", "admin123"],
    ["teacher@zarban.local", "Teacher", "Teacher", "teacher123"],
    ["viewer@zarban.local", "Viewer", "Viewer", "viewer123"],
    ["editor@zarban.local", "Content Editor", "Editor", "editor123"],
  ];
  for (const [email, name, role, pw] of accounts) {
    const existing = db.prepare("SELECT id FROM admin_users WHERE email = ?").get(email);
    const hash = bcrypt.hashSync(pw, 10);
    if (existing) {
      db.prepare("UPDATE admin_users SET name=?, role=?, password_hash=? WHERE email=?").run(name, role, hash, email);
    } else {
      db.prepare("INSERT INTO admin_users (email, name, role, password_hash, created_at) VALUES (?,?,?,?,?)")
        .run(email, name, role, hash, new Date().toISOString());
    }
  }
  for (const [key, value] of [
    ["max_questions", "30"],
    ["test_timer_minutes", "0"],
  ] as [string, string][]) {
    const ex = db.prepare("SELECT key FROM settings WHERE key = ?").get(key);
    if (!ex) db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run(key, value);
  }

  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
}

const count = (t: string) => (db.prepare(`SELECT COUNT(*) c FROM "${t}"`).get() as { c: number }).c;
console.log(
  `dev.db reseeded: skills=${count("skills")} questions=${count("questions")} ` +
  `traps=${count("answer_traps")} qmatrix=${count("q_matrix")} dims=${count("question_dimensions")} ` +
  `edges=${count("knowledge_graph")} accounts=${count("admin_users")}`
);
db.close();
