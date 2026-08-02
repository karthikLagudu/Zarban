# Zarban — Technical Handover & Deep-Dive Documentation

> **Audience:** Hiring Manager & Development Team (technical interview / project handover). Reads equally well as a client handover — non-technical readers can skip the code-level sub-steps and follow the headings, reasoning, and Impact sections.
>
> **Document type:** Granular workflow narrative. Every phase lists the actual commands, files, decisions, and pitfalls — nothing is abstracted away. Visual-asset markers (`[INSERT SCREENSHOT: …]` / `[INSERT SCREEN RECORDING: …]`) mark where a captured visual should sit, with a description of exactly what it must show.
>
> **Live system:** https://zarban.zarbanlabs-app.workers.dev · **Repo:** https://github.com/karthikLagudu/Zarban

---

## Table of Contents

1. [Project Overview — the Why and the What](#1-project-overview--the-why-and-the-what)
2. [Phase 0 — Environment & Project Setup](#phase-0--environment--project-setup)
3. [Phase 1 — Data Model & the D1 Migration Pipeline](#phase-1--data-model--the-d1-migration-pipeline)
4. [Phase 2 — The Adaptive Engine (Core Logic)](#phase-2--the-adaptive-engine-core-logic)
5. [Phase 3 — The Question Bank (Generation & QA Gate)](#phase-3--the-question-bank-generation--qa-gate)
6. [Phase 4 — Authentication & RBAC](#phase-4--authentication--rbac)
7. [Phase 5 — The Student Experience](#phase-5--the-student-experience)
8. [Phase 6 — Admin Console & Content Studio](#phase-6--admin-console--content-studio)
9. [Phase 7 — The Database Manager](#phase-7--the-database-manager)
10. [Phase 8 — Deployment to Cloudflare](#phase-8--deployment-to-cloudflare)
11. [Phase 9 — Performance Optimization](#phase-9--performance-optimization)
12. [Phase 10 — Testing & Verification](#phase-10--testing--verification)
13. [Impact & Metrics](#impact--metrics)
14. [Appendix — Pitfalls Ledger](#appendix--pitfalls-ledger)

---

## 1. Project Overview — the Why and the What

### 1.1 The problem

Conventional online math tests return a **score**. A score tells a teacher *that* a student is weak; it never tells them *why*, or *what to do next*. A 60% could be a calculation problem, a reading-comprehension problem, or a missing prerequisite two grades below — and the remediation for each is completely different.

**Zarban** solves this: it is an **adaptive diagnostic + learning ecosystem** for Grades 5–10 (NCERT-aligned) that discovers the *cause* of each mistake and closes the loop with targeted practice, teacher monitoring, and a full administrative control plane.

### 1.2 What it does (the three experiences)

- **Student:** takes an adaptive test (no marks shown mid-test), receives a diagnostic report that names the root cause, then practises the exact gaps.
- **Teacher:** monitors classrooms, cohorts, error patterns, and per-student mastery.
- **Admin / Content author:** manages the question bank, curriculum, staff accounts, system health, and — via a bespoke Database manager — the entire database.

### 1.3 The tech stack (and *why* each piece)

| Layer | Choice | Why this choice |
|---|---|---|
| Framework | **Next.js 16** (App Router, RSC) | One codebase for UI + API routes; server components keep data-fetching on the server; file-based routing maps cleanly to the product's surfaces. |
| Language | **TypeScript 5.9** | The adaptive engine has intricate state; static types make the orchestrator's routing safe to refactor. |
| Styling | **Tailwind CSS 4** | Utility-first keeps the design system consistent across ~30 pages without a CSS sprawl. |
| Charts | **Recharts** + **lucide-react** | Declarative React charts for the report/analytics; a single consistent icon set. |
| ORM | **Prisma 6** | Typed schema → typed client; migrations are declarative. |
| Database | **Cloudflare D1** (SQLite-compatible) | Serverless SQLite at the edge, free tier, co-located with the Worker. |
| Runtime / host | **Cloudflare Workers** via **vinext** + **wrangler** | Global edge execution, generous free tier, and D1 binds natively (`env.DB`). |
| Auth | **jose** (JWT) + **bcryptjs** | `jose` is Workers-safe (Web Crypto); `bcryptjs` pure-JS hashing avoids native bindings unavailable on Workers. |

> **Decision point — why Cloudflare Workers over a Node host (Vercel/Render)?** The app is read-heavy at the edge and the data is small and relational. D1 + Workers gives edge latency, a genuinely free production tier, and a single deploy artifact. The trade-off — no long-lived connections, a SQLite feature subset, and `cloudflare:workers`-only bindings — shaped several implementation decisions below (see Phase 1 and Phase 9).

### 1.4 My role

**Sole developer & system architect.** End-to-end ownership:
- Designed the relational schema and the D1 migration pipeline.
- Implemented the multi-algorithm adaptive engine (IRT, BKT, CDM, DKT-lite, CAT selection, twin-probe) from the psychometric spec.
- Built all three product surfaces (student, teacher, admin) and their APIs.
- Authored the parametric question-bank generator and its QA gate.
- Ran the full production deployment on Cloudflare, including DNS/subdomain and secrets.
- Profiled and optimized latency across the app.
- Wrote the end-to-end test harness.

`[INSERT SCREENSHOT: Landing page]` — *The student landing page (`/`), showing the hero "Find out exactly where your math stands" and the "Start your assessment" card with the class 5–10 selector. Establishes the product at a glance.*

---

## Phase 0 — Environment & Project Setup

**Reasoning:** The runtime constraints of Workers must be respected from the first commit, or code fails only at deploy time.

- **0.1** Scaffold the Next.js 16 app with the App Router and TypeScript.
- **0.2** Add the Cloudflare toolchain:
  - `vinext` — the build adapter that compiles the Next.js app into a Cloudflare Worker bundle.
  - `wrangler` — the Cloudflare CLI (dev server, D1, deploy).
- **0.3** Configure `package.json` scripts (the operational surface of the project):
  - `dev` → `vinext dev` (local Worker + Miniflare D1)
  - `build` → `vinext build` (produces `dist/server/`)
  - `db:push` → `prisma db push`
  - `generate:workbook` / `verify:workbook` / `seed` → the content pipeline
  - `e2e` → `tsx scripts/e2e.ts`
  - `setup` → chains push → generate → verify → seed
- **0.4** Establish `src/lib/db.ts` — the **single** D1 access point.
  - **Pitfall:** `import { env } from "cloudflare:workers"` is only resolvable inside the Worker runtime, and the binding is injected *after* module load. A naïvely-constructed Prisma client throws at import time.
  - **Fix:** a lazy `Proxy` that constructs `new PrismaClient({ adapter: new PrismaD1(env.DB) })` on first property access, inside request context. This one file is why no client component may ever transitively import a server module (see Phase 6 pitfall).

`[INSERT SCREENSHOT: Repo file tree]` — *VS Code explorer showing `src/app`, `src/lib/engine`, `prisma/schema.prisma`, `scripts/`. Communicates project structure in one frame.*

---

## Phase 1 — Data Model & the D1 Migration Pipeline

**Reasoning:** D1 is SQLite-compatible but **not** a standard Prisma target — `prisma migrate` can't drive it directly. A repeatable, three-surface pipeline was engineered so schema, local dev DB, and remote D1 never drift.

### 1.1 The schema (`prisma/schema.prisma`)

20 models, grouped:
- **Curriculum:** `Skill`, `KnowledgeGraphEdge`, `Question`, `QMatrixEntry`, `AnswerTrap`, `QuestionDimension`, `Subject`, `Topic`, `Textbook`.
- **Learners & runtime:** `Student`, `Classroom`, `AssessmentSession`, `Response`, `BktState`, `DimensionScore`, `TraversalEvent`, `ReviewFlag`.
- **Ops:** `Setting`, `AdminUser`, `AdminAuditLog`.

- **1.1.1** Every hot query path is indexed deliberately, e.g. `Question` carries `@@index([primarySkillId, gradeLevel, difficultyBand])` and `@@index([gradeLevel, difficultyBand])` — these back the adaptive question fetcher's exact-cell and fallback lookups. `Response` carries `@@index([sessionId])`.
  - **Why:** the engine issues these filters on every answer; without composite indexes, D1 full-scans 900+ rows per lookup.

### 1.2 The migration "dance" (the actual sub-steps)

Because `prisma migrate` can't target D1, the flow is:

1. Edit `prisma/schema.prisma`.
2. `npx prisma db push` — regenerates the typed client and pushes to the dev database.
3. Apply the same DDL to the **local Miniflare D1 sqlite** file at `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite`, using a small `node:sqlite` script (so `npm run dev` sees the new schema).
4. Update `scripts/export-d1-migration.py` — its `SCHEMA_ORDER` / `SEED_ORDER` arrays control table creation and seed order (FK-safe).
5. `python scripts/export-d1-migration.py` — regenerates `drizzle/0000_initial.sql`, the single 6,680-statement file that recreates schema + seed data on remote D1.

- **Pitfall:** running raw SQL through `node -e "... \"col\" ..."` — the shell mangles double-quoted SQL identifiers into JS strings.
  - **Fix:** all ad-hoc SQL runs via heredoc `.mjs` files with **single-quoted** SQL, never inline `node -e`.

`[INSERT SCREENSHOT: prisma/schema.prisma]` — *An editor view of two representative models (`Question` with its `@@index` lines, and `AssessmentSession`), so the reviewer sees the indexing discipline and the snake_case `@map` conventions.*

`[INSERT SCREEN RECORDING: The migration pipeline]` — *Terminal capture running `db:push` → the sqlite-apply script → `export-d1-migration.py`, ending with `git diff drizzle/0000_initial.sql` showing the regenerated migration. ~40s. Proves the pipeline is deterministic.*

---

## Phase 2 — The Adaptive Engine (Core Logic)

This is the intellectual core. It lives in `src/lib/engine/` as **closed-form TypeScript** (no ML runtime — every model is analytic, so it runs inside a Worker in milliseconds).

### 2.1 The five algorithms and their exact parameters

- **CAT + 3PL IRT** (`irt.ts`): ability **θ** is estimated by **Newton–Raphson MLE** over the full response history, clamped to θ ∈ [−4, 4]. The next item is chosen by **maximum Fisher information** at the current θ — operationally, the candidate whose IRT difficulty `b` is closest to θ, tie-broken toward higher discrimination `a` (`fetch-question.ts → pickBest`).
- **BKT — Bayesian Knowledge Tracing** (`bkt.ts`): exact posterior update per skill with P(L₀)=0.10, P(transit)=0.3, P(guess)=0.2, P(slip)=0.1; **mastery ≥ 0.95**, foundational-gap threshold ≤ 0.30.
- **CDM — answer traps** (`AnswerTrap`): every wrong option is pre-mapped to a specific misconception and a remedial action (`serve_same_level`, `go_down_grade`, `go_prereq_skill`, `flag_review`).
- **DKT-lite** (`propagateDkt`): a correct/incorrect answer propagates a fraction of its mastery delta to dependent skills along the knowledge graph.
- **Twin-Question probe** (Algorithm 5): a missed **word problem** triggers its equation-only "twin"; word-wrong + equation-right ⇒ a *reading* gap (not a maths gap), logged as `Reading_Error`.

> **Decision point — why closed-form instead of a hosted ML model?** Workers have no GPU and a strict CPU budget. Analytic IRT/BKT are provably correct, deterministic (critical for the replayable report), and run in <1 ms. This is also what makes the whole diagnostic auditable.

### 2.2 The master loop (`orchestrator.ts → processResponse`) — micro-steps

On every submitted answer:

1. Load the session and the answered question.
2. Grade it; determine whether this response is a twin probe.
3. **CDM:** if wrong, look up the `AnswerTrap` for the chosen option.
4. **BKT:** read prior mastery, apply `bktUpdate`, upsert the new `BktState`.
5. **DKT-lite:** propagate the mastery delta to child skills.
6. **IRT:** recompute θ over the full session history (prior responses + this one).
7. Update consecutive-correct / consecutive-failure counters.
8. **Route** the next question through the decision tree (below).
9. Persist the `Response` row (with full replay context) and the session counters.
10. Check three termination conditions: total timer, `max_questions`, all-grade-skills-mastered.
11. Serve the routed question (or end the session and compute dimension scores).

### 2.3 The routing decision tree (the "why" of adaptivity)

- **Correct →** mastery reached? advance topic. Lucky-guess suspected (low prior)? serve a confirmation. Streak ≥ 2? escalate difficulty, else advance. Otherwise escalate.
- **Wrong →** careless-slip guard (high mastery + slip ⇒ retry, never regress); two easy-band failures ⇒ cross-grade traversal to a prerequisite; BKT foundational gap ⇒ traverse; else apply the trap's remedial action; else reduce difficulty.
- **Word-problem miss →** twin probe before any regression.

### 2.4 Question retrieval fallback ladder (`fetch-question.ts`)

Exact `{skill, grade, difficulty}` → nearest difficulty band → nearest grade (down first, remediation pulls downward) → any unseen item for the skill. Items seen in *earlier* sessions are soft-avoided (exposure control) so retakes stay fresh; items served *this* session are hard-excluded.

`[INSERT SCREEN RECORDING: The adaptive path]` — *Open `/report/<id>/analysis`. Slowly pan the "Adaptive Path" grid while narrating one escalation (streak → harder) and one regression (fail streak → prerequisite, one grade down). This is the single best visual proof that the engine is genuinely adaptive, not random.*

`[INSERT SCREENSHOT: Ability journey chart]` — *The θ line chart on the analysis page — the running ability estimate rising and falling per question.*

---

## Phase 3 — The Question Bank (Generation & QA Gate)

**Reasoning:** A credible diagnostic needs hundreds of calibrated, trap-annotated items. Hand-authoring is infeasible; a parametric generator with an automated quality gate was built instead.

- **3.1** `scripts/generate-workbook.ts` + `scripts/workbook/builders.ts` — parametric templates emit questions per `{skill, grade, band}` with IRT parameters, distractors, and misconception traps. A `PLAN` controls counts per band; a retry budget guarantees coverage.
- **3.2** `scripts/verify-workbook.ts` — the **QA gate**: rejects the workbook if any item lacks a correct option, traps, or valid IRT params; enforces per-cell coverage.
- **3.3** `scripts/seed-devdb.ts` + `scripts/seed-curriculum.ts` — load the workbook, the NCERT curriculum, staff accounts, and settings.
- **3.4** Output: **911** QA-passed items across the grade/skill/band matrix.

- **Pitfall:** generation occasionally under-fills a sparse cell.
  - **Fix:** the retry budget + the verify gate fail the build loudly rather than shipping thin coverage.

`[INSERT SCREENSHOT: Question Bank admin view]` — *`/admin/questions` filtered to one skill, showing the id, skill, grade, band, trap count and Edit/Delete controls — proof the generated bank is real, structured data.*

---

## Phase 4 — Authentication & RBAC

- **4.1** Single login endpoint: `POST /api/admin/auth/login` → verifies with `bcrypt.compareSync` (Workers-safe) → signs a `jose` JWT → sets an **HttpOnly, Secure, SameSite=Lax** cookie named `zarban_admin`.
- **4.2** Role hierarchy: **Admin > Teacher > Viewer** (analytics rank) plus **Editor** (content). Guards `requireRole(min)` and `requireContentRole()` live in `src/lib/auth.ts`.
- **4.3** Every privileged action is written to `AdminAuditLog` via `logAudit(session, action, target, detail)`.

- **Pitfall:** Next.js route files may only export HTTP handlers; exporting a helper constant from a route breaks the build.
  - **Fix:** shared constants (e.g. `VALID_ROLES`) live in `src/lib/auth.ts`, never in a route file.

- **Constraint (security):** credential entry, account creation, and payment are **out of scope for automation** by design — those are performed by a human.

`[INSERT SCREENSHOT: Admin login]` — *`/admin/login` with the demo hint `admin@zarban.local` visible. Then a second frame of the authenticated dashboard to show the guard passing.*

---

## Phase 5 — The Student Experience

### 5.1 Assessment runner (`src/app/assessment/page.tsx`)

- **5.1.1** State persists to `localStorage` (`zarban_assessment`) so a refresh mid-test resumes.
- **5.1.2** Selecting an option (click or key **A–D**) submits immediately — no submit button.
- **5.1.3** One silent retry on a network blip so a student is never stranded.
- **5.1.4** A stopwatch derives elapsed time from an absolute start timestamp (accurate across backgrounded tabs).

### 5.2 The diagnostic report (`src/lib/engine/report.ts`)

Aggregates a session into: grade-equivalent estimate, root-cause narrative, **behaviour flags** (likely lucky guesses = correct-but-<3s on medium/hard; rushed answers), the five learning dimensions, skill mastery map, and per-question error analysis.

`[INSERT SCREENSHOT: Diagnostic report]` — *`/report/<id>` full page: the grade-level header + score gauge, the Root Cause Diagnosis paragraph, and the Test-Taking Behaviour card with the lucky-guess / rushed counts. This is the product's core value in one image.*

---

## Phase 6 — Admin Console & Content Studio

- **6.1** Shell (`src/app/admin/layout.tsx`): a grouped sidebar (**Analytics / Administration / Content Studio**) filtered per role by `canSee(access, role)`; JWT verified via `/api/admin/auth/me`.
- **6.2** Dashboard (`/admin`): totals, top skill gaps, a role-aware quick-actions launchpad, average score by grade, and a class-level failure heatmap.
- **6.3** Surfaces: Cohort Analytics, Students (+per-student drill-down), Classrooms (+teacher "Mine" scoping), Question Bank, Syllabus, User Access, System & Audit.
- **6.4** Content Studio: the **interactive skills knowledge graph** (`content/skills`), Syllabus, Curriculum, Questions, Import/Export.

- **Pitfall:** a client component importing a module that transitively pulls in `src/lib/db.ts` (which imports `cloudflare:workers`) breaks the client build.
  - **Fix:** client-safe constants were split out (e.g. `SUBJECT_BLURB` moved to `src/lib/curriculum/subject-blurb.ts`), keeping server-only Prisma out of the client bundle.

`[INSERT SCREENSHOT: Admin dashboard]` — *`/admin` command center: the four stat tiles, "Top skill gaps," quick-actions grid, and the failure heatmap.*

`[INSERT SCREENSHOT: Skills knowledge graph]` — *`/content/skills` with a node selected, highlighting its up/downstream prerequisites — the graph the engine traverses.*

`[INSERT SCREEN RECORDING: Cohort analytics]` — *`/admin/analytics`: hover the performance-trend line and the error-type bars so the tooltips animate. ~15s.*

---

## Phase 7 — The Database Manager

**Reasoning:** Admins asked to "see and manage the entire database." Rather than hard-code a CRUD page per table, a **generic, schema-introspecting** manager was built (`src/lib/admin/db-admin.ts` + `/api/admin/db[/[table]]` + `/admin/database`).

- **7.1** List tables + live row counts (from `sqlite_master` + `COUNT(*)`).
- **7.2** Per-table: paginated rows + full-text search (every column `CAST(... AS TEXT) LIKE ?`), inline **edit** and **delete**.
- **7.3** Rows are addressed by SQLite's implicit **`rowid`**, so edit/delete work uniformly even on composite-PK tables.

- **Security (the critical part):** table and column **identifiers are whitelist-validated against the live schema** before touching SQL (an injected name like `skills;DROP` returns *"Unknown table"*); all **values are bound as parameters**, never interpolated; the whole area is **Admin-only** and every write is **audit-logged** (`db.update_row` / `db.delete_row`).
- **Pitfall:** an initial single-query optimization (`UNION ALL` over all tables) hit D1's compound-SELECT term limit (`SQLITE_ERROR: too many terms`).
  - **Fix:** reverted to concurrent per-table counts — correct and fast enough.

`[INSERT SCREENSHOT: Database manager]` — *`/admin/database` with the `questions` table open: the left table list with counts, the row grid with the `PK` badge and edit/delete icons, and the search box.*

---

## Phase 8 — Deployment to Cloudflare

**Reasoning:** production must run on the same primitives as dev (`cloudflare:workers`, D1), so there is no host-specific rewrite. The deploy is a fixed, repeatable sequence.

**One-time (per account):**
1. Authenticate: `npx wrangler login` (browser OAuth — a human step; not automatable).
2. Create the database: `npx wrangler d1 create zarban` → capture the printed **`database_id`**.
3. Load schema + seed: `npx wrangler d1 execute zarban --remote --file=drizzle/0000_initial.sql -y` (result: 6,447 queries, ~19,305 rows, 20 tables).

**Every deploy:**
4. `npm run build` (regenerates `dist/server/` **and** `dist/server/wrangler.json`).
5. `node scripts/patch-d1.mjs <database_id>` — writes the D1 binding (`DB → zarban`) into the freshly-built config. *(A helper was written specifically so no one hand-edits generated JSON.)*
6. `npx wrangler deploy` — **run from the repo root**, not `dist/server/`.

**Post-deploy hardening:**
7. `wrangler secret put AUTH_SECRET` — replace the dev-fallback JWT secret (piped a 48-byte random value; never printed).

**Pitfalls solved during the real deployment:**
- **Deploy config collision:** running `wrangler deploy` from `dist/server/` errors — *"Found both a user configuration file… and a deploy configuration file… do not share the same base path."* **Fix:** deploy from repo root; the root `.wrangler/deploy/config.json` points at the built config.
- **Cold-start transients:** the first ~30 s after deploy returns sporadic `404`/`1042`. **Fix:** these are warmup; a route-sweep after warm confirms all `200`.
- **workers.dev subdomain:** the auto-assigned account subdomain (email-derived) can't be renamed via API (`error 10036: Account already has an associated subdomain`) — it's a **dashboard-only, one-time** change. The custom-domain alternative requires a zone on the account (verified: 0 zones ⇒ needs registration first).
- **Fresh subdomain SSL:** after changing the subdomain, HTTP (port 80) served instantly but HTTPS failed the TLS handshake (curl exit 35) for a few minutes while Cloudflare issued the `*.subdomain.workers.dev` certificate. **Fix:** poll until the cert lands.

`[INSERT SCREENSHOT: Successful wrangler deploy]` — *Terminal output of `wrangler deploy`: "Uploaded zarban", "env.DB (zarban) D1 Database", the live `workers.dev` URL, and the Version ID.*

`[INSERT SCREENSHOT: D1 import result]` — *The `d1 execute … --file=…` summary: "6,447 queries", "19,305 rows written", "20 tables" — proof the remote DB was seeded.*

`[INSERT SCREEN RECORDING: End-to-end deploy]` — *`build → patch-d1 → deploy`, then a browser hit of the live URL. ~90s. The definitive "it ships" artifact.*

---

## Phase 9 — Performance Optimization

**Reasoning:** on Cloudflare D1, **each query is a network round trip**, so per-request *round-trip count* — not slow scans (indexes were already in place) — dominates latency. The optimization was measured, not guessed.

### 9.1 Method

- Wrote a benchmark (`scratchpad/bench*.mjs`) that runs a real assessment against production and times each `POST /api/session/respond`, plus a sweep of every read endpoint.
- **Baseline:** ~16–18 sequential D1 queries per answer; median respond **~480–610 ms**; a fixed **350 ms** client pre-submit delay on top.

### 9.2 Changes (behaviour-preserving — all 136 e2e checks still pass)

- **Parallelized independent reads** with `Promise.all` (session+question; then trap+BKT-state+history).
- **Removed a redundant re-read** of the session — used the `update()` return value; ran the two writes concurrently.
- **Introduced an in-isolate TTL cache** (`src/lib/engine/cache.ts`) for near-static data (all skills, the knowledge graph, settings, the cross-session "seen" set) — loading all 33 skills on *every* answer was pure waste; admin settings writes invalidate the cache.
- **Trimmed** the growing history query to only the columns the engine consumes.
- **Skipped** the "all skills mastered?" probe on wrong answers (mastery can't rise).
- **Client:** submit immediately and overlap the 350 ms "choice-visible" beat with the network round trip instead of stacking it on top.
- Applied the same treatment to the **dashboard, content hub, and report** endpoints.

`[INSERT SCREENSHOT: Benchmark before/after]` — *Two terminal captures of the benchmark script side by side: baseline medians vs. optimized medians, so the numbers are self-evident.*

---

## Phase 10 — Testing & Verification

- **10.1** `scripts/e2e.ts` (`npm run e2e`) — **136 end-to-end checks** driving the real HTTP API: the full assessment lifecycle, report + analysis, admin auth and every admin view, the content portal, and **RBAC denial** (viewer gets `403` on privileged routes). Correct answers are read from the local D1 so both all-correct and all-wrong runs can be asserted.
- **10.2** `npx tsc --noEmit` gates every change.
- **10.3** Browser verification: because the in-app preview pane can't composite screenshots, UI is verified via the **accessibility tree / DOM** and console; production screenshots for docs are captured with **headless Chrome** (authenticated pages driven via the DevTools Protocol with the admin cookie).

`[INSERT SCREENSHOT: e2e output]` — *The suite's final line: "136 passed, 0 failed — ALL END-TO-END CHECKS PASSED."*

---

## Impact & Metrics

### Product / scale
- **20** relational tables; **911** QA-passed, trap-annotated questions across Grades 5–10.
- **5** diagnostic algorithms working in concert (IRT, BKT, CDM, DKT-lite, twin-probe).
- **3** role-scoped experiences (student, teacher, admin) + a generic Database manager.
- Deployed **live and free** on Cloudflare Workers + D1.

### Performance (measured on production)
| Path | Before | After | Improvement |
|---|---|---|---|
| Assessment answer (`/api/session/respond`) | ~480–610 ms median | **~280–340 ms** | **~45% faster** + removed a 350 ms client delay |
| Dashboard (`/api/admin/stats`) | ~311 ms | **~170 ms** | ~45% |
| Content hub (`/api/content/overview`) | ~313 ms | **~150 ms** | ~52% |
| Report (`/api/session/report`) | ~267 ms | **~215 ms** | ~20% |

Round trips per answer cut from **~16–18 → ~9**, with **zero behavioural change** (136/136 e2e still green).

### Engineering quality
- **136** automated end-to-end assertions, including RBAC enforcement.
- Deterministic, auditable diagnostic (closed-form models → the report is fully replayable).
- Defense-in-depth on the Database manager (identifier whitelisting + parameter binding + Admin-only + audit log).

### Business value
- Turns a raw score into an **actionable diagnosis + next step**, which is the difference between "this student is weak" and "this student has a reading-comprehension gap on word problems — practise translating words to equations."
- Runs at **$0 hosting** on the free tier, so it can be piloted by a school at no infrastructure cost.

`[INSERT SCREENSHOT: Live site header]` — *The live URL in the browser address bar with the rendered landing page — the "it's real and shipping" closer.*

---

## Appendix — Pitfalls Ledger

A quick-reference of every non-obvious problem solved (interviewers probe these).

| # | Symptom | Root cause | Fix |
|---|---|---|---|
| 1 | Prisma client throws at import | `cloudflare:workers` binding injected after module load | Lazy `Proxy` client in `db.ts` |
| 2 | `prisma migrate` won't target D1 | D1 isn't a native Prisma target | 3-surface pipeline → `drizzle/0000_initial.sql` |
| 3 | SQL identifiers mangled | `node -e` shell-quoting | Heredoc `.mjs` with single-quoted SQL |
| 4 | Client build breaks | Client importing a server-only module (Prisma) | Split client-safe constants into their own file |
| 5 | Route build error | Route file exporting a non-handler | Move shared constants into `lib/` |
| 6 | `wrangler deploy` config collision | Two config files, different base paths | Deploy from repo root |
| 7 | Subdomain rename fails (`10036`) | workers.dev subdomain is one-time, dashboard-only | Change via dashboard, or use a custom domain (needs a zone) |
| 8 | HTTPS fails right after subdomain change | Fresh `*.workers.dev` cert not yet issued | Poll until TLS handshake succeeds |
| 9 | DB manager count query errors | `UNION ALL` exceeded D1's compound-SELECT term limit | Concurrent per-table counts |
| 10 | Headless CDP can't connect | Chrome bound IPv6 `::1`; Node `fetch` resolved IPv4 | Address the debugger over `[::1]` |
| 11 | `git push` hangs / needs re-auth | HTTP/2 negotiation + expired credential helper | Force HTTP/1.1; interactive GitHub re-login (human step) |

---

*End of handover. For a guided visual tour of the running product, see `docs/guide.html` (the interactive walkthrough) and `docs/VIDEO-SCRIPT.md` (the screencast script).*
