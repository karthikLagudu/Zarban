// GET /api/content/syllabus — the NCERT syllabus laid out grade-first (Admin or
// Editor). The admin console has its own Viewer+ read at /api/admin/syllabus.
import { NextResponse } from "next/server";
import { requireContentRole } from "@/lib/auth";
import { buildSyllabus } from "@/lib/curriculum/syllabus";

export async function GET() {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ grades: await buildSyllabus() });
}
