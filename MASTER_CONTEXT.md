# MASTER CONTEXT
## AI Teacher Assistant

This file is the high-level orientation document for development agents.

Read this file before implementing any development stage.

Detailed product specifications live under:

```text
/docs/product/
```

Technical architecture lives at:

```text
/docs/architecture/TECHNICAL_ARCHITECTURE.md
```

Current implementation specifications live under:

```text
/docs/development/
```

---

# 1. Product Vision

AI Teacher Assistant is a teacher-first web application that reduces repetitive teacher administration, supports teaching preparation, organizes assessment data, monitors student progress, and generates useful academic reports.

It is NOT intended to become a full school ERP/SIS/LMS in V1.

Primary user:

```text
Teacher
```

Secondary user:

```text
Parent / Guardian
```

School leadership, academic staff, curriculum staff, and homeroom teachers are initially report recipients rather than application roles.

---

# 2. Product Philosophy

Non-negotiable principles:

> Input Once, Use Everywhere.

> Ask Only When Needed.

> More Context = Better Experience, Not Required Experience.

> Start Anytime, Grow the Context.

> AI Assists, Teacher Decides.

> Activity Generates Data.

> Report by Product.

> Automate Administration First, Automate Judgment Later.

---

# 3. Minimum Usable Context

The application must work with:

```text
School Workspace
+
Teacher
+
Subject
+
Class
+
Students
```

Curriculum, CP, TP, ATP, Prota, Prosem, KKTP, and detailed academic planning are OPTIONAL enrichment.

Missing optional context should create a warning or reduced intelligence, never block the daily workflow.

---

# 4. Core Workflow

```text
PLAN
 ↓
TEACH
 ↓
ASSESS
 ↓
ANALYZE
 ↓
FOLLOW UP
 ↓
MONITOR
 ↓
REPORT
```

However, the teacher may start anywhere.

Examples:

- take attendance;
- create questions;
- enter grades;
- create material;
- create PPT;
- open a student profile.

---

# 5. V1 Assessment Decision

This decision overrides any earlier concept involving automatic grading.

```text
AI
✓ Generate blueprint
✓ Generate questions
✓ Generate question variants
✓ Generate answer key

TEACHER
✓ Conduct assessment
✓ Correct student answers manually
✓ Determine student scores
✓ Enter/import scores

SYSTEM
✓ Store scores
✓ Validate data
✓ Calculate statistics
✓ Analyze learning results
✓ Identify mastery
✓ Recommend remedial candidates
✓ Monitor students
✓ Generate reports
```

Deferred:

- online CBT;
- student digital answer flow;
- automatic objective grading;
- OCR answer sheets;
- AI essay correction;
- AI score recommendation;
- mass AI correction.

---

# 6. Daily Teaching

Teaching Session is a shared context for:

- attendance;
- taught material;
- activities;
- assignments;
- notes;
- teaching journal.

The system should avoid asking for data already known from the session.

---

# 7. Student Monitoring

Student 360 is derived from:

```text
Attendance
+
Scores
+
Assessments
+
Assignments
+
Remedial
+
Teacher Notes
```

Do not create a giant duplicated student summary as another source of truth.

---

# 8. AI Content

AI Studio supports Automatic and Manual generation.

It may create:

- RPP / Teaching Module;
- lesson plans;
- materials;
- PPT content;
- LKPD;
- worksheets;
- activities;
- assessment blueprints;
- questions;
- answer keys;
- quizzes;
- summaries.

Flow:

```text
Generate
 ↓
Review
 ↓
Edit
 ↓
Save
 ↓
Use / Download
```

AI output is not automatically final.

---

# 9. Reporting and Editable Output

Reports are generated from core data.

Important output formats:

```text
XLSX
DOCX
PDF
PPTX
```

Excel is a first-class V1 output because academic workflows frequently require editable spreadsheet files.

Excel files may be edited outside the application.

External edits only return to the source database through an explicit import/preview/validation/confirm workflow.

---

# 10. Academic Context

Academic Context may contain:

- Curriculum
- CP
- TP
- ATP
- KKTP
- Prota
- Prosem
- Calendar
- Planning

It enriches analysis and reporting but must not block core usage.

---

# 11. Planned vs Actual

Keep separate:

```text
PLANNED TEACHING
```

and:

```text
ACTUAL TEACHING
```

A mismatch is valid data and can later become an insight.

---

# 12. Parent Access

Parents:

- see only linked children (via ParentStudentRelation);
- must have Teacher-approved ParentTeachingAccess per TeachingContext;
- see only permitted information (Parent-facing subset);
- cannot edit teacher data;
- cannot view teacher-private notes;
- cannot access internal teacher analytics/configuration.

Teacher notes default to PRIVATE.

There are two access boundaries:
1. **School Workspace Membership**: Frictionless onboarding. Teacher joins and gains ACTIVE access to shared school resources.
2. **Parent Data Access**: Approved by the individual Teacher for their specific TeachingContext (governs parent access to learning data).

---

# 13. Development Strategy

Product specification stages 01–09 define the product.

Implementation is performed using separate DEVELOPMENT STAGES.

Do NOT treat Product Stage 01–09 as coding stages.

Current development map:

```text
Dev Stage 0 — Project Foundation
Dev Stage 1 — Authentication & Basic Setup
Dev Stage 2 — Class & Student Core
Dev Stage 3 — Daily Teaching
Dev Stage 4 — Assessment & Score
Dev Stage 5 — Student Monitoring
Dev Stage 6 — AI Content Studio
Dev Stage 7 — Reporting & Academic Context
Dev Stage 8 — Parent Portal
Dev Stage 9 — Import & Mid-Semester Onboarding
Dev Stage 10 — Polish, QA & Release
```

Rule:

```text
BUILD
 ↓
TEST
 ↓
FIX
 ↓
PASS
 ↓
LOCK
 ↓
NEXT STAGE
```

Never silently implement later stages.

---

# 14. Technical Baseline

See `/docs/architecture/TECHNICAL_ARCHITECTURE.md`.

High-level baseline:

```text
Next.js 16
TypeScript
Tailwind CSS
PostgreSQL
Prisma
Better Auth
Zod
Gemini API
SheetJS
ExcelJS
docx
PptxGenJS
Playwright
Node.js
Nginx
PM2
```

Architecture:

```text
Modular Monolith
```

---

# 15. Agent Behavior

When implementing:

1. Read this file.
2. Read the relevant product specifications.
3. Read the current development-stage PRD.
4. Read project rules.
5. Inspect the existing codebase.
6. Produce a plan before making broad changes.
7. Implement only the current stage.
8. Preserve passed functionality.
9. Run validation/tests/build.
10. Report changed files and unresolved issues.
11. Never move to the next development stage automatically.
