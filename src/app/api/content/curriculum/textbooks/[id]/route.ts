// DELETE /api/content/curriculum/textbooks/:id — remove a textbook. Admin/Editor.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireContentRole } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const textbook = await prisma.textbook.findUnique({ where: { textbookId: id } });
  if (!textbook) return NextResponse.json({ error: "Textbook not found" }, { status: 404 });
  await prisma.textbook.delete({ where: { textbookId: id } });
  return NextResponse.json({ ok: true });
}
