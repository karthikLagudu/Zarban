// POST /api/admin/classrooms/:id/students — add students to a classroom (Admin).
//   { studentIds: string[] }            → assign existing students.
//   { name, email?, grade? }            → create a new student and assign.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

function gradeOrNull(v: unknown): number | null {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const room = await prisma.classroom.findUnique({ where: { classroomId: id } });
  if (!room) return NextResponse.json({ error: "Classroom not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  // Path 1: create a brand-new roster student and assign them.
  if (body.name !== undefined && String(body.name).trim()) {
    const name = String(body.name).trim();
    const email = body.email ? String(body.email).trim().toLowerCase() : null;
    if (email) {
      const clash = await prisma.student.findUnique({ where: { email } });
      if (clash) {
        return NextResponse.json(
          { error: "A student with that email already exists" },
          { status: 409 }
        );
      }
    }
    const student = await prisma.student.create({
      data: {
        name,
        email,
        classGrade: gradeOrNull(body.grade) ?? room.grade,
        classroomId: id,
      },
    });
    await logAudit(auth.session, "classroom.add_student", room.name, `Added new student ${name}`);
    return NextResponse.json({ added: 1, studentId: student.studentId }, { status: 201 });
  }

  // Path 2: assign existing students.
  const studentIds: string[] = Array.isArray(body.studentIds)
    ? body.studentIds.map((s: unknown) => String(s))
    : [];
  if (studentIds.length === 0) {
    return NextResponse.json(
      { error: "Provide studentIds to assign, or a name to create a new student" },
      { status: 400 }
    );
  }
  const result = await prisma.student.updateMany({
    where: { studentId: { in: studentIds } },
    data: { classroomId: id },
  });
  await logAudit(
    auth.session,
    "classroom.add_student",
    room.name,
    `Assigned ${result.count} existing student${result.count === 1 ? "" : "s"}`
  );
  return NextResponse.json({ added: result.count });
}
