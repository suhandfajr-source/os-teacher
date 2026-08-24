# DEVELOPMENT STAGE 08 — PARENT PORTAL

## 1. Stage Identity

**Stage:** DEVELOPMENT STAGE 08  
**Name:** PARENT PORTAL  
**Stable Baseline:** `dev-stage-07-pass`  
**Stable Commit:** `7fe2f2db673ced2f06ceac8e3a800a6c72ac5216`

Stages 00–07 are **PASS + TAGGED + LOCKED**.

Stage 08 introduces a secure, read-only parent/guardian experience without weakening the core architecture:

> **SHARED STUDENT IDENTITY, CONTEXT-OWNED LEARNING DATA.**

The parent portal is not a school-wide parent database, not a report-card system, and not a new ownership model for Student.

---

## 2. Product Goal

Allow an authenticated parent/guardian to view a limited, factual, read-only learning summary for their own child, but only for the exact `TeachingContext` explicitly granted by that TeachingContext's owning teacher.

Mental model:

```text
Parent identity
→ relation to Student
→ does NOT automatically grant learning-data access

ParentTeachingAccess
→ exact Student
→ exact TeachingContext
→ explicit teacher grant
→ read-only factual view
```

Stage 08 must preserve:

- Teacher First
- Input Once, Use Everywhere
- Ask Only When Needed
- Activity Generates Data
- AI Assists, Teacher Decides
- Archive over Delete
- Historical Integrity
- Server-side Authorization
- Scope Discipline

---

## 3. Core Product Decisions

### 3.1 Parent Is a Separate Profile, Not a Teacher Role Flag

Use the existing authentication identity (`User`) as the account identity layer, but parent capability must be represented separately from `TeacherProfile`.

Target concept:

```text
User
├── TeacherProfile?   // existing
└── ParentProfile?    // Stage 08
```

A User may eventually have both profiles.

Do **not** convert the existing teacher architecture into a global `role = TEACHER | PARENT` model if doing so would destabilize locked authentication behavior.

Parent routes must verify `ParentProfile`.

Teacher routes must continue to verify `TeacherProfile`.

A parent account must not accidentally receive teacher permissions merely because both profiles use the same Better Auth `User` table.

### 3.2 Parent–Student Relationship Is Not Learning-Data Authorization

Baseline relationship:

```text
ParentProfile
→ ParentStudentRelation
→ Student
```

This relationship means only:

> "This authenticated parent/guardian is linked to this Student identity."

It does **not** mean access to all subjects, all teachers, all historical scores, all School data, teacher notes, monitoring notes, or AI analysis.

Learning data remains `TeachingContext`-owned.

### 3.3 Learning Access Is Per TeachingContext

Use an explicit authorization concept:

```text
ParentTeachingAccess
→ ParentStudentRelation
→ TeachingContext
```

An ACTIVE `ParentTeachingAccess` grants read-only access only to:

```text
one Parent
+
one Student
+
one TeachingContext
```

Example:

```text
Ibu Rina
→ Student: Andi

Granted:
→ Matematika VIII A / Pak Budi

Not automatically granted:
→ IPA VIII A / Bu Sari
→ PAI VIII A / Pak Hasan
```

Even if all teachers belong to the same School.

### 3.4 Owning Teacher Controls the Grant

Only the teacher who owns the target `TeachingContext` may create/revoke parent learning access for that TeachingContext.

School `OWNER` does **not** automatically become a superuser over private context-owned learning data.

No school-level approval gate is introduced.

No principal/wali-kelas approval workflow is introduced.

---

## 4. Parent Invitation V1

Stage 08 needs a safe way to establish parent identity and context access.

Recommended V1 flow:

```text
Teacher opens:
Class / TeachingContext
→ Orang Tua

Teacher selects:
Student from current authorized roster
+
parent email
+
relationship label (optional)
+
this exact TeachingContext

Teacher creates invitation

System generates:
one-time secure invitation link

Teacher manually shares link

Parent:
opens link
→ login/register
→ authenticated email must match invite recipient email
→ explicitly accepts invitation

Server transaction:
create/find ParentProfile
→ create/find ParentStudentRelation
→ create/reactivate ParentTeachingAccess for exact context
→ mark invitation accepted
```

No email sending service is required in Stage 08. The teacher may copy the invitation link manually.

### Invitation Security

Invitation token must:

- be cryptographically strong;
- be one-time use;
- expire;
- never be stored in plaintext if avoidable;
- never appear in logs after creation;
- never grant access by itself without authenticated user verification.

Preferred implementation:

```text
raw token
→ shown only in generated invite URL

database
→ SHA-256 or equivalent token hash
```

Parent authentication email must match the normalized recipient email stored on the invitation.

Recommended expiry: **7 days**.

No background cron is required merely to mark invitations expired.

Server can treat:

```text
status = PENDING
AND expiresAt < now
→ expired / unusable
```

---

## 5. Relationship and Access Lifecycle

### ParentStudentRelation

Concept:

```text
ParentProfile
+
Student
```

A relation does not itself grant learning-data access.

Multiple parents/guardians may relate to one Student. One parent may relate to multiple Students.

Do not hard-delete historical relationship rows as normal lifecycle behavior.

### ParentTeachingAccess

Suggested statuses:

```text
ACTIVE
REVOKED
```

Rules:

- ACTIVE → parent may read approved data for exact Student + TeachingContext.
- REVOKED → no further access.
- revocation preserves history.
- no hard delete as normal lifecycle.
- a new explicit invitation/grant may reactivate previously revoked access if business rules allow.

Teacher may revoke only access for their own TeachingContext.

Teacher A must never revoke or mutate Teacher B's parent access grant.

---

## 6. Grant-Time Roster Rule

Creating a new parent invitation/access grant requires:

```text
Student is in the CURRENT ClassStudent roster
for the TeachingContext's Class + AcademicPeriod.
```

At invitation acceptance time, server must revalidate that the invitation is still valid and authorized.

If the Student has left the roster before acceptance, the server should reject the stale invitation and require the teacher to review/reissue deliberately.

---

## 7. Historical Integrity After Access Is Granted

Current roster changes must not rewrite historical learning records.

If an ACTIVE parent grant exists and the Student later leaves the current roster:

- no historical attendance/assessment records are deleted;
- parent-visible historical records remain based on persisted historical participant data;
- new teacher activities must still follow normal current-roster rules.

Do not derive historical parent data from the current roster.

Use existing historical snapshots/participant records.

---

## 8. Parent-Visible Data — V1

Parent Portal is **read-only**.

The goal is:

> show factual learning activity that already exists, not create a second reporting system.

For an ACTIVE `ParentTeachingAccess`, parent may see only the exact student's data inside the exact granted TeachingContext.

### 8.1 Context Header

Allowed:

- Student full name
- Subject
- Class
- Academic Period
- owning teacher name

Do not show unnecessary Student master PII. Do not expose NIS by default unless current product data clearly requires it.

### 8.2 Attendance

Allowed factual information:

- recorded meetings involving that Student;
- attendance status per historical TeachingSession;
- factual counts: Hadir, Terlambat, Sakit, Izin, Tidak Hadir.

Do **not** invent an attendance percentage formula.

Use historical `AttendanceRecord` snapshots, not current roster reconstruction.

### 8.3 Learning Activity

Allowed from completed/valid historical teacher activity:

- date;
- factual actual topic (`actualTopic`);
- relevant lightweight assignment information when appropriate.

Do **not** expose teacher private reflection or internal teacher-only free text merely because it exists in the database.

### 8.4 Assessment / Score

Allowed:

- COMPLETED Assessments only;
- the exact student's persisted `AssessmentResult`;
- `finalScore` only for `GRADED` results;
- assessment title/date/type;
- optional configured KKTP/minimum passing threshold as factual context.

Rules:

```text
PENDING
ABSENT
EXCUSED
→ never converted to zero
```

Do not expose unfinished assessment workflow. Do not recalculate finalScore. Do not invent a new grade formula. Do not label running performance as an official report-card grade.

### 8.5 Assignment

Stage 03 Assignment is lightweight and has no StudentSubmission.

Parent may see factual assignment information belonging to the granted TeachingContext when appropriate for parent awareness.

This does NOT create LMS submission, student upload, completion tracking, parent acknowledgement, or automatic grading.

Assignment ≠ LMS.

---

## 9. Strictly Private / Never Parent-Visible in Stage 08

The following must remain unavailable to Parent Portal:

### Teacher-private monitoring

- `StudentMonitoringNote`
- follow-up flags
- teacher monitoring timeline
- private teacher notes
- internal interventions

### AI

- `AiContentDraft`
- AI prompts
- AI context packs
- AI internal analysis
- future AI student analysis
- model/provider metadata

### Teacher working data

- teacher reflection
- internal activity/reflection notes not explicitly approved for parent view
- draft assessments
- in-progress assessments
- GradePolicy configuration editor
- private reporting configuration

### Cross-context / cross-student data

- another Student
- another child without relation
- another TeachingContext without ACTIVE grant
- another teacher's context
- School-wide roster
- School-wide analytics

---

## 10. Authorization Contract

Parent authorization is NOT based on `TeacherSchoolMembership`.

Parent access chain must be server-side:

```text
Authenticated User
↓
ParentProfile
↓
ACTIVE ParentStudentRelation
↓
ACTIVE ParentTeachingAccess
↓
exact Student
+
exact TeachingContext
↓
target historical/current resource
```

For every target resource, verify relational proof that it belongs to both the granted Student and granted TeachingContext.

Never trust studentId, teachingContextId, accessId, invitation ID/token alone, or School ID passed by browser.

UI hiding is not security.

---

## 11. Teacher-Side Authorization Contract

Teacher parent-management actions must verify:

```text
Authenticated User
↓
TeacherProfile
↓
ACTIVE School
↓
owned TeachingContext
↓
current authorized Student roster
↓
Parent invitation/access resource
```

Teacher may manage only grants/invitations for their own TeachingContext.

School OWNER role provides no override.

---

## 12. Required IDOR / Security Matrix

Tests must explicitly cover at minimum:

### Parent

- Parent A → Parent B's child → reject
- Parent A → same child but ungranted TeachingContext → reject
- Parent A → another Student in same class → reject
- Parent A manipulates `studentId` → reject
- Parent A manipulates `teachingContextId` → reject
- Parent A manipulates `parentTeachingAccessId` → reject
- REVOKED access → reject
- expired invite → reject
- already-used invite → reject
- invite email mismatch → reject
- raw token lookup must not expose child/context data to unauthenticated user
- parent cannot call teacher mutation actions
- parent cannot access teacher-only monitoring notes
- parent cannot access AI Studio/private AI data

### Teacher

- Teacher A grants access to Teacher B's TeachingContext → reject
- Teacher A revokes Teacher B's ParentTeachingAccess → reject
- cross-School TeachingContext → reject
- invite Student outside current roster → reject
- manipulated Student + TeachingContext combination → reject
- School OWNER → another teacher context → reject

---

## 13. Authentication / Routing Boundary

Stage 08 must preserve locked teacher authentication.

Parent Portal should use a separate route/layout boundary, for example:

```text
/parent
/parent/login
/parent/undangan/[token]
/parent/anak/[studentId]
/parent/anak/[studentId]/konteks/[teachingContextId]
```

Exact route structure may be refined in Implementation Plan.

Teacher management may live under the TeachingContext/class area, for example:

```text
/kelas/[teachingContextId]/orang-tua
```

### Critical Auth Rule

Do not assume the existing teacher signup flow can safely be reused unchanged.

Antigravity must inspect Better Auth configuration, registration hooks, TeacherProfile auto-creation behavior, redirects, protected layouts, and auth-client wrappers.

The Implementation Plan must explain how a parent can register/login without accidentally creating teacher-only state or weakening Stage 01 behavior.

Do not rewrite Stage 01 auth casually.

---

## 14. Parent UX

Design direction:

```text
clean
calm
simple
mobile-first
read-only
family-friendly
not ERP-like
```

Parent Portal should answer:

```text
Anak saya belajar apa?
Bagaimana kehadirannya?
Nilai yang sudah selesai apa saja?
Ada tugas apa dari konteks yang diberi akses?
```

It should NOT look like the teacher administration dashboard.

### Parent Home

Show only linked children / granted contexts.

Actionable empty state:

```text
Belum ada akses pembelajaran aktif.
Gunakan undangan dari guru untuk menghubungkan akun.
```

### Child / Context View

Prefer clear sections/cards:

- Mata Pelajaran & Guru
- Kehadiran
- Aktivitas Pembelajaran
- Nilai Selesai
- Tugas

Mobile must be genuinely usable.

---

## 15. Teacher UX for Parent Access

Within owned TeachingContext:

```text
Orang Tua
```

Teacher can:

- choose current roster student;
- enter parent email;
- optional relationship label;
- create invitation;
- copy secure invite link;
- see pending/accepted/revoked access relevant to this context;
- revoke ACTIVE context access.

Teacher should receive clear feedback:

```text
Undangan dibuat
Undangan kedaluwarsa
Akses aktif
Akses dicabut
```

Do not create fake email-delivery status because Stage 08 does not send emails.

---

## 16. Data Model Direction

Implementation Plan must inspect existing schema before finalizing exact fields.

Expected conceptual models:

```text
ParentProfile
ParentStudentRelation
ParentInvitation
ParentTeachingAccess
```

### ParentProfile

Expected relationship:

```text
User 1 → 0..1 ParentProfile
```

Keep parent-specific profile fields minimal. Do not collect phone/address/identity-card data without explicit need.

### ParentStudentRelation

Expected uniqueness:

```text
ParentProfile + Student
```

May contain optional relationship label. Must not itself grant learning-data access.

### ParentInvitation

Expected references:

- recipient email
- Student
- TeachingContext
- creating TeacherProfile
- token hash
- expiresAt
- acceptedAt optional
- revokedAt optional / lifecycle state
- timestamps

Historical invite rows should not be hard-deleted as normal lifecycle.

### ParentTeachingAccess

Expected references:

- ParentStudentRelation
- TeachingContext
- granted/created-by TeacherProfile where useful for audit
- status ACTIVE / REVOKED
- timestamps
- revokedAt optional

Expected uniqueness:

```text
ParentStudentRelation + TeachingContext
```

Use `onDelete: Restrict` where deletion would destroy historical/access provenance.

Do not use Cascade casually for Student, Parent relation, TeachingContext, or accepted parent access.

---

## 17. Invitation Acceptance Transaction

Acceptance must be transactional.

Concept:

```text
verify authenticated User
→ verify invitation token hash
→ verify PENDING/not expired/not used
→ verify authenticated email matches invite email
→ verify creator still owns authorized TeachingContext
→ verify Student still current roster for grant
→ create/find ParentProfile
→ create/find ParentStudentRelation
→ create/reactivate exact ParentTeachingAccess
→ mark invitation accepted
→ COMMIT
```

Failure at any step:

```text
ROLLBACK
```

No partially-created relationship/access state.

---

## 18. Reporting / Data Reuse

Prefer reusing existing deterministic Stage 03–07 data and service logic rather than creating duplicate parent reporting tables.

Do not create a second attendance aggregate table, score aggregate table, or parent report snapshot table unless the Implementation Plan identifies a concrete historical requirement that existing persisted facts cannot satisfy.

Parent view should be derived from authorized persisted facts.

---

## 19. Migration Rules

Stage 08 migration must be:

- additive;
- non-destructive;
- reproducible;
- compatible with `prisma migrate deploy`;
- preserve Stages 00–07;
- no database reset;
- no modification of previous migration files.

If auth/schema evolution requires non-trivial changes, use:

```text
EXPAND
→ BACKFILL
→ VALIDATE
→ CONTRACT
```

Do not contract/delete locked teacher auth structures merely to add ParentProfile.

---

## 20. Strictly Out of Scope — Stage 08

Do NOT implement:

- official e-Rapor / report card engine;
- report-card finalization;
- promotion / class advancement;
- transcript / leger;
- principal approval;
- wali-kelas approval;
- school-wide parent administration console;
- parent chat / messaging;
- push notifications;
- WhatsApp integration;
- SMS;
- automatic email sending service;
- payment/billing;
- parent attendance excuses;
- parent score disputes workflow;
- parent assignment submission;
- StudentSubmission/LMS;
- CBT;
- question bank;
- OCR grading;
- AI grading;
- AI parent chatbot;
- AI student diagnosis/risk;
- AI-generated parent analysis;
- exposing StudentMonitoringNote;
- exposing AiContentDraft;
- parent editing any learning data;
- School OWNER universal override;
- cross-teacher data sharing;
- new microservice;
- Redis;
- Kafka;
- vector database;
- Python backend;
- Kubernetes.

---

## 21. Acceptance Criteria

Stage 08 cannot PASS unless all blocking criteria are verified.

### Parent Identity & Invitation

- parent-specific registration/login path works;
- teacher registration remains unchanged/regression-safe;
- invite token is strong, expiring, one-time, and not stored raw;
- authenticated invite email must match;
- acceptance transaction is atomic;
- no partial relation/access creation.

### Authorization

- exact Parent → Student → TeachingContext boundary;
- no cross-child;
- no cross-context;
- no cross-teacher;
- no cross-School;
- revoked access rejected;
- direct URL/IDOR rejected;
- School OWNER has no override;
- client IDs never authoritative.

### Data Visibility

Parent sees only allowed factual data:

- context identity;
- historical attendance facts/counts;
- completed assessment facts/finalScore;
- appropriate learning topics;
- lightweight assignments if implemented.

Parent never sees monitoring notes/follow-up, teacher reflection, AI drafts/internal AI, draft/in-progress assessments, or unrelated contexts/students.

### Historical Integrity

- attendance uses AttendanceRecord snapshot;
- assessment uses persisted AssessmentResult participant history;
- current roster mutation does not rewrite history;
- new invitation requires current roster.

### Lifecycle

- invitation expiration works;
- accepted invite cannot be reused;
- access revoke works;
- revoked records preserved;
- no normal hard-delete workflow.

### UX

- teacher parent-access management usable desktop/mobile;
- parent portal genuinely mobile usable;
- actionable empty/error states;
- no fake notification/email delivery state.

### QA

At minimum:

```text
npx prisma generate
npx tsc --noEmit
npm run lint
npm run test
npm run build
npx playwright test
```

Plus meaningful invitation lifecycle tests, security/IDOR matrix, parent auth tests, teacher auth regression, historical integrity tests, desktop/mobile checks, console/runtime check, and Stage 00–07 regression.

If any blocking acceptance criterion fails:

```text
DEVELOPMENT STAGE 08: NOT PASS
```

---

## 22. Stage 08 Completion Boundary

Implementation completion is not Git PASS.

Required workflow:

```text
Implementation
→ Completion / Verification Report
→ ChatGPT Final Audit
→ PASS / NOT PASS
→ only if PASS:
   Git Commit
   dev-stage-08-pass
   LOCK
```

No Stage 09 work before Stage 08 is PASS + TAGGED + LOCKED.

---

## 23. Final Product Principle

Parent Portal must behave like:

> a deliberately opened, read-only window into one child's factual learning data for one teacher-owned TeachingContext.

It must never become:

> a shortcut around TeachingContext authorization.

Preserve:

> **SHARED STUDENT IDENTITY, CONTEXT-OWNED LEARNING DATA.**
