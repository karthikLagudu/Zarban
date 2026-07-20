// GET /api/session/report/:session_id → full diagnostic report object.
import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/engine/report";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const report = await generateReport(sessionId);
    return NextResponse.json(report);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to build report";
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
