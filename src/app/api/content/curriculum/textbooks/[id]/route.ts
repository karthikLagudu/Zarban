// PATCH/DELETE /api/content/curriculum/textbooks/:id — set the soft-copy link,
// or remove a textbook. Admin/Editor.
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
  const textbook = await prisma.textbook.findUnique({ where: { textbookId: id } });
  if (!textbook) return NextResponse.json({ error: "Textbook not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  if (!("pdfUrl" in body)) {
    return NextResponse.json({ error: "pdfUrl is required" }, { status: 400 });
  }
  const raw = body.pdfUrl === null ? "" : String(body.pdfUrl).trim();
  if (raw && !/^https?:\/\//i.test(raw)) {
    return NextResponse.json({ error: "Link must start with http:// or https://" }, { status: 400 });
  }
  const updated = await prisma.textbook.update({
    where: { textbookId: id },
    data: { pdfUrl: raw || null },
  });
  return NextResponse.json({
    textbook: { textbookId: updated.textbookId, name: updated.name, pdfUrl: updated.pdfUrl },
  });
}

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
