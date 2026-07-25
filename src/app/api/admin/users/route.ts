// GET/POST /api/admin/users — staff account management (Admin only).
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireRole, VALID_ROLES, type Role } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const users = await prisma.adminUser.findMany({
    orderBy: { id: "asc" },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));

  const email = String(body.email ?? "").trim().toLowerCase();
  const name = body.name ? String(body.name).trim() : null;
  const role = String(body.role ?? "");
  const password = String(body.password ?? "");

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role as Role)) {
    return NextResponse.json(
      { error: `Role must be one of ${VALID_ROLES.join(", ")}` },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "That email already exists" }, { status: 409 });
  }

  const user = await prisma.adminUser.create({
    data: { email, name, role, passwordHash: bcrypt.hashSync(password, 10) },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  await logAudit(auth.session, "user.create", email, `Created ${role} account`);
  return NextResponse.json({ user }, { status: 201 });
}
