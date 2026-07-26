<div align="center">

![Zarban — Adaptive Math Assessment](docs/og.png)

# Zarban

### An adaptive math assessment & learning platform for Grades 5–10, NCERT-aligned

Zarban runs a genuine multi-algorithm diagnostic — **CAT + IRT**, **CDM**, **BKT**,
**DKT-lite** and a **Twin-Question probe** — to find not just *what* a student got
wrong, but *why*, and turns it into a learning loop for students, a monitoring
console for teachers, and full control for admins.

<br/>

![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=flat-square&logo=prisma&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Cloudflare_Workers_+_D1-F38020?style=flat-square&logo=cloudflare&logoColor=white)
![Tests](https://img.shields.io/badge/tests-39_unit_·_132_e2e-3fb950?style=flat-square&logo=vitest&logoColor=white)

</div>

---

## ✨ Highlights

Zarban is an end-to-end LMS built around one adaptive engine, serving three roles:

| 🎓 Students | 🧑‍🏫 Teachers | 🛠️ Admins |
|---|---|---|
| Adaptive assessment that adjusts to every answer | **My Classes** monitoring dashboard | **Control Center**: users, roles, audit log |
| A diagnostic **report** — mastery, 5 learning dimensions, root-cause | Flags students needing attention (low score, skill gaps, rushing) | Danger-zone data maintenance (typed-confirm) |
| **My Learning** hub — score trend, mastery, what to practise next | Own classrooms; per-student attention reasons | **Curriculum** + **Syllabus** editors, NCERT textbooks by grade |
| PDF report export | Drill into any student, replay any session | **Content Studio**: questions, skills, Q-matrix, traps |

**Extras that make it feel real:** lucky-guess (fluke) & rushed-answer detection,
foundational-gap chains, reading-vs-math gap diagnosis, session replay, cohort
analytics, Excel import/export of the whole question bank, and a full RBAC model.

---

## 🧠 The adaptive engine

Every response updates the student model *before* the next question is chosen.
Five techniques cooperate in one closed-form TypeScript engine — no external ML
service required.

```mermaid
flowchart TD
    A["Start · pick grade"] --> B["Serve best question at ability θ<br/>(max-information CAT selection)"]
    B --> C{"Answer"}
    C -->|correct| D["BKT mastery ↑ · IRT re-estimates θ"]
    C -->|wrong| E["CDM classifies the trap<br/>(sign / concept / calculation / reading …)"]
    D --> F{"Twin probe?<br/>confirm a lucky guess"}
    E --> G["Route: same level ·<br/>step down a grade ·<br/>walk to a prerequisite skill"]
    F --> H{"Mastery reached?<br/>topics covered?<br/>question cap hit?"}
    G --> H
    H -->|no| B
    H -->|yes| I["Diagnostic report<br/>+ recommendations"]
```

| Technique | File | What it does |
|---|---|---|
| **CAT + IRT (3PL)** | `src/lib/engine/irt.ts` | `P(θ)=c+(1−c)/(1+e^(−a(θ−b)))`; Newton–Raphson MLE re-estimates ability θ∈[−4,4] over session history; questions chosen by maximum information. |
| **BKT** | `src/lib/engine/bkt.ts` | Exact Bayesian mastery update per skill (P(L₀)=.10, P(T)=.3, P(G)=.2, P(S)=.1); mastery ≥ .95, foundational gap ≤ .30. |
| **CDM** | Q-matrix + answer traps | Each wrong option maps to a specific misconception and a remedial route. |
| **DKT-lite** | `src/lib/engine/orchestrator.ts` | Sequence-aware routing across the prerequisite knowledge graph. |
| **Twin Question** | orchestrator | A parallel probe confirms whether a correct answer was mastery or a lucky guess. |

---

## 🏗️ Architecture

```mermaid
flowchart LR
    subgraph Browser
      direction TB
      ST["Student site<br/>/ · /assessment · /report · /learn"]
      AD["Admin console<br/>/admin/*"]
      CS["Content Studio<br/>/content/*"]
    end
    Browser -->|HTTP| API["Next.js App Router<br/>API routes (/api/*)"]
    API --> ENG["Adaptive engine<br/>IRT · BKT · CDM · DKT · Twin"]
    API --> AUTH["RBAC<br/>JWT cookie + bcrypt"]
    ENG --> ORM["Prisma ORM"]
    API --> ORM
    ORM --> D1[("Cloudflare D1<br/>(SQLite-compatible)")]
```

| Layer | Choice |
|---|---|
| Frontend + API | Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Recharts · lucide-react |
| Runtime / deploy | **Cloudflare Workers** via `vinext` + `wrangler` |
| Engine | Pure TypeScript (`src/lib/engine/`) — closed-form math, single process |
| Database | **Prisma** ORM → **Cloudflare D1** (SQLite-compatible; schema is Postgres-portable) |
| Auth | bcrypt + signed JWT cookie (`jose`); roles: Admin · Teacher · Viewer · Editor |
| Content pipeline | SheetJS (`xlsx`) — the same parser powers import, export and the seed |

---

## 🔐 Roles & access

```mermaid
flowchart TD
    Admin["👑 Admin — full control"] --> Teacher["🧑‍🏫 Teacher — dashboards, my classes"]
    Teacher --> Viewer["👀 Viewer — read-only analytics"]
    Admin --> Editor["✍️ Editor — Content Studio + Curriculum"]
```

- **Admin** — everything: analytics, classrooms, **User Access**, **System & Audit**, settings, Content Studio, Syllabus/Curriculum.
- **Teacher** — dashboards, students, cohort analytics, and a **My Classes** monitoring view for classrooms they own.
- **Viewer** — read-only analytics and syllabus.
- **Editor** — Content Studio + Curriculum authoring (no analytics).

---

## 📚 Curriculum & Syllabus (NCERT)

A browsable, editable catalog separate from the assessable question bank:

- **4 subjects · 239 topics · 37 textbooks** across Grades 6–10 (Mathematics, Science, Social Science, English).
- **Syllabus** space — NCERT textbooks laid out grade-by-grade, each with a **soft-copy link** to the official free NCERT PDF (editable per book).
- **Curriculum** editor — subjects → chapters, fully editable.

> The seed follows the well-known NCERT chapter/textbook lists and is fully editable — verify against the exact edition your school uses.

---

## 🚀 Quick start

```bash
npm install
npm run setup          # db push + generate the SME workbook + verify + seed

# Fast production server (recommended):
npm run build && npm start        # http://localhost:3000

# Or hot-reload dev:
npm run dev
```

**Try it:**

| Surface | URL | Sign in |
|---|---|---|
| Student | `/` → name + grade → assessment → `/report/:id` | — |
| My Learning | `/learn` | (progress on this device) |
| Admin console | `/admin` | `admin@zarban.local` / `admin123` |
| Teacher | `/admin` | `teacher@zarban.local` / `teacher123` |
| Content Studio | `/content` | `editor@zarban.local` / `editor123` |

> ⚠️ These are seeded dev credentials — set a real `AUTH_SECRET` and rotate passwords (**User Access**) before going live.

---

## 🧪 Testing

```bash
npm test           # 39 engine unit tests (BKT / IRT / CAT / difficulty)
npm run typecheck  # strict TypeScript
npm run e2e        # 132-check end-to-end suite (needs the dev server running)
npm run build      # production build
```

The **end-to-end suite** drives the running server through its real HTTP API and
asserts the whole platform: student lifecycle (all-correct & all-wrong), the
report + detailed analysis, fluke/rushed detection, the learning hub, admin auth
& RBAC, classrooms + teacher monitoring, the curriculum/syllabus, content-portal
CRUD, and cross-role denial.

---

## 🗂️ Data model (core)

```mermaid
erDiagram
    ADMINUSER ||--o{ CLASSROOM : teaches
    CLASSROOM ||--o{ STUDENT : enrolls
    STUDENT   ||--o{ SESSION : takes
    SESSION   ||--o{ RESPONSE : records
    QUESTION  ||--o{ RESPONSE : answered_as
    SKILL     ||--o{ QUESTION : primary
    SKILL     ||--o{ BKTSTATE : mastery
    STUDENT   ||--o{ BKTSTATE : tracks
    SUBJECT   ||--o{ TOPIC : contains
    SUBJECT   ||--o{ TEXTBOOK : has
```

---

## 📁 Project structure

```
src/
  app/
    (student)         /  · /assessment · /report/[id] · /learn
    admin/            dashboard · students · classrooms · analytics ·
                      questions · syllabus · users · system · settings
    content/          overview · syllabus · curriculum · skills · questions · import
    api/              session/* · admin/* · content/* · learn/*
  lib/
    engine/           irt · bkt · cdm · dkt · orchestrator · fetch-question · report
    curriculum/       ncert data · syllabus builder
    auth.ts  db.ts  audit.ts
prisma/schema.prisma  drizzle/0000_initial.sql  scripts/  tests/
```

---

## ☁️ Deployment

Zarban is Cloudflare-native (Workers + D1) and hosts **free** on Cloudflare's free
plan. See **[DEPLOY.md](DEPLOY.md)** for the full copy-paste guide:
`wrangler login` → create a free D1 → apply `drizzle/0000_initial.sql` → `wrangler deploy`.

A fresh D1 comes up fully seeded (578 questions, curriculum, staff accounts) so
sign-in works immediately.

---

<div align="center">
<sub>Built with the Claude Agent SDK · Grades 5–10 · NCERT-aligned</sub>
</div>
