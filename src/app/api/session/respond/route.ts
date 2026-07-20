// POST /api/session/respond → { session_id, question_id, selected_option }
// → next question + updated BKT state (spec Part 6 API contract).
import { NextRequest, NextResponse } from "next/server";
import { processResponse } from "@/lib/engine/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }
    const sessionId = String(body.session_id ?? "");
    const questionId = String(body.question_id ?? "");
    const selectedOption = String(body.selected_option ?? "");
    const responseTimeMs = Number.isFinite(Number(body.response_time_ms))
      ? Number(body.response_time_ms)
      : undefined;

    if (!sessionId || !questionId || !selectedOption) {
      return NextResponse.json(
        { error: "session_id, question_id and selected_option are required" },
        { status: 400 }
      );
    }

    const step = await processResponse(
      sessionId,
      questionId,
      selectedOption,
      responseTimeMs
    );
    return NextResponse.json({ step });
  } catch (e) {
    console.error("session/respond failed", e);
    const message = e instanceof Error ? e.message : "Failed to process response";
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
