// DELETE /api/admin/classrooms/:id/students/:studentId — remove a student from
// a classroom (Admin). The student record and their history are preserved;
// only the classroom link is cleared.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; studentId: string }> }
) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const { id, studentId } = await params;

  const student = await prisma.student.findUnique({
    where: { studentId },
    include: { classroom: { select: { name: true } } },
  });
  if (!student || student.classroomId !== id) {
    return NextResponse.json(
      { error: "That student is not in this classroom" },
      { status: 404 }
    );
  }

  await prisma.student.update({ where: { studentId }, data: { classroomId: null } });
  await logAudit(
    auth.session,
    "classroom.remove_student",
    student.classroom?.name ?? id,
    `Removed ${student.name ?? studentId}`
  );
  return NextResponse.json({ ok: true });
}
