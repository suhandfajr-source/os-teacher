# DEVELOPMENT STAGE 06 — AI CONTENT STUDIO
## AI Teacher Assistant

Status: PLANNED AFTER STAGE 05 PASS

---

# 1. Objective

Build AI-assisted teacher content generation while preserving teacher control.

Principle:

```text
AI Recommends / Assists
Teacher Decides
```

---

# 2. AI Architecture

```text
UI → AI Service → Provider Adapter → Gemini
```

Do not call Gemini directly from random components. Deterministic calculations remain outside AI.

---

# 3. Context Sources

AI may consume authorized Teacher, School, TeachingContext, Class, Subject, AcademicPeriod, planned/actual teaching, optional CP/TP/ATP, optional RPP, and assessment context.

---

# 4. Automatic vs Manual

Automatic mode uses known system context. Manual mode lets teacher override/provide context. Advanced settings collapsed by default.

---

# 5. Supported Artifacts

May generate teaching activity recommendations, learning material, LKPD/worksheet, question set, answer-key draft, kisi-kisi, lesson-plan/RPP draft, PPT outline/content, and remediation material.

No AI grading.

---

# 6. Generation Flow

```text
Choose Artifact → Use Context → Generate → Preview → Edit → Teacher Approves → Save / Use / Export
```

---

# 7. Traceability

Store AI/manual source, provider/model, context reference/snapshot, timestamps, and teacher-approved final version.

---

# 8. Tenant Safety

AI context must never cross School Workspace boundaries accidentally.

---

# 9. Acceptance Criteria

PASS only if provider abstraction works, context is permission-safe, Auto/Manual work, preview/edit/approve/save works, AI output is labeled/traceable, no AI grading exists, build/lint/tests PASS, and Stage 00–05 regressions PASS.
