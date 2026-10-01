# DEVELOPMENT STAGE 00 — PROJECT FOUNDATION
## PRD

Status: READY FOR IMPLEMENTATION

## 1. Objective

Create the stable technical and visual foundation for AI Teacher Assistant.

This stage must NOT implement business features.

The output is a clean, runnable, testable application shell ready for future feature stages.

---

## 2. Read Before Implementation

Required context:

```text
/MASTER_CONTEXT.md
/docs/architecture/TECHNICAL_ARCHITECTURE.md
/.agents/rules/project-rules.md
/docs/product/ (product specifications as available)
```

Do not implement Product Stage 01–09 sequentially. They are specification references.

---

## 3. In Scope

### Project Foundation

- Next.js 16
- TypeScript
- App Router
- Tailwind CSS
- basic linting
- environment configuration
- clean module-oriented directory structure

### Database Foundation

- PostgreSQL connection configuration
- Prisma initialization
- migration-ready setup
- database utility/client foundation

Do NOT model the full production database yet unless a minimal technical model is necessary for foundation setup.

### Authentication Foundation

Prepare the architecture/integration point for Better Auth.

Full register/login business flow belongs to Development Stage 01.

Stage 00 may establish required packages/configuration and a non-functional placeholder entry screen if necessary.

### Validation Foundation

- Zod installed/configured
- clear validation pattern

### UI Foundation

Create design tokens / core styles and reusable primitives needed by the app shell.

At minimum:

- Button
- Input
- Card
- Badge
- Modal/Dialog
- Toast
- Alert
- Skeleton
- Empty State
- Loading pattern

Reuse accessible component patterns.

### Application Shell

Desktop:

```text
Topbar
+
Sidebar
+
Main Content
```

Prepare responsive behavior.

Topbar placeholder capabilities:

- product identity
- global search placeholder
- quick create placeholder
- notification placeholder
- profile placeholder

Sidebar structure:

```text
Beranda
Hari Ini
Kelas Saya
Pembelajaran
Assessment
Siswa
AI Studio
Laporan
-----------
Akademik
Dokumen Saya
Pengaturan
```

These are navigation placeholders only. Do NOT implement module business logic.

### Mobile Shell

Prepare a responsive navigation concept.

Suggested primary items:

```text
Beranda
Hari Ini
Kelas
AI Studio
Lainnya
```

### State Patterns

Create reusable:

- loading state
- empty state
- error state
- toast feedback
- confirmation dialog pattern

### Error Handling Foundation

Provide sensible application-level handling for:

- unexpected route/page errors;
- failed server operation placeholder pattern;
- user-readable error messaging.

### Testing Foundation

Set up:

- test structure
- Playwright
- at least a smoke test for opening the application shell

---

## 4. Out of Scope

Do NOT implement:

- teacher registration flow;
- real teacher profile setup;
- real class CRUD;
- real student CRUD;
- attendance;
- teaching session;
- assessment;
- score input;
- AI content generation;
- reporting;
- parent portal;
- import/export business workflows;
- full database domain model.

These belong to later stages.

---

## 5. Suggested Project Structure

```text
src/
├── app/
├── components/
│   ├── ui/
│   └── layout/
├── modules/
├── services/
├── lib/
└── styles/

prisma/
├── schema.prisma
└── migrations/

docs/
├── product/
├── architecture/
└── development/

tests/

.agents/
└── rules/
```

Do not create meaningless or duplicate directories.

---

## 6. UI Direction

Style:

```text
Clean
Calm
Productive
Modern
Spacious
Professional
Friendly
```

Avoid:

- heavy ERP look;
- dashboard clutter;
- too many cards;
- excessive chart placeholders;
- overly colorful UI.

The first visible screen may be a shell/dashboard placeholder showing the visual language, not fake business data.

---

## 7. Required Foundation Behaviors

### Desktop
- sidebar stable;
- topbar stable;
- content area responsive;
- active navigation state;
- accessible keyboard focus.

### Mobile
- layout does not overflow;
- navigation remains usable;
- touch targets are reasonable.

### Errors
- no raw stack trace shown to end user;
- reusable user-facing error component exists.

### Loading
- reusable skeleton/loading pattern exists.

### Empty
- empty state includes a useful next-action pattern.

---

## 8. Environment

Provide `.env.example` with placeholders only.

Never commit secrets.

Expected categories may include:

```text
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
GEMINI_API_KEY=
```

Do not require Gemini to function in Stage 00.

---

## 9. Quality Requirements

- strict TypeScript where practical;
- no unresolved TypeScript errors;
- no lint-blocking issues;
- no broken routes;
- no unnecessary mock business datasets;
- reusable components;
- clean imports;
- no secret keys committed.

---

## 10. Acceptance Criteria

Development Stage 00 is PASS only if:

### Build
- application installs successfully;
- application builds successfully;
- lint passes or has no blocking issues.

### Runtime
- application can be started locally;
- root/app shell loads;
- navigation shell renders;
- responsive shell works.

### Database
- Prisma is initialized;
- database connection configuration is valid;
- migration workflow is ready.

### UI
- app shell exists;
- reusable UI primitives exist;
- loading state exists;
- error state exists;
- empty state exists;
- toast/feedback pattern exists.

### Testing
- Playwright foundation exists;
- smoke test can validate that the application shell opens.

### Architecture
- codebase matches modular-monolith direction;
- no later business feature has been prematurely implemented.

---

## 11. Required Completion Report

At completion, report:

```text
STAGE 00 COMPLETION REPORT

Implemented:
- ...

Changed / Created Files:
- ...

Packages Added:
- ...

Database / Migrations:
- ...

Build:
PASS / FAIL

Lint:
PASS / FAIL

Tests:
PASS / FAIL

Responsive Check:
PASS / FAIL

Known Issues:
- ...

Acceptance Criteria:
PASS / NOT PASS
```

Do NOT proceed to Development Stage 01.

---

## 12. Definition of Done

```text
FOUNDATION
 ↓
BUILD
 ↓
LINT
 ↓
SMOKE TEST
 ↓
RESPONSIVE CHECK
 ↓
NO REGRESSION
 ↓
PASS
```

If any blocking item fails, Stage 00 remains NOT PASS.
