# Rencana Eksekusi 9 Tahap

> **Aturan main:** akhir setiap tahap wajib `tsc` bersih + seluruh test lama hijau + test baru tahap hijau.
> **Aturan amendum:** glosarium & amendum keamanan mengikat semua tahap; alur `/q/[token]` lama wajib tetap hijau (regresi nol).

## Temuan Review Kode (baseline 18 Sep 2026)

| # | Temuan | Status Rencana |
| :--- | :--- | :--- |
| G1 | `createSchool`/`submitOnboarding` tanpa cek duplikasi normalizedName | Ditutup Tahap 2 |
| G2 | `searchSchools` tak mendukung NPSN & konteks sekolah | Ditutup Tahap 2 |
| G3 | `joinSchool` tanpa transparansi/notifikasi/revoke | Ditutup Tahap 2 |
| G4 | Siswa belum punya jalur login (`Student` = data pasif) | Ditutup Tahap 3–4 |
| G5 | Struktur data mendukung join per-rombel | Dimanfaatkan desain |
| G6 | Lupa password guru belum ada (butuh SMTP) | Backstop superadmin Tahap 5 |
| G7 | Brute-force PIN & kode rombel belum dibatasi | Ditutup Tahap 3 |

Fondasi solid yang dipertahankan: Better Auth (guru), onboarding multi-langkah, `TeacherSchoolMembership` multi-sekolah, `@@unique([schoolId, nis])`, quiz engine lengkap, tautan TP↔penilaian.

## FASE A — FONDASI & AUTH (Tahap 1–6)

**TAHAP 1 — Fondasi Database & Primitif Keamanan** (0,5–1 hari)
- Migrasi `Student`: `accessPinHash`, `accountStatus`, `pinUpdatedAt`, `lastLoginAt`, `failedAttempts`, `lockedUntil`, `approvedById`, `approvedAt`
- Migrasi `Class`: `joinCode`, `joinCodeLocked`, `joinCodeUpdatedAt`; `User.platformRole`; model `AuditLog`
- Seeder superadmin (`scripts/seed-superadmin.ts`, env allowlist); `requireSuperAdmin()`; util PIN `scrypt`
- **DoD:** migrasi bersih; seeder jalan; unit test PIN; test hijau.

**TAHAP 2 — Gerbang Dedup Sekolah & Penguatan Alur Guru** (1–1,5 hari)
- `searchSchools` v2 (nama ATAU NPSN + jumlah guru/rombel); normalisasi v2 (+ alias smpn≡smp negeri)
- Gerbang dedup a–d di `createSchool` & `submitOnboarding`; UI "Maksud Anda?"
- Panel "Guru di Sekolah Kita" (+ revoke), saklar sekolah aktif, edit NIS siswa
- **DoD:** test 4 skenario dedup + revocasi; E2E onboarding hijau.

**TAHAP 3 — Mesin Autentikasi Siswa** (1–1,5 hari)
- `src/modules/student-auth`: hash/verify PIN, sesi terpisah, `verifyStudentSession()`
- Actions: `lookupJoinCode`, `registerStudent` (4 cabang), `loginStudent` (+lockout), `logoutStudent`
- Actions guru: generate/rotasi/lock kode rombel; rate-limit percobaan kode (10x/jam/IP)
- **DoD:** unit test 4 cabang; security test brute-force & isolasi sesi siswa↔guru.
- **Gate:** backfill NIS kanonik (N3) wajib selesai sebelum actions aktif.

**TAHAP 4 — Portal Siswa Gelombang 1: UI & Integrasi Quiz** (2–3 hari)
- `/siswa` (login + gabung), `/siswa/portal` (dashboard + bottom nav 5 item)
- Daily stream "Hari Ini"; Jadwal Mingguan; Profil & Ganti PIN; layar pending
- Integrasi quiz: identitas dari sesi siswa → `QuizAttempt` atas nama benar (+ riwayat & pembahasan)
- **DoD:** E2E: guru buat kode → siswa join → approve → login → kerjakan quiz → nilai muncul di dashboard guru.

**TAHAP 5 — Panel Persetujuan Guru & Superadmin** (1–2 hari)
- Panel siswa pending (L1 per-rombel + L2 sekolah-wide) + approve/reject + batch + jejak
- Highlight eskalasi (>48 jam pengampu; >7 hari semua guru); aksi pindah rombel
- `/admin/*`: force approve, ban guru, reset password guru, nonaktif sekolah, AuditLog UI
- **DoD:** test tangga L1–L3; superadmin tak bisa dibuat via register; audit terisi.

**TAHAP 6 — Pengerasan, Rollover TA & Dokumentasi** (0,5–1 hari)
- Playbook rollover TA; update `MASTER_CONTEXT.md`; smoke & review keamanan akhir
- **DoD:** playbook tertulis; review keamanan lolos.

## FASE B — PORTAL MATANG (Tahap 7)

**TAHAP 7 — Student Progress (Gelombang 2)** (2–3 hari)
- **Pohon Ketuntasan TP**: service agregasi `LearningObjective` ⇄ `AssessmentLearningObjective` ⇄ `AssessmentResult` (hanya FINAL; pertimbangkan `GradePolicy`/KKTP); visual progres per mapel + tren nilai + info remedial
- Presensi Saya (rekap bulanan H/S/I/A); Daftar Tugas read-only; widget ketuntasan di beranda
- **DoD:** unit test agregasi ketuntasan; nilai non-FINAL tidak bocor; E2E siswa melihat nilai setelah guru finalisasi.

## FASE C — KOLABORASI DUA ARAH (Tahap 8)

**TAHAP 8 — Submission, Materi & Mode Keluarga (Gelombang 3)** (3–4 hari)
- Model `AssignmentSubmission` (teks/tautan dulu; unggah berkas menyusul) + antrean koreksi guru + feedback/opsional skor
- Materi Belajar: flag publish pada `AiContentDraft` + tampilan baca siswa
- Mode Keluarga: tab pantauan ort. read-only di portal siswa (reuse layanan baca parent)
- **DoD:** E2E guru buat tugas → siswa submit → guru beri umpan balik; materi publish terlihat; Mode Keluarga read-only aman.

## FASE D — CERDAS (Tahap 9)

**TAHAP 9 — AI Tutor & Gamifikasi (Gelombang 4)** (2–3 hari)
- AI Tutor terkurasi materi publish + TP; guardrail "AI membantu, guru menentukan"; rate-limit & log
- Gamifikasi mikro (opsional, tergantung pola pemakaian): streak, badge ketuntasan
- **DoD:** AI tidak menjawab di luar konteks materi; audit log terisi; go/no-go gamifikasi berbasis data pemakaian.

## Penguatan Non-Blocking N1–N9 (melekat ke tahap terkait)

| # | Penguatan | Melekat di |
| :--- | :--- | :--- |
| N1 | Semua kolom migrasi baru nullable/ber-default; `User.platformRole` default non-admin; nol drop/rename | Tahap 1 |
| N2 | Backfill recompute `School.normalizedName` dengan normalisasi v2 (+alias) untuk baris lama | Tahap 2 |
| N3 | Backfill NIS kanonik + laporan duplikat — **gate**: selesai sebelum actions siswa Tahap 3 aktif | Tahap 1–3 |
| N4 | `AuditLog` minimal: `actorType, actorId, action, targetType, targetId, metadata(Json), ip, createdAt`; append-only; index `[actorId, createdAt]` & `[targetType, targetId]` | Tahap 1 |
| N5 | "Pindah rombel" = UPDATE `classId` pada row `ClassStudent` existing — menghormati `@@unique([studentId, academicPeriodId])` | Tahap 5 |
| N6 | Batch approve = `$transaction` atomic + laporan baris gagal; `AuditLog` per-baris terisi | Tahap 5 |
| N7 | Rantai E2E Tahap 4 memuat langkah "guru publish quiz" sebelum siswa mengerjakan (attempt butuh `status PUBLISHED`) | Tahap 4 |
| N8 | Playbook rollover TA menambah langkah: guru isi NIS siswa yang belum ber-NIS **sebelum** klaim ulang L0 | Tahap 6 |
| N9 | Regresi nol: seluruh alur `/q/[token]` dan `/parent/*` tetap hijau di setiap tahap (door criteria) | Semua |

## Definisi Selesai Keseluruhan (§8)

- [ ] Guru gabung sekolah existing tanpa bisa menciptakan duplikat (4 skenario dedup teruji)
- [ ] Siswa daftar via kode rombel → L0/L1 sesuai state machine → login NIS+PIN
- [ ] Quiz dikerjakan dari portal siswa atas nama sesi → nilai otomatis di dashboard guru
- [ ] Tangga persetujuan L0–L3 + batch approve berfungsi dengan jejak audit
- [ ] Superadmin: reset password guru, ban, force approve — semua ter-audit
- [ ] Rollover TA teruji (klaim ulang L0 memakai NIS & PIN lama)
- [ ] Pohon Ketuntasan TP tampil akurat & hanya nilai FINAL
- [ ] Submission tugas dua arah + Mode Keluarga read-only berjalan
- [ ] AI Tutor terkurasi (jika Tahap 9 dieksekusi)
- [ ] Amendum A dipatuhi & teruji: filter Nilai FINAL sesuai glosarium (unit test), impersonasi quiz via param klien mustahil (security test), reset PIN terbatas pengampu, limiter persisten, sesi di-invalidate saat ban/reset password
- [ ] `tsc` bersih; seluruh test hijau; E2E golden journey lulus

**Estimasi total: ± 13–20 hari kerja fokus** (Fase A: 6–10 hari • Fase B: 2–3 • Fase C: 3–4 • Fase D: 2–3).
