# Development Stage 07 — Reporting & Academic Context

## 1. Overview & Architecture

Development Stage 07 implements two connected areas designed under the foundational product principle:
- **ACTIVITY GENERATES DATA → DATA GENERATES REPORTS**
- **INPUT ONCE, USE EVERYWHERE**
- **MORE CONTEXT = BETTER EXPERIENCE, NOT REQUIRED EXPERIENCE**

Reports are 100% derived from authoritative operational records (TeachingSession, AttendanceRecord, Assessment, AssessmentResult, StudentMonitoringNote, LearningObjective). Zero duplicate report tables (`AttendanceSummary`, `GradeSummary`, `JournalReport`, `GeneratedReport`, etc.) are created.

Academic Context provides optional curriculum metadata (Curriculum profile, Capaian Pembelajaran, Tujuan Pembelajaran / ATP sequence, and Prota/Prosem). Academic Context is strictly optional and never blocks daily teaching, attendance, assessments, or grading.

---

## 2. Persisted Academic Context Models

```prisma
enum AcademicPlanType {
  PROTA
  PROSEM
}

model AcademicContextProfile {
  id                String          @id @default(cuid())
  teachingContextId String          @unique
  teachingContext   TeachingContext @relation(fields: [teachingContextId], references: [id], onDelete: Restrict)
  curriculumName    String?
  phase             String?
  academicNote      String?         @db.Text
  cpText            String?         @db.Text
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@map("academic_context_profile")
}

model LearningObjective {
  id                String          @id @default(cuid())
  teachingContextId String
  teachingContext   TeachingContext @relation(fields: [teachingContextId], references: [id], onDelete: Restrict)
  code              String?
  description       String          @db.Text
  orderIndex        Int             @default(0)
  status            EntityStatus    @default(ACTIVE)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  sessionLinks      TeachingSessionLearningObjective[]
  assessmentLinks   AssessmentLearningObjective[]

  @@index([teachingContextId, status])
  @@index([teachingContextId, orderIndex])
  @@map("learning_objective")
}

model AcademicPlanItem {
  id                String           @id @default(cuid())
  teachingContextId String
  teachingContext   TeachingContext  @relation(fields: [teachingContextId], references: [id], onDelete: Restrict)
  planType          AcademicPlanType
  title             String
  targetMonth       Int?             // Validated 1..12
  allocatedHours    Int?             // > 0
  notes             String?          @db.Text
  orderIndex        Int              @default(0)
  status            EntityStatus     @default(ACTIVE)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt

  @@index([teachingContextId, planType, status])
  @@index([teachingContextId, orderIndex])
  @@map("academic_plan_item")
}

model TeachingSessionLearningObjective {
  id                  String            @id @default(cuid())
  teachingSessionId   String
  teachingSession     TeachingSession   @relation(fields: [teachingSessionId], references: [id], onDelete: Restrict)
  learningObjectiveId String
  learningObjective   LearningObjective @relation(fields: [learningObjectiveId], references: [id], onDelete: Restrict)
  snapshotCode        String?
  snapshotDescription String            @db.Text
  createdAt           DateTime          @default(now())

  @@unique([teachingSessionId, learningObjectiveId])
  @@index([teachingSessionId])
  @@index([learningObjectiveId])
  @@map("teaching_session_learning_objective")
}

model AssessmentLearningObjective {
  id                  String            @id @default(cuid())
  assessmentId        String
  assessment          Assessment        @relation(fields: [assessmentId], references: [id], onDelete: Restrict)
  learningObjectiveId String
  learningObjective   LearningObjective @relation(fields: [learningObjectiveId], references: [id], onDelete: Restrict)
  snapshotCode        String?
  snapshotDescription String            @db.Text
  createdAt           DateTime          @default(now())

  @@unique([assessmentId, learningObjectiveId])
  @@index([assessmentId])
  @@index([learningObjectiveId])
  @@map("assessment_learning_objective")
}
```

---

## 3. Reporting Capabilities & Semantics

1. **Teaching Journal (`JOURNAL`)**:
   - Lists authoritative sessions (COMPLETED sessions as finalized rows, IN_PROGRESS sessions labeled draft).
   - Supports 1:N Assignment cardinality.
   - Displays snapshotted objectives linked to each meeting.
2. **Attendance Recap (`ATTENDANCE`)**:
   - Participant universe derived from historical AttendanceRecord snapshots.
   - Late enrollees display `—` (NOT_ENROLLED) for past meetings.
   - Former roster students with historical records remain visible and badged `Tidak di roster saat ini` (never `Alumni`).
   - Factual summary counts (H, T, S, I, A).
3. **Assessment / Score Recap (`SCORE`)**:
   - Rows include all historical AssessmentResults (GRADED, ABSENT, EXCUSED, PENDING).
   - Aggregation uses COMPLETED assessments and non-null numeric finalScores only.
   - Strict `null != zero` preservation.
   - Reuses `calculateStudentRunningPerformance` from Stage 04 with factual wording (*Performa Berdasarkan Komponen Tersedia*).
4. **Monitoring & Follow-Up (`MONITORING`)**:
   - Summarizes factual attendance, assessment results, below-KKTP counts, and remedial counts.
   - Displays teacher's private monitoring notes and open/resolved follow-up status.
5. **Academic Coverage (`COVERAGE`)**:
   - Lists all TPs with active/archived badge.
   - Shows count of linked COMPLETED TeachingSessions and latest taught date.
   - Shows count of linked COMPLETED Assessments.
   - Zero AI guessing, zero fake progress bars.

---

## 4. Export & Print Features
- **Binary XLSX Export**: Endpoint `/api/reports/export/xlsx` with full server-side authorization check. Untrusted cells starting with `=`, `+`, `-`, `@`, `\t`, `\r` are neutralized (`'`) against formula injection (CWE-1236).
- **Print-Friendly View**: `/laporan/print` with server authorization, clean black-and-white print CSS, standard report header/identification (formal approval/signature blocks omitted).

---

## 5. Quality Gate Status
- **Prisma Migrations**: `20260823140000_stage_07_reporting_academic_context` applied.
- **TypeScript**: `npx tsc --noEmit` passed with 0 errors.
- **ESLint**: `npm run lint` passed with 0 errors.
- **Vitest**: 166/166 tests passed across 14 test files.
- **Playwright**: 39/39 tests passed across Stages 00–07.
- **Build**: Next.js 16.3.1 production build succeeded (exit code 0).
