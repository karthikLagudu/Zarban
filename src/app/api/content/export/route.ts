// GET /api/content/export — export the whole content bank as the 5-sheet SME
// workbook (round-trips the import format).
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { requireContentRole } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;

  const [skills, questions, qMatrix, traps, dims] = await Promise.all([
    prisma.skill.findMany({ orderBy: { skillId: "asc" } }),
    prisma.question.findMany({ orderBy: { questionId: "asc" } }),
    prisma.qMatrixEntry.findMany(),
    prisma.answerTrap.findMany({ orderBy: [{ questionId: "asc" }, { optionLabel: "asc" }] }),
    prisma.questionDimension.findMany(),
  ]);

  const allSkillIds = skills.map((s) => s.skillId);

  const sheet1 = skills.map((s) => ({
    skill_id: s.skillId,
    skill_name: s.skillName,
    grade_level: s.gradeLevel ?? "",
    topic_area: s.topicArea ?? "",
    difficulty_band: s.difficultyBand ?? "",
    prerequisite_skill_ids: s.prerequisiteSkillIds ?? "",
    notes: s.notes ?? "",
  }));

  const sheet2 = questions.map((q) => ({
    question_id: q.questionId,
    question_text: q.questionText,
    question_type: q.questionType ?? "MCQ",
    word_problem_flag: q.wordProblemFlag ? "YES" : "NO",
    equation_twin_id: q.equationTwinId ?? "",
    primary_skill_id: q.primarySkillId ?? "",
    secondary_skill_ids: q.secondarySkillIds ?? "",
    grade_level: q.gradeLevel ?? "",
    difficulty_band: q.difficultyBand ?? "",
    option_A: q.optionA ?? "",
    option_B: q.optionB ?? "",
    option_C: q.optionC ?? "",
    option_D: q.optionD ?? "",
    correct_option: q.correctOption ?? "",
  }));

  // Sheet 3 — Q-matrix as a binary grid (question × every skill column).
  const qmBySkill = new Map<string, Set<string>>();
  for (const m of qMatrix) {
    if (!qmBySkill.has(m.questionId)) qmBySkill.set(m.questionId, new Set());
    qmBySkill.get(m.questionId)!.add(m.skillId);
  }
  const bandByQuestion = new Map(questions.map((q) => [q.questionId, q.difficultyBand ?? ""]));
  const sheet3 = questions.map((q) => {
    const tested = qmBySkill.get(q.questionId) ?? new Set();
    const row: Record<string, string | number> = {
      question_id: q.questionId,
      difficulty_band: bandByQuestion.get(q.questionId) ?? "",
    };
    for (const sid of allSkillIds) row[sid] = tested.has(sid) ? 1 : 0;
    row["Skills Tested (auto)"] = tested.size;
    return row;
  });

  const sheet4 = traps.map((t) => ({
    question_id: t.questionId,
    option_label: t.optionLabel,
    option_text: t.optionText ?? "",
    trap_type: t.trapType ?? "",
    skill_gap_id: t.skillGapId ?? "",
    misconception: t.misconception ?? "",
    misconception_detail: t.misconceptionDetail ?? "",
    remedial_action: t.remedialAction ?? "",
    remedial_skill_id: t.remedialSkillId ?? "",
    remedial_grade: t.remedialGrade ?? "",
  }));

  const sheet5 = dims.map((d) => ({
    question_id: d.questionId,
    dim_reading: d.dimReading ? 1 : 0,
    dim_understanding: d.dimUnderstanding ? 1 : 0,
    dim_application: d.dimApplication ? 1 : 0,
    dim_calculation: d.dimCalculation ? 1 : 0,
    dim_retention: d.dimRetention ? 1 : 0,
    primary_dimension: d.primaryDimension ?? "",
    word_eq_pair_id: d.wordEqPairId ?? "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet1), "1_Skills");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet2), "2_Questions");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet3), "3_Q_Matrix");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet4), "4_AnswerTraps");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet5), "5_Dimensions");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Zarban_Content_Export_${date}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
