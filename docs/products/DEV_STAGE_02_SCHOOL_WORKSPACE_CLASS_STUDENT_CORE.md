# DEVELOPMENT STAGE 02 — SCHOOL WORKSPACE + CLASS & STUDENT CORE
## AI Teacher Assistant

Status: READY FOR IMPLEMENTATION

---

# 1. Objective

Evolve the Stage 01 single-teacher setup into a shared School Workspace architecture, then build the Class & Student Core.

At the end of this stage:

```text
Teacher
↓
Join / Create School Workspace
↓
Teaching Context
↓
Shared Class Roster
↓
Student Core
↓
Excel Import
↓
Student Search / Profile
```

Stage 00 and Stage 01 remain PASS and LOCKED.

Current stable checkpoint:

```text
dev-stage-01-pass
```

Stage 02 may migrate Stage 01 data forward, but must not invalidate the historical PASS checkpoint.

---

# 2. Architectural Change

Previous temporary Stage 01 concept:

```text
TeacherProfile
├── schoolName
├── AcademicPeriod
├── Subject
└── Class
```

Revised concept:

```text
School Workspace
├── AcademicPeriod
├── Subject
├── Class
├── Student
└── TeacherSchoolMembership
```

Teacher access happens through:

```text
Teacher
↓
TeacherSchoolMembership
↓
School
↓
TeachingContext
↓
Class + Subject + AcademicPeriod
```

Student membership:

```text
Student
+
Class
+
AcademicPeriod
```

Student and Class are NOT owned by Teacher.

---

# 3. School Workspace

Add a real `School` entity.

Minimum conceptual fields:

```text
School
- id
- name
- normalizedName
- city optional
- province optional
- npsn optional
- createdAt
- updatedAt
```

Use School as the logical tenant / workspace.

Do NOT create a separate physical database per school.

All schools may remain in the same PostgreSQL database, isolated logically by `schoolId`.

---

# 4. Teacher ↔ School Membership

Add:

```text
TeacherSchoolMembership
- id
- teacherProfileId
- schoolId
- status (PENDING, ACTIVE, REJECTED, REVOKED)
- workspaceRole (OWNER, MEMBER)
- createdAt
- updatedAt
```

Required uniqueness:

```text
@@unique([teacherProfileId, schoolId])
```

A teacher may eventually belong to more than one School Workspace.
Joining an existing school sets status to PENDING. PENDING teachers have no access to school data until approved by an OWNER.
V1 UI may focus on one active school at a time.

---

# 5. Stage 01 Migration

Migrate existing Stage 01 records safely.

Conceptual migration:

```text
TeacherProfile.schoolName
↓
Find/Create School
↓
TeacherSchoolMembership
```

Existing `AcademicPeriod`, `Subject`, and `Class` must be migrated or re-scoped to School Workspace without destructive reset.

Target ownership:

```text
AcademicPeriod.schoolId
Subject.schoolId
Class.schoolId
```

TeachingContext must continue to connect Teacher + School + AcademicPeriod + Subject + Class.

---

# 6. School Discovery & Creation

Update onboarding/setup so teacher can search and join an existing School Workspace or create one when it does not exist.

Search should use name plus city/province and NPSN when available. Avoid exact free-text matching only.
Do NOT destructively auto-merge schools based only on equal names. 
Matching priority: 1. NPSN, 2. normalizedName + city + province, 3. name-only.

---

# 7. Shared Academic Data

Within one School Workspace, `AcademicPeriod`, `Class`, and `Subject` are reusable across teachers.

Server-side School membership authorization is required before creating or modifying shared School data. Do not hard-delete shared records; prefer archive/inactive behavior.

Do NOT assume same class name = same Class. Class identity should at minimum consider: School + AcademicPeriod (where relevant) + Class name.

Example:

```text
SMA 4
└── 2026/2027 Ganjil
    ├── VIII A
    ├── IX B
    └── IX C
```

Pak Budi can teach PAI in VIII A while Pak Andi teaches Matematika in the same VIII A without creating a duplicate class. One teacher must not be able to destroy the shared Class record and break the other teacher's context.

---

# 8. Student

Add School-scoped Student:

```text
Student
- id
- schoolId
- fullName
- studentNumber optional
- nationalStudentNumber optional
- archivedAt optional
- createdAt
- updatedAt
```

Rules:
- Student is scoped to School Workspace.
- Student is not owned by Teacher.
- fullName is not unique.
- NIS/NISN should be uniquely constrained where appropriate within school.
- Do not silently merge students only by same name.

---

# 9. ClassStudent Membership

Add:

```text
ClassStudent
- id
- studentId
- classId
- academicPeriodId
- createdAt
- updatedAt
```

Required uniqueness:

```text
@@unique([studentId, classId, academicPeriodId])
```

Membership does NOT depend on Subject. Therefore PAI — VIII A and Matematika — VIII A share the same roster for the same AcademicPeriod.

---

# 10. Kelas Saya

Implement `/kelas` to display teacher-owned TeachingContexts with derived student counts.

Student count comes from `ClassStudent` for the TeachingContext's class and academic period. Do not store manual counts.

---

# 11. Class Detail

Implement `/kelas/[teachingContextId]` showing class, subject, academic period, student count, and shared student roster.

---

# 12. Student Management

Required:
- add student;
- reuse existing School Student;
- edit student identity;
- archive student;
- remove class membership safely;
- restore archive where appropriate.

Do not hard-delete historical data by default.

---

# 13. Global Students

Implement `/siswa`.

Recommended initial policy: teacher sees students reachable through the teacher's authorized TeachingContexts, not automatically every student in the School Workspace.

---

# 14. Student Profile

Implement `/siswa/[studentId]` with Stage 02-only fields: name, NIS, NISN, status, and class memberships.

No grades, attendance, assessment, AI insight, or parent data yet.

---

# 15. Excel Student Import

Focused roster import only.

```text
Upload → Preview → Column Mapping → Validation → Confirm → Import
```

Recognized columns:

```text
Nama Lengkap required
NIS optional
NISN optional
```

Never direct-write upload rows before confirmation.

---

# 16. Security

All access requires:

```text
Session
↓
TeacherProfile
↓
TeacherSchoolMembership
↓
TeachingContext
↓
School/Class/Student scope
```

Never trust client-provided `schoolId` or `teacherProfileId` as authorization.

Cross-school and unauthorized cross-teacher access must be blocked.

---

# 17. Navigation

Use:

```text
Kelas Saya → /kelas
Siswa → /siswa
Pengaturan Setup → /pengaturan/setup
```

Update setup management to support School Workspace.

---

# 18. Out of Scope

Do NOT implement attendance, teaching sessions, journal, assignments, assessment, scores, remedial, AI, reports, parent portal, generic historical import, CP/TP/ATP, CBT, OCR, or AI grading.

---

# 19. Acceptance Criteria

PASS only if:
- School entity works;
- teacher can join/create School;
- Stage 01 data migrates safely;
- shared Class/AcademicPeriod/Subject work;
- TeachingContext remains valid;
- Student is School-scoped;
- ClassStudent works;
- same class+period roster is shared across subjects;
- `/kelas` works;
- `/siswa` works;
- Student profile works;
- add/edit/archive works;
- Excel import preview/mapping/validation/confirm works;
- ownership isolation works;
- build/lint/tests/responsive PASS;
- Stage 00 and Stage 01 regressions PASS.

Do not proceed to Stage 03 until reviewed and locked.
