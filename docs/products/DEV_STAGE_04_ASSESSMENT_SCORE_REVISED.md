# DEVELOPMENT STAGE 04 — ASSESSMENT, SCORE & GRADE AGGREGATION
## AI Teacher Assistant

Status: READY FOR IMPLEMENTATION PLAN

Stable checkpoint:

```text
dev-stage-03-pass
```

Development Stage 00–03 are officially PASS and LOCKED.

# 1. OBJECTIVE

Build a teacher-first assessment and scoring workflow:

```text
TeachingContext
↓
Assessment Type
↓
Optional Grade Policy / Weight
↓
Assessment
↓
Participant Snapshot
↓
Manual Score Input
↓
Normalized Score
↓
KKTP / Mastery
↓
Remedial
↓
Final Score
↓
Category Average
↓
Weighted Running Grade
```

Core principle:

> AUTOMATE THE ADMINISTRATION FIRST, AUTOMATE THE JUDGMENT LATER.

Teacher remains responsible for correction and score decisions. No AI grading or OCR in Stage 04.

# 2. ARCHITECTURE CONTRACT

Preserve:

> SHARED STUDENT IDENTITY, CONTEXT-OWNED LEARNING DATA.

Shared within School Workspace:
- Student
- ClassStudent
- Class
- AcademicPeriod
- Subject

TeachingContext-scoped:
- TeachingSession
- AttendanceRecord
- Assignment
- Assessment
- AssessmentResult
- Remedial
- Grade Policy

# 3. STAGE 04 SCOPE

In scope:
- custom Assessment Type
- stable internal AssessmentCategory
- optional Grade Policy
- custom weights
- Assessment creation
- participant snapshot
- manual score entry
- partial scoring
- normalized score
- KKTP
- completion
- basic statistics
- remedial
- teacher-decided final score
- student score history within authorized TeachingContexts
- category average
- weighted running grade
- available-weight calculation
- desktop/mobile UX
- meaningful tests

Out of scope:
- Question Bank
- AI question generation
- CBT / student test delivery
- student submissions
- OCR
- AI correction / essay grading
- official report card engine
- report card approvals
- promotion
- leger/transcript
- Parent Portal
- AI analysis
- full Student Monitoring

# 4. STABLE INTERNAL ASSESSMENT CATEGORY

Use a stable machine enum:

```text
ASSIGNMENT
FORMATIVE
SUMMATIVE
MIDTERM
FINAL_TERM
SCHOOL_EXAM
PRACTICE
PROJECT
OTHER
```

Do NOT hardcode school-facing labels such as UH, PH, STS, PTS, UTS, SAS, PAS, UAS, US as immutable enums.

Example:

```text
UTS → MIDTERM
STS → MIDTERM
```

UI displays the custom label; the system uses the stable category.

# 5. CUSTOM ASSESSMENT TYPE

Conceptual model:

```text
AssessmentType
- id
- teachingContextId
- name
- normalizedName
- category
- isActive
- createdAt
- updatedAt
```

Examples:
- Tugas
- UH
- STS
- SAS
- Hafalan
- Praktik Ibadah
- Proyek

Recommended uniqueness:

```text
TeachingContext + normalizedName
```

Teacher can add, rename, and deactivate/archive types.

# 6. GRADE POLICY / WEIGHTS

Weights are configuration, not enum properties.

Conceptual model:

```text
GradePolicy
- id
- teachingContextId
- status
- createdAt
- updatedAt
```

```text
GradePolicyItem
- id
- gradePolicyId
- assessmentTypeId
- weight
- sortOrder
- createdAt
- updatedAt
```

Suggested policy status:

```text
DRAFT
ACTIVE
```

ACTIVE requires:

```text
sum(weight) = 100%
```

Assessment and scoring must remain usable without ACTIVE GradePolicy.

If no active policy:
- Assessment ✅
- Score Input ✅
- Remedial ✅
- Basic Statistics ✅
- Grade Aggregation unavailable

# 7. GRADE POLICY UX

Provide a teacher-friendly configuration screen.

First-use options:

```text
[Gunakan Template]
[Atur Sendiri]
```

Example starter template:

```text
Tugas 20%
UH 30%
UTS 20%
UAS 30%
Total 100%
```

Teacher may customize:

```text
Tugas 15%
UH 20%
Hafalan 15%
Praktik Ibadah 20%
STS 10%
SAS 20%
Total 100%
```

UX requirements:
- live total
- remaining/excess indicator
- cannot activate invalid total
- add custom type
- rename type
- clearly say "Bobot Jenis/Kategori", not "Bobot Assessment"
- no advanced internal-weight complexity by default

# 8. COPY POLICY

Teacher may copy type + weight configuration from another TeachingContext they own.

Copy only:
- AssessmentType configuration
- GradePolicy / weights

Never copy:
- Assessments
- scores
- AssessmentResults
- Remedial records

# 9. ASSESSMENT MODEL

Conceptual model:

```text
Assessment
- id
- teachingContextId
- assessmentTypeId
- teachingSessionId optional
- title
- description optional
- assessmentDate
- maxScore
- minimumPassingScore optional
- status
- participantsInitializedAt optional
- createdAt
- updatedAt
```

Suggested lifecycle:

```text
DRAFT
→ IN_PROGRESS
→ COMPLETED
→ ARCHIVED
```

If teachingSessionId is supplied, server must enforce:

```text
Assessment.teachingContextId
=
TeachingSession.teachingContextId
```

# 10. ASSESSMENT CREATION UX

Example:

```text
Judul: UH 1 — Zakat
Jenis: UH
Tanggal: 25 Agustus 2026
Skor Maksimum: 40
KKTP: 75
```

Teacher should not configure weight every time.

If no GradePolicy exists, creation remains allowed with a non-blocking notice.

# 11. PARTICIPANT SNAPSHOT

Preferred V1 flow:

```text
Assessment DRAFT
↓
Teacher clicks "Mulai Penilaian"
↓
load current authorized ClassStudent roster
↓
atomic participant initialization
↓
create one AssessmentResult per Student
↓
participantsInitializedAt = now()
↓
Assessment = IN_PROGRESS
```

After initialization:
- new roster members do not auto-appear
- removed roster members remain historical participants
- scoring uses AssessmentResult snapshot

# 12. ATOMIC INITIALIZATION

For 30 students:

```text
create 30 AssessmentResults
```

or rollback everything.

Atomic initialization does NOT mean all scores must be completed at once.

# 13. ASSESSMENT RESULT

Conceptual model:

```text
AssessmentResult
- id
- assessmentId
- studentId
- status
- rawScore optional
- normalizedScore optional
- finalScore optional
- note optional
- createdAt
- updatedAt
```

Unique:

```text
assessmentId + studentId
```

Suggested status:

```text
PENDING
GRADED
ABSENT
EXCUSED
```

Important:

```text
rawScore = null + PENDING
→ belum dinilai

rawScore = 0 + GRADED
→ nilai valid nol
```

Missing scores must never silently become zero.

# 14. MANUAL SCORE INPUT

Teacher manually corrects work and enters scores.

Desktop: spreadsheet-like table.
Mobile: stacked score rows/cards.

Requirements:
- fast entry
- explicit Save
- Unsaved / Saving / Saved
- partial progress
- resume later
- no one-student-modal-at-a-time requirement

# 15. PARTIAL GRADING

Example:

```text
30 participants
10 graded
20 pending
```

Assessment remains IN_PROGRESS and may show:

```text
10 / 30 dinilai
33%
```

# 16. SCORE VALIDATION & NORMALIZATION

Deterministic:

```text
0 <= rawScore <= maxScore
normalizedScore = rawScore / maxScore * 100
```

No AI arithmetic.

Recommended:
- system calculates normalizedScore
- initial finalScore = normalizedScore
- teacher may later change finalScore through remedial workflow

Prefer locking maxScore after participant initialization in V1.

# 17. KKTP

Assessment may define minimumPassingScore.

If configured:

```text
finalScore >= KKTP → TUNTAS
finalScore < KKTP → PERLU REMEDIAL
```

If KKTP absent, do not invent mastery.

# 18. REMEDIAL

Conceptual:

```text
RemedialAttempt
- id
- assessmentResultId
- score
- note optional
- attemptDate
- createdAt
- updatedAt
```

Allow one or more attempts.

Critical rule:

> THE TEACHER DECIDES FINAL SCORE.

Do not hardcode one universal remedial-final-score formula.

# 19. ASSESSMENT COMPLETION

Default completion rule:

```text
no AssessmentResult remains PENDING
```

Resolved states:
- GRADED
- ABSENT
- EXCUSED

Do not convert pending to zero.

# 20. BASIC STATISTICS

Calculate deterministically:
- participant count
- graded count
- pending count
- average
- highest
- lowest
- tuntas
- perlu remedial
- mastery percentage

Use valid graded/final scores only.

# 21. CATEGORY AVERAGE

For ACTIVE GradePolicy, aggregate COMPLETED assessments by AssessmentType.

Example:

```text
Tugas 1 = 80
Tugas 2 = 90
Tugas 3 = 70
Average Tugas = 80
```

Default V1: equal internal importance among assessments of the same type.

# 22. WEIGHTED RUNNING GRADE

Example policy:

```text
Tugas 20%
UH 30%
UTS 20%
UAS 30%
```

If UAS not available:

```text
Tugas avg 85 → 17
UH avg 80 → 24
UTS 78 → 15.6

total contribution = 56.6
available weight = 70%
running performance = 56.6 / 70 * 100 = 80.86
```

Do NOT label 56.6 as semester grade.

Display:

```text
Bobot tersedia: 70%
Performa berdasarkan komponen tersedia: 80.86
```

When available weight reaches 100%, show the full weighted aggregate, still not as an official report card value.

# 23. POLICY CHANGES

Changing weights must show confirmation that aggregates will recalculate.

Must not mutate:
- rawScore
- normalizedScore
- AssessmentResult history
- RemedialAttempt history

Prefer deriving aggregate from source data + current policy.

# 24. ASSESSMENT DASHBOARD

Add:

```text
/assessment
```

Show real teacher-owned assessments within active School/TeachingContexts.

Example:

```text
UH 1 — Zakat
PAI — VIII A
30 participants
30 resolved
80% mastery
COMPLETED
```

# 25. ASSESSMENT DETAIL

Suggested sections:
- Ringkasan
- Nilai
- Remedial

Show:
- title
- type
- class
- subject
- date
- maxScore
- KKTP
- progress
- statistics
- participant score table

# 26. CLASS DETAIL INTEGRATION

Keep existing:
- Overview
- Siswa
- Pertemuan
- Absensi
- Jurnal
- Tugas

Add:
- Assessment
- Pengaturan Nilai

# 27. STUDENT SCORE HISTORY

Enhance:

```text
/siswa/[studentId]
```

with TeachingContext-bounded score history.

Teacher may see only authorized score history from their TeachingContexts.

# 28. ASSIGNMENT RELATIONSHIP

Assignment remains separate from Assessment.

Optional linking is allowed only with server-side TeachingContext consistency.

# 29. AUTHORIZATION

Reuse prior helpers and add assessment-specific authorization.

Server chain:

```text
Authenticated Teacher
↓
ACTIVE School
↓
Owned TeachingContext
↓
Assessment
↓
AssessmentResult
↓
locked participant
```

Never trust client IDs without server verification.

# 30. CROSS-CONTEXT / CROSS-SCHOOL SAFETY

Reject:
- School A Assessment + School B Student
- Teacher A editing Teacher B Assessment
- AssessmentType from Context A used in Context B
- cross-context TeachingSession/Assignment links
- direct URL / IDOR

# 31. EMPTY / ERROR STATES

Examples:
- no assessment
- no GradePolicy
- invalid total
- participants not initialized
- partial scoring
- no KKTP
- save failure
- stale/revoked context

No raw Prisma errors.

# 32. RESPONSIVE UX

Desktop:
- spreadsheet-like score entry
- keyboard-friendly where feasible

Mobile:
- stacked student rows
- touch-friendly controls
- no horizontal overflow
- explicit Save

# 33. DETERMINISTIC CALCULATIONS

Normal application logic only:
- normalization
- averages
- highest/lowest
- mastery
- remedial eligibility
- category average
- available weight
- weighted contribution
- running performance

# 34. DATA MODEL SUMMARY

Expected additions:
- AssessmentType
- GradePolicy
- GradePolicyItem
- Assessment
- AssessmentResult
- RemedialAttempt

Potential enums:
- AssessmentCategory
- GradePolicyStatus
- AssessmentStatus
- AssessmentResultStatus

# 35. INDEXES / PRECISION

Implementation Plan must cover:
- TeachingContext + normalizedName uniqueness for AssessmentType
- GradePolicy uniqueness strategy
- GradePolicy + AssessmentType uniqueness
- Assessment indexes by context/type/date/status
- AssessmentResult unique assessment + student
- RemedialAttempt indexes
- Decimal/numeric types for scores and weights

Avoid careless floating-point persistence.

# 36. MIGRATION

Stage 04 migration must be:
- additive
- non-destructive
- reproducible
- preserve Stage 00–03 data
- no database reset

# 37. TEST STRATEGY

Meaningful automated tests must cover:
- custom type
- rename type
- weight total validation
- cannot activate invalid policy
- assessment works without policy
- copy policy authorization
- assessment creation
- type/context consistency
- participant initialization
- atomic rollback
- roster change after snapshot
- null vs zero
- score bounds
- normalized score
- partial grading
- result uniqueness
- ABSENT/EXCUSED
- completion blocked with PENDING
- KKTP / no-KKTP
- remedial history
- teacher finalScore
- statistics
- category average
- weighted contribution
- availableWeight
- running performance
- policy recalc without raw-score mutation
- student score-history authorization
- TeachingContext isolation
- cross-School rejection
- IDOR
- Stage 00–03 regressions

# 38. MANUAL VERIFICATION

Desktop:
- Assessment dashboard
- Grade Policy
- custom type
- weight validation
- create Assessment
- initialize participants
- score input
- partial save
- continue later
- statistics
- remedial
- finalScore
- score history
- running grade

Mobile:
- assessment list
- create
- score entry
- status
- save
- continue later
- remedial
- running grade

# 39. ACCEPTANCE CRITERIA

PASS only if all core scope, security, migration, responsive, automated-test, Playwright, and Stage 00–03 regression criteria pass.

# 40. DEFINITION OF DONE

```text
AssessmentType
↓
GradePolicy
↓
Assessment
↓
Participant Snapshot
↓
Manual Scoring
↓
Normalized Score
↓
KKTP
↓
Remedial
↓
Final Score
↓
Category Average
↓
Weighted Running Grade
↓
Security
↓
Tests
↓
Regression
↓
PASS
↓
LOCK
```

**DEVELOPMENT STAGE 04 — READY FOR IMPLEMENTATION PLAN**
