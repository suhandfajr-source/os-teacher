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
  summary: Saat Story 3 mengimpor `student-pin`, tambahkan import `resolvePinPepper` di `instrumentation.ts` (Next.js) agar konfigurasi produksi (PIN_PEPPER/NODE_ENV) gagal saat boot sungguhan, bukan di request pertama route yang menyentuh kode PIN.
  evidence: BH2+BH3 review 1b: modul pure util tanpa konsumer hari ini, Next lazy-load per-route; komentar .env.example diakuratkan ke "first import" — wiring boot adalah tanggung jawab konsumen pertama.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md`
  summary: Story 3 (login NIS+PIN) wajib memasang dummy-verify + pesan generik "NIS atau PIN salah" di CALLER — `verifyPin` 1b sengaja tidak menyamarkan timing NIS-tak-ditemukan vs PIN-salah (primitif murni); jangan sampai terlupa saat mengonsumsi primitif.
  evidence: security-amendum.md B3 (pesan seragam + dummy-verify); walkthrough 1b: verifyPin return cepat untuk format invalid tanpa scrypt — tak membocorkan apa pun tentang input yang diketahui attacker sendiri, tapi pembedaan keberadaan NIS hidup di lapis caller.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md`
  summary: Kebijakan kekuatan minimum secret (mis. ≥32 hex chars) saat production boot — diterapkan serentak untuk `PIN_PEPPER` dan `BETTER_AUTH_SECRET` (satu kebijakan, bukan dua standar yang berbeda).
  evidence: BH6 review 1b ditolak (di luar spec 1b; mirror getAuthSecret juga tanpa validasi — parity dipertahankan); alami sebagai bagian wiring deploy Story 3.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md`
  summary: Rotasi pepper pasca-produksi (bila jadi kebutuhan): perkenalkan format baru ber-prefix versi (mis. `scryptv2:pv2:{N}:{r}:{p}:{salt}:{hash}`) backward-compatible — parser memperlakukan format `scrypt:{N}:…` hari ini sebagai v1 implisit dengan verify ganda masa transisi; TIDAK perlu diubah sekarang.
  evidence: Keputusan walkthrough 1b 2026-09-20 (human-delegated): scheme token di awal hash menjaga pintu evolusi tetap terbuka pasca-produksi — mengubah format sekarang = dual-verify + registry untuk hipotesis; golden vector 1b mem-pin v1 agar evolusi masa depan tak memutus legacy.

# Review 1c pass 1 — defer entries (2026-09-20)

- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md`
  summary: Putuskan field `engines` di package.json (mis. `node >= 20.12` — syarat `--env-file-if-exists` script seed) — kebijakan manifest seluruh app, bukan keputusan seeder sendirian; sementara ini terdokumentasi di `.env.example` + header CLI.
  evidence: VG-other5 review 1c; tanpa engines, Node 18–20.11 mati "bad option" tanpa penjelasan.
