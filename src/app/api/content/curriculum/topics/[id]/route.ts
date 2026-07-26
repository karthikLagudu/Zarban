// PATCH/DELETE /api/content/curriculum/topics/:id — rename/re-grade or remove a
// topic. Admin or Editor.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireContentRole } from "@/lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const topic = await prisma.topic.findUnique({ where: { topicId: id } });
  if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; grade?: number } = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    data.name = name;
  }
  if (body.grade !== undefined) {
    const grade = parseInt(String(body.grade), 10);
    if (!Number.isFinite(grade) || grade < 1 || grade > 12) {
      return NextResponse.json({ error: "Grade must be between 1 and 12" }, { status: 400 });
    }
    data.grade = grade;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const updated = await prisma.topic.update({ where: { topicId: id }, data });
  return NextResponse.json({
    topic: {
      topicId: updated.topicId,
      grade: updated.grade,
      name: updated.name,
      chapterNo: updated.chapterNo,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const topic = await prisma.topic.findUnique({ where: { topicId: id } });
  if (!topic) return NextResponse.json({ error: "Topic not found" }, { status: 404 });
  await prisma.topic.delete({ where: { topicId: id } });
  return NextResponse.json({ ok: true });
}
