// POST /api/content/curriculum/topics — add a topic (chapter) to a subject at a
// given grade. Admin or Editor.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireContentRole } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const subjectId = String(body.subjectId ?? "");
  const name = String(body.name ?? "").trim();
  const grade = parseInt(String(body.grade), 10);

  if (!name) return NextResponse.json({ error: "Topic name is required" }, { status: 400 });
  if (!Number.isFinite(grade) || grade < 1 || grade > 12) {
    return NextResponse.json({ error: "Grade must be between 1 and 12" }, { status: 400 });
  }
  const subject = await prisma.subject.findUnique({ where: { subjectId } });
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  // Append to the end of that grade's chapter list.
  const inGrade = await prisma.topic.findMany({
    where: { subjectId, grade },
    orderBy: { order: "desc" },
    take: 1,
  });
  const nextOrder = (inGrade[0]?.order ?? -1) + 1;
  const nextChapter = await prisma.topic.count({ where: { subjectId, grade } });

  const topic = await prisma.topic.create({
    data: { subjectId, grade, name, order: nextOrder, chapterNo: nextChapter + 1 },
  });
  return NextResponse.json(
    {
      topic: {
        topicId: topic.topicId,
        grade: topic.grade,
        name: topic.name,
        chapterNo: topic.chapterNo,
      },
    },
    { status: 201 }
  );
}
