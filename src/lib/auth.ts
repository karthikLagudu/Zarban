// Admin authentication: bcrypt-verified credentials, signed JWT session
// cookie (HttpOnly), role-based access control.
//
// Two role axes share one account table:
//   • Analytics access  (Viewer < Teacher < Admin) — the admin dashboard.
//   • Content authoring  (Editor, Admin)            — the content portal.
// Admin sees everything; Editor is a content-only author.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export type Role = "Admin" | "Teacher" | "Viewer" | "Editor";

/** Roles allowed to author learning content. */
export const CONTENT_ROLES: Role[] = ["Admin", "Editor"];

export interface AdminSession {
  userId: number;
  email: string;
  name: string | null;
  role: Role;
}

const COOKIE_NAME = "zarban_admin";
const SESSION_HOURS = 12;

// Stable fallback so auth works out of the box even when AUTH_SECRET has not
// been provisioned in the runtime (e.g. Cloudflare Workers vars aren't mirrored
// onto process.env). Set AUTH_SECRET in production to override this.
const FALLBACK_SECRET = "zarban-default-secret-set-AUTH_SECRET-in-production";

function secret(): Uint8Array {
  // process.env is populated locally and by most adapters; if a runtime keeps
  // vars elsewhere we still fall back rather than crash the request.
  let raw: string | undefined;
  try {
    raw = process.env.AUTH_SECRET;
  } catch {
    raw = undefined;
  }
  return new TextEncoder().encode(raw && raw.length > 0 ? raw : FALLBACK_SECRET);
}

export async function createSessionToken(session: AdminSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secret());
}

export async function readSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: payload.userId as number,
      email: payload.email as string,
      name: (payload.name as string) ?? null,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  };
}

export function clearSessionCookie() {
  return { name: COOKIE_NAME, value: "", path: "/", maxAge: 0 };
}

// Analytics rank. Editor has no analytics privilege (content-only), so it
// ranks at Viewer level for any requireRole checks it happens to hit.
const ROLE_RANK: Record<Role, number> = {
  Viewer: 1,
  Editor: 1,
  Teacher: 2,
  Admin: 3,
};

/** Returns the session when it meets the minimum role, else a 401/403 response. */
export async function requireRole(
  minimum: Role
): Promise<{ session: AdminSession } | { error: NextResponse }> {
  const session = await readSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  if (ROLE_RANK[session.role] < ROLE_RANK[minimum]) {
    return {
      error: NextResponse.json(
        { error: `Requires ${minimum} role (you are ${session.role})` },
        { status: 403 }
      ),
    };
  }
  return { session };
}

/** Gate a content-portal endpoint to authors (Admin or Editor). */
export async function requireContentRole(): Promise<
  { session: AdminSession } | { error: NextResponse }
> {
  const session = await readSession();
  if (!session) {
    return {
      error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  if (!CONTENT_ROLES.includes(session.role)) {
    return {
      error: NextResponse.json(
        { error: `Content authoring requires the Admin or Editor role (you are ${session.role})` },
        { status: 403 }
      ),
    };
  }
  return { session };
}
