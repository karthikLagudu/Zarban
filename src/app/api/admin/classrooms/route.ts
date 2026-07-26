// GET/POST /api/admin/classrooms — classroom rosters (optionally teacher-owned).
//   GET  (Viewer+) list with student counts, teacher, and an attention count.
//        ?mine=1 limits to classrooms owned by the signed-in user (teacher view).
//   POST (Admin)   create a classroom, optionally assigning a teacher.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

function gradeOrNull(v: unknown): number | null {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n >= 1 && n <= 12 ? n : null;
}

function lastScoreOf(sessions: { responses: { isCorrect: boolean | null }[] }[]): number | null {
  const last = sessions[0];
  if (!last) return null;
  if (last.responses.length === 0) return 0;
  return Math.round(
    (last.responses.filter((r) => r.isCorrect).length / last.responses.length) * 1000
  ) / 10;
}

export async function GET(req: NextRequest) {
  const auth = await requireRole("Viewer");
  if ("error" in auth) return auth.error;
  const mine = req.nextUrl.searchParams.get("mine") === "1";

  const rooms = await prisma.classroom.findMany({
    where: mine ? { teacherId: auth.session.userId } : {},
    orderBy: [{ grade: "asc" }, { name: "asc" }],
    include: {
      teacher: { select: { id: true, name: true, email: true } },
      students: {
        select: {
          studentId: true,
          sessions: {
            orderBy: { startedAt: "desc" },
            take: 1,
            select: { responses: { select: { isCorrect: true } } },
          },
        },
      },
    },
  });

  return NextResponse.json({
    classrooms: rooms.map((r) => {
      const scores = r.students.map((s) => lastScoreOf(s.sessions));
      const assessed = scores.filter((v) => v !== null) as number[];
      // "Needs attention" on the list = not assessed, or scored under 50%.
      const attention = r.students.filter((s) => {
        const sc = lastScoreOf(s.sessions);
        return sc === null || sc < 50;
      }).length;
      return {
        classroomId: r.classroomId,
        name: r.name,
        grade: r.grade,
        section: r.section,
        teacher: r.teacher ? { id: r.teacher.id, name: r.teacher.name ?? r.teacher.email } : null,
        studentCount: r.students.length,
        attentionCount: attention,
        avgLastScore: assessed.length
          ? Math.round((assessed.reduce((a, b) => a + b, 0) / assessed.length) * 10) / 10
          : null,
        createdAt: r.createdAt.toISOString(),
      };
    }),
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

  let teacherId: number | null = null;
  if (body.teacherId !== undefined && body.teacherId !== null && String(body.teacherId) !== "") {
    const t = await prisma.adminUser.findUnique({ where: { id: Number(body.teacherId) } });
    if (!t || (t.role !== "Teacher" && t.role !== "Admin")) {
      return NextResponse.json({ error: "Teacher must be a Teacher or Admin account" }, { status: 400 });
    }
    teacherId = t.id;
  }

  const room = await prisma.classroom.create({ data: { name, grade, section, teacherId } });
  await logAudit(auth.session, "classroom.create", name, `Created classroom${grade ? ` (Grade ${grade})` : ""}`);
  return NextResponse.json(
    {
      classroom: {
        classroomId: room.classroomId,
        name: room.name,
        grade: room.grade,
        section: room.section,
        studentCount: 0,
        attentionCount: 0,
        avgLastScore: null,
        teacher: null,
        createdAt: room.createdAt.toISOString(),
      },
    },
    { status: 201 }
  );
}
