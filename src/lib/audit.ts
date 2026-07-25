// Append-only audit trail for privileged admin actions. Never throws — a
// failure to record must not break the action being recorded.

import { prisma } from "@/lib/db";
import type { AdminSession } from "@/lib/auth";

export async function logAudit(
  actor: AdminSession,
  action: string,
  target?: string | null,
  detail?: string | null
): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actorId: actor.userId,
        actorEmail: actor.email,
        action,
        target: target ?? null,
        detail: detail ?? null,
      },
    });
  } catch (e) {
    console.error("audit log write failed", action, e);
  }
}
