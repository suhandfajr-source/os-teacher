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
  summary: Rekonsiliasi drift Neon existing — perubahan schedule/prosem (commit f0be2d5: teaching_schedule, academic_plan_item, learning_objective, academic_context_profile, teaching_session.teachingScheduleId) ada di schema.prisma + Neon (via db push masa lalu) TAPI tidak punya file migrasi; perlu migrasi rekonsiliasi agar `migrate deploy`/fresh-local replay menghasilkan schema identik.
  evidence: Ditemukan saat Build 1a 2026-09-20 (migrate dev menuntut reset karena history ≠ schema); utang pra-existing, sengaja dikecualikan dari file migrasi 1a demi scope discipline.

# Review 1a pass 1 — defer entries (2026-09-20)

- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
  summary: Migrasi rekonsiliasi drift schedule/prosem (f0be2d5) WAJIB land sebelum `migrate deploy` pertama ke env fresh/CI dan sebelum migrasi apa pun yang menyentuh tabel drift.
  evidence: Replay 19 file ≠ schema.prisma ≠ Neon (db push masa lalu); fresh env gagal senyap saat client hasil generate INSERT kolom hilang (dibuktikan insiden 2 suite merah 2026-09-20).
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
  summary: Gate verifikasi otomatis file migrasi (`migrate diff --from-migrations --to-schema --exit-code`) diaktifkan segera setelah rekonsiliasi drift lunas.
  evidence: VG1 pre-verified: menghapus baris migrasi tetap hijau di semua verifikasi 1a (test menyentuh Neon yang sudah dimigrasi, bukan file); gate hari ini merah karena drift pra-existing.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md`
  summary: Tambah task helper redaksi `redactMetadata()` + unit test ke spec 1c sebelum diimplementasi (penulis AuditLog pertama).
  evidence: BH6: konvensi "metadata bebas secret" tanpa enforcement DB (defer) maupun tooling; jendela Stories 3–5 menulis audit tanpa pengaman mekanis.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md`
  summary: Definisikan semantik penyusutan allowlist di spec 1c — minimal laporan drift ADMIN-not-in-allowlist tiap run; keputusan demosi eksplisit.
  evidence: BH7: seeder hanya promote; email yang dihapus dari SUPERADMIN_EMAILS tidak pernah didemosi.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md`
  summary: Verifikasi invariant "Better Auth selalu menyimpan email lowercase" ATAU pakai lookup insensitive di seeder; tambah baris matriks stored-mixed-case.
  evidence: BH8 maybe-false: bila DB menyimpan mixed-case, lookup normalized miss (laporan "tidak dikenal" palsu); disetel dengan membaca normalisasi email better-auth versi 1.6.29.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md`
  summary: Patok nilai fallback PIN_PEPPER dev/test sebagai konstanta deterministik + assert di test spec 1b.
  evidence: BH9: fallback acak per proses membuat hash run sebelumnya tak terverifikasi — login dev gagal misterius lintas restart.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md`
  summary: Tambah test integrasi seeder ke spec 1c: idempotensi (run 2× → 0 entri audit baru) + transaksi-rollback (email tak dikenal → nol row berubah).
  evidence: BH12: jaminan inti keamanan (all-or-nothing, idempotent) hanya diverifikasi manual via Verification commands.
- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
  summary: Proyeksikan kolom (select) di getStudents/updateStudent/archiveStudent SEBELUM Story 3 mengisi accessPinHash — jika tidak, hash PIN terkirim ke klien via server action.
  evidence: VG-other2: students.actions.ts:94 tanpa select; hari ini kolom null (aman), begitu terisi = kebocoran hash.
