import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { createSessionToken, sessionCookie, type Role } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await prisma.adminUser.findUnique({ where: { email } });
    // Use the synchronous compare — bcryptjs's async path relies on a task
    // scheduler that isn't reliably present in the Workers runtime.
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    });
    await logAudit(
      { userId: user.id, email: user.email, name: user.name, role: user.role as Role },
      "auth.login",
      null,
      `Signed in as ${user.role}`
    );
    const res = NextResponse.json({
      user: { email: user.email, name: user.name, role: user.role },
    });
    res.cookies.set(sessionCookie(token));
    return res;
  } catch (e) {
    // Never let the handler return an empty body — the client parses JSON.
    // Surface the underlying reason so misconfiguration (e.g. an un-migrated
    // database) is diagnosable rather than a generic wall.
    console.error("admin login failed", e);
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "Sign-in failed", detail },
      { status: 500 }
    );
  }
}
