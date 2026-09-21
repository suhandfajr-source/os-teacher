---
title: 'Rekonsiliasi Drift Migrasi Neon (schedule/prosem) + Gate Verifikasi'
type: 'chore'
created: '2026-09-20'
status: 'done'
baseline_commit: '2fbdf18ad0bc1a1628a981f2cc6c5fd3a59cfcd5'
route: 'full'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md'
  - '{project-root}/_bmad-output/implementation-artifacts/deferred-work.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Chain migrasi (19 file) ≠ `schema.prisma` — delta commit f0be2d5 (engine schedule/prosem: `TeachingSchedule`, enum `PlanItemCategory`, kolom `AcademicContextProfile`/`LearningObjective`/`AcademicPlanItem`, FK `TeachingSession.teachingScheduleId`) masuk Neon via `db push` masa lalu dan tidak pernah punya file migrasi; fresh replay menghasilkan schema rusak (insiden 2 suite merah 2026-09-20), dan `migrate deploy` ke env fresh/CI diharamkan hingga lunas.

**Approach:** Satu file migrasi rekonsiliasi berisi delta persis (digenerate `migrate diff --from-migrations --to-schema-datamodel` via shadow DB lokal, bukan tulisan tangan) → di Neon cukup `migrate resolve --applied` (delta sudah ada di sana) → gate verifikasi `migrate diff --exit-code` diaktifkan sebagai npm script.

## Boundaries & Constraints

**Always:**
- Isi file = output mentah `migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` (shadow DB prisma-dev lokal); dibaca manual sebelum commit: harus persis delta f0be2d5 — `CREATE TYPE "PlanItemCategory"`, `CREATE TABLE "teaching_schedule"` + index/FK, `ADD COLUMN` (teaching_session.teachingScheduleId, academic_context_profile ×3, learning_objective ×2, academic_plan_item ×4), `CREATE INDEX` baru, dan **satu-satunya drop yang sah**: index plan-item lama `[teachingContextId, orderIndex]` (dibuat stage_07 sebagai `DROP INDEX "academic_plan_item_teachingContextId_orderIndex_idx"`) diganti index baru `[teachingContextId, targetSemester, orderIndex]` (`CREATE INDEX "academic_plan_item_teachingContextId_targetSemester_order_idx"` / sesuai output diff CLI) — db push masa lalu sudah melakukannya di Neon.
- **Pre-flight status wajib**: `npx prisma migrate status` (via direct URL) harus melaporkan tepat 19 migrations applied dan 0 failed SEBELUM diff from-url atau resolve dijalankan.
- **Pra-resolve wajib**: bukti Neon == schema via `migrate diff --from-url <neon-direct> --to-schema-datamodel --script` = **kosong**. Bila tidak kosong → STOP, catat residue, lapor human (mengubah rencana: residue butuh `db execute`, bukan resolve saja).
- Neon: `migrate resolve --applied <nama-folder-rekonsiliasi>` tepat satu kali dengan **direct URL** (buang `-pooler` dari DATABASE_URL .env; kredensial dan parameter `sslmode=require` sama). Bukan via pooler.
- Urutan: baseline gate-run merah valid (exit 2) → file dibuat → verifikasi from-url kosong → resolve → gate dijalankan hijau (exit 0) → baru commit.
- Gate: `migrate diff --from-migrations --to-schema-datamodel --exit-code` (exit 0 = kosong/bersih; 2 = drift terdeteksi; 1 = error tooling/replay) dibungkus script Node lintas-platform yang menyiapkan shadow DB (start engine prisma-dev bila mati → recreate `shadow_db`) lalu bersih-bersih.

**Never:**
- `db execute` file rekonsiliasi ke Neon — delta sudah ada di sana; SQL gagal "already exists" + DROP INDEX index yang tak ada.
- `migrate dev` / `db push` terhadap Neon (kebijakan 1a; catat di SCL 1a bahwa larangan migrate dev dievaluasi ulang pasca-rekonsiliasi).
- Mengubah `schema.prisma` (nol delta schema — rekonsiliasi murni bookkeeping chain).
- Menyentuh data baris; menyentuh DB lain; menambah kolom/tabel baru apa pun.
- Menjalankan gate di CI/Vercel build (engine lokal tak tersedia di sana).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY: baseline gate run | engine lokal UP, belum ada file rekonsiliasi | exit 2 + diff tercetak persis delta f0be2d5 | exit 1 (tooling error) → perbaiki koneksi engine/shadow sebelum lanjut |
| HAPPY: generate SQL | engine lokal UP, shadow_db segar | SQL = delta f0be2d5 murni, tersimpan ke folder migrasi baru | Bukan delta f0be2d5 → STOP, lapor |
| HAPPY: pre-flight status | Neon via direct URL | 19 migrations applied, 0 failed | Failed migrations terdeteksi → STOP, bersihkan sebelum resolve |
| HAPPY: resolve Neon | from-url diff = kosong | `_prisma_migrations` Neon 20 baris; `migrate status` "up to date" | Pooler error → pastikan direct URL tanpa `-pooler` |
| Residue Neon terdeteksi | from-url diff ≠ kosong | HALT sebelum resolve; residue didokumentasikan, rencana dievaluasi | Human memutuskan langkah lanjut |
| Gate drift | chain ≠ schema | exit code 2 + ringkasan diff tercetak | Pesan jelas cara memperbaiki |
| Gate: replay/syntax error | dependensi chain rusak / tabel hilang | exit code 1 + pesan error tooling/replay | Pesan membedakan error replay vs drift |
| Gate: engine mati | port 51214 DOWN | script menyalakan `prisma dev start default` otomatis | Gagal start → error jelas, exit 1 |

</frozen-after-approval>

## Code Map

- `prisma/migrations/` — 19 folder existing; rekonsiliasi jadi folder #20 dengan nama eksplisit `20260921000000_reconcile_schedule_prosem_drift` (lexically sort > `20260920135945`).
- `prisma.config.ts` — datasource `DATABASE_URL`, `shadowDatabaseUrl` env `SHADOW_DATABASE_URL` (sudah ada).
- `scripts/create-shadow-db.js` — preseden drop+create `shadow_db` @ `postgres://postgres:postgres@localhost:51214` — logika diintegrasikan ke script gate.
- `.env` — `DATABASE_URL` = Neon **pooler**; direct URL = host sama tanpa `-pooler` suffix (satu variabel `NEON_DIRECT_URL` diturunkan untuk diff from-url, status, dan resolve).
- `package.json` — tempat npm script `verify:migrations` (memanggil `node scripts/verify-migrations.mjs`).
- Story 1a Implementation Notes — prosedur direct URL, db execute/resolve & state bookkeeping.
- `scripts/verify-migrations.mjs` — implementasi gate baru (auto-detect / auto-start engine, recreate shadow_db, jalankan diff CLI, map exit 0/1/2).

## Tasks & Acceptance

**Execution:**
- [x] `scripts/verify-migrations.mjs` + `package.json` — buat script gate verifikasi; jalankan **Step 0 Baseline Run** sebelum membuat file rekonsiliasi (harus exit 2 dengan diff == delta f0be2d5 murni, membuktikan gate aktif dan tidak inert).
- [x] `prisma/migrations/20260921000000_reconcile_schedule_prosem_drift/migration.sql` — generate via shadow diff, review manual vs delta f0be2d5 (memastikan tabel `teaching_schedule`, enum `PlanItemCategory`, kolom-kolom baru, dan swap index camelCase), commit message menandai rekonsiliasi.
- [x] Neon — pre-flight `migrate status` (19 applied / 0 failed) → verifikasi from-url kosong → `migrate resolve --applied 20260921000000_reconcile_schedule_prosem_drift` (direct URL) → post-flight `migrate status` = 20 migrasi up-to-date.
- [x] Gate pasca-rekonsiliasi — jalankan `npm run verify:migrations` → harus exit 0 (replay chain = schema.prisma identik).
- [x] `_bmad-output/implementation-artifacts/deferred-work.md` — settle entri "Rekonsiliasi drift Neon" (utama) + "Gate verifikasi otomatis" (aktif).
- [x] `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md` — catatan SCL: utang drift lunas, catat kebijakan gate verifikasi tim.

**Acceptance Criteria:**
- Given chain 20 file + schema.prisma, when `npm run verify:migrations`, then exit 0 ("replay = schema, no drift").
- Given file migrasi dihapus/dirusak satu baris, when gate dijalankan, then exit non-zero (exit 2 dengan ringkasan diff untuk drift; exit 1 untuk replay/tooling error) dengan pesan diagnostik yang membedakan jenis error.
- Given Neon pasca-resolve, when `npx prisma migrate status` (via direct URL), then 20 migrasi, "Database schema is up to date!".
- Given test suite aplikasi, when `npm test`, then full suite hijau (bukti non-regresi fungsional aplikasi; DDL rekonsiliasi tidak mengubah app code).

## Implementation Notes

- **Direct URL Neon**: Diturunkan dari `DATABASE_URL` di `.env` dengan menghapus substring `-pooler` dari hostname. Seluruh operasi DDL dan bookkeeping (`migrate diff --from-config-datasource`, `migrate resolve`, `migrate status`) menggunakan direct URL ini (`ep-wispy-meadow-b3lmlza4.c-4.ap-southeast-1.aws.neon.tech`).
- **Step 0 Baseline Run**: Dieksekusi via `npm run verify:migrations` sebelum file rekonsiliasi dibuat. Hasil: exit 2 terdeteksi drift persis delta f0be2d5 (membuktikan gate aktif dan bukan no-op).
- **Generasi Migrasi Rekonsiliasi**: `prisma/migrations/20260921000000_reconcile_schedule_prosem_drift/migration.sql` digenerate dari `migrate diff --from-migrations --to-schema` via shadow database lokal port 51214. DDL reviewed: tabel `teaching_schedule`, enum `PlanItemCategory`, penambahan kolom, dan swap index `academic_plan_item` (camelCase + `_idx`).
- **Verifikasi Pra-resolve & Resolve Neon**:
  - Pre-flight `migrate status`: 19 applied, 0 failed, 1 unapplied (reconciliation file).
  - Verifikasi schema vs database: `migrate diff --from-config-datasource --to-schema` menghasilkan `-- This is an empty migration.` (0 DDL residue; membuktikan database Neon sudah berada pada schema target).
  - Eksekusi `migrate resolve --applied 20260921000000_reconcile_schedule_prosem_drift` sukses via direct URL.
  - Post-flight `migrate status`: 20 migrations found, "Database schema is up to date!".
- **Verifikasi Akhir**:
  - `npm run verify:migrations`: exit 0 ("Migration chain matches schema.prisma perfectly. No drift detected.").
  - `npx tsc --noEmit`: exit 0.
  - `npm test`: 48 test files, 569/569 tests passed.

## Spec Change Log

- 2026-09-20 — **Elicitation Refinement (Pre-mortem, Assumption Audit, Boundary Sweep)**:
  - **[F1 HIGH]** Mengoreksi kriteria review frozen: nama index lama dari chain `stage_07` adalah `academic_plan_item_teachingContextId_orderIndex_idx` (camelCase + `_idx`), bukan snake_case + `_key`.
  - **[F2 MEDIUM]** Menambahkan syarat wajib Pre-flight `migrate status` (19 applied / 0 failed) sebelum resolve.
  - **[F3 MEDIUM]** Menambahkan Step 0: Baseline gate run sebelum generate file rekonsiliasi untuk membuktikan gate aktif dan memisahkan error tooling dari drift nyata.
  - **[F5 LOW-MED]** Memperjelas pemetaan exit code gate: exit 0 = bersih, exit 2 = drift schema/chain, exit 1 = error replay/engine tooling.
  - **[F6-F8, F13 LOW]** Spesifikasi script gate diperkuat (in-memory shadow URL, derivasi direct URL, idempotensi resolve, penamaan folder eksplisit `20260921000000_...`).

## Review Triage Log

| ID | Severity | Finding & Action Taken | Disposition |
|----|----------|------------------------|-------------|
| F1 | HIGH | Typo nama index di kriteria review frozen → dikoreksi ke `academic_plan_item_teachingContextId_orderIndex_idx`. | Applied |
| F2 | MEDIUM | Tidak ada pre-flight `migrate status` → ditambahkan syarat wajib 19 applied/0 failed di Always. | Applied |
| F3 | MEDIUM | Tidak ada baseline gate run → ditambahkan Step 0 di Tasks & Matrix. | Applied |
| F4 | MEDIUM | Gate verifikasi butuh kepastian dijalankan → dicatat kebijakan tim di SCL & deferred settlement. | Applied |
| F5 | LOW-MED | Acceptance #2 ekspektasi exit code diperjelas (exit 2 vs exit 1). | Applied |
| F6-F8, F13 | LOW | Hardening script gate (in-memory shadow URL, direct URL, single resolve). | Applied |

## Design Notes

- Source SQL authoritative = diff CLI, bukan rekonstruksi manual dari git — mencegah typo & ordering hazard (mis. enum sebelum tabel, FK setelah tabel). Diff git f0be2d5 hanya alat review silang.
- `DROP INDEX` di file aman untuk fresh replay (index lama memang ada di hasil replay 19 file) dan NO-OP untuk Neon karena `resolve --applied` tidak mengeksekusi apa pun.
- Lokal `klassa_dev` dibiarkan scratch (engine tak persist `_prisma_migrations`, P3005) — bukti integritas chain cukup dari replay shadow di gate; jangan habiskan sesi membangun ulang DB lokal.
- Gate script menyalakan engine sendiri (`npx prisma dev start default`, port 51214) — pengguna tak perlu ingat urutan manual.

## Verification

**Commands:**
- `npm run verify:migrations` -- expected: exit 0, "replay = schema, no drift".
- `npx prisma migrate status` -- expected: 20 migrations, up to date.
- `npx tsc --noEmit` -- expected: exit 0.
- `npm test` -- expected: full suite hijau.
