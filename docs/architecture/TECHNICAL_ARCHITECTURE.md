# TECHNICAL ARCHITECTURE v1
## AI Teacher Assistant

Status: LOCKED BASELINE FOR V1

## 1. Architecture Style

Use a **Modular Monolith**.

One application, one primary relational database, one codebase, with strong internal module boundaries.

```text
AI TEACHER ASSISTANT
│
├── Auth
├── Teacher
├── Classes
├── Students
├── Teaching
├── Attendance
├── Assignments
├── Assessment
├── Scores
├── Remedial
├── Monitoring
├── AI
├── Reports
├── Academic Context
├── Import / Export
└── Parent Portal
```

Do NOT introduce microservices unless a real production requirement later justifies them.

---

## 2. Core Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Web Framework | Next.js 16 — App Router |
| Architecture | Modular Monolith |
| Styling | Tailwind CSS |
| UI Components | Reusable component system, shadcn/ui-style patterns |
| Icons | Lucide |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | Better Auth |
| Validation | Zod |
| AI Provider | Gemini API |
| AI Integration | Provider / AI Service abstraction |
| Excel Import | SheetJS |
| Excel Export | ExcelJS for formatted/editable XLSX; SheetJS allowed for simple transforms |
| DOCX | docx |
| PPTX | PptxGenJS |
| PDF | HTML/template-based PDF generation |
| E2E Testing | Playwright |
| Runtime | Node.js |
| Reverse Proxy | Nginx |
| Process Manager | PM2 |
| Version Control | Git |
| Deployment Target | VPS |

---

## 3. Main Architecture

```text
Browser
   ↓
Next.js Application
   │
   ├── UI / Server Components
   ├── Server Actions / Route Handlers
   ├── Domain Modules
   ├── Application Services
   ├── AI Service
   ├── Import / Export Service
   ├── Document Service
   └── Storage Service
            │
            ↓
          Prisma
            ↓
        PostgreSQL
```

External services:

```text
Next.js
   ├── Gemini API
   └── File Storage Provider
```

---

## 4. Application Modules

Recommended module boundaries:

```text
src/modules/
├── auth/
├── teachers/
├── classes/
├── students/
├── teaching/
├── attendance/
├── assignments/
├── assessment/
├── scores/
├── remedial/
├── monitoring/
├── ai/
├── reports/
├── academic/
├── imports/
├── exports/
├── documents/
└── parents/
```

Rules:

- Do not place business logic directly inside UI components.
- Do not directly couple unrelated modules.
- Shared helpers belong in a clear shared/lib layer.
- Cross-module operations go through explicit services.
- Do not create duplicate sources of truth.

---

## 5. Database Architecture

PostgreSQL is the source of truth.

```text
School Workspace
   │
   ├── AcademicPeriod
   ├── Subject
   ├── Class
   └── Student
          │
          └── ClassStudent Membership
                 │
Teacher          │
   ↓             │
TeacherSchoolMembership
   ↓             │
Teaching Session (via TeachingContext)
   ↓
Assessment
   ↓
Score
   ↓
Remedial
```

Core principles:

- relational data first;
- raw activity data before summaries;
- summaries/statistics are derived;
- planned teaching and actual teaching are separate;
- reports are outputs, not sources of truth;
- optional academic context must not block daily workflows;
- preserve history for important records.

All schema changes MUST use Prisma migrations.

---

## 6. Authentication & Authorization

V1 baseline:

- Email/password authentication
- Session-based access
- Roles:
  - teacher
  - parent

Teacher is the primary user. Do not build complex school-wide RBAC in V1, but enforce these boundaries:

### School Workspace Membership
- `TeacherSchoolMembership` manages teacher access to a school.
- Joining an existing school or creating a new one sets the status to ACTIVE immediately (frictionless onboarding in V1).

### Parent Data Governance
- Parent access is secondary and requires two steps:
  1. `ParentStudentRelation`: Links Parent to Student.
  2. `ParentTeachingAccess`: Context-specific approval by the Teacher owning the `TeachingContext`.
- A Teacher can only approve parent access for their own `TeachingContext`.
- Even when approved, Parents only see Parent-facing data (e.g., PRIVATE vs PARENT_VISIBLE teacher notes).
- Workspace membership approval and Parent data access approval are separate systems.

---

## 7. AI Architecture

Do not call Gemini directly from random UI components.

Use an abstraction:

```text
UI
 ↓
AI Service
 ↓
AI Provider
 ↓
Gemini
```

Example service capabilities:

```text
generateLessonPlan()
generateMaterial()
generateQuestions()
generateAnswerKey()
generateWorksheet()
generatePresentationContent()
generateRPP()
generateSummary()
generateNarrativeInsight()
```

AI outputs should use structured data where appropriate.

Example:

```json
{
  "title": "Sistem Pernapasan",
  "questions": [],
  "answerKey": [],
  "metadata": {}
}
```

AI output flow:

```text
Generate
 ↓
Validate
 ↓
Preview
 ↓
Teacher Review
 ↓
Edit
 ↓
Save / Use / Download
```

### V1 AI Boundary

AI MAY:

- generate content;
- summarize;
- explain;
- recommend;
- generate narrative insight.

AI MUST NOT in V1:

- correct student answer sheets;
- perform OCR grading;
- determine essay scores;
- determine final student grades;
- replace teacher academic judgment.

Principle:

> AI Assists, Teacher Decides.

---

## 8. Analysis Engine

Deterministic calculations should use normal application/database logic.

Examples:

- average score;
- highest/lowest score;
- mastery count;
- attendance rate;
- missing assignments;
- remedial frequency;
- grade trend;
- TP achievement where mapping exists.

AI may explain these calculations in natural language, but AI is not the source of the numeric result.

```text
Core Data
 ↓
Rules / Calculation
 ↓
Analysis
 ↓
Optional AI Explanation
```

---

## 9. Excel as a First-Class Format

Excel is a CORE V1 format, both for input and editable output.

### Import

Use SheetJS for:

- student imports;
- score imports;
- attendance imports;
- CSV/XLSX parsing;
- preview and column mapping.

Import workflow:

```text
Upload
 ↓
Read
 ↓
Preview
 ↓
Map Columns
 ↓
Validate
 ↓
Confirm
 ↓
Database Update
```

Never import directly into production data without preview and validation.

### Export

Use ExcelJS for professional editable XLSX output.

Required export targets may include:

- Student List.xlsx
- Score Recap.xlsx
- Attendance Recap.xlsx
- Remedial Recap.xlsx
- Assignment Recap.xlsx
- Assessment Analysis.xlsx
- TP Progress.xlsx
- Teaching Journal Recap.xlsx
- Report Grade Data.xlsx

Generated Excel may include:

- title/header;
- school/class/subject metadata;
- formatted columns;
- freeze panes;
- filters;
- borders;
- widths;
- number formats;
- formulas where appropriate;
- data validation where useful.

### Excel is NOT the Database

```text
PostgreSQL
 SOURCE OF TRUTH
      │
      ├── Application
      └── Export XLSX
```

Editing a downloaded Excel file does not automatically modify the application database.

To bring changes back:

```text
Edited XLSX
 ↓
Import
 ↓
Preview Changes
 ↓
Validation
 ↓
Teacher Confirmation
 ↓
Database Update
```

---

## 10. Document & Export Engine

```text
CORE DATA
    ↓
DOCUMENT / EXPORT ENGINE
    │
    ├── XLSX — editable academic/administrative data
    ├── DOCX — editable administrative documents
    ├── PPTX — editable learning presentation
    └── PDF  — final / print / submission format
```

V1 priority:

1. Excel
2. DOCX
3. PDF
4. PPTX

Template design must remain separate from core data.

---

## 11. File Storage

Do not store large binary files directly inside PostgreSQL.

```text
Database
 ↓
File Metadata

Storage Provider
 ↓
Actual File
```

Use a StorageService abstraction:

```text
upload()
download()
delete()
getUrl()
```

Development may use a simple implementation; production storage can later be changed without rewriting business modules.

---

## 12. Validation

Use Zod for boundaries such as:

- forms;
- server actions;
- API requests;
- imported spreadsheet data;
- AI structured output.

Frontend validation alone is not sufficient.

---

## 13. UI Architecture

Use reusable components and design tokens.

Core UI primitives:

- Button
- Input
- Select
- Combobox
- Table
- Tabs
- Badge
- Modal
- Drawer
- Toast
- Alert
- Empty State
- Skeleton
- File Upload
- Search
- Pagination

Primary UX principles:

- daily work first;
- minimum click;
- context aware;
- progressive disclosure;
- optional means optional;
- responsive;
- fast score input.

---

## 14. Responsive Strategy

Desktop/laptop optimized for:

- mass score entry;
- spreadsheet import/export;
- reporting;
- document editing;
- analytics;
- academic setup.

Mobile optimized for:

- attendance;
- today view;
- teacher notes;
- quick actions;
- simple monitoring;
- parent portal.

Do not force identical layouts between desktop and mobile.

---

## 15. Testing Strategy

Use:

```text
Unit Tests
+
Integration Tests
+
Playwright E2E Tests
```

Critical E2E flows will eventually include:

```text
Login
 ↓
Create / Open Class
 ↓
Teaching Session
 ↓
Attendance
 ↓
Assessment
 ↓
Input Score
 ↓
Analysis
 ↓
Report / Excel Export
```

Each development stage must pass its own tests before progressing.

---

## 16. Production Architecture

Initial production target:

```text
Internet
   ↓
Nginx
   ↓
Next.js / Node.js
   ↓
PM2
   │
   ├── PostgreSQL
   ├── File Storage
   └── Gemini API
```

Do NOT introduce by default:

- Docker;
- Kubernetes;
- Kafka;
- Redis clusters;
- vector databases;
- microservices;
- separate Python AI servers.

They may be introduced later only if a verified requirement exists.

---

## 17. Recommended Project Structure

```text
AI Teacher Assistant/
│
├── src/
│   ├── app/
│   ├── components/
│   ├── modules/
│   ├── services/
│   └── lib/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│
├── docs/
│   ├── product/
│   ├── architecture/
│   └── development/
│
├── tests/
│
├── .agents/
│   └── rules/
│
└── MASTER_CONTEXT.md
```

---

## 18. Non-Negotiable V1 Architecture Principles

1. Modular Monolith.
2. PostgreSQL is the core source of truth.
3. Prisma migrations for database changes.
4. Academic Context is optional.
5. Planned Teaching ≠ Actual Teaching.
6. Activity Generates Data.
7. Reports are generated from core data.
8. Excel is a first-class editable import/export format.
9. AI is behind an AI Service abstraction.
10. Deterministic calculations do not rely on AI.
11. Teacher manually corrects student work in V1.
12. AI never determines student grades in V1.
13. Reusable components over duplicated UI.
14. One passed development stage must not be broken by the next.
15. Keep V1 simple; add infrastructure only when a real requirement exists.
