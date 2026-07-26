// GET/PATCH/DELETE /api/admin/classrooms/:id
//   GET    (Viewer+) classroom detail with its roster + light stats.
//   PATCH  (Admin)   rename / re-grade / re-section.
//   DELETE (Admin)   remove the classroom (students are kept, just unassigned).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

function gradeOrNull(v: unknown): number | null {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("Viewer");
  if ("error" in auth) return auth.error;
  const { id } = await params;

  const room = await prisma.classroom.findUnique({
    where: { classroomId: id },
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      students: {
        orderBy: { name: "asc" },
        include: {
          sessions: {
            orderBy: { startedAt: "desc" },
            include: { responses: { select: { isCorrect: true } } },
          },
        },
      },
    },
  });
  if (!room) return NextResponse.json({ error: "Classroom not found" }, { status: 404 });

  // Weakest BKT mastery per student, to flag skill gaps as "needs attention".
  const studentIds = room.students.map((s) => s.studentId);
  const bkt = studentIds.length
    ? await prisma.bktState.findMany({
        where: { studentId: { in: studentIds }, attempts: { gt: 0 } },
        include: { skill: { select: { skillName: true } } },
      })
    : [];
  const weakestBySrudent = new Map<string, { mastery: number; skill: string }>();
  for (const b of bkt) {
    const cur = weakestBySrudent.get(b.studentId);
    if (!cur || b.pMastery < cur.mastery) {
      weakestBySrudent.set(b.studentId, { mastery: b.pMastery, skill: b.skill.skillName });
    }
  }

  const students = room.students.map((st) => {
    const last = st.sessions[0] ?? null;
    const lastScore =
      last && last.responses.length
        ? Math.round(
            (last.responses.filter((r) => r.isCorrect).length / last.responses.length) * 1000
          ) / 10
        : null;
    // Monitoring signal: why (if at all) this student needs the teacher's attention.
    const weak = weakestBySrudent.get(st.studentId);
    let attention: string | null = null;
    if (st.sessions.length === 0) attention = "Not assessed yet";
    else if (lastScore !== null && lastScore < 50) attention = `Scored ${lastScore}% last time`;
    else if (weak && weak.mastery < 0.4) attention = `Gap in ${weak.skill}`;
    return {
      studentId: st.studentId,
      name: st.name,
      email: st.email,
      classGrade: st.classGrade,
      sessionCount: st.sessions.length,
      lastAssessmentAt: last?.startedAt.toISOString() ?? null,
      lastScore,
      lastSessionId: last?.sessionId ?? null,
      attention,
    };
  });
  const scored = students.filter((s) => s.lastScore !== null);
  const avgScore = scored.length
    ? Math.round((scored.reduce((a, s) => a + (s.lastScore ?? 0), 0) / scored.length) * 10) / 10
    : null;

  return NextResponse.json({
    classroom: {
      classroomId: room.classroomId,
      name: room.name,
      grade: room.grade,
      section: room.section,
      teacher: room.teacher ? { id: room.teacher.id, name: room.teacher.name ?? room.teacher.email } : null,
      createdAt: room.createdAt.toISOString(),
    },
    students,
    stats: {
      studentCount: students.length,
      assessedCount: scored.length,
      avgLastScore: avgScore,
      attentionCount: students.filter((s) => s.attention !== null).length,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const room = await prisma.classroom.findUnique({ where: { classroomId: id } });
  if (!room) return NextResponse.json({ error: "Classroom not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; grade?: number | null; section?: string | null; teacherId?: number | null } = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: "Name cannot be empty" }, { status: 400 });
    data.name = name;
  }
  if (body.grade !== undefined) data.grade = gradeOrNull(body.grade);
  if (body.section !== undefined) data.section = body.section ? String(body.section).trim() : null;
  if (body.teacherId !== undefined) {
    if (body.teacherId === null || String(body.teacherId) === "") {
      data.teacherId = null;
    } else {
      const t = await prisma.adminUser.findUnique({ where: { id: Number(body.teacherId) } });
      if (!t || (t.role !== "Teacher" && t.role !== "Admin")) {
        return NextResponse.json({ error: "Teacher must be a Teacher or Admin account" }, { status: 400 });
      }
      data.teacherId = t.id;
    }
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.classroom.update({
    where: { classroomId: id },
    data,
    include: { teacher: { select: { id: true, name: true, email: true } } },
  });
  await logAudit(auth.session, "classroom.update", updated.name, Object.keys(data).join(", "));
  return NextResponse.json({
    classroom: {
      classroomId: updated.classroomId,
      name: updated.name,
      grade: updated.grade,
      section: updated.section,
      teacher: updated.teacher
        ? { id: updated.teacher.id, name: updated.teacher.name ?? updated.teacher.email }
        : null,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const { id } = await params;
  const room = await prisma.classroom.findUnique({
    where: { classroomId: id },
    include: { _count: { select: { students: true } } },
  });
  if (!room) return NextResponse.json({ error: "Classroom not found" }, { status: 404 });

  // Unassign the roster first (belt-and-braces alongside the ON DELETE SET NULL),
  // then remove the classroom. Students and their history are preserved.
  await prisma.student.updateMany({
    where: { classroomId: id },
    data: { classroomId: null },
  });
  await prisma.classroom.delete({ where: { classroomId: id } });
  await logAudit(
    auth.session,
    "classroom.delete",
    room.name,
    `Removed classroom (${room._count.students} students unassigned)`
  );
  return NextResponse.json({ ok: true });
}
