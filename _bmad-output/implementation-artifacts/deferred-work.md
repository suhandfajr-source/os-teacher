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
  summary: Putuskan field `engines` di package.json (mis. `node >= 20.12` — syarat `--env-file-if-exists` script seed) — kebijakan manifest seluruh app, bukan keputusan seeder sendirian; sementara ini terdokumentasi di `.env.example` + header CLI.
  evidence: VG-other5 review 1c; tanpa engines, Node 18–20.11 mati "bad option" tanpa penjelasan.

# Review Story 5 pass 1 — defer entries (2026-09-23)

- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md`
  summary: BH-6 — Eksplorasi AuditLog per-aktor dari konsol admin (link berfilter konsol→viewer) belum ada; admin harus menyalin cuid manual.
  evidence: Viewer sudah berfilter aktor/aksi/target (dipakai index N4), tetapi tidak ada tautan navigasi dari baris konsol user/sekolah ke `/admin/audit?actorId=...`; peningkatan UX di luar kontrak viewer.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md`
  summary: BH-12 — Polish NotificationBell: mark-read saat dropdown ditutup (bukan dibuka), polling ringan, dan render `payload.link` sebagai navigasi.
  evidence: Fungsionalitas inti (aggregate per aksi + badge unread via index G-10) terpenuhi dan teruji; tiga poin ini polish UX tanpa kontrak frozen.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md`
  summary: BH-16 — FK `notification.schoolId` belum ber-index; butuh migrasi aditif tambahan.
  evidence: Tidak ada consumer yang mem-query notification per-sekolah saat ini (semua baca per-user via index `[userId, readAt]`); bundle-kan indeks dengan migrasi berikutnya yang menyentuh notifikasi.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md`
  summary: VG-Other-2 — Flag `dbAvailable` pada int test tidak me-skip body `it` (kegagalan DB = loud assertion failures, bukan clean skip).
  evidence: Pola `beforeAll` try/catch + flag hanya dikonsultasi di sebagian tempat; hygiene test-harness lintas file; kegagalan bersifat loud sehingga tidak menyembunyikan regresi.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md`
  summary: Story-4 test "fetches today's live schedule" flaky time-of-day — jendela LIVE di-seed 07:00–23:59 WIB, gagal bila suite dijalankan di luar jendela itu.
  evidence: DIBUKTIKAN bukan regresi Story 5 — `git stash` → run pada baseline bersih `efdff6b` → gagal di asersi `isLive` yang sama → `git stash pop`. Perbaikan: seed jadwal relatif terhadap waktu berjalan (bukan jam tetap) atau mock `vi.setSystemTime`.
