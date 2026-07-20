// POST /api/admin/import — multipart Excel upload (spec Part 6 API contract).
// ?mode=validate → validation report + preview diff (no writes)
// ?mode=commit   → bulk insert; rejected outright if validation errors exist.
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { parseWorkbook } from "@/lib/excel/parser";
import { commitImport, previewImport } from "@/lib/excel/importer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireRole("Admin");
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
  if (!file) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

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
    // Part 7.6 — reject with the detailed row/column error report.
    return NextResponse.json(
      { ...report, message: "Validation failed — nothing was imported." },
      { status: 422 }
    );
  }

  const preview = await previewImport(parsed);

  if (mode === "validate") {
    return NextResponse.json({ ...report, preview });
  }

  const summary = await commitImport(parsed);
  return NextResponse.json({
    ...report,
    preview,
    imported: summary,
    message: "Import committed successfully.",
  });
}
