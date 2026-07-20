// GET /api/session/report/:sessionId/pdf — downloadable PDF of the full
// diagnostic report (summary + complete question response analysis).
import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/engine/report";
import { renderReportPdf } from "@/lib/pdf/report-pdf";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const report = await generateReport(sessionId);
    const pdf = await renderReportPdf(report);

    const safeName = (report.student.name ?? "Student")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "_");
    const date = new Date(report.endedAt ?? report.startedAt)
      .toISOString()
      .slice(0, 10);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Zarban_Report_${safeName}_${date}.pdf"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("report pdf failed", e);
    const message = e instanceof Error ? e.message : "Failed to build PDF";
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
