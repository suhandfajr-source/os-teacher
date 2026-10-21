# Deferred Work

- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1-fondasi-database-primitif-keamanan.md`
  summary: Guard `requireSuperAdmin()` + unit test-nya ditunda ke Story 5 (Panel Persetujuan Guru & Superadmin), membawa kontrak terkeras hasil elicitation — deny-by-default strict equality `platformRole === "ADMIN"` (nilai asing seperti `"MODERATOR"` tertolak, bukan `!== "USER"`), kontrak tanpa sesi → denied, satu jenis error tunggal `SuperAdminRequiredError` dengan pesan statis identik semua jalur (anti enumerasi), baca role via `session.user` dengan fallback `prisma.user.findUnique({ where: { id: session.userId } })`, tanpa mengubah `src/lib/auth.ts`.
  evidence: Split token-gate Story 1 (spec >1600 token di Build step-02, disetujui human 2026-09-20); guard tidak punya konsumen hingga `/admin/*` dibangun di Story 5; detail lengkap di Spec Change Log Story 1 dan `1-fondasi-database-primitif-keamanan.elicitation-report.md` (Ronde 2 S7/S8, Ronde 5 RT3, Ronde 3 A15).
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
  summary: Primitif PIN siswa (`student-pin.ts` + test + `PIN_PEPPER` env doc) dipecah menjadi Story 1b — pure util tanpa dependensi DB, kontrak elicitation utuh di `stories/1b-primitif-pin.md`.
  evidence: Pecahan 3 arah Story 1 (token-gate Build step-02, disetujui human 2026-09-20); paralel dengan 1a, tidak memblokir.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
  summary: Allowlist parser + seeder superadmin (`superadmin-allowlist.ts`, `seed-superadmin.ts`, tsx + npm script, `SUPERADMIN_EMAILS` env) dipecah menjadi Story 1c — kontrak elicitation utuh di `stories/1c-allowlist-seeder-superadmin.md`.
  evidence: Pecahan 3 arah Story 1 (token-gate Build step-02, disetujui human 2026-09-20); prasyarat 1a merged (kolom platformRole + tabel AuditLog).
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
  summary: [SETTLED 2026-09-21 via spec-neon-drift-reconciliation] Rekonsiliasi drift Neon existing — migrasi `20260921000000_reconcile_schedule_prosem_drift` dibuat via diff shadow, diterapkan di Neon via `migrate resolve --applied`. Chain 20 file kini sinkron 100% dengan schema.prisma.
  evidence: Ditemukan saat Build 1a 2026-09-20; dilunasi 2026-09-21 (gate exit 0, migrate status 20 up-to-date).

# Review 1a pass 1 — defer entries (2026-09-20)

- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
  summary: [SETTLED 2026-09-21 via spec-neon-drift-reconciliation] Migrasi rekonsiliasi drift schedule/prosem (f0be2d5) sudah land sebagai `20260921000000_reconcile_schedule_prosem_drift`.
  evidence: Replay 20 file = schema.prisma = Neon. Gate verify:migrations exit 0.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
  summary: [SETTLED 2026-09-21 via spec-neon-drift-reconciliation] Gate verifikasi otomatis file migrasi (`npm run verify:migrations`) diaktifkan via `scripts/verify-migrations.mjs` pasca-rekonsiliasi drift lunas.
  evidence: VG1 pre-verified; aktif 2026-09-21, exit 0 pada chain bersih, mendeteksi drift secara otomatis.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
  summary: [SETTLED 2026-09-21 via Story 2] Proyeksikan kolom (select) di getStudents/updateStudent/archiveStudent/addStudent SEBELUM Story 3 mengisi accessPinHash — terlunasi dengan SAFE_STUDENT_SELECT eksplisit di `src/modules/students/students.actions.ts`.
  evidence: VG-other2: students.actions.ts kini memiliki proyeksi select aman di seluruh fungsi dan diverifikasi via unit test `students.actions.test.ts`.

# Walkthrough 1b — improvement decisions (2026-09-20, human-delegated)

- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md`
  summary: [SETTLED 2026-09-21 via Story 3] Import `resolvePinPepper` dan `getStudentSessionSecret` di `src/instrumentation.ts` (Next.js) agar konfigurasi produksi gagal saat boot sungguhan.
  evidence: Terpasang di `src/instrumentation.ts` dan diverifikasi saat boot runtime.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md`
  summary: [SETTLED 2026-09-21 via Story 3] Story 3 (login NIS+PIN) memasang dummy-verify + pesan generik "NIS atau PIN salah" di CALLER — `DUMMY_HASH` scrypt tiruan aktif saat NIS absen.
  evidence: security-amendum.md B3 & F5; diimplementasikan di `src/modules/student-auth/student-auth.actions.ts` dan diverifikasi di `student-auth.security.test.ts`.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md`
  summary: [SETTLED 2026-09-21 via Story 3] Kebijakan kekuatan minimum secret (>= 32 chars) saat production boot di `src/modules/student-auth/student-session.ts` dan `src/instrumentation.ts`.
  evidence: Terverifikasi di `student-session.test.ts`.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md`
  summary: Rotasi pepper pasca-produksi (bila jadi kebutuhan): perkenalkan format baru ber-prefix versi (mis. `scryptv2:pv2:{N}:{r}:{p}:{salt}:{hash}`) backward-compatible — parser memperlakukan format `scrypt:{N}:…` hari ini sebagai v1 implisit dengan verify ganda masa transisi; TIDAK perlu diubah sekarang.
  evidence: Keputusan walkthrough 1b 2026-09-20 (human-delegated): scheme token di awal hash menjaga pintu evolusi tetap terbuka pasca-produksi — mengubah format sekarang = dual-verify + registry untuk hipotesis; golden vector 1b mem-pin v1 agar evolusi masa depan tak memutus legacy.

# Review 1c pass 1 — defer entries (2026-09-20)

- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md`
  summary: [SETTLED 2026-10-02] Field `engines` dipasang: `"node": ">=20.12"` di package.json (syarat `--env-file-if-exists` script seed).
  evidence: Patch 2026-10-02; Node 18–20.11 kini terblokir jelas oleh npm sebelum script jalan.

# Review Story 5 pass 1 — defer entries (2026-09-23)

- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md`
  summary: [SETTLED 2026-10-02] BH-6 — Tombol "Audit" di baris guru tab Guru konsol admin → `/admin/audit?actorId={userId}` (tab baru); viewer sudah berfilter aktor sejak awal.
  evidence: Patch AdminConsoleClient 2026-10-02; deep-link filter actorId terverifikasi.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md`
  summary: [SETTLED 2026-10-02] BH-12 — NotificationBell: mark-read saat dropdown DITUTUP (klik luar/tombol Tutup/item link), polling ringan 60s (skip saat tab hidden), payload.link dirender sebagai navigasi.
  evidence: Rewrite NotificationBell.tsx 2026-10-02; fungsionalitas inti (badge unread) tak berubah.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md`
  summary: [SETTLED 2026-10-02] BH-16 — FK `notification.schoolId` kini ber-index via migrasi `20261002151829_notification_school_idx` (Neon up-to-date, verify:migrations exit 0).
  evidence: Migrasi aditif diterapkan 2026-10-02.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md`
  summary: [SETTLED 2026-10-02 — test-infra lintas-suite] Fail-loud anti vakum-pass: 10 suite int kini `throw` di beforeAll saat `DATABASE_URL` ter-set tetapi DB tak terjangkau; soft-skip hanya saat env tak dikonfigurasi.
  evidence: Patch catch-block 10 file int test 2026-10-02; full suite 812/812 dengan DB aktif.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md`
  summary: [SETTLED — terverifikasi 2026-10-02] Story-4 test "fetches today's live schedule" flaky time-of-day — seed kini `00:00–23:59` ("rentang penuh agar uji isLive deterministik di jam berapa pun"), deterministik di semua jam.
  evidence: `story-4-full-audit.int.test.ts` baris 152-153; hijau pada full suite 2026-10-02.

# Review Story 6 pass 1 — defer entries (2026-09-23)

- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/6-pengerasan-rollover-ta-dokumentasi.md`
  summary: [SETTLED 2026-10-02] BH-9 — Formula eskalasi lockout kini sumber tunggal `lockoutAfter()` + `recordPinFailure()` (increment atomic `{ increment: 1 }` — anti lost-update); dipakai loginStudent (ACTIVE/PENDING/REJECTED) & cabang klaim ulang. PENDING/REJECTED kini ikut tereskalasi lockout-nya (menutup celah brute-force PIN tanpa batas pada akun non-ACTIVE).
  evidence: Patch 2026-10-02; unit assertion di-update ke increment atomik; full suite 812/812.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/6-pengerasan-rollover-ta-dokumentasi.md`
  summary: [SETTLED 2026-10-02 — test-infra fail-loud] Seluruh suite real-db kini gagal keras saat `DATABASE_URL` ter-set tapi tak terjangkau (vakum-pass dilarang); cabang klaim ulang ter-cover int test story-5 (reset PIN + revoke).
  evidence: Patch catch-block lintas 10 suite 2026-10-02.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/6-pengerasan-rollover-ta-dokumentasi.md`
  summary: [SETTLED 2026-10-02] BH-5-l Lookup — `lookupJoinCode` kini resolusi deterministik `find(ACTIVE) ?? [0]` tanpa `take:1` (mirror pola registerStudent Story 6 BH-5/EC-3); kartu konteks join tidak lagi menampilkan TA lama.
  evidence: Patch 2026-10-02; unit+int lookupJoinCode hijau pada full suite 811/811.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/7-student-progress-gelombong-2.md`
  summary: Suite int real-DB (story 4-7) lolos diam-diam (test PASS tanpa eksekusi) saat DATABASE_URL tak terjangkau.
  evidence: `if (!dbAvailable) return;` di setiap `it` + catch beforeAll yang hanya console.warn — konvensi lintas 4 suite; perlu keputusan test-infra lintas-suite (skipIf env gate / fail-loud).
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/7-student-progress-gelombang-2.md`
  summary: Layer UI portal siswa (nav 6 item, halaman nilai, widget beranda) tanpa cakupan test render.
  evidence: Nol file `*.test.tsx` dan tanpa @testing-library/jsdom di devDependencies — repo belum punya infra test komponen; memperkenalkannya untuk satu item nav tidak proporsional untuk story ini.

## Deferred from: code review (2026-09-27)

- **[high] Cabang PENDING registerStudent (baris 684) tidak pernah terjangkau** — [SETTLED 2026-10-02, keputusan user opsi A] Kode mati dihapus end-to-end: cabang re-registrasi PENDING, seluruh fitur birthDateConflict/conflictBirthDates (actions, approvals, UI badge), 2 kolom DB di-drop via migrasi `20261002150546_drop_student_birth_date_conflict` (Neon up-to-date, verify:migrations exit 0).
  ~~guard F1 (student-auth.actions.ts:536-543) menelan semua siswa PENDING ber-PIN~~ (arsip: redesign jalur re-registrasi PENDING ditolak user — siswa PENDING cukup tunggu persetujuan/hubungi guru; pesan statis F1 dipertahankan sesuai keputusan terkunci #4 anti-enumerasi).
- **[high] Kebocoran PII roster di lookupJoinCode** — nama lengkap + NIS seluruh siswa kelas dikirim tanpa autentikasi/rate-limit ke siapa pun yang memegang kode 6 karakter; NIS dibutuhkan client untuk gate NIS-matching, jadi fix butuh keputusan desain (validasi server-side vs kirim NIS).
  - **[SETTLED 2026-10-02 — keputusan user, risk-accept]** Nama + NIS boleh terlihat pemegang kode gabung; keamanan login dianggap cukup karena ada dua pintu: PIN untuk login dan tanggal lahir untuk verifikasi klaim NIS/nama. Tidak ada perubahan kode.
- **[medium] Roster kosong/kontrak client-server** — [SETTLED 2026-10-02, keputusan user] Roster gate dipasang server-side di `registerStudent` (mirror gate UI): NIS tak dikenal atau bukan anggota roster rombel → ditolak; jalur klaim ulang Story 6 & re-register REJECTED (G-1) di atas gate tetap utuh. Unit+int test disesuaikan (seeding roster); full suite 811/811.
- **[medium] Guru belum punya aksi edit/hapus akses siswa** — [SETTLED 2026-10-02, disetujui user] `revokeStudentAccessAction` (approvals.actions): kuasa pengampu rombel (mirror resetStudentPinAction B2), accountStatus → REJECTED + rotasi pinUpdatedAt (F3 — sesi hangus) + hygiene lockout + audit `STUDENT_ACCESS_REVOKED`; data akademik utuh; jalur pulih = daftar ulang PIN lama (G-1) → PENDING → approve. UI: `RevokeStudentAccessDialog` di profil siswa (tampil untuk ACTIVE / PENDING ber-PIN). Edit data (nama/NIS) & reset PIN memang sudah ada (updateStudent/resetStudentPinAction).
  evidence: Int test story-5 "#4 revokeStudentAccessAction" (non-pengampu ditolak, idempotensi, audit bebas PIN); full suite 812/812.
- source_spec: none
  summary: Story 2 — Lampiran guru pada tugas (upload file soal/LKPD oleh guru, tampil di portal siswa)
  evidence: Diputuskan di sesi forge (_bmad-output/forge/modul-tugas-via-file/): eksekusi berurutan, Story 1 (file jawaban siswa) didahulukan; blueprint lengkap ada di docs/product/assignment-file-blueprint.md bagian 3.6 & rencana eksekusi
- source_spec: `_bmad-output/implementation-artifacts/spec-assignment-file-submission.md`
  summary: Utility cleanup objek orphan di prefix submissions/tmp/ (lifecycle R2/MinIO atau job scan usia >24 jam)
  evidence: Review pass 1 (BH6/BH7/E10): upload yang tak pernah diklaim (batch gagal, tab ditutup, submit dibatalkan) menetap selamanya; Design Notes menoleransi orphan demi submit non-blocking — cleanup jadi tugas terpisah
- source_spec: `_bmad-output/implementation-artifacts/spec-assignment-file-submission.md`
  summary: Infra component-test React (jsdom/@testing-library) untuk UI upload SubmitAssignmentForm & tampilan grading
  evidence: Review pass 1 (VG5): repo belum punya satu pun *.test.tsx maupun dependency DOM-testing; adopsi infra = keputusan project-level, bukan bagian story ini

- source_spec: `_bmad-output/implementation-artifacts/spec-cbt-integrity-lockdown.md`
  summary: Retry antrean offline violation menggunakan persistent storage (IndexedDB) jika tab di-refresh saat offline
  evidence: Diidentifikasi pada review pass 1 (F-BH-05/F-EC-04); saat ini antrean tersimpan di memori ref dan di-flush saat window focus/online.
- source_spec: `_bmad-output/implementation-artifacts/spec-cbt-integrity-lockdown.md`
  summary: Pengaturan toggle darurat mode lockdown pasca-publikasi kuis pada halaman QuizDetailClient
  evidence: Diidentifikasi pada review pass 1 (F-BH-07); saat ini mode dipilih saat pembuatan kuis di NewQuizClient; backend sudah siap lewat updateQuizSettingsAction.
- source_spec: `_bmad-output/implementation-artifacts/spec-cbt-integrity-lockdown.md`
  summary: Paginasi dan agregasi komputasi laporan integritas untuk cohort kuis skala besar (>500 siswa)
  evidence: Diidentifikasi pada review pass 1 (F-BH-08); getQuizIntegrityReportAction memuat semua attempt rombel normal (30-120 siswa), perlu paginasi untuk skala sekolah.
