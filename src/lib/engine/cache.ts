// In-isolate TTL cache for near-static data read on the assessment hot path.
//
// Every answer used to re-read all skills, the knowledge graph, settings and a
// cross-session "seen" set from D1 — each an extra network round trip. On
// Cloudflare Workers each isolate keeps its own copy here; short TTLs keep admin
// edits propagating within seconds, and correctness never depends on freshness
// (skills/graph change rarely; the "seen" set is only a soft exposure filter).

import { prisma } from "@/lib/db";
import type { Skill, KnowledgeGraphEdge } from "@/generated/prisma/client";

interface Entry<T> {
  value: T;
  expires: number;
}
const store = new Map<string, Entry<unknown>>();

async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await load();
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

const REF_TTL = 60_000; // skills + knowledge graph (rarely edited)
const SETTING_TTL = 15_000; // admin settings
const SEEN_TTL = 600_000; // per-session cross-session exposure set (immutable during a test)

/** All skills, skill_id order (SME topic order). Cached — read every answer. */
export async function allSkills(): Promise<Skill[]> {
  return cached("skills", REF_TTL, () =>
    prisma.skill.findMany({ orderBy: { skillId: "asc" } })
  );
}

/** Skill lookup by id, backed by the cached skill list (no extra query). */
export async function skillById(skillId: string): Promise<Skill | null> {
  const skills = await allSkills();
  return skills.find((s) => s.skillId === skillId) ?? null;
}

/** Every knowledge-graph edge. Cached — used by DKT propagation + prereq lookup. */
export async function allEdges(): Promise<KnowledgeGraphEdge[]> {
  return cached("edges", REF_TTL, () => prisma.knowledgeGraphEdge.findMany());
}

/** An integer setting, cached briefly. Returns `fallback` when unset/invalid. */
export async function settingInt(key: string, fallback: number): Promise<number> {
  const raw = await cached(`setting:${key}`, SETTING_TTL, () =>
    prisma.setting.findUnique({ where: { key } }).then((s) => s?.value ?? null)
  );
  const n = raw != null ? parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/** Question ids the student saw in *earlier* sessions (soft exposure control).
 *  Immutable for the life of a test, so cached per (student, session). */
export async function seenInEarlierSessions(
  studentId: string,
  currentSessionId: string
): Promise<string[]> {
  return cached(`seen:${studentId}:${currentSessionId}`, SEEN_TTL, () =>
    prisma.response
      .findMany({
        where: { session: { studentId, sessionId: { not: currentSessionId } } },
        select: { questionId: true },
        distinct: ["questionId"],
      })
      .then((rows) => rows.map((r) => r.questionId))
  );
}

/** Drop cached admin settings (call after a settings write so it takes effect now). */
export function invalidateSettings(): void {
  for (const k of [...store.keys()]) if (k.startsWith("setting:")) store.delete(k);
}

/** Drop cached skills + knowledge graph (call after editing skills/graph). */
export function invalidateReference(): void {
  store.delete("skills");
  store.delete("edges");
}
