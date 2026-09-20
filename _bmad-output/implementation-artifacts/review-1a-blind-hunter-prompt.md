Conduct a review of CONTENT.
Look for what's missing, not only what's wrong.
Compute your finding floor N from the diff file's size: N = min(floor(sqrt(kB) + 1), 10), where kB is the file's size in kilobytes. State the arithmetic in one line, then find at least N issues to fix or improve.
Output a Markdown list of findings only — no severity, priority, or ranking.
If the content is empty, stop and say so.
If you have zero findings, re-check and keep thinking; do not stop with an empty list.

CONTENT: the unified diff below (inlined — this session has no filesystem access to the original):

diff --git a/_bmad-output/specs/spec-student-portal-auth/.memlog.md b/_bmad-output/specs/spec-student-portal-auth/.memlog.md
index c5d9f58..5a96976 100644
--- a/_bmad-output/specs/spec-student-portal-auth/.memlog.md
+++ b/_bmad-output/specs/spec-student-portal-auth/.memlog.md
@@ -1,6 +1,6 @@
 ---
 topic: KLASSA Student Portal & Unified Auth (DEV STAGE 11)
-updated: 2026-09-19T18:59
+updated: 2026-09-20T14:26
 ---
 
 - (event) memlog initialized (hand-written fallback: `_bmad/scripts/memlog.py` absent from repo at the time; migrated to canonical script format 2026-09-19)
@@ -58,3 +58,6 @@ updated: 2026-09-19T18:59
 - (decision) Story 9 "AI Tutor & Gamifikasi (Gelombang 4)" (Tahap 9): done_checkpoint=true (penutup fase); catatan grounding ketat + go/no-go gamifikasi data-driven
 - (event) stories.yaml validity check: 9 entri parse lengkap (id/title/description); id "1"–"9" string ter-quote, unik, prefix-free; boolean checkpoint sesuai keputusan; invoke_dev_with string bebas; tidak ada field status — lolos aturan schema
 - (event) bmad setup installed _bmad/ (config + scripts) in repo; spec folder relocated from docs/specs/ to _bmad-output/specs/ (canonical {output_folder}); SPEC.md sources path corrected to ../../../docs/products/DEV_STAGE_11_STUDENT_PORTAL_AUTH.md; memlog migrated to canonical script format
+- (decision) Story 1 dipecah 3 arah (token-gate Build step-02, human-approved 2026-09-20): id 1 dipensiunkan; 1a schema+migrasi (spec_cp+done_cp diwarisi), 1b primitif PIN (paralel), 1c allowlist+seeder (butuh 1a); seluruh kontrak elicitation dipindah utuh ke 3 spec file; guard tetap defer ke Story 5
+- (event) stories.yaml re-derived: 10 story (1a,1b,1c,2..9); validity rules terpenuhi (id unik ter-quote, prefix-free, tanpa status)
+- (event) Story 1a implemented: schema +8/+3/+1 kolom + audit_log; migrasi student_portal_foundation (murni aditif) di-apply ke lokal klassa_dev (db execute) DAN Neon (db execute + migrate resolve, persetujuan human, direct URL); insiden drift schedule/prosem pra-existing terdokumentasi; 475/475 hijau, tsc bersih
diff --git a/_bmad-output/specs/spec-student-portal-auth/stories.yaml b/_bmad-output/specs/spec-student-portal-auth/stories.yaml
index b9e4b07..6d4f9c8 100644
--- a/_bmad-output/specs/spec-student-portal-auth/stories.yaml
+++ b/_bmad-output/specs/spec-student-portal-auth/stories.yaml
@@ -1,20 +1,42 @@
 # Derivasi Story Breakdown — spec-student-portal-auth
-# 9 story, 1:1 dengan tahap eksekusi blueprint. Urutan = urutan jalannya list.
-- id: "1"
-  title: Fondasi Database & Primitif Keamanan
+# 10 story — Tahap 1 dipecah 3 arah (1a/1b/1c, 2026-09-20); sisanya 1:1 dengan tahap. Urutan = urutan list.
+- id: "1a"
+  title: Fondasi Skema & Migrasi
   description: >-
-    Migrasi fondasi untuk seluruh spec (CAP-1…11): kolom Student (accessPinHash,
-    accountStatus, failedAttempts, lockedUntil, dst.), Class.joinCode,
-    User.platformRole, model AuditLog, seeder superadmin, dan util PIN scrypt.
-    Detail lingkup di execution-stages.md Tahap 1.
+    Migrasi aditif fondasi untuk seluruh spec (CAP-1…11): kolom akun Student,
+    kode join Class, User.platformRole, dan model AuditLog sesuai N1/N4.
+    Detail di stories/1a-schema-fondasi-migrasi.md.
   spec_checkpoint: true
   done_checkpoint: true
   invoke_dev_with: >-
-    N1: semua kolom migrasi baru nullable/ber-default; User.platformRole default
-    non-admin; nol drop/rename. N4: AuditLog minimal
-    actorType/actorId/action/targetType/targetId/metadata(Json)/ip/createdAt,
-    append-only tanpa jalur update/delete, index [actorId, createdAt] dan
-    [targetType, targetId]. Seeder superadmin hanya dari env allowlist.
+    N1: semua kolom nullable/ber-default, nol drop/rename. N4: AuditLog
+    append-only + index [actorId, createdAt] & [targetType, targetId];
+    metadata wajib bebas PIN/hash/secret. joinCode String? @unique. SQL hasil
+    wajib murni aditif; migrate dev hanya DB lokal (prod via migrate deploy);
+    bila shadow DB gagal pakai scripts/create-shadow-db.js, jangan db push.
+- id: "1b"
+  title: Primitif PIN Siswa (scrypt + pepper)
+  description: >-
+    Pure util hash/verify PIN 4-digit (CAP-1, primitif Story 3): scrypt
+    constant-time, pepper PIN_PEPPER, aturan memori maxmem. Nol dependensi
+    DB — paralel dengan 1a. Detail di stories/1b-primitif-pin.md.
+  invoke_dev_with: >-
+    Kontrak asimetris: hashPin throw PinFormatError pada input invalid,
+    verifyPin return false (termasuk hash korup / param > maxmem). Pepper
+    resolve saat module load, fail-fast production mirror getAuthSecret().
+    Larangan meniru preseden plaintext QuizStudentAccess.pin/classroomPin.
+    PIN_PEPPER wajib di env produksi sebelum deploy Story 3.
+- id: "1c"
+  title: Allowlist & Seeder Superadmin
+  description: >-
+    Jalur lahir superadmin satu-satunya (CAP-7): parser allowlist pure +
+    seeder idempotent all-or-nothing dengan AuditLog. Prasyarat: 1a merged.
+    Detail di stories/1c-allowlist-seeder-superadmin.md.
+  invoke_dev_with: >-
+    Validasi semua email dulu → satu transaksi all-or-nothing; cek
+    emailVerified (abort default, --allow-unverified sadar); --dry-run +
+    identitas DB target (host+dbname) selalu dicetak; normalisasi
+    trim+lowercase; tsx devDependency + npm script seed:superadmin.
 - id: "2"
   title: Gerbang Dedup Sekolah & Penguatan Alur Guru
   description: >-
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index 4eb1d7c..6a918d0 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -160,6 +160,7 @@ model User {
   image         String?
   createdAt     DateTime
   updatedAt     DateTime
+  platformRole  String    @default("USER") // DEV STAGE 11 — USER | ADMIN (superadmin, non-registrable)
   sessions      Session[]
   accounts      Account[]
 
@@ -272,6 +273,16 @@ model Student {
   createdAt                 DateTime     @default(now())
   updatedAt                 DateTime     @updatedAt
 
+  // DEV STAGE 11 — akun portal siswa (Story 1a)
+  accessPinHash String?  // hash scrypt+pepper — hanya diisi via hashPin (Story 1b)
+  accountStatus String   @default("PENDING") // PENDING | ACTIVE | REJECTED (glosarium §9.2)
+  pinUpdatedAt  DateTime?
+  lastLoginAt   DateTime?
+  failedAttempts Int      @default(0)
+  lockedUntil   DateTime?
+  approvedById  String?  // User.id — FK formal di Story 3/5
+  approvedAt    DateTime?
+
   classMemberships  ClassStudent[]
   attendanceRecords AttendanceRecord[]
   assessmentResults AssessmentResult[]
@@ -362,6 +373,12 @@ model Class {
   normalizedName   String?
   gradeLevel       String?
   status           EntityStatus      @default(ACTIVE)
+
+  // DEV STAGE 11 — kode join rombel (Story 1a)
+  joinCode          String?    @unique // banyak NULL diizinkan Postgres — join-by-code unik & terindeks
+  joinCodeLocked    Boolean    @default(false)
+  joinCodeUpdatedAt DateTime?
+
   teachingContexts TeachingContext[]
   classStudents    ClassStudent[]
 
@@ -897,6 +914,28 @@ model ImportSession {
   @@map("import_session")
 }
 
+// -------------------------------------------------
+// AUDIT LOG (DEV STAGE 11 — Story 1a, amendum N4)
+// Append-only: hanya jalur create (konvensi service-only-create);
+// penegakan DB-level (REVOKE/trigger) + retensi = utang amendum upstream.
+// -------------------------------------------------
+
+model AuditLog {
+  id         String   @id @default(cuid())
+  actorType  String // USER | SUPERADMIN | STUDENT | SYSTEM
+  actorId    String? // null untuk SYSTEM
+  action     String
+  targetType String
+  targetId   String? // null untuk aksi platform-wide
+  metadata   Json? // LARANGAN: PIN/hash/secret tidak boleh masuk sini
+  ip         String?
+  createdAt  DateTime @default(now())
+
+  @@index([actorId, createdAt])
+  @@index([targetType, targetId])
+  @@map("audit_log")
+}
+
 // -------------------------------------------------
 // QUIZ ONLINE SCHEMA (DEV STAGE 10)
 // -------------------------------------------------
diff --git a/prisma/migrations/20260920135945_student_portal_foundation/migration.sql b/prisma/migrations/20260920135945_student_portal_foundation/migration.sql
new file mode 100644
index 0000000..abecc34
--- /dev/null
+++ b/prisma/migrations/20260920135945_student_portal_foundation/migration.sql
@@ -0,0 +1,46 @@
+-- Story 1a — Fondasi Skema & Migrasi (DEV STAGE 11)
+-- Murni aditif (N1): ADD COLUMN / CREATE TABLE / CREATE INDEX — nol drop/rename.
+-- Di-generate via `prisma migrate diff --from-config-datasource --to-schema` terhadap DB lokal,
+-- lalu diekstrak subset scope 1a (perubahan schedule/prosem di luar scope = utang drift existing).
+
+-- AlterTable
+ALTER TABLE "class" ADD COLUMN     "joinCode" TEXT,
+ADD COLUMN     "joinCodeLocked" BOOLEAN NOT NULL DEFAULT false,
+ADD COLUMN     "joinCodeUpdatedAt" TIMESTAMP(3);
+
+-- AlterTable
+ALTER TABLE "student" ADD COLUMN     "accessPinHash" TEXT,
+ADD COLUMN     "accountStatus" TEXT NOT NULL DEFAULT 'PENDING',
+ADD COLUMN     "approvedAt" TIMESTAMP(3),
+ADD COLUMN     "approvedById" TEXT,
+ADD COLUMN     "failedAttempts" INTEGER NOT NULL DEFAULT 0,
+ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
+ADD COLUMN     "lockedUntil" TIMESTAMP(3),
+ADD COLUMN     "pinUpdatedAt" TIMESTAMP(3);
+
+-- AlterTable
+ALTER TABLE "user" ADD COLUMN     "platformRole" TEXT NOT NULL DEFAULT 'USER';
+
+-- CreateTable
+CREATE TABLE "audit_log" (
+    "id" TEXT NOT NULL,
+    "actorType" TEXT NOT NULL,
+    "actorId" TEXT,
+    "action" TEXT NOT NULL,
+    "targetType" TEXT NOT NULL,
+    "targetId" TEXT,
+    "metadata" JSONB,
+    "ip" TEXT,
+    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+
+    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateIndex
+CREATE INDEX "audit_log_actorId_createdAt_idx" ON "audit_log"("actorId", "createdAt");
+
+-- CreateIndex
+CREATE INDEX "audit_log_targetType_targetId_idx" ON "audit_log"("targetType", "targetId");
+
+-- CreateIndex
+CREATE UNIQUE INDEX "class_joinCode_key" ON "class"("joinCode");
diff --git a/_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md b/_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md
new file mode 100644
index 0000000..069f871
--- /dev/null
+++ b/_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md
@@ -0,0 +1,92 @@
+---
+title: 'Story 1a — Fondasi Skema & Migrasi'
+type: 'feature'
+created: '2026-09-20'
+status: 'in-review'
+route: 'full'
+review_loop_iteration: 0
+baseline_commit: 'a7b00936ff5d6b0f42dbf6a130f4e6fdab1d20db'
+context:
+  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/SPEC.md'
+  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/security-amendum.md'
+  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/execution-stages.md'
+---
+
+<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
+
+## Intent
+
+**Problem:** Tahap 3–5 (auth siswa, persetujuan, panel admin) membutuhkan kolom akun siswa, kode join rombel, peran platform, dan jejak audit — belum ada satu pun di schema.
+
+**Approach:** Migrasi skema **aditif murni**: +8 kolom akun di `Student`, +3 kolom kode join di `Class`, `User.platformRole`, dan model `AuditLog` baru. Hasil pecahan Story 1 (2026-09-20): primitif PIN → Story 1b, seeder superadmin → Story 1c.
+
+## Boundaries & Constraints
+
+**Always:**
+- N1: semua kolom baru nullable/ber-default; `User.platformRole` default `"USER"` (non-admin); **nol drop/rename** kolom existing.
+- N4: `AuditLog` field minimal `actorType, actorId, action, targetType, targetId, metadata(Json), ip, createdAt`; append-only — hanya jalur create; index `@@index([actorId, createdAt])` dan `@@index([targetType, targetId])`.
+- Nilai string kanonik: `accountStatus ∈ {PENDING, ACTIVE, REJECTED}` (default `PENDING`), `platformRole ∈ {USER, ADMIN}` — konsisten pola `String` existing (`AcademicPeriod.status`), glosarium §9.2.
+- Door criteria: `tsc` bersih + seluruh test lama (475 saat story ditulis) hijau.
+
+**Never:**
+- Tidak mengubah kolom existing / alur tabel Better Auth (`user`, `session`, `account`, `verification`) maupun alur auth guru. **Pengecualian disengaja (N1):** kolom aditif ber-default `User.platformRole` pada tabel `user` diizinkan — adapter Prisma Better Auth mengabaikan field asing.
+- Tidak drop/rename/kolom wajib baru pada tabel existing (migrasi destruktif dilarang).
+- Tidak menulis kode aplikasi (util/seeder = Story 1b/1c); tidak menambah limiter in-memory.
+
+</frozen-after-approval>
+
+## Code Map
+
+- `prisma/schema.prisma` — target edit: `Student` (:263, +8 kolom), `Class` (:357, +3 kolom), `User` (:155, +`platformRole`), model `AuditLog` baru. Enum `EntityStatus` (:26) jangan diubah.
+- `prisma/migrations/` — konvensi folder `YYYYMMDDHHMMSS_name`; hasilkan via `npx prisma migrate dev`; SQL hasil wajib murni aditif.
+- `scripts/create-shadow-db.js` — helper shadow DB existing (`localhost:51214`); jalankan hanya bila `migrate dev` gagal membuat shadow DB. File existing — jangan diubah; jangan improvise `db push`.
+- DB live tersedia (test suite 475 hijau mengonfirmasi koneksi pg); baseline `migrate status` up-to-date (18 migrasi).
+
+## Tasks & Acceptance
+
+**Execution:**
+- [x] `prisma/schema.prisma` — tambah kolom & model persis sesuai Design Notes (Schema) di bawah.
+- [x] Migrasi — `npx prisma migrate dev --name student_portal_foundation`; baca SQL hasil: nol drop/rename.
+
+**Acceptance Criteria:**
+- Given schema existing, when migrasi dijalankan, then SQL hanya `ADD COLUMN`/`CREATE TABLE`/`CREATE INDEX` (termasuk `CREATE UNIQUE INDEX` joinCode) dan `npx prisma validate` bersih.
+- Given model `AuditLog` dibuat, when story selesai, then schema valid & story ini tidak menulis service update/delete apa pun (client Prisma meng-expose update/delete by default — penegakan ada di service layer 1c/Story 3+; DB-level = utang amendum).
+
+## Implementation Notes
+
+- Baseline terverifikasi 2026-09-20: `tsc --noEmit` exit 0; `migrate status` up-to-date; line number Code Map eksak; `AcademicPeriod.status` String.
+- **Insiden migrasi & resolusi (2026-09-20, build session):**
+  1. `migrate dev` awal menuntut RESET DB — ternyata drift NYATA (bukan glitch pooler; koreksi diagnosis awal): `schema.prisma` memuat perubahan schedule/prosem (commit f0be2d5) yang TIDAK pernah punya file migrasi — masuk Neon via `db push` di masa lalu (history Neon ≠ schema Neon). RESET TIDAK dijalankan; nol data hilang.
+  2. Keputusan human: **lokal dulu** selama pengembangan. `prisma dev` (instance `default`, port 51214 sesuai konvensi tim) dihidupkan; `klassa_dev` dibuat; 18 file migrasi di-replay via `migrate deploy`.
+  3. Engine lokal TIDAK menyimpan `_prisma_migrations` (P3005) → engine hanya layak sebagai shadow/scratch, bukan target migrate. Workaround: SQL di-generate via `migrate diff --from-config-datasource --to-schema` lalu di-apply via `db execute`.
+  4. File migrasi dibuat berisi **hanya scope 1a** (backlog schedule/prosem = utang drift existing, DIKELUARKAN dari file; dicatat di deferred-work).
+  5. `prisma generate` (wajib door criteria) membuat client mengirim kolom baru di setiap INSERT → 2 suite integrasi gagal vs Neon (kolom belum ada). Engine lokal tak sanggup menampung test suite (08P01 + connection churn).
+  6. **Dengan persetujuan human eksplisit**, migrasi 1a (murni aditif, 0 drop/rename terverifikasi, prasyarat kolom-belum-ada dicek dulu) di-apply ke Neon via `db execute` (direct URL tanpa pooler) + `migrate resolve --applied` (bookkeeping rapi). Hasil: 475/475 hijau.
+- **Recipe dev lokal:** `npx prisma dev start default` (51214) → DATABASE_URL `postgres://postgres:postgres@localhost:51214/klassa_dev?sslmode=disable`. Catatan: engine lokal rapuh untuk test suite paralel — suite integrasi tetap ke Neon; solo suite lokal butuh `?pgbouncer=true`.
+
+## Spec Change Log
+
+- 2026-09-20 — Pecahan 3 arah Story 1 (Build step-02 token-gate, disetujui human): scope schema+migrasi menjadi story ini; primitif PIN → 1b, allowlist+seeder → 1c. Seluruh pengerasan elicitation dipindah utuh; sejarah lengkap: `1-fondasi-database-primitif-keamanan.elicitation-report.md` (file selevel).
+- 2026-09-20 — Elicitation 1a (5 metode konsolidasi: Critique & Refine · Map-Is-Not-Territory · First Principles · Failure Mode · Second-Order): `AuditLog` + `id String @id @default(cuid())` + `@@map("audit_log")` (tanpa ini schema invalid & tabel CamelCase menyendiri — F1/F2 kritis); AC#2 direword agar eksekutabel dalam scope; Verification + `prisma generate`. Fidelitas pecahan 1a/1b/1c terverifikasi utuh.
+
+## Review Triage Log
+
+## Design Notes
+
+**Schema (N1 — semua aditif):**
+- `Student` +8: `accessPinHash String?`, `accountStatus String @default("PENDING")`, `pinUpdatedAt DateTime?`, `lastLoginAt DateTime?`, `failedAttempts Int @default(0)`, `lockedUntil DateTime?`, `approvedById String?`, `approvedAt DateTime?`.
+- `Class` +3: `joinCode String? @unique` (Postgres mengizinkan banyak NULL; join-by-code Story 3/4 unik & terindeks sejak awal), `joinCodeLocked Boolean @default(false)`, `joinCodeUpdatedAt DateTime?`.
+- `User.platformRole String @default("USER")`. `approvedById` → `User.id` sebagai String lepas; FK formal di Story 3/5 (hindari migrasi relasional prematur).
+- `AuditLog`: `id String @id @default(cuid())` (wajib — Prisma menuntut PK; konsisten 30 model lain); `actorType` String ({USER, SUPERADMIN, STUDENT, SYSTEM}); `actorId/targetId/ip String?`; `metadata Json?`; `createdAt DateTime @default(now())`; index `[actorId, createdAt]` & `[targetType, targetId]` (N4); `@@map("audit_log")` (konsisten snake_case seluruh tabel — tanpa ini tabel jadi `"AuditLog"` CamelCase). Append-only ditegakkan konvensi service-only-create; penegakan DB-level (REVOKE/trigger) + retensi = utang amendum (keputusan upstream). Redaksi: PIN/hash/secret dilarang masuk `metadata`.
+
+## Verification
+
+**Commands:**
+- `npx tsc --noEmit` — exit 0.
+- `npm test` — seluruh test lama (475) hijau.
+- `npx prisma validate` — schema valid.
+- `npx prisma generate` — regen client agar kolom baru terlihat konsumen (1b/1c/Story 3+; idempotent).
+- `npx prisma migrate dev --name student_portal_foundation` — applied bersih tanpa warning data-loss. ⚠️ DB lokal saja; produksi hanya via `npx prisma migrate deploy`.
+
+**Manual checks:**
+- Baca SQL migrasi hasil: murni aditif; `CREATE UNIQUE INDEX` joinCode hadir.
diff --git a/_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md b/_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md
new file mode 100644
index 0000000..a0cf0be
--- /dev/null
+++ b/_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md
@@ -0,0 +1,90 @@
+---
+title: 'Story 1b — Primitif PIN Siswa (scrypt + pepper)'
+type: 'feature'
+created: '2026-09-20'
+status: 'draft'
+route: 'full'
+review_loop_iteration: 0
+context:
+  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/SPEC.md'
+  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/security-amendum.md'
+---
+
+<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
+
+## Intent
+
+**Problem:** Login siswa NIS+PIN (Story 3) membutuhkan primitif hash/verify yang tahan brute-force offline — PIN 4-digit pada dump DB dapat dipecahkan 10.000 kombinasi tanpa pepper (temuan elicitation R1).
+
+**Approach:** Pure util `src/lib/student-pin.ts`: validasi format, scrypt constant-time dengan pepper `PIN_PEPPER`, format hash self-describing, aturan memori tunggal. **Nol dependensi DB** — paralel dengan 1a. Hasil pecahan Story 1 (2026-09-20).
+
+## Boundaries & Constraints
+
+**Always:**
+- PIN memakai `node:crypto` scrypt; verifikasi constant-time (`timingSafeEqual`); format hash self-describing (params terenkode) agar parameter bisa dieskalasi tanpa rehash massal.
+- Kontrak asimetris: `hashPin` throw `PinFormatError` untuk input invalid (validasi dulu — defense in depth); `verifyPin` return `false` untuk input invalid (boolean hot-path login).
+- Door criteria: `tsc` bersih + seluruh test lama (475 saat story ditulis) hijau + test baru hijau.
+
+**Never:**
+- Tidak menyentuh DB/schema (1a), seeder (1c), `quiz.actions.ts`/`quiz.service.ts`, maupun alur auth guru.
+- Tidak meniru preseden plaintext `QuizStudentAccess.pin`/`Quiz.classroomPin` (utang amendum, di luar scope ini).
+- Tidak menambah limiter in-memory apa pun.
+
+## I/O & Edge-Case Matrix
+
+| Scenario | Input / State | Expected Output / Behavior | Error Handling |
+|----------|--------------|---------------------------|----------------|
+| PIN hash | PIN `"1234"` | string hash self-describing (salt+params terenkode) | — |
+| PIN verify benar | hash dari `"1234"`, input `"1234"` | `true` | — |
+| PIN verify salah | hash dari `"1234"`, input `"5678"` | `false` (timing seragam) | — |
+| PIN verify: input format invalid | hash valid dari `"1234"`, input `"56a8"` / `""` | `false` (bukan throw) — kontrak boolean hot-path login | — |
+| PIN format invalid | `"123"` / `"12a4"` / `""` | ditolak sebelum hashing | `PinFormatError` dengan pesan |
+| PIN format invalid (>4 digit) | `"12345"` / `"123456"` | ditolak sebelum hashing — kebijakan tepat 4 digit (`/^\d{4}$/`) | `PinFormatError` dengan pesan |
+| PIN verify: hash korup | `"not-a-hash"` / hash ber-param yang menuntut memori > `maxmem` | `false` tanpa throw/OOM | — |
+
+</frozen-after-approval>
+
+## Code Map
+
+- `src/lib/student-pin.ts` — file baru (pure util).
+- `src/lib/auth.ts` — **referensi pola, jangan diubah**: `getAuthSecret()` fail-fast (:53) — cermin pola resolve `PIN_PEPPER`.
+- `src/lib/__tests__/auth.security.test.ts` — referensi gaya vitest (`describe/it/expect`, folder `__tests__`).
+- `.env.example` — tambah `PIN_PEPPER` + komentar peringatan NODE_ENV; **jangan** sentuh entri lain.
+
+## Tasks & Acceptance
+
+**Execution:**
+- [ ] `src/lib/student-pin.ts` — `validatePinFormat` / `hashPin` / `verifyPin` sesuai kontrak Design Notes di bawah.
+- [ ] `.env.example` — dokumentasikan `PIN_PEPPER` + komentar peringatan NODE_ENV.
+- [ ] `src/lib/__tests__/student-pin.test.ts` — seluruh baris matriks I/O di atas (termasuk digit Unicode `"١٢٣٤"`/`"１２３４"` ditolak).
+
+**Acceptance Criteria:**
+- Given matriks PIN di atas, when test dijalankan, then semua baris lulus persis.
+- Given hash korup, param menuntut memori > `maxmem`, atau input kandidat format invalid, when `verifyPin` dipanggil, then return `false` tanpa throw.
+
+## Implementation Notes
+
+## Spec Change Log
+
+- 2026-09-20 — Pecahan 3 arah Story 1 (Build step-02 token-gate, disetujui human): scope primitif PIN menjadi story ini. Seluruh pengerasan elicitation dipindah utuh; sejarah lengkap: `1-fondasi-database-primitif-keamanan.elicitation-report.md` (file selevel).
+- 2026-09-20 — Elicitation 1b/1c (5 metode konsolidasi): opsi pengerasan pepper diperbaiki `NODE_ENV ∈ {development, test}` (vitest men-set test — tanpa ini opsi mematikan suite); kontrak async `crypto.scrypt` promisified (jangan `scryptSync` — blokir event loop ±50ms).
+
+## Review Triage Log
+
+## Design Notes
+
+- Format hash `scrypt:{N}:{r}:{p}:{saltHex}:{hashHex}` (self-describing — params terenkode, eskalasi tanpa rehash massal). Param default `N=16384, r=8, p=1, keyLen=32B, salt=16B`.
+- Aturan memori tunggal: `maxmem` eksplisit (mis. 64 MB); param yang menuntut `128×N×r` di atasnya ditolak saat parse; error scrypt apa pun saat verify → `false`. Pre-check panjang buffer sebelum `timingSafeEqual` (throw bila beda panjang).
+- API async: `crypto.scrypt` promisified (bukan `scryptSync`) — `N=16384` memblokir event loop ±50ms per panggilan; hot-path login Story 3 wajib non-blocking.
+- Format input: tepat 4 digit ASCII `/^\d{4}$/` (digit Unicode ditolak — kontrak test eksplisit).
+- Pepper: PIN di-HMAC `PIN_PEPPER` sebelum scrypt — dump DB saja tak cukup untuk brute-force offline. `PIN_PEPPER` resolve saat **module load** (fail-fast boot production, mirror `getAuthSecret()`; fallback dev-only) — bukan crash runtime di login pertama. Wajib di env produksi **sebelum deploy Story 3** (Story 1b tidak diimpor app mana pun — boot tetap aman sekarang). Rotasi membatalkan SEMUA hash: gratis sebelum produksi; pasca-produksi = re-issue PIN massal (opsi masa depan: versi pepper terenkode di format). Opsi pengerasan: fallback hanya aktif bila `NODE_ENV ∈ {development, test}` — vitest men-set `NODE_ENV=test`; tanpa pengecualian ini, opsi mematikan test suite.
+- Preseden berbahaya — JANGAN ditiru: `QuizStudentAccess.pin` & `Quiz.classroomPin` plaintext (di luar scope — Never; utang amendum). `accessPinHash` hanya via `hashPin`/`verifyPin`.
+
+## Verification
+
+**Commands:**
+- `npx tsc --noEmit` — exit 0.
+- `npm test` — seluruh test (lama + baru) hijau.
+
+**Manual checks (if no CLI):**
+- —
diff --git a/_bmad-output/specs/spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md b/_bmad-output/specs/spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md
new file mode 100644
index 0000000..d802c6b
--- /dev/null
+++ b/_bmad-output/specs/spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md
@@ -0,0 +1,102 @@
+---
+title: 'Story 1c — Allowlist & Seeder Superadmin'
+type: 'feature'
+created: '2026-09-20'
+status: 'draft'
+route: 'full'
+review_loop_iteration: 0
+context:
+  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/SPEC.md'
+  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/security-amendum.md'
+---
+
+<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
+
+## Intent
+
+**Problem:** Platform butuh backstop superadmin (reset password, ban, force approve — Story 5) tetapi tidak boleh ada jalur registrasi menjadi admin; registrasi Better Auth yang terbuka membuat email allowlist bisa diperebutkan (elicitasi RT1).
+
+**Approach:** Parser allowlist pure + seeder CLI idempotent dari env `SUPERADMIN_EMAILS`: validasi menyeluruh → transaksi all-or-nothing → `AuditLog` per aksi. **Prasyarat: Story 1a merged** (kolom `platformRole` + tabel `AuditLog`). Hasil pecahan Story 1 (2026-09-20).
+
+## Boundaries & Constraints
+
+**Always:**
+- Superadmin HANYA lahir dari env `SUPERADMIN_EMAILS` (allowlist, dipisah koma); idempotent (re-run aman); setiap aksi tercatat `AuditLog`.
+- Validasi semua email dulu → **all-or-nothing** dalam satu transaksi; email dinormalisasi (trim+lowercase) sebelum match (`@@unique([email])` Postgres case-sensitive).
+- Anti perebutan email: cek `emailVerified` — belum verified → abort default dengan profil user di laporan; `--allow-unverified` melewati secara sadar (repo belum mengonfigurasi email verification — semua user `emailVerified=false`).
+- Door criteria: `tsc` bersih + seluruh test lama (475 saat story ditulis) hijau + test baru hijau.
+
+**Never:**
+- Tidak mengubah schema (1a), primitif PIN (1b), `src/lib/auth.ts`, maupun alur auth guru.
+- Tidak menjalankan `migrate dev` ke produksi (hanya `prisma migrate deploy`); jangan `db push`.
+- Tidak menambah limiter in-memory apa pun.
+
+## I/O & Edge-Case Matrix
+
+| Scenario | Input / State | Expected Output / Behavior | Error Handling |
+|----------|--------------|---------------------------|----------------|
+| Seeder: allowlist berisi email user | `SUPERADMIN_EMAILS="a@b.c"` | `platformRole="ADMIN"` + entri `AuditLog` | — |
+| Seeder: env kosong/whitespace/unset | `SUPERADMIN_EMAILS=""` / undefined | exit non-zero, DB tak tersentuh | pesan fail-fast jelas |
+| Seeder: entri bukan email valid | `"not-an-email"` di allowlist | ditolak saat parse (sebelum DB disentuh), exit non-zero | daftar entri invalid dicetak |
+| Seeder: email tidak dikenal | email tanpa row `User` | validasi semua dulu → DB tak tersentuh (all-or-nothing), laporan lengkap di stdout, exit non-zero | daftar email gagal dicetak |
+| Seeder: email campuran case | `"Admin@Sekolah.ID"` vs DB `admin@sekolah.id` | dinormalisasi (trim+lowercase) sebelum match → ditemukan | — |
+| Seeder: email belum verified | user allowlist `emailVerified=false` | abort default + profil user di laporan (anti perebutan email); `--allow-unverified` melewati sadar | pesan eksplisit profil & opsi |
+
+</frozen-after-approval>
+
+## Code Map
+
+- `src/lib/superadmin-allowlist.ts` — file baru: parser pure `parseSuperadminEmails(env)`.
+- `scripts/seed-superadmin.ts` — file baru; jalankan via `npm run seed:superadmin`.
+- `package.json` — tambah `tsx` devDependency + script `"seed:superadmin": "tsx --env-file-if-exists=.env scripts/seed-superadmin.ts"` (tsx belum terpasang; tsx **tidak memuat `.env` otomatis** — repo tanpa dotenv; tanpa `--env-file-if-exists` seeder selalu fail-fast palsu).
+- `src/lib/auth.ts` — **referensi pola, jangan diubah**: pg Pool + `PrismaPg` (:5,:23), `PrismaClient` init (:27). Seeder mengikuti pola init client ini.
+- `src/lib/__tests__/auth.security.test.ts` — referensi gaya vitest.
+- `.env.example` — tambah blok `SUPERADMIN_EMAILS` dengan komentar; **jangan** sentuh entri lain (`PIN_PEPPER` milik 1b).
+
+## Tasks & Acceptance
+
+**Execution:**
+- [ ] `src/lib/superadmin-allowlist.ts` — parser pure sesuai Design Notes (Parser).
+- [ ] `scripts/seed-superadmin.ts` — sesuai Design Notes (Seeder).
+- [ ] `package.json` — `tsx` devDependency + script `seed:superadmin` (dengan `--env-file-if-exists=.env` — lihat Code Map).
+- [ ] `.env.example` — dokumentasikan `SUPERADMIN_EMAILS`.
+- [ ] `src/lib/__tests__/superadmin-allowlist.test.ts` — seluruh baris parser seeder pada matriks I/O (env kosong/whitespace/unset, duplikat, campuran case, koma ganda/`,,,`, entri non-email).
+
+**Acceptance Criteria:**
+- Given `SUPERADMIN_EMAILS` kosong/unset, when seeder dijalankan, then exit non-zero dan nol row berubah.
+- Given allowlist berisi email tak dikenal atau entri non-valid, when seeder dijalankan, then nol row berubah (all-or-nothing), exit non-zero, laporan lengkap.
+- Given email allowlist valid, when seeder dijalankan ulang, then idempotent (tanpa duplikat entri audit untuk state sama).
+
+## Implementation Notes
+
+## Spec Change Log
+
+- 2026-09-20 — Pecahan 3 arah Story 1 (Build step-02 token-gate, disetujui human): scope allowlist+seeder menjadi story ini. Seluruh pengerasan elicitation dipindah utuh; sejarah lengkap: `1-fondasi-database-primitif-keamanan.elicitation-report.md` (file selevel).
+- 2026-09-20 — Elicitation 1a (lintas story): koreksi typo frozen Never "`migrate migrate deploy`" → "`prisma migrate deploy`" (disetujui human).
+- 2026-09-20 — Elicitation 1b/1c (5 metode konsolidasi): script seeder → `tsx --env-file-if-exists=.env ...` (tsx tak memuat .env otomatis — repo tanpa dotenv; C1 kritis); shutdown eksplisit `pool.end()`/`process.exit` + audit hanya saat perubahan state.
+
+## Review Triage Log
+
+## Design Notes
+
+**Parser:**
+- `parseSuperadminEmails(env)`: trim, lowercase, dedupe, validasi sintaks email (entri invalid ditolak saat parse), deteksi kosong (termasuk unset dan `,,,`).
+
+**Seeder:**
+- Validasi semua email dulu → **all-or-nothing** dalam satu transaksi (pg Pool + PrismaPg ala `src/lib/auth.ts`); `AuditLog` per aksi (`actorType="SYSTEM"`, metadata bebas secret); idempotent.
+- Anti perebutan email (RT1): cek `emailVerified` + cetak profil user (nama, emailVerified, createdAt) di rencana — operator bisa konfirmasi pemilik sah.
+- `--dry-run` mencetak rencana tanpa menulis; output selalu mencantumkan identitas DB target (host+dbname) sebelum apply (blast-radius wrong-DB).
+- Shutdown eksplisit di akhir script: `await pool.end()` (+ `prisma.$disconnect()`) lalu `process.exit(code)` — Pool menjaga event loop hidup (script "selesai" tanpa exit → CI timeout). Audit hanya ditulis saat perubahan state nyata (no-op re-run = nol entri).
+- Jalur seeder hanya untuk DB lokal; produksi via `prisma migrate deploy`; bila shadow DB gagal → `scripts/create-shadow-db.js`; jangan `db push`.
+
+## Verification
+
+**Commands:**
+- `npx tsc --noEmit` — exit 0.
+- `npm test` — seluruh test (lama + baru) hijau.
+- `npm run seed:superadmin` (tanpa env) — fail-fast non-zero dengan pesan allowlist.
+- `npm run seed:superadmin -- --dry-run` (env valid) — rencana + identitas DB target, nol row berubah.
+- `npm run seed:superadmin` (env valid, 2×) — idempotent; run kedua tanpa entri audit baru. ⚠️ DB lokal saja.
+
+**Manual checks:**
+- Pasca-seeder: satu alur login guru; `platformRole="ADMIN"` tidak ter-reset oleh update user Better Auth.
diff --git a/_bmad-output/implementation-artifacts/deferred-work.md b/_bmad-output/implementation-artifacts/deferred-work.md
new file mode 100644
index 0000000..0cb7870
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/deferred-work.md
@@ -0,0 +1,14 @@
+# Deferred Work
+
+- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1-fondasi-database-primitif-keamanan.md`
+  summary: Guard `requireSuperAdmin()` + unit test-nya ditunda ke Story 5 (Panel Persetujuan Guru & Superadmin), membawa kontrak terkeras hasil elicitation — deny-by-default strict equality `platformRole === "ADMIN"` (nilai asing seperti `"MODERATOR"` tertolak, bukan `!== "USER"`), kontrak tanpa sesi → denied, satu jenis error tunggal `SuperAdminRequiredError` dengan pesan statis identik semua jalur (anti enumerasi), baca role via `session.user` dengan fallback `prisma.user.findUnique({ where: { id: session.userId } })`, tanpa mengubah `src/lib/auth.ts`.
+  evidence: Split token-gate Story 1 (spec >1600 token di Build step-02, disetujui human 2026-09-20); guard tidak punya konsumen hingga `/admin/*` dibangun di Story 5; detail lengkap di Spec Change Log Story 1 dan `1-fondasi-database-primitif-keamanan.elicitation-report.md` (Ronde 2 S7/S8, Ronde 5 RT3, Ronde 3 A15).
+- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
+  summary: Primitif PIN siswa (`student-pin.ts` + test + `PIN_PEPPER` env doc) dipecah menjadi Story 1b — pure util tanpa dependensi DB, kontrak elicitation utuh di `stories/1b-primitif-pin.md`.
+  evidence: Pecahan 3 arah Story 1 (token-gate Build step-02, disetujui human 2026-09-20); paralel dengan 1a, tidak memblokir.
+- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
+  summary: Allowlist parser + seeder superadmin (`superadmin-allowlist.ts`, `seed-superadmin.ts`, tsx + npm script, `SUPERADMIN_EMAILS` env) dipecah menjadi Story 1c — kontrak elicitation utuh di `stories/1c-allowlist-seeder-superadmin.md`.
+  evidence: Pecahan 3 arah Story 1 (token-gate Build step-02, disetujui human 2026-09-20); prasyarat 1a merged (kolom platformRole + tabel AuditLog).
+- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
+  summary: Rekonsiliasi drift Neon existing — perubahan schedule/prosem (commit f0be2d5: teaching_schedule, academic_plan_item, learning_objective, academic_context_profile, teaching_session.teachingScheduleId) ada di schema.prisma + Neon (via db push masa lalu) TAPI tidak punya file migrasi; perlu migrasi rekonsiliasi agar `migrate deploy`/fresh-local replay menghasilkan schema identik.
+  evidence: Ditemukan saat Build 1a 2026-09-20 (migrate dev menuntut reset karena history ≠ schema); utang pra-existing, sengaja dikecualikan dari file migrasi 1a demi scope discipline.
