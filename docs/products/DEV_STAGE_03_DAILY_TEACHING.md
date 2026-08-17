# DEVELOPMENT STAGE 03 — DAILY TEACHING
## AI Teacher Assistant

Status: PLANNED AFTER STAGE 02 PASS

---

# 1. Objective

Build the teacher's daily classroom workflow on top of School Workspace and shared class rosters.

```text
Teacher
↓
Hari Ini
↓
Select TeachingContext
↓
Start Teaching Session
↓
Attendance
↓
Record Actual Teaching
↓
Teaching Journal Generated
```

---

# 2. Core Principles

- TeachingContext is the classroom access boundary.
- Roster comes from School Workspace `ClassStudent`.
- Planned Teaching and Actual Teaching remain separate.
- Teacher can start without CP/TP/ATP.
- Attendance raw data is preserved.
- Journal is derived from activity, not another duplicate form.

---

# 3. TeachingSession

Add conceptually:

```text
TeachingSession
- id
- teachingContextId
- date
- startedAt optional
- endedAt optional
- plannedTopic optional
- actualTopic optional
- activitySummary optional
- status
- createdByTeacherProfileId
```

---

# 4. Hari Ini

Implement `/hari-ini` showing active TeachingContexts and today's real activity. Do not fake timetable data that does not exist.

---

# 5. Attendance

Add `AttendanceRecord` linked to `TeachingSession` + `Student`.

Statuses conceptually: PRESENT, ABSENT, SICK, PERMISSION, LATE.

Mobile-first flow:

```text
Mark All Present → Change Exceptions → Save
```

One status per student per session.

---

# 6. Actual Teaching

Record what actually happened without overwriting planned teaching data.

---

# 7. Teaching Journal

Generate journal from Teacher, School, Class, Subject, AcademicPeriod, TeachingSession, Attendance, and Actual Teaching. Teacher reviews before finalizing/exporting.

---

# 8. Class Detail Integration

Real Stage 03 tabs may include Pertemuan, Absensi, and Jurnal. Do not add fake future tabs.

---

# 9. Security

Teacher cannot create sessions or attendance for unauthorized TeachingContexts.

---

# 10. Out of Scope

Assessment, score input, remedial, AI grading, Student 360 analytics, Parent Portal, full reporting, generic imports, OCR, CBT.

---

# 11. Acceptance Criteria

PASS only if teacher can start a session, shared roster loads correctly, attendance works mobile/desktop, duplicate attendance is prevented, actual teaching is separate from planning, journal is correctly derived, authorization is enforced, persistence works, build/lint/tests PASS, and Stage 00–02 regressions PASS.
