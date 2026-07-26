// GET /api/admin/syllabus — the NCERT syllabus, grade-first, readable by any
// signed-in staff (Viewer+). Editing textbooks still goes through the
// content-role endpoints under /api/content/curriculum/textbooks.
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { buildSyllabus } from "@/lib/curriculum/syllabus";

export async function GET() {
  const auth = await requireRole("Viewer");
  if ("error" in auth) return auth.error;
  return NextResponse.json({ grades: await buildSyllabus() });
}
