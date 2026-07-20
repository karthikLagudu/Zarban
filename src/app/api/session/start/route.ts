// POST /api/session/start → { student_id, selected_grade } → first question.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startSession } from "@/lib/engine/orchestrator";
import { clampGrade } from "@/lib/engine/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const school = String(body.school ?? "").trim();
    const email = String(body.email ?? "").trim() || null;
    const grade = clampGrade(parseInt(String(body.grade), 10) || 7);

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Reuse the student when the same email registers again.
    let student =
      email !== null
        ? await prisma.student.findUnique({ where: { email } })
        : null;
    if (!student) {
      student = await prisma.student.create({
        data: { name, school: school || null, email, classGrade: grade },
      });
    } else {
      student = await prisma.student.update({
        where: { studentId: student.studentId },
        data: { name, school: school || null, classGrade: grade },
      });
    }

    const { sessionId, step } = await startSession(student.studentId, grade);

    return NextResponse.json({
      student_id: student.studentId,
      session_id: sessionId,
      step,
    });
  } catch (e) {
    console.error("session/start failed", e);
    const message = e instanceof Error ? e.message : "Failed to start session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
