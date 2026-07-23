// GET /api/content/me — the signed-in author, or 401/403 if not permitted.
import { NextResponse } from "next/server";
import { requireContentRole } from "@/lib/auth";

export async function GET() {
  const auth = await requireContentRole();
  if ("error" in auth) return auth.error;
  return NextResponse.json({ user: auth.session });
}
