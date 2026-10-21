---
title: 'CBT Integrity Lockdown — 3-strike auto-lock dengan jawaban terkunci'
type: 'feature'
created: '2026-10-09'
status: 'done'
route: 'full'
review_loop_iteration: 0
baseline_commit: ddd8936a083509f055086cb64e1c808372071983
context:
  - '{project-root}/prisma/schema.prisma'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Siswa dapat membuka tab/aplikasi lain saat mengerjakan CBT (kuis async) tanpa terdeteksi — integritas penilaian tidak terjaga; web app tidak bisa mencegah secara fisik, sehingga butuh deteksi + sanksi otomatis + laporan.

**Approach:** Tambah `lockdownMode` per kuis (OFF/MONITOR/**STRICT default**) + tabel `QuizViolation` tercatat server-side. Runner siswa wajib fullscreen, mendeteksi episode "keluar ujian" (tab hidden/window blur/fullscreen exit, dedupe jadi satu episode), menampilkan strike banner, dan pada pelanggaran ke-3 di mode STRICT server mengunci attempt: auto-submit skor dari jawaban tersimpan, endpoint jawaban menolak perubahan, siswa melihat layar hasil read-only "Ujian Diakhiri Otomatis". Guru melihat Laporan Integritas per siswa dan dapat memberi remedial (reset attempt, sudah ada).

## Boundaries & Constraints

**Always:**
- Hitungan strike bersifat **server-authoritative**: setiap pelanggaran dicatat via server action saat terjadi; keputusan lock (status→SUBMITTED + `lockdownLockedAt`) dieksekusi server dalam satu transaksi dengan kalkulasi skor (refactor dari `submitQuizAttemptFromSessionAction` menjadi helper bersama yang dipakai submit-normal dan lock-otomatis).
- Pelanggaran = episode "away" (dedupe visibilitychange/blur/fullscreenchange yang berdekatan ≤2 detik menjadi satu), durasi away tercatat (`awayMs`).
- Kebijakan: OFF = tanpa lock; MONITOR = catat + banner peringatan tanpa hitungan auto-lock; STRICT = 3 strike → auto-lock. **Default kolom = STRICT** (quiz baru & quiz existing via migrasi).
- Kunci satu tab per kuis via `BroadcastChannel` berbasis shareToken attempt aktif; tab kedua diblok dengan pesan jelas.
- Semua aksi violation/lock diverifikasi `verifyStudentSession` + ownership attempt.

**Never:**
- Tidak menambal skema autentikasi siswa, alur nilai/assessment publishing, atau Live Classroom CBT (Tahap 2, deferred).
- Tidak memakai library proctoring/lockdown eksternal (SEB, kamera).
- Tidak mengubah model QuizAttempt lama secara breaking (kolom baru nullable/default saja).
- Tidak menjanjikan pencegahan fisik di browser — hanya deteksi + sanksi + log (dokumentasikan di UI guru).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mulai CBT STRICT/MONITOR | Siswa buka runner, belum fullscreen | Tombol mulai terkunci sampai fullscreen aktif; copy/paste/context-menu/shortcut umum diblokir | Fullscreen API ditolak browser → tampil instruksi + tombol coba lagi |
| Pelanggaran 1–2 (STRICT) | Tab hidden/blur/fullscreen exit ≥2s | Banner merah "Pelanggaran N/3" + record server `QuizViolation` (kind, awayMs) | Record gagal (offline) → simpan antrean lokal, kirim ulang saat fokus kembali |
| Pelanggaran ke-3 (STRICT) | violationCount mencapai 3 di server | Transaksi: hitung skor dari jawaban tersimpan, status→SUBMITTED, set `lockdownLockedAt`; response `locked:true` | Race dua record bersamaan → transaksi idempoten (re-cek count di dalam transaksi) |
| Attempt terkunci, siswa kirim jawaban/submit | `lockdownLockedAt != null` | Endpoint tolak: "Ujian telah diakhiri sistem (3 pelanggaran integritas)" | UI dialihkan ke layar hasil read-only |
| Tab kedua dibuka | BroadcastChannel claim bentrok | Tab kedua menampilkan blokir "Ujian sudah berjalan di tab lain" | — |
| Refresh/close saat IN_PROGRESS | beforeunload | Dialog peringatan browser; attempt tetap IN_PROGRESS, bisa lanjut di tab sama | — |
| Deadline kedaluwarsa bersamaan strike ke-3 | isAttemptExpired true | Tetap dikunci & diskor (deadline menang untuk waktu, lock tetap terekam) | — |
| Mode MONITOR violation | away episode | Tercatat + banner "tercatat" tanpa hitungan/lock | — |
| Guru buka Laporan Integritas | quiz dengan attempts | Per siswa: jumlah pelanggaran, daftar (kind/waktu/awayMs), badge "Diakhiri Sistem" bila locked | Quiz tanpa violations → tampil kosong rapi |
| Remedial guru | openRemedialAttemptAction | Attempt baru mulai bersih; violations attempt lama tetap tersimpan utuh (history) | — |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` — tambah enum `QuizLockdownMode`, `Quiz.lockdownMode @default(STRICT)`, `QuizAttempt.violationCount @default(0)` + `lockdownLockedAt DateTime?`, model `QuizViolation` (attemptId FK Cascade, kind, awayMs, occurredAt). Migrasi via `prisma migrate dev`.
- `src/modules/quiz/quiz.actions.ts` — `startQuizAttemptFromSessionAction` (include lockdownMode ke response), `saveQuizAnswerFromSessionAction`/`submitQuizAttemptFromSessionAction` (guard locked), `getPublicQuizAction` (expose lockdownMode). Ekstrak helper skor dari submit (~L1899) untuk dipakai lock. Tambah `recordQuizViolationFromSessionAction` + `getQuizIntegrityReportAction` (teacher). `updateQuizSettingsAction`/`createQuizAction` menerima `lockdownMode`.
- `src/modules/quiz/quiz.types.ts` — tipe DTO lockdown/violation.
- `src/modules/student-portal/components/QuizRunnerClient.tsx` — gerbang fullscreen, listener episode-away (visibilitychange/blur/fullscreenchange, dedupe 2s), strike banner, BroadcastChannel single-tab, blokir copy/paste/shortcut, beforeunload, layar "Ujian Diakhiri Otomatis", antrean violation offline.
- `src/app/siswa/portal/quiz/[shareToken]/page.tsx` — flow data lockdownMode → runner.
- `src/app/(dashboard)/quiz/[quizId]/QuizDetailClient.tsx` — selector mode di settings + panel Laporan Integritas (data `getQuizIntegrityReportAction`).
- JANGAN ubah: `student-session.ts`, model Assessment/publishing, `openRemedialAttemptAction` (cukup dipakai; pastikan attempt lama tak terhapus — pakai yang ada).

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` + `prisma migrate dev --name cbt_integrity_lockdown` — enum/kolom/model baru — fondasi server-authoritative.
- [x] `src/modules/quiz/quiz.actions.ts` — refactor helper skor bersama; action `recordQuizViolationFromSessionAction` (transaksi: insert violation + increment + lock bila ≥3 STRICT); guard locked di save/submit; expose mode di public/start; `getQuizIntegrityReportAction`; input `lockdownMode` di create/update settings — semua jalur enforcement.
- [x] `src/modules/quiz/quiz.types.ts` — DTO — kontrak type-safe lintas layer.
- [x] `src/modules/student-portal/components/QuizRunnerClient.tsx` — UX lockdown lengkap (gerbang, episode-away, banner strike, auto-lock screen, single-tab, blokir clipboard/shortcut, beforeunload, antrean offline) — pengalaman siswa sesuai matriks.
- [x] `src/app/siswa/portal/quiz/[shareToken]/page.tsx` — alirkan lockdownMode — runner tahu mode sebelum mulai.
- [x] `src/app/(dashboard)/quiz/[quizId]/QuizDetailClient.tsx` — selector mode (default STRICT) + panel Laporan Integritas — kontrol & observasi guru.
- [x] Test vitest edge-case matriks (strike ke-3 idempoten, guard locked, dedupe episode, deadline-vs-lock) — buat/extend di `src/modules/quiz/__tests__/`.

**Acceptance Criteria:**
- Given kuis STRICT dengan attempt IN_PROGRESS, when server mencatat pelanggaran ke-3, then dalam satu transaksi attempt menjadi SUBMITTED dengan skor final dan `lockdownLockedAt` terisi, serta `QuizViolation` berisi 3 baris.
- Given attempt dengan `lockdownLockedAt` terisi, when siswa memanggil save/submit, then ditolak dengan pesan "Ujian telah diakhiri sistem" dan tidak ada perubahan data.
- Given dua event away terpisah <2 detik, when runner mereport, then hanya 1 `QuizViolation` yang tercipta (dedupe di klien; server tetap idempoten via timestamp terakhir bila diperlukan).
- Given quiz `lockdownMode: OFF`, when siswa keluar tab, then tidak ada banner/record dan perilaku sama seperti sekarang.
- Given guru membuka detail kuis, when attempts memiliki violations, then panel integritas menampilkan daftar + badge locked per siswa.

## Implementation Notes

- Migrasi diterapkan TANPA reset: `prisma migrate dev` mendeteksi drift pre-existing (DB ≠ snapshot migrasi) dan meminta reset — ditolak karena akan menghapus data demo. Alternatif: `prisma migrate diff --from-config-datasource --to-schema` → SQL diinspeksi (hanya objek story ini, 0 DROP) → folder migrasi manual + `db execute` + `migrate resolve --applied`. Drift pre-existing tetap ada (bukan scope story).
- Roster & quiz object di `getQuizDetailAction` diperluas (`violationCount`, `lockedBySystem`, `lockdownMode`) — badge integritas per siswa & badge mode di header detail guru; `getQuizIntegrityReportAction` tersedia untuk konsumsi lanjutan Tahap 2 live monitor.
- Runner: gerbang fullscreen memakai lazy `useState` initializer untuk deteksi dukungan API (hindari setState-in-effect); perangkat tanpa Fullscreen API (iOS) tetap bisa mengerjakan dengan catatan "terpantau".
- Blok timer dipindah setelah `handleAutoSubmitOnExpire` — memperbaiki use-before-declare pre-existing (react-hooks lint).
- File test lama `student-portal-quiz.actions.test.ts` punya 15 error `any` PRE-EXISTING (tidak tersentuh story; dikonfirmasi via `git show HEAD`).
- Working tree berisi perubahan provider GLM milik pengguna (agent.config/router/.env.example) + seed-student-demo.ts lama — SENGAJA tidak ikut staging/commit story ini.
- `updateQuizSettingsAction` kini menerima `lockdownMode` (default schema STRICT), namun belum ada UI edit settings quiz existing (konsisten dengan field lain yang juga hanya di-set saat pembuatan).

## Design Notes

Episode-away detection: mulai episode saat `visibilitychange→hidden` ATAU `blur` ATAU `fullscreenchange→exit` (yang pertama); akhiri saat `visible`+`focus`; kirim `awayMs` saat episode berakhir. Debounce 2s mencegah badai event fullscreen-exit↔tab-switch. Strike banner persists sampai episode berikutnya. BroadcastChannel key: `cbt-lock-{shareToken}`; heartbeat 1s, tab baru yang mendengar heartbeat existing → blokir diri.

## Verification

**Commands:**
- `npx prisma migrate dev --name cbt_integrity_lockdown` -- expected: migrasi apply bersih tanma data loss.
- `npx tsc --noEmit` -- expected: 0 error.
- `npx eslint src/modules/quiz src/modules/student-portal` -- expected: 0 error baru.
- `npx vitest run src/modules/quiz` -- expected: semua lulus termasuk test baru.

**Manual checks (if no CLI):**
- Login siswa demo, buka CBT STRICT (mis. CBT-XI1-2026), keluar tab 3x → layar terkunci; coba refresh & kirim jawaban ulang → tetap read-only; login guru → panel integritas menampilkan 3 pelanggaran + badge.

## Review Triage Log

| Finding ID | Layer | Location | Verdict | Route | Note / Evidence |
|---|---|---|---|---|---|
| F-BH-01 | blind-hunter | `src/modules/quiz/quiz.actions.ts:1680` | `medium` | `patch` | Validasi runtime string enum `QuizViolationKind` absen sebelum transaksi DB; dipatch dengan allowlist guard. |
| F-BH-02 | blind-hunter | `src/modules/quiz/quiz.actions.ts:1722` | `false` | `reject` | `gradeAttempt` dan `normalizeScore` fungsi deterministik murni tanpa IO/throw pada answer valid. |
| F-BH-03 | blind-hunter | `src/modules/quiz/quiz.actions.ts:1725` | `false` | `reject` | Kode sudah menuliskan `submittedAt: new Date()` di baris 2180 tx.quizAttempt.update. |
| F-BH-04 | blind-hunter | `src/modules/student-portal/components/QuizRunnerClient.tsx:185` | `low` | `reject` | Native element blur jarang di runner fullscreen kuis dan risiko kompleksitas guard tambahan lebih besar. |
| F-BH-05 | blind-hunter | `src/modules/student-portal/components/QuizRunnerClient.tsx:288` | `medium` | `defer` | Retry antrean offline drop jika refresh terjadi saat offline; perlu persistent queue / IndexedDB. |
| F-BH-06 | blind-hunter | `src/modules/student-portal/components/QuizRunnerClient.tsx:440` | `low` | `reject` | Tab sekunder tertutup atau di-redirect; BroadcastChannel ditutup saat unmount komponen runner. |
| F-BH-07 | blind-hunter | `src/app/(dashboard)/quiz/new/NewQuizClient.tsx:120` | `low` | `defer` | Pengaturan mode lockdown pasca-publikasi kuis ditunda ke iterasi konfigurasi darurat guru. |
| F-BH-08 | blind-hunter | `src/modules/quiz/quiz.actions.ts:1760` | `low` | `defer` | Optimasi paginasi laporan integritas kuis skala besar (>500 siswa) ditunda ke Tahap 2 monitoring. |
| F-EC-01 | edge-case-hunter | `src/modules/quiz/quiz.actions.ts:1725` | `false` | `reject` | Identik dengan F-BH-03; baris 2180 sudah menetapkan `submittedAt: new Date()`. |
| F-EC-02 | edge-case-hunter | `src/modules/quiz/quiz.actions.ts:1680` | `medium` | `patch` | Identik dengan F-BH-01; allowlist guard diaplikasikan dan diuji via unit test. |
| F-EC-03 | edge-case-hunter | `src/modules/student-portal/components/QuizRunnerClient.tsx:185` | `low` | `reject` | Identik dengan F-BH-04; native element blur tidak membutuhkan branch guard baru. |
| F-EC-04 | edge-case-hunter | `src/modules/student-portal/components/QuizRunnerClient.tsx:288` | `medium` | `defer` | Identik dengan F-BH-05; penanganan antrean offline lanjutan tercatat di deferred-work. |
| F-EC-05 | edge-case-hunter | `src/modules/quiz/quiz.actions.ts:1580` | `false` | `reject` | Input default `input.lockdownMode ?? "STRICT"` sudah diterapkan di createQuizAction. |
| F-VG-01 | verification-gap | `src/modules/quiz/quiz.actions.ts:1725` | `false` | `reject` | Identik dengan F-BH-03; `submittedAt` sudah terisi di payload update. |
| F-VG-02 | verification-gap | `src/modules/quiz/quiz.actions.ts:1680` | `medium` | `patch` | Identik dengan F-BH-01; unit test penolakan jenis pelanggaran invalid ditambahkan. |
