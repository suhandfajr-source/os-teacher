# DEVELOPMENT STAGE 05 — STUDENT MONITORING

## 1. Stage Position

### Stable Git Checkpoint

- **Branch:** `main`
- **Tag:** `dev-stage-04-pass`
- **Commit:** `91a4f70512803b9b47e2fe2768565b0906233ba7`
- **Commit message:** `feat: complete development stage 04 assessment scoring`

### Locked Previous Stages

- Development Stage 00 — PASS + LOCKED
- Development Stage 01 — PASS + LOCKED
- Development Stage 02 — PASS + LOCKED
- Development Stage 03 — PASS + LOCKED
- Development Stage 04 — PASS + TAGGED + LOCKED

### Current Stage

**DEVELOPMENT STAGE 05 — STUDENT MONITORING**

Coding has **NOT STARTED**.

The required workflow remains:

Stage/Product Document  
→ Prompt Antigravity  
→ Implementation Plan  
→ ChatGPT Review  
→ Correction if required  
→ User Approval  
→ Proceed Coding  
→ Completion / Verification  
→ ChatGPT Final Audit  
→ PASS / NOT PASS  
→ Git Commit + Tag  
→ LOCK

---

# 2. Product Objective

Stage 05 turns the teacher activity data already collected in Stages 03–04 into a teacher-friendly student monitoring experience.

The goal is to help a teacher quickly understand:

- what has happened to a student in the teacher's own class/subject context;
- which factual academic or attendance signals deserve attention;
- whether remedial activity exists;
- whether a teacher-created follow-up is still open;
- where the teacher should look next.

Stage 05 must prioritize:

> **Show the teacher what happened, what is still open, and where to look next — do not decide what the student “is”.**

Stage 05 is **not** an automated student-judgment engine.

---

# 3. Locked Product Principles

The following project principles remain LOCKED:

- **INPUT ONCE, USE EVERYWHERE**
- **ASK ONLY WHEN NEEDED**
- **START ANYTIME, GROW THE CONTEXT**
- **MORE CONTEXT = BETTER EXPERIENCE, NOT REQUIRED EXPERIENCE**
- **AI RECOMMENDS / ASSISTS, TEACHER DECIDES**
- **ACTIVITY GENERATES DATA**
- **TEACHER FIRST APPROACH**
- **AUTOMATE THE ADMINISTRATION FIRST, AUTOMATE THE JUDGMENT LATER**

Stage 05 must reuse existing activity data rather than ask the teacher to re-enter the same information.

---

# 4. Locked Architecture

The core architecture remains:

> **SHARED STUDENT IDENTITY, CONTEXT-OWNED LEARNING DATA.**

## 4.1 Shared Student Identity

`Student` remains a School-owned shared identity.

Teachers in the same School can refer to the same Student roster identity where authorized.

Stage 05 must **NOT** recreate teacher-owned Student copies.

## 4.2 TeachingContext-Owned Monitoring

The main monitoring boundary is:

```text
Teacher
+ School
+ AcademicPeriod
+ Subject
+ Class
= TeachingContext
```

Example:

```text
Ahmad
Matematika VIII A
Semester 1
Pak Andi
```

is a different monitoring context from:

```text
Ahmad
PAI VIII A
Semester 1
Pak Budi
```

The Student identity is shared, but the learning data, notes, and teacher interpretation remain context-owned.

Teacher A must not automatically see Teacher B's monitoring notes or learning records.

---

# 5. Stage 05 Data Sources

Stage 05 should primarily READ and DERIVE from existing source-of-truth data.

## 5.1 Student / Roster

Reuse:

- `Student`
- `ClassStudent`

Do not duplicate Student identity.

## 5.2 Attendance

Reuse historical attendance data from:

```text
TeachingSession
→ AttendanceRecord
```

Monitoring may show factual summaries such as:

- sessions recorded;
- present count;
- absence/status counts;
- recent attendance history.

Do **not** create a discipline score or attendance risk score.

## 5.3 Assessment

Reuse:

- `Assessment`
- `AssessmentResult`

Monitoring may show:

- completed assessments;
- latest score information;
- score history;
- completed results below KKTP;
- assessment types;
- factual score trends where deterministic and directly derived.

Do not infer character or risk labels.

## 5.4 Running Performance

If the TeachingContext has an ACTIVE `GradePolicy`, reuse the Stage 04 deterministic output:

- `runningPerformance`
- `availableWeight`

Teacher-facing wording must remain consistent with Stage 04:

> **Performa berdasarkan komponen yang tersedia**

This must never be labeled as an official semester grade or report card grade.

If GradePolicy is absent or DRAFT, monitoring must still work.

## 5.5 Remedial

Reuse:

- `RemedialAttempt`
- `AssessmentResult.finalScore`

Monitoring may show:

- whether remedial exists;
- number of remedial attempts;
- latest/final score;
- remedial history.

No automatic interpretation of student character or ability.

---

# 6. Assignment Boundary

Stage 03 `Assignment` is lightweight and does not yet contain a per-student submission/completion model.

Therefore Stage 05 must **NOT** fabricate student-level assignment monitoring such as:

- "Belum mengerjakan";
- "Tidak mengumpulkan";
- assignment completion percentage.

Until per-student assignment state actually exists, Assignment is **not** a student-monitoring source in Stage 05 V1.

---

# 7. No Automatic Risk Score

Stage 05 V1 must **NOT** create:

- `riskScore`;
- automatic `AMAN / WASPADA / BERISIKO`;
- probability of failure;
- attendance risk score;
- AI-generated student risk labels;
- black-box predictive classification.

The system should expose factual signals instead.

Examples of acceptable factual signals:

- `2 nilai di bawah KKTP`
- `1 remedial`
- `3 kali Tidak Hadir`
- `1 tindak lanjut terbuka`

The teacher decides what those facts mean.

---

# 8. Factual Monitoring Filters

The class monitoring UI may support factual filters such as:

- Semua Siswa
- Ada nilai di bawah KKTP
- Pernah remedial
- Ada ketidakhadiran
- Ada tindak lanjut terbuka

These are deterministic data filters, not student judgments.

Default student sorting:

```text
Student.fullName ASC (A–Z)
```

NIS may be shown as optional secondary information where available.

Do not rank students from "most problematic" to "least problematic" by default.

---

# 9. New Persisted Data — StudentMonitoringNote

Stage 05 may introduce one new lightweight persisted learning-data model for teacher notes and follow-up.

Conceptual model:

```text
StudentMonitoringNote
- id
- teachingContextId
- studentId
- content
- requiresFollowUp
- resolvedAt?
- isArchived
- createdAt
- updatedAt
```

Exact Prisma naming, indexes, relation names, and referential actions are technical choices to be finalized in the Implementation Plan.

## 9.1 Note Example

```text
content:
"Masih kesulitan operasi pecahan."

requiresFollowUp = false
```

## 9.2 Follow-Up Example

```text
content:
"Bahas ulang setelah remedial berikutnya."

requiresFollowUp = true
resolvedAt = null
```

When resolved:

```text
resolvedAt = timestamp
```

No separate project-management system is required.

---

# 10. Notes Are Context-Owned

`StudentMonitoringNote` must be scoped to:

```text
TeachingContext
+
Student
```

Do not create School-global teacher notes.

A teacher note in Mathematics must not automatically become visible to another teacher in a different TeachingContext.

The locked principle remains:

> **Shared Student Identity does NOT mean Shared Teacher Notes.**

---

# 11. Historical Integrity

Historical monitoring notes must remain stable even when the current roster changes.

Creation rule:

```text
Authenticated Teacher
→ ACTIVE School
→ owned TeachingContext
→ Student currently reachable through authorized ClassStudent roster
→ note may be created
```

After creation:

- removing the Student from current roster must not delete the historical note;
- note history must remain tied to the original TeachingContext;
- prefer archive/deactivate over hard delete.

No destructive cascade should silently erase historical teacher monitoring records.

---

# 12. Monitoring Per TeachingContext

The core Stage 05 experience is:

```text
Kelas
→ Monitoring
```

Suggested desktop columns:

```text
Siswa
Kehadiran
Penilaian / Performa
KKTP
Remedial
Follow-up
Aksi
```

Example:

```text
Ahmad Fauzan

Kehadiran:
10 / 12 hadir

Penilaian:
3 selesai

Performa:
82.50
Bobot tersedia 70%

KKTP:
1 nilai di bawah KKTP

Remedial:
1

Follow-up:
1 terbuka

[Lihat Detail]
```

If GradePolicy is unavailable:

```text
Performa:
Belum ada bobot nilai aktif
```

Do not display an invented `0`.

---

# 13. Student Monitoring Detail

From the class monitoring table:

```text
Monitoring
→ Student Detail
```

The detail view should contain:

## 13.1 Summary

- attendance summary;
- completed assessment summary;
- running performance when available;
- available weight when available;
- KKTP factual signals;
- remedial summary;
- open follow-up count.

## 13.2 Academic / Activity Timeline

A factual timeline/list may include events such as:

```text
12 Aug — UH Pecahan — finalScore 72
15 Aug — Remedial — finalScore menjadi 80
18 Aug — Tidak Hadir
```

No AI-generated interpretation is required in Stage 05.

## 13.3 Teacher Notes

Action:

```text
+ Tambah Catatan
```

## 13.4 Follow-Up

Teacher-controlled states:

```text
Open
Resolved
```

The system does not decide whether follow-up is required.

---

# 14. Global Monitoring Page

Stage 05 may introduce:

```text
/monitoring
```

This page is a teacher-owned overview within the ACTIVE School.

Example:

```text
VIII A — Matematika
32 siswa
4 follow-up terbuka

VIII B — Matematika
30 siswa
2 follow-up terbuka
```

Clicking a TeachingContext opens the corresponding class monitoring page.

If individual students appear in the global view, their TeachingContext must always be explicit.

Do not merge different TeachingContexts into a mysterious single global student-performance number.

---

# 15. Student Profile Integration

Existing route:

```text
/siswa/[studentId]
```

may add a Stage 05 monitoring section.

Authorization remains roster- and TeachingContext-bounded.

If the teacher teaches the same Student in multiple owned contexts:

```text
Monitoring

[Matematika VIII A]
[IPA VIII A]
```

Data must remain separated by TeachingContext.

Do not silently combine context-owned learning data.

---

# 16. Empty States

Stage 05 must remain useful with partial data.

## No completed assessment

```text
Belum ada penilaian selesai.
Data akan muncul setelah penilaian selesai.
```

## No active GradePolicy

```text
Belum ada bobot nilai aktif.
Monitoring kehadiran dan hasil penilaian tetap tersedia.
```

## No attendance data

```text
Belum ada data kehadiran tercatat.
```

## No monitoring notes

```text
Belum ada catatan monitoring.
[Tambah Catatan]
```

Do not invent:

- `0%`;
- risk labels;
- fake trend data;
- fake statistics from missing inputs.

---

# 17. No Duplicate Analytics Source of Truth

Stage 05 V1 should **NOT** add duplicated summary tables such as:

- `StudentProgressSnapshot`
- `StudentRiskScore`
- `AttendanceSummary`
- `GradeSummary`

unless a concrete implementation constraint proves they are required and the user explicitly approves the change.

Default architecture:

```text
AttendanceRecord
AssessmentResult
RemedialAttempt
GradePolicy
StudentMonitoringNote

↓ deterministic service/query layer

Monitoring UI
```

Activity data remains the source of truth.

---

# 18. Authorization Contract

All Stage 05 actions and queries must follow:

```text
Authenticated User
→ TeacherProfile
→ ACTIVE School
→ owned/authorized TeachingContext
→ Student reachable for that TeachingContext
→ target monitoring data / note
```

Explicitly reject:

- cross-School access;
- cross-TeachingContext access;
- other-teacher monitoring data access;
- other-teacher private notes;
- manipulated `studentId`;
- manipulated `teachingContextId`;
- manipulated `monitoringNoteId`;
- direct URL / IDOR.

The global `/monitoring` page may only surface teacher-owned TeachingContexts in the ACTIVE School.

School `OWNER` role does **not** grant academic-superuser access to all teacher monitoring data in V1.

---

# 19. UI / UX Principles

Stage 05 UI must be:

- clean;
- calm;
- modern;
- teacher-first;
- spacious;
- responsive;
- practical;
- no ERP clutter.

Rules:

- no fake data;
- no fake statistics;
- no fake timetables;
- no duplicate input;
- actionable empty states;
- clear loading/saving/saved feedback;
- mobile must be genuinely usable;
- desktop may use tables when efficient;
- no future feature placeholders.

The monitoring experience should help the teacher answer:

> What happened?  
> What is still open?  
> Where should I look next?

It must not label what a student "is".

---

# 20. Stage 05 In-Scope

The following are IN SCOPE:

- TeachingContext-scoped student monitoring;
- class monitoring table;
- student monitoring detail;
- factual attendance summary;
- factual completed assessment summary;
- factual KKTP signals;
- remedial history summary;
- ACTIVE-policy runningPerformance reuse;
- student-specific availableWeight;
- teacher monitoring notes;
- optional teacher-controlled follow-up;
- resolve follow-up;
- archive monitoring note;
- factual monitoring filters;
- global teacher-owned monitoring overview;
- context-bounded student monitoring history;
- desktop UI;
- mobile UI;
- deterministic calculation/query logic;
- server-side authorization;
- IDOR/security protection;
- Stage 00–04 regression protection.

---

# 21. Explicitly Out of Scope

The following are OUT OF SCOPE for Stage 05:

- Parent Portal;
- parent access;
- parent notifications;
- official report cards;
- report-card approvals;
- promotion;
- leger;
- transcript;
- AI risk prediction;
- AI diagnosis;
- AI student labeling;
- AI-generated intervention decisions;
- behavior scoring;
- discipline scoring;
- automatic attendance-risk scoring;
- automatic "high-risk student" classification;
- cross-teacher private-note sharing;
- principal monitoring dashboard;
- school-wide academic surveillance;
- per-student Assignment completion/submission tracking;
- counseling records;
- health/medical records;
- LMS functionality;
- StudentSubmission;
- new AI analytics/prediction features.

---

# 22. Migration Rules

If Stage 05 introduces `StudentMonitoringNote`, migration must be:

- additive;
- non-destructive;
- reproducible;
- production-safe;
- compatible with `prisma migrate deploy`;
- preserving Stage 00–04 data;
- no database reset.

Historical references must be preserved.

Exact Prisma referential actions must be reviewed before coding.

---

# 23. QA Standard

Final Stage 05 implementation must eventually pass at minimum:

```bash
npx prisma generate
npx tsc --noEmit
npm run lint
npm run test
npm run build
npx playwright test
```

Plus:

- meaningful business-rule tests;
- authorization/security tests;
- direct URL / IDOR tests;
- monitoring-note historical integrity tests;
- desktop verification;
- mobile verification;
- browser/runtime console verification;
- Stage 00 regression;
- Stage 01 regression;
- Stage 02 regression;
- Stage 03 regression;
- Stage 04 regression.

Build success alone does not equal Stage PASS.

---

# 24. Pre-Coding Open Technical Decisions

The following are intentionally left for the Stage 05 Implementation Plan after Antigravity inspects the codebase:

- exact Prisma model/field/index names for monitoring notes;
- exact relation names;
- exact `onDelete` behavior consistent with existing Stage 00–04 schema;
- route/component file breakdown;
- query/service decomposition;
- whether lightweight derived summaries should be computed server-side in service/query helpers;
- exact test-file structure;
- pagination strategy if needed;
- exact table/card component reuse.

These are technical choices, not product decisions.

Antigravity must not turn these OPEN technical choices into product scope expansion.

---

# 25. Locked Product Decisions for Stage 05

The following should be treated as LOCKED unless the user explicitly changes them:

1. Monitoring is TeachingContext-scoped.
2. Monitoring reuses existing activity data.
3. No duplicate Student identity.
4. No duplicate analytics source-of-truth tables by default.
5. Stage 05 V1 is deterministic only.
6. No AI risk/prediction/diagnosis.
7. System shows factual signals; teacher decides meaning/action.
8. No automatic risk score or student classification.
9. New persisted data is minimal: teacher-owned `StudentMonitoringNote` with optional follow-up state.
10. Monitoring notes are TeachingContext-owned.
11. GradePolicy is optional; monitoring works without it.
12. Assignment is not a student-monitoring source until per-student submission/status exists.
13. Student Monitoring is not Parent Portal.
14. Student Monitoring is not Report Card.
15. Student Monitoring is not principal/school-wide surveillance.
16. Student Monitoring is not counseling/health record management.
17. Historical notes are preserved; prefer archive over delete.
18. ACTIVE School membership alone does not grant access to all Student monitoring data.
19. School OWNER is not an academic-superuser in V1.
20. UI must remain teacher-first, calm, practical, and free of fake data.

---

# 26. Stage Gate

Current Stage 05 status:

```text
PRODUCT DOCUMENT: READY FOR IMPLEMENTATION-PLAN REVIEW
CODING: NOT STARTED
```

Next required workflow step:

```text
Send this Stage 05 document to Antigravity
→ Antigravity reads docs + codebase
→ Antigravity returns Implementation Plan
→ STOP
→ ChatGPT reviews the plan
→ User approves
→ only then coding may begin
```

No Stage 05 coding is authorized yet.
