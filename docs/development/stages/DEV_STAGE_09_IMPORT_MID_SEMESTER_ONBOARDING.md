# DEVELOPMENT STAGE 09 — IMPORT & MID-SEMESTER ONBOARDING

## 1. Stage Identity

**Stage:** DEVELOPMENT STAGE 09  
**Name:** IMPORT & MID-SEMESTER ONBOARDING  
**Stable Baseline:** `dev-stage-08-pass`  
**Stable Commit:** `3396f3dabfa5a4bdec8d583c44c31227d471c955`

Stages 00–08 are **PASS + TAGGED + LOCKED**.

Roadmap source: Stage 09 is the import / mid-semester onboarding stage, followed by Stage 10 Polish, QA & Release.

---

## 2. Product Goal

Allow a teacher to start using Teacher OS **at any point in the semester** without requiring complete historical reconstruction before the product becomes useful.

Core principle:

> **START ANYTIME, GROW THE CONTEXT.**

Teacher OS must support:

```text
Teacher starts today
→ set up/reuse School + Period + Subject + Class
→ create TeachingContext
→ import/reuse current roster
→ optionally bring in selected historical facts
→ continue normal Teacher OS workflows from today
```

The product must NOT force:

```text
"Reconstruct every lesson, attendance record, score, and document
from the beginning of the semester before you can start."
```

More historical data improves continuity, but is not a prerequisite.

---

## 3. Stage 09 Mental Model

Stage 09 is a **controlled bridge from existing teacher records into Teacher OS**.

It is NOT:

- arbitrary database import;
- database migration from any external school system;
- universal SIS integration;
- report-card import;
- LMS migration;
- AI/OCR document extraction;
- automatic interpretation of unknown spreadsheets.

Mental model:

```text
Existing teacher spreadsheet
→ Upload
→ Detect / Map Columns
→ Validate
→ Preview
→ Teacher Confirms
→ Deterministic Import
→ Audit Summary
```

Never:

```text
Upload
→ silently write everything
```

---

## 4. Locked Product Principles

Preserve:

- INPUT ONCE, USE EVERYWHERE
- ASK ONLY WHEN NEEDED
- START ANYTIME, GROW THE CONTEXT
- MORE CONTEXT = BETTER EXPERIENCE, NOT REQUIRED EXPERIENCE
- AI ASSISTS, TEACHER DECIDES
- ACTIVITY GENERATES DATA
- TEACHER FIRST
- AUTOMATE ADMINISTRATION FIRST, AUTOMATE JUDGMENT LATER
- SHARED STUDENT IDENTITY, CONTEXT-OWNED LEARNING DATA
- ARCHIVE OVER DELETE
- HISTORICAL INTEGRITY
- SERVER-SIDE AUTHORIZATION

No AI is required for deterministic import mapping/validation in V1.

---

## 5. Current Reusable Capability

Stage 02 already provides:

```text
Excel Student Import
→ Upload
→ Preview
→ Mapping
→ Validation
→ Confirm
→ Import
```

Stage 09 must inspect and reuse this pipeline where practical instead of building a second unrelated importer.

Existing shared Student rules remain LOCKED:

```text
Student = School-scoped shared identity

ClassStudent =
Student + Class + AcademicPeriod
```

Student must never become teacher-owned.

---

## 6. Stage 09 V1 Scope

Stage 09 V1 has TWO product surfaces:

### A. Mid-Semester Setup / Catch-Up Wizard

A teacher can explicitly choose:

```text
Mulai dari sekarang
```

or:

```text
Saya punya data sebelumnya
```

Both paths must eventually lead to a usable TeachingContext.

### B. Controlled Historical Imports

Historical imports are OPTIONAL.

V1 should support only data categories whose semantics can be made deterministic and historically safe.

Target import categories:

1. Current Student Roster
2. Historical Teaching Sessions / Journal facts
3. Historical Attendance
4. Historical Completed Assessment Results

The Implementation Plan must inspect current schema/services and may recommend narrowing a category if a safe mapping cannot be guaranteed.

Do NOT add a category merely because a spreadsheet contains it.

---

# PART A — MID-SEMESTER ONBOARDING

## 7. Start-Now Path

The teacher may start Teacher OS without importing history.

Required flow:

```text
Login / existing Teacher
→ active School
→ choose/reuse AcademicPeriod
→ choose/reuse Subject
→ choose/reuse Class
→ create/reuse TeachingContext
→ roster setup/import
→ choose "Mulai dari sekarang"
→ Teacher OS usable immediately
```

No requirement to create:

- past TeachingSessions;
- old Attendance;
- old Assessments;
- old AcademicPlan links;
- CP/TP/ATP;
- Prota/Prosem.

These remain optional context.

---

## 8. Existing-Data Path

Teacher may choose:

```text
Saya punya data sebelumnya
```

Then Stage 09 presents optional import steps.

Recommended wizard:

```text
1. Konteks Mengajar
2. Daftar Siswa
3. Pertemuan Sebelumnya (optional)
4. Kehadiran Sebelumnya (optional)
5. Nilai Selesai Sebelumnya (optional)
6. Review
7. Import
8. Selesai → Continue normal Teacher OS
```

Teacher can skip every optional historical step.

---

## 9. No Duplicate Setup

Stage 09 must reuse existing masters before creating new ones.

For:

- School
- AcademicPeriod
- Subject
- Class
- Student

Prefer:

```text
search/reuse
```

before:

```text
create duplicate
```

Never duplicate a Student merely because a spreadsheet row was imported.

---

# PART B — IMPORT ENGINE

## 10. Shared Import Pipeline

All Stage 09 importers should follow one reusable pipeline:

```text
Upload
↓
Parse workbook
↓
Choose sheet
↓
Column Mapping
↓
Validation
↓
Preview normalized rows
↓
Conflict/Duplicate Resolution
↓
Teacher Confirm
↓
Atomic / chunk-safe Import
↓
Import Summary
```

No database writes during Upload / Mapping / Preview.

---

## 11. Supported File Scope V1

Primary supported format:

```text
.xlsx
```

If existing Stage 02 importer safely supports `.xls` or `.csv`, the Implementation Plan may retain those formats.

Do not introduce OCR, PDF extraction, Google Sheets API, or cloud-drive integrations in Stage 09.

Use existing SheetJS/xlsx capability unless a current technical limitation requires another library.

---

## 12. File Safety

Server must enforce reasonable limits:

- file size;
- worksheet count;
- row count;
- text length per cell;
- total parsed cells where useful.

Reject:

- corrupted workbook;
- unsupported file type;
- password-protected/unreadable workbook;
- empty workbook;
- workbook with no usable rows.

Do not trust browser MIME/type alone.

No formulas should be executed.

Formula cells must be treated as imported cell values only according to safe library behavior.

Do not evaluate macros.

---

## 13. Preview Before Persistence

Preview must clearly distinguish:

```text
VALID
WARNING
ERROR
SKIPPED
DUPLICATE / EXISTING
```

Teacher must be able to see:

- row number;
- mapped source values;
- normalized target values;
- validation issue;
- intended action.

Import is allowed only after explicit teacher confirmation.

---

## 14. Import Audit Result

Every completed import must return a deterministic summary:

```text
Rows read
Rows imported
Existing/reused
Skipped
Warnings
Errors
```

Do not invent success counts.

The summary must be derived from actual transaction/import results.

Stage 09 does not require a large persisted import-history subsystem unless the Implementation Plan identifies a concrete need.

---

# CURRENT ROSTER IMPORT

## 15. Roster Import

Stage 09 preserves and improves the Stage 02 roster import rather than replacing its semantics.

Required minimum mapped field:

```text
Student.fullName
```

Optional existing Student identifiers may include currently supported fields such as NIS.

Rules:

- School-scoped Student reuse.
- Current `ClassStudent` uses exact Class + AcademicPeriod.
- Existing matching Student should be reused where deterministically safe.
- Existing ClassStudent should not duplicate.
- New Student + ClassStudent should be created transactionally where appropriate.
- Cross-School reuse is forbidden.

Do not auto-merge ambiguous students.

Ambiguous duplicate candidates must require teacher decision or be skipped.

---

# HISTORICAL TEACHING SESSION IMPORT

## 16. Historical Session Facts

Historical sessions are optional.

V1 import may support deterministic historical session facts such as:

- date;
- actualTopic;
- activitySummary if mapped;
- status as completed historical session.

Do NOT require plannedTopic.

Do NOT fabricate teacher reflection.

Do NOT create Assignments from imported text.

Imported historical session should represent:

> a factual prior teaching event supplied by the teacher.

---

## 17. Imported Session Status

Historical imported sessions should not enter normal live workflow as DRAFT/active sessions.

Recommended semantic:

```text
imported prior session
→ persisted as COMPLETED historical TeachingSession
```

The Implementation Plan must inspect current lifecycle guards and propose the safest additive implementation.

Do not bypass normal service invariants through raw Prisma writes without explicit import-specific validation.

---

# HISTORICAL ATTENDANCE IMPORT

## 18. Attendance Historical Snapshot

Attendance import is allowed only when the spreadsheet provides enough information to create stable factual records.

Required conceptual mapping:

```text
historical TeachingSession
+
Student
+
Attendance status
→ AttendanceRecord
```

Rules:

- exact authorized TeachingContext;
- exact School;
- Student must belong to the School;
- attendance record becomes a historical participant snapshot;
- later roster changes must not rewrite it.

Do NOT derive imported historical attendance from current roster alone.

The import row itself is the historical participant evidence.

---

## 19. Attendance Status Mapping

Only map explicit supported statuses.

Examples:

```text
Hadir → PRESENT
Terlambat → LATE
Sakit → SICK
Izin → PERMISSION
Alpa/Tidak Hadir → ABSENT
```

Unknown status:

```text
→ validation error / requires mapping
```

Never guess.

No AI classification.

---

## 20. Attendance Session Matching

Attendance rows need deterministic session matching.

Preferred:

```text
TeachingContext
+
session date
+
optional explicit session/import key
```

But multiple TeachingSessions may exist on the same date.

Therefore date alone must NOT be assumed unique.

Implementation Plan must define safe session resolution.

If source data is ambiguous:

```text
→ teacher resolves mapping
```

Never silently attach attendance to an arbitrary same-day session.

---

# HISTORICAL ASSESSMENT IMPORT

## 21. Historical Score Import Boundary

Stage 09 may import only **completed historical assessment facts**.

It is NOT an alternate scoring engine.

Required conceptual result:

```text
Assessment COMPLETED
+
historical participant snapshot
+
AssessmentResult
```

No imported Assessment may bypass Stage 04 numeric invariants.

---

## 22. Score Import Semantics

Required fields must be sufficient to establish:

- assessment identity/title;
- assessment date;
- assessment type/category or deterministic mapping;
- maxScore when raw score is imported;
- Student;
- result state;
- score.

Supported factual states:

```text
GRADED
ABSENT
EXCUSED
```

PENDING historical import should normally not be needed.

For GRADED:

```text
rawScore
→ existing deterministic normalization
→ normalizedScore
→ initial finalScore
```

Use the same Stage 04 Decimal logic.

Never accept imported:

```text
normalizedScore
finalScore
```

as authoritative if they conflict with deterministic rules unless the product explicitly supports a separate teacher-confirmed historical final-score field.

The Implementation Plan must inspect existing remedial/finalScore logic before finalizing this import contract.

---

## 23. Missing Is Not Zero

Historical import must preserve:

```text
blank / missing
≠ 0
```

Zero is a legitimate score only when explicitly present.

ABSENT / EXCUSED:

```text
rawScore = null
normalizedScore = null
finalScore = null
```

No spreadsheet blank may silently become zero.

---

## 24. Assessment Participant Historical Integrity

Imported completed assessments must create a stable participant record only for students explicitly represented by the imported data.

Do NOT snapshot the entire CURRENT roster for a historical imported assessment unless the source data explicitly represents that full roster and the teacher confirms it.

This is essential for mid-semester onboarding.

Example:

```text
Historical spreadsheet lists 28 students
Current roster has 30 students

Imported old assessment
→ historical participants = those 28 imported facts
NOT current 30
```

---

## 25. GradePolicy / Running Performance

Importing historical assessments does NOT require GradePolicy.

If ACTIVE GradePolicy exists, existing deterministic aggregation may naturally include valid COMPLETED imported assessments according to existing rules.

Do not automatically create or change GradePolicy during score import.

Do not invent report-card semantics.

---

# IMPORT CONFLICTS & IDEMPOTENCY

## 26. Re-Import Safety

Stage 09 must not make accidental double-import easy.

Implementation Plan must define deterministic duplicate keys / conflict strategy per import category.

Potential direction:

```text
Roster:
existing Student/ClassStudent → reuse/skip

Attendance:
same historical Session + Student → update only through explicit conflict resolution

Assessment:
same imported assessment identity + Student → do not duplicate silently
```

Do NOT create a fragile global "dedupe by title/date" rule without context-specific safeguards.

---

## 27. No Silent Overwrite

When imported data conflicts with existing Teacher OS data:

```text
existing value
vs
incoming value
```

default must be:

```text
show conflict
→ teacher chooses
```

unless the action is provably idempotent.

Do not silently overwrite:

- attendance;
- score;
- finalScore;
- completed session facts;
- existing Student identity.

---

## 28. Import Transactions

Import must avoid half-completed inconsistent state.

Use appropriate transaction/chunk strategy.

For a confirmed batch:

- fatal validation failure before write → zero writes;
- transactional group where practical;
- if chunking is required for scale, summary must report committed chunks accurately.

Do not claim all-or-nothing if implementation is chunked.

The Implementation Plan must explain its strategy.

---

# AUTHORIZATION

## 29. Teacher Authorization

Every import must enforce:

```text
Authenticated User
↓
TeacherProfile
↓
ACTIVE School
↓
owned TeachingContext where learning data is imported
↓
target resources
```

Membership alone does not grant access to other teachers' TeachingContexts.

For shared roster/master import:

```text
ACTIVE School
+
authorized class/TeachingContext workflow
```

must still prevent broad Student database abuse.

---

## 30. Client IDs Are Never Authority

Never trust:

- schoolId;
- teachingContextId;
- classId;
- academicPeriodId;
- subjectId;
- studentId;
- assessmentId;
- sessionId

just because the browser submitted them.

Server resolves and verifies relational consistency.

---

## 31. Required Security / IDOR Matrix

Test at minimum:

- cross-School import → reject
- Teacher A imports into Teacher B TeachingContext → reject
- manipulated TeachingContext ID → reject
- manipulated Class ID → reject
- manipulated AcademicPeriod ID → reject
- Student from another School → reject
- same-day Session A/B ambiguity not silently resolved
- imported attendance cannot target another-context session
- imported assessment type from Context A cannot create assessment in Context B
- imported Student/result from School B rejected
- School OWNER cannot override Teacher B context
- direct server action / IDOR attempts rejected
- preview token/state cannot be reused to write into another context

UI hiding is not security.

---

# IMPORT PREVIEW TRUST BOUNDARY

## 32. Preview Data Must Not Become an Authority Token

If the implementation serializes preview rows to the browser, server must not blindly trust the normalized IDs/values returned on Confirm.

Confirm must either:

- re-parse/revalidate server-held source; or
- use a server-signed/secure import session mechanism; or
- fully revalidate every submitted normalized row and target relation.

The Implementation Plan must explicitly choose a trust model.

Do not allow browser manipulation to convert:

```text
preview for Context A
→ confirm into Context B
```

---

# UX

## 33. Teacher-First Wizard

UX should feel like:

> "Bawa data yang sudah lu punya, terus mulai pakai Teacher OS."

Not:

> "Isi ulang semua data dari nol."

Recommended entry:

```text
Pengaturan / Setup
→ Mulai di tengah semester
```

or equivalent location consistent with current IA.

---

## 34. Progressive Optionality

Each historical step should have:

```text
Lewati
```

Teacher can import:

```text
Roster only
```

and start.

Or:

```text
Roster + attendance
```

Or:

```text
Roster + sessions + attendance + scores
```

No all-or-nothing historical onboarding requirement.

---

## 35. Mapping UX

Column mapping should show:

```text
Kolom file
→ Field Teacher OS
```

Provide auto-suggestions based on normalized headers where deterministic.

Example:

```text
Nama Siswa
Nama
Nama Lengkap
→ Student.fullName
```

But teacher confirms mapping.

No AI required.

---

## 36. Conflict UX

Conflict rows should be visibly separated:

```text
Existing Student
Existing Attendance
Existing Assessment Result
Ambiguous Session
Invalid Status
Unknown Student
```

Teacher must understand what will happen before Confirm.

---

## 37. Mobile / Desktop

Desktop:
- efficient table preview;
- mapping columns;
- filters for errors/warnings.

Mobile:
- usable upload/setup;
- stacked row cards where tables become unusable;
- teacher can review errors and confirm safely.

Do not make mobile require horizontal spreadsheet navigation for essential decisions.

---

# DATA MODEL / PERSISTENCE

## 38. Avoid Import-Duplicate Domain Tables

Do NOT create duplicate permanent domain data like:

```text
ImportedAttendance
ImportedScore
ImportedSession
```

Authoritative accepted import should end in the existing domain tables.

Temporary import state may exist only if technically needed for secure preview/confirmation.

If persistent import sessions are proposed, they must be:

- minimal;
- bounded;
- expiring/archivable;
- not a second source of truth.

---

## 39. Import Provenance

V1 does not require adding `importedFrom`, `sourceFileName`, or import-batch FK to every domain table.

Do not pollute every core table with provenance columns unless there is a concrete product/audit requirement.

If a lightweight `ImportBatch` is recommended for idempotency/audit, the Implementation Plan must justify:

- exact need;
- fields;
- retention;
- relation strategy;
- why a transient server workflow is insufficient.

This is an OPEN technical decision, not automatically approved.

---

# HISTORICAL INTEGRITY

## 40. Core Rule

Historical imported facts must remain stable after current roster/master changes.

Never implement historical import as:

```text
save references to current roster
→ reconstruct history later
```

Persist the actual historical participant facts into existing snapshot/result tables.

---

# MIGRATION

## 41. Migration Rule

Prefer zero schema migration if Stage 09 can be implemented through existing domain models and transient import state.

If a new import-session/audit model is genuinely required:

- additive;
- non-destructive;
- reproducible;
- `prisma migrate deploy` compatible;
- no reset;
- previous migrations untouched.

Do not add schema merely because it is convenient.

---

# STRICT OUT OF SCOPE

## 42. Stage 09 Does NOT Include

- SIS integration;
- Dapodik integration;
- Google Classroom import;
- Moodle import;
- Google Sheets OAuth/API;
- OneDrive/Drive integrations;
- arbitrary database migration;
- PDF import;
- OCR;
- image-based import;
- AI spreadsheet interpretation;
- AI column classification;
- AI score interpretation;
- StudentSubmission import;
- LMS migration;
- CBT import;
- official report-card import;
- promotion history;
- transcript import;
- behavioral/discipline import;
- parent data bulk import;
- ParentTeachingAccess bulk import;
- AI Content Draft import;
- billing/subscription;
- scheduled/background imports;
- Redis queues;
- Kafka;
- microservices;
- Python ETL backend;
- vector DB;
- Kubernetes.

---

# QA

## 43. Required Automated Tests

At minimum:

### Import Parsing / Validation
- supported workbook
- invalid workbook
- empty sheet
- invalid required column
- header normalization
- explicit zero vs blank
- status mapping
- row count/file limits

### Roster
- existing Student reuse
- no duplicate ClassStudent
- ambiguous Student conflict
- cross-School reject

### Historical Session
- completed historical session creation
- multiple same-date session ambiguity
- no fabricated reflection

### Attendance
- explicit participant records only
- unknown status rejected
- exact context/session validation
- historical record survives later roster removal
- duplicate/conflict behavior

### Assessment
- completed historical assessment/result
- Decimal normalization reuse
- missing != zero
- ABSENT/EXCUSED null scores
- imported participants are source rows, not current roster
- GradePolicy unchanged

### Authorization
full security/IDOR matrix.

### Trust Boundary
- browser modifies preview IDs
- browser changes TeachingContext between preview/confirm
- server rejects/revalidates manipulated confirmation

### Regression
Stages 00–08.

---

## 44. E2E

At minimum cover:

1. teacher enters mid-semester setup;
2. chooses Start Now and reaches usable Teacher OS without historical imports;
3. roster import preview → confirm;
4. optional history wizard can be skipped;
5. historical session import preview;
6. historical attendance import;
7. ambiguous same-date session requires resolution;
8. historical assessment import;
9. blank score not zero;
10. imported participant set does not use current roster;
11. conflict preview before overwrite;
12. manipulated context confirm rejected;
13. desktop import workflow;
14. mobile onboarding workflow;
15. Stage 00–08 regression.

---

## 45. Quality Gate

Before PASS:

```text
npx prisma generate
npx tsc --noEmit
npm run lint
npm run test
npm run build
npx playwright test
```

If migration exists:

```text
npx prisma migrate deploy
npx prisma migrate status
```

Also verify:

- desktop;
- mobile;
- console/runtime;
- security/IDOR;
- import idempotency/conflicts;
- historical integrity;
- Stage 00–08 regression;
- Git hygiene.

Any blocking failure:

```text
DEVELOPMENT STAGE 09: NOT PASS
```

---

# GIT DISCIPLINE

## 46. Stage Checkpoint

No commit/tag until final audit.

Required final tag after explicit PASS:

```text
dev-stage-09-pass
```

Workflow:

```text
Stage 09 Product Document
→ Implementation Plan
→ ChatGPT Review
→ User Approve
→ Proceed Coding
→ Completion / Verification Report
→ Final Audit
→ PASS / NOT PASS
→ Git Commit + dev-stage-09-pass
→ LOCK
```

---

## 47. Final Product Principle

Stage 09 succeeds when a real teacher can say:

> "Semester sudah jalan, data gua masih di Excel, tapi gua bisa mulai pakai Teacher OS hari ini."

Teacher OS should accept useful existing facts without demanding complete historical reconstruction and without sacrificing authorization or historical truth.
