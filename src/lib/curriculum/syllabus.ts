// Builds the NCERT syllabus grade-first: every grade in order, each listing its
// textbooks (per subject) and chapters. Shared by the content-studio editor and
// the admin console read view.
import { prisma } from "@/lib/db";

export interface SyllabusGrade {
  grade: number;
  subjects: {
    subjectId: string;
    subjectName: string;
    textbooks: { textbookId: string; name: string; pdfUrl: string | null }[];
    chapters: { topicId: string; chapterNo: number | null; name: string }[];
    chapterCount: number;
  }[];
  textbookCount: number;
  chapterCount: number;
  /** How much assessment/practice content backs this grade — the link between
   *  the reference syllabus and the adaptive learning loop. */
  assessableSkills: number;
  practiceQuestions: number;
}

const baseGrade = (g: string | null): number => {
  const m = String(g ?? "").match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
};

export async function buildSyllabus(): Promise<SyllabusGrade[]> {
  const subjects = await prisma.subject.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      topics: { orderBy: [{ order: "asc" }, { chapterNo: "asc" }] },
      textbooks: { orderBy: { order: "asc" } },
    },
  });

  const gradeSet = new Set<number>();
  for (const s of subjects) {
    for (const t of s.topics) gradeSet.add(t.grade);
    for (const b of s.textbooks) gradeSet.add(b.grade);
  }
  const grades = [...gradeSet].sort((a, b) => a - b);

  // Backing content per grade: assessable skills + available practice questions.
  const [skillRows, questionRows] = await Promise.all([
    prisma.skill.findMany({ select: { gradeLevel: true } }),
    prisma.question.findMany({ select: { gradeLevel: true } }),
  ]);
  const skillsAtGrade = (g: number) =>
    skillRows.filter((s) => baseGrade(s.gradeLevel) === g).length;
  const questionsAtGrade = (g: number) =>
    questionRows.filter((q) => q.gradeLevel === g).length;

  return grades.map((grade) => {
    const subjectBlocks = subjects
      .map((s) => {
        const textbooks = s.textbooks
          .filter((b) => b.grade === grade)
          .map((b) => ({ textbookId: b.textbookId, name: b.name, pdfUrl: b.pdfUrl }));
        const chapters = s.topics
          .filter((t) => t.grade === grade)
          .map((t) => ({ topicId: t.topicId, chapterNo: t.chapterNo, name: t.name }));
        if (textbooks.length === 0 && chapters.length === 0) return null;
        return {
          subjectId: s.subjectId,
          subjectName: s.name,
          textbooks,
          chapters,
          chapterCount: chapters.length,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    return {
      grade,
      subjects: subjectBlocks,
      textbookCount: subjectBlocks.reduce((a, s) => a + s.textbooks.length, 0),
      chapterCount: subjectBlocks.reduce((a, s) => a + s.chapterCount, 0),
      assessableSkills: skillsAtGrade(grade),
      practiceQuestions: questionsAtGrade(grade),
    };
  });
}
