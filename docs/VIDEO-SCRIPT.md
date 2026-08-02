# Zarban — Screencast Recording Script

A shot-by-shot script for a full product walkthrough video (~7–8 minutes). Each
scene lists **SHOW** (what's on screen / the URL), **DO** (clicks and moves), and
**SAY** (narration to read). Times are cumulative and approximate.

## Before you record

- **Site:** https://zarban.zarbanlabs-app.workers.dev
- **Admin demo login:** `admin@zarban.local` / `admin123` (Content Studio: `editor@zarban.local` / `editor123`)
- **Setup:** 1920×1080 screen, browser zoom 100%, hide bookmarks bar. Have two tabs ready — one on the student site, one signed into `/admin`.
- **Do a full assessment once before recording** so you have a finished report to show (you'll need its URL).
- Pace: speak calmly; let each screen breathe for ~1 second before narrating.

---

## SCENE 1 — Cold open (0:00–0:20)

**SHOW:** The landing page, `https://zarban.zarbanlabs-app.workers.dev`.
**DO:** Slow scroll down the hero, then back up.
**SAY:**
> "This is Zarban — an adaptive math assessment and learning platform for Grades 5 to 10, aligned to the NCERT syllabus. Most tools give a student a score. Zarban finds the *cause* of every mistake and gives them the next step. Let me show you the whole thing."

---

## SCENE 2 — Starting an assessment (0:20–0:45)

**SHOW:** The "Start your assessment" card on the home page.
**DO:** Type a name (e.g. "Aarav"), pick a class (e.g. **8**), click **Start Assessment**.
**SAY:**
> "A student just enters their name and class — 5 through 10 — and starts. Notice there's no marks shown during the test. It's designed to be honest, not stressful."

---

## SCENE 3 — Taking the adaptive test (0:45–1:25)

**SHOW:** The question screen. The topic breadcrumb, the timer, the question counter.
**DO:** Answer a few questions — get one right, then deliberately get one wrong. Point the cursor at the A–D options.
**SAY:**
> "One question at a time. Answer by clicking, or just press A to D — it records instantly. And it *adapts*: answer well and the difficulty climbs; struggle, and it steps you down toward the prerequisite skills that are actually blocking you. If you miss a word problem, it quietly serves a matching equation-only 'twin' question — that's how it tells a reading gap apart from a maths gap. About 20 to 30 questions, roughly 15 minutes."

---

## SCENE 4 — The diagnostic report (1:25–2:20)

**SHOW:** The report page (`/report/<session>`) — open your pre-made finished report.
**DO:** Scroll slowly: the grade-level header and score gauge → Root Cause Diagnosis → Test-Taking Behaviour → Five Learning Dimensions → Error Pattern Breakdown.
**SAY:**
> "When the test ends, this is the payoff. Up top: an estimated grade level and overall accuracy against the chosen syllabus. Then a plain-English *root-cause diagnosis* — here it's spotted a reading-comprehension gap, not a maths gap. It flags test-taking behaviour too — likely lucky guesses and rushed answers. Below that, a five-dimension learning profile and a full breakdown of *which kinds* of errors the student made."

---

## SCENE 5 — Detailed analysis (2:20–2:55)

**SHOW:** `/report/<session>/analysis`.
**DO:** Scroll through the θ Ability Journey chart → the Adaptive Path grid → Time per Question.
**SAY:**
> "For the curious, the detailed analysis replays the session question by question. This line is the engine's running estimate of ability, rising on correct answers and falling on mistakes. This grid is the exact path it took — every question's grade, difficulty and outcome, including the twin-probe, lucky-guess and rushed markers. And here's the time spent on each question against the student's own average."

---

## SCENE 6 — Practice mode (2:55–3:20)

**SHOW:** `/practice`.
**DO:** Scroll the grade-grouped skill grid, click into one skill, answer a question, show the instant feedback.
**SAY:**
> "Beyond the test, there's practice. Every skill, grouped by grade, with the number of questions available. Pick one and drill it — and unlike the test, practice checks each answer instantly and shows you exactly *why* you slipped. Reports link straight into the right practice set."

---

## SCENE 7 — Signing into the console (3:20–3:35)

**SHOW:** `/admin/login`.
**DO:** Enter `admin@zarban.local` / `admin123`, click **Sign in**.
**SAY:**
> "Now the other side — for teachers and administrators. One sign-in reaches every management surface."

---

## SCENE 8 — The admin dashboard (3:35–4:20)

**SHOW:** `/admin` — the command center.
**DO:** Point at the four stat tiles → the "Top skill gaps" chips → the quick-actions grid → scroll to Average Score by Grade and the Skill Failure Heatmap.
**SAY:**
> "The dashboard is a live picture of the whole school. Students assessed, assessments taken, this week, average score. 'Top skill gaps right now' surfaces the skills failing the most learners. There's a quick-actions launchpad, average score by grade, and this heatmap — the hottest cells are the skills blocking the most students across every class."

---

## SCENE 9 — Cohort analytics (4:20–4:50)

**SHOW:** `/admin/analytics`.
**DO:** Show the performance-trend chart, the error-types bar chart, the prerequisite-gap tracker.
**SAY:**
> "Cohort analytics goes deeper — grade-level performance over time, the most common *types* of error, and a prerequisite-gap tracker: the foundational skills the engine keeps having to fall back to."

---

## SCENE 10 — Students & classrooms (4:50–5:20)

**SHOW:** `/admin/students`, then `/admin/classrooms`.
**DO:** Search a student, open one for the drill-down. Then switch to Classrooms, show "New classroom" and the "Mine" filter.
**SAY:**
> "Every learner is here and searchable — open any one for a full per-student drill-down. You can group students into classrooms and assign a teacher to each, and the 'Mine' filter scopes the entire console down to just that teacher's classes."

---

## SCENE 11 — The question bank (5:20–5:50)

**SHOW:** `/admin/questions`.
**DO:** Use the grade / skill / difficulty filters, type in search, hover Edit on a row, point at the "Excel Import" button.
**SAY:**
> "The question bank — over nine hundred NCERT-aligned items. Filter by grade, skill, difficulty or type; search by text. Each item is mapped to a skill, a difficulty band and its misconception 'traps'. Edit any item inline, or bulk-import a whole workbook from Excel."

---

## SCENE 12 — The skills knowledge graph (5:50–6:25)

**SHOW:** `/content/skills` (Content Studio → Skills & Graph).
**DO:** Let the graph settle, click a node to highlight its up/downstream, zoom in a little, toggle Graph/Table.
**SAY:**
> "This is the heart of the engine, made visible — the skills knowledge graph. Every node is a skill, colour-coded by domain, and the lines are the prerequisites the adaptive engine actually walks. Click any skill and it highlights everything upstream and downstream of it. This is the map the whole diagnostic navigates."

---

## SCENE 13 — Syllabus & curriculum (6:25–6:55)

**SHOW:** `/content/syllabus`, then `/content/curriculum`.
**DO:** Switch grade tabs on the syllabus; expand a subject's chapters. Then curriculum — show a textbook's soft-copy link.
**SAY:**
> "The syllabus organizes the NCERT curriculum by grade — textbooks, chapters, assessable-skill and practice-question counts. And the curriculum view holds every subject, topic and textbook, each with a soft-copy link so the source material is one click away. Editors manage all of it from here."

---

## SCENE 14 — The Database manager (6:55–7:25)

**SHOW:** `/admin/database`.
**DO:** Click a couple of tables to show row counts and the grid, run a search, open the Edit modal on a row (then Cancel).
**SAY:**
> "For administrators there's a full database manager. Browse every table with live row counts, search and page through any of them, and edit or delete individual rows right here — safely, with the whole thing gated to admins and every change written to the audit log."

---

## SCENE 15 — System & audit (7:25–7:45)

**SHOW:** `/admin/system`.
**DO:** Show the data snapshot tiles, the guarded danger zone, and scroll the audit log.
**SAY:**
> "And System & Audit keeps it healthy — a live data snapshot, a danger zone where every destructive action needs a typed confirmation, and an append-only trail of every privileged action anyone takes in the console."

---

## SCENE 16 — Close (7:45–8:00)

**SHOW:** Back to the landing page, or a title card with the URL.
**SAY:**
> "That's Zarban, end to end — a student takes a test, gets a diagnosis that explains the *why*, and practises the exact gaps, while teachers and admins get a complete console to run it all. It's live and free at zarban.zarbanlabs-app.workers.dev. Thanks for watching."

---

## Editing notes

- Add lower-third captions for each scene title (they double as chapter markers on YouTube).
- Zoom/emphasis: push in ~10% on the report's Root Cause box (Scene 4), the heatmap (Scene 8), and the knowledge graph (Scene 12) — those are the "wow" beats.
- Keep cuts tight between admin pages; the sidebar staying put makes hard cuts feel seamless.
- Background music low and neutral; duck under narration.
- **Runtime target:** ~8 minutes. For a 3-minute cut, keep Scenes 1, 3, 4, 8, 12 and 16.
