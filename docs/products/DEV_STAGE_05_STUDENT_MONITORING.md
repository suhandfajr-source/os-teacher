# DEVELOPMENT STAGE 05 — STUDENT MONITORING
## AI Teacher Assistant

Status: PLANNED AFTER STAGE 04 PASS

---

# 1. Objective

Build Student 360 monitoring from real accumulated activity. Monitoring is an aggregation layer, NOT a duplicated giant table.

---

# 2. Student 360 Principle

Because Student is School-scoped and shared, the same Student can accumulate authorized data across subjects, teachers, and academic periods.

---

# 3. Data Sources

May aggregate class membership, attendance, assignments if implemented, assessment scores, remedial, teacher notes when implemented, and optional TP mastery.

Do not duplicate source data.

---

# 4. Access Policy

Recommended V1: teacher sees monitoring for students reachable through the teacher's authorized TeachingContexts. Do not automatically grant school-wide cross-subject visibility without an explicit rule.

---

# 5. Student 360 Screen

Enhance `/siswa/[studentId]` with real sections such as Ringkasan, Kehadiran, Assessment, Remedial, Perkembangan, and Riwayat Kelas.

Only show sections backed by real data.

---

# 6. Facts vs Interpretation

Separate factual records from interpretation/recommendation.

---

# 7. Coverage / Confidence

Show when data is incomplete, e.g. only 3 of 7 active subjects represented. Do not present partial data as a full-school judgment.

---

# 8. Flags

Deterministic flags may include repeated absence, repeated below-threshold scores, incomplete remedial, and declining recent trend. Avoid diagnoses.

---

# 9. Out of Scope

Parent Portal, autonomous AI judgment, behavioral diagnosis, disciplinary automation, School Admin dashboard unless separately approved.

---

# 10. Acceptance Criteria

PASS only if Student 360 uses real source records, no duplicated monitoring store exists, authorized cross-context aggregation works, coverage/confidence is visible, facts and interpretation are distinct, unauthorized access is blocked, build/lint/tests PASS, and Stage 00–04 regressions PASS.
