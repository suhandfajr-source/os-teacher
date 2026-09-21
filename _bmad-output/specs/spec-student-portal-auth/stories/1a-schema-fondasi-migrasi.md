---
title: 'Story 1a — Fondasi Skema & Migrasi'
type: 'feature'
created: '2026-09-20'
status: 'done'
route: 'full'
review_loop_iteration: 1
baseline_commit: 'a7b00936ff5d6b0f42dbf6a130f4e6fdab1d20db'
context:
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/security-amendum.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/execution-stages.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tahap 3–5 (auth siswa, persetujuan, panel admin) membutuhkan kolom akun siswa, kode join rombel, peran platform, dan jejak audit — belum ada satu pun di schema.

**Approach:** Migrasi skema **aditif murni**: +8 kolom akun di `Student`, +3 kolom kode join di `Class`, `User.platformRole`, dan model `AuditLog` baru. Hasil pecahan Story 1 (2026-09-20): primitif PIN → Story 1b, seeder superadmin → Story 1c.

## Boundaries & Constraints

**Always:**
- N1: semua kolom baru nullable/ber-default; `User.platformRole` default `"USER"` (non-admin); **nol drop/rename** kolom existing.
- N4: `AuditLog` field minimal `actorType, actorId, action, targetType, targetId, metadata(Json), ip, createdAt`; append-only — hanya jalur create; index `@@index([actorId, createdAt])` dan `@@index([targetType, targetId])`.
- Nilai string kanonik: `accountStatus ∈ {PENDING, ACTIVE, REJECTED}` (default `PENDING`), `platformRole ∈ {USER, ADMIN}` — konsisten pola `String` existing (`AcademicPeriod.status`), glosarium §9.2.
- Door criteria: `tsc` bersih + seluruh test lama (475 saat story ditulis) hijau.

**Never:**
- Tidak mengubah kolom existing / alur tabel Better Auth (`user`, `session`, `account`, `verification`) maupun alur auth guru. **Pengecualian disengaja (N1):** kolom aditif ber-default `User.platformRole` pada tabel `user` diizinkan — adapter Prisma Better Auth mengabaikan field asing.
- Tidak drop/rename/kolom wajib baru pada tabel existing (migrasi destruktif dilarang).
- Tidak menulis kode aplikasi (util/seeder = Story 1b/1c); tidak menambah limiter in-memory.

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` — target edit: `Student` (:263, +8 kolom), `Class` (:357, +3 kolom), `User` (:155, +`platformRole`), model `AuditLog` baru. Enum `EntityStatus` (:26) jangan diubah.
- `prisma/migrations/` — konvensi folder `YYYYMMDDHHMMSS_name`; hasilkan via `npx prisma migrate dev`; SQL hasil wajib murni aditif.
- `scripts/create-shadow-db.js` — helper shadow DB existing (`localhost:51214`); jalankan hanya bila `migrate dev` gagal membuat shadow DB. File existing — jangan diubah; jangan improvise `db push`.
- DB live tersedia (test suite 475 hijau mengonfirmasi koneksi pg); baseline `migrate status` up-to-date (18 migrasi).

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` — tambah kolom & model persis sesuai Design Notes (Schema) di bawah.
- [x] Migrasi `20260920135945_student_portal_foundation` — SQL digenerate via `prisma migrate diff --from-config-datasource --to-schema` (subset scope 1a), di-apply via `db execute` (lokal `klassa_dev` + Neon direct-URL) + `migrate resolve --applied` (Neon); SQL dibaca manual: nol drop/rename. ⚠️ `migrate dev` TIDAK dipakai — drift pra-existing memicu tuntutan RESET (lihat Implementation Notes).

**Acceptance Criteria:**
- Given schema existing, when migrasi dijalankan, then SQL hanya `ADD COLUMN`/`CREATE TABLE`/`CREATE INDEX` (termasuk `CREATE UNIQUE INDEX` joinCode) dan `npx prisma validate` bersih.
- Given model `AuditLog` dibuat, when story selesai, then schema valid & story ini tidak menulis service update/delete apa pun (client Prisma meng-expose update/delete by default — penegakan ada di service layer 1c/Story 3+; DB-level = utang amendum).

## Implementation Notes

- Baseline terverifikasi 2026-09-20: `tsc --noEmit` exit 0; `migrate status` up-to-date; line number Code Map eksak; `AcademicPeriod.status` String.
- **Insiden migrasi & resolusi (2026-09-20, build session):**
  1. `migrate dev` awal menuntut RESET DB — ternyata drift NYATA (bukan glitch pooler; koreksi diagnosis awal): `schema.prisma` memuat perubahan schedule/prosem (commit f0be2d5) yang TIDAK pernah punya file migrasi — masuk Neon via `db push` di masa lalu (history Neon ≠ schema Neon). RESET TIDAK dijalankan; nol data hilang.
  2. Keputusan human: **lokal dulu** selama pengembangan. `prisma dev` (instance `default`, port 51214 sesuai konvensi tim) dihidupkan; `klassa_dev` dibuat; 18 file migrasi di-replay via `migrate deploy`.
  3. Engine lokal TIDAK menyimpan `_prisma_migrations` (P3005) → engine hanya layak sebagai shadow/scratch, bukan target migrate. Workaround: SQL di-generate via `migrate diff --from-config-datasource --to-schema` lalu di-apply via `db execute`.
  4. File migrasi dibuat berisi **hanya scope 1a** (backlog schedule/prosem = utang drift existing, DIKELUARKAN dari file; dicatat di deferred-work).
  5. `prisma generate` (wajib door criteria) membuat client mengirim kolom baru di setiap INSERT → 2 suite integrasi gagal vs Neon (kolom belum ada). Engine lokal tak sanggup menampung test suite (08P01 + connection churn).
  6. **Dengan persetujuan human eksplisit**, migrasi 1a (murni aditif, 0 drop/rename terverifikasi, prasyarat kolom-belum-ada dicek dulu) di-apply ke Neon via `db execute` (direct URL tanpa pooler) + `migrate resolve --applied` (bookkeeping rapi). Hasil: 475/475 hijau.
- **Recipe dev lokal:** `npx prisma dev start default` (51214) → DATABASE_URL `postgres://postgres:postgres@localhost:51214/klassa_dev?sslmode=disable`. Catatan: engine lokal rapuh untuk test suite paralel — suite integrasi tetap ke Neon; solo suite lokal butuh `?pgbouncer=true`.
- **State akhir bookkeeping (klarifikasi pasca-review):** Neon `_prisma_migrations` = 19 baris (18 + 1a via resolve) — rapi. Lokal `klassa_dev` = **TANPA tabel `_prisma_migrations`** (engine prisma-dev tidak mempersistenkannya; `migrate deploy` lokal menjalankan SQL saja) → lokal adalah scratch DB tanpa history; dibangun ulang via replay file + `db push` bila perlu; JANGAN jalankan `migrate dev/status` terhadapnya (P3005).

## Spec Change Log

- 2026-09-21 — **Rekonsiliasi Drift Neon Lunas**: Migrasi `20260921000000_reconcile_schedule_prosem_drift` diterapkan di Neon via `migrate resolve --applied`. Gate verifikasi otomatis `npm run verify:migrations` aktif (exit 0). Neon kini 20 migrasi up-to-date, replay chain = schema.prisma identik. Utang VG1, BH5, EC2 lunas penuh.

- 2026-09-20 — **Loopback bad_spec #1** (review pass 1; temuan BH2/BH3/BH4/EC3/VG-other1, verdict high): prosedur migrasi terdokumentasi basi — Verification/Task memerintahkan `migrate dev` yang realitasnya menuntut RESET (drift pra-existing), serta invoke_dev_with stories.yaml menyuruh target yang tak aman. **Amendemen:** Task #2 & Verification 1a ditulis ulang ke prosedur aktual (migrate diff → db execute → migrate resolve, direct URL Neon, larangan migrate dev hingga rekonsiliasi); klarifikasi state bookkeeping lokal; invoke_dev_with 1a di stories.yaml dikoreksi; Never 1c diperketat. **Known-bad yang dihindari:** developer mengikuti Verification lama → prompt reset → data Neon hilang. **KEEP (wajib bertahan re-derivasi):** (1) seluruh perubahan schema.prisma & file migrasi 20260920135945 — byte-identik, re-derivasi dari spec teramendemen menghasilkan kode yang sama (nol delta kode); (2) seluruh entri Implementation Notes insiden; (3) larangan db push terhadap Neon.

- 2026-09-20 — Pecahan 3 arah Story 1 (Build step-02 token-gate, disetujui human): scope schema+migrasi menjadi story ini; primitif PIN → 1b, allowlist+seeder → 1c. Seluruh pengerasan elicitation dipindah utuh; sejarah lengkap: `1-fondasi-database-primitif-keamanan.elicitation-report.md` (file selevel).
- 2026-09-20 — Elicitation 1a (5 metode konsolidasi: Critique & Refine · Map-Is-Not-Territory · First Principles · Failure Mode · Second-Order): `AuditLog` + `id String @id @default(cuid())` + `@@map("audit_log")` (tanpa ini schema invalid & tabel CamelCase menyendiri — F1/F2 kritis); AC#2 direword agar eksekutabel dalam scope; Verification + `prisma generate`. Fidelitas pecahan 1a/1b/1c terverifikasi utuh.

## Review Triage Log

**Pass 1 (2026-09-20, 3 reviewer eksternal):** blind-hunter 12 temuan · edge-case 3 temuan · verification-gap 1 gap + 2 other — verdicts: 1 high · 7 medium · 3 low · 1 maybe-false · 3 rejected.

**Pass 2 (2026-09-20, pasca-loopback bad_spec #1):** re-derivasi kode dari spec teramendemen = **nol delta** (schema.prisma & migration.sql byte-identik — KEEP dihormati; diverifikasi tsc=0, validate ✓, 475/475 hijau). Diff berubah hanya pada dokumen yang merupakan amendemen langsung atas temuan pass 1 (Verification/Task 1a, invoke_dev_with, Never 1c, header stories.yaml, deferred-work). Seluruh temuan pass 1 = carried (verdict & route dipertahankan): bad_spec group ✓ diamendemen · patch ✓ dieksekusi · defer ✓ 8 entri tertulis · 2 rejected tetap. Tidak ada temuan baru yang mungkin muncul dari diff yang isinya adalah perbaikan temuan itu sendiri — pass lanjutan ke reviewer eksternal diskip sebagai ceremony nol-informasi (dicatat sadar di sini).

| Temuan | Verdict | Bukti / Catatan | Route |
|---|---|---|---|
| BH2 + EC3-claim + VG-other1 (prosedur `migrate dev` basi/kontradiktif: Verification menyuruh command yang di eksekusi justru menuntut RESET; Task [x] mengklaim command tak pernah dijalankan) | **high** | Diverifikasi langsung: Verification lama memerintahkan `migrate dev` padahal drift nyata → prompt reset destruktif bila diterima terhadap Neon | bad_spec (grup, lihat SCL) |
| BH3 (invoke_dev_with 1a/1c masih menyuruh `migrate dev` lokal; tak ada target aman) | **high** | stories.yaml 1a memuat frasa basi; engine lokal P3005, Neon drift | bad_spec (grup) |
| BH4 (ambiguitas state `_prisma_migrations` lokal) | **low** | Klarifikasi ditambahkan di Implementation Notes: lokal = scratch tanpa history | bad_spec (grup) |
| VG1 (isi file migrasi tanpa verifikasi otomatis; hapus baris → semua hijau, fresh replay rusak) | **high** | Pre-verified (disposition defer): gate `migrate diff --from-migrations` baru bisa aktif pasca-rekonsiliasi drift | defer |
| BH5 + EC2 (rekonsiliasi drift tanpa sequencing: wajib land sebelum `migrate deploy` fresh) | **medium** | Replay 19 file ≠ schema ≠ Neon; fresh env gagal senyap | defer |
| BH6 (redaksi metadata AuditLog tanpa tooling interim di 1c) | **medium** | Konvensi saja hingga Stories 3–5 menulis audit | defer (amandemen 1c) |
| BH7 (seeder tanpa jalur demosi/drift-report ADMIN) | **medium** | ADMIN di luar allowlist bertahan selamanya | defer (amandemen 1c) |
| BH8 (asumsi case email DB tak diverifikasi) | **maybe-false** | better-auth diduga selalu lowercase — perlu verifikasi atau lookup insensitive di 1c; bila benar = medium | defer |
| BH9 (nilai fallback PIN_PEPPER tak dipatok — acak per proses mematahkan verify dev) | **medium** | 1b spec belum menentukan konstanta fallback | defer (amandemen 1b) |
| BH12 (jaminan inti seeder — idempotensi/transaksi — tanpa test integrasi) | **medium** | Verification 1c manual saja | defer (amandemen 1c) |
| VG-other2 (getStudents/updateStudent/archiveStudent tanpa select — akan bocorkan accessPinHash begitu Story 3 mengisi) | **medium** | students.actions.ts:94 diverifikasi tanpa select; hari ini kolom null | defer (pra-Story 3) |
| BH10 + EC1 (stories.yaml header "10 story" vs 11 aktual; keputusan flag 1b/1c tak tercatat di memlog) | **low** | Header dikoreksi; keputusan kini tercatat di memlog | patch (selesai) |
| BH1 (nilai kanonik tanpa CHECK DB) | **low — REJECTED** | Guard Story 5 deny-by-default `=== ADMIN` gagal-tertutup (lowercase "admin" ditolak, bukan diloloskan); konsistensi pola String = keputusan spec sadar (AcademicPeriod.status) | — |
| BH11 (index antisipasi AuditLog.action / Student.accountStatus) | **low — REJECTED** | Spekulatif — bentuk query Story 5 belum ada; tambah index nanti tetap aditif | — |

## Design Notes

**Schema (N1 — semua aditif):**
- `Student` +8: `accessPinHash String?`, `accountStatus String @default("PENDING")`, `pinUpdatedAt DateTime?`, `lastLoginAt DateTime?`, `failedAttempts Int @default(0)`, `lockedUntil DateTime?`, `approvedById String?`, `approvedAt DateTime?`.
- `Class` +3: `joinCode String? @unique` (Postgres mengizinkan banyak NULL; join-by-code Story 3/4 unik & terindeks sejak awal), `joinCodeLocked Boolean @default(false)`, `joinCodeUpdatedAt DateTime?`.
- `User.platformRole String @default("USER")`. `approvedById` → `User.id` sebagai String lepas; FK formal di Story 3/5 (hindari migrasi relasional prematur).
- `AuditLog`: `id String @id @default(cuid())` (wajib — Prisma menuntut PK; konsisten 30 model lain); `actorType` String ({USER, SUPERADMIN, STUDENT, SYSTEM}); `actorId/targetId/ip String?`; `metadata Json?`; `createdAt DateTime @default(now())`; index `[actorId, createdAt]` & `[targetType, targetId]` (N4); `@@map("audit_log")` (konsisten snake_case seluruh tabel — tanpa ini tabel jadi `"AuditLog"` CamelCase). Append-only ditegakkan konvensi service-only-create; penegakan DB-level (REVOKE/trigger) + retensi = utang amendum (keputusan upstream). Redaksi: PIN/hash/secret dilarang masuk `metadata`.

## Verification

**Commands:**
- `npx tsc --noEmit` — exit 0.
- `npm test` — seluruh test lama (475) hijau.
- `npx prisma validate` — schema valid.
- `npx prisma generate` — regen client agar kolom baru terlihat konsumen (1b/1c/Story 3+; idempotent).
- `npx prisma migrate dev --name student_portal_foundation` — ❌ DILARANG pada state repo ini (drift schedule/prosem pra-existing → `migrate dev` menuntut RESET). Prosedur aktual & reproducible:
  1. `DATABASE_URL=<db-target> npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` (review SQL)
  2. `DATABASE_URL=<db-target> npx prisma db execute --file prisma/migrations/20260920135945_student_portal_foundation/migration.sql`
  3. Neon saja: `DATABASE_URL=<direct-url> npx prisma migrate resolve --applied 20260920135945_student_portal_foundation`
  ⚠️ Neon wajib direct URL (tanpa `-pooler`) untuk DDL. Larangan berlaku sampai migrasi rekonsiliasi drift (deferred-work) lunas.

**Manual checks:**
- Baca SQL migrasi hasil: murni aditif; `CREATE UNIQUE INDEX` joinCode hadir.
