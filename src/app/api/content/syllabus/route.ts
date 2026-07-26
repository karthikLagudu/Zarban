// GET /api/content/syllabus — the NCERT syllabus laid out grade-first: every
// grade in order, each listing its textbooks (per subject) and chapters.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireContentRole } from "@/lib/auth";

export async function GET() {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;

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

  const result = grades.map((grade) => {
    const subjectBlocks = subjects
      .map((s) => {
        const textbooks = s.textbooks
          .filter((b) => b.grade === grade)
          .map((b) => ({ textbookId: b.textbookId, name: b.name }));
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
    };
  });

  return NextResponse.json({ grades: result });
}
