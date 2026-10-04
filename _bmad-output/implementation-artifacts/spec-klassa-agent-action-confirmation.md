---
status: done
date: 2026-10-03
title: Klassa Agent Human-in-the-Loop Action Confirmation Engine
route: full
baseline_commit: '716ed5871c245f5f64973d4e4c87767a5a0451b5'
review_loop_iteration: 1
---

# Technical Specification: Klassa Agent Human-in-the-Loop Action Confirmation Engine (Story 3)

## 1. Problem Statement & Business Context
Klassa Agent memiliki kemampuan mutasi data penting dalam sistem (misal: pencatatan presensi siswa, pembuatan penugasan/kuis, atau pengumuman kelas). 
Untuk menjaga integritas data sekolah dan mencegah halusinasi LLM melakukan mutasi yang tidak diinginkan secara sepihak, sistem menerapkan **Prinsip Human-in-the-Loop (HITL) Tanpa Kompromi**:
- Agent **dilarang keras** mengeksekusi mutasi (Create, Update, Delete) secara langsung tanpa persetujuan eksplisit guru.
- Agent harus memformulasi rencana aksi mutasi (*Action Intent / Proposal*) dengan parameter terstruktur (payload snapshot), menyimpannya dalam status pending confirmation, dan menyajikannya kepada guru di UI chat.
- Eksekusi mutasi hanya dapat dijalankan setelah guru secara sadar mengklik tombol aksi konfirmasi (*Confirm & Execute*) atau membatalkannya (*Reject/Cancel*).
- Setiap aksi konfirmasi harus terikat dengan otorisasi guru yang bersangkutan (Scope Rombel B2 & Membership B1) dan memiliki masa kedaluwarsa (*TTL / Expired*).

---

## 2. Core Requirements & Acceptance Criteria
1. **Schema Mutation Actions**:
   - `AgentActionProposal` tersimpan di database dengan relasi ke `AgentConversation` atau berdiri sebagai record audit action.
   - Status proposal: `PENDING`, `EXECUTED`, `CANCELLED`, `EXPIRED`.
   - Payload terstruktur (`actionType`, `targetEntity`, `summary`, `payloadSnapshot`).
2. **Draft Mutation Tools (AI SDK Tools)**:
   - Tool untuk menghasilkan draft mutasi:
     - `proposeAttendanceLogTool`: Mengajukan pencatatan/pembaruan status presensi siswa.
     - `proposeClassAnnouncementTool`: Mengajukan pembuatan pengumuman kelas.
     - `proposeAssignmentDraftTool`: Mengajukan draft penugasan baru.
   - Tool mengembalikan ID proposal dan pesan konfirmasi yang wajib ditampilkan ke antarmuka guru.
3. **Execution & Confirmation API / Server Actions**:
   - `executeAgentAction(actionProposalId)`: Server Action untuk mengeksekusi proposal yang telah disetujui guru.
     - Memverifikasi kepemilikan guru atas percakapan dan rombel terkait (`verifyClassRosterAccess`).
     - Memvalidasi status proposal (`PENDING`) dan TTL (misal 15 menit).
     - Menjalankan mutasi transaksi Prisma secara atomik.
     - Mengubah status proposal menjadi `EXECUTED` beserta timestamp dan `executionResult`.
   - `cancelAgentAction(actionProposalId)`: Membatalkan proposal (`CANCELLED`).
4. **Keamanan & Otorisasi**:
   - Multi-tenant school isolation (`activeSchoolId`).
   - Guru hanya dapat mengonfirmasi aksi untuk rombel yang diampunya (`verifyClassRosterAccess`).
   - Anti-replay: Proposal yang sudah `EXECUTED` atau `CANCELLED` tidak bisa dieksekusi ulang.

---

## 3. Database Schema Changes (`prisma/schema.prisma`)
Menambahkan model `AgentActionProposal`:
```prisma
enum AgentActionStatus {
  PENDING
  EXECUTED
  CANCELLED
  EXPIRED
}

model AgentActionProposal {
  id              String            @id @default(uuid())
  conversationId  String
  conversation    AgentConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  schoolId        String
  school          School            @relation(fields: [schoolId], references: [id], onDelete: Cascade)
  teacherProfileId String
  teacherProfile  TeacherProfile    @relation(fields: [teacherProfileId], references: [id], onDelete: Cascade)

  actionType      String            // e.g. "RECORD_ATTENDANCE", "CREATE_ANNOUNCEMENT", "CREATE_ASSIGNMENT"
  classId         String?           // Rombel target (jika terkait rombel)
  class           Class?            @relation(fields: [classId], references: [id], onDelete: SetNull)
  summary         String            // Ringkasan ramah guru: "Mencatat presensi 3 siswa alpa pada pertemuan 5"
  payload         Json              // Data payload snapshot yang akan dieksekusi
  status          AgentActionStatus @default(PENDING)
  executionResult Json?             // Log hasil eksekusi setelah diapprove
  expiresAt       DateTime          // Batas waktu konfirmasi (default: 15 menit)
  executedAt      DateTime?

  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([conversationId])
  @@index([schoolId, teacherProfileId])
  @@index([status])
}
```

---

## 4. Implementation Plan & File Structure
1. **Schema Migration**:
   - Tambah `AgentActionProposal` di `prisma/schema.prisma`.
   - Jalankan `npx prisma db push` atau migration Prisma.
2. **Action Proposal Types & Validation**:
   - `src/modules/agent/tools/agent-action.types.ts`: Definisi Zod schema untuk proposal mutasi (`RECORD_ATTENDANCE`, `CREATE_ANNOUNCEMENT`, `CREATE_ASSIGNMENT`).
3. **Action Proposal Tools**:
   - `src/modules/agent/tools/agent-action.tools.ts`: Tools AI SDK yang memanggil engine proposal dan mengembalikan draft card UI metadata.
4. **Action Execution Server Actions**:
   - `src/modules/agent/agent-action.actions.ts`:
     - `executeAgentAction(proposalId)`
     - `cancelAgentAction(proposalId)`
     - `getPendingActionProposals(conversationId)`
5. **Unit & Integration Tests**:
   - `src/modules/agent/__tests__/agent-action-confirmation.test.ts`:
     - Pengujian pembuatan proposal draft dari tool.
     - Pengujian eksekusi proposal yang sukses.
     - Penolakan otorisasi jika guru mencoba mengeksekusi proposal guru lain atau rombel lain.
     - Penolakan jika proposal sudah `EXECUTED` atau `EXPIRED`.

---

## Review Triage Log
| Finding / Issue | Layer | Severity | Resolution / Evidence |
|---|---|---|---|
| CRITICAL / M-01: Race condition double execution (TOCTOU) | Concurrency & Data Integrity | CRITICAL | Atomic Gate Lock via `tx.agentActionProposal.updateMany` inside `$transaction`. Jika row count = 0, tolak request seketika. |
| MAJOR: Partial transaction boundary on assignment creation | Transaction Integrity | MAJOR | Satukan pembuatan `Assignment` dan update proposal dalam satu atomik `$transaction`. |
| m-01: Non-pending status check is lenient | State Transition | MINOR | Mengganti dengan strict whitelist check: `if (proposal.status !== 'PENDING') return error`. |
| MINOR: Student roster membership verification | Scope & Data Integrity | MINOR | Memverifikasi seluruh `studentId` dalam payload terdaftar di `ClassStudent` rombel tersebut. |

## Completion Summary
Story 3 telah melalui 1 siklus review komprehensif (Blind Hunter + Edge-Case Hunter). Seluruh temuan kritis dan major terkait concurrency serta batasan transaksi atomik telah diperbaiki (*hardened*), tervalidasi dengan `npx tsc --noEmit` (0 error), 24/24 unit tests passing, dan full suite regression 881/881 tests passing tanpa regresi. Status diubah menjadi `done`.
