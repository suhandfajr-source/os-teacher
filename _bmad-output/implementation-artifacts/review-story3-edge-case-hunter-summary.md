# Hasil Review Edge-Case Hunter: Story 3 (Klassa Agent HITL Action Confirmation Engine)

- **Sumber Prompt:** `_bmad-output/implementation-artifacts/review-story3-edge-case-hunter-prompt.md`
- **Spesifikasi Acuan:** `_bmad-output/implementation-artifacts/spec-klassa-agent-action-confirmation.md`
- **File Patch yang Diuji:** `_bmad-output/implementation-artifacts/diff-klassa-agent-action-confirmation.patch`
- **Peran:** Lead QA & Reliability Engineer (Edge-Case Hunter)
- **Tanggal:** 3 Oktober 2026

---

## 1. Analisis 4 Fokus Review Utama

### 1.1. Race Condition & Concurrency (Double-Click / Double-Invocation)
- **Kondisi:**
  Pada fungsi `executeAgentAction(proposalId)` di `agent-action.actions.ts`:
  1. Proposal diambil melalui `prisma.agentActionProposal.findUnique(...)`.
  2. Dilakukan pengecekan `if (proposal.status === "EXECUTED")`.
  3. Mutasi dijalankan (membuat `TeachingSession` / `Assignment`).
  4. Status proposal baru diupdate menjadi `EXECUTED` di akhir alur:
     `prisma.agentActionProposal.update({ where: { id: proposalId }, data: { status: "EXECUTED" } })`.
- **Analisis Risiko:**
  - Jika guru melakukan *double-click* cepat atau dua tab peramban memanggil `executeAgentAction` pada mikrodetik yang sama, kedua request akan sama-sama membaca proposal dalam status `PENDING`.
  - Pada `CREATE_ASSIGNMENT`, dua record penugasan identik akan terbuat di database.
  - Pada `RECORD_ATTENDANCE`, karena tabel `TeachingSession` tidak memiliki constraint `@unique([teachingContextId, date])`, dua sesi pengajaran berbeda dapat terbuat secara paralel, dan record presensi terpecah/terduplikasi.
- **Tingkat Keparahan:** **CRITICAL**.
- **Rekomendasi Guard:**
  Gunakan *conditional atomic update* (optimistic locking) di awal alur transaksi:
  ```ts
  const affected = await prisma.agentActionProposal.updateMany({
    where: { id: proposalId, status: "PENDING" },
    data: { status: "EXECUTED", executedAt: new Date() },
  });
  if (affected.count === 0) {
    return { success: false, message: "Aksi sedang diproses, sudah dieksekusi, atau tidak valid." };
  }
  ```

---

### 1.2. Payload Drift & Re-Validation
- **Evaluasi:**
  Sebelum mengeksekusi payload dari JSON database, `executeAgentAction` melakukan validasi ulang secara ketat:
  - `RecordAttendancePayloadSchema.safeParse(proposal.payload)`
  - `CreateAssignmentPayloadSchema.safeParse(proposal.payload)`
  - `CreateAnnouncementPayloadSchema.safeParse(proposal.payload)`
- **Analisis:**
  Jika isi payload di database termanipulasi, rusak, atau skemanya berubah (*payload drift*), proses eksekusi langsung dihentikan sebelum menyentuh tabel entitas sekolah.
- **Tingkat Keparahan:** **PASS (Sangat Baik)**.

---

### 1.3. Database Relationships & Foreign Keys
- **Evaluasi Konteks Mengajar (`teachingContextId`):**
  - Pada `RECORD_ATTENDANCE`, sistem mencari `teachingContext` dengan filter:
    `where: { teacherProfileId: profile.id, classId, schoolId: activeSchoolId }`.
  - Pada `CREATE_ASSIGNMENT`, sistem memfilter:
    `where: { teacherProfileId: profile.id, classId, subjectId, schoolId: activeSchoolId }`.
  - Jika kombinasi guru-rombel-mapel tidak ditemukan, eksekusi ditolak dengan aman: `"Konteks mengajar guru untuk mata pelajaran dan rombel ini tidak ditemukan."`.
- **Celah Boundary Siswa (Student Enrollment Check):**
  - Pada payload presensi, array `records` memuat `studentId`. Saat disimpan via `tx.attendanceRecord.upsert`, foreign key `Student` memang menjamin ID siswa valid di database sekolah. Namun, sistem belum memverifikasi apakah seluruh `studentId` tersebut benar-benar murid aktif yang terdaftar di `ClassStudent` pada `classId` terkait.
- **Tingkat Keparahan:** **MINOR**.
- **Rekomendasi Guard:**
  Lakukan validasi keanggotaan rombel sebelum loop presensi:
  ```ts
  const validStudents = await tx.classStudent.findMany({
    where: { classId, studentId: { in: records.map(r => r.studentId) } },
    select: { studentId: true }
  });
  ```

---

### 1.4. Data Rollback & Transaction Boundary
- **Evaluasi Presensi:**
  Pencarian/pembuatan `TeachingSession` dan seluruh `upsert` pada `AttendanceRecord` dibungkus dalam `await prisma.$transaction(async (tx) => { ... })`.
  Jika salah satu catatan siswa gagal disimpan (misal timeout atau data korup), seluruh mutasi dibatalkan (*automatic SQL ROLLBACK*). Tidak ada rekaman presensi parsial/yatim yang tertinggal.
- **Celah Boundary pada Pembuatan Penugasan:**
  Pada `CREATE_ASSIGNMENT`, pemanggilan `prisma.assignment.create` berada di luar transaksi status proposal. Jika pembuatan assignment sukses namun koneksi database terputus sebelum `prisma.agentActionProposal.update` selesai, proposal tetap berstatus `PENDING` sementara assignment sudah terbuat di DB, memicu duplikasi saat guru mencoba klik ulang.
- **Tingkat Keparahan:** **MAJOR**.
- **Rekomendasi Guard:**
  Bungkus mutasi entitas dan pembaruan status `agentActionProposal` ke dalam satu blok `$transaction` yang sama.

---

## 2. Tabel Ringkasan Temuan Review

| Kategori | Lokasi | Skenario Pemicu | Dampak | Rekomendasi Mitigasi |
|:---:|---|---|---|---|
| **CRITICAL** | `agent-action.actions.ts:47-75, 235` | Double-click / permintaan konfirmasi simultan pada proposal yang sama | `status: "EXECUTED"` diupdate di akhir alur tanpa kunci atomik; memicu eksekusi ganda dan duplikasi data `TeachingSession` / `Assignment`. | Gunakan `updateMany` kondisional (`where: { id, status: "PENDING" }`) sebagai lock sebelum mutasi dimulai. |
| **MAJOR** | `agent-action.actions.ts:200-240` | Kegagalan jaringan setelah `assignment.create` namun sebelum `proposal.update` | Proposal tetap `PENDING` padahal assignment sudah tersimpan di database. | Masukkan pembuatan assignment dan update status proposal ke dalam satu `prisma.$transaction`. |
| **MINOR** | `agent-action.actions.ts:160-190` | LLM mengusulkan presensi untuk `studentId` dari kelas lain yang masih dalam 1 sekolah | Presensi tercatat untuk siswa yang bukan anggota rombel tersebut. | Validasi `studentId` terhadap tabel `ClassStudent` rombel terkait. |
| **MINOR** | `agent-action.actions.ts:215-230` | Eksekusi proposal aksi `CREATE_ANNOUNCEMENT` | Belum ada persistensi ke tabel pengumuman riil (hanya menghasilkan stub response). | Sambungkan ke tabel pengumuman sekolah saat modul komunikasi diimplementasikan. |
| **PASS** | `agent-action.actions.ts:70-80` | Guru mencoba mengeksekusi proposal yang sudah kedaluwarsa (> 15 menit) | Proposal otomatis ditandai `EXPIRED` dan eksekusi ditolak. | Terverifikasi aman. |
| **PASS** | `agent-action.actions.ts:85-130` | Guru lain atau sekolah lain mencoba mengeksekusi proposal | Akses ditolak melalui `schoolId` & `teacherProfileId` scoping dan `verifyClassRosterAccess`. | Terverifikasi aman. |
| **PASS** | `agent-action.actions.ts:90-115` | Payload diubah atau mengalami korupsi data di database | Validasi Zod `safeParse` menolak eksekusi dan mengembalikan pesan error informatif. | Terverifikasi aman. |
| **PASS** | `agent-action.actions.ts:140-195` | Kegagalan di tengah batch penyimpanan presensi siswa | Seluruh operasi di-rollback secara atomik melalui `tx.$transaction`. | Terverifikasi aman. |

---

## 3. Verdict Akhir

### **Verdict: NEEDS_HARDENING**

**Justifikasi:**
Prinsip Human-in-the-Loop (HITL) dan arsitektur proposal draft pada Story 3 telah diimplementasikan dengan sangat baik (mencegah LLM melakukan mutasi sepihak, membatasi TTL 15 menit, dan memvalidasi ulang skema payload). 

Namun, terdapat **celah konkurensi kritis (*concurrency race condition*)** pada alur konfirmasi proposal. Pengecekan status dan pembaruan `PENDING -> EXECUTED` harus diubah menggunakan transaksi atomik / optimistic locking untuk mencegah duplikasi data akibat *double submission*.
