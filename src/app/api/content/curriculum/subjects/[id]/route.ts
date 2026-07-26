// PATCH/DELETE /api/content/curriculum/subjects/:id — rename or remove a
// subject (its topics cascade). Admin or Editor.
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
  const subject = await prisma.subject.findUnique({ where: { subjectId: id } });
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
  const clash = await prisma.subject.findUnique({ where: { name } });
  if (clash && clash.subjectId !== id) {
    return NextResponse.json({ error: "Another subject already has that name" }, { status: 409 });
  }
  const updated = await prisma.subject.update({ where: { subjectId: id }, data: { name } });
  return NextResponse.json({ subject: { subjectId: updated.subjectId, name: updated.name } });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const subject = await prisma.subject.findUnique({ where: { subjectId: id } });
  if (!subject) return NextResponse.json({ error: "Subject not found" }, { status: 404 });
  await prisma.topic.deleteMany({ where: { subjectId: id } });
  await prisma.subject.delete({ where: { subjectId: id } });
  return NextResponse.json({ ok: true });
}
