// End-to-end test suite for the whole Zarban platform.
//
// Drives the RUNNING server through its real HTTP API and asserts correctness
// at every stage: the student assessment lifecycle, the diagnostic report and
// detailed analysis, admin authentication and every admin view, the content
// portal, and RBAC enforcement. Correct answers are read from the local D1
// database so both an all-correct and an all-wrong run can be asserted.
//
//   1. start the server:  npm run dev   (or build && start)
//   2. run the suite:      npm run e2e   [BASE_URL=http://localhost:3000]
//
// Exits non-zero if any check fails.

import { DatabaseSync } from "node:sqlite";
import * as fs from "fs";
import * as path from "path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// ── Tiny test harness ────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(cond: boolean, msg: string) {
  if (cond) {
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
  } else {
    failed++;
    failures.push(msg);
    console.log(`  \x1b[31m✗ ${msg}\x1b[0m`);
  }
}
function section(name: string) {
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

// ── HTTP with a cookie jar ───────────────────────────────────────────────────
class Client {
  private cookies = new Map<string, string>();
  async req(
    method: string,
    p: string,
    body?: unknown
  ): Promise<{ status: number; json: any; text: string }> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.cookies.size)
      headers["Cookie"] = [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + p, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      for (const part of setCookie.split(/,(?=[^ ;]+=)/)) {
        const [pair] = part.split(";");
        const eq = pair.indexOf("=");
        if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    }
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON (e.g. a page) */
    }
    return { status: res.status, json, text };
  }
  get = (p: string) => this.req("GET", p);
  post = (p: string, b?: unknown) => this.req("POST", p, b);
  put = (p: string, b?: unknown) => this.req("PUT", p, b);
  del = (p: string) => this.req("DELETE", p);
}

// ── Answer key from the local D1 database ────────────────────────────────────
function openLocalD1(): DatabaseSync | null {
  const dir = path.join(".wrangler", "state", "v3", "d1", "miniflare-D1DatabaseObject");
  if (!fs.existsSync(dir)) return null;
  const file = fs.readdirSync(dir).find((f) => f.endsWith(".sqlite") && !f.includes("metadata"));
  if (!file) return null;
  try {
    return new DatabaseSync(path.join(dir, file));
  } catch {
    return null;
  }
}
const d1 = openLocalD1();
function correctOptionOf(questionId: string): string | null {
  if (!d1) return null;
  const row = d1.prepare("SELECT correct_option c FROM questions WHERE question_id = ?").get(questionId) as
    | { c: string }
    | undefined;
  return row?.c ?? null;
}
const OTHER = (correct: string) => ["A", "B", "C", "D"].find((o) => o !== correct) ?? "B";

// ── Student assessment lifecycle ─────────────────────────────────────────────
async function runAssessment(name: string, grade: number, mode: "all_correct" | "all_wrong") {
  const c = new Client();
  const start = await c.post("/api/session/start", { name, grade });
  check(start.status === 200 && !!start.json?.session_id, `[${mode}] session starts`);
  check(!!start.json?.step?.question?.questionId, `[${mode}] first question served`);
  const sessionId: string = start.json.session_id;
  let q = start.json.step.question;

  let answered = 0;
  for (let i = 0; i < 40; i++) {
    const correct = correctOptionOf(q.questionId) ?? "A";
    const option = mode === "all_correct" ? correct : OTHER(correct);
    const r = await c.post("/api/session/respond", {
      session_id: sessionId,
      question_id: q.questionId,
      selected_option: option,
      response_time_ms: 4000 + i * 500,
    });
    if (r.status !== 200) {
      check(false, `[${mode}] respond ${i + 1} returned ${r.status}`);
      break;
    }
    answered++;
    if (r.json.step.done) break;
    q = r.json.step.question;
  }
  check(answered >= 5, `[${mode}] answered ${answered} questions`);

  await c.post("/api/session/finish", { session_id: sessionId, reason: "e2e" });
  const rep = await c.get(`/api/session/report/${sessionId}`);
  check(rep.status === 200, `[${mode}] report loads`);
  const report = rep.json;
  check(report.status === "completed", `[${mode}] session marked completed`);
  check(Array.isArray(report.questionAnalysis) && report.questionAnalysis.length > 0, `[${mode}] question analysis present`);
  check(Array.isArray(report.skillBreakdown), `[${mode}] skill breakdown present`);
  check(!!report.gradeEquivalent?.label, `[${mode}] grade equivalent present (${report.gradeEquivalent?.label})`);
  check(Array.isArray(report.narrative) && report.narrative.length > 0, `[${mode}] narrative generated`);
  check(
    !!report.behavior &&
      typeof report.behavior.likelyGuesses === "number" &&
      typeof report.behavior.rushedAnswers === "number" &&
      Array.isArray(report.behavior.notes),
    `[${mode}] behaviour summary present`
  );

  if (mode === "all_correct" && d1) {
    check(report.totals.accuracy >= 80, `[all_correct] accuracy high (${report.totals.accuracy}%)`);
    check(report.theta > 0, `[all_correct] ability θ positive (${report.theta})`);
  }
  if (mode === "all_wrong" && d1) {
    check(report.totals.accuracy <= 20, `[all_wrong] accuracy low (${report.totals.accuracy}%)`);
    check(report.theta < 0, `[all_wrong] ability θ negative (${report.theta})`);
    check(report.errorTaxonomy.length > 0, `[all_wrong] errors classified into traps`);
  }

  // Detailed-analysis page route resolves (content is client-rendered from the
  // report JSON already asserted above).
  const analysis = await c.get(`/report/${sessionId}/analysis`);
  check(
    analysis.status === 200 && analysis.text.includes("<!DOCTYPE"),
    `[${mode}] detailed-analysis page renders`
  );
  const pdf = await c.get(`/api/session/report/${sessionId}/pdf`);
  check(pdf.status === 200, `[${mode}] PDF export succeeds`);

  return { sessionId, studentName: name, studentId: report.student?.studentId as string };
}

// ── Rushed / fluke behaviour detection ───────────────────────────────────────
// Answer correctly but far too fast (under the 3s rush floor) so the report
// must flag lucky guesses on medium/hard items, plus a couple of rushed wrongs.
async function runRushedSession() {
  const c = new Client();
  const start = await c.post("/api/session/start", { name: "E2E Rusher", grade: 7 });
  const sessionId: string = start.json?.session_id;
  check(!!sessionId, "[rushed] session starts");
  let q = start.json?.step?.question;
  for (let i = 0; i < 40 && q; i++) {
    const correct = correctOptionOf(q.questionId) ?? "A";
    // Q4 and Q7 answered wrong-and-fast → rushed mistakes; the rest right-and-fast.
    const wrong = i === 4 || i === 7;
    const r = await c.post("/api/session/respond", {
      session_id: sessionId,
      question_id: q.questionId,
      selected_option: wrong ? OTHER(correct) : correct,
      response_time_ms: 1500,
    });
    if (r.status !== 200) break;
    if (r.json.step.done) break;
    q = r.json.step.question;
  }
  await c.post("/api/session/finish", { session_id: sessionId, reason: "e2e" });
  const report = (await c.get(`/api/session/report/${sessionId}`)).json;
  if (d1) {
    check(report.behavior.rushedAnswers > 0, `[rushed] rushed answers detected (${report.behavior?.rushedAnswers})`);
    check(report.behavior.likelyGuesses > 0, `[rushed] lucky guesses detected (${report.behavior?.likelyGuesses})`);
    check(
      report.behavior.notes.length > 0,
      `[rushed] behaviour notes written (${report.behavior?.notes?.length})`
    );
    check(
      report.questionAnalysis.some((r: any) => r.likelyGuess) &&
        report.questionAnalysis.some((r: any) => r.rushed),
      "[rushed] per-question likelyGuess + rushed flags set"
    );
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\x1b[1mZARBAN END-TO-END SUITE\x1b[0m  →  ${BASE}`);
  if (!d1) console.log("  (local D1 not found — answer-dependent assertions are relaxed)");

  // Reachability.
  try {
    const ping = await new Client().get("/");
    if (ping.status >= 500) throw new Error(`server returned ${ping.status}`);
  } catch (e) {
    console.error(`\n\x1b[31mCannot reach ${BASE} — start the server first (npm run dev).\x1b[0m`);
    console.error(`  ${e instanceof Error ? e.message : e}`);
    process.exit(2);
  }

  section("1 · Student lifecycle — strong student (all correct)");
  const strong = await runAssessment("E2E Strong", 8, "all_correct");

  section("1b · Student learning hub (My Learning)");
  const learn = await new Client().get(`/api/learn/${strong.studentId}`);
  check(learn.status === 200, "learning hub loads for a student (public)");
  check(learn.json?.summary?.assessments >= 1, `progress shows assessments (${learn.json?.summary?.assessments})`);
  check(Array.isArray(learn.json?.trend) && learn.json.trend.length >= 1, "score trend present");
  check(Array.isArray(learn.json?.skills), "skill mastery list present");
  check(Array.isArray(learn.json?.sessions) && learn.json.sessions.length >= 1, "assessment history present");
  const learn404 = await new Client().get("/api/learn/not-a-real-student");
  check(learn404.status === 404, "unknown learner returns 404");

  section("2 · Student lifecycle — struggling student (all wrong)");
  await runAssessment("E2E Weak", 9, "all_wrong");

  section("2b · Test-taking behaviour — rushed / lucky guesses");
  await runRushedSession();

  section("3 · Admin authentication & RBAC");
  const anon = new Client();
  const denied = await anon.get("/api/admin/stats");
  check(denied.status === 401, "unauthenticated admin request is rejected (401)");

  const admin = new Client();
  const badLogin = await admin.post("/api/admin/auth/login", { email: "admin@zarban.local", password: "wrong" });
  check(badLogin.status === 401, "wrong password is rejected (401)");
  const login = await admin.post("/api/admin/auth/login", { email: "admin@zarban.local", password: "admin123" });
  check(login.status === 200 && login.json?.user?.role === "Admin", "admin logs in");
  const me = await admin.get("/api/admin/auth/me");
  check(me.status === 200 && me.json?.user?.email === "admin@zarban.local", "session cookie authenticates /me");

  section("4 · Admin dashboards");
  const stats = await admin.get("/api/admin/stats");
  check(stats.status === 200 && typeof stats.json.totalStudents === "number", `dashboard stats (${stats.json?.totalStudents} students)`);
  check(Array.isArray(stats.json.heatmap), "skill failure heatmap present");
  const students = await admin.get("/api/admin/students");
  check(students.status === 200 && Array.isArray(students.json.students), `student list (${students.json?.students?.length} students)`);
  const strongRow = students.json.students.find((s: any) => s.name === "E2E Strong");
  check(!!strongRow, "the strong student appears in the list");
  if (strongRow) {
    const detail = await admin.get(`/api/admin/students/${strongRow.studentId}`);
    check(detail.status === 200 && Array.isArray(detail.json.sessions), "student detail with sessions");
    check(Array.isArray(detail.json.bkt), "student BKT mastery present");
  }
  const replay = await admin.get(`/api/admin/sessions/${strong.sessionId}/replay`);
  check(replay.status === 200 && Array.isArray(replay.json.timeline) && replay.json.timeline.length > 0, "session replay timeline");
  const analytics = await admin.get("/api/admin/analytics");
  check(analytics.status === 200 && Array.isArray(analytics.json.trapDistribution), "cohort analytics");
  const adminQ = await admin.get("/api/admin/questions?page=1&page_size=5");
  check(adminQ.status === 200 && adminQ.json.total > 0, `question bank (${adminQ.json?.total} questions)`);

  section("4b · Admin Control Center — users, maintenance, audit");
  const usersList = await admin.get("/api/admin/users");
  check(
    usersList.status === 200 && Array.isArray(usersList.json.users),
    `user list (${usersList.json?.users?.length} accounts)`
  );
  const testEmail = "e2e.staff@zarban.local";
  const leftover = usersList.json.users?.find((u: any) => u.email === testEmail);
  if (leftover) await admin.del(`/api/admin/users/${leftover.id}`);

  const created = await admin.post("/api/admin/users", {
    email: testEmail, name: "E2E Staff", role: "Viewer", password: "temp123",
  });
  check(created.status === 201 && created.json.user?.role === "Viewer", "admin creates a staff account");
  const newId = created.json?.user?.id;

  const dup = await admin.post("/api/admin/users", { email: testEmail, role: "Viewer", password: "temp123" });
  check(dup.status === 409, "duplicate email is rejected (409)");
  const weak = await admin.post("/api/admin/users", { email: "e2e.weak@zarban.local", role: "Viewer", password: "12" });
  check(weak.status === 400, "weak password is rejected (400)");

  const roleChange = await admin.req("PATCH", `/api/admin/users/${newId}`, { role: "Teacher" });
  check(roleChange.status === 200 && roleChange.json.user?.role === "Teacher", "admin changes a user's role");

  const pwReset = await admin.req("PATCH", `/api/admin/users/${newId}`, { password: "newpass123" });
  check(pwReset.status === 200, "admin resets a user's password");
  const reLogin = await new Client().post("/api/admin/auth/login", { email: testEmail, password: "newpass123" });
  check(reLogin.status === 200, "user can sign in with the reset password");

  const adminRow = usersList.json.users.find((u: any) => u.email === "admin@zarban.local");
  const selfDel = await admin.del(`/api/admin/users/${adminRow.id}`);
  check(selfDel.status === 400, "admin cannot delete their own account (400)");
  const demote = await admin.req("PATCH", `/api/admin/users/${adminRow.id}`, { role: "Viewer" });
  check(demote.status === 400, "the only Admin cannot be demoted (400)");

  const del = await admin.del(`/api/admin/users/${newId}`);
  check(del.status === 200, "admin deletes the staff account");

  const maint = await admin.get("/api/admin/maintenance");
  check(maint.status === 200 && typeof maint.json.counts?.students === "number", "maintenance counts load");
  const badConfirm = await admin.post("/api/admin/maintenance", { action: "clear_incomplete_sessions", confirm: "nope" });
  check(badConfirm.status === 400, "maintenance requires the confirmation phrase (400)");
  const clear = await admin.post("/api/admin/maintenance", { action: "clear_incomplete_sessions", confirm: "CLEAR" });
  check(clear.status === 200, "admin clears incomplete sessions");

  const auditRes = await admin.get("/api/admin/audit");
  check(
    auditRes.status === 200 && Array.isArray(auditRes.json.entries) && auditRes.json.entries.length > 0,
    `audit log populated (${auditRes.json?.entries?.length} entries)`
  );
  check(
    auditRes.json.entries.some((e: any) => e.action === "user.create"),
    "audit log records account creation"
  );

  const setTimer = await admin.put("/api/admin/settings", { test_timer_minutes: "20" });
  check(
    setTimer.status === 200 && setTimer.json.updated?.test_timer_minutes === "20",
    "admin saves the time-limit setting"
  );
  const getTimer = await admin.get("/api/admin/settings");
  check(getTimer.json.settings?.test_timer_minutes === "20", "time-limit setting persists");
  await admin.put("/api/admin/settings", { test_timer_minutes: "0" }); // restore no-limit

  section("4c · Classrooms — create + roster management");
  const roomsBefore = await admin.get("/api/admin/classrooms");
  check(
    roomsBefore.status === 200 && Array.isArray(roomsBefore.json.classrooms),
    "classroom list loads"
  );
  const mkRoom = await admin.post("/api/admin/classrooms", { name: "E2E Room 7A", grade: 7, section: "A" });
  check(mkRoom.status === 201 && !!mkRoom.json.classroom?.classroomId, "admin creates a classroom");
  const roomId = mkRoom.json?.classroom?.classroomId;

  const allStudents = (await admin.get("/api/admin/students")).json.students ?? [];
  const pickIds = allStudents.slice(0, 2).map((s: any) => s.studentId);
  const assign = await admin.post(`/api/admin/classrooms/${roomId}/students`, { studentIds: pickIds });
  check(
    assign.status === 200 && assign.json.added === pickIds.length,
    `admin assigns ${pickIds.length} existing students`
  );

  const addNew = await admin.post(`/api/admin/classrooms/${roomId}/students`, { name: "E2E Roster Kid", grade: 7 });
  check(addNew.status === 201 && addNew.json.added === 1, "admin adds a brand-new roster student");
  const newKidId = addNew.json?.studentId;

  const detail = await admin.get(`/api/admin/classrooms/${roomId}`);
  check(
    detail.status === 200 && detail.json.stats?.studentCount === pickIds.length + 1,
    `roster holds ${pickIds.length + 1} students`
  );
  check(
    detail.json.students.some((s: any) => s.studentId === newKidId),
    "the new student appears in the roster"
  );

  // Teacher monitoring: attention signals + teacher ownership.
  check(detail.json.stats?.attentionCount >= 1, "roster flags students needing attention");
  check(detail.json.students.some((s: any) => s.attention), "a student shows an attention reason");
  const usersForT = (await admin.get("/api/admin/users")).json.users ?? [];
  const teacherUser = usersForT.find((u: any) => u.email === "teacher@zarban.local");
  const viewerUser = usersForT.find((u: any) => u.email === "viewer@zarban.local");
  const setTeacher = await admin.req("PATCH", `/api/admin/classrooms/${roomId}`, { teacherId: teacherUser.id });
  check(
    setTeacher.status === 200 && setTeacher.json.classroom?.teacher?.id === teacherUser.id,
    "admin assigns a teacher to the class"
  );
  const badTeacher = await admin.req("PATCH", `/api/admin/classrooms/${roomId}`, { teacherId: viewerUser.id });
  check(badTeacher.status === 400, "a Viewer cannot be made the class teacher (400)");
  const roomRow = (await admin.get("/api/admin/classrooms")).json.classrooms.find((c: any) => c.classroomId === roomId);
  check(roomRow?.teacher?.id === teacherUser.id, "classroom list shows the assigned teacher");
  check(typeof roomRow?.attentionCount === "number", "classroom list includes an attention count");
  const teacherClient = new Client();
  await teacherClient.post("/api/admin/auth/login", { email: "teacher@zarban.local", password: "teacher123" });
  const mine = await teacherClient.get("/api/admin/classrooms?mine=1");
  check(
    mine.status === 200 && mine.json.classrooms.some((c: any) => c.classroomId === roomId),
    "the teacher sees the class under My Classes"
  );

  const listWithRoom = await admin.get("/api/admin/students");
  check(
    listWithRoom.json.students.some((s: any) => s.classroomName === "E2E Room 7A"),
    "students list shows classroom membership"
  );

  const rename = await admin.req("PATCH", `/api/admin/classrooms/${roomId}`, { name: "E2E Room 7A (renamed)" });
  check(
    rename.status === 200 && rename.json.classroom?.name === "E2E Room 7A (renamed)",
    "admin renames a classroom"
  );

  const removeOne = await admin.del(`/api/admin/classrooms/${roomId}/students/${newKidId}`);
  check(removeOne.status === 200, "admin removes a student from the classroom");
  const detail2 = await admin.get(`/api/admin/classrooms/${roomId}`);
  check(detail2.json.stats?.studentCount === pickIds.length, "roster shrinks after removal");
  const removed = (await admin.get("/api/admin/students")).json.students.find((s: any) => s.studentId === newKidId);
  check(!!removed && !removed.classroomId, "removed student is preserved but unassigned");

  // Student-side assignment: assign, move between classes, then clear — all
  // from the student's own record.
  const roomB = await admin.post("/api/admin/classrooms", { name: "E2E Room 8B", grade: 8 });
  const roomBId = roomB.json?.classroom?.classroomId;
  const target = pickIds[0];
  const toA = await admin.req("PATCH", `/api/admin/students/${target}`, { classroomId: roomId });
  check(toA.status === 200 && toA.json.classroomId === roomId, "admin assigns a student to a class from their profile");
  const moved = await admin.req("PATCH", `/api/admin/students/${target}`, { classroomId: roomBId });
  check(moved.status === 200 && moved.json.classroomId === roomBId, "admin moves the student to another class");
  const inB = (await admin.get(`/api/admin/classrooms/${roomBId}`)).json;
  check(
    inB.students.some((s: any) => s.studentId === target) &&
      !(await admin.get(`/api/admin/classrooms/${roomId}`)).json.students.some((s: any) => s.studentId === target),
    "the move leaves the old class and joins the new one"
  );
  const badRoom = await admin.req("PATCH", `/api/admin/students/${target}`, { classroomId: "does-not-exist" });
  check(badRoom.status === 404, "assigning to a missing class is rejected (404)");
  const cleared = await admin.req("PATCH", `/api/admin/students/${target}`, { classroomId: null });
  check(cleared.status === 200 && cleared.json.classroomId === null, "admin clears the student's class from their profile");

  const delRoom = await admin.del(`/api/admin/classrooms/${roomId}`);
  check(delRoom.status === 200, "admin deletes the classroom");
  await admin.del(`/api/admin/classrooms/${roomBId}`); // cleanup
  const survivor = (await admin.get("/api/admin/students")).json.students.find((s: any) => s.studentId === pickIds[0]);
  check(!!survivor && !survivor.classroomId, "students survive classroom deletion (unassigned)");

  section("5 · Content portal (Editor RBAC)");
  const editor = new Client();
  const eLogin = await editor.post("/api/admin/auth/login", { email: "editor@zarban.local", password: "editor123" });
  check(eLogin.status === 200 && eLogin.json?.user?.role === "Editor", "editor logs in");
  const cme = await editor.get("/api/content/me");
  check(cme.status === 200, "content /me authorises the editor");
  const overview = await editor.get("/api/content/overview");
  check(overview.status === 200 && typeof overview.json.totals?.questions === "number", `content overview (${overview.json?.totals?.questions} questions)`);
  check(Array.isArray(overview.json.coverage) && Array.isArray(overview.json.issues), "coverage + health analysis present");

  // Skill CRUD round-trip on a throwaway skill.
  const tempSkillId = "S_900";
  await editor.del(`/api/content/skills/${tempSkillId}`); // clean any leftover
  const createSkill = await editor.post("/api/content/skills", {
    skillId: tempSkillId,
    skillName: "E2E Temp Skill",
    gradeLevel: "7",
    topicArea: "Algebra",
    difficultyBand: "medium",
    prerequisiteSkillIds: "",
    notes: "created by e2e",
  });
  check(createSkill.status === 201, "editor creates a skill");
  const editSkill = await editor.put(`/api/content/skills/${tempSkillId}`, {
    skillName: "E2E Temp Skill (edited)",
    gradeLevel: "7",
    topicArea: "Algebra",
    difficultyBand: "hard",
    prerequisiteSkillIds: "",
    notes: "edited by e2e",
  });
  check(editSkill.status === 200, "editor edits the skill");
  const delSkill = await editor.del(`/api/content/skills/${tempSkillId}`);
  check(delSkill.status === 200, "editor deletes the skill");

  const exportRes = await editor.get("/api/content/export");
  check(
    exportRes.status === 200,
    "content export returns a workbook"
  );

  section("6 · Cross-role denial");
  const viewer = new Client();
  const vLogin = await viewer.post("/api/admin/auth/login", { email: "viewer@zarban.local", password: "viewer123" });
  check(vLogin.status === 200 && vLogin.json?.user?.role === "Viewer", "viewer logs in");
  const vContent = await viewer.get("/api/content/overview");
  check(vContent.status === 403, "viewer is denied content authoring (403)");
  const vSkillCreate = await viewer.post("/api/content/skills", { skillId: "S_901", skillName: "nope" });
  check(vSkillCreate.status === 403, "viewer cannot create content (403)");
  const vUsers = await viewer.get("/api/admin/users");
  check(vUsers.status === 403, "viewer cannot manage staff accounts (403)");
  const vMaint = await viewer.get("/api/admin/maintenance");
  check(vMaint.status === 403, "viewer cannot access data maintenance (403)");
  const vAudit = await viewer.get("/api/admin/audit");
  check(vAudit.status === 403, "viewer cannot read the audit log (403)");
  const vCreateUser = await viewer.post("/api/admin/users", { email: "x@y.z", role: "Admin", password: "abcdef" });
  check(vCreateUser.status === 403, "viewer cannot create admin accounts (403)");
  const vRoomsRead = await viewer.get("/api/admin/classrooms");
  check(vRoomsRead.status === 200, "viewer can view classrooms (read allowed)");
  const vRoomCreate = await viewer.post("/api/admin/classrooms", { name: "nope" });
  check(vRoomCreate.status === 403, "viewer cannot create classrooms (403)");
  const vAssign = await viewer.req("PATCH", `/api/admin/students/${pickIds[0]}`, { classroomId: null });
  check(vAssign.status === 403, "viewer cannot change a student's classroom (403)");

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n" + "─".repeat(60));
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("  \x1b[31mFAILURES:\x1b[0m");
    for (const f of failures) console.log(`    - ${f}`);
    console.log("─".repeat(60));
    process.exit(1);
  }
  console.log("  \x1b[32m✅ ALL END-TO-END CHECKS PASSED\x1b[0m");
  console.log("─".repeat(60));
  if (d1) d1.close();
}

main().catch((e) => {
  console.error("\n\x1b[31mE2E run crashed:\x1b[0m", e);
  process.exit(1);
});
