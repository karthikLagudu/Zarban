// POST /api/content/import?mode=validate|commit — multipart 5-sheet Excel
// upload, available to content authors (Admin or Editor).
import { NextRequest, NextResponse } from "next/server";
import { requireContentRole } from "@/lib/auth";
import { parseWorkbook } from "@/lib/excel/parser";
import { commitImport, previewImport } from "@/lib/excel/importer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;

  const mode = req.nextUrl.searchParams.get("mode") ?? "validate";

  let file: File | null = null;
  try {
    const form = await req.formData();
    const f = form.get("file");
    if (f instanceof File) file = f;
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a 'file' field" },
      { status: 400 }
    );
  }
  if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = parseWorkbook(buffer);
  const report = {
    fileName: file.name,
    ok: parsed.ok,
    errors: parsed.issues.filter((i) => i.severity === "error"),
    warnings: parsed.issues.filter((i) => i.severity === "warning"),
    counts: {
      skills: parsed.skills.length,
      questions: parsed.questions.length,
      qMatrix: parsed.qMatrix.length,
      traps: parsed.traps.length,
      dimensions: parsed.dimensions.length,
    },
  };

  if (!parsed.ok) {
    return NextResponse.json(
      { ...report, message: "Validation failed — nothing was imported." },
      { status: 422 }
    );
  }

  const preview = await previewImport(parsed);
  if (mode === "validate") return NextResponse.json({ ...report, preview });

  const summary = await commitImport(parsed);
  return NextResponse.json({ ...report, preview, imported: summary, message: "Import committed successfully." });
}
