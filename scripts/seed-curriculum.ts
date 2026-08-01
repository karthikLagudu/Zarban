// Seed the NCERT curriculum (subjects + topics) into prisma/dev.db from the
// canonical data in src/lib/curriculum/ncert.ts. Idempotent — clears and
// re-inserts. dev.db then feeds scripts/export-d1-migration.py.
//
//   npx tsx scripts/seed-curriculum.ts

import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import * as path from "path";
import { NCERT_CURRICULUM, NCERT_TEXTBOOKS } from "../src/lib/curriculum/ncert";

const db = new DatabaseSync(path.join(process.cwd(), "prisma", "dev.db"));
db.exec("PRAGMA foreign_keys = OFF");
db.exec("BEGIN");
try {
  db.exec('DELETE FROM "textbooks"');
  db.exec('DELETE FROM "topics"');
  db.exec('DELETE FROM "subjects"');

  const insSubject = db.prepare(
    'INSERT INTO "subjects" (subject_id, name, "order", created_at) VALUES (?, ?, ?, ?)'
  );
  const insTopic = db.prepare(
    'INSERT INTO "topics" (topic_id, subject_id, grade, name, chapter_no, "order", created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const insTextbook = db.prepare(
    'INSERT INTO "textbooks" (textbook_id, subject_id, grade, name, pdf_url, "order", created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  );
  const now = new Date().toISOString();
  const subjectIds = new Map<string, string>();

  // A per-book link to its soft copy on the official (free) NCERT source, so no
  // textbook is left without a reference. Strips any "(discipline)" qualifier.
  const softCopyUrl = (grade: number, name: string) =>
    "https://www.google.com/search?q=" +
    encodeURIComponent(
      `NCERT Class ${grade} ${name.replace(/\s*\(.*?\)\s*$/, "").trim()} textbook PDF site:ncert.nic.in`
    );

  NCERT_CURRICULUM.forEach((subject, si) => {
    const subjectId = randomUUID();
    subjectIds.set(subject.name, subjectId);
    insSubject.run(subjectId, subject.name, si, now);
    // chapter numbers restart per grade; order is the overall sequence.
    const perGrade = new Map<number, number>();
    subject.topics.forEach((t, ti) => {
      const n = (perGrade.get(t.grade) ?? 0) + 1;
      perGrade.set(t.grade, n);
      insTopic.run(randomUUID(), subjectId, t.grade, t.name, n, ti, now);
    });
  });

  // Textbooks — order is per subject+grade in listed sequence.
  const orderCounter = new Map<string, number>();
  for (const tb of NCERT_TEXTBOOKS) {
    const subjectId = subjectIds.get(tb.subject);
    if (!subjectId) continue;
    const key = `${tb.subject}:${tb.grade}`;
    const ord = orderCounter.get(key) ?? 0;
    orderCounter.set(key, ord + 1);
    insTextbook.run(randomUUID(), subjectId, tb.grade, tb.name, softCopyUrl(tb.grade, tb.name), ord, now);
  }

  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
}

const subjects = (db.prepare('SELECT COUNT(*) c FROM "subjects"').get() as { c: number }).c;
const topics = (db.prepare('SELECT COUNT(*) c FROM "topics"').get() as { c: number }).c;
const textbooks = (db.prepare('SELECT COUNT(*) c FROM "textbooks"').get() as { c: number }).c;
console.log(`curriculum seeded: ${subjects} subjects, ${topics} topics, ${textbooks} textbooks`);
for (const row of db.prepare(
  'SELECT s.name, COUNT(t.topic_id) c FROM "subjects" s LEFT JOIN "topics" t ON t.subject_id = s.subject_id GROUP BY s.subject_id ORDER BY s."order"'
).all() as { name: string; c: number }[]) {
  console.log(`  ${row.name}: ${row.c} topics`);
}
db.close();
