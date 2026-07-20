// Bulk import of a validated workbook into the database, plus the new-vs-
// existing preview diff shown in the admin import panel before committing.

import { prisma } from "@/lib/db";
import { defaultItemParams } from "@/lib/engine/irt";
import type { ParsedWorkbook } from "./parser";

export interface ImportPreview {
  skills: { new: number; existing: number };
  questions: { new: number; existing: number };
  qMatrix: { rows: number };
  traps: { rows: number };
  dimensions: { rows: number };
  sampleNewQuestions: string[];
}

export async function previewImport(parsed: ParsedWorkbook): Promise<ImportPreview> {
  const existingSkills = new Set(
    (await prisma.skill.findMany({ select: { skillId: true } })).map((x) => x.skillId)
  );
  const existingQuestions = new Set(
    (await prisma.question.findMany({ select: { questionId: true } })).map(
      (x) => x.questionId
    )
  );
  const newQ = parsed.questions.filter((q) => !existingQuestions.has(q.question_id));
  return {
    skills: {
      new: parsed.skills.filter((s) => !existingSkills.has(s.skill_id)).length,
      existing: parsed.skills.filter((s) => existingSkills.has(s.skill_id)).length,
    },
    questions: {
      new: newQ.length,
      existing: parsed.questions.length - newQ.length,
    },
    qMatrix: { rows: parsed.qMatrix.length },
    traps: { rows: parsed.traps.length },
    dimensions: { rows: parsed.dimensions.length },
    sampleNewQuestions: newQ.slice(0, 5).map((q) => q.question_id),
  };
}

export interface ImportSummary {
  skills: number;
  knowledgeGraphEdges: number;
  questions: number;
  qMatrix: number;
  traps: number;
  dimensions: number;
}

/** Upsert everything. Order matters for FK integrity; twin ids are linked in a
 *  second pass so forward references inside the sheet are safe. */
export async function commitImport(parsed: ParsedWorkbook): Promise<ImportSummary> {
  if (!parsed.ok) throw new Error("Cannot import a workbook with validation errors");

  // 1. Skills.
  for (const s of parsed.skills) {
    await prisma.skill.upsert({
      where: { skillId: s.skill_id },
      create: {
        skillId: s.skill_id,
        skillName: s.skill_name,
        gradeLevel: s.grade_level || null,
        topicArea: s.topic_area || null,
        difficultyBand: s.difficulty_band || null,
        prerequisiteSkillIds: s.prerequisite_skill_ids || null,
        notes: s.notes || null,
      },
      update: {
        skillName: s.skill_name,
        gradeLevel: s.grade_level || null,
        topicArea: s.topic_area || null,
        difficultyBand: s.difficulty_band || null,
        prerequisiteSkillIds: s.prerequisite_skill_ids || null,
        notes: s.notes || null,
      },
    });
  }

  // 2. Knowledge graph (rebuilt from prerequisite_skill_ids).
  let edges = 0;
  for (const s of parsed.skills) {
    await prisma.knowledgeGraphEdge.deleteMany({ where: { childSkillId: s.skill_id } });
    const parents = s.prerequisite_skill_ids
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    for (const p of parents) {
      await prisma.knowledgeGraphEdge.create({
        data: { childSkillId: s.skill_id, parentSkillId: p },
      });
      edges += 1;
    }
  }

  // 3. Questions (pass 1: without twin links).
  for (const q of parsed.questions) {
    const irt = defaultItemParams(q.grade_level, q.difficulty_band, q.question_id);
    const data = {
      questionText: q.question_text,
      questionType: q.question_type,
      wordProblemFlag: q.word_problem_flag,
      primarySkillId: q.primary_skill_id,
      secondarySkillIds: q.secondary_skill_ids.join(", ") || null,
      gradeLevel: q.grade_level,
      difficultyBand: q.difficulty_band,
      optionA: q.option_a,
      optionB: q.option_b,
      optionC: q.option_c,
      optionD: q.option_d,
      correctOption: q.correct_option,
      irtA: irt.a,
      irtB: irt.b,
      irtC: irt.c,
    };
    await prisma.question.upsert({
      where: { questionId: q.question_id },
      create: { questionId: q.question_id, equationTwinId: null, ...data },
      update: { ...data },
    });
  }
  // Pass 2: twin links.
  for (const q of parsed.questions) {
    await prisma.question.update({
      where: { questionId: q.question_id },
      data: { equationTwinId: q.equation_twin_id },
    });
  }

  // 4. Q-Matrix (replace per imported question).
  const importedIds = parsed.questions.map((q) => q.question_id);
  await prisma.qMatrixEntry.deleteMany({ where: { questionId: { in: importedIds } } });
  for (const m of parsed.qMatrix) {
    await prisma.qMatrixEntry.create({
      data: { questionId: m.question_id, skillId: m.skill_id },
    });
  }

  // 5. Answer traps (replace per imported question).
  await prisma.answerTrap.deleteMany({ where: { questionId: { in: importedIds } } });
  for (const t of parsed.traps) {
    await prisma.answerTrap.create({
      data: {
        questionId: t.question_id,
        optionLabel: t.option_label,
        optionText: t.option_text || null,
        trapType: t.trap_type || null,
        skillGapId: t.skill_gap_id,
        misconception: t.misconception || null,
        misconceptionDetail: t.misconception_detail || null,
        remedialAction: t.remedial_action || null,
        remedialSkillId: t.remedial_skill_id,
        remedialGrade: t.remedial_grade,
      },
    });
  }

  // 6. Dimensions.
  for (const d of parsed.dimensions) {
    await prisma.questionDimension.upsert({
      where: { questionId: d.question_id },
      create: {
        questionId: d.question_id,
        dimReading: d.dim_reading,
        dimUnderstanding: d.dim_understanding,
        dimApplication: d.dim_application,
        dimCalculation: d.dim_calculation,
        dimRetention: d.dim_retention,
        primaryDimension: d.primary_dimension || null,
        wordEqPairId: d.word_eq_pair_id,
      },
      update: {
        dimReading: d.dim_reading,
        dimUnderstanding: d.dim_understanding,
        dimApplication: d.dim_application,
        dimCalculation: d.dim_calculation,
        dimRetention: d.dim_retention,
        primaryDimension: d.primary_dimension || null,
        wordEqPairId: d.word_eq_pair_id,
      },
    });
  }

  return {
    skills: parsed.skills.length,
    knowledgeGraphEdges: edges,
    questions: parsed.questions.length,
    qMatrix: parsed.qMatrix.length,
    traps: parsed.traps.length,
    dimensions: parsed.dimensions.length,
  };
}
