# Verification Gap Review Prompt — spec-neon-drift-reconciliation

Read the instruction below completely and follow it as your review instructions.

## INSTRUCTIONS
Goal: Find changed behavior that could break without reliable verification catching it.
Ask: "if the behavior this change is supposed to produce broke where it's actually used, would verification fail?"

Output Format:
Emit each verification-gap finding as one block following:
```markdown
### <one-line title naming the gap>

- **Changed surface:** the exact behavior or contract that changed — `file:line`.
- **Impacted consumer or site:** named concretely with `file:line`.
- **Existing test evidence:** what the relevant test asserts or search results.
- **Missing verification:** the precise assertion or check that's absent.
- **Demonstration:** the concrete regression that would ship undetected.
- **Consequence:** what ships wrong.
- **Disposition:** `patch` or `defer`.
```

If no verification gaps, output:
`No verification gaps found.`

## REVIEW CONTENT (DIFF)
```diff
diff --git a/_bmad-output/implementation-artifacts/deferred-work.md b/_bmad-output/implementation-artifacts/deferred-work.md
index 31a3eaa..74c78f6 100644
--- a/_bmad-output/implementation-artifacts/deferred-work.md
+++ b/_bmad-output/implementation-artifacts/deferred-work.md
@@ -10,17 +10,17 @@
   summary: Allowlist parser + seeder superadmin (`superadmin-allowlist.ts`, `seed-superadmin.ts`, tsx + npm script, `SUPERADMIN_EMAILS` env) dipecah menjadi Story 1c — kontrak elicitation utuh di `stories/1c-allowlist-seeder-superadmin.md`.
   evidence: Pecahan 3 arah Story 1 (token-gate Build step-02, disetujui human 2026-09-20); prasyarat 1a merged (kolom platformRole + tabel AuditLog).
 - source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
-  summary: Rekonsiliasi drift Neon existing — perubahan schedule/prosem (commit f0be2d5: teaching_schedule, academic_plan_item, learning_objective, academic_context_profile, teaching_session.teachingScheduleId) ada di schema.prisma + Neon (via db push masa lalu) TAPI tidak punya file migrasi; perlu migrasi rekonsiliasi agar `migrate deploy`/fresh-local replay menghasilkan schema identik.
-  evidence: Ditemukan saat Build 1a 2026-09-20 (migrate dev menuntut reset karena history ≠ schema); utang pra-existing, sengaja dikecualikan dari file migrasi 1a demi scope discipline.
+  summary: [SETTLED 2026-09-21 via spec-neon-drift-reconciliation] Rekonsiliasi drift Neon existing — migrasi `20260921000000_reconcile_schedule_prosem_drift` dibuat via diff shadow, diterapkan di Neon via `migrate resolve --applied`. Chain 20 file kini sinkron 100% dengan schema.prisma.
+  evidence: Ditemukan saat Build 1a 2026-09-20; dilunasi 2026-09-21 (gate exit 0, migrate status 20 up-to-date).
 
 # Review 1a pass 1 — defer entries (2026-09-20)
 
 - source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
-  summary: Migrasi rekonsiliasi drift schedule/prosem (f0be2d5) WAJIB land sebelum `migrate deploy` pertama ke env fresh/CI dan sebelum migrasi apa pun yang menyentuh tabel drift.
-  evidence: Replay 19 file ≠ schema.prisma ≠ Neon (db push masa lalu); fresh env gagal senyap saat client hasil generate INSERT kolom hilang (dibuktikan insiden 2 suite merah 2026-09-20).
+  summary: [SETTLED 2026-09-21 via spec-neon-drift-reconciliation] Migrasi rekonsiliasi drift schedule/prosem (f0be2d5) sudah land sebagai `20260921000000_reconcile_schedule_prosem_drift`.
+  evidence: Replay 20 file = schema.prisma = Neon. Gate verify:migrations exit 0.
 - source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
-  summary: Gate verifikasi otomatis file migrasi (`migrate diff --from-migrations --to-schema --exit-code`) diaktifkan segera setelah rekonsiliasi drift lunas.
-  evidence: VG1 pre-verified: menghapus baris migrasi tetap hijau di semua verifikasi 1a (test menyentuh Neon yang sudah dimigrasi, bukan file); gate hari ini merah karena drift pra-existing.
+  summary: [SETTLED 2026-09-21 via spec-neon-drift-reconciliation] Gate verifikasi otomatis file migrasi (`npm run verify:migrations`) diaktifkan via `scripts/verify-migrations.mjs` pasca-rekonsiliasi drift lunas.
+  evidence: VG1 pre-verified; aktif 2026-09-21, exit 0 pada chain bersih, mendeteksi drift secara otomatis.
 - source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md`
   summary: Proyeksikan kolom (select) di getStudents/updateStudent/archiveStudent SEBELUM Story 3 mengisi accessPinHash — jika tidak, hash PIN terkirim ke klien via server action.
   evidence: VG-other2: students.actions.ts:94 tanpa select; hari ini kolom null (aman), begitu terisi = kebocoran hash.
diff --git a/_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md b/_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md
index 706c7b0..0b21a8b 100644
--- a/_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md
+++ b/_bmad-output/specs/spec-student-portal-auth/stories/1a-schema-fondasi-migrasi.md
@@ -67,6 +67,8 @@ context:
 
 ## Spec Change Log
 
+- 2026-09-21 — **Rekonsiliasi Drift Neon Lunas**: Migrasi `20260921000000_reconcile_schedule_prosem_drift` diterapkan di Neon via `migrate resolve --applied`. Gate verifikasi otomatis `npm run verify:migrations` aktif (exit 0). Neon kini 20 migrasi up-to-date, replay chain = schema.prisma identik. Utang VG1, BH5, EC2 lunas penuh.
+
 - 2026-09-20 — **Loopback bad_spec #1** (review pass 1; temuan BH2/BH3/BH4/EC3/VG-other1, verdict high): prosedur migrasi terdokumentasi basi — Verification/Task memerintahkan `migrate dev` yang realitasnya menuntut RESET (drift pra-existing), serta invoke_dev_with stories.yaml menyuruh target yang tak aman. **Amendemen:** Task #2 & Verification 1a ditulis ulang ke prosedur aktual (migrate diff → db execute → migrate resolve, direct URL Neon, larangan migrate dev hingga rekonsiliasi); klarifikasi state bookkeeping lokal; invoke_dev_with 1a di stories.yaml dikoreksi; Never 1c diperketat. **Known-bad yang dihindari:** developer mengikuti Verification lama → prompt reset → data Neon hilang. **KEEP (wajib bertahan re-derivasi):** (1) seluruh perubahan schema.prisma & file migrasi 20260920135945 — byte-identik, re-derivasi dari spec teramendemen menghasilkan kode yang sama (nol delta kode); (2) seluruh entri Implementation Notes insiden; (3) larangan db push terhadap Neon.
 
 - 2026-09-20 — Pecahan 3 arah Story 1 (Build step-02 token-gate, disetujui human): scope schema+migrasi menjadi story ini; primitif PIN → 1b, allowlist+seeder → 1c. Seluruh pengerasan elicitation dipindah utuh; sejarah lengkap: `1-fondasi-database-primitif-keamanan.elicitation-report.md` (file selevel).
diff --git a/package.json b/package.json
index 5e2e8f9..7c04a92 100644
--- a/package.json
+++ b/package.json
@@ -9,7 +9,8 @@
     "lint": "eslint .",
     "test": "vitest run",
     "postinstall": "prisma generate",
-    "seed:superadmin": "tsx --env-file-if-exists=.env scripts/seed-superadmin.ts"
+    "seed:superadmin": "tsx --env-file-if-exists=.env scripts/seed-superadmin.ts",
+    "verify:migrations": "node scripts/verify-migrations.mjs"
   },
   "dependencies": {
     "@base-ui/react": "^1.7.0",
diff --git a/prisma/migrations/20260921000000_reconcile_schedule_prosem_drift/migration.sql b/prisma/migrations/20260921000000_reconcile_schedule_prosem_drift/migration.sql
new file mode 100644
index 0000000..80118da
--- /dev/null
+++ b/prisma/migrations/20260921000000_reconcile_schedule_prosem_drift/migration.sql
@@ -0,0 +1,62 @@
+-- CreateEnum
+CREATE TYPE "PlanItemCategory" AS ENUM ('REGULAR_MATERIAL', 'STS', 'SAS', 'RESERVE');
+
+-- DropIndex
+DROP INDEX "academic_plan_item_teachingContextId_orderIndex_idx";
+
+-- AlterTable
+ALTER TABLE "academic_context_profile" ADD COLUMN     "effectiveWeeksSem1" INTEGER NOT NULL DEFAULT 18,
+ADD COLUMN     "effectiveWeeksSem2" INTEGER NOT NULL DEFAULT 16,
+ADD COLUMN     "hoursPerWeek" INTEGER NOT NULL DEFAULT 3;
+
+-- AlterTable
+ALTER TABLE "academic_plan_item" ADD COLUMN     "category" "PlanItemCategory" NOT NULL DEFAULT 'REGULAR_MATERIAL',
+ADD COLUMN     "learningObjectiveId" TEXT,
+ADD COLUMN     "targetSemester" INTEGER NOT NULL DEFAULT 1,
+ADD COLUMN     "weeklyDistribution" JSONB;
+
+-- AlterTable
+ALTER TABLE "learning_objective" ADD COLUMN     "allocatedHours" INTEGER DEFAULT 6,
+ADD COLUMN     "targetSemester" INTEGER DEFAULT 1;
+
+-- AlterTable
+ALTER TABLE "teaching_session" ADD COLUMN     "teachingScheduleId" TEXT;
+
+-- CreateTable
+CREATE TABLE "teaching_schedule" (
+    "id" TEXT NOT NULL,
+    "teachingContextId" TEXT NOT NULL,
+    "dayOfWeek" INTEGER NOT NULL,
+    "startTime" TEXT NOT NULL,
+    "endTime" TEXT NOT NULL,
+    "room" TEXT,
+    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
+    "updatedAt" TIMESTAMP(3) NOT NULL,
+
+    CONSTRAINT "teaching_schedule_pkey" PRIMARY KEY ("id")
+);
+
+-- CreateIndex
+CREATE INDEX "teaching_schedule_teachingContextId_dayOfWeek_idx" ON "teaching_schedule"("teachingContextId", "dayOfWeek");
+
+-- CreateIndex
+CREATE INDEX "teaching_schedule_dayOfWeek_startTime_idx" ON "teaching_schedule"("dayOfWeek", "startTime");
+
+-- CreateIndex
+CREATE INDEX "academic_plan_item_teachingContextId_targetSemester_orderIn_idx" ON "academic_plan_item"("teachingContextId", "targetSemester", "orderIndex");
+
+-- CreateIndex
+CREATE INDEX "academic_plan_item_learningObjectiveId_idx" ON "academic_plan_item"("learningObjectiveId");
+
+-- CreateIndex
+CREATE INDEX "teaching_session_teachingScheduleId_idx" ON "teaching_session"("teachingScheduleId");
+
+-- AddForeignKey
+ALTER TABLE "teaching_session" ADD CONSTRAINT "teaching_session_teachingScheduleId_fkey" FOREIGN KEY ("teachingScheduleId") REFERENCES "teaching_schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
+
+-- AddForeignKey
+ALTER TABLE "teaching_schedule" ADD CONSTRAINT "teaching_schedule_teachingContextId_fkey" FOREIGN KEY ("teachingContextId") REFERENCES "teaching_context"("id") ON DELETE CASCADE ON UPDATE CASCADE;
+
+-- AddForeignKey
+ALTER TABLE "academic_plan_item" ADD CONSTRAINT "academic_plan_item_learningObjectiveId_fkey" FOREIGN KEY ("learningObjectiveId") REFERENCES "learning_objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
+
diff --git a/scripts/verify-migrations.mjs b/scripts/verify-migrations.mjs
new file mode 100644
index 0000000..884c211
--- /dev/null
+++ b/scripts/verify-migrations.mjs
@@ -0,0 +1,127 @@
+import { spawn, execSync } from 'node:child_process';
+import net from 'node:net';
+import pg from 'pg';
+const { Client } = pg;
+
+const DEFAULT_PORT = 51214;
+const SHADOW_URL = `postgres://postgres:postgres@localhost:${DEFAULT_PORT}/shadow_db?sslmode=disable`;
+const TEMPLATE_URL = `postgres://postgres:postgres@localhost:${DEFAULT_PORT}/template1?sslmode=disable`;
+
+function checkPort(port) {
+  return new Promise((resolve) => {
+    const socket = net.connect(port, 'localhost', () => {
+      socket.end();
+      resolve(true);
+    });
+    socket.on('error', () => {
+      resolve(false);
+    });
+  });
+}
+
+async function ensurePrismaDevEngine() {
+  const isUp = await checkPort(DEFAULT_PORT);
+  if (isUp) {
+    return;
+  }
+
+  console.log('[verify-migrations] Prisma dev engine is not running. Starting default server in background...');
+  try {
+    // Start background process
+    const child = spawn('npx', ['prisma', 'dev', 'start', 'default'], {
+      stdio: 'ignore',
+      detached: true,
+      shell: true,
+    });
+    child.unref();
+
+    // Poll until port is open (up to 10 seconds)
+    const startTime = Date.now();
+    while (Date.now() - startTime < 10000) {
+      await new Promise((r) => setTimeout(r, 500));
+      if (await checkPort(DEFAULT_PORT)) {
+        console.log('[verify-migrations] Prisma dev engine is now online.');
+        return;
+      }
+    }
+    throw new Error('Timed out waiting for Prisma dev engine on port ' + DEFAULT_PORT);
+  } catch (err) {
+    console.error('[verify-migrations] Failed to start prisma dev engine:', err.message);
+    process.exit(1);
+  }
+}
+
+async function recreateShadowDatabase() {
+  const client = new Client({ connectionString: TEMPLATE_URL });
+  try {
+    await client.connect();
+    await client.query('DROP DATABASE IF EXISTS shadow_db;');
+    await client.query('CREATE DATABASE shadow_db;');
+  } catch (err) {
+    console.error('[verify-migrations] Failed to recreate shadow_db:', err.message);
+    throw err;
+  } finally {
+    await client.end().catch(() => {});
+  }
+}
+
+async function main() {
+  try {
+    await ensurePrismaDevEngine();
+    await recreateShadowDatabase();
+  } catch (err) {
+    console.error('[verify-migrations] Tooling setup error:', err.message);
+    process.exit(1);
+  }
+
+  const env = {
+    ...process.env,
+    SHADOW_DATABASE_URL: SHADOW_URL,
+  };
+
+  return new Promise((resolve) => {
+    const args = [
+      'prisma',
+      'migrate',
+      'diff',
+      '--from-migrations',
+      'prisma/migrations',
+      '--to-schema',
+      'prisma/schema.prisma',
+      '--exit-code',
+    ];
+
+    const child = spawn('npx', args, { env, shell: true });
+    let stdout = '';
+    let stderr = '';
+
+    child.stdout.on('data', (d) => {
+      stdout += d.toString();
+    });
+
+    child.stderr.on('data', (d) => {
+      stderr += d.toString();
+    });
+
+    child.on('close', (code) => {
+      if (code === 0) {
+        console.log('✅ [verify-migrations] Migration chain matches schema.prisma perfectly. No drift detected.');
+        process.exit(0);
+      } else if (code === 2) {
+        console.warn('⚠️  [verify-migrations] Schema drift detected between migrations/ and schema.prisma:');
+        console.warn(stdout || stderr);
+        console.warn('\nTo reconcile, create a migration reflecting the delta or run reconciliation procedures.');
+        process.exit(2);
+      } else {
+        console.error('❌ [verify-migrations] Replay / tooling error encountered (exit code ' + code + '):');
+        console.error(stderr || stdout);
+        process.exit(1);
+      }
+    });
+  });
+}
+
+main().catch((err) => {
+  console.error('[verify-migrations] Unexpected error:', err);
+  process.exit(1);
+});
```
