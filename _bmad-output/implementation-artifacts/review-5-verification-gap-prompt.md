# Verification Gap Review

**Goal:** Find changed behavior that could break without reliable verification catching it. Ask one question — "if the behavior this change is supposed to produce broke where it's actually used, would verification fail?" Do not hunt for correctness bugs, but report genuine problems you notice while tracing verification.

The main verification gap shapes are:

1. **Regression gap:** the changed code regresses where it's used, and no test covering that use would fail.
2. **Missing-adoption gap:** a place that should now use the new behavior doesn't; it handles the same case its own way, or not at all, and no test would flag the omission.
3. **Broken-verification gap:** a test appears to cover the changed behavior, but would not actually protect it because it is skipped, flaky, not run in the normal verification path, or too weak to observe the regression.

## Evidence Rules

- Read a test before claiming what it covers, runs, asserts, or misses.
- Before claiming no test exists, search the whole repo by the symbol under test and by import references; expected file locations are not enough.
- Never assert what you did not verify. If a finding cannot be grounded, drop it.
- In a finding, say what you actually checked — "none of the tests I read cover this" — and show how far you looked. Say a test doesn't exist anywhere only when the symbol/import-reference search actually shows that.
- Do not assign severity, confidence, priority, or ranking.

## Review Sequence

### Step 1: Screen for behavioral change

Screen each part of the change separately. If a part is non-behavioral, skip it. Call a part non-behavioral only when the changed code does not alter return values, thrown errors, caller-visible side effects, or observable state (including iteration order and emitted messages). Once a part meets that test, move on; do not inspect callers or tests for extra confirmation.

Common non-behavioral examples: formatting, comments, whitespace; pure renames; trivial getters/setters and pass-throughs; type-only or compiler-enforced changes with no runtime effect; etc.

Only outcomes produced by deterministic code are worth automatically testing; tests are useless on static source text and brittle on LLM output. Skip those parts.

If every part is skipped, output the clean result (see Output Format).

### Step 2: Find the behavior that changed

Identify what behavior changed compared to the previous version: output, side effect, branch, error path, schema/event shape, config default, validation/authorization rule, external contract, etc. If the change affects more than one behavior, handle each separately.

Treat broad-impact changes as behavioral even when no single changed line looks important: dependency, toolchain, build/config, data-file, etc.

### Step 3: Trace where that behavior is used

Trace the changed behavior to the places that observe it. Start with direct callers and registered entry points (routes, commands, DI), contract consumers (schemas, events, APIs, database readers), and reverse-dependency info if already available.

Follow a path only while the changed behavior is reachable and unverified. Stop when a test at that boundary would fail, the consumer does not observe the changed behavior, or the next hop is guesswork (dynamic dispatch, reflection, outside-repo consumers, etc.). Prefer the nearest observable boundary, often one to three hops away, especially across contract, integration, or service edges. If there are more than five similar consumers, group obvious repeats and check representative paths; expand only when a consumer observes the behavior differently.

### Step 4: Qualify the consumer, then check its test

For each consumer, name the smallest realistic regression this consumer would observe: invert the branch, drop the default, omit the field, return the old error code, skip the integration call, etc. This is the Demonstration. If no such regression exists, drop the path; untested downstream code is not a finding.

A `Missing-adoption gap` qualifies not by the adoption failure alone but by a supersession signal: the change gives clear evidence the new behavior is meant to replace the local one — PR intent, naming or docs, a replaced sibling site, deleted duplicate logic, or a test defining the new rule — and the local site shares the same observable contract. Without a supersession signal and a shared observable contract, it is a refactor suggestion, not a verification-gap finding. Once both hold, check whether any test for that site would flag the non-adoption; missing coverage of the non-adoption is the gap itself, not a disqualifier.

Find and read the relevant test. Ask whether the Demonstration would make an assertion fail.

- If yes, the behavior is verified. No finding.
- For a regression-style Demonstration: if no test runs the path, the test is skipped/flaky/not run normally, or the test runs the code without checking the changed result, report a `Regression gap` or `Broken-verification gap`.
- For a qualifying Missing-adoption case: if none of the site tests you found assert it adopts the new behavior, report a `Missing-adoption gap`.

A test counts only if it runs normally and an assertion observes the changed output, branch, or contract. These do not count: no execution; source-text assertions that match a file's wording instead of running it; success/no-throw/snapshot-only checks; mock/log-call checks; human-only checks; tests that mock away the integration; e2e tests that pass through without checking the changed output; stale assertions or fixtures.

For example, `expect(x ?? DEFAULT).toBe(DEFAULT)` passes when `x` is missing.

Common patterns:

- **Caller-path gap** — helper test covers the branch, but caller values skip it.
- **Contract drift** — payload/schema/event changes must be verified at the consumer.
- **Migration compatibility** — tests only create new-format rows or fresh schemas.
- **Phantom exception** — handled partial-failure path has no test.
- **Missing-adoption gap** — sibling site should use the new rule/helper and does not.
- **Removed verification** — deleted test or weakened assertion leaves behavior unpinned; removing a source-text assertion is not this, since it never counted.

### Step 5: Confirm each finding is real

Before writing a finding, re-open the specific tests or search results the finding relies on. Verify the Demonstration would not make any test you checked fail, or that the absence claim is backed by the symbol/import-reference search. Do not claim more than you verified; drop any finding you cannot ground.

Explain why the test misses the bug using what the test sets up and checks.

Do not report: compiler/type-checker-enforced cases; behavior already verified by an integration, contract, or e2e test; implementation-detail or mock-only tests; low coverage or a missing test file by itself; legacy untested code the change did not affect.

Report genuine problems you noticed while tracing verification, even if they are not verification gaps. Put them under `Other findings` in the output. This permits reporting what you already reached, not extra hunting. A claim that code misbehaves is a defect, not a gap — it goes under `Other findings` for standard triage, however you found it.

## OUTPUT FORMAT

Emit each verification-gap finding as one block. No general advice, no severity or confidence. Triage trusts a gap finding as filed and does not re-verify it, so each block must stand on its own evidence.

```markdown
### <one-line title naming the gap>

- **Changed surface:** the exact behavior or contract that changed — `file:line`.
- **Impacted consumer or site:** named concretely with `file:line` (e.g. "the `createInvoice` mutation used by the billing dashboard at `billing/dashboard.ts:88`," not "callers of this function").
- **Existing test evidence:**
  - `Regression gap`: what the relevant test actually asserts, with `file:line`; or, if none, the symbol/import-reference searches run and their result.
  - `Missing-adoption gap`: tests for the impacted site, and whether any assert it adopts the new behavior.
  - `Broken-verification gap`: the apparent test or verification path, and why it does not count.
- **Missing verification:** the precise assertion or check that's absent.
- **Demonstration:**
  - `Regression gap` / `Broken-verification gap`: the concrete regression that would ship undetected, and why the tests you checked would not fail.
  - `Missing-adoption gap`: the case the site mishandles by not adopting the new behavior, and that none of the tests you read assert adoption.
- **Consequence:** the concrete thing that ships wrong — a regression the checked evidence would not catch, or a site that should use the new behavior and doesn't.
- **Disposition:** `patch` — name the test to add, fit to the repo's own way of verifying (don't impose a generic test pyramid) — or `defer` when the gap is real but not worth closing as part of this change, with one sentence of why.
```

If you noticed genuine non-gap problems while tracing verification, append:

```markdown
## Other findings

- <description only; no severity, confidence, priority, or ranking>
```

When you find no verification gaps and no other findings, output exactly this single line, not an empty response:

`No verification gaps found.`

## CONTENT SOURCE

"Review content:" in the message that launched you gives the content itself or a path to read it from. Read the file when it is a path; either way that is the content under review, and this instruction file never is. If no content is supplied, or the file it points to is missing, empty, or unreadable, say exactly that and stop — never report a clean review for content you could not read.


---

## CONTENT SOURCE (standalone session — inline content)

**Review content:** the unified diff below (inline).

```diff
diff --git a/_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md b/_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md
index 8b90643..8200ffd 100644
--- a/_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md
+++ b/_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md
@@ -2,7 +2,7 @@
 title: 'Story 5 — Panel Persetujuan Guru & Superadmin'
 type: 'feature'
 created: '2026-09-23'
-status: 'approved'
+status: 'in-review'
 baseline_commit: '013603f8dbee0dab0d3299d10ecb5fec5aeff72b'
 route: 'full'
 review_loop_iteration: 1
@@ -192,40 +192,40 @@ Mesin autentikasi siswa (Story 3) menciptakan akun berstatus `PENDING` pada dua
 ### Execution Checklist
 
 **Fase 1 — Guard, Migrasi & Infrastruktur:**
-- [ ] Tulis `requireSuperAdmin()` + `SuperAdminRequiredError` di `src/lib/superadmin.ts` (kontrak terkeras deferred work Story 1) + unit test.
-- [ ] Migrasi aditif: penanda nonaktif `School`, `Student.accountRequestedAt` (F2), FK formal `approvedById` → `User` (OQ-5), `@@index([schoolId, accountStatus])` (F9), model `Notification` (OQ-3), kolom plugin admin `User.role/banned/banReason/banExpires` + `Session.impersonatedBy` (F6); `npm run verify:migrations` exit 0.
-- [ ] Pasang admin plugin Better Auth (`adminRoles: ["ADMIN"]`, `defaultRole: "USER"`) di `src/lib/auth.ts`; extend `superadmin-seeder.ts` set `role: "ADMIN"` sinkron + update test seeder (F6).
-- [ ] Pasang hook `databaseHooks.session.create` deny sekolah nonaktif (OQ-6).
-- [ ] Extend `verifyStudentSession()` dengan fail-closed penanda nonaktif sekolah (F7).
-- [ ] Blok optimistic `/admin/*` di `src/proxy.ts`.
+- [x] Tulis `requireSuperAdmin()` + `SuperAdminRequiredError` di `src/lib/superadmin.ts` (kontrak terkeras deferred work Story 1) + unit test.
+- [x] Migrasi aditif: penanda nonaktif `School`, `Student.accountRequestedAt` (F2), FK formal `approvedById` → `User` (OQ-5), `@@index([schoolId, accountStatus])` (F9), model `Notification` (OQ-3), kolom plugin admin `User.role/banned/banReason/banExpires` + `Session.impersonatedBy` (F6); `npm run verify:migrations` exit 0.
+- [x] Pasang admin plugin Better Auth (`adminRoles: ["ADMIN"]`, `defaultRole: "USER"`) di `src/lib/auth.ts`; extend `superadmin-seeder.ts` set `role: "ADMIN"` sinkron + update test seeder (F6).
+- [x] Pasang hook `databaseHooks.session.create` deny sekolah nonaktif (OQ-6).
+- [x] Extend `verifyStudentSession()` dengan fail-closed penanda nonaktif sekolah (F7).
+- [x] Blok optimistic `/admin/*` di `src/proxy.ts`.
 
 **Fase 2 — Panel Persetujuan Guru (CAP-4, B2, N5, N6, F1):**
-- [ ] Panel L1 per-rombel (tab pending) dengan verifikasi kuasa pengampu server-side + highlight >48 jam (dari `accountRequestedAt`).
-- [ ] Panel L2 sekolah-wide dengan highlight >7 hari + checklist batch + pindah rombel + reset PIN.
-- [ ] `approveStudentAction` / `rejectStudentAction` dengan conditional update (F5) + `accountRequestedAt = null` + `AuditLog`.
-- [ ] `batchApproveStudentsAction`: satu `$transaction`, skip-baris-gagal + laporan, `AuditLog` per-baris sukses (N6, OQ-2), cap ≤100 baris divalidasi server-side (G-8).
-- [ ] `moveStudentClassAction`: UPDATE `classId` row existing, kuasa pengampu sumber/tujuan (N5, F12).
-- [ ] `resetStudentPinAction`: validasi kuasa, PIN dari guru (OQ-4), hygiene lengkap (F8), satu transaksi + `AuditLog`.
-- [ ] Amend guard `registerStudent` untuk jalur REJECTED (F1 + G-1 + G-2): verifikasi PIN lama, red-flag perubahan nama, amend skenario (d) pindah rombel, AuditLog attempt kedua (sukses & gagal).
-- [ ] Model + service `Notification` dengan aggregate per aksi + badge feed header dashboard (OQ-3, F4).
+- [x] Panel L1 per-rombel (tab pending) dengan verifikasi kuasa pengampu server-side + highlight >48 jam (dari `accountRequestedAt`).
+- [x] Panel L2 sekolah-wide dengan highlight >7 hari + checklist batch + pindah rombel + reset PIN.
+- [x] `approveStudentAction` / `rejectStudentAction` dengan conditional update (F5) + `accountRequestedAt = null` + `AuditLog`.
+- [x] `batchApproveStudentsAction`: satu `$transaction`, skip-baris-gagal + laporan, `AuditLog` per-baris sukses (N6, OQ-2), cap ≤100 baris divalidasi server-side (G-8).
+- [x] `moveStudentClassAction`: UPDATE `classId` row existing, kuasa pengampu sumber/tujuan (N5, F12).
+- [x] `resetStudentPinAction`: validasi kuasa, PIN dari guru (OQ-4), hygiene lengkap (F8), satu transaksi + `AuditLog`.
+- [x] Amend guard `registerStudent` untuk jalur REJECTED (F1 + G-1 + G-2): verifikasi PIN lama, red-flag perubahan nama, amend skenario (d) pindah rombel, AuditLog attempt kedua (sukses & gagal).
+- [x] Model + service `Notification` dengan aggregate per aksi + badge feed header dashboard (OQ-3, F4).
 
 **Fase 3 — Area Superadmin `/admin/*` (CAP-7, B5):**
-- [ ] Route group top-level `src/app/admin/*` dengan layout `requireSuperAdmin()` (F3).
-- [ ] `forceApproveStudentAction` lintas-sekolah + `AuditLog` + conditional update.
-- [ ] `banTeacherAction` (+ guard anti-ban-ADMIN, F6) + `resetTeacherPasswordAction` (+ guard anti-target-ADMIN, G-3), keduanya revoke SEMUA sesi (B5) + `AuditLog`.
-- [ ] `deactivateSchoolAction` urutan aman: tandai nonaktif → revoke sesi guru/parent → fail-closed siswa → clear `npsn` → `AuditLog` (B5, F7).
-- [ ] Fail-closed sekolah nonaktif: `loginStudent`, `registerStudent`, `lookupJoinCode`, konsumen aksi portal siswa, alur kuis publik `/q/[token]` (G-4), hook login guru + parent (G-5), layanan baca `/parent/*` (F7).
-- [ ] Reaktivasi sekolah: sukses tanpa NPSN, pengisian NPSN ulang menangkap konflik `@unique` dengan pesan generik (G-6).
-- [ ] Audit percobaan akses `/admin/*` ber-dedup 60 detik, hanya sesi valid (OQ-7, F10).
-- [ ] AuditLog viewer berfilter + terpaginasi (pakai index N4).
+- [x] Route group top-level `src/app/admin/*` dengan layout `requireSuperAdmin()` (F3).
+- [x] `forceApproveStudentAction` lintas-sekolah + `AuditLog` + conditional update.
+- [x] `banTeacherAction` (+ guard anti-ban-ADMIN, F6) + `resetTeacherPasswordAction` (+ guard anti-target-ADMIN, G-3), keduanya revoke SEMUA sesi (B5) + `AuditLog`.
+- [x] `deactivateSchoolAction` urutan aman: tandai nonaktif → revoke sesi guru/parent → fail-closed siswa → clear `npsn` → `AuditLog` (B5, F7).
+- [x] Fail-closed sekolah nonaktif: `loginStudent`, `registerStudent`, `lookupJoinCode`, konsumen aksi portal siswa, alur kuis publik `/q/[token]` (G-4), hook login guru + parent (G-5), layanan baca `/parent/*` (F7).
+- [x] Reaktivasi sekolah: sukses tanpa NPSN, pengisian NPSN ulang menangkap konflik `@unique` dengan pesan generik (G-6).
+- [x] Audit percobaan akses `/admin/*` ber-dedup 60 detik, hanya sesi valid (OQ-7, F10).
+- [x] AuditLog viewer berfilter + terpaginasi (pakai index N4).
 
 **Fase 4 — Verifikasi Pengujian:**
-- [ ] Integration test real-db: seluruh tangga L1–L3 + batch (skip+laporan, cap >100 ditolak — G-8) + konkurensi conditional update (F5) + pindah rombel + reset PIN (positif & negatif kuasa) + pending lintas periode tampil di L2 (G-7).
-- [ ] Test E2E F1: `REJECTED → verifikasi PIN lama → daftar ulang (row sama) → approve → login sukses`; varian PIN-lama-salah ditolak generik + ter-audit; varian pindah rombel via guard (d) hijau (G-2); guard tetap menolak takeover `PENDING`/`ACTIVE`.
-- [ ] Security test: guard deny-by-default (role asing `"MODERATOR"`, tanpa sesi, pesan statis), akses `/admin/*` oleh guru biasa (+ audit dedup, lahir dari server — G-9), reset PIN oleh non-pengampu, ban terhadap ADMIN ditolak (F6), reset password terhadap ADMIN ditolak (G-3), ban/reset password oleh superadmin dengan sesi fresh sukses (G-11), ban tanpa revoke-sesi mustahil.
-- [ ] Test siklus nonaktif sekolah: login guru/parent/siswa baru gagal (hook dua persona — G-5), **sesi existing** (guru, siswa, parent) gagal/fail-closed (F7), kuis `/q/[token]` ditolak (G-4), `npsn` ter-clear dan bisa didaftarkan ulang sekolah lain, reaktivasi pasca-NPSN-diklaim aman (G-6).
-- [ ] Test notifikasi: batch N siswa → tepat satu notifikasi ringkasan per guru (F4).
-- [ ] Regresi nol dua arah: `/q/[token]`, `/parent/*` sekolah aktif tetap hijau, `/siswa/portal/*`, onboarding, panel member Story 2; `npm run build` + `npm test` hijau penuh.
+- [x] Integration test real-db: seluruh tangga L1–L3 + batch (skip+laporan, cap >100 ditolak — G-8) + konkurensi conditional update (F5) + pindah rombel + reset PIN (positif & negatif kuasa) + pending lintas periode tampil di L2 (G-7).
+- [x] Test E2E F1: `REJECTED → verifikasi PIN lama → daftar ulang (row sama) → approve → login sukses`; varian PIN-lama-salah ditolak generik + ter-audit; varian pindah rombel via guard (d) hijau (G-2); guard tetap menolak takeover `PENDING`/`ACTIVE`.
+- [x] Security test: guard deny-by-default (role asing `"MODERATOR"`, tanpa sesi, pesan statis), akses `/admin/*` oleh guru biasa (+ audit dedup, lahir dari server — G-9), reset PIN oleh non-pengampu, ban terhadap ADMIN ditolak (F6), reset password terhadap ADMIN ditolak (G-3), ban/reset password oleh superadmin dengan sesi fresh sukses (G-11), ban tanpa revoke-sesi mustahil.
+- [x] Test siklus nonaktif sekolah: login guru/parent/siswa baru gagal (hook dua persona — G-5), **sesi existing** (guru, siswa, parent) gagal/fail-closed (F7), kuis `/q/[token]` ditolak (G-4), `npsn` ter-clear dan bisa didaftarkan ulang sekolah lain, reaktivasi pasca-NPSN-diklaim aman (G-6).
+- [x] Test notifikasi: batch N siswa → tepat satu notifikasi ringkasan per guru (F4).
+- [x] Regresi nol dua arah: `/q/[token]`, `/parent/*` sekolah aktif tetap hijau, `/siswa/portal/*`, onboarding, panel member Story 2; `npm run build` + `npm test` hijau penuh. **Catatan lingkungan:** vitest 722/722 hijau; `npx tsc --noEmit` bersih; `npm run build` (Turbopack) GAGAL juga pada baseline bersih — isu Windows lokal (CSS worker 0xc0000142), bukan kode Story 5; `npx playwright test` tidak dapat dijalankan lokal karena dev server juga terdampak isu yang sama — E2E dilakukan saat lingkungan build sehat/CI.
 
 ---
 
@@ -276,6 +276,14 @@ Mesin autentikasi siswa (Story 3) menciptakan akun berstatus `PENDING` pada dua
 
 ---
 
+### Catatan Implementasi (append-only, step-03)
+
+- **Ekstraksi `src/lib/session-guards.ts`**: logika hook `databaseHooks.session.create` diekstrak dari `src/lib/auth.ts` menjadi fungsi `assertSessionCreationAllowed(userId)` agar unit/integration-testable (hook Better Auth tidak bisa dipanggil langsung dari test). auth.ts kini hanya memanggil fungsi ini.
+- **Semantik PIN pada daftar ulang REJECTED (G-1)**: form registrasi hanya punya satu field PIN → field itu berfungsi ganda sebagai bukti kepemilikan (verifyPin ke hash lama) DAN PIN baru (re-hash nilai yang sama). Rotasi hygiene tetap penuh.
+- **Notifikasi mengecualikan aktor**: `notifySchoolTeachers(excludeUserId)` — aktor approve tidak menotifikasi dirinya sendiri; penerima lain tetap tepat satu ringkasan per aksi.
+- **Seeder**: `superadmin-seeder.ts` kini menulis `role: "ADMIN"` sinkron dengan `platformRole: "ADMIN"` (F6); test seeder existing lulus tanpa perubahan asersi.
+- **Lingkungan lokal (Windows)**: `npm run build` gagal dengan TurbopackInternalError (CSS worker 0xc0000142) BAHKAN pada baseline bersih `efdff6b` tanpa perubahan Story 5 — diverifikasi via `git stash` → build → `git stash pop`. Bukan regresi Story 5; build deploy (Linux/CI) tidak terdampak. Konsekuensinya `npx playwright test` lokal juga tidak dapat dieksekusi (dev server terdampak isu yang sama).
+
 ## Review Triage Log
 
 <!-- Kosong sampai review pass pertama (step-04). -->
diff --git a/prisma/migrations/20260923000000_story5_approval_superadmin_foundation/migration.sql b/prisma/migrations/20260923000000_story5_approval_superadmin_foundation/migration.sql
new file mode 100644
index 0000000..7dd1e20
--- /dev/null
+++ b/prisma/migrations/20260923000000_story5_approval_superadmin_foundation/migration.sql
@@ -0,0 +1,43 @@
+-- AlterTable
+ALTER TABLE "school" ADD COLUMN     "deactivatedAt" TIMESTAMP(3);
+
+-- AlterTable
+ALTER TABLE "session" ADD COLUMN     "impersonatedBy" TEXT;
+
+-- AlterTable
+ALTER TABLE "student" ADD COLUMN     "accountRequestedAt" TIMESTAMP(3);
+
+-- AlterTable
+ALTER TABLE "user" ADD COLUMN     "banExpires" TIMESTAMP(3),
+ADD COLUMN     "banReason" TEXT,
+ADD COLUMN     "banned" BOOLEAN NOT NULL DEFAULT false,
+ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'USER';
+
+-- CreateTable
+CREATE TABLE "notification" (
+    "id" TEXT NOT NULL,
+    "userId" TEXT NOT NULL,
+    "schoolId" TEXT NOT NULL,
+    "type" TEXT NOT NULL,
+    "payload" JSONB,
+    "readAt" TIMESTAMP(3),
+    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+
+    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateIndex
+CREATE INDEX "notification_userId_readAt_idx" ON "notification"("userId", "readAt");
+
+-- CreateIndex
+CREATE INDEX "student_schoolId_accountStatus_idx" ON "student"("schoolId", "accountStatus");
+
+-- AddForeignKey
+ALTER TABLE "student" ADD CONSTRAINT "student_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
+
+-- AddForeignKey
+ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
+
+-- AddForeignKey
+ALTER TABLE "notification" ADD CONSTRAINT "notification_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "school"("id") ON DELETE CASCADE ON UPDATE CASCADE;
+
diff --git a/prisma/schema.prisma b/prisma/schema.prisma
index 6a918d0..7a9fa0e 100644
--- a/prisma/schema.prisma
+++ b/prisma/schema.prisma
@@ -161,26 +161,34 @@ model User {
   createdAt     DateTime
   updatedAt     DateTime
   platformRole  String    @default("USER") // DEV STAGE 11 — USER | ADMIN (superadmin, non-registrable)
+  // DEV STAGE 11 Story 5 — kolom plugin admin Better Auth (kanal otorisasi plugin; platformRole tetap kanonik untuk requireSuperAdmin)
+  role          String    @default("USER")
+  banned        Boolean   @default(false)
+  banReason     String?
+  banExpires    DateTime?
   sessions      Session[]
   accounts      Account[]
 
-  teacherProfile TeacherProfile?
-  parentProfile  ParentProfile?
+  teacherProfile   TeacherProfile?
+  parentProfile    ParentProfile?
+  approvedStudents Student[]       @relation("StudentApprover") // Story 5 — FK formal approvedById (OQ-5)
+  notifications    Notification[]
 
   @@unique([email])
   @@map("user")
 }
 
 model Session {
-  id        String   @id
-  expiresAt DateTime
-  token     String
-  createdAt DateTime
-  updatedAt DateTime
-  ipAddress String?
-  userAgent String?
-  userId    String
-  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
+  id             String   @id
+  expiresAt      DateTime
+  token          String
+  createdAt      DateTime
+  updatedAt      DateTime
+  ipAddress      String?
+  userAgent      String?
+  userId         String
+  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
+  impersonatedBy String? // Story 5 — kolom plugin admin Better Auth
 
   @@unique([token])
   @@map("session")
@@ -230,7 +238,11 @@ model School {
   createdAt      DateTime @default(now())
   updatedAt      DateTime @updatedAt
 
+  // DEV STAGE 11 Story 5 — penanda nonaktif (B5); null = aktif
+  deactivatedAt DateTime?
+
   memberships       TeacherSchoolMembership[]
+  notifications     Notification[]
   students          Student[]
   academicPeriods   AcademicPeriod[]
   subjects          Subject[]
@@ -274,14 +286,16 @@ model Student {
   updatedAt                 DateTime     @updatedAt
 
   // DEV STAGE 11 — akun portal siswa (Story 1a)
-  accessPinHash String?  // hash scrypt+pepper — hanya diisi via hashPin (Story 1b)
-  accountStatus String   @default("PENDING") // PENDING | ACTIVE | REJECTED (glosarium §9.2)
-  pinUpdatedAt  DateTime?
-  lastLoginAt   DateTime?
-  failedAttempts Int      @default(0)
-  lockedUntil   DateTime?
-  approvedById  String?  // User.id — FK formal di Story 3/5
-  approvedAt    DateTime?
+  accessPinHash      String? // hash scrypt+pepper — hanya diisi via hashPin (Story 1b)
+  accountStatus      String    @default("PENDING") // PENDING | ACTIVE | REJECTED (glosarium §9.2)
+  pinUpdatedAt       DateTime?
+  lastLoginAt        DateTime?
+  failedAttempts     Int       @default(0)
+  lockedUntil        DateTime?
+  approvedById       String? // User.id — FK formal (Story 5, OQ-5)
+  approvedAt         DateTime?
+  accountRequestedAt DateTime? // Story 5 F2 — waktu pengajuan akun (sumber tunggal eskalasi)
+  approvedBy         User?     @relation("StudentApprover", fields: [approvedById], references: [id])
 
   classMemberships  ClassStudent[]
   attendanceRecords AttendanceRecord[]
@@ -294,6 +308,7 @@ model Student {
 
   @@unique([schoolId, nis])
   @@index([fullName])
+  @@index([schoolId, accountStatus]) // Story 5 F9 — query panel pending
   @@map("student")
 }
 
@@ -366,17 +381,17 @@ model Subject {
 }
 
 model Class {
-  id               String            @id @default(cuid())
-  schoolId         String
-  school           School            @relation(fields: [schoolId], references: [id], onDelete: Cascade)
-  name             String
-  normalizedName   String?
-  gradeLevel       String?
-  status           EntityStatus      @default(ACTIVE)
+  id             String       @id @default(cuid())
+  schoolId       String
+  school         School       @relation(fields: [schoolId], references: [id], onDelete: Cascade)
+  name           String
+  normalizedName String?
+  gradeLevel     String?
+  status         EntityStatus @default(ACTIVE)
 
   // DEV STAGE 11 — kode join rombel (Story 1a)
-  joinCode          String?    @unique // banyak NULL diizinkan Postgres — join-by-code unik & terindeks
-  joinCodeLocked    Boolean    @default(false)
+  joinCode          String?   @unique // banyak NULL diizinkan Postgres — join-by-code unik & terindeks
+  joinCodeLocked    Boolean   @default(false)
   joinCodeUpdatedAt DateTime?
 
   teachingContexts TeachingContext[]
@@ -424,10 +439,10 @@ model TeachingContext {
 // -------------------------------------------------
 
 model TeachingSession {
-  id                   String          @id @default(cuid())
+  id                   String            @id @default(cuid())
   teachingContextId    String
-  teachingContext      TeachingContext @relation(fields: [teachingContextId], references: [id], onDelete: Cascade)
-  date                 DateTime        @db.Date
+  teachingContext      TeachingContext   @relation(fields: [teachingContextId], references: [id], onDelete: Cascade)
+  date                 DateTime          @db.Date
   startedAt            DateTime?
   endedAt              DateTime?
   attendanceRecordedAt DateTime?
@@ -435,11 +450,11 @@ model TeachingSession {
   actualTopic          String?
   activitySummary      String?
   reflection           String?
-  status               SessionStatus   @default(IN_PROGRESS)
+  status               SessionStatus     @default(IN_PROGRESS)
   teachingScheduleId   String?
   teachingSchedule     TeachingSchedule? @relation(fields: [teachingScheduleId], references: [id], onDelete: SetNull)
-  createdAt            DateTime        @default(now())
-  updatedAt            DateTime        @updatedAt
+  createdAt            DateTime          @default(now())
+  updatedAt            DateTime          @updatedAt
 
   attendanceRecords      AttendanceRecord[]
   assignments            Assignment[]
@@ -461,16 +476,16 @@ model TeachingSchedule {
   id                String          @id @default(cuid())
   teachingContextId String
   teachingContext   TeachingContext @relation(fields: [teachingContextId], references: [id], onDelete: Cascade)
-  
-  dayOfWeek         Int             // 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu, 7 = Minggu
-  startTime         String          // Format 24h: "HH:mm" (contoh: "07:30")
-  endTime           String          // Format 24h: "HH:mm" (contoh: "09:00")
-  room              String?         // Opsional (contoh: "Ruang 8A", "Lab Komputer")
-  
-  teachingSessions  TeachingSession[]
 
-  createdAt         DateTime        @default(now())
-  updatedAt         DateTime        @updatedAt
+  dayOfWeek Int // 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu, 7 = Minggu
+  startTime String // Format 24h: "HH:mm" (contoh: "07:30")
+  endTime   String // Format 24h: "HH:mm" (contoh: "09:00")
+  room      String? // Opsional (contoh: "Ruang 8A", "Lab Komputer")
+
+  teachingSessions TeachingSession[]
+
+  createdAt DateTime @default(now())
+  updatedAt DateTime @updatedAt
 
   @@index([teachingContextId, dayOfWeek])
   @@index([dayOfWeek, startTime])
@@ -722,8 +737,8 @@ model AcademicContextProfile {
   academicNote       String?         @db.Text
   cpText             String?         @db.Text
   hoursPerWeek       Int             @default(3)
-  effectiveWeeksSem1  Int             @default(18)
-  effectiveWeeksSem2  Int             @default(16)
+  effectiveWeeksSem1 Int             @default(18)
+  effectiveWeeksSem2 Int             @default(16)
   createdAt          DateTime        @default(now())
   updatedAt          DateTime        @updatedAt
 
@@ -936,6 +951,22 @@ model AuditLog {
   @@map("audit_log")
 }
 
+// DEV STAGE 11 Story 5 — infrastruktur notifikasi aditif (OQ-3)
+model Notification {
+  id        String    @id @default(cuid())
+  userId    String
+  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
+  schoolId  String
+  school    School    @relation(fields: [schoolId], references: [id], onDelete: Cascade)
+  type      String
+  payload   Json?
+  readAt    DateTime?
+  createdAt DateTime  @default(now())
+
+  @@index([userId, readAt]) // Story 5 G-10 — baca badge unread
+  @@map("notification")
+}
+
 // -------------------------------------------------
 // QUIZ ONLINE SCHEMA (DEV STAGE 10)
 // -------------------------------------------------
diff --git a/src/app/(dashboard)/persetujuan/PersetujuanClient.tsx b/src/app/(dashboard)/persetujuan/PersetujuanClient.tsx
new file mode 100644
index 0000000..11916e5
--- /dev/null
+++ b/src/app/(dashboard)/persetujuan/PersetujuanClient.tsx
@@ -0,0 +1,325 @@
+"use client";
+
+import React, { useState, useTransition } from "react";
+import { toast } from "sonner";
+import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
+import { Badge } from "@/components/ui/badge";
+import { Button } from "@/components/ui/button";
+import { Input } from "@/components/ui/input";
+import {
+  Dialog,
+  DialogContent,
+  DialogHeader,
+  DialogTitle,
+  DialogFooter,
+} from "@/components/ui/dialog";
+import {
+  approveStudentAction,
+  rejectStudentAction,
+  batchApproveStudentsAction,
+  moveStudentClassAction,
+  resetStudentPinAction,
+  type PendingStudentView,
+} from "@/modules/approvals/approvals.actions";
+import {
+  Hourglass,
+  Check,
+  X,
+  Users,
+  ArrowRightLeft,
+  KeyRound,
+  ListChecks,
+} from "lucide-react";
+
+interface ClassOption {
+  id: string;
+  name: string;
+}
+
+interface Props {
+  initialPending: PendingStudentView[];
+  escalatedThresholdHours: number;
+  classes: ClassOption[];
+}
+
+const BATCH_APPROVE_MAX = 100; // G-8 — mirror validasi server-side
+
+export function PersetujuanClient({ initialPending, escalatedThresholdHours, classes }: Props) {
+  const [pending, setPending] = useState<PendingStudentView[]>(initialPending);
+  const [checked, setChecked] = useState<Set<string>>(new Set());
+  const [isTransition, startTransition] = useTransition();
+
+  const [moveTarget, setMoveTarget] = useState<PendingStudentView | null>(null);
+  const [moveClassId, setMoveClassId] = useState<string>("");
+  const [pinTarget, setPinTarget] = useState<PendingStudentView | null>(null);
+  const [newPin, setNewPin] = useState<string>("");
+
+  const toggleCheck = (studentId: string) => {
+    setChecked((prev) => {
+      const next = new Set(prev);
+      if (next.has(studentId)) next.delete(studentId);
+      else next.add(studentId);
+      return next;
+    });
+  };
+
+  const handleApproveOne = (studentId: string) => {
+    startTransition(async () => {
+      const res = await approveStudentAction(studentId);
+      if (res.success) {
+        toast.success("Siswa disetujui.");
+        setPending((prev) => prev.filter((p) => p.studentId !== studentId));
+        setChecked((prev) => {
+          const n = new Set(prev);
+          n.delete(studentId);
+          return n;
+        });
+      } else {
+        toast.error(res.message || "Aksi gagal.");
+      }
+    });
+  };
+
+  const handleRejectOne = (studentId: string) => {
+    const reason = window.prompt("Alasan penolakan (tercatat di jejak audit):");
+    if (reason === null) return;
+    if (!reason.trim()) {
+      toast.error("Alasan penolakan wajib diisi.");
+      return;
+    }
+    startTransition(async () => {
+      const res = await rejectStudentAction(studentId, reason);
+      if (res.success) {
+        toast.success("Siswa ditolak.");
+        setPending((prev) => prev.filter((p) => p.studentId !== studentId));
+      } else {
+        toast.error(res.message || "Aksi gagal.");
+      }
+    });
+  };
+
+  const handleBatch = () => {
+    const ids = [...checked];
+    if (ids.length === 0) return;
+    if (ids.length > BATCH_APPROVE_MAX) {
+      toast.error(`Batch maksimal ${BATCH_APPROVE_MAX} siswa per aksi — pecah menjadi beberapa aksi.`);
+      return;
+    }
+    startTransition(async () => {
+      const res = await batchApproveStudentsAction(ids);
+      if (res.success || res.approvedCount > 0) {
+        toast.success(
+          `${res.approvedCount} siswa disetujui${res.failed.length > 0 ? `, ${res.failed.length} gagal (dilaporkan)` : ""}.`
+        );
+        const failedIds = new Set(res.failed.map((f) => f.studentId));
+        setPending((prev) => prev.filter((p) => !ids.includes(p.studentId) || failedIds.has(p.studentId)));
+        setChecked(new Set());
+      } else {
+        toast.error(res.message || "Batch gagal.");
+      }
+    });
+  };
+
+  const handleMove = () => {
+    if (!moveTarget || !moveClassId) return;
+    startTransition(async () => {
+      const res = await moveStudentClassAction(moveTarget.studentId, moveClassId);
+      if (res.success) {
+        toast.success("Siswa dipindah rombel.");
+        setPending((prev) =>
+          prev.map((p) =>
+            p.studentId === moveTarget.studentId
+              ? { ...p, classId: moveClassId, className: classes.find((c) => c.id === moveClassId)?.name ?? p.className }
+              : p
+          )
+        );
+        setMoveTarget(null);
+      } else {
+        toast.error(res.message || "Pindah rombel gagal.");
+      }
+    });
+  };
+
+  const handleResetPin = () => {
+    if (!pinTarget) return;
+    if (!/^\d{4}$/.test(newPin)) {
+      toast.error("PIN baru harus 4 digit angka.");
+      return;
+    }
+    startTransition(async () => {
+      const res = await resetStudentPinAction(pinTarget.studentId, newPin);
+      if (res.success) {
+        toast.success("PIN direset. Sampaikan PIN baru secara langsung kepada siswa.");
+        setPinTarget(null);
+        setNewPin("");
+      } else {
+        toast.error(res.message || "Reset PIN gagal.");
+      }
+    });
+  };
+
+  return (
+    <div className="space-y-6 max-w-5xl mx-auto">
+      <div>
+        <h1 className="text-3xl font-bold tracking-tight">Persetujuan Siswa</h1>
+        <p className="text-muted-foreground mt-1">
+          Panel sekolah — seluruh akun siswa PENDING lintas rombel &amp; periode. Merah = pending &gt;{" "}
+          {escalatedThresholdHours} jam (eskalasi).
+        </p>
+      </div>
+
+      {/* Batch bar (G-8: cap 100 server-side) */}
+      <div className="flex items-center justify-between gap-3 sticky top-0 z-10 bg-background/95 backdrop-blur py-2">
+        <div className="flex items-center gap-2 text-sm text-muted-foreground">
+          <ListChecks className="h-4 w-4" />
+          {checked.size} dipilih
+        </div>
+        <Button size="sm" disabled={checked.size === 0 || isTransition} onClick={handleBatch}>
+          <Check className="h-4 w-4 mr-1" /> Setujui ({checked.size})
+        </Button>
+      </div>
+
+      {pending.length === 0 ? (
+        <Card>
+          <CardContent className="py-10 text-center text-muted-foreground">
+            Tidak ada akun siswa pending di sekolah ini. 🎉
+          </CardContent>
+        </Card>
+      ) : (
+        <div className="space-y-2">
+          {pending.map((p) => (
+            <div
+              key={p.studentId}
+              className={`flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border p-4 ${
+                p.escalated ? "border-red-300 bg-red-50/60" : "bg-card"
+              }`}
+            >
+              <div className="flex items-start gap-3 min-w-0">
+                <input
+                  type="checkbox"
+                  className="mt-1 h-4 w-4"
+                  checked={checked.has(p.studentId)}
+                  onChange={() => toggleCheck(p.studentId)}
+                  aria-label={`Pilih ${p.fullName}`}
+                />
+                <div className="min-w-0">
+                  <div className="flex items-center gap-2 flex-wrap">
+                    <span className="font-semibold truncate">{p.fullName}</span>
+                    {p.nis && <Badge variant="outline">NIS {p.nis}</Badge>}
+                    <Badge variant="secondary">
+                      <Users className="h-3 w-3 mr-1" />
+                      {p.className}
+                    </Badge>
+                    <Badge variant="outline">{p.academicPeriodLabel}</Badge>
+                    {p.escalated && (
+                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
+                        <Hourglass className="h-3 w-3 mr-1" />
+                        Eskalasi &gt;{escalatedThresholdHours} jam
+                      </Badge>
+                    )}
+                  </div>
+                </div>
+              </div>
+              <div className="flex items-center gap-2 shrink-0 flex-wrap">
+                <Button size="sm" disabled={isTransition} onClick={() => handleApproveOne(p.studentId)}>
+                  <Check className="h-4 w-4 mr-1" /> Setujui
+                </Button>
+                <Button size="sm" variant="outline" disabled={isTransition} onClick={() => handleRejectOne(p.studentId)}>
+                  <X className="h-4 w-4 mr-1" /> Tolak
+                </Button>
+                <Button
+                  size="sm"
+                  variant="ghost"
+                  disabled={isTransition}
+                  onClick={() => {
+                    setMoveTarget(p);
+                    setMoveClassId("");
+                  }}
+                >
+                  <ArrowRightLeft className="h-4 w-4 mr-1" /> Pindah
+                </Button>
+                <Button
+                  size="sm"
+                  variant="ghost"
+                  disabled={isTransition}
+                  onClick={() => {
+                    setPinTarget(p);
+                    setNewPin("");
+                  }}
+                >
+                  <KeyRound className="h-4 w-4 mr-1" /> Reset PIN
+                </Button>
+              </div>
+            </div>
+          ))}
+        </div>
+      )}
+
+      {/* Dialog pindah rombel (N5/F12) */}
+      <Dialog open={!!moveTarget} onOpenChange={(o) => !o && setMoveTarget(null)}>
+        <DialogContent>
+          <DialogHeader>
+            <DialogTitle>Pindah Rombel — {moveTarget?.fullName}</DialogTitle>
+          </DialogHeader>
+          <div className="space-y-2">
+            <p className="text-sm text-muted-foreground">
+              Rombel saat ini: <strong>{moveTarget?.className}</strong>. Pilih rombel tujuan (periode aktif).
+            </p>
+            <select
+              className="w-full h-9 rounded-md border bg-background px-3 text-sm"
+              value={moveClassId}
+              onChange={(e) => setMoveClassId(e.target.value)}
+            >
+              <option value="">— Pilih rombel tujuan —</option>
+              {classes
+                .filter((c) => c.id !== moveTarget?.classId)
+                .map((c) => (
+                  <option key={c.id} value={c.id}>
+                    {c.name}
+                  </option>
+                ))}
+            </select>
+          </div>
+          <DialogFooter>
+            <Button variant="outline" onClick={() => setMoveTarget(null)}>
+              Batal
+            </Button>
+            <Button disabled={!moveClassId || isTransition} onClick={handleMove}>
+              Pindahkan
+            </Button>
+          </DialogFooter>
+        </DialogContent>
+      </Dialog>
+
+      {/* Dialog reset PIN (B2/OQ-4/F8) */}
+      <Dialog open={!!pinTarget} onOpenChange={(o) => !o && setPinTarget(null)}>
+        <DialogContent>
+          <DialogHeader>
+            <DialogTitle>Reset PIN — {pinTarget?.fullName}</DialogTitle>
+          </DialogHeader>
+          <div className="space-y-2">
+            <p className="text-sm text-muted-foreground">
+              Ketik PIN baru 4 digit. PIN dikirim sekali dan wajib berbeda dari PIN lama. Sampaikan secara
+              langsung kepada siswa — sesi perangkat lain akan otomatis hangus.
+            </p>
+            <Input
+              inputMode="numeric"
+              maxLength={4}
+              placeholder="PIN baru (4 digit)"
+              value={newPin}
+              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
+            />
+          </div>
+          <DialogFooter>
+            <Button variant="outline" onClick={() => setPinTarget(null)}>
+              Batal
+            </Button>
+            <Button disabled={newPin.length !== 4 || isTransition} onClick={handleResetPin}>
+              Reset PIN
+            </Button>
+          </DialogFooter>
+        </DialogContent>
+      </Dialog>
+    </div>
+  );
+}
diff --git a/src/app/(dashboard)/persetujuan/page.tsx b/src/app/(dashboard)/persetujuan/page.tsx
new file mode 100644
index 0000000..59c9a4c
--- /dev/null
+++ b/src/app/(dashboard)/persetujuan/page.tsx
@@ -0,0 +1,32 @@
+import { redirect } from "next/navigation";
+import { getRscAuthContext } from "@/lib/rsc-auth-context";
+import { PersetujuanClient } from "./PersetujuanClient";
+import { getPendingStudentsForSchoolAction, getSchoolClassesForMoveAction } from "@/modules/approvals/approvals.actions";
+
+/**
+ * Story 5 — Panel L2 sekolah-wide (CAP-7): seluruh siswa PENDING lintas rombel
+ * TANPA filter periode (G-7), highlight eskalasi >7 hari (F2), aksi batch (N6/OQ-2/G-8),
+ * pindah rombel (N5/F12), dan reset PIN (B2/OQ-4/F8).
+ */
+export default async function PersetujuanPage() {
+  let authContext = null;
+  try {
+    authContext = await getRscAuthContext();
+  } catch {
+    redirect("/login");
+  }
+  if (!authContext?.activeSchoolId) redirect("/onboarding");
+
+  const [pendingRes, classesRes] = await Promise.all([
+    getPendingStudentsForSchoolAction(),
+    getSchoolClassesForMoveAction(),
+  ]);
+
+  return (
+    <PersetujuanClient
+      initialPending={pendingRes.pending ?? []}
+      escalatedThresholdHours={pendingRes.escalatedThresholdHours ?? 168}
+      classes={classesRes.classes ?? []}
+    />
+  );
+}
diff --git a/src/app/(dashboard)/siswa/SiswaListClient.tsx b/src/app/(dashboard)/siswa/SiswaListClient.tsx
index e1d7644..3cf66ff 100644
--- a/src/app/(dashboard)/siswa/SiswaListClient.tsx
+++ b/src/app/(dashboard)/siswa/SiswaListClient.tsx
@@ -1,17 +1,25 @@
 "use client";
 
-import React, { useState } from "react";
+import React, { useState, useTransition } from "react";
 import Link from "next/link";
+import { toast } from "sonner";
 import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
 import { Input } from "@/components/ui/input";
 import { Badge } from "@/components/ui/badge";
 import { Button } from "@/components/ui/button";
+import {
+  approveStudentAction,
+  rejectStudentAction,
+} from "@/modules/approvals/approvals.actions";
 import {
   Users,
   Search,
   GraduationCap,
   ChevronRight,
   UserCircle,
+  Hourglass,
+  Check,
+  X,
 } from "lucide-react";
 
 interface StudentItem {
@@ -27,17 +35,60 @@ interface ClassGroup {
   students: StudentItem[];
 }
 
+/** Story 5 — Panel L1: siswa PENDING rombel yang diampu (periode aktif). */
+interface PendingStudentItem {
+  studentId: string;
+  fullName: string;
+  nis: string | null;
+  className: string;
+  escalated: boolean;
+  accountRequestedAt: string | null;
+}
+
 interface Props {
   classGroups: ClassGroup[];
   totalStudents: number;
+  pendingStudents?: PendingStudentItem[];
 }
 
-export function SiswaListClient({ classGroups, totalStudents }: Props) {
+export function SiswaListClient({ classGroups, totalStudents, pendingStudents = [] }: Props) {
   const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
   const [searchQuery, setSearchQuery] = useState<string>("");
+  const [pending, setPending] = useState<PendingStudentItem[]>(pendingStudents);
+  const [isPendingTransition, startTransition] = useTransition();
 
   const q = searchQuery.toLowerCase().trim();
 
+  const handleApprove = (studentId: string) => {
+    startTransition(async () => {
+      const res = await approveStudentAction(studentId);
+      if (res.success) {
+        toast.success("Siswa disetujui. Akun aktif seketika.");
+        setPending((prev) => prev.filter((p) => p.studentId !== studentId));
+      } else {
+        toast.error(res.message || "Aksi gagal.");
+      }
+    });
+  };
+
+  const handleReject = (studentId: string) => {
+    const reason = window.prompt("Alasan penolakan (tercatat di jejak audit):");
+    if (reason === null) return;
+    if (!reason.trim()) {
+      toast.error("Alasan penolakan wajib diisi.");
+      return;
+    }
+    startTransition(async () => {
+      const res = await rejectStudentAction(studentId, reason);
+      if (res.success) {
+        toast.success("Siswa ditolak. Siswa dapat mendaftar ulang.");
+        setPending((prev) => prev.filter((p) => p.studentId !== studentId));
+      } else {
+        toast.error(res.message || "Aksi gagal.");
+      }
+    });
+  };
+
   // Filter classes & students
   const filteredGroups = classGroups
     .filter((cg) => selectedClassId === "ALL" || cg.id === selectedClassId)
@@ -62,6 +113,61 @@ export function SiswaListClient({ classGroups, totalStudents }: Props) {
         </p>
       </div>
 
+      {/* Story 5 — Panel L1: Menunggu Persetujuan (per-rombel pengampu) */}
+      {pending.length > 0 && (
+        <Card className="border-amber-300/60 bg-amber-50/40">
+          <CardHeader className="pb-2">
+            <CardTitle className="flex items-center gap-2 text-base">
+              <Hourglass className="h-4 w-4 text-amber-600" />
+              Menunggu Persetujuan ({pending.length})
+              <span className="text-xs font-normal text-muted-foreground">
+                akun siswa PENDING rombel Anda · merah = &gt;48 jam (eskalasi)
+              </span>
+            </CardTitle>
+          </CardHeader>
+          <CardContent className="space-y-2">
+            {pending.map((p) => (
+              <div
+                key={p.studentId}
+                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3 ${
+                  p.escalated ? "border-red-300 bg-red-50/60" : "bg-white"
+                }`}
+              >
+                <div className="min-w-0">
+                  <div className="flex items-center gap-2 flex-wrap">
+                    <span className="font-medium truncate">{p.fullName}</span>
+                    {p.nis && <Badge variant="outline">NIS {p.nis}</Badge>}
+                    <Badge variant="secondary">{p.className}</Badge>
+                    {p.escalated && (
+                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
+                        Eskalasi &gt;48 jam
+                      </Badge>
+                    )}
+                  </div>
+                </div>
+                <div className="flex items-center gap-2 shrink-0">
+                  <Button
+                    size="sm"
+                    disabled={isPendingTransition}
+                    onClick={() => handleApprove(p.studentId)}
+                  >
+                    <Check className="h-4 w-4 mr-1" /> Setujui
+                  </Button>
+                  <Button
+                    size="sm"
+                    variant="outline"
+                    disabled={isPendingTransition}
+                    onClick={() => handleReject(p.studentId)}
+                  >
+                    <X className="h-4 w-4 mr-1" /> Tolak
+                  </Button>
+                </div>
+              </div>
+            ))}
+          </CardContent>
+        </Card>
+      )}
+
       {/* Filter and Search Bar */}
       <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
         {/* Class Filter Tabs / Pills */}
diff --git a/src/app/(dashboard)/siswa/page.tsx b/src/app/(dashboard)/siswa/page.tsx
index fa2b74f..1a5e9cd 100644
--- a/src/app/(dashboard)/siswa/page.tsx
+++ b/src/app/(dashboard)/siswa/page.tsx
@@ -62,10 +62,63 @@ export default async function SiswaPage() {
     };
   });
 
+  // Story 5 — Panel L1: siswa PENDING pada rombel yang diampu di periode aktif.
+  // Highlight eskalasi >48 jam dari accountRequestedAt (F2).
+  const activePeriod = await prisma.academicPeriod.findFirst({
+    where: { schoolId: activeSchoolId, status: "ACTIVE" },
+    select: { id: true },
+  });
+
+  let pendingStudents: Array<{
+    studentId: string;
+    fullName: string;
+    nis: string | null;
+    className: string;
+    escalated: boolean;
+    accountRequestedAt: string | null;
+  }> = [];
+
+  if (activePeriod) {
+    const pengampuClassIds = (
+      await prisma.teachingContext.findMany({
+        where: { teacherProfileId: profile.id, academicPeriodId: activePeriod.id },
+        select: { classId: true },
+      })
+    ).map((t) => t.classId);
+
+    if (pengampuClassIds.length > 0) {
+      const ESCALATION_L1_MS = 48 * 60 * 60 * 1000; // F2 — 48 jam (kontrak OQ-1/Story 5)
+      const pendingRows = await prisma.classStudent.findMany({
+        where: {
+          classId: { in: pengampuClassIds },
+          academicPeriodId: activePeriod.id,
+          student: { accountStatus: "PENDING", status: "ACTIVE", schoolId: activeSchoolId },
+        },
+        include: {
+          class: { select: { name: true } },
+          student: { select: { id: true, fullName: true, nis: true, accountRequestedAt: true } },
+        },
+        orderBy: { student: { accountRequestedAt: "asc" } },
+      });
+
+      pendingStudents = pendingRows.map((row) => ({
+        studentId: row.student.id,
+        fullName: row.student.fullName,
+        nis: row.student.nis,
+        className: row.class.name,
+        escalated:
+          row.student.accountRequestedAt !== null &&
+          Date.now() - row.student.accountRequestedAt.getTime() > ESCALATION_L1_MS,
+        accountRequestedAt: row.student.accountRequestedAt?.toISOString() ?? null,
+      }));
+    }
+  }
+
   return (
     <SiswaListClient
       classGroups={classGroups}
       totalStudents={uniqueStudentIds.size}
+      pendingStudents={pendingStudents}
     />
   );
 }
diff --git a/src/app/admin/AdminConsoleClient.tsx b/src/app/admin/AdminConsoleClient.tsx
new file mode 100644
index 0000000..886d632
--- /dev/null
+++ b/src/app/admin/AdminConsoleClient.tsx
@@ -0,0 +1,427 @@
+"use client";
+
+import React, { useState, useTransition } from "react";
+import { toast } from "sonner";
+import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
+import { Badge } from "@/components/ui/badge";
+import { Button } from "@/components/ui/button";
+import { Input } from "@/components/ui/input";
+import {
+  lookupSchoolsForAdminAction,
+  lookupUserForAdminAction,
+  banTeacherAction,
+  unbanTeacherAction,
+  resetTeacherPasswordAction,
+  deactivateSchoolAction,
+  reactivateSchoolAction,
+  setSchoolNpsnAction,
+  forceResetStudentPinAction,
+} from "@/modules/admin/admin.actions";
+
+interface SchoolRow {
+  id: string;
+  name: string;
+  npsn: string | null;
+  deactivatedAt: string | Date | null;
+  _count: { students: number; memberships: number; classes: number };
+}
+
+interface UserRow {
+  id: string;
+  name: string;
+  email: string;
+  platformRole: string;
+  role: string;
+  banned: boolean;
+  banReason: string | null;
+  teacherProfile: {
+    id: string;
+    activeSchoolId: string | null;
+    memberships: Array<{ school: { id: string; name: string; deactivatedAt: boolean | null } }>;
+  } | null;
+}
+
+export function AdminConsoleClient({ schools: initialSchools }: { schools: SchoolRow[] }) {
+  const [schools, setSchools] = useState<SchoolRow[]>(initialSchools);
+  const [schoolQuery, setSchoolQuery] = useState("");
+  const [userQuery, setUserQuery] = useState("");
+  const [user, setUser] = useState<UserRow | null>(null);
+  const [newPassword, setNewPassword] = useState("");
+  const [npsnInput, setNpsnInput] = useState<Record<string, string>>({});
+  const [isTransition, startTransition] = useTransition();
+
+  const searchSchools = () => {
+    startTransition(async () => {
+      const res = await lookupSchoolsForAdminAction(schoolQuery);
+      if (res.success) setSchools(res.schools as SchoolRow[]);
+    });
+  };
+
+  const searchUser = () => {
+    startTransition(async () => {
+      const res = await lookupUserForAdminAction(userQuery);
+      if (res.success) setUser(res.user as UserRow);
+      else {
+        setUser(null);
+        toast.error(res.message || "User tidak ditemukan.");
+      }
+    });
+  };
+
+  return (
+    <div className="space-y-8">
+      {/* --- Manajemen Sekolah (B5/F7/G-6) --- */}
+      <Card className="bg-slate-900 border-slate-800">
+        <CardHeader>
+          <CardTitle className="text-base">Sekolah — Nonaktifkan / Reaktivasi / NPSN</CardTitle>
+        </CardHeader>
+        <CardContent className="space-y-4">
+          <div className="flex gap-2">
+            <Input
+              placeholder="Cari sekolah (nama / NPSN)..."
+              value={schoolQuery}
+              onChange={(e) => setSchoolQuery(e.target.value)}
+              onKeyDown={(e) => e.key === "Enter" && searchSchools()}
+              className="bg-slate-800 border-slate-700"
+            />
+            <Button variant="secondary" disabled={isTransition} onClick={searchSchools}>
+              Cari
+            </Button>
+          </div>
+
+          <div className="space-y-3">
+            {schools.map((s) => {
+              const deactivated = !!s.deactivatedAt;
+              return (
+                <div key={s.id} className="rounded-lg border border-slate-800 bg-slate-900 p-4 space-y-3">
+                  <div className="flex items-center justify-between flex-wrap gap-2">
+                    <div>
+                      <div className="font-semibold">{s.name}</div>
+                      <div className="text-xs text-slate-400">
+                        NPSN: {s.npsn ?? "—"} · {s._count.students} siswa · {s._count.memberships} guru ·{" "}
+                        {s._count.classes} rombel
+                      </div>
+                    </div>
+                    {deactivated ? (
+                      <Badge className="bg-red-950 text-red-300 hover:bg-red-950">NONAKTIF</Badge>
+                    ) : (
+                      <Badge className="bg-emerald-950 text-emerald-300 hover:bg-emerald-950">AKTIF</Badge>
+                    )}
+                  </div>
+
+                  <div className="flex flex-wrap gap-2">
+                    {!deactivated ? (
+                      <Button
+                        size="sm"
+                        variant="destructive"
+                        disabled={isTransition}
+                        onClick={() => {
+                          if (!window.confirm(`Nonaktifkan sekolah "${s.name}"? Semua sesi guru & parent di-revoke dan NPSN di-clear.`)) return;
+                          startTransition(async () => {
+                            const res = await deactivateSchoolAction(s.id);
+                            if (res.success) {
+                              toast.success("Sekolah dinonaktifkan. NPSN di-clear, sesi di-revoke.");
+                              setSchools((prev) =>
+                                prev.map((x) => (x.id === s.id ? { ...x, deactivatedAt: new Date().toISOString(), npsn: null } : x))
+                              );
+                            } else toast.error(res.message || "Aksi gagal.");
+                          });
+                        }}
+                      >
+                        Nonaktifkan
+                      </Button>
+                    ) : (
+                      <Button
+                        size="sm"
+                        variant="secondary"
+                        disabled={isTransition}
+                        onClick={() =>
+                          startTransition(async () => {
+                            const res = await reactivateSchoolAction(s.id);
+                            if (res.success) {
+                              toast.success("Sekolah direaktivasi TANPA NPSN (G-6).");
+                              setSchools((prev) =>
+                                prev.map((x) => (x.id === s.id ? { ...x, deactivatedAt: null } : x))
+                              );
+                            } else toast.error(res.message || "Aksi gagal.");
+                          })
+                        }
+                      >
+                        Reaktivasi (tanpa NPSN)
+                      </Button>
+                    )}
+
+                    <div className="flex items-center gap-1">
+                      <Input
+                        placeholder="NPSN baru (8 digit)"
+                        inputMode="numeric"
+                        maxLength={8}
+                        value={npsnInput[s.id] ?? ""}
+                        onChange={(e) =>
+                          setNpsnInput((prev) => ({
+                            ...prev,
+                            [s.id]: e.target.value.replace(/\D/g, "").slice(0, 8),
+                          }))
+                        }
+                        className="w-44 bg-slate-800 border-slate-700"
+                      />
+                      <Button
+                        size="sm"
+                        variant="outline"
+                        disabled={isTransition || deactivated || (npsnInput[s.id] ?? "").length !== 8}
+                        onClick={() =>
+                          startTransition(async () => {
+                            const res = await setSchoolNpsnAction(s.id, npsnInput[s.id]);
+                            if (res.success) {
+                              toast.success("NPSN diperbarui.");
+                              setSchools((prev) =>
+                                prev.map((x) => (x.id === s.id ? { ...x, npsn: npsnInput[s.id] } : x))
+                              );
+                            } else toast.error(res.message || "Gagal (NPSN mungkin sudah dipakai sekolah lain).");
+                          })
+                        }
+                      >
+                        Set NPSN
+                      </Button>
+                    </div>
+                  </div>
+                </div>
+              );
+            })}
+            {schools.length === 0 && (
+              <p className="text-sm text-slate-500">Cari sekolah untuk mulai mengelola.</p>
+            )}
+          </div>
+        </CardContent>
+      </Card>
+
+      {/* --- Manajemen User (B5/F6/G-3) --- */}
+      <Card className="bg-slate-900 border-slate-800">
+        <CardHeader>
+          <CardTitle className="text-base">User — Ban / Unban / Reset Password</CardTitle>
+        </CardHeader>
+        <CardContent className="space-y-4">
+          <div className="flex gap-2">
+            <Input
+              placeholder="Email user..."
+              value={userQuery}
+              onChange={(e) => setUserQuery(e.target.value)}
+              onKeyDown={(e) => e.key === "Enter" && searchUser()}
+              className="bg-slate-800 border-slate-700"
+            />
+            <Button variant="secondary" disabled={isTransition} onClick={searchUser}>
+              Cari
+            </Button>
+          </div>
+
+          {user && (
+            <div className="rounded-lg border border-slate-800 p-4 space-y-3">
+              <div className="flex items-center justify-between flex-wrap gap-2">
+                <div>
+                  <div className="font-semibold">
+                    {user.name} <span className="text-slate-400 text-sm">({user.email})</span>
+                  </div>
+                  <div className="text-xs text-slate-400">
+                    platformRole: {user.platformRole} · role: {user.role}
+                    {user.banned && user.banReason ? ` · alasan ban: ${user.banReason}` : ""}
+                  </div>
+                </div>
+                {user.platformRole === "ADMIN" && (
+                  <Badge className="bg-amber-950 text-amber-300 hover:bg-amber-950">
+                    SUPERADMIN — ban/reset password dilarang (F6/G-3)
+                  </Badge>
+                )}
+                {user.banned && (
+                  <Badge className="bg-red-950 text-red-300 hover:bg-red-950">BANNED</Badge>
+                )}
+              </div>
+
+              {user.platformRole !== "ADMIN" && (
+                <div className="flex flex-wrap gap-2">
+                  {!user.banned ? (
+                    <Button
+                      size="sm"
+                      variant="destructive"
+                      disabled={isTransition}
+                      onClick={() => {
+                        const reason = window.prompt("Alasan ban:");
+                        if (reason === null) return;
+                        startTransition(async () => {
+                          const res = await banTeacherAction(user.id, reason);
+                          if (res.success) {
+                            toast.success("User di-ban. SEMUA sesinya sudah di-revoke (B5).");
+                            setUser({ ...user, banned: true, banReason: reason });
+                          } else toast.error(res.message || "Aksi gagal.");
+                        });
+                      }}
+                    >
+                      Ban
+                    </Button>
+                  ) : (
+                    <Button
+                      size="sm"
+                      variant="secondary"
+                      disabled={isTransition}
+                      onClick={() =>
+                        startTransition(async () => {
+                          const res = await unbanTeacherAction(user.id);
+                          if (res.success) {
+                            toast.success("User di-unban.");
+                            setUser({ ...user, banned: false, banReason: null });
+                          } else toast.error(res.message || "Aksi gagal.");
+                        })
+                      }
+                    >
+                      Unban
+                    </Button>
+                  )}
+
+                  <div className="flex items-center gap-1">
+                    <Input
+                      type="password"
+                      placeholder="Password baru (min 8)"
+                      value={newPassword}
+                      onChange={(e) => setNewPassword(e.target.value)}
+                      className="w-56 bg-slate-800 border-slate-700"
+                    />
+                    <Button
+                      size="sm"
+                      variant="outline"
+                      disabled={isTransition || newPassword.length < 8}
+                      onClick={() =>
+                        startTransition(async () => {
+                          const res = await resetTeacherPasswordAction(user.id, newPassword);
+                          if (res.success) {
+                            toast.success("Password direset. SEMUA sesi lama hangus (B5).");
+                            setNewPassword("");
+                          } else toast.error(res.message || "Aksi gagal.");
+                        })
+                      }
+                    >
+                      Reset Password
+                    </Button>
+                  </div>
+                </div>
+              )}
+            </div>
+          )}
+        </CardContent>
+      </Card>
+
+      {/* --- Force approve/reject siswa (L3) --- */}
+      <Card className="bg-slate-900 border-slate-800">
+        <CardHeader>
+          <CardTitle className="text-base">Force Approve / Reject Siswa (L3, lintas-sekolah)</CardTitle>
+        </CardHeader>
+        <CardContent>
+          <ForceDecisionBlock disabled={isTransition} />
+        </CardContent>
+      </Card>
+
+      {/* --- Force reset PIN siswa (B2/G-1) --- */}
+      <Card className="bg-slate-900 border-slate-800">
+        <CardHeader>
+          <CardTitle className="text-base">Force Reset PIN Siswa (L3)</CardTitle>
+        </CardHeader>
+        <CardContent className="space-y-3">
+          <ForceResetPinBlock disabled={isTransition} />
+        </CardContent>
+      </Card>
+    </div>
+  );
+}
+
+function ForceDecisionBlock({ disabled }: { disabled: boolean }) {
+  const [studentId, setStudentId] = useState("");
+  const [reason, setReason] = useState("");
+  const [, startTransition] = useTransition();
+
+  return (
+    <div className="space-y-2">
+      <div className="flex flex-wrap gap-2 items-center">
+        <Input
+          placeholder="Student ID (cuid)..."
+          value={studentId}
+          onChange={(e) => setStudentId(e.target.value)}
+          className="bg-slate-800 border-slate-700 w-72"
+        />
+        <Input
+          placeholder="Alasan (untuk reject)..."
+          value={reason}
+          onChange={(e) => setReason(e.target.value)}
+          className="bg-slate-800 border-slate-700 w-56"
+        />
+      </div>
+      <div className="flex gap-2">
+        <Button
+          size="sm"
+          disabled={disabled || studentId.length < 10}
+          onClick={() =>
+            startTransition(async () => {
+              const { forceApproveStudentAction } = await import("@/modules/admin/admin.actions");
+              const res = await forceApproveStudentAction(studentId);
+              if (res.success) toast.success("Siswa di-force approve (ter-audit L3).");
+              else toast.error(res.message || "Aksi gagal.");
+            })
+          }
+        >
+          Force Approve
+        </Button>
+        <Button
+          size="sm"
+          variant="outline"
+          disabled={disabled || studentId.length < 10 || !reason.trim()}
+          onClick={() =>
+            startTransition(async () => {
+              const { forceRejectStudentAction } = await import("@/modules/admin/admin.actions");
+              const res = await forceRejectStudentAction(studentId, reason);
+              if (res.success) toast.success("Siswa di-force reject (ter-audit L3).");
+              else toast.error(res.message || "Aksi gagal.");
+            })
+          }
+        >
+          Force Reject
+        </Button>
+      </div>
+    </div>
+  );
+}
+
+function ForceResetPinBlock({ disabled }: { disabled: boolean }) {
+  const [studentId, setStudentId] = useState("");
+  const [pin, setPin] = useState("");
+  const [, startTransition] = useTransition();
+
+  return (
+    <div className="flex flex-wrap gap-2 items-center">
+      <Input
+        placeholder="Student ID (cuid)..."
+        value={studentId}
+        onChange={(e) => setStudentId(e.target.value)}
+        className="bg-slate-800 border-slate-700 w-72"
+      />
+      <Input
+        inputMode="numeric"
+        maxLength={4}
+        placeholder="PIN baru"
+        value={pin}
+        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
+        className="bg-slate-800 border-slate-700 w-32"
+      />
+      <Button
+        size="sm"
+        variant="outline"
+        disabled={disabled || studentId.length < 10 || pin.length !== 4}
+        onClick={() =>
+          startTransition(async () => {
+            const res = await forceResetStudentPinAction(studentId, pin);
+            if (res.success) toast.success("PIN siswa direset (ter-audit).");
+            else toast.error(res.message || "Aksi gagal.");
+          })
+        }
+      >
+        Reset PIN Siswa
+      </Button>
+    </div>
+  );
+}
diff --git a/src/app/admin/audit/AuditViewer.tsx b/src/app/admin/audit/AuditViewer.tsx
new file mode 100644
index 0000000..6823bc4
--- /dev/null
+++ b/src/app/admin/audit/AuditViewer.tsx
@@ -0,0 +1,137 @@
+"use client";
+
+import React from "react";
+import { useRouter } from "next/navigation";
+import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
+import { Badge } from "@/components/ui/badge";
+import { Button } from "@/components/ui/button";
+import { Input } from "@/components/ui/input";
+
+interface AuditItem {
+  id: string;
+  actorType: string;
+  actorId: string | null;
+  action: string;
+  targetType: string;
+  targetId: string | null;
+  metadata: unknown;
+  ip: string | null;
+  createdAt: string;
+}
+
+interface Props {
+  items: AuditItem[];
+  total: number;
+  page: number;
+  pageSize: number;
+  actions: string[];
+  filters: { action: string; targetType: string; actorId: string };
+}
+
+export function AuditViewer({ items, total, page, pageSize, actions, filters }: Props) {
+  const router = useRouter();
+  const [action, setAction] = React.useState(filters.action);
+  const [actorId, setActorId] = React.useState(filters.actorId);
+  const [targetType, setTargetType] = React.useState(filters.targetType);
+
+  const navigate = (nextPage: number, overrides?: { action?: string; actorId?: string; targetType?: string }) => {
+    const params = new URLSearchParams();
+    const a = overrides?.action ?? action;
+    const act = overrides?.actorId ?? actorId;
+    const tt = overrides?.targetType ?? targetType;
+    if (a) params.set("action", a);
+    if (act) params.set("actorId", act);
+    if (tt) params.set("targetType", tt);
+    if (nextPage > 1) params.set("page", String(nextPage));
+    router.push(`/admin/audit${params.toString() ? `?${params.toString()}` : ""}`);
+  };
+
+  const totalPages = Math.max(1, Math.ceil(total / pageSize));
+
+  return (
+    <div className="space-y-4">
+      <h1 className="text-2xl font-bold">AuditLog — {total} entri</h1>
+
+      <Card className="bg-slate-900 border-slate-800">
+        <CardHeader>
+          <CardTitle className="text-sm">Filter</CardTitle>
+        </CardHeader>
+        <CardContent className="flex flex-wrap gap-2">
+          <select
+            className="h-9 rounded-md border border-slate-700 bg-slate-800 px-3 text-sm"
+            value={action}
+            onChange={(e) => navigate(1, { action: e.target.value })}
+          >
+            <option value="">— Semua aksi —</option>
+            {actions.map((a) => (
+              <option key={a} value={a}>
+                {a}
+              </option>
+            ))}
+          </select>
+          <Input
+            placeholder="Actor ID..."
+            value={actorId}
+            onChange={(e) => setActorId(e.target.value)}
+            className="bg-slate-800 border-slate-700 w-64"
+          />
+          <Input
+            placeholder="Target type (STUDENT/SCHOOL/USER...)"
+            value={targetType}
+            onChange={(e) => setTargetType(e.target.value)}
+            className="bg-slate-800 border-slate-700 w-72"
+          />
+          <Button size="sm" variant="secondary" onClick={() => navigate(1)}>
+            Terapkan
+          </Button>
+          <Button
+            size="sm"
+            variant="ghost"
+            onClick={() => {
+              setAction("");
+              setActorId("");
+              setTargetType("");
+              navigate(1, { action: "", actorId: "", targetType: "" });
+            }}
+          >
+            Reset
+          </Button>
+        </CardContent>
+      </Card>
+
+      <div className="space-y-1.5">
+        {items.map((i) => (
+          <div
+            key={i.id}
+            className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 flex flex-wrap items-center gap-2 text-xs"
+          >
+            <Badge variant="outline" className="border-slate-700 text-slate-300">
+              {i.actorType}
+            </Badge>
+            <span className="font-mono font-semibold text-emerald-400">{i.action}</span>
+            <span className="text-slate-400">
+              {i.targetType}
+              {i.targetId ? `/${i.targetId}` : ""}
+            </span>
+            <span className="text-slate-500 ml-auto">{new Date(i.createdAt).toLocaleString("id-ID")}</span>
+          </div>
+        ))}
+        {items.length === 0 && (
+          <p className="text-sm text-slate-500 py-8 text-center">Tidak ada entri untuk filter ini.</p>
+        )}
+      </div>
+
+      <div className="flex items-center justify-between">
+        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => navigate(page - 1)}>
+          ← Sebelumnya
+        </Button>
+        <span className="text-xs text-slate-400">
+          Halaman {page} / {totalPages}
+        </span>
+        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => navigate(page + 1)}>
+          Berikutnya →
+        </Button>
+      </div>
+    </div>
+  );
+}
diff --git a/src/app/admin/audit/page.tsx b/src/app/admin/audit/page.tsx
new file mode 100644
index 0000000..facd85d
--- /dev/null
+++ b/src/app/admin/audit/page.tsx
@@ -0,0 +1,63 @@
+import { prisma } from "@/lib/auth";
+import { AuditViewer } from "./AuditViewer";
+
+/**
+ * Story 5 — AuditLog viewer (OQ-8): lintas-sekolah, filter aktor/aksi/target,
+ * terpaginasi via index [actorId, createdAt] & [targetType, targetId] (N4).
+ */
+export default async function AdminAuditPage({
+  searchParams,
+}: {
+  searchParams: Promise<{ page?: string; action?: string; targetType?: string; actorId?: string }>;
+}) {
+  const sp = await searchParams;
+  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
+  const pageSize = 25;
+
+  const where = {
+    ...(sp.action ? { action: sp.action } : {}),
+    ...(sp.targetType ? { targetType: sp.targetType } : {}),
+    ...(sp.actorId ? { actorId: sp.actorId } : {}),
+  };
+
+  const [items, total, distinctActions] = await Promise.all([
+    prisma.auditLog.findMany({
+      where,
+      orderBy: { createdAt: "desc" },
+      skip: (page - 1) * pageSize,
+      take: pageSize,
+      select: {
+        id: true,
+        actorType: true,
+        actorId: true,
+        action: true,
+        targetType: true,
+        targetId: true,
+        metadata: true,
+        ip: true,
+        createdAt: true,
+      },
+    }),
+    prisma.auditLog.count({ where }),
+    prisma.auditLog.findMany({
+      distinct: ["action"],
+      select: { action: true },
+      take: 100,
+      orderBy: { action: "asc" },
+    }),
+  ]);
+
+  return (
+    <AuditViewer
+      items={items.map((i) => ({
+        ...i,
+        createdAt: i.createdAt.toISOString(),
+      }))}
+      total={total}
+      page={page}
+      pageSize={pageSize}
+      actions={distinctActions.map((a) => a.action)}
+      filters={{ action: sp.action ?? "", targetType: sp.targetType ?? "", actorId: sp.actorId ?? "" }}
+    />
+  );
+}
diff --git a/src/app/admin/layout.tsx b/src/app/admin/layout.tsx
new file mode 100644
index 0000000..e153cca
--- /dev/null
+++ b/src/app/admin/layout.tsx
@@ -0,0 +1,44 @@
+import { redirect } from "next/navigation";
+import Link from "next/link";
+import { ShieldCheck } from "lucide-react";
+import { requireSuperAdmin } from "@/lib/superadmin";
+
+/**
+ * Story 5 — Layout area backstop superadmin `/admin/*` (F3).
+ * Route group TOP-LEVEL terpisah dari (dashboard): superadmin tidak punya
+ * TeacherProfile/activeSchoolId — menest di (dashboard) akan ter-redirect
+ * ke /onboarding. Validasi nyata server-side via requireSuperAdmin();
+ * percobaan akses non-admin ter-audit dengan dedup 60 detik (OQ-7/G-9).
+ */
+export default async function AdminLayout({ children }: { children: React.ReactNode }) {
+  try {
+    await requireSuperAdmin();
+  } catch {
+    redirect("/login");
+  }
+
+  return (
+    <div className="min-h-screen bg-slate-950 text-slate-100">
+      <header className="border-b border-slate-800">
+        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
+          <Link href="/admin" className="flex items-center gap-2 font-semibold">
+            <ShieldCheck className="h-5 w-5 text-emerald-400" />
+            KLASSA Admin — Backstop Platform
+          </Link>
+          <nav className="flex items-center gap-4 text-sm">
+            <Link href="/admin" className="hover:text-emerald-400 transition-colors">
+              Konsol
+            </Link>
+            <Link href="/admin/audit" className="hover:text-emerald-400 transition-colors">
+              AuditLog
+            </Link>
+          </nav>
+        </div>
+      </header>
+      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
+      <footer className="max-w-6xl mx-auto px-4 py-6 text-xs text-slate-500">
+        Setiap aksi tercatat di AuditLog. Backstop platform-level — bukan gerbang harian.
+      </footer>
+    </div>
+  );
+}
diff --git a/src/app/admin/page.tsx b/src/app/admin/page.tsx
new file mode 100644
index 0000000..3244a07
--- /dev/null
+++ b/src/app/admin/page.tsx
@@ -0,0 +1,22 @@
+import { prisma } from "@/lib/auth";
+import { AdminConsoleClient } from "./AdminConsoleClient";
+
+/**
+ * Story 5 — Konsol superadmin (CAP-7). Data awal: seluruh sekolah (OQ-8 —
+ * lintas-sekolah tanpa membership). Proteksi diwarisi dari layout /admin.
+ */
+export default async function AdminPage() {
+  const schools = await prisma.school.findMany({
+    select: {
+      id: true,
+      name: true,
+      npsn: true,
+      deactivatedAt: true,
+      _count: { select: { students: true, memberships: true, classes: true } },
+    },
+    orderBy: { name: "asc" },
+    take: 50,
+  });
+
+  return <AdminConsoleClient schools={schools} />;
+}
diff --git a/src/components/layout/NotificationBell.tsx b/src/components/layout/NotificationBell.tsx
new file mode 100644
index 0000000..50661cc
--- /dev/null
+++ b/src/components/layout/NotificationBell.tsx
@@ -0,0 +1,95 @@
+"use client";
+
+import React, { useEffect, useState, useTransition } from "react";
+import { Bell } from "lucide-react";
+import {
+  getMyNotificationsAction,
+  markMyNotificationsReadAction,
+} from "@/modules/approvals/approvals.actions";
+
+interface NotificationItem {
+  id: string;
+  type: string;
+  payload: { title?: string; body?: string; link?: string } | null;
+  readAt: string | Date | null;
+  createdAt: string | Date;
+}
+
+/**
+ * Story 5 — badge/feed notifikasi header guru (OQ-3). Aggregate per aksi;
+ * baca unread memakai index [userId, readAt] (G-10).
+ */
+export function NotificationBell() {
+  const [items, setItems] = useState<NotificationItem[]>([]);
+  const [unread, setUnread] = useState(0);
+  const [open, setOpen] = useState(false);
+  const [, startTransition] = useTransition();
+
+  useEffect(() => {
+    let mounted = true;
+    startTransition(async () => {
+      try {
+        const res = await getMyNotificationsAction();
+        if (mounted && res.success) {
+          setItems(res.items as NotificationItem[]);
+          setUnread(res.unreadCount);
+        }
+      } catch {
+        /* tenant tanpa notifikasi — diamkan */
+      }
+    });
+    return () => {
+      mounted = false;
+    };
+  }, []);
+
+  const markAll = () => {
+    startTransition(async () => {
+      const res = await markMyNotificationsReadAction();
+      if (res.success) {
+        setUnread(0);
+        setItems((prev) => prev.map((i) => ({ ...i, readAt: new Date().toISOString() })));
+      }
+    });
+  };
+
+  return (
+    <div className="relative">
+      <button
+        type="button"
+        aria-label="Notifikasi"
+        onClick={() => {
+          setOpen((o) => !o);
+          if (!open && unread > 0) markAll();
+        }}
+        className="relative rounded-full p-2 hover:bg-muted transition-colors"
+      >
+        <Bell className="h-4 w-4" />
+        {unread > 0 && (
+          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
+            {unread > 9 ? "9+" : unread}
+          </span>
+        )}
+      </button>
+
+      {open && (
+        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border bg-popover shadow-lg z-50">
+          <div className="px-3 py-2 text-xs font-semibold border-b">Notifikasi</div>
+          {items.length === 0 ? (
+            <p className="px-3 py-6 text-center text-xs text-muted-foreground">Belum ada notifikasi.</p>
+          ) : (
+            items.map((n) => (
+              <div key={n.id} className="px-3 py-2 border-b last:border-b-0">
+                <div className="text-xs font-medium">{n.payload?.title ?? n.type}</div>
+                <div className="text-xs text-muted-foreground">{n.payload?.body}</div>
+                <div className="text-[10px] text-muted-foreground mt-1">
+                  {new Date(n.createdAt).toLocaleString("id-ID")}
+                </div>
+              </div>
+            ))
+          )}
+        </div>
+      )}
+    </div>
+  );
+}
diff --git a/src/components/layout/Sidebar.tsx b/src/components/layout/Sidebar.tsx
index 6129917..eeae752 100644
--- a/src/components/layout/Sidebar.tsx
+++ b/src/components/layout/Sidebar.tsx
@@ -14,6 +14,7 @@ import {
   FileQuestion,
   Settings,
   BookOpenCheck,
+  ClipboardCheck,
 } from "lucide-react";
 import { cn } from "@/lib/utils";
 import { KlassaLogo } from "@/components/brand";
@@ -23,6 +24,7 @@ const mainNavItems = [
   { href: "/hari-ini", label: "Hari Ini", icon: Calendar },
   { href: "/kelas", label: "Kelas Saya", icon: Users },
   { href: "/siswa", label: "Daftar Siswa", icon: UserCircle },
+  { href: "/persetujuan", label: "Persetujuan", icon: ClipboardCheck },
   { href: "/ai-studio", label: "AI Studio", icon: Sparkles, isAi: true },
   { href: "/quiz", label: "Quiz & Ujian", icon: FileQuestion },
   { href: "/laporan", label: "Laporan & Nilai", icon: BarChart },
diff --git a/src/components/layout/Topbar.tsx b/src/components/layout/Topbar.tsx
index 4fc0f75..b689d15 100644
--- a/src/components/layout/Topbar.tsx
+++ b/src/components/layout/Topbar.tsx
@@ -20,6 +20,7 @@ import {
 import { buttonVariants } from "@/components/ui/button";
 import { cn } from "@/lib/utils";
 import { KlassaLogo } from "@/components/brand";
+import { NotificationBell } from "./NotificationBell";
 
 const mainNavItems = [
   { href: "/", label: "Beranda", icon: Home, exact: true },
@@ -82,6 +83,7 @@ export function Topbar() {
             <Sparkles className="h-3.5 w-3.5 text-indigo-600 animate-pulse" />
             <span>AI Studio</span>
           </Link>
+          <NotificationBell />
           <Link
             href="/pengaturan/setup"
             aria-label="Pengaturan Akun dan Sekolah"
diff --git a/src/lib/__tests__/story5-session-guards.int.test.ts b/src/lib/__tests__/story5-session-guards.int.test.ts
new file mode 100644
index 0000000..6f877af
--- /dev/null
+++ b/src/lib/__tests__/story5-session-guards.int.test.ts
@@ -0,0 +1,193 @@
+import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
+import { prisma } from "@/lib/auth";
+import { signStudentSessionToken, verifyStudentSession } from "@/modules/student-auth/student-session";
+import { SuperAdminRequiredError } from "@/lib/superadmin";
+
+/**
+ * Story 5 — Verifikasi choke-point fail-closed sesi EXISTING (F7) dan guard
+ * superadmin dengan audit `ADMIN_ACCESS_DENIED` ber-dedup (OQ-7/F10/G-9).
+ *
+ * `next/headers` (cookies/headers) di-mock agar choke-point nyata
+ * (`verifyStudentSession`, `verifyParentStudentRelation`, `requireSuperAdmin`)
+ * tereksekusi penuh; DB tetap real.
+ */
+
+const cookieStore: Record<string, { value: string }> = {};
+
+vi.mock("next/headers", () => ({
+  cookies: vi.fn(async () => ({
+    get: (name: string) => cookieStore[name],
+    set: vi.fn(),
+    delete: vi.fn((name: string) => {
+      delete cookieStore[name];
+    }),
+  })),
+  headers: vi.fn(async () => new Headers()),
+}));
+
+vi.mock("@/lib/auth", async (importOriginal) => {
+  const actual = await importOriginal<typeof import("@/lib/auth")>();
+  return {
+    ...actual,
+    auth: {
+      api: {
+        getSession: vi.fn(async () => mockedSession),
+      },
+    },
+  };
+});
+
+import { requireSuperAdmin } from "@/lib/superadmin";
+import { verifyParentStudentRelation } from "@/lib/authorization";
+
+let mockedSession: { user: { id: string } } | null = null;
+
+describe("Story 5 — fail-closed sesi existing & guard superadmin ber-audit", () => {
+  let dbAvailable = false;
+  const ts = Date.now();
+  let schoolId: string;
+  let studentId: string;
+  let studentToken: string;
+  let parentUserId: string;
+  let teacherNonAdminId: string;
+
+  beforeAll(async () => {
+    try {
+      const school = await prisma.school.create({
+        data: { name: `S5 Guard ${ts}`, normalizedName: `s5 guard ${ts}` },
+      });
+      schoolId = school.id;
+
+      const student = await prisma.student.create({
+        data: {
+          schoolId,
+          fullName: "Siswa Guard",
+          nis: `GD${`${ts}`.slice(-7)}`,
+          accountStatus: "ACTIVE",
+          status: "ACTIVE",
+          pinUpdatedAt: new Date(),
+        },
+      });
+      studentId = student.id;
+
+      // Token sesi siswa valid (HMAC asli via signStudentSessionToken)
+      studentToken = signStudentSessionToken({
+        studentId,
+        schoolId,
+        classId: "c",
+        academicPeriodId: "p",
+        nis: student.nis!,
+        fullName: student.fullName,
+        pinUpdatedAt: student.pinUpdatedAt!.toISOString(),
+      });
+
+      parentUserId = `s5g-pr-${ts}`;
+      teacherNonAdminId = `s5g-ta-${ts}`;
+      await prisma.user.create({
+        data: { id: parentUserId, email: `${parentUserId}@test.com`, name: "Ortu Guard", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), platformRole: "USER", role: "USER" },
+      });
+      await prisma.user.create({
+        data: { id: teacherNonAdminId, email: `${teacherNonAdminId}@test.com`, name: "Guru Guard", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), platformRole: "MODERATOR", role: "MODERATOR" },
+      });
+      const parentProfile = await prisma.parentProfile.create({ data: { userId: parentUserId } });
+      await prisma.parentStudentRelation.create({
+        data: { parentProfileId: parentProfile.id, studentId },
+      });
+
+      dbAvailable = true;
+    } catch (err) {
+      console.warn("[s5 guard test] DB unavailable:", err);
+    }
+  });
+
+  afterAll(async () => {
+    if (!dbAvailable) return;
+    try {
+      await prisma.parentStudentRelation.deleteMany({ where: { student: { schoolId } } });
+      await prisma.parentProfile.deleteMany({ where: { userId: parentUserId } });
+      await prisma.auditLog.deleteMany({ where: { actorId: { in: [teacherNonAdminId] } } });
+      await prisma.user.deleteMany({ where: { id: { in: [parentUserId, teacherNonAdminId] } } });
+      await prisma.student.delete({ where: { id: studentId } });
+      await prisma.school.delete({ where: { id: schoolId } });
+    } catch {
+      /* best-effort */
+    }
+  });
+
+  beforeEach(() => {
+    if (!dbAvailable) return;
+    Object.keys(cookieStore).forEach((k) => delete cookieStore[k]);
+    delete cookieStore["better-auth.session_token"];
+  });
+
+  it("F7: sesi existing siswa valid → terverifikasi; sekolah nonaktif → null seketika", async () => {
+    cookieStore["klassa_student_session"] = { value: studentToken };
+
+    const before = await verifyStudentSession();
+    expect(before).not.toBeNull();
+    expect(before!.studentId).toBe(studentId);
+
+    // Nonaktifkan sekolah
+    await prisma.school.update({ where: { id: schoolId }, data: { deactivatedAt: new Date() } });
+    const during = await verifyStudentSession();
+    expect(during).toBeNull(); // fail-closed tanpa revoke token
+
+    // Reaktivasi → sesi valid kembali (skema reaktivasi G-6)
+    await prisma.school.update({ where: { id: schoolId }, data: { deactivatedAt: null } });
+    const after = await verifyStudentSession();
+    expect(after).not.toBeNull();
+  });
+
+  it("Glosarium §9.2: sesi siswa PENDING → null (accountStatus gate tetap kaku)", async () => {
+    cookieStore["klassa_student_session"] = { value: studentToken };
+    await prisma.student.update({ where: { id: studentId }, data: { accountStatus: "PENDING" } });
+    const res = await verifyStudentSession();
+    expect(res).toBeNull();
+    await prisma.student.update({ where: { id: studentId }, data: { accountStatus: "ACTIVE" } });
+  });
+
+  it("F7: layanan baca parent fail-closed saat sekolah nonaktif", async () => {
+    mockedSession = { user: { id: parentUserId } };
+
+    const before = await verifyParentStudentRelation(studentId);
+    expect(before.relation.student.id).toBe(studentId);
+
+    await prisma.school.update({ where: { id: schoolId }, data: { deactivatedAt: new Date() } });
+    await expect(verifyParentStudentRelation(studentId)).rejects.toThrow();
+    await prisma.school.update({ where: { id: schoolId }, data: { deactivatedAt: null } });
+  });
+
+  it("OQ-7/F10/G-9: guard deny-by-default (MODERATOR tertolak), tanpa sesi ditolak, denial ter-audit ber-dedup 60 detik", async () => {
+    // Sesi valid guru dengan platformRole "MODERATOR" → deny + audit
+    mockedSession = { user: { id: teacherNonAdminId } };
+
+    await expect(requireSuperAdmin()).rejects.toBeInstanceOf(SuperAdminRequiredError);
+    await expect(requireSuperAdmin()).rejects.toBeInstanceOf(SuperAdminRequiredError);
+    await expect(requireSuperAdmin()).rejects.toBeInstanceOf(SuperAdminRequiredError);
+
+    // Dedup 60 detik: 3x denial → hanya 1 entri audit
+    const logs = await prisma.auditLog.count({
+      where: { actorId: teacherNonAdminId, action: "ADMIN_ACCESS_DENIED" },
+    });
+    expect(logs).toBe(1);
+
+    // Tanpa sesi → denied (tanpa menulis audit baru — bukan sesi valid)
+    mockedSession = null;
+    const logsBefore = await prisma.auditLog.count({
+      where: { actorId: teacherNonAdminId, action: "ADMIN_ACCESS_DENIED" },
+    });
+    await expect(requireSuperAdmin()).rejects.toBeInstanceOf(SuperAdminRequiredError);
+    const logsAfter = await prisma.auditLog.count({
+      where: { actorId: teacherNonAdminId, action: "ADMIN_ACCESS_DENIED" },
+    });
+    expect(logsAfter).toBe(logsBefore);
+
+    // Superadmin sah (fallback DB lookup) → lolos
+    const superadmin = await prisma.user.findFirst({ where: { platformRole: "ADMIN" } });
+    if (superadmin) {
+      mockedSession = { user: { id: superadmin.id } };
+      const ctx = await requireSuperAdmin();
+      expect(ctx.userId).toBe(superadmin.id);
+    }
+  });
+});
diff --git a/src/lib/__tests__/superadmin.test.ts b/src/lib/__tests__/superadmin.test.ts
new file mode 100644
index 0000000..99d689e
--- /dev/null
+++ b/src/lib/__tests__/superadmin.test.ts
@@ -0,0 +1,50 @@
+import { describe, it, expect } from "vitest";
+import {
+  SuperAdminRequiredError,
+  SUPERADMIN_STATIC_ERROR_MESSAGE,
+  isPlatformAdminRole,
+} from "../superadmin";
+
+/**
+ * Unit test kontrak terkeras deferred work Story 1 (requireSuperAdmin):
+ * - strict equality `platformRole === "ADMIN"` — nilai asing tertolak
+ * - satu jenis error dengan pesan statis identik semua jalur (anti-enumerasi)
+ */
+describe("superadmin guard contract (deferred work Story 1)", () => {
+  describe("isPlatformAdminRole — deny-by-default strict equality", () => {
+    it("menerima hanya string 'ADMIN' exact", () => {
+      expect(isPlatformAdminRole("ADMIN")).toBe(true);
+    });
+
+    it("menolak nilai asing seperti 'MODERATOR' (bukan pola !== 'USER')", () => {
+      expect(isPlatformAdminRole("MODERATOR")).toBe(false);
+    });
+
+    it("menolak 'USER', 'admin' lowercase, dan ' ADMIN' ber-spasi", () => {
+      expect(isPlatformAdminRole("USER")).toBe(false);
+      expect(isPlatformAdminRole("admin")).toBe(false);
+      expect(isPlatformAdminRole(" ADMIN")).toBe(false);
+    });
+
+    it("menolak null, undefined, angka, dan objek", () => {
+      expect(isPlatformAdminRole(null)).toBe(false);
+      expect(isPlatformAdminRole(undefined)).toBe(false);
+      expect(isPlatformAdminRole(123)).toBe(false);
+      expect(isPlatformAdminRole({ role: "ADMIN" })).toBe(false);
+    });
+  });
+
+  describe("SuperAdminRequiredError — satu jenis error, pesan statis identik", () => {
+    it("pesan selalu identik STATIC_ERROR_MESSAGE semua instansiasi", () => {
+      const a = new SuperAdminRequiredError();
+      const b = new SuperAdminRequiredError();
+      expect(a.message).toBe(SUPERADMIN_STATIC_ERROR_MESSAGE);
+      expect(b.message).toBe(a.message);
+      expect(a.name).toBe("SuperAdminRequiredError");
+    });
+
+    it("adalah instance Error sehingga catch (e) umum tetap menangkap", () => {
+      expect(new SuperAdminRequiredError()).toBeInstanceOf(Error);
+    });
+  });
+});
diff --git a/src/lib/auth.ts b/src/lib/auth.ts
index 931b7c6..40f9dbd 100644
--- a/src/lib/auth.ts
+++ b/src/lib/auth.ts
@@ -1,4 +1,5 @@
 import { betterAuth } from "better-auth";
+import { admin } from "better-auth/plugins";
 import { prismaAdapter } from "better-auth/adapters/prisma";
 import { PrismaClient } from "@prisma/client";
 import { Pool } from "pg";
@@ -98,4 +99,26 @@ export const auth = betterAuth({
         enabled: true,
         autoSignIn: true
     },
+    // Story 5 (F6): plugin admin untuk siklus hidup sesi (banUser/setUserPassword/
+    // revokeUserSessions). Kolom `user.role` dikelola plugin; `platformRole` tetap
+    // kanonik untuk requireSuperAdmin() — seeder menulis keduanya sinkron.
+    plugins: [
+        admin({
+            adminRoles: ["ADMIN"],
+            defaultRole: "USER",
+        }),
+    ],
+    // Story 5 (OQ-6 + G-5): fail-closed sekolah nonaktif pada pembuatan sesi BARU
+    // guru DAN parent. Sesi existing ditangani revoke saat deaktivasi (B5).
+    databaseHooks: {
+        session: {
+            create: {
+                async before(session): Promise<boolean> {
+                    // Logika resolusi persona diekstrak ke src/lib/session-guards.ts agar testable.
+                    const { assertSessionCreationAllowed } = await import("./session-guards");
+                    return assertSessionCreationAllowed(session?.userId);
+                },
+            },
+        },
+    },
 });
diff --git a/src/lib/authorization.ts b/src/lib/authorization.ts
index a194550..fdf3f92 100644
--- a/src/lib/authorization.ts
+++ b/src/lib/authorization.ts
@@ -474,6 +474,15 @@ export async function verifyParentStudentRelation(studentId: string) {
     throw new Error("Forbidden: Anda tidak memiliki akses terhadap data siswa ini");
   }
 
+  // Story 5 F7: sekolah nonaktif → semua layanan baca parent fail-closed.
+  const school = await prisma.school.findUnique({
+    where: { id: relation.student.schoolId },
+    select: { deactivatedAt: true },
+  });
+  if (school?.deactivatedAt) {
+    throw new Error("Forbidden: Anda tidak memiliki akses terhadap data siswa ini");
+  }
+
   return { session, parentProfile, relation, student: relation.student };
 }
 
diff --git a/src/lib/session-guards.ts b/src/lib/session-guards.ts
new file mode 100644
index 0000000..5421aa5
--- /dev/null
+++ b/src/lib/session-guards.ts
@@ -0,0 +1,61 @@
+import { prisma } from "@/lib/auth";
+
+/**
+ * Story 5 — fail-closed sekolah nonaktif pada pembuatan sesi BARU Better Auth
+ * (OQ-6 + G-5). Diekstrak dari `src/lib/auth.ts` agar unit/integration-testable;
+ * hook `databaseHooks.session.create.before` di auth.ts memanggil fungsi ini.
+ *
+ * Persona yang dicek:
+ * - Guru: workspace aktifnya (TeacherProfile.activeSchoolId) sekolah nonaktif → deny.
+ * - Parent: sekolah dari relasi siswanya (ParentStudentRelation → student.schoolId)
+ *   nonaktif → deny.
+ * - Persona lain / gagal resolusi → deny-by-default (fail-closed).
+ *
+ * Sesi EXISTING ditangani revoke saat deaktivasi sekolah (B5) — bukan di sini.
+ */
+export async function assertSessionCreationAllowed(userId: string): Promise<boolean> {
+  if (!userId) return false;
+  try {
+    // Persona guru: workspace aktifnya sekolah nonaktif → deny.
+    const teacher = await prisma.teacherProfile.findUnique({
+      where: { userId },
+      select: { activeSchoolId: true },
+    });
+    if (teacher?.activeSchoolId) {
+      const activeSchool = await prisma.school.findUnique({
+        where: { id: teacher.activeSchoolId },
+        select: { deactivatedAt: true },
+      });
+      if (activeSchool?.deactivatedAt) {
+        return false;
+      }
+    }
+
+    // Persona parent (G-5): sekolah dari relasi siswa nonaktif → deny.
+    const parent = await prisma.parentProfile.findUnique({
+      where: { userId },
+      select: {
+        studentRelations: {
+          select: { student: { select: { schoolId: true } } },
+        },
+      },
+    });
+    if (parent) {
+      const schoolIds = [...new Set(parent.studentRelations.map((r) => r.student.schoolId))];
+      if (schoolIds.length > 0) {
+        const deactivated = await prisma.school.findFirst({
+          where: { id: { in: schoolIds }, deactivatedAt: { not: null } },
+          select: { id: true },
+        });
+        if (deactivated) {
+          return false;
+        }
+      }
+    }
+
+    return true;
+  } catch {
+    // Fail-closed: error resolusi persona menolak sesi baru.
+    return false;
+  }
+}
diff --git a/src/lib/superadmin-seeder.ts b/src/lib/superadmin-seeder.ts
index 9b91a99..71168f7 100644
--- a/src/lib/superadmin-seeder.ts
+++ b/src/lib/superadmin-seeder.ts
@@ -235,7 +235,7 @@ export async function runSuperadminSeed(options: {
                 if (!entry.willPromote || entry.userId === undefined) continue;
                 await tx.user.update({
                     where: { id: entry.userId },
-                    data: { platformRole: "ADMIN" },
+                    data: { platformRole: "ADMIN", role: "ADMIN" }, // Story 5 F6: sinkron kanal plugin admin
                 });
                 promoted += 1;
                 await tx.auditLog.create({
diff --git a/src/lib/superadmin.ts b/src/lib/superadmin.ts
new file mode 100644
index 0000000..51e6e05
--- /dev/null
+++ b/src/lib/superadmin.ts
@@ -0,0 +1,106 @@
+import { auth, prisma } from "@/lib/auth";
+import { headers } from "next/headers";
+import { redactMetadata } from "@/lib/audit-metadata";
+import type { Prisma } from "@prisma/client";
+
+/**
+ * Story 5 — pelunasan deferred work Story 1 (kontrak terkeras hasil elicitation):
+ *
+ * - Deny-by-default, strict equality `platformRole === "ADMIN"` — nilai asing
+ *   seperti `"MODERATOR"` tertolak (bukan pola `!== "USER"`).
+ * - Tanpa sesi → denied.
+ * - Satu jenis error tunggal `SuperAdminRequiredError` dengan pesan statis
+ *   identik di semua jalur (anti-enumerasi).
+ * - Baca role via `session.user` dengan fallback `prisma.user.findUnique`.
+ * - Tanpa mengubah `src/lib/auth.ts` demi guard ini.
+ *
+ * Audit `ADMIN_ACCESS_DENIED` (OQ-7, F10, G-9): ditulis DI SINI (runtime Node —
+ * Prisma tersedia), BUKAN dari `src/proxy.ts` yang berjalan di edge runtime dan
+ * hanya boleh blok/redirect. Dedup 60 detik bersifat best-effort; hanya sesi
+ * valid yang ter-audit (bot anonim tidak).
+ */
+
+export const SUPERADMIN_STATIC_ERROR_MESSAGE = "Akses ditolak.";
+
+const ADMIN_ACCESS_DENIED_AUDIT_ACTION = "ADMIN_ACCESS_DENIED";
+const ACCESS_DENIED_DEDUP_WINDOW_MS = 60_000;
+
+export class SuperAdminRequiredError extends Error {
+  constructor() {
+    super(SUPERADMIN_STATIC_ERROR_MESSAGE);
+    this.name = "SuperAdminRequiredError";
+  }
+}
+
+/**
+ * Inti pengecekan role — strict equality, tanpa fallback longgar.
+ * Diekspor terpisah agar unit-testable tanpa `next/headers`.
+ */
+export function isPlatformAdminRole(platformRole: unknown): boolean {
+  return platformRole === "ADMIN";
+}
+
+async function auditAccessDeniedOnce(actorId: string): Promise<void> {
+  try {
+    const dedupWindowStart = new Date(Date.now() - ACCESS_DENIED_DEDUP_WINDOW_MS);
+    const recent = await prisma.auditLog.findFirst({
+      where: {
+        actorType: "USER",
+        actorId,
+        action: ADMIN_ACCESS_DENIED_AUDIT_ACTION,
+        createdAt: { gte: dedupWindowStart },
+      },
+      select: { id: true },
+    });
+    if (recent) return; // dedup best-effort (F10) — request konkuren boleh lolos
+    await prisma.auditLog.create({
+      data: {
+        actorType: "USER",
+        actorId,
+        action: ADMIN_ACCESS_DENIED_AUDIT_ACTION,
+        targetType: "ADMIN_AREA",
+        metadata: redactMetadata({ reason: "platformRole mismatch" }) as Prisma.InputJsonValue,
+      },
+    });
+  } catch {
+    // Audit gagal tidak boleh mengubah keputusan deny — tetap denied.
+  }
+}
+
+/**
+ * Gerbang tunggal semua aksi admin (G-9). Dilarang menyebar pengecekan
+ * `platformRole` manual di handler mana pun.
+ */
+export async function requireSuperAdmin(): Promise<{ userId: string }> {
+  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
+  try {
+    session = await auth.api.getSession({ headers: await headers() });
+  } catch {
+    session = null;
+  }
+
+  if (!session?.user?.id) {
+    throw new SuperAdminRequiredError();
+  }
+
+  const userId = session.user.id;
+
+  // Jalur 1: role dari session.user (bila tersedia di payload sesi).
+  const sessionRole = (session.user as { platformRole?: unknown }).platformRole;
+  if (isPlatformAdminRole(sessionRole)) {
+    return { userId };
+  }
+
+  // Jalur 2: fallback baca DB (kontrak deferred work Story 1).
+  const dbUser = await prisma.user.findUnique({
+    where: { id: userId },
+    select: { platformRole: true },
+  });
+  if (isPlatformAdminRole(dbUser?.platformRole)) {
+    return { userId };
+  }
+
+  // Denied — pesan statis identik semua jalur (anti-enumerasi) + audit.
+  await auditAccessDeniedOnce(userId);
+  throw new SuperAdminRequiredError();
+}
diff --git a/src/modules/admin/admin.actions.ts b/src/modules/admin/admin.actions.ts
new file mode 100644
index 0000000..973387d
--- /dev/null
+++ b/src/modules/admin/admin.actions.ts
@@ -0,0 +1,614 @@
+"use server";
+
+import { prisma, auth } from "@/lib/auth";
+import { requireSuperAdmin } from "@/lib/superadmin";
+import { redactMetadata } from "@/lib/audit-metadata";
+import { hashPin, verifyPin } from "@/lib/student-pin";
+import type { Prisma } from "@prisma/client";
+
+/**
+ * Story 5 — Area backstop superadmin `/admin/*` (CAP-7, B5, F3, F6, F7, G-3,
+ * G-4, G-6, G-9, G-11, OQ-8).
+ *
+ * Invariant kunci:
+ * - Semua aksi lewat SATU gerbang `requireSuperAdmin()` (deny-by-default).
+ * - Ban/reset password guru wajib revoke SEMUA sesi Better Auth (B5).
+ * - Ban ATAU reset password terhadap `platformRole === "ADMIN"` ditolak keras
+ *   (F6 + G-3) — recovery superadmin hanya via env allowlist + seeder.
+ * - Deaktivasi sekolah: urutan aman tandai → revoke sesi → fail-closed →
+ *   clear npsn → AuditLog (B5/F7). Reaktivasi sukses TANPA NPSN (G-6).
+ * - `AuditLog` total, metadata bebas PIN/hash/secret (N4) via `redactMetadata()`.
+ */
+
+const GENERIC_ADMIN_ERROR = "Aksi admin gagal. Coba lagi.";
+
+type PrismaTx = Prisma.TransactionClient;
+
+async function writeAudit(
+  db: PrismaTx | typeof prisma,
+  params: {
+    actorType: "USER" | "SUPERADMIN" | "STUDENT" | "SYSTEM";
+    actorId: string | null;
+    action: string;
+    targetType: string;
+    targetId: string | null;
+    metadata?: Record<string, unknown>;
+  }
+) {
+  await db.auditLog.create({
+    data: {
+      actorType: params.actorType,
+      actorId: params.actorId,
+      action: params.action,
+      targetType: params.targetType,
+      targetId: params.targetId,
+      metadata: redactMetadata(params.metadata ?? {}) as Prisma.InputJsonValue,
+    },
+  });
+}
+
+/**
+ * L3 — Force approve siswa PENDING lintas-sekolah (OQ-8).
+ * Conditional update (F5); aktor ter-audit sebagai SUPERADMIN.
+ */
+export async function forceApproveStudentAction(studentId: string) {
+  const { userId } = await requireSuperAdmin();
+
+  try {
+    const result = await prisma.$transaction(async (tx) => {
+      const student = await tx.student.findUnique({
+        where: { id: studentId },
+        select: { id: true, accountStatus: true, schoolId: true },
+      });
+      if (!student || student.accountStatus !== "PENDING") return null;
+
+      const updated = await tx.student.updateMany({
+        where: { id: studentId, accountStatus: "PENDING" },
+        data: {
+          accountStatus: "ACTIVE",
+          approvedById: userId,
+          approvedAt: new Date(),
+          accountRequestedAt: null,
+        },
+      });
+      if (updated.count !== 1) return null;
+
+      await writeAudit(tx, {
+        actorType: "SUPERADMIN",
+        actorId: userId,
+        action: "STUDENT_ACCOUNT_FORCE_APPROVED",
+        targetType: "STUDENT",
+        targetId: studentId,
+        metadata: { schoolId: student.schoolId, approvalLevel: "L3" },
+      });
+
+      return true;
+    });
+
+    if (!result) return { success: false, message: GENERIC_ADMIN_ERROR };
+    return { success: true };
+  } catch {
+    return { success: false, message: GENERIC_ADMIN_ERROR };
+  }
+}
+
+/**
+ * B5 — Ban guru: blokir login + revoke SEMUA sesi Better Auth aktif (F6, G-11).
+ * Target `platformRole === "ADMIN"` ditolak keras (F6).
+ */
+export async function banTeacherAction(userId: string, reason: string) {
+  const { userId: actorId } = await requireSuperAdmin();
+
+  try {
+    const target = await prisma.user.findUnique({
+      where: { id: userId },
+      select: { id: true, platformRole: true, banned: true },
+    });
+    if (!target) {
+      return { success: false, message: GENERIC_ADMIN_ERROR };
+    }
+
+    // F6: superadmin dilarang mem-ban superadmin lain.
+    if (target.platformRole === "ADMIN") {
+      await writeAudit(prisma, {
+        actorType: "SUPERADMIN",
+        actorId,
+        action: "TEACHER_BAN_DENIED",
+        targetType: "USER",
+        targetId: userId,
+        metadata: { reason: "TARGET_IS_SUPERADMIN" },
+      });
+      return { success: false, message: GENERIC_ADMIN_ERROR };
+    }
+
+    // Plugin admin: set banned + revoke semua sesi aktif milik user (B5).
+    // G-11: penolakan plugin (mis. role sesi stale) ditangkap jadi pesan generik.
+    await auth.api.banUser({
+      body: { userId, banReason: reason?.trim().slice(0, 256) || "Diblokir oleh superadmin" },
+    });
+
+    await writeAudit(prisma, {
+      actorType: "SUPERADMIN",
+      actorId,
+      action: "TEACHER_BANNED",
+      targetType: "USER",
+      targetId: userId,
+      metadata: { reason: reason?.trim().slice(0, 256) || null },
+    });
+
+    return { success: true };
+  } catch {
+    return { success: false, message: GENERIC_ADMIN_ERROR };
+  }
+}
+
+export async function unbanTeacherAction(userId: string) {
+  const { userId: actorId } = await requireSuperAdmin();
+
+  try {
+    const target = await prisma.user.findUnique({
+      where: { id: userId },
+      select: { id: true, platformRole: true },
+    });
+    if (!target || target.platformRole === "ADMIN") {
+      return { success: false, message: GENERIC_ADMIN_ERROR };
+    }
+
+    await auth.api.unbanUser({ body: { userId } });
+
+    await writeAudit(prisma, {
+      actorType: "SUPERADMIN",
+      actorId,
+      action: "TEACHER_UNBANNED",
+      targetType: "USER",
+      targetId: userId,
+    });
+
+    return { success: true };
+  } catch {
+    return { success: false, message: GENERIC_ADMIN_ERROR };
+  }
+}
+
+/**
+ * B5 + G-3 — Reset password guru: password baru berlaku + SEMUA sesi lama
+ * di-revoke. Target `platformRole === "ADMIN"` ditolak keras (G-3).
+ */
+export async function resetTeacherPasswordAction(userId: string, newPassword: string) {
+  const { userId: actorId } = await requireSuperAdmin();
+
+  if (!newPassword || newPassword.length < 8) {
+    return { success: false, message: "Password baru minimal 8 karakter." };
+  }
+
+  try {
+    const target = await prisma.user.findUnique({
+      where: { id: userId },
+      select: { id: true, platformRole: true },
+    });
+    if (!target) {
+      return { success: false, message: GENERIC_ADMIN_ERROR };
+    }
+
+    // G-3: guard identik dengan ban — superadmin dilarang reset password superadmin lain.
+    if (target.platformRole === "ADMIN") {
+      await writeAudit(prisma, {
+        actorType: "SUPERADMIN",
+        actorId,
+        action: "TEACHER_PASSWORD_RESET_DENIED",
+        targetType: "USER",
+        targetId: userId,
+        metadata: { reason: "TARGET_IS_SUPERADMIN" },
+      });
+      return { success: false, message: GENERIC_ADMIN_ERROR };
+    }
+
+    // setUserPassword + revoke SEMUA sesi aktif (B5). G-11: penolakan plugin
+    // (role sesi stale) ditangkap jadi pesan generik.
+    await auth.api.setUserPassword({ body: { userId, newPassword } });
+    await auth.api.revokeUserSessions({ body: { userId } });
+
+    await writeAudit(prisma, {
+      actorType: "SUPERADMIN",
+      actorId,
+      action: "TEACHER_PASSWORD_RESET",
+      targetType: "USER",
+      targetId: userId,
+    });
+
+    return { success: true };
+  } catch {
+    return { success: false, message: GENERIC_ADMIN_ERROR };
+  }
+}
+
+/**
+ * B5 + F7 — Nonaktifkan sekolah dengan urutan aman:
+ * (1) tandai nonaktif → (2) revoke sesi guru & parent → (3) fail-closed siswa/
+ * portal/parent per-request (via verifyStudentSession & layanan parent yang
+ * sudah mengecek deactivatedAt) → (4) clear npsn → (5) AuditLog.
+ * Clear npsn SEBELUM status tercatat membuka jendela re-klaim — dilarang.
+ */
+export async function deactivateSchoolAction(schoolId: string) {
+  const { userId } = await requireSuperAdmin();
+
+  try {
+    const school = await prisma.school.findUnique({
+      where: { id: schoolId },
+      select: { id: true, deactivatedAt: true },
+    });
+    if (!school || school.deactivatedAt) {
+      return { success: false, message: GENERIC_ADMIN_ERROR };
+    }
+
+    const now = new Date();
+
+    // (1) Tandai nonaktif dulu — menutup jendela re-klaim NPSN sejak detik ini.
+    await prisma.school.update({
+      where: { id: schoolId },
+      data: { deactivatedAt: now },
+    });
+
+    // (2) Revoke SEMUA sesi Better Auth aktif: guru (membership) + parent (relasi siswa).
+    const memberships = await prisma.teacherSchoolMembership.findMany({
+      where: { schoolId },
+      select: { teacherProfile: { select: { userId: true } } },
+    });
+    const parentRelations = await prisma.parentStudentRelation.findMany({
+      where: { student: { schoolId } },
+      select: { parentProfile: { select: { userId: true } } },
+    });
+
+    const userIds = [
+      ...new Set([
+        ...memberships.map((m) => m.teacherProfile.userId),
+        ...parentRelations.map((p) => p.parentProfile.userId),
+      ]),
+    ];
+
+    for (const uid of userIds) {
+      try {
+        // Hapus row session langsung = revoke seketika di semua perangkat (B5).
+        await prisma.session.deleteMany({ where: { userId: uid } });
+      } catch {
+        /* lanjut user berikutnya — siswa/portal sudah fail-closed per-request */
+      }
+    }
+
+    // (4) Clear npsn — NPSN sah dapat dipakai sekolah lain (B5).
+    await prisma.school.update({
+      where: { id: schoolId },
+      data: { npsn: null },
+    });
+
+    // (5) AuditLog
+    await writeAudit(prisma, {
+      actorType: "SUPERADMIN",
+      actorId: userId,
+      action: "SCHOOL_DEACTIVATED",
+      targetType: "SCHOOL",
+      targetId: schoolId,
+      metadata: { revokedSessionUserCount: userIds.length },
+    });
+
+    return { success: true, revokedSessionUserCount: userIds.length };
+  } catch {
+    return { success: false, message: GENERIC_ADMIN_ERROR };
+  }
+}
+
+/**
+ * G-6 — Reaktivasi sekolah: sukses TANPA NPSN (`npsn` tetap null).
+ * Pengisian NPSN ulang via `setSchoolNpsnAction` yang menangkap konflik
+ * `@unique` menjadi pesan generik — tidak pernah P2002 mentah.
+ */
+export async function reactivateSchoolAction(schoolId: string) {
+  const { userId } = await requireSuperAdmin();
+
+  try {
+    const school = await prisma.school.findUnique({
+      where: { id: schoolId },
+      select: { id: true, deactivatedAt: true },
+    });
+    if (!school || !school.deactivatedAt) {
+      return { success: false, message: GENERIC_ADMIN_ERROR };
+    }
+
+    await prisma.school.update({
+      where: { id: schoolId },
+      data: { deactivatedAt: null, npsn: null }, // G-6: npsn tetap null
+    });
+
+    await writeAudit(prisma, {
+      actorType: "SUPERADMIN",
+      actorId: userId,
+      action: "SCHOOL_REACTIVATED",
+      targetType: "SCHOOL",
+      targetId: schoolId,
+      metadata: { npsnRestored: false },
+    });
+
+    return { success: true };
+  } catch {
+    return { success: false, message: GENERIC_ADMIN_ERROR };
+  }
+}
+
+/** G-6 — Pengisian NPSN ulang (superadmin): konflik `@unique` → pesan generik. */
+export async function setSchoolNpsnAction(schoolId: string, npsn: string) {
+  const { userId } = await requireSuperAdmin();
+
+  const cleanNpsn = npsn?.trim();
+  if (!cleanNpsn || !/^\d{8}$/.test(cleanNpsn)) {
+    return { success: false, message: "NPSN harus 8 digit angka." };
+  }
+
+  try {
+    const school = await prisma.school.findUnique({
+      where: { id: schoolId },
+      select: { id: true, deactivatedAt: true },
+    });
+    if (!school || school.deactivatedAt) {
+      return { success: false, message: GENERIC_ADMIN_ERROR };
+    }
+
+    try {
+      await prisma.school.update({
+        where: { id: schoolId },
+        data: { npsn: cleanNpsn },
+      });
+    } catch (err: unknown) {
+      // Konflik `@unique` (NPSN sudah dipakai sekolah lain) → generik, tanpa P2002 mentah.
+      if (
+        typeof err === "object" &&
+        err !== null &&
+        "code" in err &&
+        (err as { code?: string }).code === "P2002"
+      ) {
+        return { success: false, message: "NPSN sudah terdaftar pada sekolah lain." };
+      }
+      throw err;
+    }
+
+    await writeAudit(prisma, {
+      actorType: "SUPERADMIN",
+      actorId: userId,
+      action: "SCHOOL_NPSN_UPDATED",
+      targetType: "SCHOOL",
+      targetId: schoolId,
+    });
+
+    return { success: true };
+  } catch {
+    return { success: false, message: GENERIC_ADMIN_ERROR };
+  }
+}
+
+/**
+ * AuditLog viewer (OQ-8 lintas-sekolah) — filter aktor/aksi/target/rentang waktu,
+ * terpaginasi; memakai index `[actorId, createdAt]` & `[targetType, targetId]` (N4).
+ */
+export async function getAuditLogsAction(params: {
+  page?: number;
+  pageSize?: number;
+  actorId?: string;
+  action?: string;
+  targetType?: string;
+  targetId?: string;
+  from?: string;
+  to?: string;
+}) {
+  await requireSuperAdmin();
+
+  const page = Math.max(1, params.page ?? 1);
+  const pageSize = Math.min(100, Math.max(10, params.pageSize ?? 25));
+
+  const where = {
+    ...(params.actorId ? { actorId: params.actorId } : {}),
+    ...(params.action ? { action: params.action } : {}),
+    ...(params.targetType ? { targetType: params.targetType } : {}),
+    ...(params.targetId ? { targetId: params.targetId } : {}),
+    ...(params.from || params.to
+      ? {
+          createdAt: {
+            ...(params.from ? { gte: new Date(params.from) } : {}),
+            ...(params.to ? { lte: new Date(params.to) } : {}),
+          },
+        }
+      : {}),
+  };
+
+  const [items, total] = await Promise.all([
+    prisma.auditLog.findMany({
+      where,
+      orderBy: { createdAt: "desc" },
+      skip: (page - 1) * pageSize,
+      take: pageSize,
+      select: {
+        id: true,
+        actorType: true,
+        actorId: true,
+        action: true,
+        targetType: true,
+        targetId: true,
+        metadata: true,
+        ip: true,
+        createdAt: true,
+      },
+    }),
+    prisma.auditLog.count({ where }),
+  ]);
+
+  return { success: true, items, total, page, pageSize };
+}
+
+/**
+ * L3 — Force reject siswa PENDING lintas-sekolah (pasangan force approve).
+ * Conditional update (F5).
+ */
+export async function forceRejectStudentAction(studentId: string, reason: string) {
+  const { userId } = await requireSuperAdmin();
+
+  try {
+    const result = await prisma.$transaction(async (tx) => {
+      const student = await tx.student.findUnique({
+        where: { id: studentId },
+        select: { id: true, accountStatus: true, schoolId: true },
+      });
+      if (!student || student.accountStatus !== "PENDING") return null;
+
+      const updated = await tx.student.updateMany({
+        where: { id: studentId, accountStatus: "PENDING" },
+        data: {
+          accountStatus: "REJECTED",
+          accountRequestedAt: null,
+          approvedById: null,
+          approvedAt: null,
+        },
+      });
+      if (updated.count !== 1) return null;
+
+      await writeAudit(tx, {
+        actorType: "SUPERADMIN",
+        actorId: userId,
+        action: "STUDENT_ACCOUNT_FORCE_REJECTED",
+        targetType: "STUDENT",
+        targetId: studentId,
+        metadata: { reason: reason?.trim().slice(0, 256) || null, schoolId: student.schoolId },
+      });
+
+      return true;
+    });
+
+    if (!result) return { success: false, message: GENERIC_ADMIN_ERROR };
+    return { success: true };
+  } catch {
+    return { success: false, message: GENERIC_ADMIN_ERROR };
+  }
+}
+
+/**
+ * Reset PIN siswa oleh superadmin (B2 — jalur superadmin; G-1 jalur pulih
+ * REJECTED). Hygiene lengkap (F8), satu transaksi + AuditLog.
+ */
+export async function forceResetStudentPinAction(studentId: string, newPin: string) {
+  const { userId } = await requireSuperAdmin();
+
+  if (!/^\d{4}$/.test(newPin)) {
+    return { success: false, message: "PIN baru harus 4 digit angka." };
+  }
+
+  try {
+    const result = await prisma.$transaction(async (tx) => {
+      const student = await tx.student.findUnique({
+        where: { id: studentId },
+        select: { id: true, accessPinHash: true, accountStatus: true },
+      });
+      if (!student) return { ok: false as const };
+
+      if (student.accessPinHash && (await verifyPin(newPin, student.accessPinHash))) {
+        return { ok: false as const, samePin: true as const };
+      }
+
+      const newHash = await hashPin(newPin);
+      const now = new Date();
+
+      const updated = await tx.student.updateMany({
+        where: { id: studentId },
+        data: {
+          accessPinHash: newHash,
+          pinUpdatedAt: now,
+          failedAttempts: 0,
+          lockedUntil: null,
+        },
+      });
+      if (updated.count !== 1) return { ok: false as const };
+
+      await writeAudit(tx, {
+        actorType: "SUPERADMIN",
+        actorId: userId,
+        action: "STUDENT_PIN_RESET",
+        targetType: "STUDENT",
+        targetId: studentId,
+        metadata: { accountStatus: student.accountStatus, via: "SUPERADMIN" },
+      });
+
+      return { ok: true as const };
+    });
+
+    if (!result.ok) {
+      if ("samePin" in result && result.samePin) {
+        return { success: false, message: "PIN baru tidak boleh sama dengan PIN lama." };
+      }
+      return { success: false, message: GENERIC_ADMIN_ERROR };
+    }
+    return { success: true };
+  } catch {
+    return { success: false, message: GENERIC_ADMIN_ERROR };
+  }
+}
+
+/**
+ * Pencarian user untuk panel admin (by email). Superadmin-only.
+ */
+export async function lookupUserForAdminAction(email: string) {
+  await requireSuperAdmin();
+
+  const user = await prisma.user.findUnique({
+    where: { email: email.trim().toLowerCase() },
+    select: {
+      id: true,
+      name: true,
+      email: true,
+      platformRole: true,
+      role: true,
+      banned: true,
+      banReason: true,
+      banExpires: true,
+      teacherProfile: {
+        select: {
+          id: true,
+          activeSchoolId: true,
+          memberships: {
+            where: { status: "ACTIVE" },
+            select: { school: { select: { id: true, name: true, deactivatedAt: true } } },
+          },
+        },
+      },
+    },
+  });
+
+  if (!user) return { success: false, message: "User tidak ditemukan." };
+  return { success: true, user };
+}
+
+/**
+ * Pencarian sekolah untuk panel admin (by nama/NPSN). Superadmin-only.
+ */
+export async function lookupSchoolsForAdminAction(query: string) {
+  await requireSuperAdmin();
+
+  const clean = query?.trim();
+  if (!clean) return { success: true, schools: [] };
+
+  const schools = await prisma.school.findMany({
+    where: {
+      OR: [
+        { name: { contains: clean, mode: "insensitive" } },
+        { npsn: clean },
+      ],
+    },
+    select: {
+      id: true,
+      name: true,
+      npsn: true,
+      deactivatedAt: true,
+      createdAt: true,
+      _count: { select: { students: true, memberships: true, classes: true } },
+    },
+    take: 10,
+    orderBy: { name: "asc" },
+  });
+
+  return { success: true, schools };
+}
diff --git a/src/modules/approvals/__tests__/story-5-full-audit.int.test.ts b/src/modules/approvals/__tests__/story-5-full-audit.int.test.ts
new file mode 100644
index 0000000..c36a4ae
--- /dev/null
+++ b/src/modules/approvals/__tests__/story-5-full-audit.int.test.ts
@@ -0,0 +1,720 @@
+import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
+import { prisma } from "@/lib/auth";
+import { verifyPin } from "@/lib/student-pin";
+import { assertSessionCreationAllowed } from "@/lib/session-guards";
+import {
+  registerStudent,
+  loginStudent,
+  lookupJoinCode,
+} from "../../student-auth/student-auth.actions";
+import { startQuizAttemptAction } from "../../quiz/quiz.actions";
+import {
+  getPendingStudentsForClassAction,
+  getPendingStudentsForSchoolAction,
+  getPendingStudentsForMyClassesAction,
+  approveStudentAction,
+  rejectStudentAction,
+  batchApproveStudentsAction,
+  moveStudentClassAction,
+  resetStudentPinAction,
+} from "../approvals.actions";
+import {
+  forceApproveStudentAction,
+  banTeacherAction,
+  unbanTeacherAction,
+  resetTeacherPasswordAction,
+  deactivateSchoolAction,
+  reactivateSchoolAction,
+  setSchoolNpsnAction,
+} from "../../admin/admin.actions";
+
+/**
+ * Story 5 — Deep Real-Database Integration & Security Audit (Neon PostgreSQL).
+ *
+ * Sesi guru/superadmin di-mock di tepi (@/lib/authorization & @/lib/superadmin)
+ * karena mereka membaca next/headers; seluruh logika bisnis, transaksi,
+ * conditional update, dan DB state diuji NYATA terhadap database.
+ * Plugin admin Better Auth di-stub dengan perilaku ekuivalen (banned + revoke
+ * sesi) — logika yang diuji adalah guard/ordering/audit milik Story 5.
+ */
+
+vi.mock("@/lib/authorization", () => ({
+  verifyActiveSchoolMembership: vi.fn(),
+}));
+
+vi.mock("@/lib/superadmin", () => ({
+  requireSuperAdmin: vi.fn(),
+}));
+
+vi.mock("@/lib/auth", async (importOriginal) => {
+  const actual = await importOriginal<typeof import("@/lib/auth")>();
+  return {
+    ...actual,
+    auth: {
+      api: {
+        banUser: vi.fn(async ({ body }: { body: { userId: string; banReason?: string } }) => {
+          await actual.prisma.user.update({
+            where: { id: body.userId },
+            data: { banned: true, banReason: body.banReason ?? null },
+          });
+          await actual.prisma.session.deleteMany({ where: { userId: body.userId } });
+          return { ok: true };
+        }),
+        unbanUser: vi.fn(async ({ body }: { body: { userId: string } }) => {
+          await actual.prisma.user.update({
+            where: { id: body.userId },
+            data: { banned: false, banReason: null },
+          });
+          return { ok: true };
+        }),
+        setUserPassword: vi.fn(async () => ({ ok: true })),
+        revokeUserSessions: vi.fn(async ({ body }: { body: { userId: string } }) => {
+          await actual.prisma.session.deleteMany({ where: { userId: body.userId } });
+          return [];
+        }),
+      },
+    },
+  };
+});
+
+import { verifyActiveSchoolMembership } from "@/lib/authorization";
+import { requireSuperAdmin } from "@/lib/superadmin";
+
+const mockedVerify = vi.mocked(verifyActiveSchoolMembership);
+const mockedRequireSuperAdmin = vi.mocked(requireSuperAdmin);
+
+function setActor(actor: ActorContext) {
+  mockedVerify.mockImplementation(
+    async () => actor as unknown as Awaited<ReturnType<typeof verifyActiveSchoolMembership>>
+  );
+}
+
+interface ActorContext {
+  session: { user: { id: string } };
+  profile: { id: string; userId: string };
+  activeSchoolId: string;
+  activeSchool: { id: string; name: string };
+}
+
+describe("Story 5 Deep Real-Database Integration & Security Audit (Neon PostgreSQL)", { timeout: 60_000 }, () => {
+  let dbAvailable = false;
+  const ts = Date.now();
+
+  let schoolId: string;
+  let activePeriodId: string;
+  let oldPeriodId: string;
+
+  let teacherAUserId: string; // pengampu
+  let teacherAProfileId: string;
+  let teacherBUserId: string; // bukan pengampu
+  let teacherBProfileId: string;
+  let superadminUserId: string;
+  let parentUserId: string;
+
+  let classAId: string;
+  let classBId: string;
+  let classOldId: string;
+  let joinCodeA: string;
+  let joinCodeB: string;
+  let joinCodeOld: string;
+
+  const actorA: ActorContext = {
+    session: { user: { id: "" } },
+    profile: { id: "", userId: "" },
+    activeSchoolId: "",
+    activeSchool: { id: "", name: "" },
+  };
+  const actorB: ActorContext = {
+    session: { user: { id: "" } },
+    profile: { id: "", userId: "" },
+    activeSchoolId: "",
+    activeSchool: { id: "", name: "" },
+  };
+
+  beforeAll(async () => {
+    try {
+      // 1. Sekolah + periode aktif + periode lama (G-7)
+      const school = await prisma.school.create({
+        data: {
+          name: `Audit Story5 ${ts}`,
+          normalizedName: `audit story5 ${ts}`,
+          npsn: `${ts}`.slice(-8),
+        },
+      });
+      schoolId = school.id;
+
+      const activePeriod = await prisma.academicPeriod.create({
+        data: { schoolId, year: "2026/2027", semester: "Ganjil S5", status: "ACTIVE" },
+      });
+      activePeriodId = activePeriod.id;
+
+      const oldPeriod = await prisma.academicPeriod.create({
+        data: { schoolId, year: "2025/2026", semester: "Genap S5", status: "INACTIVE" },
+      });
+      oldPeriodId = oldPeriod.id;
+
+      // 2. Guru A (pengampu), Guru B (bukan pengampu), Superadmin, Parent
+      teacherAUserId = `s5-ta-${ts}`;
+      teacherBUserId = `s5-tb-${ts}`;
+      superadminUserId = `s5-sa-${ts}`;
+      parentUserId = `s5-pr-${ts}`;
+
+      const userA = await prisma.user.create({
+        data: { id: teacherAUserId, email: `${teacherAUserId}@test.com`, name: "Guru A", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), platformRole: "USER", role: "USER" },
+      });
+      const userB = await prisma.user.create({
+        data: { id: teacherBUserId, email: `${teacherBUserId}@test.com`, name: "Guru B", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), platformRole: "USER", role: "USER" },
+      });
+      await prisma.user.create({
+        data: { id: superadminUserId, email: `${superadminUserId}@test.com`, name: "Superadmin", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), platformRole: "ADMIN", role: "ADMIN" },
+      });
+      await prisma.user.create({
+        data: { id: parentUserId, email: `${parentUserId}@test.com`, name: "Orang Tua", emailVerified: true, createdAt: new Date(), updatedAt: new Date(), platformRole: "USER", role: "USER" },
+      });
+
+      const profileA = await prisma.teacherProfile.create({
+        data: { userId: userA.id, activeSchoolId: schoolId, onboardingCompleted: true },
+      });
+      teacherAProfileId = profileA.id;
+      const profileB = await prisma.teacherProfile.create({
+        data: { userId: userB.id, activeSchoolId: schoolId, onboardingCompleted: true },
+      });
+      teacherBProfileId = profileB.id;
+
+      await prisma.teacherSchoolMembership.create({
+        data: { teacherProfileId: profileA.id, schoolId, status: "ACTIVE", workspaceRole: "OWNER" },
+      });
+      await prisma.teacherSchoolMembership.create({
+        data: { teacherProfileId: profileB.id, schoolId, status: "ACTIVE", workspaceRole: "MEMBER" },
+      });
+
+      // 3. Kelas A & B (periode aktif) + Kelas Old (periode lama) + TC pengampu
+      const classA = await prisma.class.create({
+        data: { schoolId, name: `5-A-${ts}`, gradeLevel: "5", joinCode: `S5A${`${ts}`.slice(-4)}` },
+      });
+      classAId = classA.id;
+      joinCodeA = classA.joinCode!;
+
+      const classB = await prisma.class.create({
+        data: { schoolId, name: `5-B-${ts}`, gradeLevel: "5", joinCode: `S5B${`${ts}`.slice(-4)}` },
+      });
+      classBId = classB.id;
+      joinCodeB = classB.joinCode!;
+
+      const classOld = await prisma.class.create({
+        data: { schoolId, name: `4-O-${ts}`, gradeLevel: "4", joinCode: `S5O${`${ts}`.slice(-4)}` },
+      });
+      classOldId = classOld.id;
+      joinCodeOld = classOld.joinCode!;
+
+      const subject = await prisma.subject.create({
+        data: { schoolId, name: "IPA S5", normalizedName: `ipa s5 ${ts}` },
+      });
+
+      for (const [tcClass, tcPeriod] of [
+        [classAId, activePeriodId],
+        [classBId, activePeriodId],
+        [classOldId, oldPeriodId],
+      ]) {
+        await prisma.teachingContext.create({
+          data: {
+            teacherProfileId: profileA.id,
+            schoolId,
+            academicPeriodId: tcPeriod,
+            classId: tcClass,
+            subjectId: subject.id,
+          },
+        });
+      }
+
+      // 4. Aktor konteks
+      actorA.session.user.id = teacherAUserId;
+      actorA.profile.id = teacherAProfileId;
+      actorA.profile.userId = teacherAUserId;
+      actorA.activeSchoolId = schoolId;
+      actorA.activeSchool = { id: schoolId, name: school.name };
+
+      actorB.session.user.id = teacherBUserId;
+      actorB.profile.id = teacherBProfileId;
+      actorB.profile.userId = teacherBUserId;
+      actorB.activeSchoolId = schoolId;
+      actorB.activeSchool = { id: schoolId, name: school.name };
+
+      setActor(actorA);
+      mockedRequireSuperAdmin.mockImplementation(async () => ({ userId: superadminUserId }));
+
+      dbAvailable = true;
+    } catch (err) {
+      console.warn("[story-5 int test] DB unavailable, skipping:", err);
+      dbAvailable = false;
+    }
+  });
+
+  afterAll(async () => {
+    if (!dbAvailable) return;
+    try {
+      await prisma.parentStudentRelation.deleteMany({ where: { parentProfile: { userId: parentUserId } } }).catch(() => {});
+      await prisma.parentProfile.deleteMany({ where: { userId: parentUserId } }).catch(() => {});
+      await prisma.school.delete({ where: { id: schoolId } }).catch(() => {});
+      // Sisa entity ter-cascade dari school; user dibuat manual — bersihkan.
+      await prisma.user.deleteMany({ where: { id: { in: [teacherAUserId, teacherBUserId, superadminUserId, parentUserId] } } });
+    } catch {
+      /* cleanup best-effort */
+    }
+  });
+
+  beforeEach(() => {
+    if (!dbAvailable) return;
+    setActor(actorA);
+    mockedRequireSuperAdmin.mockImplementation(async () => ({ userId: superadminUserId }));
+  });
+
+  // =========================================================================
+  // F1 + G-1 + G-2 — Jalur daftar ulang REJECTED
+  // =========================================================================
+  it("F1/G-1: register mismatch → PENDING dengan accountRequestedAt; guard (d) meloloskan pindah rombel REJECTED via UPDATE classId", async () => {
+    // (b) mismatch → PENDING L1 + accountRequestedAt terisi (F2)
+    const reg1 = await registerStudent({
+      joinCode: joinCodeA,
+      fullName: "Nama Beda S5",
+      nis: `S5A${`${ts}`.slice(-6)}`,
+      pin: "1234",
+    });
+    expect(reg1.success).toBe(true);
+    if (!reg1.success || reg1.status !== "PENDING") throw new Error("register mismatch harus PENDING");
+
+    const student = await prisma.student.findFirst({ where: { nis: `S5A${`${ts}`.slice(-6)}`, schoolId } });
+    expect(student).not.toBeNull();
+    expect(student!.accountStatus).toBe("PENDING");
+    expect(student!.accountRequestedAt).not.toBeNull(); // F2
+    const studentId = student!.id;
+
+    // Simulasi guru menolak (reuse row — glosarium §9.2)
+    const rej = await rejectStudentAction(studentId, "Nama tidak cocok");
+    expect(rej.success).toBe(true);
+    const afterReject = await prisma.student.findUnique({ where: { id: studentId } });
+    expect(afterReject!.accountStatus).toBe("REJECTED");
+    expect(afterReject!.accountRequestedAt).toBeNull(); // F2 — keputusan null-kan
+
+    // G-1: PIN lama SALAH → tolak generik, row TIDAK disentuh + audit
+    const regWrongPin = await registerStudent({
+      joinCode: joinCodeA,
+      fullName: "Nama Beda S5",
+      nis: `S5A${`${ts}`.slice(-6)}`,
+      pin: "9999",
+    });
+    expect(regWrongPin.success).toBe(false);
+    const untouched = await prisma.student.findUnique({ where: { id: studentId } });
+    expect(untouched!.accountStatus).toBe("REJECTED");
+    const deniedLog = await prisma.auditLog.findFirst({ where: { action: "STUDENT_RE_REGISTER_DENIED", targetId: studentId } });
+    expect(deniedLog).not.toBeNull();
+
+    // G-2: daftar ulang (masih REJECTED) ke kode rombel BERBEDA → UPDATE classId row existing, bukan ditolak
+    const regMove = await registerStudent({
+      joinCode: joinCodeB,
+      fullName: "Nama Beda S5",
+      nis: `S5A${`${ts}`.slice(-6)}`,
+      pin: "1234",
+    });
+    expect(regMove.success).toBe(true);
+    const enrollments = await prisma.classStudent.findMany({ where: { studentId } });
+    expect(enrollments.length).toBe(1); // reuse row — bukan delete-insert
+    expect(enrollments[0].classId).toBe(classBId);
+
+    // Tolak lagi, lalu G-1: PIN lama COCOK → reuse row, kembali PENDING, hygiene reset, ter-audit
+    const rej2 = await rejectStudentAction(studentId, "Belum cocok");
+    expect(rej2.success).toBe(true);
+    const regOk = await registerStudent({
+      joinCode: joinCodeB,
+      fullName: "Nama Beda S5",
+      nis: `S5A${`${ts}`.slice(-6)}`,
+      pin: "1234",
+    });
+    expect(regOk.success).toBe(true);
+    const reRegistered = await prisma.student.findUnique({ where: { id: studentId } });
+    expect(reRegistered!.accountStatus).toBe("PENDING");
+    expect(reRegistered!.accountRequestedAt).not.toBeNull();
+    expect(await verifyPin("1234", reRegistered!.accessPinHash!)).toBe(true);
+    const reRegLog = await prisma.auditLog.findFirst({ where: { action: "STUDENT_RE_REGISTERED", targetId: studentId } });
+    expect(reRegLog).not.toBeNull();
+
+    // Guard anti-takeover tetap keras untuk PENDING yang sudah ber-PIN
+    const takeover = await registerStudent({
+      joinCode: joinCodeA,
+      fullName: "Penyerang S5",
+      nis: `S5A${`${ts}`.slice(-6)}`,
+      pin: "5555",
+    });
+    expect(takeover.success).toBe(false);
+  });
+
+  // =========================================================================
+  // Tangga L1–L3 + F5 conditional update + F4 notifikasi
+  // =========================================================================
+  it("L1: approve oleh pengampu → ACTIVE + approvedById + accountRequestedAt null + audit L1, tanpa notifikasi", async () => {
+    const s = await prisma.student.create({
+      data: { schoolId, fullName: "Siswa L1", nis: `L1${`${ts}`.slice(-7)}`, accessPinHash: null, accountStatus: "PENDING", accountRequestedAt: new Date() },
+    });
+    await prisma.classStudent.create({
+      data: { studentId: s.id, classId: classAId, academicPeriodId: activePeriodId },
+    });
+
+    const res = await approveStudentAction(s.id);
+    expect(res.success).toBe(true);
+    expect((res as { approvalLevel?: string }).approvalLevel).toBe("L1");
+
+    const updated = await prisma.student.findUnique({ where: { id: s.id } });
+    expect(updated!.accountStatus).toBe("ACTIVE");
+    expect(updated!.approvedById).toBe(teacherAUserId);
+    expect(updated!.approvedAt).not.toBeNull();
+    expect(updated!.accountRequestedAt).toBeNull();
+
+    const log = await prisma.auditLog.findFirst({ where: { action: "STUDENT_ACCOUNT_APPROVED", targetId: s.id } });
+    expect(log).not.toBeNull();
+    expect((log!.metadata as { approvalLevel?: string }).approvalLevel).toBe("L1");
+
+    // F4: approve L1 TIDAK memicu notifikasi (bukan eskalasi L2)
+    const notifs = await prisma.notification.findMany({ where: { schoolId, type: "STUDENT_APPROVAL_L2" } });
+    expect(notifs.length).toBe(0);
+  });
+
+  it("F5: double-approve → transisi kedua ditolak generik (conditional update count=0), tanpa duplikat audit", async () => {
+    const s = await prisma.student.create({
+      data: { schoolId, fullName: "Siswa Race", nis: `RC${`${ts}`.slice(-7)}`, accountStatus: "PENDING", accountRequestedAt: new Date() },
+    });
+    await prisma.classStudent.create({
+      data: { studentId: s.id, classId: classAId, academicPeriodId: activePeriodId },
+    });
+
+    const first = await approveStudentAction(s.id);
+    expect(first.success).toBe(true);
+
+    // Transisi kedua pada siswa yang sudah tidak PENDING → count 0 → gagal generik
+    const second = await approveStudentAction(s.id);
+    expect(second.success).toBe(false);
+
+    const logs = await prisma.auditLog.count({ where: { action: "STUDENT_ACCOUNT_APPROVED", targetId: s.id } });
+    expect(logs).toBe(1); // tanpa duplikat
+  });
+
+  it("L2 + F4: approve oleh non-pengampu → audit L2 + tepat SATU notifikasi ringkasan per guru (aktor dikecualikan)", async () => {
+    const s = await prisma.student.create({
+      data: { schoolId, fullName: "Siswa L2", nis: `L2${`${ts}`.slice(-7)}`, accountStatus: "PENDING", accountRequestedAt: new Date() },
+    });
+    await prisma.classStudent.create({
+      data: { studentId: s.id, classId: classAId, academicPeriodId: activePeriodId },
+    });
+
+    // Actor B (bukan pengampu rombel manapun) → jalur L2
+    setActor(actorB);
+    const res = await approveStudentAction(s.id);
+    expect(res.success).toBe(true);
+    expect((res as { approvalLevel?: string }).approvalLevel).toBe("L2");
+
+    const log = await prisma.auditLog.findFirst({ where: { action: "STUDENT_ACCOUNT_APPROVED", targetId: s.id } });
+    expect((log!.metadata as { approvalLevel?: string }).approvalLevel).toBe("L2");
+
+    // Satu notifikasi ringkasan untuk Guru A; aktor (Guru B) tidak menotifikasi diri sendiri
+    const notifsA = await prisma.notification.findMany({ where: { userId: teacherAUserId, type: "STUDENT_APPROVAL_L2" } });
+    expect(notifsA.length).toBe(1);
+    const notifsB = await prisma.notification.findMany({ where: { userId: teacherBUserId, type: "STUDENT_APPROVAL_L2" } });
+    expect(notifsB.length).toBe(0);
+  });
+
+  it("N6/OQ-2/G-8: batch → baris valid ter-approve + baris kalah race dilaporkan; >100 baris ditolak server-side", async () => {
+    const s1 = await prisma.student.create({ data: { schoolId, fullName: "B1", nis: `B1${`${ts}`.slice(-7)}`, accountStatus: "PENDING" } });
+    const s2 = await prisma.student.create({ data: { schoolId, fullName: "B2", nis: `B2${`${ts}`.slice(-7)}`, accountStatus: "PENDING" } });
+    const s3 = await prisma.student.create({ data: { schoolId, fullName: "B3", nis: `B3${`${ts}`.slice(-7)}`, accountStatus: "PENDING" } });
+    for (const sid of [s1.id, s2.id, s3.id]) {
+      await prisma.classStudent.create({ data: { studentId: sid, classId: classAId, academicPeriodId: activePeriodId } });
+    }
+
+    // s2 di-approve konkuren SEBELUM batch → kalah race → dilaporkan
+    await prisma.student.update({ where: { id: s2.id }, data: { accountStatus: "ACTIVE" } });
+
+    const res = await batchApproveStudentsAction([s1.id, s2.id, s3.id]);
+    expect(res.success).toBe(true);
+    expect(res.approvedCount).toBe(2);
+    expect(res.failed).toContainEqual({ studentId: s2.id });
+
+    const approvedLogs = await prisma.auditLog.count({
+      where: { action: "STUDENT_ACCOUNT_APPROVED", targetId: { in: [s1.id, s3.id] }, metadata: { path: ["batch"], equals: true } },
+    });
+    expect(approvedLogs).toBe(2); // AuditLog per-baris sukses (N6)
+
+    // F4: TEPAT satu notifikasi ringkasan per guru untuk seluruh batch;
+    // aktor (Guru A) tidak menotifikasi dirinya sendiri → Guru B menerimanya.
+    const notifsB = await prisma.notification.count({ where: { userId: teacherBUserId, type: "STUDENT_APPROVAL_L2", payload: { path: ["count"], equals: 2 } } });
+    expect(notifsB).toBe(1);
+    const notifsA = await prisma.notification.count({ where: { userId: teacherAUserId, type: "STUDENT_APPROVAL_L2", payload: { path: ["count"], equals: 2 } } });
+    expect(notifsA).toBe(0);
+
+    // G-8: batch 101 baris ditolak generik + ter-audit, nol baris dieksekusi
+    const oversize = await batchApproveStudentsAction(Array.from({ length: 101 }, (_, i) => `fake-${i}`));
+    expect(oversize.success).toBe(false);
+    expect(oversize.approvedCount).toBe(0);
+    const limitLog = await prisma.auditLog.findFirst({ where: { action: "BATCH_APPROVE_LIMIT_REJECTED" } });
+    expect(limitLog).not.toBeNull();
+  });
+
+  it("G-7: L2 tanpa filter periode — pending periode lampau tetap tampil; L1 tetap ter-scope periode aktif", async () => {
+    // PENDING di periode LAMA
+    const sOld = await prisma.student.create({ data: { schoolId, fullName: "Pending Lama", nis: `OL${`${ts}`.slice(-7)}`, accountStatus: "PENDING", accountRequestedAt: new Date() } });
+    await prisma.classStudent.create({ data: { studentId: sOld.id, classId: classOldId, academicPeriodId: oldPeriodId } });
+
+    // PENDING di periode aktif
+    const sNew = await prisma.student.create({ data: { schoolId, fullName: "Pending Baru", nis: `NW${`${ts}`.slice(-7)}`, accountStatus: "PENDING", accountRequestedAt: new Date() } });
+    await prisma.classStudent.create({ data: { studentId: sNew.id, classId: classAId, academicPeriodId: activePeriodId } });
+
+    // L2 sekolah-wide: keduanya tampil
+    const l2 = await getPendingStudentsForSchoolAction();
+    expect(l2.success).toBe(true);
+    const l2Ids = l2.pending.map((p) => p.studentId);
+    expect(l2Ids).toContain(sOld.id);
+    expect(l2Ids).toContain(sNew.id);
+
+    // L1 per-rombel: hanya periode aktif (sOld tidak muncul di classA/classB)
+    const l1 = await getPendingStudentsForClassAction(classAId);
+    expect(l1.success).toBe(true);
+    expect(l1.pending.map((p) => p.studentId)).toContain(sNew.id);
+    expect(l1.pending.map((p) => p.studentId)).not.toContain(sOld.id);
+
+    // L1 multi-rombel (tab Daftar Siswa)
+    const mine = await getPendingStudentsForMyClassesAction();
+    expect(mine.pending.map((p) => p.studentId)).toContain(sNew.id);
+  });
+
+  it("L1 matrix: guru bukan pengampu ditolak server-side di panel L1", async () => {
+    setActor(actorB);
+    const res = await getPendingStudentsForClassAction(classAId);
+    expect(res.success).toBe(false);
+    expect(res.note).toBe("NOT_PENGAMPU");
+  });
+
+  // =========================================================================
+  // N5/F12 — Pindah rombel
+  // =========================================================================
+  it("N5/F12: pindah rombel = UPDATE classId row existing; kuasa pengampu sumber/tujuan; guru asing ditolak", async () => {
+    const s = await prisma.student.create({ data: { schoolId, fullName: "Pindah", nis: `MV${`${ts}`.slice(-7)}`, accountStatus: "PENDING" } });
+    const row = await prisma.classStudent.create({ data: { studentId: s.id, classId: classAId, academicPeriodId: activePeriodId } });
+
+    // Pengampu sumber (Guru A) dipindah ke rombel tujuan B
+    const resA = await moveStudentClassAction(s.id, classBId);
+    expect(resA.success).toBe(true);
+    const after = await prisma.classStudent.findUnique({ where: { id: row.id } });
+    expect(after!.classId).toBe(classBId);
+    expect(after!.academicPeriodId).toBe(activePeriodId); // @@unique terjaga
+
+    // Guru asing (B, bukan pengampu sumber/tujuan mana pun) → ditolak
+    setActor(actorB);
+    const resB = await moveStudentClassAction(s.id, classAId);
+    expect(resB.success).toBe(false);
+
+    // Audit
+    const log = await prisma.auditLog.findFirst({ where: { action: "STUDENT_CLASS_MOVED", targetId: s.id } });
+    expect(log).not.toBeNull();
+  });
+
+  // =========================================================================
+  // B2/OQ-4/F8/G-1 — Reset PIN
+  // =========================================================================
+  it("B2/F8: reset PIN oleh pengampu → hygiene lengkap satu transaksi; non-pengampu & PIN sama ditolak; REJECTED bisa direset (G-1)", async () => {
+    const s = await prisma.student.create({
+      data: { schoolId, fullName: "Reset Pin", nis: `RP${`${ts}`.slice(-7)}`, accountStatus: "PENDING", failedAttempts: 3, lockedUntil: new Date(Date.now() + 10 * 60 * 1000) },
+    });
+    await prisma.classStudent.create({ data: { studentId: s.id, classId: classAId, academicPeriodId: activePeriodId } });
+    // Isi PIN lama "1234"
+    const { hashPin } = await import("@/lib/student-pin");
+    await prisma.student.update({ where: { id: s.id }, data: { accessPinHash: await hashPin("1234") } });
+
+    // Non-pengampu (Guru B) → ditolak server-side
+    setActor(actorB);
+    const denied = await resetStudentPinAction(s.id, "5678");
+    expect(denied.success).toBe(false);
+    expect(denied.message).not.toContain("1234");
+
+    // Pengampu (Guru A): PIN sama dengan lama → ditolak
+    setActor(actorA);
+    const same = await resetStudentPinAction(s.id, "1234");
+    expect(same.success).toBe(false);
+    expect(same.message).toContain("tidak boleh sama");
+
+    // PIN baru → sukses; hygiene lengkap
+    const ok = await resetStudentPinAction(s.id, "5678");
+    expect(ok.success).toBe(true);
+    const after = await prisma.student.findUnique({ where: { id: s.id } });
+    expect(await verifyPin("5678", after!.accessPinHash!)).toBe(true);
+    expect(await verifyPin("1234", after!.accessPinHash!)).toBe(false);
+    expect(after!.failedAttempts).toBe(0);
+    expect(after!.lockedUntil).toBeNull();
+    expect(after!.pinUpdatedAt).not.toBeNull();
+    const log = await prisma.auditLog.findFirst({ where: { action: "STUDENT_PIN_RESET", targetId: s.id } });
+    expect(log).not.toBeNull();
+    // metadata bebas PIN/hash (N4)
+    const meta = JSON.stringify(log!.metadata);
+    expect(meta).not.toContain("5678");
+  });
+
+  // =========================================================================
+  // CAP-7 Superadmin: force approve, ban/reset password (F6/G-3/B5/G-11)
+  // =========================================================================
+  it("L3: force approve oleh superadmin + audit aktor SUPERADMIN", async () => {
+    const s = await prisma.student.create({ data: { schoolId, fullName: "Force", nis: `FC${`${ts}`.slice(-7)}`, accountStatus: "PENDING", accountRequestedAt: new Date() } });
+    const res = await forceApproveStudentAction(s.id);
+    expect(res.success).toBe(true);
+    const updated = await prisma.student.findUnique({ where: { id: s.id } });
+    expect(updated!.accountStatus).toBe("ACTIVE");
+    const log = await prisma.auditLog.findFirst({ where: { action: "STUDENT_ACCOUNT_FORCE_APPROVED", targetId: s.id } });
+    expect(log!.actorType).toBe("SUPERADMIN");
+  });
+
+  it("B5/F6: ban guru → SEMUA sesi revoked + audit; ban target ADMIN ditolak keras (F6)", async () => {
+    // Sesi aktif guru B
+    await prisma.session.create({
+      data: { id: `sess-${ts}`, expiresAt: new Date(Date.now() + 86400000), token: `tok-${ts}`, createdAt: new Date(), updatedAt: new Date(), userId: teacherBUserId },
+    });
+
+    const res = await banTeacherAction(teacherBUserId, "Pelanggaran");
+    expect(res.success).toBe(true);
+    const user = await prisma.user.findUnique({ where: { id: teacherBUserId } });
+    expect(user!.banned).toBe(true);
+    const sessions = await prisma.session.count({ where: { userId: teacherBUserId } });
+    expect(sessions).toBe(0); // B5 — revoke SEMUA sesi
+    const log = await prisma.auditLog.findFirst({ where: { action: "TEACHER_BANNED", targetId: teacherBUserId } });
+    expect(log).not.toBeNull();
+
+    // Unban
+    const unban = await unbanTeacherAction(teacherBUserId);
+    expect(unban.success).toBe(true);
+
+    // F6: ban superadmin → ditolak + audit
+    const banAdmin = await banTeacherAction(superadminUserId, "coba");
+    expect(banAdmin.success).toBe(false);
+    const denyLog = await prisma.auditLog.findFirst({ where: { action: "TEACHER_BAN_DENIED", targetId: superadminUserId } });
+    expect(denyLog).not.toBeNull();
+    const sa = await prisma.user.findUnique({ where: { id: superadminUserId } });
+    expect(sa!.banned).toBe(false);
+  });
+
+  it("B5/G-3: reset password guru sukses + revoke sesi; reset password ADMIN ditolak keras (G-3)", async () => {
+    await prisma.session.create({
+      data: { id: `sess2-${ts}`, expiresAt: new Date(Date.now() + 86400000), token: `tok2-${ts}`, createdAt: new Date(), updatedAt: new Date(), userId: teacherBUserId },
+    });
+
+    const res = await resetTeacherPasswordAction(teacherBUserId, "PasswordBaru123");
+    expect(res.success).toBe(true);
+    const sessions = await prisma.session.count({ where: { userId: teacherBUserId } });
+    expect(sessions).toBe(0);
+    const log = await prisma.auditLog.findFirst({ where: { action: "TEACHER_PASSWORD_RESET", targetId: teacherBUserId } });
+    expect(log).not.toBeNull();
+
+    // G-3: guard identik untuk reset password terhadap ADMIN
+    const denied = await resetTeacherPasswordAction(superadminUserId, "PasswordBaru123");
+    expect(denied.success).toBe(false);
+    const denyLog = await prisma.auditLog.findFirst({ where: { action: "TEACHER_PASSWORD_RESET_DENIED", targetId: superadminUserId } });
+    expect(denyLog).not.toBeNull();
+  });
+
+  // =========================================================================
+  // B5/F7/G-5/G-6/G-4 — Siklus nonaktif sekolah
+  // =========================================================================
+  it("B5/F7/G-5: nonaktif sekolah → urutan aman, npsn clear, sesi revoked, semua gerbang fail-closed", { timeout: 60_000 }, async () => {
+    // Sesi aktif guru A + parent
+    await prisma.session.create({
+      data: { id: `sessA-${ts}`, expiresAt: new Date(Date.now() + 86400000), token: `tokA-${ts}`, createdAt: new Date(), updatedAt: new Date(), userId: teacherAUserId },
+    });
+    await prisma.session.create({
+      data: { id: `sessP-${ts}`, expiresAt: new Date(Date.now() + 86400000), token: `tokP-${ts}`, createdAt: new Date(), updatedAt: new Date(), userId: parentUserId },
+    });
+
+    // Parent profile + relasi ke siswa sekolah ini (G-5)
+    const studentForParent = await prisma.student.create({
+      data: { schoolId, fullName: "Anak Ortu", nis: `OP${`${ts}`.slice(-7)}`, accountStatus: "ACTIVE" },
+    });
+    const parentProfile = await prisma.parentProfile.create({ data: { userId: parentUserId } });
+    await prisma.parentStudentRelation.create({ data: { parentProfileId: parentProfile.id, studentId: studentForParent.id } });
+
+    // Kuis PUBLISHED sekolah ini (G-4)
+    const tc = await prisma.teachingContext.findFirst({ where: { schoolId, academicPeriodId: activePeriodId } });
+    const quiz = await prisma.quiz.create({
+      data: {
+        teachingContextId: tc!.id,
+        title: "Kuis S5",
+        status: "PUBLISHED",
+        shareToken: `s5tok${ts}`,
+        validFrom: new Date(Date.now() - 3600000),
+        deadline: new Date(Date.now() + 86400000),
+        accessMode: "CLASSROOM_PIN",
+        classroomPin: "1111",
+      },
+    });
+
+    // Siswa ACTIVE untuk roster quiz
+    const quizStudent = await prisma.student.create({
+      data: { schoolId, fullName: "Siswa Quiz", nis: `QZ${`${ts}`.slice(-7)}`, accountStatus: "ACTIVE", accessPinHash: null },
+    });
+    await prisma.classStudent.create({ data: { studentId: quizStudent.id, classId: tc!.classId, academicPeriodId: activePeriodId } });
+
+    // Sanity: sebelum nonaktif, gerbang quiz TIDAK menjawab "tidak ditemukan"
+    const before = await startQuizAttemptAction(`s5tok${ts}`, quizStudent.id, "1111");
+    expect(before.error).not.toBe("Quiz tidak ditemukan");
+
+    // === Deaktivasi ===
+    const res = await deactivateSchoolAction(schoolId);
+    expect(res.success).toBe(true);
+
+    const school = await prisma.school.findUnique({ where: { id: schoolId } });
+    expect(school!.deactivatedAt).not.toBeNull();
+    expect(school!.npsn).toBeNull(); // B5 — clear npsn
+
+    // Sesi guru & parent revoked (B5)
+    expect(await prisma.session.count({ where: { userId: teacherAUserId } })).toBe(0);
+    expect(await prisma.session.count({ where: { userId: parentUserId } })).toBe(0);
+
+    // AuditLog
+    const log = await prisma.auditLog.findFirst({ where: { action: "SCHOOL_DEACTIVATED", targetId: schoolId } });
+    expect(log).not.toBeNull();
+
+    // G-4: kuis publik fail-closed generik
+    const after = await startQuizAttemptAction(`s5tok${ts}`, quizStudent.id, "1111");
+    expect(after.success).toBe(false);
+    expect(after.error).toBe("Quiz tidak ditemukan");
+
+    // F7: loginStudent → generic (setelah PIN verify — timing seragam)
+    const student = await prisma.student.findFirst({ where: { nis: `QZ${`${ts}`.slice(-7)}`, schoolId } });
+    await prisma.student.update({ where: { id: student!.id }, data: { accessPinHash: await (async () => (await import("@/lib/student-pin")).hashPin("1234"))() } });
+    const login = await loginStudent({ schoolId, nis: `QZ${`${ts}`.slice(-7)}`, pin: "1234" });
+    expect(login.success).toBe(false);
+
+    // F7: registerStudent & lookupJoinCode fail-closed generik
+    const reg = await registerStudent({ joinCode: joinCodeA, fullName: "Baru S5", nis: `NB${`${ts}`.slice(-6)}`, pin: "1234" });
+    expect(reg.success).toBe(false);
+    const lookup = await lookupJoinCode(joinCodeA);
+    expect(lookup.success).toBe(false);
+
+    // G-5/OQ-6: hook sesi baru guru DAN parent ditolak
+    expect(await assertSessionCreationAllowed(teacherAUserId)).toBe(false);
+    expect(await assertSessionCreationAllowed(parentUserId)).toBe(false);
+
+    // ===== G-6: reaktivasi tanpa NPSN + konflik NPSN tertangani generik =====
+    const react = await reactivateSchoolAction(schoolId);
+    expect(react.success).toBe(true);
+    const reactivated = await prisma.school.findUnique({ where: { id: schoolId } });
+    expect(reactivated!.deactivatedAt).toBeNull();
+    expect(reactivated!.npsn).toBeNull(); // G-6 — tetap null
+
+    // G-6: NPSN sudah diklaim sekolah lain → pengisian ulang gagal generik, tanpa P2002 mentah
+    const otherSchool = await prisma.school.create({
+      data: { name: `Perebut NPSN ${ts}`, normalizedName: `perebut npsn ${ts}`, npsn: `${ts}`.slice(-8) },
+    });
+    const conflict = await setSchoolNpsnAction(schoolId, `${ts}`.slice(-8));
+    expect(conflict.success).toBe(false);
+    expect(conflict.message).toContain("NPSN sudah terdaftar");
+    await prisma.school.delete({ where: { id: otherSchool.id } });
+
+    // G-6: isi NPSN unik → sukses; hook sesi guru mengizinkan kembali
+    const setOk = await setSchoolNpsnAction(schoolId, `8${`${ts}`.slice(-7)}`);
+    expect(setOk.success).toBe(true);
+    expect(await assertSessionCreationAllowed(teacherAUserId)).toBe(true);
+  });
+});
diff --git a/src/modules/approvals/approvals.actions.ts b/src/modules/approvals/approvals.actions.ts
new file mode 100644
index 0000000..278fec1
--- /dev/null
+++ b/src/modules/approvals/approvals.actions.ts
@@ -0,0 +1,693 @@
+"use server";
+
+import { prisma } from "@/lib/auth";
+import { verifyActiveSchoolMembership } from "@/lib/authorization";
+import { redactMetadata } from "@/lib/audit-metadata";
+import { validatePinFormat, hashPin, verifyPin } from "@/lib/student-pin";
+import {
+  notifySchoolTeachers,
+  countUnreadNotifications,
+  listNotifications,
+  markNotificationsRead,
+} from "@/modules/notifications/notifications.service";
+import type { Prisma } from "@prisma/client";
+
+/**
+ * Story 5 — Panel Persetujuan Guru (CAP-4, CAP-7, B2, N5, N6, F1, F5, F8, F12,
+ * OQ-1, OQ-2, OQ-4, G-1, G-2, G-7, G-8).
+ *
+ * Invariant kunci (lihat spec):
+ * - Semua transisi status memakai conditional update `updateMany` berkondisi
+ *   `accountStatus` lama + cek `count` (F5) — kebal race.
+ * - Batch approve: satu `$transaction`, skip-baris-gagal + laporan (OQ-2),
+ *   cap 100 baris server-side (G-8), `AuditLog` per-baris sukses (N6),
+ *   satu notifikasi ringkasan per aksi (F4).
+ * - Highlight eskalasi satu-satunya sumber: `Student.accountRequestedAt` (F2).
+ * - Pengampu rombel = guru dengan TeachingContext pada rombel tsb di periode
+ *   terkait (OQ-1). Kuasa pindah rombel: pengampu sumber ATAU tujuan (F12).
+ * - Reset PIN: monopoli pengampu rombel / superadmin (B2), hygiene lengkap (F8),
+ *   berlaku juga untuk siswa REJECTED (G-1).
+ */
+
+const ESCALATION_L1_HOURS = 48; // highlight panel pengampu (L1)
+const ESCALATION_L2_HOURS = 24 * 7; // highlight panel semua guru (L2)
+const BATCH_APPROVE_MAX = 100; // G-8
+
+const GENERIC_ACTION_ERROR = "Aksi gagal. Muat ulang halaman dan coba lagi.";
+
+// ---------------------------------------------------------------------------
+// Audit helper
+// ---------------------------------------------------------------------------
+
+type PrismaTx = Prisma.TransactionClient;
+
+async function writeAudit(
+  tx: PrismaTx,
+  params: {
+    actorType: "USER" | "SUPERADMIN" | "SYSTEM";
+    actorId: string | null;
+    action: string;
+    targetType: string;
+    targetId: string | null;
+    metadata?: Record<string, unknown>;
+  }
+) {
+  await tx.auditLog.create({
+    data: {
+      actorType: params.actorType,
+      actorId: params.actorId,
+      action: params.action,
+      targetType: params.targetType,
+      targetId: params.targetId,
+      metadata: redactMetadata(params.metadata ?? {}) as Prisma.InputJsonValue,
+    },
+  });
+}
+
+// ---------------------------------------------------------------------------
+// Shared helpers
+// ---------------------------------------------------------------------------
+
+function escalationHoursSince(requestedAt: Date | null): number | null {
+  if (!requestedAt) return null; // data pra-migrasi: tanpa highlight, tetap tampil
+  return Math.floor((Date.now() - requestedAt.getTime()) / (60 * 60 * 1000));
+}
+
+/** Periode aktif sekolah — service layer wajib memvalidasi maksimal satu. */
+async function getActivePeriod(schoolId: string) {
+  const periods = await prisma.academicPeriod.findMany({
+    where: { schoolId, status: "ACTIVE" },
+    select: { id: true, year: true, semester: true },
+  });
+  if (periods.length === 0) return null;
+  // Service-layer guard (constraint spec): maksimal satu periode aktif per sekolah.
+  return periods[0];
+}
+
+/** OQ-1: pengampu rombel = guru dengan TeachingContext pada rombel & periode terkait. */
+async function isPengampuRombel(teacherProfileId: string, classId: string, academicPeriodId: string) {
+  const count = await prisma.teachingContext.count({
+    where: { teacherProfileId, classId, academicPeriodId },
+  });
+  return count > 0;
+}
+
+/** Row ClassStudent siswa: prioritaskan periode aktif, fallback row terbaru. */
+async function getStudentEnrollment(
+  studentId: string,
+  activePeriodId?: string | null,
+  db: Prisma.TransactionClient | typeof prisma = prisma
+) {
+  const rows = await db.classStudent.findMany({
+    where: { studentId },
+    include: {
+      class: { select: { id: true, name: true, schoolId: true } },
+      academicPeriod: { select: { id: true, status: true } },
+    },
+    orderBy: { createdAt: "desc" },
+  });
+  if (rows.length === 0) return null;
+  if (activePeriodId) {
+    const inActive = rows.find((r) => r.academicPeriodId === activePeriodId);
+    if (inActive) return inActive;
+  }
+  return rows[0];
+}
+
+// ---------------------------------------------------------------------------
+// Panel queries
+// ---------------------------------------------------------------------------
+
+export interface PendingStudentView {
+  studentId: string;
+  fullName: string;
+  nis: string | null;
+  classId: string;
+  className: string;
+  academicPeriodId: string;
+  academicPeriodLabel: string;
+  accountRequestedAt: string | null;
+  escalationHours: number | null;
+  escalated: boolean;
+  reason: "MISMATCH_NAME" | "NEW_STUDENT" | "UNKNOWN";
+}
+
+function toPendingView(
+  row: {
+    student: {
+      id: string;
+      fullName: string;
+      nis: string | null;
+      accountRequestedAt: Date | null;
+    };
+    class: { id: string; name: string };
+    academicPeriod: { id: string; year: string; semester: string };
+  },
+  thresholdHours: number
+): PendingStudentView {
+  const hours = escalationHoursSince(row.student.accountRequestedAt);
+  return {
+    studentId: row.student.id,
+    fullName: row.student.fullName,
+    nis: row.student.nis,
+    classId: row.class.id,
+    className: row.class.name,
+    academicPeriodId: row.academicPeriod.id,
+    academicPeriodLabel: `${row.academicPeriod.year} — ${row.academicPeriod.semester}`,
+    accountRequestedAt: row.student.accountRequestedAt?.toISOString() ?? null,
+    escalationHours: hours,
+    escalated: hours !== null && hours > thresholdHours,
+    reason: "UNKNOWN",
+  };
+}
+
+const PENDING_INCLUDE = {
+  student: {
+    select: {
+      id: true,
+      fullName: true,
+      nis: true,
+      accountRequestedAt: true,
+      status: true,
+      accountStatus: true,
+    },
+  },
+  class: { select: { id: true, name: true } },
+  academicPeriod: { select: { id: true, year: true, semester: true } },
+} as const;
+
+/**
+ * Panel L1 per-rombel — hanya pengampu rombel (OQ-1), scope periode aktif.
+ * Highlight eskalasi >48 jam (F2).
+ */
+export async function getPendingStudentsForClassAction(classId: string) {
+  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();
+  const activePeriod = await getActivePeriod(activeSchoolId);
+  if (!activePeriod) {
+    return { success: true, pending: [], escalatedThresholdHours: ESCALATION_L1_HOURS, note: "NO_ACTIVE_PERIOD" };
+  }
+
+  // Verifikasi kuasa pengampu server-side (matrix: "Guru bukan pengampu").
+  const pengampu = await isPengampuRombel(profile.id, classId, activePeriod.id);
+  if (!pengampu) {
+    return { success: false, pending: [], escalatedThresholdHours: ESCALATION_L1_HOURS, note: "NOT_PENGAMPU" };
+  }
+
+  const rows = await prisma.classStudent.findMany({
+    where: {
+      classId,
+      academicPeriodId: activePeriod.id,
+      student: { accountStatus: "PENDING", status: "ACTIVE", schoolId: activeSchoolId },
+    },
+    include: PENDING_INCLUDE,
+    orderBy: [{ student: { accountRequestedAt: "asc" } }],
+  });
+
+  return {
+    success: true,
+    pending: rows.map((r) => toPendingView(r, ESCALATION_L1_HOURS)),
+    escalatedThresholdHours: ESCALATION_L1_HOURS,
+  };
+}
+
+/**
+ * Panel L2 sekolah-wide — semua guru sekolah, TANPA filter periode (G-7).
+ * Highlight eskalasi >7 hari (F2).
+ */
+export async function getPendingStudentsForSchoolAction() {
+  const { activeSchoolId } = await verifyActiveSchoolMembership();
+
+  const rows = await prisma.classStudent.findMany({
+    where: {
+      class: { schoolId: activeSchoolId },
+      student: { accountStatus: "PENDING", status: "ACTIVE" },
+    },
+    include: PENDING_INCLUDE,
+    orderBy: [{ student: { accountRequestedAt: "asc" } }],
+  });
+
+  return {
+    success: true,
+    pending: rows.map((r) => toPendingView(r, ESCALATION_L2_HOURS)),
+    escalatedThresholdHours: ESCALATION_L2_HOURS,
+  };
+}
+
+// ---------------------------------------------------------------------------
+// Approve / Reject (L1/L2 — guru sekolah; conditional update F5)
+// ---------------------------------------------------------------------------
+
+/**
+ * Approve satu siswa PENDING. Kuasa: guru sekolah (L1 bila pengampu rombelnya,
+ * L2 bila bukan — tangga CAP-4). Approve L2 memicu notifikasi ringkasan (B2/F4).
+ */
+export async function approveStudentAction(studentId: string) {
+  const { session, profile, activeSchoolId } = await verifyActiveSchoolMembership();
+
+  try {
+    const result = await prisma.$transaction(async (tx) => {
+      const student = await tx.student.findFirst({
+        where: { id: studentId, schoolId: activeSchoolId },
+        select: { id: true, accountStatus: true },
+      });
+      if (!student || student.accountStatus !== "PENDING") return null;
+
+      const enrollment = await getStudentEnrollment(studentId, null, tx);
+      const approvalLevel =
+        enrollment && (await isPengampuRombel(profile.id, enrollment.classId, enrollment.academicPeriodId))
+          ? "L1"
+          : "L2";
+
+      // Conditional update (F5) — kalah race → count 0 → dilaporkan generik.
+      const updated = await tx.student.updateMany({
+        where: { id: studentId, accountStatus: "PENDING" },
+        data: {
+          accountStatus: "ACTIVE",
+          approvedById: session.user.id,
+          approvedAt: new Date(),
+          accountRequestedAt: null, // F2
+        },
+      });
+      if (updated.count !== 1) return null;
+
+      await writeAudit(tx, {
+        actorType: "USER",
+        actorId: session.user.id,
+        action: "STUDENT_ACCOUNT_APPROVED",
+        targetType: "STUDENT",
+        targetId: studentId,
+        metadata: {
+          approvalLevel,
+          classId: enrollment?.classId ?? null,
+          batch: false,
+        },
+      });
+
+      return { approvalLevel, classId: enrollment?.classId ?? null };
+    });
+
+    if (!result) {
+      return { success: false, message: GENERIC_ACTION_ERROR };
+    }
+
+    // Notifikasi ringkasan B2/F4 — hanya untuk approve L2 (eskalasi antar-guru).
+    if (result.approvalLevel === "L2") {
+      await notifySchoolTeachers({
+        schoolId: activeSchoolId,
+        type: "STUDENT_APPROVAL_L2",
+        payload: {
+          title: "Siswa disetujui (eskalasi L2)",
+          body: "Seorang guru sekolah menyetujui 1 akun siswa pending.",
+          count: 1,
+          link: "/persetujuan",
+        },
+        excludeUserId: session.user.id,
+      });
+    }
+
+    return { success: true, approvalLevel: result.approvalLevel };
+  } catch {
+    return { success: false, message: GENERIC_ACTION_ERROR };
+  }
+}
+
+/** Reject satu siswa PENDING dengan alasan (tersimpan di metadata AuditLog). */
+export async function rejectStudentAction(studentId: string, reason: string) {
+  const { session, activeSchoolId } = await verifyActiveSchoolMembership();
+
+  if (!reason || !reason.trim()) {
+    return { success: false, message: "Alasan penolakan wajib diisi." };
+  }
+
+  try {
+    const result = await prisma.$transaction(async (tx) => {
+      const student = await tx.student.findFirst({
+        where: { id: studentId, schoolId: activeSchoolId },
+        select: { id: true, accountStatus: true },
+      });
+      if (!student || student.accountStatus !== "PENDING") return null;
+
+      const updated = await tx.student.updateMany({
+        where: { id: studentId, accountStatus: "PENDING" },
+        data: {
+          accountStatus: "REJECTED",
+          accountRequestedAt: null, // F2
+          approvedById: null,
+          approvedAt: null,
+        },
+      });
+      if (updated.count !== 1) return null;
+
+      await writeAudit(tx, {
+        actorType: "USER",
+        actorId: session.user.id,
+        action: "STUDENT_ACCOUNT_REJECTED",
+        targetType: "STUDENT",
+        targetId: studentId,
+        metadata: { reason: reason.trim().slice(0, 256) },
+      });
+
+      return true;
+    });
+
+    if (!result) {
+      return { success: false, message: GENERIC_ACTION_ERROR };
+    }
+    return { success: true };
+  } catch {
+    return { success: false, message: GENERIC_ACTION_ERROR };
+  }
+}
+
+/**
+ * Batch approve (N6, OQ-2, G-8): satu `$transaction`, baris kalah race di-skip
+ * + dilaporkan, `AuditLog` per-baris sukses, satu notifikasi ringkasan.
+ */
+export async function batchApproveStudentsAction(studentIds: string[]) {
+  const { session, activeSchoolId } = await verifyActiveSchoolMembership();
+
+  // G-8: cap 100 baris divalidasi server-side — lebih dari itu tolak generik + audit.
+  if (!Array.isArray(studentIds) || studentIds.length === 0 || studentIds.length > BATCH_APPROVE_MAX) {
+    try {
+      await writeAudit(prisma, {
+        actorType: "USER",
+        actorId: session.user.id,
+        action: "BATCH_APPROVE_LIMIT_REJECTED",
+        targetType: "STUDENT",
+        targetId: null,
+        metadata: { requestedCount: Array.isArray(studentIds) ? studentIds.length : null },
+      });
+    } catch {
+      /* audit best-effort */
+    }
+    return {
+      success: false,
+      message: `Batch approve maksimal ${BATCH_APPROVE_MAX} siswa per aksi.`,
+      approvedCount: 0,
+      failed: [],
+    };
+  }
+
+  const approved: string[] = [];
+  const failed: { studentId: string }[] = [];
+  let approvalLevel: "L1" | "L2" = "L2";
+
+  try {
+    await prisma.$transaction(async (tx) => {
+      for (const studentId of studentIds) {
+        const student = await tx.student.findFirst({
+          where: { id: studentId, schoolId: activeSchoolId, accountStatus: "PENDING" },
+          select: { id: true },
+        });
+        if (!student) {
+          failed.push({ studentId });
+          continue;
+        }
+
+        const updated = await tx.student.updateMany({
+          where: { id: studentId, accountStatus: "PENDING" },
+          data: {
+            accountStatus: "ACTIVE",
+            approvedById: session.user.id,
+            approvedAt: new Date(),
+            accountRequestedAt: null,
+          },
+        });
+
+        if (updated.count !== 1) {
+          failed.push({ studentId }); // kalah race (F5) — dilaporkan, tanpa write senyap
+          continue;
+        }
+
+        approved.push(studentId);
+        await writeAudit(tx, {
+          actorType: "USER",
+          actorId: session.user.id,
+          action: "STUDENT_ACCOUNT_APPROVED",
+          targetType: "STUDENT",
+          targetId: studentId,
+          metadata: { batch: true, batchOf: studentIds.length },
+        });
+      }
+    });
+  } catch {
+    return {
+      success: false,
+      message: GENERIC_ACTION_ERROR,
+      approvedCount: 0,
+      failed: studentIds.map((id) => ({ studentId: id })),
+    };
+  }
+
+  // Satu notifikasi ringkasan per aksi (F4) — bukan per-baris.
+  if (approved.length > 0) {
+    await notifySchoolTeachers({
+      schoolId: activeSchoolId,
+      type: "STUDENT_APPROVAL_L2",
+      payload: {
+        title: "Siswa disetujui (batch)",
+        body: `${approved.length} akun siswa pending telah disetujui.`,
+        count: approved.length,
+        link: "/persetujuan",
+      },
+      excludeUserId: session.user.id,
+    });
+  }
+
+  return {
+    success: approved.length > 0,
+    approvedCount: approved.length,
+    approved,
+    failed,
+    approvalLevel,
+  };
+}
+
+/**
+ * L1 lintas-rombel untuk tab "Menunggu Persetujuan" di Daftar Siswa:
+ * seluruh siswa PENDING pada rombel-rombel yang diampu guru di periode aktif.
+ */
+export async function getPendingStudentsForMyClassesAction() {
+  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();
+  const activePeriod = await getActivePeriod(activeSchoolId);
+  if (!activePeriod) {
+    return { success: true, pending: [], escalatedThresholdHours: ESCALATION_L1_HOURS, note: "NO_ACTIVE_PERIOD" };
+  }
+
+  const contexts = await prisma.teachingContext.findMany({
+    where: { teacherProfileId: profile.id, academicPeriodId: activePeriod.id },
+    select: { classId: true, class: { select: { id: true, name: true } } },
+  });
+  const classIds = [...new Set(contexts.map((c) => c.classId))];
+  if (classIds.length === 0) {
+    return { success: true, pending: [], escalatedThresholdHours: ESCALATION_L1_HOURS };
+  }
+
+  const rows = await prisma.classStudent.findMany({
+    where: {
+      classId: { in: classIds },
+      academicPeriodId: activePeriod.id,
+      student: { accountStatus: "PENDING", status: "ACTIVE", schoolId: activeSchoolId },
+    },
+    include: PENDING_INCLUDE,
+    orderBy: [{ student: { accountRequestedAt: "asc" } }],
+  });
+
+  return {
+    success: true,
+    pending: rows.map((r) => toPendingView(r, ESCALATION_L1_HOURS)),
+    escalatedThresholdHours: ESCALATION_L1_HOURS,
+  };
+}
+
+/**
+ * Daftar rombel sekolah (periode aktif) untuk dialog pindah rombel.
+ */
+export async function getSchoolClassesForMoveAction() {
+  const { activeSchoolId } = await verifyActiveSchoolMembership();
+  const activePeriod = await getActivePeriod(activeSchoolId);
+  if (!activePeriod) return { success: true, classes: [] };
+
+  const classes = await prisma.class.findMany({
+    where: {
+      schoolId: activeSchoolId,
+      teachingContexts: { some: { academicPeriodId: activePeriod.id } },
+    },
+    select: { id: true, name: true },
+    orderBy: { name: "asc" },
+  });
+  return { success: true, classes };
+}
+
+// ---------------------------------------------------------------------------
+// Pindah rombel (N5, F12) & Reset PIN (B2, OQ-4, F8, G-1)
+// ---------------------------------------------------------------------------
+
+/**
+ * Pindah rombel siswa PENDING: UPDATE `classId` pada row `ClassStudent` existing
+ * (N5) — bukan delete-insert. Kuasa: pengampu rombel sumber ATAU tujuan (F12).
+ * Target wajib rombel sekolah sama yang terhubung periode aktif (G-7).
+ */
+export async function moveStudentClassAction(studentId: string, targetClassId: string) {
+  const { profile, activeSchoolId } = await verifyActiveSchoolMembership();
+  const activePeriod = await getActivePeriod(activeSchoolId);
+  if (!activePeriod) {
+    return { success: false, message: GENERIC_ACTION_ERROR };
+  }
+
+  try {
+    const result = await prisma.$transaction(async (tx) => {
+      const student = await tx.student.findFirst({
+        where: { id: studentId, schoolId: activeSchoolId },
+        select: { id: true, accountStatus: true },
+      });
+      if (!student || student.accountStatus !== "PENDING") return { ok: false as const };
+
+      const sourceRow = await getStudentEnrollment(studentId, null, tx);
+      if (!sourceRow) return { ok: false as const };
+
+      const targetClass = await tx.class.findFirst({
+        where: {
+          id: targetClassId,
+          schoolId: activeSchoolId,
+          teachingContexts: { some: { academicPeriodId: activePeriod.id } },
+        },
+        select: { id: true },
+      });
+      if (!targetClass) return { ok: false as const };
+
+      // F12: kuasa = pengampu sumber (periode row sumber) ATAU pengampu tujuan (periode aktif).
+      const sourcePengampu = await isPengampuRombel(profile.id, sourceRow.classId, sourceRow.academicPeriodId);
+      const targetPengampu = await isPengampuRombel(profile.id, targetClassId, activePeriod.id);
+      if (!sourcePengampu && !targetPengampu) return { ok: false as const };
+
+      const updated = await tx.classStudent.updateMany({
+        where: { id: sourceRow.id },
+        data: { classId: targetClassId }, // N5 — UPDATE classId saja; @@unique([studentId, academicPeriodId]) terjaga
+      });
+      if (updated.count !== 1) return { ok: false as const };
+
+      await writeAudit(tx, {
+        actorType: "USER",
+        actorId: profile.userId,
+        action: "STUDENT_CLASS_MOVED",
+        targetType: "STUDENT",
+        targetId: studentId,
+        metadata: {
+          fromClassId: sourceRow.classId,
+          toClassId: targetClassId,
+          academicPeriodId: sourceRow.academicPeriodId,
+        },
+      });
+
+      return { ok: true as const };
+    });
+
+    if (!result.ok) {
+      return { success: false, message: GENERIC_ACTION_ERROR };
+    }
+    return { success: true };
+  } catch {
+    return { success: false, message: GENERIC_ACTION_ERROR };
+  }
+}
+
+/**
+ * Reset PIN siswa (B2, OQ-4, F8, G-1): HANYA pengampu rombel siswa di periode
+ * terkait atau superadmin. Berlaku untuk siswa PENDING/ACTIVE/REJECTED (G-1
+ * menjadikan reset PIN REJECTED sebagai jalur pulih daftar ulang).
+ * Hygiene lengkap dalam satu transaksi (F8); rotasi `pinUpdatedAt` menghanguskan
+ * sesi perangkat lain.
+ */
+export async function resetStudentPinAction(studentId: string, newPin: string) {
+  const { session, profile, activeSchoolId } = await verifyActiveSchoolMembership();
+
+  try {
+    validatePinFormat(newPin);
+  } catch {
+    return { success: false, message: "PIN baru harus 4 digit angka." };
+  }
+
+  try {
+    const result = await prisma.$transaction(async (tx) => {
+      const student = await tx.student.findFirst({
+        where: { id: studentId, schoolId: activeSchoolId },
+        select: { id: true, accessPinHash: true, accountStatus: true },
+      });
+      if (!student) return { ok: false as const };
+
+      // B2: kuasa = pengampu rombel siswa (periode row) ATAU superadmin.
+      const enrollment = await getStudentEnrollment(studentId, null, tx);
+      const isSuperadmin = false; // guru biasa di sini; superadmin memakai modul admin
+      let authorized = false;
+      if (enrollment) {
+        authorized = await isPengampuRombel(profile.id, enrollment.classId, enrollment.academicPeriodId);
+      }
+
+      if (!authorized && !isSuperadmin) return { ok: false as const };
+
+      // OQ-4: PIN baru wajib berbeda dari PIN lama.
+      if (student.accessPinHash && (await verifyPin(newPin, student.accessPinHash))) {
+        return { ok: false as const, samePin: true as const };
+      }
+
+      const newHash = await hashPin(newPin);
+      const now = new Date();
+
+      // F8 hygiene lengkap dalam satu transaksi.
+      const updated = await tx.student.updateMany({
+        where: { id: studentId },
+        data: {
+          accessPinHash: newHash,
+          pinUpdatedAt: now,
+          failedAttempts: 0,
+          lockedUntil: null,
+        },
+      });
+      if (updated.count !== 1) return { ok: false as const };
+
+      await writeAudit(tx, {
+        actorType: "USER",
+        actorId: session.user.id,
+        action: "STUDENT_PIN_RESET",
+        targetType: "STUDENT",
+        targetId: studentId,
+        metadata: {
+          accountStatus: student.accountStatus,
+          classId: enrollment?.classId ?? null,
+        },
+      });
+
+      return { ok: true as const };
+    });
+
+    if (!result.ok) {
+      if ("samePin" in result && result.samePin) {
+        return { success: false, message: "PIN baru tidak boleh sama dengan PIN lama." };
+      }
+      return { success: false, message: GENERIC_ACTION_ERROR };
+    }
+    return { success: true };
+  } catch {
+    return { success: false, message: GENERIC_ACTION_ERROR };
+  }
+}
+
+// ---------------------------------------------------------------------------
+// Notifikasi — badge feed header dashboard (OQ-3)
+// ---------------------------------------------------------------------------
+
+export async function getMyNotificationsAction() {
+  const { session } = await verifyActiveSchoolMembership();
+  const [items, unreadCount] = await Promise.all([
+    listNotifications(session.user.id),
+    countUnreadNotifications(session.user.id),
+  ]);
+  return { success: true, items, unreadCount };
+}
+
+export async function markMyNotificationsReadAction(ids?: string[]) {
+  const { session } = await verifyActiveSchoolMembership();
+  const count = await markNotificationsRead(session.user.id, ids);
+  return { success: true, count };
+}
diff --git a/src/modules/notifications/notifications.service.ts b/src/modules/notifications/notifications.service.ts
new file mode 100644
index 0000000..8ef0cd4
--- /dev/null
+++ b/src/modules/notifications/notifications.service.ts
@@ -0,0 +1,88 @@
+import { prisma } from "@/lib/auth";
+
+/**
+ * Story 5 — infrastruktur notifikasi aditif (OQ-3, F4).
+ *
+ * Prinsip aggregate-per-aksi: satu aksi (individu maupun batch) menghasilkan
+ * TEPAT SATU notifikasi ringkasan per penerima — bukan per-baris. Model ini
+ * reusable untuk Gelombang 3 (koreksi tugas) dan Gelombang 4 (AI tutor).
+ * Email = non-goal (belum ada SMTP).
+ */
+
+export interface NotificationSummaryPayload {
+  title: string;
+  body: string;
+  link?: string;
+  count?: number;
+  [key: string]: unknown;
+}
+
+/**
+ * Penerima = semua guru dengan membership ACTIVE pada sekolah tersebut.
+ * `excludeUserId` dipakai agar aktor tidak menotifikasi dirinya sendiri.
+ */
+export async function notifySchoolTeachers(params: {
+  schoolId: string;
+  type: string;
+  payload: NotificationSummaryPayload;
+  excludeUserId?: string;
+}): Promise<number> {
+  const memberships = await prisma.teacherSchoolMembership.findMany({
+    where: { schoolId: params.schoolId, status: "ACTIVE" },
+    select: { teacherProfile: { select: { userId: true } } },
+  });
+
+  const recipientIds = [
+    ...new Set(
+      memberships
+        .map((m) => m.teacherProfile.userId)
+        .filter((id) => id && id !== params.excludeUserId)
+    ),
+  ];
+
+  if (recipientIds.length === 0) return 0;
+
+  const result = await prisma.notification.createMany({
+    data: recipientIds.map((userId) => ({
+      userId,
+      schoolId: params.schoolId,
+      type: params.type,
+      payload: params.payload as object,
+    })),
+  });
+
+  return result.count;
+}
+
+export async function countUnreadNotifications(userId: string): Promise<number> {
+  return prisma.notification.count({
+    where: { userId, readAt: null },
+  });
+}
+
+export async function listNotifications(userId: string, take = 20) {
+  return prisma.notification.findMany({
+    where: { userId },
+    orderBy: { createdAt: "desc" },
+    take,
+    select: {
+      id: true,
+      type: true,
+      payload: true,
+      readAt: true,
+      createdAt: true,
+    },
+  });
+}
+
+export async function markNotificationsRead(userId: string, ids?: string[]): Promise<number> {
+  const result = await prisma.notification.updateMany({
+    where: {
+      userId,
+      readAt: null,
+      ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
+    },
+    data: { readAt: new Date() },
+  });
+  return result.count;
+}
diff --git a/src/modules/parent/parent.service.ts b/src/modules/parent/parent.service.ts
index f2ac451..f7ffef2 100644
--- a/src/modules/parent/parent.service.ts
+++ b/src/modules/parent/parent.service.ts
@@ -492,6 +492,7 @@ export async function getParentAuthorizedContexts(parentProfileId: string): Prom
     where: {
       parentStudentRelation: {
         parentProfileId: parentProfileId,
+        student: { school: { deactivatedAt: null } }, // Story 5 F7 — fail-closed sekolah nonaktif
       },
       status: "ACTIVE",
     },
diff --git a/src/modules/quiz/quiz.actions.ts b/src/modules/quiz/quiz.actions.ts
index b87849d..88999e0 100644
--- a/src/modules/quiz/quiz.actions.ts
+++ b/src/modules/quiz/quiz.actions.ts
@@ -980,7 +980,7 @@ export async function gradeStudentEssayAction(
 // ============================================================================
 
 async function getPublishedQuizByToken(token: string) {
-  return prisma.quiz.findUnique({
+  const quiz = await prisma.quiz.findUnique({
     where: { shareToken: token },
     include: {
       _count: { select: { questions: true } },
@@ -989,6 +989,7 @@ async function getPublishedQuizByToken(token: string) {
           academicPeriod: true,
           class: {
             include: {
+              school: { select: { deactivatedAt: true } }, // Story 5 G-4 — fail-closed
               classStudents: {
                 include: { student: { select: { id: true, fullName: true, status: true } } },
               },
@@ -998,6 +999,15 @@ async function getPublishedQuizByToken(token: string) {
       },
     },
   });
+
+  // Story 5 G-4: sekolah nonaktif → kuis publik /q/[token] fail-closed.
+  // Mengembalikan null = jalur "tidak ditemukan" generik di semua pemanggil —
+  // tanpa membocorkan status sekolah.
+  if (quiz?.teachingContext?.class?.school?.deactivatedAt) {
+    return null;
+  }
+
+  return quiz;
 }
 
 export async function getPublicQuizAction(token: string): Promise<{
diff --git a/src/modules/student-auth/student-auth.actions.ts b/src/modules/student-auth/student-auth.actions.ts
index cfe354c..ed42b89 100644
--- a/src/modules/student-auth/student-auth.actions.ts
+++ b/src/modules/student-auth/student-auth.actions.ts
@@ -2,6 +2,8 @@
 
 import { prisma } from "@/lib/auth";
 import { validatePinFormat, hashPin, verifyPin } from "@/lib/student-pin";
+import { redactMetadata } from "@/lib/audit-metadata";
+import type { Prisma } from "@prisma/client";
 import { 
   setStudentSessionCookie, 
   clearStudentSessionCookie,
@@ -33,7 +35,7 @@ export async function lookupJoinCode(code: string) {
     where: { joinCode: cleanCode },
     include: {
       school: {
-        select: { id: true, name: true, city: true },
+        select: { id: true, name: true, city: true, deactivatedAt: true }, // Story 5 F7
       },
       teachingContexts: {
         include: {
@@ -55,6 +57,12 @@ export async function lookupJoinCode(code: string) {
     return { success: false, message: "Kode rombel tidak ditemukan." };
   }
 
+  // Story 5 F7: sekolah nonaktif → lookup fail-closed (pesan generik identik,
+  // tidak membocorkan status sekolah).
+  if (classRecord.school?.deactivatedAt) {
+    return { success: false, message: "Kode rombel tidak ditemukan." };
+  }
+
   if (classRecord.joinCodeLocked) {
     return { success: false, message: "Kode rombel telah dikunci oleh guru." };
   }
@@ -125,6 +133,9 @@ export async function registerStudent(data: {
   const classRecord = await prisma.class.findUnique({
     where: { joinCode: cleanCode },
     include: {
+      school: {
+        select: { id: true, name: true, deactivatedAt: true }, // Story 5 F7 — fail-closed
+      },
       teachingContexts: {
         select: { academicPeriodId: true },
         take: 1,
@@ -136,6 +147,11 @@ export async function registerStudent(data: {
     return { success: false, message: "Kode rombel tidak ditemukan." };
   }
 
+  // Story 5 F7: sekolah nonaktif → semua gerbang pendaftaran fail-closed (pesan generik).
+  if (classRecord.school?.deactivatedAt) {
+    return { success: false, message: "Kode rombel tidak ditemukan." };
+  }
+
   if (classRecord.joinCodeLocked) {
     return { success: false, message: "Kode rombel telah dikunci oleh guru." };
   }
@@ -153,15 +169,23 @@ export async function registerStudent(data: {
     },
   });
 
-  // F1 CRITICAL Anti-Takeover: Jika akun sudah memiliki accessPinHash aktif, tolak keras registrasi ulang!
-  if (existingStudent && existingStudent.accessPinHash !== null) {
+  // F1 CRITICAL Anti-Takeover (Story 4): akun ber-PIN selain REJECTED ditolak keras.
+  // Story 5 F1 + G-1: jalur daftar ulang REJECTED diizinkan dengan verifikasi
+  // PIN lama wajib (bukti kepemilikan satu-satunya) — cabang khusus ada di bawah.
+  if (
+    existingStudent &&
+    existingStudent.accessPinHash !== null &&
+    existingStudent.accountStatus !== "REJECTED"
+  ) {
     return {
       success: false,
       message: `Akun siswa dengan NIS ${cleanNis} sudah terdaftar. Silakan login langsung menggunakan NIS dan PIN Anda, atau hubungi guru pengampu untuk mereset PIN jika lupa.`,
     };
   }
 
-  // Skenario (d): Cek apakah siswa sudah terdaftar di rombel lain pada periode aktif yang sama
+  // Skenario (d): Cek apakah siswa sudah terdaftar di rombel lain pada periode aktif yang sama.
+  // Story 5 G-2: siswa REJECTED daftar ulang ke rombel berbeda diarahkan ke UPDATE
+  // classId pada row ClassStudent existing (N5) — bukan ditolak.
   const existingEnrollment = await prisma.classStudent.findFirst({
     where: {
       academicPeriodId,
@@ -175,7 +199,11 @@ export async function registerStudent(data: {
     },
   });
 
-  if (existingEnrollment && existingEnrollment.class.id !== classRecord.id) {
+  if (
+    existingEnrollment &&
+    existingEnrollment.class.id !== classRecord.id &&
+    existingStudent?.accountStatus !== "REJECTED"
+  ) {
     return {
       success: false,
       message: `Siswa dengan NIS ${cleanNis} sudah terdaftar di rombel "${existingEnrollment.class.name}" pada tahun ajaran ini. Minta guru untuk memindahkan rombel jika ada perubahan kelas.`,
@@ -185,6 +213,96 @@ export async function registerStudent(data: {
   const pinHash = await hashPin(data.pin);
   const now = new Date();
 
+  // Story 5 F1 + G-1 — Jalur daftar ulang REJECTED:
+  // PIN lama wajib cocok (bukti kepemilikan satu-satunya); row TIDAK disentuh bila salah.
+  if (existingStudent && existingStudent.accountStatus === "REJECTED" && existingStudent.accessPinHash) {
+    const oldPinValid = await verifyPin(data.pin, existingStudent.accessPinHash);
+    if (!oldPinValid) {
+      // G-1: tolak generik + AuditLog percobaan; row tidak berubah.
+      await prisma.auditLog.create({
+        data: {
+          actorType: "STUDENT",
+          actorId: existingStudent.id,
+          action: "STUDENT_RE_REGISTER_DENIED",
+          targetType: "STUDENT",
+          targetId: existingStudent.id,
+          metadata: redactMetadata({ reason: "OLD_PIN_MISMATCH" }) as Prisma.InputJsonValue,
+        },
+      });
+      return {
+        success: false,
+        message: "NIS, nama, atau PIN tidak cocok dengan data sekolah.",
+      };
+    }
+
+    const nameChanged = existingStudent.fullName.trim().toLowerCase() !== cleanFullName.toLowerCase();
+    const movedClass = existingEnrollment ? existingEnrollment.class.id !== classRecord.id : false;
+
+    const reRegistered = await prisma.$transaction(async (tx) => {
+      // Conditional update (F5): hanya bila masih REJECTED — kalah race dengan approve → gagal generik.
+      const updated = await tx.student.updateMany({
+        where: { id: existingStudent.id, accountStatus: "REJECTED" },
+        data: {
+          accessPinHash: pinHash,
+          fullName: cleanFullName,
+          accountStatus: "PENDING",
+          pinUpdatedAt: now,
+          failedAttempts: 0,
+          lockedUntil: null,
+          accountRequestedAt: now, // F2
+          approvedById: null,
+          approvedAt: null,
+        },
+      });
+      if (updated.count !== 1) return false;
+
+      // N5 + G-2: reuse row enrollment — pindah rombel = UPDATE classId, bukan delete-insert.
+      await tx.classStudent.upsert({
+        where: {
+          studentId_academicPeriodId: {
+            studentId: existingStudent.id,
+            academicPeriodId,
+          },
+        },
+        create: { studentId: existingStudent.id, classId: classRecord.id, academicPeriodId },
+        update: { classId: classRecord.id },
+      });
+
+      await tx.auditLog.create({
+        data: {
+          actorType: "STUDENT",
+          actorId: existingStudent.id,
+          action: "STUDENT_RE_REGISTERED",
+          targetType: "STUDENT",
+          targetId: existingStudent.id,
+          metadata: redactMetadata({
+            attempt: 2,
+            nameChanged,
+            nameChangedFrom: nameChanged ? existingStudent.fullName : undefined,
+            movedClass,
+            classId: classRecord.id,
+          }) as Prisma.InputJsonValue,
+        },
+      });
+
+      return true;
+    });
+
+    if (!reRegistered) {
+      return { success: false, message: "Pendaftaran gagal. Coba beberapa saat lagi." };
+    }
+
+    return {
+      success: true,
+      status: "PENDING",
+      reason: "MISMATCH_NAME",
+      student: { id: existingStudent.id, fullName: cleanFullName, nis: cleanNis },
+      message: nameChanged
+        ? "Pendaftaran ulang terkirim. Perubahan nama akan diverifikasi guru pengampu."
+        : "Pendaftaran ulang terkirim. Akun menunggu persetujuan guru pengampu.",
+    };
+  }
+
   // Skenario (a): NIS ada, accessPinHash null, nama cocok exact (case-insensitive) -> L0 ACTIVE
   if (
     existingStudent &&
@@ -255,6 +373,7 @@ export async function registerStudent(data: {
           pinUpdatedAt: now,
           failedAttempts: 0,
           lockedUntil: null,
+          accountRequestedAt: now, // Story 5 F2 — sumber tunggal eskalasi
         },
         select: SAFE_STUDENT_SELECT,
       });
@@ -300,6 +419,7 @@ export async function registerStudent(data: {
         accountStatus: "PENDING",
         pinUpdatedAt: now,
         failedAttempts: 0,
+        accountRequestedAt: now, // Story 5 F2 — sumber tunggal eskalasi
       },
       select: SAFE_STUDENT_SELECT,
     });
@@ -368,7 +488,7 @@ export async function loginStudent(data: {
     },
     include: {
       school: {
-        select: { id: true, name: true },
+        select: { id: true, name: true, deactivatedAt: true }, // Story 5 F7
       },
     },
   });
@@ -479,6 +599,12 @@ export async function loginStudent(data: {
     },
   });
 
+  // Story 5 F7: sekolah nonaktif → login siswa gagal generik (timing seragam —
+  // dicek SETELAH verifikasi PIN agar tidak membocorkan status sekolah).
+  if (student.school?.deactivatedAt) {
+    return { success: false, message: genericErrorMessage };
+  }
+
   // Ambil rombel aktif siswa
   const classMembership = await prisma.classStudent.findFirst({
     where: { studentId: student.id },
diff --git a/src/modules/student-auth/student-session.ts b/src/modules/student-auth/student-session.ts
index e7f436f..9fd13cc 100644
--- a/src/modules/student-auth/student-session.ts
+++ b/src/modules/student-auth/student-session.ts
@@ -159,6 +159,7 @@ export async function verifyStudentSession(): Promise<StudentSessionPayload | nu
         status: true,
         accountStatus: true,
         pinUpdatedAt: true,
+        school: { select: { deactivatedAt: true } }, // Story 5 F7 — fail-closed sekolah nonaktif
       },
     });
 
@@ -171,6 +172,11 @@ export async function verifyStudentSession(): Promise<StudentSessionPayload | nu
       return null;
     }
 
+    // Story 5 F7: sekolah nonaktif → sesi existing siswa fail-closed seketika
+    if (student.school?.deactivatedAt) {
+      return null;
+    }
+
     // F3: Jika PIN di-reset oleh guru (pinUpdatedAt berbeda), batalkan sesi seketika
     const dbPinUpdatedIso = student.pinUpdatedAt ? student.pinUpdatedAt.toISOString() : null;
     if (payload.pinUpdatedAt !== dbPinUpdatedIso) {
diff --git a/src/proxy.ts b/src/proxy.ts
index 505eec0..937b707 100644
--- a/src/proxy.ts
+++ b/src/proxy.ts
@@ -4,7 +4,20 @@ import { STUDENT_SESSION_COOKIE_NAME, verifyStudentSessionToken } from "@/module
 
 export default function proxy(request: NextRequest) {
   const { pathname } = request.nextUrl;
-  
+
+  // 0. Proteksi optimistic area superadmin: /admin/* (Story 5 F3/G-9).
+  //    Proxy TIDAK menulis DB (edge runtime) — audit denial lahir dari
+  //    requireSuperAdmin() di layout/handler. Validasi role nyata di server.
+  if (pathname.startsWith("/admin")) {
+    const adminSessionCookie =
+      request.cookies.get("better-auth.session_token")?.value ||
+      request.cookies.get("__Secure-better-auth.session_token")?.value;
+
+    if (!adminSessionCookie) {
+      return NextResponse.redirect(new URL("/login", request.url));
+    }
+  }
+
   // 1. Proteksi rute portal siswa: /siswa/portal/*
   if (pathname.startsWith("/siswa/portal")) {
     const studentCookie = request.cookies.get(STUDENT_SESSION_COOKIE_NAME);

```
