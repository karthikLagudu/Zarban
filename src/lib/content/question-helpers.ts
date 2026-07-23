// Shared helpers for full-content question management (question + options +
// answer traps + learning dimensions + Q-matrix), used by the content portal.

import { prisma } from "@/lib/db";
import { defaultItemParams } from "@/lib/engine/irt";
import type { QuestionContentInput } from "./question-validate";

export type { QuestionContentInput, TrapInput } from "./question-validate";
export { validateQuestionContent } from "./question-validate";

/** Create or fully replace a question and its traps/dimensions/Q-matrix. */
export async function upsertQuestionContent(input: QuestionContentInput) {
  const irt = defaultItemParams(input.gradeLevel, input.difficultyBand, input.questionId);
  const data = {
    questionText: input.questionText,
    questionType: input.questionType ?? (input.wordProblemFlag ? "WordProblem" : "MCQ"),
    wordProblemFlag: !!input.wordProblemFlag,
    equationTwinId: input.equationTwinId || null,
    primarySkillId: input.primarySkillId,
    secondarySkillIds: input.secondarySkillIds || null,
    gradeLevel: input.gradeLevel,
    difficultyBand: input.difficultyBand,
    optionA: input.optionA,
    optionB: input.optionB,
    optionC: input.optionC,
    optionD: input.optionD,
    correctOption: input.correctOption,
    irtA: irt.a,
    irtB: irt.b,
    irtC: irt.c,
  };

  await prisma.question.upsert({
    where: { questionId: input.questionId },
    create: { questionId: input.questionId, ...data },
    update: data,
  });

  // Q-matrix — the primary skill is always tested; merge any extra skills.
  const qSkills = new Set<string>([input.primarySkillId, ...(input.qMatrixSkillIds ?? [])]);
  await prisma.qMatrixEntry.deleteMany({ where: { questionId: input.questionId } });
  for (const skillId of qSkills) {
    const exists = await prisma.skill.findUnique({ where: { skillId } });
    if (exists) {
      await prisma.qMatrixEntry.create({ data: { questionId: input.questionId, skillId } });
    }
  }

  // Dimensions.
  const d = input.dimensions ?? {};
  await prisma.questionDimension.upsert({
    where: { questionId: input.questionId },
    create: {
      questionId: input.questionId,
      dimReading: !!d.dimReading,
      dimUnderstanding: !!d.dimUnderstanding,
      dimApplication: !!d.dimApplication,
      dimCalculation: !!d.dimCalculation,
      dimRetention: !!d.dimRetention,
      primaryDimension: d.primaryDimension || null,
      wordEqPairId: d.wordEqPairId || null,
    },
    update: {
      dimReading: !!d.dimReading,
      dimUnderstanding: !!d.dimUnderstanding,
      dimApplication: !!d.dimApplication,
      dimCalculation: !!d.dimCalculation,
      dimRetention: !!d.dimRetention,
      primaryDimension: d.primaryDimension || null,
      wordEqPairId: d.wordEqPairId || null,
    },
  });

  // Answer traps — replace the whole set.
  await prisma.answerTrap.deleteMany({ where: { questionId: input.questionId } });
  for (const t of input.traps ?? []) {
    const rg = t.remedialGrade == null || t.remedialGrade === "" ? null : Number(t.remedialGrade);
    await prisma.answerTrap.create({
      data: {
        questionId: input.questionId,
        optionLabel: t.optionLabel,
        optionText: t.optionText || null,
        trapType: t.trapType || null,
        skillGapId: t.skillGapId || null,
        misconception: t.misconception || null,
        misconceptionDetail: t.misconceptionDetail || null,
        remedialAction: t.remedialAction || null,
        remedialSkillId: t.remedialSkillId || null,
        remedialGrade: Number.isFinite(rg as number) ? (rg as number) : null,
      },
    });
  }
}
