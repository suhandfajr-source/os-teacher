# DEVELOPMENT STAGE 07 — REPORTING & ACADEMIC CONTEXT
## AI Teacher Assistant

Status: PLANNED AFTER STAGE 06 PASS

---

# 1. Objective

Turn accumulated activity data into reports and optional curriculum/admin documents. Reporting is an OUTPUT layer.

---

# 2. Academic Context

Add/complete optional Curriculum, CP, TP, ATP, Mastery Criteria, Academic Plan, Prota, and Prosem.

These enrich intelligence but are NOT prerequisites for daily use.

---

# 3. School Scope

Academic Context should normally be scoped to School Workspace where appropriate and reusable by authorized teachers.

---

# 4. Reporting Engine

Reports derive from School, Teacher, TeachingContext, Students, Attendance, Teaching Sessions, Assessments, Scores, Remedial, optional TP, and approved AI artifacts.

---

# 5. Report Workflow

```text
Generate Draft → Review → Edit → Finalize → Snapshot → Export
```

Finalized reports preserve history/snapshots.

---

# 6. Output Formats

Priority:
1. XLSX
2. DOCX
3. PDF
4. PPTX

PostgreSQL remains source of truth. Edited exports do not automatically mutate the DB.

---

# 7. Report Types

Examples: attendance recap, score recap, remedial recap, teaching journal recap, student list, assessment analysis, TP progress, teacher report, Prota/Prosem/RPP outputs.

---

# 8. Template Engine

Separate semantic data from document format so different schools can use different templates without changing core data.

---

# 9. Security

Reports are scoped by teacher authorization, School Workspace, TeachingContext, and Student access.

---

# 10. Acceptance Criteria

PASS only if optional Academic Context works, the app still works without CP/TP/ATP, reports derive from real data, XLSX works, other approved formats work, snapshots/history work, templates are separate from core data, security is enforced, build/lint/tests PASS, and Stage 00–06 regressions PASS.
