// Generates data/Adaptive_Math_SME_Template_v3_FILLED.xlsx — the 5-sheet SME
// workbook (spec Part 1) with 300+ NCERT-aligned questions across Grades 5–10.
// Deterministic (seeded PRNG): rerunning produces the identical workbook.

import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { SKILLS, SKILL_BY_ID, baseGrade, firstPrereq, type SkillDef } from "./workbook/skills";
import {
  buildQuestion,
  mulberry32,
  type Band,
  type DistractorSpec,
  type QuestionSpec,
} from "./workbook/builders";

interface QuestionRow {
  question_id: string;
  question_text: string;
  question_type: string;
  word_problem_flag: "YES" | "NO";
  equation_twin_id: string;
  primary_skill_id: string;
  secondary_skill_ids: string;
  grade_level: number;
  difficulty_band: Band;
  option_A: string;
  option_B: string;
  option_C: string;
  option_D: string;
  correct_option: string;
}

interface TrapRow {
  question_id: string;
  option_label: string;
  option_text: string;
  trap_type: string;
  skill_gap_id: string;
  misconception: string;
  misconception_detail: string;
  remedial_action: string;
  remedial_skill_id: string;
  remedial_grade: number;
}

const questionRows: QuestionRow[] = [];
const trapRows: TrapRow[] = [];
const qMatrixRows: Record<string, string | number>[] = [];
const dimensionRows: Record<string, string | number>[] = [];

const idCounters = new Map<string, number>();
function nextId(grade: number, slug: string): string {
  const key = `${grade}_${slug}`;
  const n = idCounters.get(key) ?? 0;
  idCounters.set(key, n + 1);
  return `ncrt_${grade}_${slug}_${String(n).padStart(4, "0")}`;
}

/** Map a trap type to its CDM remedial routing for this skill/grade. */
function remedialFor(
  trap: DistractorSpec["trap_type"],
  skill: SkillDef,
  grade: number
): { action: string; skillId: string; grade: number; gapId: string } {
  const prereq = firstPrereq(skill);
  switch (trap) {
    case "Concept_Error": {
      if (!prereq) {
        // Root skill: nowhere to descend — flag for teacher review instead.
        return { action: "flag_review", skillId: skill.skill_id, grade, gapId: skill.skill_id };
      }
      const target = SKILL_BY_ID.get(prereq)!;
      return {
        action: "go_down_grade",
        skillId: prereq,
        grade: Math.max(grade - 1, 5),
        gapId: prereq,
      };
    }
    case "Sign_Error": {
      const integerSkill = grade >= 7 ? "S_013" : "S_007";
      return {
        action: "go_prereq_skill",
        skillId: integerSkill,
        grade: integerSkill === "S_013" ? 7 : 6,
        gapId: integerSkill,
      };
    }
    case "Reading_Error":
      // Twin Question diagnostic handles the routing; stay at the same level.
      return { action: "serve_same_level", skillId: skill.skill_id, grade, gapId: skill.skill_id };
    case "Careless_Slip":
    case "Calculation_Error":
    case "Procedural_Error":
    default:
      return { action: "serve_same_level", skillId: skill.skill_id, grade, gapId: skill.skill_id };
  }
}

/** Deterministically place the correct answer + 3 distractors into A–D. */
function placeOptions(
  correct: string,
  distractors: DistractorSpec[],
  rng: () => number
): { options: [string, string, string, string]; correctLabel: string; trapByLabel: Map<string, DistractorSpec> } {
  const slots = [0, 1, 2, 3];
  // Fisher–Yates with the seeded rng.
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const texts: string[] = new Array(4);
  const trapByLabel = new Map<string, DistractorSpec>();
  const labels = ["A", "B", "C", "D"];
  texts[slots[0]] = correct;
  distractors.forEach((d, k) => {
    texts[slots[k + 1]] = d.text;
    trapByLabel.set(labels[slots[k + 1]], d);
  });
  return {
    options: texts as [string, string, string, string],
    correctLabel: labels[slots[0]],
    trapByLabel,
  };
}

function emitQuestion(
  skill: SkillDef,
  band: Band,
  grade: number,
  spec: {
    stem: string;
    correct: string;
    distractors: DistractorSpec[];
  },
  meta: {
    isWordProblem: boolean;
    equationTwinId: string;
    secondarySkills: string[];
    dims: QuestionSpec["dims"];
    primaryDimension: string;
    wordEqPairId: string;
  },
  rng: () => number
): string {
  const id = nextId(grade, skill.slug);
  const placed = placeOptions(spec.correct, spec.distractors, rng);

  questionRows.push({
    question_id: id,
    question_text: spec.stem,
    question_type: meta.isWordProblem ? "WordProblem" : "MCQ",
    word_problem_flag: meta.isWordProblem ? "YES" : "NO",
    equation_twin_id: meta.equationTwinId,
    primary_skill_id: skill.skill_id,
    secondary_skill_ids: meta.secondarySkills.join(", "),
    grade_level: grade,
    difficulty_band: band,
    option_A: placed.options[0],
    option_B: placed.options[1],
    option_C: placed.options[2],
    option_D: placed.options[3],
    correct_option: placed.correctLabel,
  });

  for (const [label, d] of placed.trapByLabel) {
    const remedial = remedialFor(d.trap_type, skill, grade);
    trapRows.push({
      question_id: id,
      option_label: label,
      option_text: d.text,
      trap_type: d.trap_type,
      skill_gap_id: remedial.gapId,
      misconception: d.misconception,
      misconception_detail: d.detail,
      remedial_action: remedial.action,
      remedial_skill_id: remedial.skillId,
      remedial_grade: remedial.grade,
    });
  }

  const qm: Record<string, string | number> = {
    question_id: id,
    difficulty_band: band,
  };
  const tested = new Set([skill.skill_id, ...meta.secondarySkills]);
  for (const s of SKILLS) qm[s.skill_id] = tested.has(s.skill_id) ? 1 : 0;
  qm["Skills Tested (auto)"] = tested.size;
  qMatrixRows.push(qm);

  dimensionRows.push({
    question_id: id,
    dim_reading: meta.dims.reading ? 1 : 0,
    dim_understanding: meta.dims.understanding ? 1 : 0,
    dim_application: meta.dims.application ? 1 : 0,
    dim_calculation: meta.dims.calculation ? 1 : 0,
    dim_retention: meta.dims.retention ? 1 : 0,
    primary_dimension: meta.primaryDimension,
    word_eq_pair_id: meta.wordEqPairId,
  });

  return id;
}

// ── Generate ─────────────────────────────────────────────────────────────────

const rng = mulberry32(20260717);
const PLAN: [Band, number][] = [
  ["easy", 3],
  ["medium", 3],
  ["hard", 2],
];

for (const skill of SKILLS) {
  const grade = baseGrade(skill);
  for (const [band, count] of PLAN) {
    for (let v = 0; v < count; v++) {
      const spec = buildQuestion(skill, band, v, rng);

      let twinId = "";
      if (spec.isWordProblem && spec.twin) {
        // Twin (equation-only) question is emitted first so the word problem
        // can reference its id. Twins never carry a word_problem_flag.
        twinId = emitQuestion(
          skill,
          band,
          grade,
          spec.twin,
          {
            isWordProblem: false,
            equationTwinId: "",
            secondarySkills: spec.secondarySkills ?? [],
            dims: { calculation: true },
            primaryDimension: "Calculation",
            wordEqPairId: "",
          },
          rng
        );
      }

      const qid = emitQuestion(
        skill,
        band,
        grade,
        spec,
        {
          isWordProblem: spec.isWordProblem ?? false,
          equationTwinId: twinId,
          secondarySkills: spec.secondarySkills ?? [],
          dims: spec.dims,
          primaryDimension: spec.primaryDimension,
          wordEqPairId: spec.isWordProblem ? twinId : "",
        },
        rng
      );

      // Back-fill the twin's word_eq_pair mirror (Sheet 5 column).
      if (twinId) {
        const twinDim = dimensionRows.find((r) => r.question_id === twinId);
        if (twinDim) twinDim.word_eq_pair_id = qid;
      }
    }
  }
}

// ── Write workbook ───────────────────────────────────────────────────────────

const skillRows = SKILLS.map((s) => ({
  skill_id: s.skill_id,
  skill_name: s.skill_name,
  grade_level: s.grade_level,
  topic_area: s.topic_area,
  difficulty_band: s.difficulty_band,
  prerequisite_skill_ids: s.prerequisite_skill_ids,
  notes: s.notes,
}));

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(skillRows), "1_Skills");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(questionRows), "2_Questions");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(qMatrixRows), "3_Q_Matrix");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(trapRows), "4_AnswerTraps");
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dimensionRows), "5_Dimensions");

const outDir = path.join(process.cwd(), "data");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "Adaptive_Math_SME_Template_v3_FILLED.xlsx");
XLSX.writeFile(wb, outPath);

const wordProblems = questionRows.filter((r) => r.word_problem_flag === "YES").length;
console.log(`Workbook written to ${outPath}`);
console.log(
  `  skills=${skillRows.length} questions=${questionRows.length} (word problems=${wordProblems}, equation twins=${questionRows.filter((r) => questionRows.some((w) => w.equation_twin_id === r.question_id)).length})`
);
console.log(`  traps=${trapRows.length} qmatrix=${qMatrixRows.length} dims=${dimensionRows.length}`);
