// GET/POST /api/admin/classrooms — classroom rosters.
//   GET  (Viewer+) list with student counts.
//   POST (Admin)   create a classroom.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const auth = await requireRole("Viewer");
  if ("error" in auth) return auth.error;
  const rooms = await prisma.classroom.findMany({
    orderBy: [{ grade: "asc" }, { name: "asc" }],
    include: { _count: { select: { students: true } } },
  });
  return NextResponse.json({
    classrooms: rooms.map((r) => ({
      classroomId: r.classroomId,
      name: r.name,
      grade: r.grade,
      section: r.section,
      studentCount: r._count.students,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "A classroom name is required" }, { status: 400 });
  }
  const grade = gradeOrNull(body.grade);
  const section = body.section ? String(body.section).trim() : null;

  const room = await prisma.classroom.create({ data: { name, grade, section } });
  await logAudit(
    auth.session,
    "classroom.create",
    name,
    `Created classroom${grade ? ` (Grade ${grade}${section ? `-${section}` : ""})` : ""}`
  );
  return NextResponse.json(
    {
      classroom: {
        classroomId: room.classroomId,
        name: room.name,
        grade: room.grade,
        section: room.section,
        studentCount: 0,
        createdAt: room.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
}

function gradeOrNull(v: unknown): number | null {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : null;
}
