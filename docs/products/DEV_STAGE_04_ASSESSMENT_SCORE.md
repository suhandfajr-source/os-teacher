# DEVELOPMENT STAGE 04 — ASSESSMENT & SCORE
## AI Teacher Assistant

Status: PLANNED AFTER STAGE 03 PASS

---

# 1. Objective

Build V1 assessment administration and manual score entry.

```text
Prepare Assessment
↓
Assessment occurs outside system
↓
Teacher corrects manually
↓
Teacher enters score
↓
System validates/calculates/analyzes
↓
System recommends remedial candidates
↓
Teacher decides
```

AI does NOT grade student answers in V1.

---

# 2. Assessment

Assessment belongs to one TeachingContext and may optionally link to a LearningObjective.

---

# 3. Blueprint / Kisi-kisi

Support manual creation and later AI assistance. CP/TP remains optional.

---

# 4. Question Bank & Answer Key

Support basic question storage/reuse and teacher-approved answer keys. No online CBT engine.

---

# 5. Score Entry

High-priority UX:
- keyboard navigation;
- autosave;
- paste spreadsheet;
- bulk entry;
- missing-score status;
- optional CSV/XLSX import.

Scores reference shared Student records.

---

# 6. Analysis

Deterministic calculations first: average, min/max, pass rate, below-threshold students, distribution, optional TP mastery.

---

# 7. Remedial

Preserve initial score, remedial score, final score, and history. System may recommend; teacher finalizes.

---

# 8. Parent Readiness

Do not expose to Parent yet, but structure data so future Parent Portal can read verified student's approved data.

---

# 9. Out of Scope

Online CBT, student digital responses, auto PG correction, OCR, AI essay correction, AI score recommendation, mass AI correction, Parent Portal.

---

# 10. Acceptance Criteria

PASS only if assessment CRUD works, shared roster loads correctly, manual score input is fast/safe, duplicate scores are prevented, analysis works, remedial history is preserved, authorization works, no AI grading exists, build/lint/tests PASS, and Stage 00–03 regressions PASS.
