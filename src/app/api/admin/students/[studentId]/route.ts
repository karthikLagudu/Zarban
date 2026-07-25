// GET /api/admin/students/:id  — student detail + all sessions + BKT snapshot.
// PATCH /api/admin/students/:id — assign / move / clear the student's classroom.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const auth = await requireRole("Viewer");
  if ("error" in auth) return auth.error;

  const { studentId } = await params;
  const student = await prisma.student.findUnique({
    where: { studentId },
    include: {
      classroom: { select: { classroomId: true, name: true } },
      sessions: {
        orderBy: { startedAt: "desc" },
        include: { responses: { select: { isCorrect: true, twinProbe: true } } },
      },
      bktStates: { include: { skill: true }, orderBy: { pMastery: "asc" } },
    },
  });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  return NextResponse.json({
    student: {
      studentId: student.studentId,
      name: student.name,
      email: student.email,
      school: student.school,
      classGrade: student.classGrade,
      classroomId: student.classroomId,
      classroomName: student.classroom?.name ?? null,
      createdAt: student.createdAt.toISOString(),
    },
    sessions: student.sessions.map((s) => ({
      sessionId: s.sessionId,
      selectedGrade: s.selectedGrade,
      status: s.status,
      startedAt: s.startedAt.toISOString(),
      endedAt: s.endedAt?.toISOString() ?? null,
      questions: s.responses.length,
      accuracy: s.responses.length
        ? Math.round(
            (s.responses.filter((r) => r.isCorrect).length / s.responses.length) * 1000
          ) / 10
        : 0,
    })),
    bkt: student.bktStates.map((b) => ({
      skillId: b.skillId,
      skillName: b.skill.skillName,
      gradeLevel: b.skill.gradeLevel,
      pMastery: Math.round(b.pMastery * 1000) / 1000,
      attempts: b.attempts,
    })),
  });
}

// PATCH — set, move, or clear the student's classroom. Body { classroomId } is
// a classroom id to assign (works even if the student is already in another
// class — they are moved), or null/"" to unassign. Admin only.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const { studentId } = await params;
  const student = await prisma.student.findUnique({ where: { studentId } });
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  if (!("classroomId" in body)) {
    return NextResponse.json({ error: "classroomId is required" }, { status: 400 });
  }

  let classroomId: string | null = null;
  let roomName: string | null = null;
  if (body.classroomId !== null && String(body.classroomId) !== "") {
    const room = await prisma.classroom.findUnique({
      where: { classroomId: String(body.classroomId) },
    });
    if (!room) {
      return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
    }
    classroomId = room.classroomId;
    roomName = room.name;
  }

  await prisma.student.update({ where: { studentId }, data: { classroomId } });
  await logAudit(
    auth.session,
    classroomId ? "classroom.add_student" : "classroom.remove_student",
    roomName ?? "Unassigned",
    `${classroomId ? "Assigned" : "Unassigned"} ${student.name ?? studentId}`
  );
  return NextResponse.json({ ok: true, classroomId, classroomName: roomName });
}
