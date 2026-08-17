# DEVELOPMENT STAGE 09 — IMPORT & MID-SEMESTER ONBOARDING
## AI Teacher Assistant

Status: PLANNED AFTER STAGE 08 PASS

---

# 1. Objective

Allow teachers and School Workspaces to start using the system at any time, including mid-semester, without forcing complete historical reconstruction.

Principle: Start Anytime, Grow the Context.

---

# 2. Modes

```text
Start Now
Quick Backfill
Full Import
```

Start Now uses the system from today. Quick Backfill imports essential summaries/history. Full Import imports detailed supported history.

---

# 3. Generic Import Engine

```text
Upload → Preview → Mapping → Validation → Conflict Resolution → Confirm → Import → Audit Result
```

No blind spreadsheet-to-database writes.

---

# 4. Supported Domains

Depending on approved templates: student roster, class membership, attendance history, assessment scores, remedial history, academic context, selected teaching history.

---

# 5. School Workspace Awareness

Every import resolves School, AcademicPeriod, Class, Subject where relevant, and Student identity. Avoid duplicate School/Class/Student records.

---

# 6. Student Matching

Prefer NISN, NIS, or another reliable school identifier. Name-only matching must not auto-merge.

---

# 7. Import Audit

Store ImportJob/Mapping/Result or equivalent and track rows processed, created, updated, skipped, and errors.

---

# 8. Data Coverage

Show imported data coverage so partial history is not mistaken for complete history.

---

# 9. Editable Export / Reimport Rule

Offline edits return through Reimport → Preview → Mapping → Validation → Confirm.

---

# 10. Acceptance Criteria

PASS only if Start Now works, approved backfill/import modes work, preview/mapping/validation/conflict resolution work, audit exists, duplication is controlled, coverage is visible, failure handling is safe, build/lint/tests PASS, and Stage 00–08 regressions PASS.
