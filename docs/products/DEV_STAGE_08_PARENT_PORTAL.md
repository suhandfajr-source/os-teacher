# DEVELOPMENT STAGE 08 — PARENT PORTAL
## AI Teacher Assistant

Status: PLANNED AFTER STAGE 07 PASS

---

# 1. Objective

Allow verified parents/guardians to view permitted development information for their own children.

Parent Portal is read-focused.

---

# 2. Parent Identity

Add ParentProfile linked to authenticated User.

---

# 3. Parent ↔ Student Relation

Add `ParentStudentRelation` with statuses such as PENDING, VERIFIED, REJECTED, REVOKED.

Only VERIFIED relations grant access.

---

# 4. Safe Linking Flow

Do NOT allow School → Class → Student → Instant Access.

Preferred flow:

```text
Parent Register
↓
Search/Select School
↓
Find Child / Enter Invitation Code
↓
Request Link
↓
Verification
↓
ParentStudentRelation VERIFIED
↓
Access Child
```

---

# 5. Privacy

Parent should not browse a public roster of all students. Prefer constrained search, invitation code, or approval.

---

# 6. Parent Dashboard

Suggested navigation:

```text
Beranda
Anak Saya
Perkembangan
Informasi Guru
```

Support multiple children, potentially across different schools, with independently verified relations.

---

# 7. Parent Data Access

Parent may see permitted attendance summary, assessment/score trends, tasks if available, remedial status, parent-visible notes, and development summaries.

Parent must NOT see other students, other parents, private teacher notes, or unrestricted School data.

---

# 8. Teacher Note Visibility

Any TeacherNote must distinguish PRIVATE vs PARENT_VISIBLE, default PRIVATE.

---

# 9. Parent Relation Model

Parent links to Student, not directly to every teacher. Teachers/subjects are resolved via Student → ClassStudent → Class → TeachingContext.

Subject/class learning access requires a separate permission: `ParentTeachingAccess`.
- Must be approved per `TeachingContext`.
- Only the specific Teacher owning the `TeachingContext` can approve/reject the access.
- Permission is context-specific; it does not automatically carry forward if the student changes class, academic period, or teacher.
- This teacher-controlled approval is strictly separate from School Workspace Membership approval.

---

# 10. Acceptance Criteria

PASS only if parent auth works, ParentProfile works, ParentStudentRelation works, verification is mandatory, roster enumeration is prevented, multi-child works, only verified children are visible, private notes remain hidden, cross-school isolation works, build/lint/tests PASS, and Stage 00–07 regressions PASS.
