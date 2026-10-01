# DEVELOPMENT STAGE 03 — DAILY TEACHING
## AI Teacher Assistant

Status: READY FOR IMPLEMENTATION PLAN

Stable checkpoint:

```text
dev-stage-02-pass
```

Development Stage 00, Stage 01, and Stage 02 are officially PASS and LOCKED.

---

# 1. OBJECTIVE

Build the teacher's daily classroom workflow on top of the approved School Workspace architecture.

Core flow:

```text
Teacher Login
↓
Hari Ini
↓
Choose TeachingContext
↓
Start Teaching Session
↓
Attendance
↓
Record Actual Teaching
↓
Optional Lightweight Assignment
↓
Complete Session
↓
Teaching Journal Generated
```

The goal is to reduce repetitive teacher administration while preserving the teacher as the source of truth for what actually happened in class.

---

# 2. AUTHORITATIVE ARCHITECTURE CONTRACT

Development Stage 03 MUST consume the Stage 02 architecture without redefining it.

Locked principles:

> SHARED STUDENT IDENTITY, CONTEXT-OWNED LEARNING DATA.

> INPUT ONCE, USE EVERYWHERE.

School Workspace owns/scopes:

```text
School
AcademicPeriod
Subject
Class
Student
ClassStudent
```

TeachingContext scopes teacher-generated learning data:

```text
TeachingSession
Attendance
Assignment
future Assessment
future Score
future Remedial
future Teacher Notes
future Learning Progress
```

Do NOT move Student ownership back to TeacherProfile.

Do NOT duplicate Student records per teacher or per subject.

---

# 3. STAGE 03 SCOPE

In scope:

```text
Hari Ini
Teaching Session
Attendance
Actual Teaching
Session Completion
Teaching Journal View
Lightweight Assignment
Class Detail integration
Daily history
```

Out of scope:

```text
Assessment
Score Input
Remedial
Student Monitoring Analytics
AI Studio
Gemini
Parent Portal
Reports Engine
CP / TP / ATP implementation
CBT
OCR
AI grading
Student digital submissions
```

---

# 4. DAILY TEACHING PRINCIPLE

The teacher should not fill several separate forms for one classroom event.

A single TeachingSession becomes the source for:

```text
Date
Teacher
School
Class
Subject
Academic Period
Attendance
Actual Topic
Activity Summary
Assignment
Teaching Journal
```

Do NOT create duplicate teacher input for journal data already known from the session.

---

# 5. TEACHING SESSION

Add a `TeachingSession` entity.

Conceptual fields:

```text
TeachingSession
- id
- teachingContextId
- date
- startedAt optional
- endedAt optional
- plannedTopic optional
- actualTopic optional
- activitySummary optional
- reflection optional
- status
- createdAt
- updatedAt
```

Recommended status enum:

```text
DRAFT
IN_PROGRESS
COMPLETED
```

A TeachingSession belongs to exactly one TeachingContext.

Through TeachingContext the system resolves:

```text
Teacher
School
AcademicPeriod
Subject
Class
```

Do not duplicate those foreign keys in TeachingSession unless technically justified.

---

# 6. MULTIPLE SESSIONS PER DAY

Do NOT enforce:

```text
one TeachingContext + one date = one session
```

A teacher may teach the same class/subject more than once in one day.

The system must support:

```text
PAI — VIII A
Session 1 — 08:00
Session 2 — 13:00
```

If start/end time is not provided, multiple sessions must still remain possible.

---

# 7. HARI INI

Implement:

```text
/hari-ini
```

Purpose:

A fast entry point for daily teaching.

Display teacher TeachingContexts within the active School Workspace.

Example:

```text
Hari Ini

VIII A
PAI
2026/2027 Ganjil
[Mulai Mengajar]

IX B
PAI
2026/2027 Ganjil
[Mulai Mengajar]
```

Do NOT fabricate a timetable if no real timetable data exists.

The teacher manually chooses the TeachingContext.

Also show today's real sessions when available:

```text
Sedang Berlangsung
Selesai Hari Ini
```

No fake statistics.

---

# 8. START SESSION FLOW

From `/hari-ini` or class detail:

```text
Choose TeachingContext
↓
Start Session
↓
TeachingSession created
↓
status = IN_PROGRESS
```

Session context should already know:

```text
School
Class
Subject
AcademicPeriod
Teacher
```

Do NOT ask the teacher to select those values again.

Optional initial input:

```text
plannedTopic
```

but it must not block session creation.

---

# 9. SHARED ROSTER SOURCE

Attendance roster MUST come from Stage 02:

```text
TeachingContext
↓
Class + AcademicPeriod
↓
ClassStudent
↓
Student
```

The roster must be shared across teachers teaching the same Class + AcademicPeriod.

Example:

```text
Pak Budi — PAI — VIII A
Pak Andi — Mathematics — VIII A
```

Both use the same Student identity and ClassStudent roster.

Attendance records themselves remain separate because they belong to different TeachingSessions / TeachingContexts.

---

# 10. ATTENDANCE MODEL

Add:

```text
AttendanceRecord
- id
- teachingSessionId
- studentId
- status
- note optional
- createdAt
- updatedAt
```

Recommended enum:

```text
PRESENT
SICK
PERMISSION
ABSENT
LATE
```

Required uniqueness:

```text
@@unique([teachingSessionId, studentId])
```

A Student can have only one attendance status for one TeachingSession.

---

# 11. ATTENDANCE HISTORICAL INTEGRITY

Historical attendance must not depend on the current roster later.

Example:

```text
18 Aug:
VIII A had 30 students
Attendance saved

1 Sep:
new student joins VIII A
```

The new student must NOT retroactively appear as "missing attendance" in the old 18 Aug TeachingSession.

Attendance history should be derived from the AttendanceRecords saved for that historical session, not from blindly re-evaluating the current roster.

If implementation requires snapshot semantics, explain the simplest safe approach in the Implementation Plan.

Do not build an unnecessarily complex roster-versioning subsystem in Stage 03.

---

# 12. ATTENDANCE UX — MOBILE FIRST

Primary flow:

```text
Attendance
↓
Mark All Present
↓
Change Exceptions
↓
Save
```

Requirements:

- one-tap "Semua Hadir";
- fast status change;
- clear unsaved/saving/saved state;
- prevent accidental data loss;
- compact mobile layout;
- desktop table/list where appropriate.

Teacher should not need to open each Student separately.

---

# 13. ATTENDANCE SAVE RULES

When attendance is saved:

- only Students in the authorized Class + AcademicPeriod roster may be written;
- server verifies TeachingContext ownership;
- server verifies TeachingSession belongs to that TeachingContext;
- duplicate AttendanceRecord is updated/upserted safely;
- unauthorized Student IDs are rejected;
- cross-School Student IDs are rejected.

Do not trust client-submitted roster IDs without verification.

---

# 14. ACTUAL TEACHING

Teacher records what actually happened.

Minimum:

```text
actualTopic
activitySummary optional
reflection optional
```

`actualTopic` is separate from:

```text
plannedTopic
```

This preserves the product principle:

> Planned Teaching and Actual Teaching are separate.

Do not overwrite planning data to represent actual teaching.

---

# 15. SESSION COMPLETION

Teacher can complete a session after:

```text
Attendance
+
Actual Teaching
```

Recommended minimum completion rule:

- session has an actualTopic;
- attendance state has been explicitly saved or intentionally marked as not recorded with a clear reason if such an exception is approved during planning.

Prefer simple V1 behavior.

Do not silently mark incomplete attendance as complete.

When complete:

```text
status = COMPLETED
endedAt = current time if appropriate
```

Completed sessions remain editable only under controlled rules.

At minimum preserve an edit history timestamp.

Do not implement complex approval workflows.

---

# 16. TEACHING JOURNAL

Teaching Journal is primarily a DERIVED VIEW of TeachingSession.

Do NOT create another duplicate form asking Teacher/Class/Subject/Date/Topic/Attendance again.

Journal derives:

```text
Teacher name → User.name
School → School
Class → TeachingContext
Subject → TeachingContext
Academic Period → TeachingContext
Date → TeachingSession
Actual Topic → TeachingSession
Activity → TeachingSession
Attendance recap → AttendanceRecord
Assignment → Assignment when present
```

Implement a journal view such as:

```text
/kelas/[teachingContextId]/jurnal
```

or another route consistent with the current IA.

Stage 03 does not require the full Stage 07 document/export engine.

A clean printable/on-screen journal view is sufficient.

---

# 17. JOURNAL STATUS

The system may show:

```text
Draft
Completed
```

based on TeachingSession status.

Do not create an independent journal lifecycle unless technically necessary.

TeachingSession remains the source of truth.

---

# 18. LIGHTWEIGHT ASSIGNMENT

Stage 03 includes a lightweight teacher-created assignment.

Conceptual model:

```text
Assignment
- id
- teachingContextId
- teachingSessionId optional
- title
- description optional
- dueDate optional
- status
- createdAt
- updatedAt
```

The Assignment belongs to TeachingContext.

If created during a TeachingSession, link it to that session.

Suggested status:

```text
ACTIVE
ARCHIVED
```

Stage 03 assignment means:

> teacher records that an assignment was given.

Do NOT implement:

```text
Student Submission
File Upload by Student
Online LMS workflow
Automatic grading
Parent delivery
```

---

# 19. CLASS DETAIL INTEGRATION

Enhance:

```text
/kelas/[teachingContextId]
```

with real Stage 03 functionality.

Suggested tabs/sections:

```text
Overview
Siswa
Pertemuan
Absensi
Jurnal
Tugas
```

Only add tabs backed by real implemented data.

Do not add Assessment/Nilai/Remedial/AI until their stages are implemented.

---

# 20. SESSION HISTORY

Teacher should be able to view sessions for a TeachingContext.

All counts must be derived from real AttendanceRecords.

---

# 21. ATTENDANCE RECAP — STAGE 03 LIMIT

Stage 03 may provide basic per-session attendance recap:

```text
28 Hadir
1 Sakit
1 Izin
0 Alpha
```

Do NOT build advanced cross-semester attendance analytics yet.

---

# 22. CONTEXT-OWNED LEARNING DATA

This is non-negotiable.

Shared Student identity does NOT mean shared teacher-generated learning data.

Pak Andi teaching Mathematics in the same Class must NOT automatically see Pak Budi's activitySummary, reflection, assignment details, or TeachingSession internals unless a later explicit product rule allows it.

---

# 23. AUTHORIZATION

Reuse Stage 02 authorization architecture.

At minimum:

```text
verifyActiveSchoolMembership(...)
verifyTeachingContextAccess(...)
verifyClassRosterAccess(...)
```

Add Stage 03-specific helpers where useful, for example:

```text
verifyTeachingSessionAccess(...)
```

Server must verify:

```text
Authenticated Teacher
↓
ACTIVE School
↓
Own TeachingContext
↓
TeachingSession belongs to TeachingContext
↓
Student belongs to Class + AcademicPeriod roster
```

Do not rely on hidden buttons or client-provided IDs.

---

# 24. CROSS-SCHOOL SAFETY

Reject:

```text
TeachingSession School A
+
Student School B
```

Reject cross-context and direct-ID authorization bypasses.

Stage 02 consistency rules continue to apply.

---

# 25. EMPTY STATES

Use actionable empty states for:

- no TeachingContext;
- empty roster;
- attendance not recorded;
- no sessions yet.

---

# 26. ERROR STATES

Handle gracefully:

- session creation failure;
- stale TeachingContext;
- roster unavailable;
- attendance save failure;
- duplicate attendance write;
- assignment save failure;
- completed session edit conflict;
- revoked School membership;
- unauthorized direct URL access.

Never expose raw Prisma errors or stack traces.

---

# 27. RESPONSIVE UX

Desktop:

- efficient table/list for attendance;
- class/session history easy to scan.

Mobile:

- `/hari-ini` optimized for quick start;
- attendance minimal taps;
- sticky save/action area if useful;
- no horizontal table overflow;
- touch-friendly controls.

---

# 28. DATA MODEL SUMMARY

Expected conceptual Stage 03 additions:

```text
TeachingSession
AttendanceRecord
Assignment
```

Prefer no duplicate `TeachingJournal` table.

---

# 29. INDEXES / CONSTRAINTS

Implementation Plan should consider indexes for:

```text
TeachingSession.teachingContextId
TeachingSession.date
TeachingSession.status

AttendanceRecord.teachingSessionId
AttendanceRecord.studentId

Assignment.teachingContextId
Assignment.teachingSessionId
Assignment.dueDate
```

Required:

```text
@@unique([teachingSessionId, studentId])
```

---

# 30. STAGE 02 REGRESSION CONTRACT

Stage 03 must not break School Workspace, activeSchoolId, shared academic masters, TeachingContext, Shared Student Identity, ClassStudent roster, Student CRUD, Excel import, /siswa authorization, or /kelas authorization.

---

# 31. TESTING STRATEGY — STRONGER THAN SMOKE ONLY

Stage 03 must add meaningful automated coverage.

At minimum include tests for:

```text
create TeachingSession
multiple sessions same day
load correct shared roster
Mark All Present
change attendance exceptions
attendance uniqueness
unauthorized Student attendance rejected
cross-School attendance rejected
save actualTopic
complete session
journal derives correct session data
assignment creation
TeachingContext isolation
direct URL authorization
historical attendance integrity after roster changes
```

Retain Stage 00–02 regression tests.

---

# 32. REQUIRED MANUAL VERIFICATION

Desktop and mobile verification for:

```text
/hari-ini
start session
attendance
actual teaching
complete session
journal
assignment
session history
```

Verify no blocking browser console/runtime errors.

---

# 33. ACCEPTANCE CRITERIA

Development Stage 03 is PASS only if:

- Hari Ini works in active School.
- TeachingSession persists and supports multiple same-day sessions.
- Attendance uses ClassStudent roster.
- Mark All Present and exceptions work.
- Attendance unique per Session + Student.
- historical attendance integrity is preserved.
- actual vs planned topic remains separate.
- session completion validation works.
- Journal is derived, not duplicate input.
- Lightweight Assignment works.
- authorization/security passes.
- desktop/mobile passes.
- Prisma migration/generate passes.
- TypeScript/build/lint pass.
- meaningful automated tests and Playwright pass.
- Stage 00/01/02 regressions pass.
- no Stage 04+ implementation.

---

# 34. COMPLETION REPORT FORMAT

Return a full STAGE 03 COMPLETION REPORT with PASS/FAIL for:

- Hari Ini
- Teaching Session
- Multiple Sessions Same Day
- Shared Roster Source
- Attendance
- Historical Attendance Integrity
- Actual Teaching
- Session Completion
- Teaching Journal
- Assignment
- Authorization / Security
- Persistence
- Desktop Responsive
- Mobile Responsive
- TypeScript
- Build
- Lint
- Automated Tests
- Playwright
- Stage 00 Regression
- Stage 01 Regression
- Stage 02 Regression
- Known Issues
- Acceptance Criteria

End with `DEVELOPMENT STAGE 03: PASS` only if every blocking criterion passes.

Do NOT create a Git PASS checkpoint automatically.
Do NOT proceed to Stage 04.

---

# 35. DEFINITION OF DONE

```text
TeachingContext
↓
TeachingSession
↓
Shared Class Roster
↓
Attendance
↓
Actual Teaching
↓
Optional Assignment
↓
Complete Session
↓
Derived Journal
↓
Persistence
↓
Security
↓
Mobile/Desktop
↓
Tests
↓
Regression
↓
PASS
↓
LOCK
```

**DEVELOPMENT STAGE 03 — READY FOR IMPLEMENTATION PLAN**
