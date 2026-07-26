// GET/POST /api/content/curriculum — the NCERT subject → topic catalog.
//   GET  every subject with its topics (Admin or Editor).
//   POST create a subject.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireContentRole } from "@/lib/auth";

export async function GET() {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;
  const subjects = await prisma.subject.findMany({
    orderBy: [{ order: "asc" }, { name: "asc" }],
    include: {
      topics: { orderBy: [{ grade: "asc" }, { order: "asc" }, { chapterNo: "asc" }] },
    },
  });
  return NextResponse.json({
    subjects: subjects.map((s) => ({
      subjectId: s.subjectId,
      name: s.name,
      topicCount: s.topics.length,
      topics: s.topics.map((t) => ({
        topicId: t.topicId,
        grade: t.grade,
        name: t.name,
        chapterNo: t.chapterNo,
      })),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Subject name is required" }, { status: 400 });
  const clash = await prisma.subject.findUnique({ where: { name } });
  if (clash) return NextResponse.json({ error: "That subject already exists" }, { status: 409 });

  const count = await prisma.subject.count();
  const subject = await prisma.subject.create({ data: { name, order: count } });
  return NextResponse.json(
    { subject: { subjectId: subject.subjectId, name: subject.name, topicCount: 0, topics: [] } },
    { status: 201 }
  );
}
