// PATCH/DELETE /api/admin/users/:id — change role / reset password / remove a
// staff account (Admin only). Guardrails keep at least one Admin and stop an
// admin from deleting their own account out from under themselves.
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireRole, VALID_ROLES, type Role } from "@/lib/auth";
import { logAudit } from "@/lib/audit";

async function adminCount(): Promise<number> {
  return prisma.adminUser.count({ where: { role: "Admin" } });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { role?: string; name?: string | null; passwordHash?: string } = {};
  const notes: string[] = [];

  if (body.role !== undefined) {
    const role = String(body.role);
    if (!VALID_ROLES.includes(role as Role)) {
      return NextResponse.json(
        { error: `Role must be one of ${VALID_ROLES.join(", ")}` },
        { status: 400 }
      );
    }
    // Never let the last Admin be demoted away — that would lock everyone out.
    if (user.role === "Admin" && role !== "Admin" && (await adminCount()) <= 1) {
      return NextResponse.json(
        { error: "Cannot change the role of the only remaining Admin" },
        { status: 400 }
      );
    }
    if (role !== user.role) {
      data.role = role;
      notes.push(`role ${user.role} → ${role}`);
    }
  }

  if (body.name !== undefined) {
    data.name = body.name ? String(body.name).trim() : null;
    notes.push("name updated");
  }

  if (body.password !== undefined) {
    const password = String(body.password);
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }
    data.passwordHash = bcrypt.hashSync(password, 10);
    notes.push("password reset");
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await prisma.adminUser.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });
  const action = data.role ? "user.role_change" : data.passwordHash ? "user.password_reset" : "user.update";
  await logAudit(auth.session, action, user.email, notes.join(", "));
  return NextResponse.json({ user: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("Admin");
  if ("error" in auth) return auth.error;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }
  const user = await prisma.adminUser.findUnique({ where: { id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (user.id === auth.session.userId) {
    return NextResponse.json(
      { error: "You cannot delete your own account" },
      { status: 400 }
    );
  }
  if (user.role === "Admin" && (await adminCount()) <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the only remaining Admin" },
      { status: 400 }
    );
  }

  await prisma.adminUser.delete({ where: { id } });
  await logAudit(auth.session, "user.delete", user.email, `Removed ${user.role} account`);
  return NextResponse.json({ ok: true });
}
