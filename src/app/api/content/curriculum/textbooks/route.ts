// POST /api/content/curriculum/textbooks — add an NCERT textbook to a subject
// at a grade. Admin or Editor.
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

  if (!name) return NextResponse.json({ error: "Textbook name is required" }, { status: 400 });
  if (!Number.isFinite(grade) || grade < 1 || grade > 12) {
    return NextResponse.json({ error: "Grade must be between 1 and 12" }, { status: 400 });
  }
  const subject = await prisma.subject.findUnique({ where: { subjectId } });
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const nextOrder = await prisma.textbook.count({ where: { subjectId, grade } });
  const textbook = await prisma.textbook.create({
    data: { subjectId, grade, name, order: nextOrder },
  });
  return NextResponse.json(
    { textbook: { textbookId: textbook.textbookId, name: textbook.name, grade: textbook.grade } },
    { status: 201 }
  );
}
