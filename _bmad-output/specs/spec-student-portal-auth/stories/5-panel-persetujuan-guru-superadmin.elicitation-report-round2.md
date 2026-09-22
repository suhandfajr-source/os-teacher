---
title: 'Laporan Elisitasi Round 2 — Story 5: Panel Persetujuan Guru & Superadmin (Pra-Implementasi)'
type: 'elicitation-report'
story: '5-panel-persetujuan-guru-superadmin'
created: '2026-09-22'
status: 'applied — amendemen G-1…G-11 terkunci & tertanam di story 5'
methods:
  - 'Red Team vs Blue Team (#21)'
  - 'Failure Mode Analysis (#60)'
  - 'Assumption Audit (#64)'
  - 'Boundary & Edge Case Sweep (#71)'
  - 'Second-Order Thinking (#30, implicit)'
mode: 'BMad Party Mode (session) + BMad Advanced Elicitation — apply-all disetujui human'
baseline_commit: '5b02b8f docs(bmad): blueprint story 5 + laporan elicitation konsolidasi (apply-all)'
related:
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.elicitation-report.md'
---

# Laporan Elisitasi Round 2 — Story 5 (Pra-Implementasi)

## 1. Ringkasan Eksekutif

Sesi elisitasi round 2 digelar **sebelum implementasi Story 5 dimulai**, dengan target analisis = blueprint Story 5 yang sudah approved, dikonfrontasi langsung terhadap kode & schema eksisting (bukan spekulasi — setiap temuan diverifikasi baris-per-baris).

**Temuan utama:**

1. **Temuan forensik lingkungan (paling kritis)**: saat sesi dimulai, working tree dipercaya "sudah eksekusi Story 5". Verifikasi repositori membuktikan **implementasi Story 5 belum ada sama sekali** — commit terakhir di semua branch hanya blueprint (docs). Artefak yang dicek dan absen: `src/lib/superadmin.ts`, `src/modules/approvals/`, `src/modules/admin/`, `src/modules/notifications/`, `src/app/admin/`, migrasi aditif (terakhir: `20260921000000_reconcile_schedule_prosem_drift`), plugin admin di `src/lib/auth.ts`, blok `/admin/*` di `src/proxy.ts`, field schema (`accountRequestedAt`, `Notification`, `deactivatedAt`, FK formal `approvedById`).
2. **11 celah (G-1…G-11)** ditemukan di blueprint — 3 CRITICAL, 4 HIGH, 4 MEDIUM — semuanya berbasis bukti kode eksisting.
3. **Seluruh 11 celah di-apply** ke story 5 oleh human (`"apply Bro"` — direnegosiasi eksplisit atas blok frozen-after-approval, tercatat di Spec Change Log). Diff spec: +114/−34 baris, 66 referensi G-item.

**Kesimpulan keamanan**: spec kini tertutup 11 lubang yang sebelumnya baru akan ketahuan saat implementasi/produksi. Implementasi nyata **belum dimulai** — langkah berikutnya adalah eksekusi Story 5 terhadap spec yang sudah di-hardening ini.

---

## 2. Metode & Susunan Sesi

| Komponen | Detail |
|---|---|
| Elicitation | BMad Advanced Elicitation — katalog 71 metode disajikan (`list --all`); metode gabungan: Red Team vs Blue Team, Failure Mode Analysis, Assumption Audit, Boundary & Edge Case Sweep |
| Party Mode | BMad Party Mode (mode `session`) — peserta: Mary (📊 Analyst), John (📋 PM), Winston (🏗️ Architect), Amelia (💻 Dev), Sally (🎨 UX) |
| Target analisis | Blueprint Story 5 (frozen-after-approval) × kode eksisting |
| Basis bukti | `prisma/schema.prisma`, `src/modules/student-auth/student-auth.actions.ts` (F1 guard line ~156, skenario (d) line ~168), `src/modules/student-auth/student-session.ts` (`verifyStudentSession` line ~140), `src/lib/authorization.ts`, `src/proxy.ts`, `src/modules/parent/parent.service.ts`, `package.json` (better-auth ^1.6.29) |
| Keputusan human | Apply-all G-1…G-11 (renegosiasi frozen section, disetujui eksplisit) |

---

## 3. Temuan & Amendemen (G-1…G-11)

### 🔴 CRITICAL

#### G-1 — Takeover akun siswa REJECTED lewat jalur daftar ulang

- **Bukti**: F1 guard (`student-auth.actions.ts` line ~156) hanya melindungi `PENDING`/`ACTIVE` via `accessPinHash !== null`. Amend F1 di blueprint membolehkan reuse row REJECTED dengan **update `accessPinHash`/`fullName` tanpa verifikasi apa pun**. NIS sekolah berurutan & semi-ditebak → siapa pun yang tahu NIS siswa REJECTED dapat membajak row, menimpa PIN, dan menimpa `fullName` leger.
- **Amendemen (terkunci)**: daftar ulang REJECTED **wajib verifikasi PIN lama** (`verifyPin` terhadap hash existing) sebelum reuse row; PIN salah → tolak generik + `AuditLog` percobaan; perubahan nama = **red-flag** di metadata `AuditLog` + UI approve. PIN lupa → satu-satunya jalur pulih = pengampu/superadmin reset PIN siswa REJECTED via panel (kuasa reset diperluas ke REJECTED), PIN baru disampaikan offline.

#### G-2 — Guard skenario (d) mematikan daftar ulang REJECTED ke rombel berbeda

- **Bukti**: cek `existingEnrollment` (skenario (d), line ~168) menolak NIS yang sudah punya row `ClassStudent` di rombel lain periode aktif. Siswa REJECTED pasti punya row tersebut → daftar ulang ke kode rombel berbeda **mati lagi** meski cabang F1 di-amend. CAP-4 gagal di cabang kedua.
- **Amendemen (terkunci)**: guard (d) ikut di-amend — siswa REJECTED yang daftar ulang ke rombel berbeda diarahkan ke **UPDATE `classId` pada row `ClassStudent` existing** (reuse pattern N5), bukan ditolak dengan pesan "sudah terdaftar di rombel X".

#### G-3 — Reset password sesama superadmin tidak dilarang

- **Bukti**: blueprint melarang **ban** terhadap `platformRole === "ADMIN"` (F6) tapi diam soal `resetTeacherPasswordAction` terhadap ADMIN lain → superadmin A dapat menguasai akun superadmin B yang dilarang di-ban. Kontradiksi internal.
- **Amendemen (terkunci)**: guard anti-target-ADMIN yang identik diterapkan pada ban **dan** reset password. Recovery sesama superadmin hanya via jalur out-of-band (env allowlist + seeder).

### 🟠 HIGH

#### G-4 — Alur kuis publik `/q/[token]` lolos dari daftar fail-closed F7

- **Bukti**: daftar gerbang F7 di blueprint: login guru, `loginStudent`, `registerStudent`, `lookupJoinCode`, aksi portal siswa, `/parent/*`. Alur kuis token-based tidak tercantum → kuis sekolah nonaktif masih bisa dikerjakan via link token yang beredar.
- **Amendemen (terkunci)**: titik masuk attempt alur `/q/[token]` membaca `Quiz` → `Class` → `School` dan menolak fail-closed bila sekolah nonaktif; pesan generik; masuk scope test siklus nonaktif.

#### G-5 — Hook OQ-6 hanya blokir sesi guru baru; parent bisa login ulang

- **Bukti**: parent adalah User Better Auth juga; setelah revoke saat deaktivasi, re-login parent lolos hook karena resolusi school-context parent ≠ membership guru.
- **Amendemen (terkunci)**: `databaseHooks.session.create` menolak sesi baru **guru DAN parent** — guru via membership, parent via `ParentStudentRelation` → `student.schoolId`.

#### G-6 — Reaktivasi sekolah tak terdefinisi → time bomb NPSN

- **Bukti**: sekolah A nonaktif + NPSN di-clear → sekolah B klaim NPSN → reaktivasi A kena `@unique` P2002 mentah. Blueprint hanya punya `deactivateSchoolAction`, nol kebijakan reaktivasi.
- **Amendemen (terkunci)**: reaktivasi sukses **tanpa NPSN** (`npsn` tetap null); pengisian NPSN ulang via update eksplisit yang menangkap konflik `@unique` menjadi pesan generik — tidak pernah P2002 mentah, tidak pernah crash.

#### G-7 — Siswa PENDING ter-stuck lintas periode akademik

- **Bukti**: seluruh panel di-scope periode aktif; PENDING dengan row `ClassStudent` periode lampau tak terlihat di L1 maupun L2 selamanya — masalah "pending abadi" bereinkarnasi.
- **Amendemen (terkunci)**: L1 tetap ter-scope periode (per-rombel); **L2 sekolah-wide tanpa filter periode** — pending lintas-periode tetap tampil, dapat dipindah rombel (target wajib rombel periode aktif) atau di-reset PIN-nya; test khusus mencegah regresi.

### 🟡 MEDIUM

#### G-8 — Batch approve transaksi raksasa

- **Bukti**: 1.500 baris × (per-row `updateMany` + per-row `AuditLog`) dalam satu `$transaction` → lock panjang, timeout, rollback total mengalahkan semangat skip-and-report.
- **Amendemen (terkunci)**: **cap maksimum 100 baris per aksi batch**, divalidasi server-side; lebih dari itu wajib dipecah; batch >100 ditolak generik + ter-audit.

#### G-9 — Audit `ADMIN_ACCESS_DENIED` mustahil ditulis dari proxy

- **Bukti**: proxy/middleware berjalan di edge runtime; tulis Prisma dari sana bukan pola yang didukung. Juga dedup query-then-insert tidak atomik (request konkuren bisa lolos dedup bersamaan).
- **Amendemen (terkunci)**: `ADMIN_ACCESS_DENIED` lahir dari `requireSuperAdmin()` di layout/handler (runtime Node); proxy **hanya** blok/redirect optimistic tanpa menulis DB; dedup 60 detik best-effort (diterima).

#### G-10 — Model `Notification` tanpa indeks baca badge

- **Bukti**: feed header membaca "unread per user" tiap render; tanpa indeks = full scan yang membesar.
- **Amendemen (terkunci)**: migrasi aditif menambah `@@index([userId, readAt])` pada `Notification`.

#### G-11 — Session-cache role Better Auth dapat menolak superadmin sah

- **Bukti**: plugin admin (better-auth ^1.6.29) memvalidasi `user.role` dari data sesi; superadmin dengan sesi yang dibuat sebelum role ter-set ditolak plugin meski `platformRole === "ADMIN"` → `requireSuperAdmin()` lolos tapi `auth.api.banUser` gagal.
- **Amendemen (terkunci)**: action admin menangkap penolakan plugin menjadi pesan generik; integration test ban/reset password wajib memakai sesi fresh.

---

## 4. Baris Perubahan pada Story 5 (hasil apply)

| Bagian dokumen | Perubahan |
|---|---|
| Approach | Bullet F1 ditulis ulang (G-1 + G-2); F7 diperluas parent + kuis publik (G-4, G-5); kebijakan reaktivasi NPSN (G-6); cap batch (G-8); indeks Notification (G-10) |
| Boundaries — Always | +3 bullet baru: verifikasi daftar ulang REJECTED (G-1), guard skenario (d) (G-2), cap batch (G-8), audit admin dari server (G-9); monopoli reset PIN diperluas ke REJECTED |
| Boundaries — Never | +3 larangan: daftar ulang tanpa PIN lama; ban/reset password sesama ADMIN; batch >100 baris |
| I/O & Edge-Case Matrix | +8 baris: PIN lama salah; PIN lupa; batch >100; kuis publik nonaktif; parent re-login; reset password ADMIN; reaktivasi pasca-klaim NPSN; pending lintas periode |
| Keputusan Elicitasi | Tabel baru "Amendemen Round 2 — TERKUNCI 2026-09-22" (G-1…G-11) |
| Code Map | `approvals.actions.ts`, `admin.actions.ts`, `student-auth.actions.ts`, quiz publik, `auth.ts` hook dua persona, `schema.prisma` — selaras dengan G-items |
| Execution Checklist | 8 item Fase 2–4 di-amend + item reaktivasi baru |
| Acceptance Criteria | AC-2 (jalur REJECTED + PIN lama + guard (d)) dan AC-3 (hook dua persona, kuis token, reaktivasi) diperluas |
| Implementation Notes | +6 catatan keputusan (G-1 jalur pulih, G-6, G-7, G-9, G-11) |
| Spec Change Log | Entri 2026-09-22 lengkap dengan label severity per amendemen |

**Tata kelola**: blok `frozen-after-approval` pada story 5 direnegosiasi oleh human secara eksplisit (keputusan "apply") — sah sesuai klausul *"unless human renegotiates"*; tercatat di Spec Change Log.

---

## 5. Status Verifikasi Saat Ini

| Pemeriksaan | Hasil |
|---|---|
| Implementasi Story 5 di repo (semua branch) | ❌ Belum ada — hanya blueprint (`5b02b8f`) |
| Worktree tambahan | Tidak ada (satu worktree) |
| Migrasi aditif | ❌ Belum ada (terakhir: `20260921000000_reconcile_schedule_prosem_drift`) |
| Spec Story 5 ter-hardening | ✅ +114/−34 baris, 66 referensi G-item, siap jadi baseline implementasi |

**Rekomendasi langkah berikutnya:**

1. Commit amendemen spec: `docs(bmad): amend story 5 — amendemen G-1…G-11 pra-implementasi (apply-all)` — supaya baseline terkunci sebelum satu baris kode ditulis.
2. Eksekusi Story 4 fase → Story 5 mengikuti Execution Checklist Fase 1–4 yang sudah di-hardening.
3. Saat implementasi selesai, jalankan security review/audit ulang (round 3) terhadap kode nyata — round 2 ini audit-nya terhadap spec.

---

*Laporan ini dibuat oleh sesi BMad Party Mode + BMad Advanced Elicitation pada 2026-09-22. Seluruh temuan diverifikasi terhadap kode & schema pada baseline commit `5b02b8f`.*
