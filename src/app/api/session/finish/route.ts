// POST /api/session/finish — ends a session (e.g. when the total test timer
// runs out on the client). Idempotent.
import { NextRequest, NextResponse } from "next/server";
import { finishSession } from "@/lib/engine/orchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const sessionId = String(body?.session_id ?? "");
    if (!sessionId) {
      return NextResponse.json({ error: "session_id is required" }, { status: 400 });
    }
    const step = await finishSession(sessionId, String(body?.reason ?? "time_up"));
    return NextResponse.json({ step });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to finish session";
    const status = /not found/i.test(message) ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
