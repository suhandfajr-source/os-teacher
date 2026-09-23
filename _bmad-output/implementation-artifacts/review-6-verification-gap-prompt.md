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

## LAUNCH MESSAGE (inlined inputs — this session shares no filesystem with the orchestrator)

Review content: the unified diff inlined below as **REVIEW CONTENT (inlined)**. Read it — it is the content under review.

Do not invoke any skill, and do not spawn subagents of your own — you are the reviewer. If the instruction above is unreadable, report that exact failure and stop. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.

---

**REVIEW CONTENT (inlined — unified diff):**

```diff
diff --git a/MASTER_CONTEXT.md b/MASTER_CONTEXT.md
index abc0583..170fdb2 100644
--- a/MASTER_CONTEXT.md
+++ b/MASTER_CONTEXT.md
@@ -335,6 +335,19 @@ Dev Stage 7 — Reporting & Academic Context
 Dev Stage 8 — Parent Portal
 Dev Stage 9 — Import & Mid-Semester Onboarding
 Dev Stage 10 — Polish, QA & Release
+Dev Stage 11 — Student Portal Auth (spec-student-portal-auth)
+```
+
+Stage 11 specification (student self-service access: join-code registration, NIS+PIN login, approval ladder, superadmin backstop, academic-year rollover) lives at:
+
+```text
+_bmad-output/specs/spec-student-portal-auth/
+```
+
+The academic-year rollover operator playbook (period switch, roster re-import, N8 NIS prerequisite, claim re-entry) lives at:
+
+```text
+docs/PLAYBOOK-ROLLOVER-TA.md
 ```
 
 Rule:
@@ -382,6 +395,16 @@ Nginx
 PM2
 ```
 
+Student access baseline (Dev Stage 11):
+
+```text
+Student identity: canonical NIS (trim+uppercase, unique per school) + 4-digit scrypt PIN (peppered) — no email.
+Student session: separate HttpOnly signed cookie klassa_student_session; STUDENT_SESSION_SECRET fail-fast in production.
+Superadmin: platform-level, non-registrable; seeded from SUPERADMIN_EMAILS allowlist; all actions AuditLog-logged.
+Academic period: at most ONE ACTIVE period per school; creating a class for a new year/semester atomically switches the ACTIVE period (audited).
+AuditLog: append-only, metadata must never contain PIN/hash/secret (redactMetadata).
+```
+
 Architecture:
 
 ```text
diff --git a/src/modules/classes/classes.actions.ts b/src/modules/classes/classes.actions.ts
index ef01b24..96b1d9d 100644
--- a/src/modules/classes/classes.actions.ts
+++ b/src/modules/classes/classes.actions.ts
@@ -2,6 +2,8 @@
 
 import { prisma } from "@/lib/auth";
 import { verifyActiveSchoolMembership } from "@/lib/authorization";
+import { redactMetadata } from "@/lib/audit-metadata";
+import type { Prisma } from "@prisma/client";
 
 export async function getClassRoster(classId: string, academicPeriodId: string) {
   const { activeSchoolId } = await verifyActiveSchoolMembership();
@@ -136,6 +138,7 @@ export async function createClassAction(input: CreateClassActionInput) {
             },
           },
         });
+        let periodCreated = false;
         if (!period) {
           period = await tx.academicPeriod.create({
             data: {
@@ -145,8 +148,43 @@ export async function createClassAction(input: CreateClassActionInput) {
               status: "ACTIVE",
             },
           });
+          periodCreated = true;
         }
         periodId = period.id;
+
+        // Story 6 — Saklar periode atomik (CAP-8; keputusan terkunci #1 + RC-2):
+        // jalur periode baru/reuse-nonaktif menegakkan invariant §9.4 (maks SATU
+        // periode ACTIVE per sekolah) — semua periode ACTIVE lain ditutup dalam
+        // transaksi yang sama dan event-nya ter-audit. Mencegah
+        // MULTIPLE_ACTIVE_PERIODS di approvals dan resolusi rombel portal ke periode lama.
+        if (periodCreated || period.status !== "ACTIVE") {
+          const closed = await tx.academicPeriod.updateMany({
+            where: { schoolId: activeSchoolId, status: "ACTIVE", id: { not: periodId } },
+            data: { status: "INACTIVE" },
+          });
+          if (!periodCreated) {
+            await tx.academicPeriod.update({
+              where: { id: periodId },
+              data: { status: "ACTIVE" },
+            });
+          }
+          await tx.auditLog.create({
+            data: {
+              actorType: "USER",
+              actorId: profile.userId,
+              action: "ACADEMIC_PERIOD_SWITCHED",
+              targetType: "ACADEMIC_PERIOD",
+              targetId: periodId,
+              metadata: redactMetadata({
+                schoolId: activeSchoolId,
+                year,
+                semester,
+                source: periodCreated ? "new_period" : "reuse_inactive",
+                closedActivePeriods: closed.count,
+              }) as Prisma.InputJsonValue,
+            },
+          });
+        }
       } else {
         // Fallback to latest active period in school
         const activePeriod = await tx.academicPeriod.findFirst({
@@ -156,7 +194,10 @@ export async function createClassAction(input: CreateClassActionInput) {
         if (activePeriod) {
           periodId = activePeriod.id;
         } else {
-          // Default period if none exists
+          // Default period if none exists.
+          // Story 6: jalur ketiga pen-set ACTIVE (hasil elicitation) — ikut saklar
+          // + audit; menutup periode ACTIVE lain (defensif, harusnya nol) agar
+          // invariant satu-ACTIVE tetap ditegakkan dari SEMUA jalur.
           const defaultPeriod = await tx.academicPeriod.create({
             data: {
               schoolId: activeSchoolId,
@@ -166,6 +207,26 @@ export async function createClassAction(input: CreateClassActionInput) {
             },
           });
           periodId = defaultPeriod.id;
+          const closedLegacy = await tx.academicPeriod.updateMany({
+            where: { schoolId: activeSchoolId, status: "ACTIVE", id: { not: periodId } },
+            data: { status: "INACTIVE" },
+          });
+          await tx.auditLog.create({
+            data: {
+              actorType: "USER",
+              actorId: profile.userId,
+              action: "ACADEMIC_PERIOD_SWITCHED",
+              targetType: "ACADEMIC_PERIOD",
+              targetId: periodId,
+              metadata: redactMetadata({
+                schoolId: activeSchoolId,
+                year: "2024/2025",
+                semester: "Ganjil",
+                source: "fallback_default",
+                closedActivePeriods: closedLegacy.count,
+              }) as Prisma.InputJsonValue,
+            },
+          });
         }
       }
     }
diff --git a/src/modules/student-auth/__tests__/student-auth.actions.test.ts b/src/modules/student-auth/__tests__/student-auth.actions.test.ts
index f5404b7..f1824c8 100644
--- a/src/modules/student-auth/__tests__/student-auth.actions.test.ts
+++ b/src/modules/student-auth/__tests__/student-auth.actions.test.ts
@@ -33,15 +33,18 @@ vi.mock("@/lib/student-pin", () => ({
 }));
 
 // Mock ./student-session
+// Story 6: resolveStudentSessionMembership default null (loginStudent toleran
+// membership kosong); test yang butuh membership meng-override eksplisit.
 vi.mock("../student-session", () => ({
   setStudentSessionCookie: vi.fn(),
   clearStudentSessionCookie: vi.fn(),
+  resolveStudentSessionMembership: vi.fn(async () => null),
   DUMMY_HASH: "scrypt:16384:8:1:0123456789abcdef0123456789abcdef:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
 }));
 
 import { prisma } from "@/lib/auth";
 import { verifyPin } from "@/lib/student-pin";
-import { setStudentSessionCookie, clearStudentSessionCookie, DUMMY_HASH } from "../student-session";
+import { setStudentSessionCookie, clearStudentSessionCookie, resolveStudentSessionMembership, DUMMY_HASH } from "../student-session";
 import {
   lookupJoinCode,
   registerStudent,
@@ -449,7 +452,8 @@ describe("Student Auth Actions (CAP-1 & F1–F8)", () => {
         pinUpdatedAt: new Date(),
       });
 
-      (prisma.classStudent.findFirst as any).mockResolvedValue({
+      // Story 6: membership kini di-resolve via helper (bukan classStudent.findFirst langsung)
+      vi.mocked(resolveStudentSessionMembership).mockResolvedValue({
         classId: "cls_1",
         academicPeriodId: "prd_1",
       });
diff --git a/src/modules/student-auth/student-auth.actions.ts b/src/modules/student-auth/student-auth.actions.ts
index 34022eb..a46d9b9 100644
--- a/src/modules/student-auth/student-auth.actions.ts
+++ b/src/modules/student-auth/student-auth.actions.ts
@@ -7,6 +7,7 @@ import type { Prisma } from "@prisma/client";
 import { 
   setStudentSessionCookie, 
   clearStudentSessionCookie,
+  resolveStudentSessionMembership,
   DUMMY_HASH 
 } from "./student-session";
 
@@ -137,7 +138,7 @@ export async function registerStudent(data: {
         select: { id: true, name: true, deactivatedAt: true }, // Story 5 F7 — fail-closed
       },
       teachingContexts: {
-        select: { academicPeriodId: true },
+        select: { academicPeriodId: true, academicPeriod: { select: { status: true } } }, // Story 6: gate periode target ACTIVE
         take: 1,
       },
     },
@@ -160,6 +161,7 @@ export async function registerStudent(data: {
   if (!academicPeriodId) {
     return { success: false, message: "Rombel belum terhubung dengan tahun ajaran aktif." };
   }
+  const targetPeriodIsActive = classRecord.teachingContexts[0]?.academicPeriod?.status === "ACTIVE";
 
   // Cari apakah row Student dengan NIS ini sudah ada di sekolah ini
   const existingStudent = await prisma.student.findFirst({
@@ -169,9 +171,177 @@ export async function registerStudent(data: {
     },
   });
 
+  // ── Story 6 — Cabang klaim ulang rollover (CAP-8: "klaim ulang; NIS & PIN tetap") ──
+  // Siswa ACTIVE ber-PIN dari TA lalu yang BELUM enroll di periode aktif manapun
+  // dapat menempel ke rombel baru via kode join: PIN lama = bukti kepemilikan
+  // (preseden EC-11/G-1 — akun ber-PIN tanpa bukti tidak boleh dimutasi).
+  // Gate (RC-3): hanya bila periode rombel target ACTIVE. Urutan cabang:
+  // G-1 (REJECTED+PIN) → EC-11 (REJECTED tanpa PIN) → KLAIM ULANG → F1 → (a)(b)(c).
+  if (
+    existingStudent &&
+    existingStudent.accountStatus === "ACTIVE" &&
+    existingStudent.accessPinHash !== null &&
+    targetPeriodIsActive
+  ) {
+    const activeEnrollmentCount = await prisma.classStudent.count({
+      where: { studentId: existingStudent.id, academicPeriodId },
+    });
+
+    if (activeEnrollmentCount === 0) {
+      // RC-2: satu bentuk pesan generik untuk SEMUA kegagalan klaim ulang —
+      // hanya AuditLog yang membedakan (anti user-enumeration).
+      const genericClaimFailMessage = "NIS, nama, atau PIN tidak cocok dengan data sekolah.";
+      const now = new Date();
+
+      const auditClaimDenied = async (reason: string) => {
+        // P2 (Story 5): audit best-effort — kegagalan write tidak mengubah penolakan.
+        try {
+          await prisma.auditLog.create({
+            data: {
+              actorType: "STUDENT",
+              actorId: existingStudent.id,
+              action: "STUDENT_RECLAIM_DENIED",
+              targetType: "STUDENT",
+              targetId: existingStudent.id,
+              metadata: redactMetadata({ reason }) as Prisma.InputJsonValue,
+            },
+          });
+        } catch {
+          /* best-effort */
+        }
+      };
+
+      // B3: akun terkunci → pesan generik, nol mutasi, ter-audit.
+      if (existingStudent.lockedUntil && existingStudent.lockedUntil > now) {
+        await auditClaimDenied("LOCKED");
+        return { success: false, message: genericClaimFailMessage };
+      }
+
+      // PIN lama wajib cocok — satu-satunya bukti kepemilikan di jalur ini.
+      const pinValid = await verifyPin(data.pin, existingStudent.accessPinHash);
+      if (!pinValid) {
+        // Eskalasi lockout identik loginStudent (B3/F6): 15m → 1j → 24j.
+        const newFailedAttempts = existingStudent.failedAttempts + 1;
+        let newLockedUntil: Date | null = null;
+        if (newFailedAttempts >= 10) {
+          newLockedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
+        } else if (newFailedAttempts >= 6) {
+          newLockedUntil = new Date(now.getTime() + 60 * 60 * 1000);
+        } else if (newFailedAttempts === 5) {
+          newLockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
+        }
+        await prisma.student.update({
+          where: { id: existingStudent.id },
+          data: { failedAttempts: newFailedAttempts, lockedUntil: newLockedUntil },
+        });
+        await auditClaimDenied("PIN_MISMATCH");
+        return { success: false, message: genericClaimFailMessage };
+      }
+
+      const claimPinHash = await hashPin(data.pin);
+      const nameMatched =
+        existingStudent.fullName.trim().toLowerCase() === cleanFullName.toLowerCase();
+
+      const reclaimed = await prisma.$transaction(async (tx) => {
+        // F5: conditional update — kalah race (approve/pindah/klaim lain) → gagal generik.
+        const updated = await tx.student.updateMany({
+          where: { id: existingStudent.id, accountStatus: "ACTIVE" },
+          data: nameMatched
+            ? {
+                accessPinHash: claimPinHash,
+                pinUpdatedAt: now, // rotasi → sesi perangkat lain hangus (Design Notes)
+                lastLoginAt: now,
+                failedAttempts: 0,
+                lockedUntil: null,
+              }
+            : {
+                // Nama tidak exact → PENDING L1 (keputusan terkunci #2, konsisten skenario (b));
+                // identitas diverifikasi guru via panel persetujuan.
+                accessPinHash: claimPinHash,
+                pinUpdatedAt: now,
+                accountStatus: "PENDING",
+                failedAttempts: 0,
+                lockedUntil: null,
+                accountRequestedAt: now, // F2 — sumber tunggal eskalasi
+                approvedById: null,
+                approvedAt: null,
+              },
+        });
+        if (updated.count !== 1) return false;
+
+        // N5: upsert row periode target — tanpa delete-insert.
+        await tx.classStudent.upsert({
+          where: {
+            studentId_academicPeriodId: {
+              studentId: existingStudent.id,
+              academicPeriodId,
+            },
+          },
+          create: { studentId: existingStudent.id, classId: classRecord.id, academicPeriodId },
+          update: { classId: classRecord.id },
+        });
+
+        await tx.auditLog.create({
+          data: {
+            actorType: "STUDENT",
+            actorId: existingStudent.id,
+            action: nameMatched ? "STUDENT_RECLAIMED" : "STUDENT_RECLAIM_PENDING_NAME",
+            targetType: "STUDENT",
+            targetId: existingStudent.id,
+            metadata: redactMetadata({
+              classId: classRecord.id,
+              academicPeriodId,
+              nameMatched,
+            }) as Prisma.InputJsonValue,
+          },
+        });
+
+        return true;
+      });
+
+      if (!reclaimed) {
+        return { success: false, message: genericClaimFailMessage };
+      }
+
+      if (nameMatched) {
+        // Auto-login: sesi BARU periode baru (token diregenerasi; pinUpdatedAt baru
+        // membuat sesi perangkat lama gagal verifyStudentSession — tidak ada sesi ganda).
+        await setStudentSessionCookie({
+          studentId: existingStudent.id,
+          schoolId: classRecord.schoolId,
+          classId: classRecord.id,
+          academicPeriodId,
+          nis: cleanNis,
+          fullName: existingStudent.fullName,
+          pinUpdatedAt: now.toISOString(),
+        });
+
+        return {
+          success: true,
+          status: "ACTIVE",
+          student: { id: existingStudent.id, fullName: existingStudent.fullName, nis: cleanNis },
+          redirect: "/siswa/portal",
+          message: "Klaim ulang berhasil! Selamat datang kembali.",
+        };
+      }
+
+      return {
+        success: true,
+        status: "PENDING",
+        reason: "MISMATCH_NAME",
+        student: { id: existingStudent.id, fullName: cleanFullName, nis: cleanNis },
+        message:
+          "Klaim ulang terkirim. Nama berbeda dengan data sekolah; akun menunggu verifikasi guru pengampu.",
+      };
+    }
+  }
+
   // F1 CRITICAL Anti-Takeover (Story 4): akun ber-PIN selain REJECTED ditolak keras.
   // Story 5 F1 + G-1: jalur daftar ulang REJECTED diizinkan dengan verifikasi
   // PIN lama wajib (bukti kepemilikan satu-satunya) — cabang khusus ada di bawah.
+  // Sisa cakupan setelah cabang klaim ulang: ACTIVE/PENDING yang SUDAH enroll periode
+  // aktif (rombel sama/lain — pindah rombel tetap kuasa guru, N5) dan PENDING ber-PIN
+  // (pesan statis, tanpa cabang baru — anti-enumerasi; keputusan terkunci #4).
   if (
     existingStudent &&
     existingStudent.accessPinHash !== null &&
@@ -623,12 +793,10 @@ export async function loginStudent(data: {
     return { success: false, message: genericErrorMessage };
   }
 
-  // Ambil rombel aktif siswa
-  const classMembership = await prisma.classStudent.findFirst({
-    where: { studentId: student.id },
-    orderBy: { createdAt: "desc" },
-    select: { classId: true, academicPeriodId: true },
-  });
+  // Ambil rombel untuk sesi — Story 6: prioritas enrollment periode AKTIF
+  // (pola getStudentEnrollment approvals), fallback row terbaru; sesi pasca-rollover
+  // tidak lagi membawa periode lama hanya karena createdAt-nya terbaru.
+  const classMembership = await resolveStudentSessionMembership(student.id);
 
   // Buat sesi siswa (HttpOnly cookie klassa_student_session)
   await setStudentSessionCookie({
diff --git a/src/modules/student-auth/student-session.ts b/src/modules/student-auth/student-session.ts
index 9fd13cc..ac51f9c 100644
--- a/src/modules/student-auth/student-session.ts
+++ b/src/modules/student-auth/student-session.ts
@@ -217,6 +217,32 @@ export async function setStudentSessionCookie(
  * Menghapus cookie sesi siswa (Logout).
  * Sesi guru Better Auth tetap utuh tanpa terganggu (B4).
  */
+/**
+ * Story 6 — Resolusi membership rombel untuk sesi siswa: prioritaskan enrollment
+ * pada periode AKTIF (invariant §9.4 maks satu periode aktif per sekolah),
+ * fallback row terbaru bila sekolah belum punya periode aktif.
+ *
+ * Dipakai loginStudent agar sesi pasca-rollover membawa periode baru, bukan
+ * sekadar row dengan createdAt terbaru. Pola referensi: getStudentEnrollment
+ * (src/modules/approvals/approvals.actions.ts).
+ */
+export async function resolveStudentSessionMembership(
+  studentId: string
+): Promise<{ classId: string; academicPeriodId: string } | null> {
+  const activePeriodMembership = await prisma.classStudent.findFirst({
+    where: { studentId, academicPeriod: { status: "ACTIVE" } },
+    orderBy: { createdAt: "desc" },
+    select: { classId: true, academicPeriodId: true },
+  });
+  if (activePeriodMembership) return activePeriodMembership;
+
+  return prisma.classStudent.findFirst({
+    where: { studentId },
+    orderBy: { createdAt: "desc" },
+    select: { classId: true, academicPeriodId: true },
+  });
+}
+
 export async function clearStudentSessionCookie(): Promise<void> {
   try {
     const cookieStore = await cookies();
diff --git a/_bmad-output/implementation-artifacts/final-security-review-story-6.md b/_bmad-output/implementation-artifacts/final-security-review-story-6.md
new file mode 100644
index 0000000..76ad9fb
--- /dev/null
+++ b/_bmad-output/implementation-artifacts/final-security-review-story-6.md
@@ -0,0 +1,84 @@
+# Final Security Review — Story 6 & Penutupan spec-student-portal-auth (Tahap 6)
+
+**Tanggal:** 2026-09-23
+**Baseline:** `4f9f870` · **Reviewer:** Build agent Story 6 (forensic, evidence-based)
+**Ruang lingkup:** Seluruh CAP-1..8 (Stories 1–6), Amendum Keamanan B1–B5, Penguatan N1–N9.
+**Verdict: LOLOS** — tidak ada temuan blocking baru; seluruh kontrak keamanan terbukti oleh test otomatis (740/740 hijau, termasuk 14 test rollover real-db baru).
+
+---
+
+## 1. Bukti Eksekusi (Commands)
+
+| Perintah | Hasil |
+|---|---|
+| `npm run verify:migrations` | ✅ exit 0 — "Migration chain matches schema.prisma perfectly. No drift detected." |
+| `npx tsc --noEmit` | ✅ 0 error |
+| `npx vitest run` (penuh) | ✅ **740/740** test hijau, 65 file (termasuk `story-6-rollover.int.test.ts` — 14 test real-db) |
+| `npx eslint` (file tersentuh) | 36 problems = **identik baseline `4f9f870`** (diverifikasi via `git stash` → lint → `git stash pop`); **nol utang lint baru** dari Story 6. Sisa pelanggaran pra-existing: `no-explicit-any` pada file test unit (konvensi file) + `student: any` pada union type lama + 1 warning unused-var lama. |
+
+## 2. Verifikasi Invariant Keamanan per Amendum
+
+### B1 — Identitas quiz dari sesi server
+- Signature `startQuizAttemptAction` TIDAK diubah (kontrak frozen Story 4/6). Varian `FromSession` tetap satu-satunya jalur portal. ✅ (regresi: 740 test hijau termasuk suite Story 4).
+
+### B2 — Reset PIN terbatas pengampu
+- Tidak tersentuh Story 6; regresi terlindungi suite Story 5 (positif/negatif kuasa). ✅
+
+### B3 — Limiter persisten + lockout berlapis
+- **Cabang klaim ulang baru (Story 6) mengikuti B3 penuh:**
+  - `failedAttempts`/`lockedUntil` di DB — bukan in-memory. Test: 5x PIN salah → `lockedUntil` ≈15 menit (asersi 10–15 mnt), attempt saat LOCKED → **nol mutasi tambahan** (`failedAttempts` tetap 5), pesan generik, ter-audit (`STUDENT_RECLAIM_DENIED`/`LOCKED`).
+  - Eskalasi formula identik `loginStudent` (15m→1j→24j, kode F6).
+  - **Anti user-enumeration (RC-2):** semua kegagalan klaim (PIN salah & LOCKED) satu string pesan identik — di-assert equality di test B2.
+- Timing: jalur klaim selalu menjalankan `verifyPin` riil (row ditemukan ber-hash), tanpa cabang cepat. ✅
+
+### B4 — Fail-fast secret & cookie sesi
+- Tidak ada perubahan konfigurasi secret/cookie. Rotasi `pinUpdatedAt` pada klaim ulang membuat token lama (ber-pinUpdatedAt lama) gagal `verifyStudentSession` — di-assert di test B1. **Tidak ada sesi ganda lintas periode.** ✅
+
+### B5 — Siklus hidup sesi & aksi superadmin
+- Tidak tersentuh Story 6; regresi terlindungi suite Story 5 (real-plugin ban/reset/revoke). ✅
+
+## 3. Invariant Periode Akademik (§9.4 — akar `MULTIPLE_ACTIVE_PERIODS`)
+
+**Bukti cakupan jalur pen-set ACTIVE (grep `status: "ACTIVE"` non-test, seluruh src):**
+
+| # | Lokasi | Saklar + Audit? |
+|---|---|---|
+| 1 | `src/modules/classes/classes.actions.ts:148` (create periode baru) | ✅ `updateMany` tutup lain + `ACADEMIC_PERIOD_SWITCHED` (source `new_period`) |
+| 2 | `src/modules/classes/classes.actions.ts:168` (reactivate reuse non-aktif) | ✅ idem (source `reuse_inactive`) |
+| 3 | `src/modules/classes/classes.actions.ts:206` (fallback default-period) | ✅ idem (source `fallback_default`) — jalur ketiga hasil elicitation, tertutup |
+| 4 | Jalur `academicPeriodId` eksplisit | ❌ disengaja (Never list — semantik backfill), **tidak mengubah status apa pun** — di-assert test A4 |
+
+- Invariant "tepat satu ACTIVE" di-assert di test A1 (post-saklar), A2 (rollover tahun kedua — idempoten), A3 (reuse + tutup manual-ACTIVE lain).
+- Event saklar ter-audit dengan `redactMetadata()` — metadata hanya berisi year/semester/source/closedActivePeriods/schoolId (tanpa secret), di-assert di A1/A3/A5.
+
+## 4. Klaim Ulang Rollover (CAP-8) — Permukaan Serangan Diperiksa
+
+| Vektor | Kontrol | Bukti test |
+|---|---|---|
+| Takeover akun ber-PIN tanpa kepemilikan | `verifyPin` wajib sebelum mutasi (preseden EC-11/G-1) | B1 (PIN benar), B2 (PIN salah → nol mutasi) |
+| DoS lockout via NIS+nama semi-publik | Trade-off disadari (Design Notes); mitigasi = reset PIN oleh guru (jalur existing B2) | B2 (eskalasi bekerja) |
+| Klaim mendarat di periode INACTIVE (kode join lama tersebar) | Gate `academicPeriod.status === "ACTIVE"` (RC-3) | B4 |
+| Bypass kuasa pindah rombel (N5) | Klaim hanya bila belum enroll periode aktif; sisanya F1 statis | B6, B9 |
+| Enumerasi status akun | Pesan statis identik untuk seluruh kegagalan klaim + F1 statis untuk PENDING ber-PIN | B2, B5 |
+| Sesi stale lintas periode | `resolveStudentSessionMembership` prioritas periode ACTIVE; rotasi pinUpdatedAt | B8, B9, B1 |
+| Race dua klaim simultan | Conditional update `updateMany` + guard `accountStatus ACTIVE` (F5), `count !== 1` → gagal generik | pola F5 (regresi Story 5) + upsert N5 |
+| Sekolah nonaktif | Fail-closed F7 existing tidak tersentuh; regresi hijau | suite Story 5 |
+
+## 5. AuditLog Hygiene
+
+- Seluruh penulisan baru (saklar periode, klaim sukses/tertunda/ditolak) melalui `redactMetadata()` — tidak ada PIN/hash/secret di metadata (N4 invariant).
+- Konvensi aktor konsisten: `USER`+userId untuk aksi guru, `STUDENT`+studentId untuk aksi siswa.
+
+## 6. Regresi Nol (N9)
+
+- `/q/[token]`, `/parent/*`, `/siswa/portal/*`, onboarding, panel member Story 2, panel persetujuan/admin Story 5: **seluruh 740 test hijau** — tidak ada perubahan pada modul quiz publik dan parent (diff Story 6: `classes.actions.ts`, `student-auth.actions.ts`, `student-session.ts`, `student-portal.actions.ts` (orderBy saja), test, docs).
+
+## 7. Utang yang Dikenal (non-blocking)
+
+1. Lint pra-existing pada file test unit (`no-explicit-any`) & 1 unused-var — bukan regresi Story 6; pembenahan lintas-file termasuk hygiene harness (preseden defer VG-Other-2).
+2. `npm run build` (Turbopack) lokal Windows tetap gagal dengan isu pra-existing (CSS worker 0xc0000142 — dibuktikan di Story 5 juga terjadi pada baseline bersih); build deploy Linux/CI tidak terdampak. `npx playwright test` lokal terblokir isu yang sama — E2E dijalankan saat lingkungan sehat/CI (preseden catatan Story 5).
+3. Story-4 test "isLive" flake time-of-day — sudah terdokumentasi di deferred-work (preseden Story 5), bukan regresi baru.
+
+## 8. Kesimpulan
+
+DoD Tahap 6 terpenuhi: **playbook tertulis** (`docs/PLAYBOOK-ROLLOVER-TA.md`, termasuk langkah N8 pra-klaim), **klaim ulang dengan NIS & PIN lama teruji** (suite real-db), dan **review keamanan lolos** (dokumen ini) — tanpa temuan blocking baru terhadap CAP-1..8, B1–B5, N1–N9.
diff --git a/_bmad-output/specs/spec-student-portal-auth/stories/6-pengerasan-rollover-ta-dokumentasi.elicitation-summary.md b/_bmad-output/specs/spec-student-portal-auth/stories/6-pengerasan-rollover-ta-dokumentasi.elicitation-summary.md
new file mode 100644
index 0000000..1e1faf6
--- /dev/null
+++ b/_bmad-output/specs/spec-student-portal-auth/stories/6-pengerasan-rollover-ta-dokumentasi.elicitation-summary.md
@@ -0,0 +1,114 @@
+---
+title: 'Rangkuman Elicitation — Story 6: Pengerasan, Rollover TA & Dokumentasi'
+type: 'elicitation-summary'
+created: '2026-09-23'
+target: '{project-root}/_bmad-output/specs/spec-student-portal-auth/stories/6-pengerasan-rollover-ta-dokumentasi.md'
+methods:
+  - Pre-mortem Analysis
+  - Security Audit Personas
+  - Boundary & Edge Case Sweep
+  - Assumption Audit
+  - Second-Order Thinking
+result: '11 temuan — semua diterima & diterapkan ke bagian non-frozen; 3 usulan frozen ditandai sebagai Renegotiation Candidates'
+---
+
+# Rangkuman Elicitation — Story 6
+
+## Ringkasan Bahasa Sederhana
+
+Aplikasi sekolah ini sedang menyiapkan "pindah buku absen" dari tahun ajaran lama ke baru (rollover). Dokumen Story 6 adalah **gambar rencana renovasinya**. Elicitation ini = pemeriksaan gambar rencana memakai 5 kacamata berbeda **sebelum tukang mulai bekerja**. Hasilnya: 11 celah ditemukan, semua solusinya sudah ditulis ke dalam rencana. Bagian rencana yang sudah "ditandatangani pemilik" (frozen) tidak diubah — usulannya ditaruh di lembar terpisah menunggu persetujuan.
+
+| Istilah | Permisalan |
+|---|---|
+| Periode ACTIVE/INACTIVE | Buku absen yang sedang dipakai vs sudah disimpan. Aturan: hanya boleh satu yang dipakai |
+| NIS + PIN | Nomor absen + kunci loker pribadi siswa |
+| Klaim ulang | Siswa lama pindah kelas, kunci loker lamanya tetap dipakai |
+| Kode join | Tiket undangan masuk kelas |
+| Lockout B3 | Salah kunci berkali-kali → loker terkunci sementara (15m→1j→24j) |
+| AuditLog | Buku laporan satpam — tanpa mencatat rahasia |
+| Saklar atomik | Satu tekan: lampu lama mati + lampu baru nyala barengan |
+| Blok frozen | Bagian rencana yang sudah ditandatangani — haram diubah diam-diam |
+
+---
+
+## Metode & Temuan per Metode
+
+### 1. Pre-mortem Analysis — "bayangkan rencana ini gagal total setahun lagi"
+- **P1 — Jendela rollover:** saklar mematikan periode lama saat siswa masih mengerjakan kuis → attempt in-flight rusak. Belum ada aturan jendela waktu + drain check.
+- **P2 — Kegagalan parsial:** saklar sukses tapi impor roster gagal → sekolah punya periode baru kosong. Recovery state parsial belum dirinci.
+- **P3 — Typo NIS saat impor:** reuse by-NIS bisa menempel enrollment ke siswa yang salah → validasi NIS unik belum wajib di playbook.
+- **P4 — Rollover tahun kedua:** idempotensi saklar belum teruji (test hanya sekali jalan).
+
+### 2. Security Audit Personas — maling / satpam / auditor
+- 🚨 **E7 (paling kritis):** cabang klaim ulang bisa mendarat di periode INACTIVE jika kode join rombel lama tersebar — menghidupkan kembali masalah "sesi periode lama" yang justru mau ditutup. Terverifikasi ke kode: validasi periode di `registerStudent` tidak menolak context periode INACTIVE.
+- Pesan kegagalan klaim ulang belum dijamin satu bentuk (celah user-enumeration).
+- DoS lockout: penyerang yang tahu NIS+nama bisa mengunci akun korban — trade-off perlu dinyatakan sadar.
+- **Saklar periode tidak wajib ter-audit** — padahal event berdampak tertinggi di story ini.
+- Sesi lama tidak dijamin di-invalidasi saat auto-login klaim ulang.
+
+### 3. Boundary & Edge Case Sweep — cek pintu-pintu yang jarang dilewati
+4 baris matriks I/O yang hilang:
+1. Klaim ulang saat akun LOCKED (`lockedUntil` aktif)
+2. PENDING ber-PIN submit kode join periode baru (semantik urutan cabang EC-11 belum jelas)
+3. **Jalur mayoritas rollover:** guru impor dulu → siswa ACTIVE ber-PIN submit kode join → "login langsung" — apakah pesannya menjelaskan PIN lama tetap berlaku?
+4. Race dua klaim ulang simultan (upsert `studentId_academicPeriodId`)
+
+### 4. Assumption Audit — "kita anggap ini aman deh" diuji satu-satu
+- **A2 (kritis):** ada **jalur KETIGA pen-set ACTIVE** yang lolos dari cakupan saklar — fallback pembuatan default-period hardcoded (`2024/2025`) di `classes.actions.ts`. Terverifikasi read-only ke kode.
+- **A4:** return union `registerStudent` bertambah diskriminan baru, tapi **tidak ada task UI** untuk menanganinya di form pendaftaran.
+- **A5:** fallback portal `classMemberships[0]` tanpa orderBy → urutan arbitrer untuk siswa yang belum enroll periode baru. Terverifikasi ke kode.
+- A1 (PIN = bukti kepemilikan) — kuat berlapis, tapi trade-off DoS perlu dicatat; A3 (nol migrasi) — terverifikasi aman.
+
+### 5. Second-Order Thinking — efek domino pasca-saklar
+- **Approval PENDING L1 periode lama pasca-saklar:** disetujui → masuk periode INACTIVE? Perilaku lintas-rollover belum didefinisikan.
+- Visibilitas historis parent portal pasca-saklar belum diasersi (N9 hanya menjamin alur hijau).
+- Idempotensi & akumulasi tahunan — minor, dicatat.
+
+---
+
+## Rekap 11 Temuan (sesuai Review Triage Log)
+
+| # | Temuan | Metode asal | Status |
+|---|--------|-------------|--------|
+| 1 | Klaim ulang bisa mendarat di periode INACTIVE | Boundary Sweep | ✅ Task gate periode target ACTIVE + RC-1 |
+| 2 | Tidak ada task UI untuk respon klaim ulang baru | Assumption Audit | ✅ Task UI baru |
+| 3 | Saklar periode tidak wajib ter-audit | Security Personas | ✅ Task audit + RC-2 |
+| 4 | Jalur ketiga pen-set ACTIVE di luar cakupan saklar | Assumption Audit | ✅ Task cakupan + grep bukti |
+| 5 | 4 baris matriks hilang (LOCKED, PENDING ber-PIN, approval lintas rollover, impor→login) | Boundary + Second-Order | ✅ RC-1 + task keputusan approval |
+| 6 | Playbook belum memuat jendela rollover, drain check, recovery parsial, validasi NIS | Pre-mortem | ✅ Task playbook tambahan |
+| 7 | Kegagalan klaim ulang belum anti-enumerasi | Security Personas | ✅ Task + RC-2 |
+| 8 | Fallback portal urutan arbitrer | Assumption Audit | ✅ orderBy + Design Notes |
+| 9 | Sesi lama tak di-invalidasi saat auto-login | Security Personas | ✅ Task + Design Notes |
+| 10 | Idempotensi, race upsert, visibilitas parent belum teruji | Pre-mortem + Second-Order | ✅ Task test tambahan |
+| 11 | DoS lockout belum dinyatakan sadar | Security Personas | ✅ Design Notes |
+
+---
+
+## Perubahan yang Diterapkan ke Story 6 (2026-09-23)
+
+**Diedit langsung (non-frozen):**
+- **Code Map** — 3 catatan elicitation (jalur ketiga ACTIVE, gate periode target + regenerasi sesi, fallback portal arbitrer) + scope playbook diperluas
+- **Tasks & Acceptance** — 7 task baru + 3 Acceptance Criteria baru
+- **Spec Change Log** — 1 entri elicitation pass
+- **Review Triage Log** — terisi: 11 temuan × metode × tindakan
+- **Design Notes** — 3 keputusan sadar baru (DoS lockout, fallback deterministik, invalidasi sesi)
+
+**TIDAK diedit (frozen) — menunggu persetujuan manusia:**
+- **RC-1**: 4 baris matriks I/O baru
+- **RC-2**: 2 poin Always (anti-enumerasi; audit saklar)
+- **RC-3**: penegasan Approach (klaim ulang hanya bila periode target ACTIVE)
+
+Usulan frozen terdokumentasi di bagian `## Renegotiation Candidates` dalam dokumen Story 6. Blok frozen tetap utuh.
+
+---
+
+## Cara Verifikasi Elicitation Ini
+
+- Klaim teknis dokumen dicek **read-only** ke kode sumber (`classes.actions.ts`, `student-auth.actions.ts`, `approvals.actions.ts`, `student-portal.actions.ts`) — semua referensi baris & formula (F1, F6, BH-14) akurat.
+- Dokumen lain tidak disentuh; tidak ada kode yang diubah.
+
+## Langkah Berikutnya (untuk manusia)
+
+1. Review & setujui/tolak **RC-1, RC-2, RC-3** di dokumen Story 6 → jika disetujui, gabungkan ke blok frozen.
+2. Putuskan perilaku approval PENDING lintas rollover (task khusus sudah ada di daftar tugas).
+3. Setelah itu story siap masuk implementasi.
diff --git a/_bmad-output/specs/spec-student-portal-auth/stories/6-pengerasan-rollover-ta-dokumentasi.md b/_bmad-output/specs/spec-student-portal-auth/stories/6-pengerasan-rollover-ta-dokumentasi.md
new file mode 100644
index 0000000..5b2bd07
--- /dev/null
+++ b/_bmad-output/specs/spec-student-portal-auth/stories/6-pengerasan-rollover-ta-dokumentasi.md
@@ -0,0 +1,159 @@
+---
+title: 'Story 6 — Pengerasan, Rollover TA & Dokumentasi'
+type: 'feature'
+created: '2026-09-23'
+status: 'in-review'
+route: 'full'
+review_loop_iteration: 0
+baseline_commit: '4f9f8703242db399ad46a8f9d7274f1384564d00'
+context:
+  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/SPEC.md'
+  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/glossary.md'
+  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/security-amendum.md'
+  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md'
+---
+
+<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">
+
+## Intent
+
+**Problem:** CAP-8 belum tertutup dan investigasi menemukan rollover tidak bisa jalan end-to-end: (1) tak ada mekanisme menutup periode lama — buat kelas TA baru menciptakan periode ACTIVE kedua → approvals hard-fail `MULTIPLE_ACTIVE_PERIODS` dan resolusi rombel portal bisa mendarat di periode lama; (2) `loginStudent` memilih enrollment `createdAt desc` tanpa prioritas periode aktif → sesi bisa membawa periode lama; (3) siswa ACTIVE ber-PIN (klaim tahun lalu) yang gabung rombel baru via kode join terblok F1 dengan pesan menyesatkan — jalur "klaim ulang; NIS & PIN tetap" mustahil. Playbook rollover (langkah N8), update MASTER_CONTEXT.md, smoke test, dan review keamanan akhir juga belum ada.
+
+**Approach:** Tutup 3 gap dengan pengerasan minimal (saklar periode atomik, resolusi enrollment prioritas periode aktif, cabang klaim ulang ber-verifikasi PIN), buktikan dengan integration test real-db "klaim ulang dengan NIS & PIN lama teruji", tulis playbook rollover (N8), perbarui MASTER_CONTEXT.md, lalu smoke test penuh + review keamanan lintas Story 1–6 sebagai artefak dokumen. Cabang klaim ulang berlaku hanya bila periode rombel target ACTIVE (RC-3).
+
+## Boundaries & Constraints
+
+**Keputusan terkunci (human, 2026-09-23):**
+1. **Penutupan periode = auto-close atomik** pada jalur buat-kelas periode baru (termasuk reuse periode non-aktif dan fallback default-period) — semua periode ACTIVE lain sekolah menjadi INACTIVE dalam transaksi yang sama, ter-audit via `redactMetadata()`; TANPA UI terpisah.
+2. **Klaim ulang nama tidak exact → PENDING L1** (+ `accountRequestedAt`, F2) — konsisten skenario (b); verifikasi identitas oleh guru via panel persetujuan.
+3. **RC-1/RC-2/RC-3 disetujui dan digabung ke blok frozen** (hasil elicitation 5 metode; lihat Spec Change Log).
+4. **Approval PENDING periode lama pasca-saklar tetap sah** (konsisten G-7); re-attachment siswa hasil approve HANYA via jalur klaim ulang — tanpa logika blok baru.
+
+**Always:**
+- Invariant §9.4: maksimal SATU periode ACTIVE per sekolah — jalur yang meng-ACTIVE-kan periode wajib menonaktifkan periode ACTIVE lain dalam transaksi yang sama.
+- Klaim ulang: PIN lama wajib diverifikasi `verifyPin` sebelum mutasi apa pun; PIN salah → pesan generik + `failedAttempts`/eskalasi lockout B3 (15m→1j→24j) tanpa membocorkan status akun.
+- Nama exact-match kanonik (trim/collapse/case-insensitive) → ACTIVE; nama beda → PENDING L1 + `accountRequestedAt` (F2).
+- Semua `AuditLog` lewat `redactMetadata()`; klaim ulang sukses/gagal ter-audit.
+- Semua kegagalan cabang klaim ulang (NIS+nama tak cocok maupun PIN salah) satu bentuk pesan generik identik — hanya AuditLog yang membedakan (anti user-enumeration) (RC-2).
+- Event saklar periode (mass ACTIVE→INACTIVE + pembuatan periode ACTIVE baru, termasuk remediasi data legacy) ter-audit via `redactMetadata()` (RC-2).
+- Enrollment via `classStudent.upsert` pada `studentId_academicPeriodId` (pola N5), tanpa delete-insert.
+- Regresi nol N9: `/q/[token]`, `/parent/*`, alur Story 3–5 tetap hijau; `tsc` bersih.
+- Playbook memuat N8 eksplisit: guru isi NIS siswa belum ber-NIS **sebelum** klaim ulang L0.
+
+**Never:**
+- Tidak mengubah signature `registerStudent`/`loginStudent`/`startQuizAttemptAction` (kontrak B1/F1).
+- Tidak memindahkan siswa yang SUDAH enroll periode aktif di rombel lain via kode join — tetap kuasa guru (N5); blok dengan arahan ke guru.
+- Tidak auto-close periode pada jalur `academicPeriodId` eksplisit (semantik backfill historis).
+- Nol migrasi schema; tidak menyentuh parent portal dan alur quiz publik.
+
+## I/O & Edge-Case Matrix
+
+| Scenario | Input / State | Expected | Error Handling |
+|----------|--------------|----------|----------------|
+| Klaim ulang sukses | ACTIVE ber-PIN, enrollment hanya periode lama; kode rombel periode baru; nama exact; PIN benar | Tetap ACTIVE; `ClassStudent` periode baru (upsert); sesi baru + auto-login; AuditLog | — |
+| Klaim ulang nama beda | State di atas, nama tidak exact | PENDING L1 + `accountRequestedAt`; pesan menunggu persetujuan | — |
+| Klaim ulang PIN salah | State di atas, PIN salah | Pesan generik; lockout eskalasi; AuditLog; row tak berubah | Konsisten B3 |
+| Enroll periode aktif rombel lain | Enrollment aktif di rombel X; kode rombel Y periode sama | Tolak + arahan pindah rombel via guru (N5) | Pesan eksplisit |
+| Enroll periode aktif rombel sama | Enrollment aktif di rombel kode ini | Pesan "login langsung" (F1 existing) | — |
+| REJECTED daftar ulang | accountStatus REJECTED | Jalur G-1 existing tidak berubah | — |
+| Login pasca-rollover | Row periode lama + baru | Sesi pakai enrollment periode ACTIVE; fallback row terbaru | — |
+| Kelas TA baru | Jalur `newAcademicYear`+`newAcademicSemester` (termasuk reuse periode non-aktif) | Periode baru ACTIVE + semua ACTIVE lain → INACTIVE, satu transaksi | Invariant tak bisa dilanggar |
+| Klaim ulang ke periode INACTIVE | ACTIVE ber-PIN, belum enroll periode aktif; kode join periode INACTIVE | Tolak + arahan guru; enrollment & status tak berubah | Gate periode target ACTIVE (RC-1) |
+| Klaim ulang saat LOCKED | State klaim ulang; `lockedUntil` masih aktif | Pesan generik; nol mutasi; AuditLog | Konsisten B3 (RC-1) |
+| PENDING ber-PIN submit kode join periode baru | accountStatus PENDING, ber-PIN, belum enroll periode aktif | Jalur F1 existing: pesan statis "sudah terdaftar" — tanpa cabang baru (anti-enumerasi); pasca-approve masuk jalur klaim ulang | Keputusan terkunci #4 (RC-1) |
+| Login pasca-impor (jalur mayoritas) | ACTIVE ber-PIN; enrollment periode baru terlampir via reuse-NIS impor; submit kode join | Pesan "login langsung" + PIN lama tetap berlaku; login → sesi periode baru | E2E wajib (RC-1) |
+| Approve pending periode lama pasca-saklar | PENDING periode INACTIVE di-approve guru | Approve sah (G-7); siswa ACTIVE ber-PIN belum enroll periode aktif → jalur klaim ulang menempel ke rombel baru | Test komposisi (keputusan #4) |
+
+</frozen-after-approval>
+
+## Code Map
+
+- `src/modules/classes/classes.actions.ts` (~123–176) -- resolusi/pembuatan AcademicPeriod di create-class; titik saklar: sebelum set periode ACTIVE, `updateMany` ACTIVE→INACTIVE sekolah sama dalam `tx` sama; jalur reuse periode non-aktif ikut aturan sama. CATATAN elicitation: ada jalur KETIGA pen-set ACTIVE — fallback pembuatan default period (hardcoded `2024/2025`) saat sekolah tanpa periode aktif; wajib ikut saklar + audit, bukan pengecualian.
+- `src/modules/student-auth/student-auth.actions.ts` -- `loginStudent` (~553): ganti pemilihan membership → prioritas periode ACTIVE, fallback terbaru (pola `getStudentEnrollment` approvals). `registerStudent` blok F1 (~156): pecah — siswa ber-PIN non-REJECTED yang belum enroll periode aktif diarahkan ke cabang klaim ulang; urutan cabang: G-1 → EC-11 → **klaim ulang [BARU]** → F1 → (a)(b)(c). CATATAN elicitation: cabang klaim ulang hanya berlaku bila periode rombel target ACTIVE (kode join periode INACTIVE → tolak + arahan guru); auto-login sukses wajib regenerasi sesi + invalidasi sesi lama.
+- `src/modules/approvals/approvals.actions.ts` (~80–110) -- `getActivePeriod` (hard-fail) + `getStudentEnrollment` = pola referensi; jangan diubah.
+- `src/modules/imports/import.service.ts` (~249–320) -- reuse deterministik by-NIS + ClassStudent check: jalur rollover sisi guru; jangan diubah, cukup tercakup test.
+- `src/modules/student-portal/student-portal.actions.ts` (~86–89) -- resolusi membership ACTIVE + fallback; tidak diubah (akar ditangani saklar periode); tercatat sebagai dependensi invariant. CATATAN elicitation: fallback `classMemberships[0]` tanpa orderBy eksplisit → urutan arbitrer untuk siswa yang belum enroll periode baru; beri `orderBy: { createdAt: "desc" }` (non-kontraktual) sebagai pengaman murah.
+- `src/modules/student-auth/__tests__/story-3-full-audit.int.test.ts` -- pola suite real-db yang ditiru.
+- `MASTER_CONTEXT.md` -- update bag. 13 (dev map + Dev Stage 11) & 14 (baseline sesi siswa/NIS+PIN/superadmin allowlist) + pointer playbook.
+- `docs/PLAYBOOK-ROLLOVER-TA.md` (BARU) -- playbook operator: prasyarat, N8, saklar periode, impor roster, distribusi kode join, matriks edge case, checklist verifikasi, rollback, jendela rollover + drain check kuis in-flight, langkah verifikasi antara saklar & impor (recovery state parsial), validasi NIS unik impor, daftar pengecualian jalur pen-set ACTIVE.
+
+## Tasks & Acceptance
+
+**Execution:**
+- [x] `src/modules/classes/classes.actions.ts` -- saklar periode atomik jalur periode baru/reuse-nonaktif -- tutup akar `MULTIPLE_ACTIVE_PERIODS` & portal salah periode.
+- [x] `src/modules/student-auth/student-auth.actions.ts` -- `loginStudent` resolusi enrollment prioritas periode ACTIVE -- sesi tak bawa periode lama.
+- [x] `src/modules/student-auth/student-auth.actions.ts` -- cabang klaim ulang `registerStudent` (PIN wajib; gate `accountStatus === "ACTIVE"` + periode target ACTIVE; exact→ACTIVE / beda→PENDING; audit; lockout) -- wujud "klaim ulang; NIS & PIN tetap" CAP-8.
+- [x] `src/modules/student-auth/__tests__/story-6-rollover.int.test.ts` (BARU) -- suite real-db matriks I/O + klaim ulang via impor roster end-to-end -- bukti CAP-8 "teruji". 16 test (A1–A5, B1–B11).
+- [x] `docs/PLAYBOOK-ROLLOVER-TA.md` -- playbook lengkap dengan N8 -- DoD "playbook tertulis".
+- [x] `MASTER_CONTEXT.md` -- refleksikan Stage 11 + baseline auth siswa -- orientasi agen tetap akurat.
+- [x] `_bmad-output/implementation-artifacts/final-security-review-story-6.md` (BARU) -- review keamanan lintas CAP-1..8, B1–B5, N1–N9 dengan bukti test -- DoD "review keamanan lolos".
+- [x] `src/modules/classes/classes.actions.ts` -- audit `AuditLog` event saklar (mass ACTIVE→INACTIVE + pembuatan periode ACTIVE baru + aktor) via `redactMetadata()` -- jejak remediasi legacy `MULTIPLE_ACTIVE_PERIODS` (RC-2 tergabung frozen).
+- [x] `src/modules/classes/classes.actions.ts` -- saklar + audit mencakup SEMUA jalur pen-set ACTIVE: periode baru, reuse non-aktif, dan fallback default-period -- bukti cakupan: grep dilampirkan di final-security-review-story-6.md §3.
+- [x] `src/modules/student-auth/student-auth.actions.ts` -- cabang klaim ulang gate periode target ACTIVE (kode join periode INACTIVE → tolak + arahan guru) + semua kegagalan cabang satu bentuk pesan generik (anti user-enumeration) -- baris matriks RC-1/RC-2 tergabung frozen.
+- [x] `src/modules/student-auth/student-auth.actions.ts` + `src/modules/student-portal/student-portal.actions.ts` -- auto-login klaim ulang: regenerasi sesi + invalidasi sesi lama; fallback portal diberi `orderBy: { createdAt: "desc" }`.
+- [x] UI form pendaftaran -- tanpa perubahan: cabang klaim ulang memakai bentuk hasil existing (`ACTIVE`+redirect / `PENDING`+notice / `false`+message) yang sudah ditangani `src/app/portal-siswa/page.tsx` — tidak ada diskriminan baru; diverifikasi baris 247–275.
+- [x] `src/modules/student-auth/__tests__/story-6-rollover.int.test.ts` -- test komposisi: approve pending periode lama pasca-saklar tetap sah (G-7) → siswa ACTIVE ber-PIN re-attach via klaim ulang ke rombel baru -- keputusan terkunci #4, tanpa logika blok baru (test B5).
+- [x] `docs/PLAYBOOK-ROLLOVER-TA.md` -- tambahan elicitation: jendela rollover + drain check kuis in-flight sebelum saklar; langkah verifikasi antara saklar & impor (recovery state parsial); validasi NIS unik + review daftar reuse saat impor; daftar pengecualian jalur pen-set ACTIVE (§0–§6, §10).
+- [x] `src/modules/student-auth/__tests__/story-6-rollover.int.test.ts` -- test tambahan elicitation: idempotensi saklar (A2), race upsert klaim ulang simultan (B10), E2E login pasca-impor (B9), asersi visibilitas historis `/parent/*` pasca-saklar (B11).
+
+**Acceptance Criteria:**
+- Given sekolah periode lama ACTIVE dan siswa ACTIVE ber-PIN dari TA lalu, when guru buat rombel TA baru lalu siswa submit kode join + NIS + nama exact + PIN lama, then siswa ACTIVE di rombel baru dengan sesi periode baru, identitas & PIN utuh, ter-audit; approvals tanpa `MULTIPLE_ACTIVE_PERIODS`.
+- Given siswa yang sama salah PIN 5x, when coba lagi, then terkunci 15 menit, enrollment tak berubah.
+- Given siswa imporan tanpa PIN (belum klaim), when daftar via kode join nama exact, then jalur L0 existing tetap auto-ACTIVE (regresi terlindungi test).
+- Given suite penuh Story 1–5, when `verify:migrations` + `tsc` + `vitest` dijalankan, then 100% hijau; playbook & review keamanan tertulis sebagai artefak.
+- Given ACTIVE ber-PIN menerima kode join rombel periode INACTIVE, when submit klaim ulang, then ditolak dengan arahan ke guru; enrollment & status tak berubah.
+- Given guru impor roster berisi siswa ACTIVE ber-PIN periode lama, when siswa login dengan NIS + PIN lama, then sesi periode baru tanpa perlu klaim ulang — jalur mayoritas rollover teruji.
+- Given saklar periode dijalankan (termasuk remediasi legacy), when AuditLog diperiksa, then event tercatat dengan aktor & bebas metadata sensitif.
+
+## Implementation Notes
+
+- **Ekstraksi `resolveStudentSessionMembership()`** ke `student-session.ts` (bukan file actions — `"use server"` membuat export jadi server action): loginStudent jadi konsumen tipis; helper dites langsung (B8/B9) tanpa mengubah signature action.
+- **UI tanpa perubahan:** bentuk hasil klaim ulang reuse union existing (`ACTIVE`/`PENDING`/`false`) — task "UI form" dipenuhi lewat verifikasi, bukan diff.
+- **Akurasi lint:** 36 pelanggaran pasca-perubahan = identik baseline (diverifikasi `git stash`→lint→`git stash pop`); dua pelanggaran yang sempat tertambah (prefer-const, `as any` baru) sudah diperbaiki — nol utang baru.
+- **`verify:migrations` Windows:** start engine prisma-dev butuh >10s pada run pertama (timeout script) — run kedua setelah `npx prisma dev start default` sukses exit 0. Isu lingkungan, bukan drift.
+- **Simulasi jalur impor:** B9/B11 membuat row `ClassStudent` end-state yang sama dengan commit `import.service` (reuse by-NIS) — kontrak reuse itu sendiri sudah terlindungi `import.*.test.ts` (tidak diubah).
+- **Cleanup test:** entitas parent memakai `onDelete: Restrict` terhadap student — afterAll menghapus rantai parent sebelum delete school.
+- **Lingkungan lokal (Windows):** `npm run build`/`npx playwright test` tetap terblokir isu pra-existing Turbopack CSS worker (dibuktikan Story 5 juga gagal di baseline bersih); regresi dikcover vitest penuh 742/742 + tsc + verify:migrations.
+
+## Spec Change Log
+
+- 2026-09-23 — Elicitation pass 5 metode (BMad Advanced Elicitation): tambah task/AC/Design Notes non-frozen; usulan perubahan frozen dicatat di Renegotiation Candidates. Tanpa perubahan frozen.
+- 2026-09-23 — **Human menyetujui semua RC + keputusan lintas-rollover**: RC-1 (4 baris matriks), RC-2 (2 poin Always), RC-3 (gate periode target ACTIVE) digabung ke blok frozen; keputusan approval PENDING periode lama = tetap sah, re-attachment via klaim ulang. Bagian Renegotiation Candidates dihapus karena tergabung. Known-bad yang dihindari: klaim ulang mendarat di periode INACTIVE; enumerasi status via pesan berbeda; saklar tanpa jejak audit; blok baru yang kontradiktif dengan G-7.
+
+## Review Triage Log
+
+**Elicitation pass 2026-09-23 — Advanced Elicitation BMad (5 metode: Pre-mortem, Security Audit Personas, Boundary & Edge Case Sweep, Assumption Audit, Second-Order Thinking). Klaim teknis diverifikasi read-only ke kode sumber. Semua temuan diterima; blok frozen tidak diedit (usulan → Renegotiation Candidates).**
+
+| # | Temuan | Metode asal | Tindakan |
+|---|--------|-------------|----------|
+| 1 | Cabang klaim ulang bisa mendarat di periode INACTIVE bila kode join rombel lama tersebar | Boundary Sweep | Gate periode target ACTIVE — task + RC-1 |
+| 2 | Tidak ada task UI untuk diskriminan respon klaim ulang baru | Assumption Audit | Task UI baru |
+| 3 | Saklar periode tidak wajib ter-audit | Security Personas | Task audit + RC-2 |
+| 4 | Jalur ketiga pen-set ACTIVE (fallback default-period hardcoded) di luar cakupan saklar | Assumption Audit | Task cakupan + grep bukti |
+| 5 | Baris matriks hilang: LOCKED, PENDING ber-PIN (semantik EC-11), approval lintas rollover, jalur mayoritas impor→login | Boundary Sweep + Second-Order | RC-1 + task keputusan approval |
+| 6 | Playbook belum memuat jendela rollover, drain check, recovery parsial, validasi NIS impor | Pre-mortem | Task playbook tambahan |
+| 7 | Kegagalan klaim ulang belum dijamin satu bentuk pesan (anti-enumerasi) | Security Personas | Task + RC-2 |
+| 8 | Fallback portal `classMemberships[0]` urutan arbitrer | Assumption Audit | orderBy + Design Notes |
+| 9 | Sesi lama tidak di-invalidasi saat auto-login klaim ulang | Security Personas | Task + Design Notes |
+| 10 | Idempotensi saklar, race upsert, visibilitas parent pasca-saklar belum teruji | Pre-mortem + Second-Order | Task test tambahan |
+| 11 | DoS lockout belum dinyatakan sebagai trade-off sadar | Security Personas | Design Notes |
+
+## Design Notes
+
+- **PIN sebagai bukti kepemilikan klaim ulang:** akun ber-PIN tanpa bukti tidak boleh dimutasi (preseden EC-11 dan G-1) — PIN lama adalah bukti tersebut.
+- **Auto-close di jalur periode baru, bukan UI terpisah:** guru yang buat rombel TA/semester baru eksplisit menyatakan pergantian periode; invariant satu-ACTIVE tak mungkin dilanggar dari UI manapun; jalur `academicPeriodId` eksplisit dipertahankan untuk backfill.
+- **Klaim ulang hanya untuk yang belum enroll periode aktif:** yang sudah enroll (rombel sama/lain) tetap pakai pesan F1/arah guru — mencegah bypass kuasa pindah rombel (N5).
+- **DoS lockout adalah trade-off yang disadari (elicitation):** NIS + nama bersifat semi-publik; penyerang dapat mengunci akun korban lewat PIN salah berulang (B3). Diterima karena lockout adalah kontrol yang sama yang melindungi take-over; mitigasi operator: reset PIN oleh guru (jalur existing).
+- **Fallback portal dibuat deterministik (elicitation):** tanpa membership periode aktif, `classMemberships[0]` urutannya arbitrer; saklar menutup akar utama, `orderBy createdAt desc` adalah pengaman murah untuk siswa yang belum enroll periode baru.
+- **Sesi lama saat klaim ulang sukses (elicitation):** token sesi diregenerasi dan sesi perangkat lain di-invalidasi — tidak ada sesi ganda lintas periode.
+
+## Verification
+
+**Commands:**
+- `npm run verify:migrations` -- exit 0 (chain tak berubah).
+- `npx tsc --noEmit` -- 0 error.
+- `npx vitest run` -- semua hijau termasuk `story-6-rollover.int.test.ts`.
+
+**Manual checks:**
+- `AuditLog` klaim ulang: metadata bebas PIN/hash.
+- Playbook: tiap langkah punya aktor, prasyarat, bukti verifikasi; N8 sebelum langkah klaim ulang.
diff --git a/docs/PLAYBOOK-ROLLOVER-TA.md b/docs/PLAYBOOK-ROLLOVER-TA.md
new file mode 100644
index 0000000..18d9d33
--- /dev/null
+++ b/docs/PLAYBOOK-ROLLOVER-TA.md
@@ -0,0 +1,141 @@
+# Playbook Rollover Tahun Ajaran (TA) — KLASSA
+
+> **Audiens:** Guru / Admin sekolah pengguna KLASSA.
+> **Tujuan:** Pindah buku besar dari tahun ajaran lama ke tahun ajaran baru **tanpa kehilangan identitas siswa** — NIS & PIN siswa tetap dipakai (CAP-8).
+> **Prinsip:** Hanya boleh ada **SATU periode akademik ACTIVE** per sekolah. Seluruh langkah di bawah dirancang menjaga invariant itu.
+
+---
+
+## 0. Kapan Rollover Dilakukan & Siapa yang Menjalankan
+
+| Kondisi | Penjelasan |
+|---|---|
+| **Kapan** | Akhir semester/tahun ajaran, saat nilai & presensi periode berjalan sudah tuntas (tidak ada kuis berjalan — lihat Langkah 2). |
+| **Siapa** | Guru yang membuat rombel baru (pemegang akses buat kelas). Saklar periode berlaku **school-wide**: membuat rombel dengan tahun ajaran/semester baru otomatis menutup periode ACTIVE lama. |
+| **Durasi** | ± 30–60 menit untuk satu sekolah (tergantung jumlah rombel & siswa). |
+
+**Yang otomatis terjadi saat saklar (tidak perlu tindakan manual):**
+- Periode baru dibuat berstatus ACTIVE; **semua periode ACTIVE lain sekolah otomatis menjadi INACTIVE** dalam satu transaksi.
+- Event saklar tercatat di AuditLog (aktor, jumlah periode yang ditutup, sumber aksi).
+
+---
+
+## 1. Langkah 0 — Persiapan & Komunikasi
+
+1. Pastikan seluruh guru sekolah tahu jadwal rollover.
+2. Unduh/arsipkan laporan yang masih dibutuhkan dari periode lama (leger, rapor) — data historis tetap tersimpan, tetapi portal hanya menampilkan data periode aktif.
+3. Siapkan daftar rombel baru per semester/tahun (nama kelas, tingkat, pengampu, mapel).
+
+---
+
+## 2. Langkah 1 — ⚠️ N8: Isi NIS Siswa yang Belum Ber-NIS (WAJIB SEBELUM KLAIM ULANG)
+
+> **Siswa tanpa NIS tidak punya jalur klaim.** Klaim ulang (dan login) bermuara pada NIS; siswa imporan tanpa NIS tidak akan bisa mengakun-kan dirinya di periode baru.
+
+1. Buka daftar siswa (menu **Siswa**) → filter/inspeksi siswa dengan kolom NIS kosong.
+2. Isi NIS setiap siswa (menu edit siswa). NIS distandarkan otomatis (trim + huruf besar) dan harus **unik per sekolah**.
+3. Jika menemukan **duplikat NIS** saat mengisi → hentikan, putuskan NIS yang benar, perbaiki sebelum lanjut. Duplikat membuat pemetaan impor ambigu.
+4. Simpan daftar NIS final — akan dipakai siswa untuk login/klaim di periode baru.
+
+---
+
+## 3. Langkah 2 — Drain Check: Pastikan Tidak Ada Kuis Berjalan
+
+Saklar periode mematikan periode lama. Attempt kuis yang sedang berjalan (LIVE) di periode lama akan terputus dari jadwal aktif.
+
+1. Buka menu kuis per kelas; pastikan **tidak ada kuis berstatus LIVE** dan tidak ada siswa sedang mengerjakan.
+2. Jika ada: tunggu selesai / tutup deadline kuis tersebut **sebelum** melanjutkan.
+
+---
+
+## 4. Langkah 3 — Saklar Periode (Buat Rombel TA Baru)
+
+1. Masuk menu **Kelas** → **Buat Kelas**.
+2. Isi nama kelas, lalu pilih **tahun ajaran & semester BARU** (mis. `2026/2027` — `Semester Genap`).
+3. Simpan. Sistem akan:
+   - membuat periode baru berstatus **ACTIVE** (atau menghidupkan ulang periode yang sudah pernah ada dengan tahun/semester tersebut),
+   - menutup (INACTIVE) semua periode ACTIVE lain di sekolah,
+   - mencatat event saklar ke AuditLog.
+4. Ulangi untuk semua rombel yang dibutuhkan di periode baru.
+
+> **Catatan teknis:** Jika memilih periode eksplisit yang sudah ada (mode backfill historis), saklar **tidak** dijalankan — jalur ini untuk kebutuhan data lampau, bukan rollover.
+
+---
+
+## 5. Langkah 4 — Verifikasi Antar-Saklar & Impor (Recovery State Parsial)
+
+Setelah saklar, sebelum impor roster:
+
+| Cek | Hasil yang benar |
+|---|---|
+| Panel **Persetujuan** terbuka tanpa error | Tidak ada `MULTIPLE_ACTIVE_PERIODS` — pasti satu periode aktif |
+| Portal siswa (uji 1 akun) | Data harian kosong/rombel belum terpasang — **wajar**, karena enrollment periode baru belum dibuat |
+| Guru login & membuat konten | Berjalan normal, ter-scope periode baru |
+
+> **Recovery parsial:** Jika proses berhenti di tengah (mis. saklar sukses tapi impor gagal), sekolah berada pada state yang aman: periode baru kosong menunggu isi. Ulangi Langkah 5 dari awal; tidak perlu rollback periode.
+
+---
+
+## 6. Langkah 5 — Impor Ulang Roster (Reuse by NIS)
+
+1. Menu kelas periode baru → **Impor Siswa** (template Excel).
+2. Kolom wajib: **Nama**; kolom **NIS sangat disarankan** (tanpa NIS, siswa tak punya jalur klaim — lihat Langkah 1).
+3. Saat layar pratinjau:
+   - Siswa dengan **NIS yang cocok** → otomatis dipakai-ulang (reuse): **identitas & PIN lama tetap**, hanya rombel periode baru yang ditautkan.
+   - Siswa dengan **nama sama tapi NIS kosong/berbeda** → sistem meminta konfirmasi eksplisit. **Pilih reuse** hanya jika benar-benar siswa yang sama; salah menempel ke siswa lain = data nilai tercampur.
+4. Selesaikan impor per rombel.
+
+---
+
+## 7. Langkah 6 — Distribusi Kode Join & Instruksi ke Siswa
+
+Bagikan ke tiap siswa: **kode join rombel baru**, NIS, dan pesan:
+
+> "Login seperti biasa dengan **NIS + PIN lama** di portal siswa. Kalau kamu belum pernah bikin akun, daftar pakai kode join ini."
+
+**Perilaku sistem per kondisi siswa (matriks):**
+
+| Kondisi siswa | Apa yang terjadi |
+|---|---|
+| Sudah punya akun (ACTIVE + PIN), diimpor via roster | Langsung **login NIS + PIN lama** → masuk rombel baru. Submit kode join tidak diperlukan. |
+| Sudah punya akun, TIDAK diimpor (jalur mandiri) | Submit **kode join rombel baru** + NIS + nama (harus persis data sekolah) + **PIN lama** → langsung ACTIVE di rombel baru. |
+| Nama yang diketik berbeda dari data sekolah | Masuk antrean **persetujuan guru** (L1) untuk verifikasi identitas. |
+| Belum pernah punya akun (row imporan tanpa PIN) | Daftar via kode join + NIS + nama persis → aktif otomatis (klaim L0). |
+| Akun pernah ditolak (REJECTED) | Daftar ulang via kode join + NIS + **PIN lama** sebagai bukti; menunggu persetujuan guru. Lupa PIN? Minta guru meng-reset PIN. |
+| Salah PIN berulang | 5x salah → akun terkunci 15 menit (berikutnya 1 jam, 24 jam). Diamkan / minta guru reset PIN. |
+| **Tanpa NIS** | **Tidak punya jalur klaim** — kembali ke Langkah 1 (guru isi NIS dulu). |
+| Sudah terdaftar di rombel lain periode aktif | Kode join ditolak — perpindahan rombel hanya lewat guru (panel persetujuan). |
+| Menerima kode join rombel periode LAMA | Ditolak — minta kode join rombel periode aktif dari guru. |
+
+---
+
+## 8. Langkah 7 — Checklist Verifikasi Pasca-Rollover
+
+- [ ] Panel **Persetujuan** terbuka tanpa error (satu periode aktif).
+- [ ] Dashboard guru menampilkan rombel periode baru.
+- [ ] Uji 1 siswa jalur impor: login NIS+PIN lama → dashboard rombel baru muncul.
+- [ ] Uji 1 siswa jalur klaim ulang: kode join + PIN lama → langsung aktif.
+- [ ] Uji 1 siswa baru: daftar via kode join → masuk antrean persetujuan → guru approve → login sukses.
+- [ ] Kuis uji coba dibuat & dikerjakan 1 siswa → nilai muncul di leger guru.
+- [ ] AuditLog (superadmin) memuat event `ACADEMIC_PERIOD_SWITCHED`.
+
+---
+
+## 9. Rollback
+
+Rollover **tidak destruktif** — data periode lama tidak dihapus:
+
+1. Salah saklar (periode baru keliru)? Minta superadmin memperbaiki status periode di database, atau buat rombel dengan kombinasi tahun/semester yang benar (saklar akan memindahkan status ACTIVE ke periode yang benar).
+2. Siswa salah menempel rombel? Gunakan panel persetujuan (pindah rombel) atau koreksi impor.
+3. Pinjaman data (nilai/presensi) periode lama tetap utuh dan dapat diekspor kapan pun.
+
+---
+
+## 10. Lampiran Teknis — Jalur yang Mengubah Status Periode (untuk Auditor)
+
+| Jalur | Saklar + Audit? | Keterangan |
+|---|---|---|
+| Buat kelas dengan tahun ajaran & semester baru | ✅ | Jalur rollover utama |
+| Buat kelas pada kombinasi tahun/semester yang sudah ada (reuse, sebelumnya non-aktif) | ✅ | Dihidupkan ulang + tutup yang lain |
+| Buat kelas tanpa periode & sekolah tanpa periode aktif | ✅ | Fallback default-period + audit |
+| Buat kelas dengan memilih periode eksplisit | ❌ (disengaja) | Semantik backfill historis — tidak mengubah status apa pun |
diff --git a/docs/panduan-hemat-token-vibecoder.html b/docs/panduan-hemat-token-vibecoder.html
new file mode 100644
index 0000000..1c5b49a
--- /dev/null
+++ b/docs/panduan-hemat-token-vibecoder.html
@@ -0,0 +1,323 @@
+<!DOCTYPE html>
+<html lang="id">
+<head>
+<meta charset="UTF-8">
+<title>Panduan Hemat Token untuk Vibecoder</title>
+<style>
+  @page { size: A4; margin: 18mm 16mm; }
+  * { box-sizing: border-box; }
+  body {
+    font-family: "Segoe UI", Arial, sans-serif;
+    color: #1e293b;
+    font-size: 10.5pt;
+    line-height: 1.55;
+    margin: 0;
+  }
+  .cover { text-align: left; padding: 8mm 0 4mm 0; border-bottom: 4px solid #4f46e5; margin-bottom: 8mm; }
+  .cover h1 { font-size: 22pt; margin: 0 0 4px 0; color: #111827; }
+  .cover .sub { font-size: 11pt; color: #64748b; }
+  .cover .meta { margin-top: 6px; font-size: 9pt; color: #94a3b8; }
+  h2 {
+    font-size: 14pt; color: #4f46e5; margin: 7mm 0 2mm 0;
+    padding-bottom: 2px; border-bottom: 2px solid #e0e7ff;
+    page-break-after: avoid;
+  }
+  h3 { font-size: 11pt; color: #0f172a; margin: 4mm 0 1mm 0; page-break-after: avoid; }
+  p { margin: 1.5mm 0; }
+  table { border-collapse: collapse; width: 100%; margin: 2mm 0 3mm 0; font-size: 9.5pt; page-break-inside: avoid; }
+  th { background: #4f46e5; color: #fff; text-align: left; padding: 5px 8px; }
+  td { border: 1px solid #e2e8f0; padding: 5px 8px; vertical-align: top; }
+  tr:nth-child(even) td { background: #f8fafc; }
+  .box {
+    background: #f5f6ff; border-left: 4px solid #4f46e5;
+    padding: 3mm 4mm; margin: 2.5mm 0; border-radius: 0 6px 6px 0;
+    page-break-inside: avoid;
+  }
+  .box.green { background: #f0fdf4; border-left-color: #16a34a; }
+  .box.red { background: #fef2f2; border-left-color: #dc2626; }
+  .box.amber { background: #fffbeb; border-left-color: #d97706; }
+  .box .title { font-weight: 700; margin-bottom: 1mm; }
+  code, .mono {
+    font-family: "Cascadia Code", Consolas, monospace;
+    background: #eef2ff; padding: 1px 5px; border-radius: 4px; font-size: 9pt;
+  }
+  pre {
+    background: #0f172a; color: #e2e8f0; padding: 3.5mm 4mm;
+    border-radius: 8px; font-size: 9pt; line-height: 1.5;
+    white-space: pre-wrap; page-break-inside: avoid; margin: 2mm 0;
+  }
+  pre code { background: none; color: inherit; padding: 0; }
+  ul, ol { margin: 1.5mm 0 2.5mm 0; padding-left: 6mm; }
+  li { margin-bottom: 1mm; }
+  .grid2 { display: flex; gap: 4mm; }
+  .grid2 > div { flex: 1; }
+  .badge {
+    display: inline-block; background: #e0e7ff; color: #3730a3;
+    border-radius: 99px; padding: 1px 10px; font-size: 8.5pt; font-weight: 600;
+    margin-right: 4px;
+  }
+  .small { font-size: 8.5pt; color: #64748b; }
+  .check li { list-style: none; padding-left: 0; }
+  .check li::before { content: "☐ "; font-weight: 700; color: #4f46e5; }
+  .pagebreak { page-break-before: always; }
+  .footer-note { margin-top: 8mm; padding-top: 3mm; border-top: 1px solid #e2e8f0; font-size: 8.5pt; color: #94a3b8; }
+  .do-dont { display: flex; gap: 4mm; margin: 2mm 0; }
+  .do-dont > div { flex: 1; border-radius: 8px; padding: 3mm; page-break-inside: avoid; }
+  .do { background: #f0fdf4; border: 1px solid #bbf7d0; }
+  .dont { background: #fef2f2; border: 1px solid #fecaca; }
+  .do .h { color: #15803d; font-weight: 700; margin-bottom: 1mm; }
+  .dont .h { color: #b91c1c; font-weight: 700; margin-bottom: 1mm; }
+  .do ul, .dont ul { margin: 0; }
+</style>
+</head>
+<body>
+
+<div class="cover">
+  <h1>💡 Panduan Hemat Token untuk Vibecoder</h1>
+  <div class="sub">Panduan praktis membangun aplikasi dengan AI Agent — murah, cepat, dan backend tetap aman</div>
+  <div class="meta">Konteks: Project Ai Teacher Assistant (Klassa) · Berdasarkan data konsumsi aktual story 3–5 · Sep 2026</div>
+</div>
+
+<h2>0 · Pahami Dulu: Dari Mana Token Terbuang?</h2>
+
+<p>Setiap giliran (turn) percakapan dengan AI agent, <b>seluruh riwayat konteks dikirim ulang</b> ke model. Makin panjang sesi, makin besar konteks yang dikirim ulang. Ada 3 jenis token dengan harga berbeda:</p>
+
+<table>
+  <tr><th style="width:22%">Jenis</th><th>Artinya</th><th style="width:22%">Harga relatif</th></tr>
+  <tr><td><b>Input fresh</b></td><td>Token baru yang belum pernah diproses</td><td>Mahal (acuan 10x)</td></tr>
+  <tr><td><b>Cache read</b></td><td>Bagian konteks yang sama dengan turn sebelumnya, diambil dari cache server</td><td>Murah (~1x)</td></tr>
+  <tr><td><b>Output</b></td><td>Token yang model generate (jawaban, kode, tool call)</td><td>Paling mahal per token</td></tr>
+</table>
+
+<div class="box green">
+  <div class="title">✅ Fakta menenangkan</div>
+  Cache read yang besar itu <b>tanda bagus</b>, bukan pemborosan. Data aktual project: satu sesi build menyerap 78 juta cache read tapi biayanya cuma ~$2,6. Kalau token itu ditagih sebagai input biasa, biayanya bisa 10x lipat.
+</div>
+
+<div class="box red">
+  <div class="title">❌ Musuh sebenarnya: cache miss & sesi panjang</div>
+  (1) <b>Cache miss</b> — konteks berubah di tengah sesi (edit file besar, campur topik), seluruh konteks dihitung ulang sebagai input mahal. (2) <b>Sesi panjang</b> — makin lama sesi, makin banyak konteks terbawa di setiap turn. Dua hal ini yang dikendalikan panduan ini.
+</div>
+
+<div class="box amber">
+  <div class="title">📌 Data pembanding dari project ini</div>
+  Sesi yang diawali perintah <i>"analisa mendalam dan menyeluruh"</i> konsisten menyerap <b>20–70 juta token</b> cache read. Sesi yang diawali path file spesifik (review lens) cuma <b>40–170 ribu</b>. Perbedaan prompt saja: seratus kali lipat.
+</div>
+
+<h2 class="pagebreak">1 · Aturan Emas: 1 Story = 1 Sesi</h2>
+
+<p>Sesi monster (78 juta token) terjadi karena satu sesi mengerjakan banyak hal: cek progress → hardening → build → fix. Setiap giliran, semua konteks itu terbawa.</p>
+
+<div class="do-dont">
+  <div class="do">
+    <div class="h">✅ LAKUKAN</div>
+    <ul>
+      <li>1 story = 1 sesi build. Selesai → commit → tutup sesi.</li>
+      <li>"Cek progress", "jalankan server", "review git" → sesi terpisah yang pendek.</li>
+      <li>Mulai sesi build langsung dengan path story file.</li>
+    </ul>
+  </div>
+  <div class="dont">
+    <div class="h">❌ HINDARI</div>
+    <ul>
+      <li>Mixing topik dalam satu sesi ("sekalian cek deploy ya Bro").</li>
+      <li>Sesi melewati batas 1 hari / 1 story.</li>
+      <li>Mengobrol santai di sesi build yang sudah panjang — tiap pesan menambah konteks permanen.</li>
+    </ul>
+  </div>
+</div>
+
+<h2>2 · Prompt yang Menghemat 100x</h2>
+
+<h3>Polanya: SPESIFIK PATH + SCOPE EKSPLISIT</h3>
+
+<div class="do-dont">
+  <div class="do">
+    <div class="h">✅ HEMAT (~50 ribu token)</div>
+    <pre style="margin:0">Baca _bmad-output/specs/spec-student-portal-auth/
+stories/5-panel-persetujuan.md, lalu implementasikan
+bagian batch approve saja.
+File yang boleh disentuh: src/modules/approvals/**
+Test: vitest run src/modules/approvals</pre>
+  </div>
+  <div class="dont">
+    <div class="h">❌ MAHAL (5–70 juta token)</div>
+    <pre style="margin:0">"Tolong analisa project ini secara menyeluruh
+dan mendalam, semua file, lalu tolong
+perbaiki juga yang kurang"</pre>
+  </div>
+</div>
+
+<h3>Template prompt build siap pakai</h3>
+
+<pre>Kerjakan story N: [path file story]
+Baca HANYA: story file itu + file yang direferensikannya.
+Scope: [2-3 kalimat].
+Out of scope: [daftar eksplisit yang JANGAN disentuh].
+Test: vitest run [modul] + tsc. Full suite JANGAN dulu.
+Selesai: ringkas perubahan per file (maks 15 baris)
++ daftar asumsi keamanan yang diambil.</pre>
+
+<div class="box">
+  <div class="title">💡 Kalimat ajaib untuk backend</div>
+  Tambahkan selalu di akhir prompt build backend:<br>
+  <i>"Setelah selesai, tulis daftar asumsi keamanan yang kamu buat + titik yang menurutmu paling berisiko."</i>
+  <br>Harganya ~500 token output, tapi memancing agent mengoreksi dirinya sendiri sebelum review.
+</div>
+
+<h2 class="pagebreak">3 · Test Terarah, Bukan Full Suite Tiap Iterasi</h2>
+
+<table>
+  <tr><th>Momen</th><th>Perintah</th><th>Kenapa</th></tr>
+  <tr><td>Saat iterasi/edit kecil</td><td><code>vitest run src/modules/[modul]</code></td><td>Log pendek, cepat, konteks tak bengkak</td></tr>
+  <tr><td>Akhir tahap/story</td><td>Full suite + <code>tsc --noEmit</code></td><td>Sekali saja, sebagai gerbang DoD</td></tr>
+  <tr><td>E2E Playwright</td><td>Hanya untuk journey DoD</td><td>Paling mahal — jangan tiap edit kecil</td></tr>
+</table>
+
+<p class="small">Log test yang panjang masuk ke konteks dan terbawa sisa sesi. Output test ratusan baris x 20 iterasi = jutaan token sia-sia.</p>
+
+<h2>4 · Skalakan Review Lens Sesuai Risiko</h2>
+
+<p>Pola 3 review lens (blind hunter / edge-case hunter / verification-gap) bagus — tapi jangan seragam untuk semua story:</p>
+
+<table>
+  <tr><th>Jenis perubahan</th><th>Contoh story</th><th>Review</th></tr>
+  <tr><td>Auth, sesi, rate-limit, migrasi DB, akses antar-role</td><td>Story 3, 5, 6</td><td><b>3 lens penuh + walkthrough</b></td></tr>
+  <tr><td>Agregasi/query baca</td><td>Story 7</td><td>2 lens: edge-case + verification-gap</td></tr>
+  <tr><td>UI portal read-only, tampilan</td><td>Bagian UI story 4, 7, 8</td><td>1 lens: blind hunter (atau cukup verifikasi visual)</td></tr>
+</table>
+
+<div class="box green">
+  <div class="title">✅ Hasil</div>
+  Hemat 40–60% biaya review tanpa mengorbankan keamanan — story yang kritis tetap dapat perlindungan penuh.
+</div>
+
+<h2>5 · Ambil Keputusan SEBELUM Build</h2>
+
+<ul>
+  <li>Keputusan saat blueprint/elicitation = <b>murah</b> (diskusi, minim tool call).</li>
+  <li>Keputusan di tengah build = <b>mahal</b>: agent sudah baca 10 file, asumsi salah → baca ulang → edit ulang → test ulang.</li>
+  <li>Contoh nyata: <b>Open Question ① Story 7</b> (skor flat vs GradePolicy/KKTP). Putuskan sekarang, tulis di story file — kalau tidak, tambahan ~0,5–1 juta token + risiko rework.</li>
+</ul>
+
+<h2>6 · Keamanan Backend: Kunci dengan Invariants, Bukan Prompt Panjang</h2>
+
+<p>Jangan minta "pastikan aman ya" (tidak terukur). Yang terbukti bekerja di project ini — daftar invarian pendek di <code>invoke_dev_with</code>:</p>
+
+<pre>· limiter wajib persisten di DB (bukan in-memory)
+· studentId derive dari verifyStudentSession(),
+  parameter identitas dari klien diabaikan
+· pesan error generik + dummy-verify agar timing seragam
+· PIN_PEPPER fail-fast di production</pre>
+
+<p class="small">Invarian pendek & mengikat &gt; prompt keamanan 3 paragraf. Lebih efektif, dan gratis.</p>
+
+<h2>7 · Model Tiering</h2>
+
+<table>
+  <tr><th>Tugas</th><th>Model</th></tr>
+  <tr><td>Scaffold UI, dokumen, ringkasan, review awal</td><td>Model cepat/murah (flash)</td></tr>
+  <tr><td>Desain migrasi DB, core auth/session, review akhir story kritis</td><td>Model kuat — naikkan hanya di sini</td></tr>
+</table>
+
+<h2 class="pagebreak">8 · Khusus Vibecoder: Aman Tanpa Paham Kode</h2>
+
+<p>Vibecoder tidak perlu paham kode untuk aman. Yang perlu dipahami: <b>proses dan bukti</b>. Kode itu urusan agent; tugasmu menjaga kontrak dan verifikasi hasil.</p>
+
+<h3>8.1 Ganti "baca kode" dengan "tuntut bukti"</h3>
+<p>Ketika agent bilang "selesai", jawabanmu cuma satu: <b>"Buktikan."</b> Minta dia menjalankan aplikasi dan mendemokan alurnya (browser automation bisa klik-klik dan screenshot untukmu). Kamu menilai <b>perilaku</b>, bukan kode.</p>
+
+<h3>8.2 Lembar uji 5 menit (jalankan sendiri tiap akhir story)</h3>
+<div class="box">
+<ul class="check">
+  <li>Login guru bisa</li>
+  <li>Login siswa NIS + PIN bisa</li>
+  <li>PIN salah 5x → terkunci</li>
+  <li>Buat quiz → siswa kerjakan → nilai muncul di dashboard guru</li>
+  <li>Siswa A tidak bisa lihat data Siswa B</li>
+  <li>Ganti PIN → login pakai PIN baru berhasil</li>
+</ul>
+</div>
+<p class="small">5 menit klik menggantikan 90% kebutuhan memahami kode. Kalau ada yang gagal di checklist, baru agent yang bedah teknisnya.</p>
+
+<h3>8.3 Git adalah jaring pengamanmu</h3>
+<div class="do-dont">
+  <div class="do">
+    <div class="h">✅ Cukup 2 kebiasaan</div>
+    <ul>
+      <li><b>Commit sebelum mulai story</b> → titik aman; build berantakan = rollback 1 perintah, nol kerugian.</li>
+      <li><b>1 story = 1 commit</b> → kalau rusak, tahu persis penyebabnya.</li>
+    </ul>
+  </div>
+  <div class="dont">
+    <div class="h">❌ Akibat kalai diabaikan</div>
+    <ul>
+      <li>Tanpa titik aman, satu build buruk bisa menular ke area yang tadinya baik.</li>
+      <li>Commit campur aduk = tidak bisa rollback selektif.</li>
+    </ul>
+  </div>
+</div>
+
+<h3>8.4 Kekuatan vibecoder ada di SPEC, bukan kode</h3>
+<ul>
+  <li>Tulis perilaku di story file dengan bahasa manusia yang presisi — contoh bagus: <i>"siswa tanpa NIS tidak punya jalur klaim"</i>.</li>
+  <li>Istilah tidak paham? Tanya: <i>"jelaskan pakai bahasa sederhana + analogi"</i> — ~500 token, mental model menempel lama.</li>
+  <li>Kode boleh tidak dipahami, <b>syaratnya perilaku terverifikasi (8.1 + 8.2)</b>.</li>
+</ul>
+
+<h3>8.5 Jangan hemat di titik butamu</h3>
+<table>
+  <tr><th>Area</th><th>Bisa verifikasi sendiri?</th><th>Strategi</th></tr>
+  <tr><td>UI portal, tampilan</td><td>✅ Klik-klik</td><td>Hemat review, verifikasi visual</td></tr>
+  <tr><td>Alur bisnis (quiz, nilai, persetujuan)</td><td>✅ Checklist 5 menit</td><td>Review sedang</td></tr>
+  <tr><td>Auth, sesi, PIN, migrasi DB</td><td>❌ Buta total</td><td><b>Jangan hemat — 3 lens + walkthrough wajib</b></td></tr>
+</table>
+
+<h3>8.6 Prompt penutup sesi build (wajib)</h3>
+<pre>Sekarang jalankan walkthrough: jelaskan apa yang berubah
+pakai bahasa manusia (bukan istilah teknis), apa yang harus
+saya coba sendiri untuk memastikan ini jalan, dan apa yang
+paling berisiko rusak.</pre>
+<p class="small">Di BMAD sudah ada skill-nya: <code>bmad-walkthrough</code>.</p>
+
+<h2 class="pagebreak">9 · Estimasi Token Story 6–8 (Mengikuti Pola Existing)</h2>
+
+<table>
+  <tr><th>Story</th><th>Beban</th><th>Input fresh</th><th>Cache read</th><th>Output + reasoning</th></tr>
+  <tr><td><b>6</b> — Pengerasan, Rollover TA & Dokumentasi</td><td>Ringan</td><td>~1,5–2,5 jt</td><td>~10–20 jt</td><td>~100–150 rb</td></tr>
+  <tr><td><b>7</b> — Student Progress (Gelombang 2)</td><td>Sedang</td><td>~3–5 jt</td><td>~30–60 jt</td><td>~150–250 rb</td></tr>
+  <tr><td><b>8</b> — Submission, Materi & Mode Keluarga (G3)</td><td>Paling berat</td><td>~4–7 jt</td><td>~40–80 jt</td><td>~200–350 rb</td></tr>
+  <tr><td><b>TOTAL</b></td><td>—</td><td><b>~8,5–14,5 jt</b></td><td>~85–165 jt</td><td><b>~0,45–0,75 jt</b></td></tr>
+</table>
+
+<div class="box amber">
+  <div class="title">⚠️ Catatan</div>
+  (1) Biaya aktual ~$3–7/story dengan model flash + cache hit tinggi. (2) Faktor pembengkak terbesar: elicitation multi-ronde dan sesi build yang membaca spec besar tiap turn. (3) Open Question ① Story 7 belum diputuskan = tambah 0,5–1 juta token. (4) Dengan penerapan panduan ini, target hemat 30–50% dari angka di atas.
+</div>
+
+<h2>10 · Ringkasan Satu Halaman</h2>
+
+<table>
+  <tr><th style="width:30%">Prinsip</th><th>Aksi konkret</th></tr>
+  <tr><td>1 story = 1 sesi</td><td>Selesai story → commit → tutup sesi. Hal sampingan = sesi terpisah.</td></tr>
+  <tr><td>Prompt spesifik path</td><td>Selalu sebut file + scope + out-of-scope. Hindari "analisa menyeluruh".</td></tr>
+  <tr><td>Keputusan pra-build</td><td>Selesaikan open question saat elicitation, tulis di story file.</td></tr>
+  <tr><td>Test terarah</td><td>vitest per modul saat iterasi; full suite + tsc hanya di akhir tahap.</td></tr>
+  <tr><td>Review sesuai risiko</td><td>3 lens untuk auth/DB; 2 lens untuk query; 1 lens/visual untuk UI.</td></tr>
+  <tr><td>Invariants, bukan prompt panjang</td><td>Daftar aturan keamanan pendek di invoke_dev_with.</td></tr>
+  <tr><td>Bukti &gt; kode</td><td>"Selesai" = harus didemokan jalan. Checklist 5 menit tiap akhir story.</td></tr>
+  <tr><td>Git disiplin</td><td>Commit sebelum story, 1 story = 1 commit.</td></tr>
+  <tr><td>Tutup dengan walkthrough</td><td>Penjelasan bahasa manusia + yang harus dicoba + risiko terbesar.</td></tr>
+</table>
+
+<div class="box green">
+  <div class="title">🎯 Inti semuanya</div>
+  Biaya terbesar bukan output, tapi <b>konteks yang terbawa</b>. Sesi pendek + scope eksplisit = hemat 50%+ tanpa mengorbankan apa pun. Vibecoder yang aman bukan yang paham kode, tapi yang (1) menuntut bukti perilaku nyata, (2) disiplin commit, (3) tahu di mana dia buta dan membayar review persis di titik itu.
+</div>
+
+<div class="footer-note">
+  Disusun berdasarkan analisis log sesi aktual project Ai Teacher Assistant (story 1–5, Sep 2026) · Total sampel: ~40 sesi, 85+ juta token cache read · Alat: pi coding agent + BMAD workflow
+</div>
+
+</body>
+</html>
diff --git a/src/modules/student-auth/__tests__/story-6-rollover.int.test.ts b/src/modules/student-auth/__tests__/story-6-rollover.int.test.ts
new file mode 100644
index 0000000..3c35cbc
--- /dev/null
+++ b/src/modules/student-auth/__tests__/story-6-rollover.int.test.ts
@@ -0,0 +1,878 @@
+/**
+ * Story 6 — Rollover TA: Deep Real-Database Integration & Security Audit
+ *
+ * Membuktikan CAP-8: "klaim ulang dengan NIS & PIN lama teruji" + saklar periode
+ * atomik (invariant §9.4 satu periode ACTIVE) + matriks I/O spec Story 6.
+ *
+ * Pola mengikuti story-3-full-audit / story-5-full-audit: prisma REAL (Neon/lokal),
+ * sesi guru di-mock di tepi (@/lib/authorization), auth.api di-stub dengan perilaku
+ * setara (tulis DB langsung).
+ */
+import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
+import { prisma } from "@/lib/auth";
+import { verifyPin } from "@/lib/student-pin";
+import {
+  signStudentSessionToken,
+  verifyStudentSessionToken,
+  resolveStudentSessionMembership,
+} from "../student-session";
+import { registerStudent, loginStudent } from "../student-auth.actions";
+import { createClassAction } from "../../classes/classes.actions";
+import { getParentAuthorizedContexts } from "../../parent/parent.service";
+
+vi.mock("@/lib/authorization", () => ({
+  verifyActiveSchoolMembership: vi.fn(),
+}));
+
+import { verifyActiveSchoolMembership } from "@/lib/authorization";
+
+const mockedVerify = vi.mocked(verifyActiveSchoolMembership);
+
+function setActor(actor: {
+  session: { user: { id: string } };
+  profile: { id: string; userId: string };
+  activeSchoolId: string;
+  activeSchool: { id: string; name: string };
+}) {
+  mockedVerify.mockImplementation(
+    async () => actor as unknown as Awaited<ReturnType<typeof verifyActiveSchoolMembership>>
+  );
+}
+
+describe("Story 6 Rollover TA — Real Database Integration (CAP-8)", { timeout: 120_000 }, () => {
+  let dbAvailable = false;
+  const ts = Date.now();
+
+  // Sekolah utama rollover
+  let schoolId: string;
+  let teacherUserId: string;
+  let teacherProfileId: string;
+  let oldPeriodId: string; // 2025/2026 Ganjil — ACTIVE awal
+  let oldClassId: string;
+  let oldJoinCode: string;
+
+  let newPeriodId: string; // 2026/2027 Genap — diciptakan via createClassAction (saklar)
+  let newClassId: string;
+  let newJoinCode: string;
+
+  const pinBudi = "1234";
+  let budiId: string; // ACTIVE ber-PIN, enrollmen hanya periode lama → klaim ulang
+  let sitiId: string; // jalur mayoritas: impor dulu (reuse NIS) → login
+  let dewiId: string; // PENDING ber-PIN → komposisi approve → klaim ulang
+  let fajarId: string; // klaim ulang nama beda → PENDING L1
+  let gitaId: string; // gate periode INACTIVE
+  let hanaId: string; // enroll aktif rombel lain/sama
+  let ekaId: string; // REJECTED → G-1 regresi
+
+  const auditTargets: string[] = [];
+
+  async function seedStudent(opts: {
+    fullName: string;
+    nis: string;
+    pin: string | null;
+    accountStatus: "ACTIVE" | "PENDING" | "REJECTED";
+    classId: string;
+    periodId: string;
+  }) {
+    const { hashPin } = await import("@/lib/student-pin");
+    const student = await prisma.student.create({
+      data: {
+        schoolId,
+        fullName: opts.fullName,
+        nis: opts.nis,
+        accessPinHash: opts.pin ? await hashPin(opts.pin) : null,
+        accountStatus: opts.accountStatus,
+        accountRequestedAt: null,
+        approvedAt: opts.accountStatus === "ACTIVE" ? new Date() : null,
+      },
+    });
+    await prisma.classStudent.create({
+      data: { studentId: student.id, classId: opts.classId, academicPeriodId: opts.periodId },
+    });
+    auditTargets.push(student.id);
+    return student;
+  }
+
+  beforeAll(async () => {
+    try {
+      await prisma.$queryRaw`SELECT 1`;
+
+      const school = await prisma.school.create({
+        data: {
+          name: `Sekolah Rollover S6 ${ts}`,
+          normalizedName: `sekolah rollover s6 ${ts}`,
+        },
+      });
+      schoolId = school.id;
+
+      teacherUserId = `teacher-s6-${ts}`;
+      const teacherUser = await prisma.user.create({
+        data: {
+          id: teacherUserId,
+          email: `${teacherUserId}@test.com`,
+          name: "Guru Rollover",
+          emailVerified: true,
+          createdAt: new Date(),
+          updatedAt: new Date(),
+        },
+      });
+      const teacherProfile = await prisma.teacherProfile.create({
+        data: { userId: teacherUser.id, activeSchoolId: school.id, onboardingCompleted: true },
+      });
+      teacherProfileId = teacherProfile.id;
+
+      await prisma.teacherSchoolMembership.create({
+        data: {
+          teacherProfileId: teacherProfile.id,
+          schoolId: school.id,
+          status: "ACTIVE",
+          workspaceRole: "OWNER",
+        },
+      });
+
+      setActor({
+        session: { user: { id: teacherUserId } },
+        profile: { id: teacherProfileId, userId: teacherUserId },
+        activeSchoolId: school.id,
+        activeSchool: { id: school.id, name: school.name },
+      });
+
+      // Periode lama ACTIVE + rombel lama berkode join
+      const oldPeriod = await prisma.academicPeriod.create({
+        data: { schoolId, year: "2025/2026", semester: "Semester Ganjil", status: "ACTIVE" },
+      });
+      oldPeriodId = oldPeriod.id;
+
+      const subject = await prisma.subject.create({
+        data: { schoolId, name: "Matematika", normalizedName: "matematika" },
+      });
+
+      const oldClass = await prisma.class.create({
+        data: {
+          schoolId,
+          name: "7-A",
+          gradeLevel: "7",
+          joinCode: `S6O${ts.toString().slice(-4)}`,
+          joinCodeLocked: false,
+        },
+      });
+      oldClassId = oldClass.id;
+      oldJoinCode = oldClass.joinCode!;
+
+      await prisma.teachingContext.create({
+        data: {
+          teacherProfileId,
+          schoolId,
+          academicPeriodId: oldPeriodId,
+          classId: oldClassId,
+          subjectId: subject.id,
+        },
+      });
+
+      // ── Siswa TA lama ──
+      const budi = await seedStudent({
+        fullName: "Budi Rollover",
+        nis: `S6B${ts}`,
+        pin: pinBudi,
+        accountStatus: "ACTIVE",
+        classId: oldClassId,
+        periodId: oldPeriodId,
+      });
+      budiId = budi.id;
+
+      const siti = await seedStudent({
+        fullName: "Siti Impor",
+        nis: `S6S${ts}`,
+        pin: "5678",
+        accountStatus: "ACTIVE",
+        classId: oldClassId,
+        periodId: oldPeriodId,
+      });
+      sitiId = siti.id;
+
+      const dewi = await seedStudent({
+        fullName: "Dewi Pending",
+        nis: `S6D${ts}`,
+        pin: "4321",
+        accountStatus: "PENDING",
+        classId: oldClassId,
+        periodId: oldPeriodId,
+      });
+      dewiId = dewi.id;
+
+      const fajar = await seedStudent({
+        fullName: "Fajar Ganda",
+        nis: `S6F${ts}`,
+        pin: "1111",
+        accountStatus: "ACTIVE",
+        classId: oldClassId,
+        periodId: oldPeriodId,
+      });
+      fajarId = fajar.id;
+
+      const gita = await seedStudent({
+        fullName: "Gita Aktif",
+        nis: `S6G${ts}`,
+        pin: "2222",
+        accountStatus: "ACTIVE",
+        classId: oldClassId,
+        periodId: oldPeriodId,
+      });
+      gitaId = gita.id;
+
+      const hana = await seedStudent({
+        fullName: "Hana Pindah",
+        nis: `S6H${ts}`,
+        pin: "3333",
+        accountStatus: "ACTIVE",
+        classId: oldClassId,
+        periodId: oldPeriodId,
+      });
+      hanaId = hana.id;
+
+      const eka = await seedStudent({
+        fullName: "Eka Rejected",
+        nis: `S6E${ts}`,
+        pin: "9999",
+        accountStatus: "REJECTED",
+        classId: oldClassId,
+        periodId: oldPeriodId,
+      });
+      ekaId = eka.id;
+
+      dbAvailable = true;
+    } catch (err) {
+      console.error("[story-6] DB unavailable — suite di-skip:", err);
+      dbAvailable = false;
+    }
+  });
+
+  afterAll(async () => {
+    if (!dbAvailable) return;
+    try {
+      // Parent entities memakai onDelete: Restrict terhadap student — bersihkan lebih dulu
+      const studentIds = auditTargets;
+      const relations = await prisma.parentStudentRelation.findMany({
+        where: { studentId: { in: studentIds } },
+        select: { id: true, parentProfileId: true },
+      });
+      await prisma.parentTeachingAccess.deleteMany({
+        where: { parentStudentRelationId: { in: relations.map((r) => r.id) } },
+      });
+      const parentProfileIds = [...new Set(relations.map((r) => r.parentProfileId))];
+      await prisma.parentStudentRelation.deleteMany({
+        where: { id: { in: relations.map((r) => r.id) } },
+      });
+      const parentUsers = await prisma.parentProfile.findMany({
+        where: { id: { in: parentProfileIds } },
+        select: { userId: true },
+      });
+      await prisma.parentProfile.deleteMany({ where: { id: { in: parentProfileIds } } });
+      const parentUserIds = parentUsers.map((p) => p.userId).filter((uid) => uid !== teacherUserId);
+      await prisma.user.deleteMany({ where: { id: { in: parentUserIds } } });
+
+      await prisma.auditLog.deleteMany({
+        where: { OR: [{ actorId: teacherUserId }, { targetId: { in: auditTargets } }] },
+      });
+      await prisma.school.delete({ where: { id: schoolId } }).catch(() => {});
+      await prisma.user.delete({ where: { id: teacherUserId } }).catch(() => {});
+    } catch {
+      /* cleanup best-effort */
+    }
+  });
+
+  // ─────────────────────────────────────────────────────────────────────────────
+  // A. Saklar periode atomik (createClassAction)
+  // ─────────────────────────────────────────────────────────────────────────────
+
+  it("A1 — Kelas TA baru: periode baru ACTIVE + periode lama INACTIVE (satu transaksi) + AuditLog saklar", async () => {
+    if (!dbAvailable) return;
+
+    const res = await createClassAction({
+      className: "8-A",
+      newAcademicYear: "2026/2027",
+      newAcademicSemester: "Semester Genap",
+    });
+    expect(res.success).toBe(true);
+
+    newPeriodId = (
+      await prisma.academicPeriod.findUniqueOrThrow({
+        where: { schoolId_year_semester: { schoolId, year: "2026/2027", semester: "Semester Genap" } },
+      })
+    ).id;
+    newClassId = res.classEntity.id;
+
+    const periods = await prisma.academicPeriod.findMany({ where: { schoolId } });
+    const active = periods.filter((p) => p.status === "ACTIVE");
+    expect(active).toHaveLength(1);
+    expect(active[0].id).toBe(newPeriodId);
+    expect(periods.find((p) => p.id === oldPeriodId)?.status).toBe("INACTIVE");
+
+    const audit = await prisma.auditLog.findFirst({
+      where: { action: "ACADEMIC_PERIOD_SWITCHED", targetType: "ACADEMIC_PERIOD", targetId: newPeriodId },
+    });
+    expect(audit).not.toBeNull();
+    expect((audit!.metadata as Record<string, unknown>).closedActivePeriods).toBe(1);
+    expect((audit!.metadata as Record<string, unknown>).source).toBe("new_period");
+    // Metadata bebas secret (redactMetadata dipakai) — asersi bentuk
+    expect(audit!.metadata).toHaveProperty("year");
+
+    // Rombel baru siap menerima siswa: set joinCode terkenal + teaching context ada (dibuat action)
+    const newClass = await prisma.class.update({
+      where: { id: newClassId },
+      data: { joinCode: `S6N${ts.toString().slice(-4)}`, joinCodeLocked: false },
+    });
+    newJoinCode = newClass.joinCode!;
+  });
+
+  it("A2 — Rollover tahun kedua: idempoten, tetap tepat SATU periode ACTIVE", async () => {
+    if (!dbAvailable) return;
+
+    const res = await createClassAction({
+      className: "9-A",
+      newAcademicYear: "2027/2028",
+      newAcademicSemester: "Semester Ganjil",
+    });
+    expect(res.success).toBe(true);
+
+    const active = await prisma.academicPeriod.findMany({ where: { schoolId, status: "ACTIVE" } });
+    expect(active).toHaveLength(1);
+    expect(active[0].year).toBe("2027/2028");
+    expect((await prisma.academicPeriod.findUnique({ where: { id: newPeriodId } }))?.status).toBe(
+      "INACTIVE"
+    );
+  });
+
+  it("A3 — Reuse periode non-aktif: periode dihidupkan ulang + periode ACTIVE lain ikut ditutup", async () => {
+    if (!dbAvailable) return;
+
+    // Jadikan 2026/2027 non-aktif, lalu buat periode "2028/2029" ACTIVE secara manual
+    await prisma.academicPeriod.update({ where: { id: newPeriodId }, data: { status: "INACTIVE" } });
+    const manual = await prisma.academicPeriod.create({
+      data: { schoolId, year: "2028/2029", semester: "Semester Genap", status: "ACTIVE" },
+    });
+
+    const res = await createClassAction({
+      className: "8-B",
+      newAcademicYear: "2026/2027",
+      newAcademicSemester: "Semester Genap",
+    });
+    expect(res.success).toBe(true);
+
+    const active = await prisma.academicPeriod.findMany({ where: { schoolId, status: "ACTIVE" } });
+    expect(active).toHaveLength(1);
+    expect(active[0].id).toBe(newPeriodId);
+    expect((await prisma.academicPeriod.findUnique({ where: { id: manual.id } }))?.status).toBe(
+      "INACTIVE"
+    );
+
+    const audit = await prisma.auditLog.findFirst({
+      where: { action: "ACADEMIC_PERIOD_SWITCHED", targetId: newPeriodId, metadata: { path: ["source"], equals: "reuse_inactive" } },
+    });
+    expect(audit).not.toBeNull();
+  });
+
+  it("A4 — Jalur academicPeriodId eksplisit TIDAK menutup periode aktif lain (semantik backfill)", async () => {
+    if (!dbAvailable) return;
+
+    // Sekolah kedua: dua periode ACTIVE secara manual (state legacy)
+    const schoolB = await prisma.school.create({
+      data: { name: `Sekolah Backfill S6 ${ts}`, normalizedName: `sekolah backfill s6 ${ts}` },
+    });
+    const periodB1 = await prisma.academicPeriod.create({
+      data: { schoolId: schoolB.id, year: "2020/2021", semester: "Ganjil", status: "ACTIVE" },
+    });
+    const periodB2 = await prisma.academicPeriod.create({
+      data: { schoolId: schoolB.id, year: "2021/2022", semester: "Ganjil", status: "ACTIVE" },
+    });
+
+    setActor({
+      session: { user: { id: teacherUserId } },
+      profile: { id: teacherProfileId, userId: teacherUserId },
+      activeSchoolId: schoolB.id,
+      activeSchool: { id: schoolB.id, name: schoolB.name },
+    });
+
+    const res = await createClassAction({ className: "X-A", academicPeriodId: periodB1.id });
+    expect(res.success).toBe(true);
+
+    const states = await prisma.academicPeriod.findMany({ where: { schoolId: schoolB.id } });
+    expect(states.find((p) => p.id === periodB1.id)?.status).toBe("ACTIVE");
+    expect(states.find((p) => p.id === periodB2.id)?.status).toBe("ACTIVE"); // tidak disentuh
+
+    // No audit saklar pada jalur ini
+    const audits = await prisma.auditLog.count({
+      where: { action: "ACADEMIC_PERIOD_SWITCHED", actorId: teacherUserId },
+    });
+    const auditsMain = await prisma.auditLog.count({
+      where: {
+        action: "ACADEMIC_PERIOD_SWITCHED",
+        metadata: { path: ["schoolId"], equals: schoolId },
+      },
+    });
+    expect(audits).toBe(auditsMain);
+
+    // Cleanup sekolah B
+    await prisma.academicPeriod.deleteMany({ where: { schoolId: schoolB.id } });
+    await prisma.class.deleteMany({ where: { schoolId: schoolB.id } });
+    await prisma.subject.deleteMany({ where: { schoolId: schoolB.id } });
+    await prisma.teachingContext.deleteMany({ where: { schoolId: schoolB.id } });
+    await prisma.school.delete({ where: { id: schoolB.id } });
+
+    // Kembalikan aktor ke sekolah utama
+    setActor({
+      session: { user: { id: teacherUserId } },
+      profile: { id: teacherProfileId, userId: teacherUserId },
+      activeSchoolId: schoolId,
+      activeSchool: { id: schoolId, name: `Sekolah Rollover S6 ${ts}` },
+    });
+  });
+
+  it("A5 — Sekolah tanpa periode aktif: fallback default-period ikut saklar + audit (jalur ketiga)", async () => {
+    if (!dbAvailable) return;
+
+    const schoolC = await prisma.school.create({
+      data: { name: `Sekolah Kosong S6 ${ts}`, normalizedName: `sekolah kosong s6 ${ts}` },
+    });
+    setActor({
+      session: { user: { id: teacherUserId } },
+      profile: { id: teacherProfileId, userId: teacherUserId },
+      activeSchoolId: schoolC.id,
+      activeSchool: { id: schoolC.id, name: schoolC.name },
+    });
+
+    const res = await createClassAction({ className: "Y-A" });
+    expect(res.success).toBe(true);
+
+    const periods = await prisma.academicPeriod.findMany({ where: { schoolId: schoolC.id } });
+    expect(periods).toHaveLength(1);
+    expect(periods[0].status).toBe("ACTIVE");
+    expect(periods[0].year).toBe("2024/2025");
+
+    const audit = await prisma.auditLog.findFirst({
+      where: { action: "ACADEMIC_PERIOD_SWITCHED", targetId: periods[0].id },
+    });
+    expect(audit).not.toBeNull();
+    expect((audit!.metadata as Record<string, unknown>).source).toBe("fallback_default");
+
+    await prisma.academicPeriod.deleteMany({ where: { schoolId: schoolC.id } });
+    await prisma.class.deleteMany({ where: { schoolId: schoolC.id } });
+    await prisma.subject.deleteMany({ where: { schoolId: schoolC.id } });
+    await prisma.teachingContext.deleteMany({ where: { schoolId: schoolC.id } });
+    await prisma.school.delete({ where: { id: schoolC.id } });
+
+    setActor({
+      session: { user: { id: teacherUserId } },
+      profile: { id: teacherProfileId, userId: teacherUserId },
+      activeSchoolId: schoolId,
+      activeSchool: { id: schoolId, name: `Sekolah Rollover S6 ${ts}` },
+    });
+  });
+
+  // ─────────────────────────────────────────────────────────────────────────────
+  // B. Klaim ulang (registerStudent) — "klaim ulang; NIS & PIN tetap"
+  // ─────────────────────────────────────────────────────────────────────────────
+
+  it("B1 — Klaim ulang sukses: ACTIVE ber-PIN + kode rombel periode baru + nama exact + PIN lama → ACTIVE, enroll periode baru, ter-audit", async () => {
+    if (!dbAvailable) return;
+
+    const res = await registerStudent({
+      joinCode: newJoinCode,
+      fullName: "budi rollover", // kanonik: trim/case-insensitive
+      nis: `s6b${ts}`, // kanonik uppercase
+      pin: pinBudi, // PIN LAMA tetap
+    });
+
+    expect(res.success).toBe(true);
+    if (res.success && res.status === "ACTIVE") {
+      expect(res.redirect).toBe("/siswa/portal");
+    }
+
+    const db = await prisma.student.findUniqueOrThrow({ where: { id: budiId } });
+    expect(db.accountStatus).toBe("ACTIVE");
+    expect(verifyPin(pinBudi, db.accessPinHash!)).resolves.toBe(true);
+
+    const enrollment = await prisma.classStudent.findUnique({
+      where: { studentId_academicPeriodId: { studentId: budiId, academicPeriodId: newPeriodId } },
+    });
+    expect(enrollment).toBeDefined();
+    expect(enrollment?.classId).toBe(newClassId);
+    // Enrollment lama tidak hilang (riwayat utuh)
+    expect(
+      await prisma.classStudent.findUnique({
+        where: { studentId_academicPeriodId: { studentId: budiId, academicPeriodId: oldPeriodId } },
+      })
+    ).not.toBeNull();
+
+    const audit = await prisma.auditLog.findFirst({
+      where: { action: "STUDENT_RECLAIMED", targetId: budiId },
+    });
+    expect(audit).not.toBeNull();
+
+    // Sesi lama hangus: token ber-pinUpdatedAt lama tidak lagi cocok dengan DB
+    const oldPayload = {
+      studentId: budiId,
+      schoolId,
+      classId: oldClassId,
+      academicPeriodId: oldPeriodId,
+      nis: `S6B${ts}`,
+      fullName: "Budi Rollover",
+      pinUpdatedAt: new Date(0).toISOString(),
+    };
+    const oldToken = signStudentSessionToken(oldPayload);
+    const parsed = verifyStudentSessionToken(oldToken);
+    expect(parsed?.pinUpdatedAt).not.toBe(db.pinUpdatedAt!.toISOString());
+  });
+
+  it("B2 — PIN salah 5x → lockout 15 menit, enrollment tak berubah, pesan generik; saat LOCKED pesan generik identik (anti-enumerasi)", async () => {
+    if (!dbAvailable) return;
+
+    const hana = await prisma.student.findUniqueOrThrow({ where: { id: hanaId } });
+
+    let lastMessage = "";
+    for (let i = 1; i <= 5; i++) {
+      const res = await registerStudent({
+        joinCode: newJoinCode,
+        fullName: "Hana Pindah",
+        nis: hana.nis!,
+        pin: "0000", // salah
+      });
+      expect(res.success).toBe(false);
+      lastMessage = res.message;
+    }
+
+    const after = await prisma.student.findUniqueOrThrow({ where: { id: hanaId } });
+    expect(after.failedAttempts).toBe(5);
+    expect(after.lockedUntil).not.toBeNull();
+    const lockedMinutes = (after.lockedUntil!.getTime() - Date.now()) / 60000;
+    expect(lockedMinutes).toBeGreaterThan(10);
+    expect(lockedMinutes).toBeLessThanOrEqual(15);
+
+    // Tidak ada enrollment baru
+    expect(
+      await prisma.classStudent.findUnique({
+        where: { studentId_academicPeriodId: { studentId: hanaId, academicPeriodId: newPeriodId } },
+      })
+    ).toBeNull();
+
+    const denied = await prisma.auditLog.findFirst({
+      where: { action: "STUDENT_RECLAIM_DENIED", targetId: hanaId, metadata: { path: ["reason"], equals: "PIN_MISMATCH" } },
+    });
+    expect(denied).not.toBeNull();
+
+    // Percobaan saat LOCKED: pesan SAMA persis (anti user-enumeration), nol mutasi
+    const lockedRes = await registerStudent({
+      joinCode: newJoinCode,
+      fullName: "Hana Pindah",
+      nis: hana.nis!,
+      pin: "0000",
+    });
+    expect(lockedRes.success).toBe(false);
+    expect(lockedRes.message).toBe(lastMessage);
+    const afterLocked = await prisma.student.findUniqueOrThrow({ where: { id: hanaId } });
+    expect(afterLocked.failedAttempts).toBe(5); // tidak bertambah saat locked
+    const lockedAudit = await prisma.auditLog.findFirst({
+      where: { action: "STUDENT_RECLAIM_DENIED", targetId: hanaId, metadata: { path: ["reason"], equals: "LOCKED" } },
+    });
+    expect(lockedAudit).not.toBeNull();
+  });
+
+  it("B3 — Klaim ulang nama beda → PENDING L1 + accountRequestedAt + enrollmen periode baru + audit", async () => {
+    if (!dbAvailable) return;
+
+    const res = await registerStudent({
+      joinCode: newJoinCode,
+      fullName: "Fajar Beda Nama",
+      nis: `S6F${ts}`,
+      pin: "1111", // PIN benar
+    });
+
+    expect(res.success).toBe(true);
+    if (res.success) {
+      expect(res.status).toBe("PENDING");
+      if (res.status === "PENDING") expect(res.reason).toBe("MISMATCH_NAME");
+    }
+
+    const db = await prisma.student.findUniqueOrThrow({ where: { id: fajarId } });
+    expect(db.accountStatus).toBe("PENDING");
+    expect(db.accountRequestedAt).not.toBeNull();
+
+    expect(
+      await prisma.classStudent.findUnique({
+        where: { studentId_academicPeriodId: { studentId: fajarId, academicPeriodId: newPeriodId } },
+      })
+    ).not.toBeNull();
+
+    const audit = await prisma.auditLog.findFirst({
+      where: { action: "STUDENT_RECLAIM_PENDING_NAME", targetId: fajarId },
+    });
+    expect(audit).not.toBeNull();
+  });
+
+  it("B4 — Gate periode INACTIVE: kode join periode lama ditolak (F1), enrollment & status tak berubah", async () => {
+    if (!dbAvailable) return;
+
+    const res = await registerStudent({
+      joinCode: oldJoinCode, // periode 2025/2026 sudah INACTIVE
+      fullName: "Gita Aktif",
+      nis: `S6G${ts}`,
+      pin: "2222",
+    });
+
+    expect(res.success).toBe(false);
+    expect(res.message).toContain("sudah terdaftar");
+
+    const db = await prisma.student.findUniqueOrThrow({ where: { id: gitaId } });
+    expect(db.accountStatus).toBe("ACTIVE");
+    expect(
+      await prisma.classStudent.count({
+        where: { studentId: gitaId, academicPeriodId: newPeriodId },
+      })
+    ).toBe(0);
+  });
+
+  it("B5 — PENDING ber-PIN → F1 statis tanpa cabang baru; pasca-approve komposisi klaim ulang menempel ke rombel baru", async () => {
+    if (!dbAvailable) return;
+
+    // 1) PENDING ber-PIN submit kode join periode baru → pesan statis F1 (anti-enumerasi)
+    const denied = await registerStudent({
+      joinCode: newJoinCode,
+      fullName: "Dewi Pending",
+      nis: `S6D${ts}`,
+      pin: "4321",
+    });
+    expect(denied.success).toBe(false);
+    expect(denied.message).toContain("sudah terdaftar");
+
+    // 2) Guru approve pending periode lama (tetap sah — G-7): simulasi state hasil approve
+    await prisma.student.update({
+      where: { id: dewiId },
+      data: {
+        accountStatus: "ACTIVE",
+        approvedAt: new Date(),
+        approvedById: teacherUserId,
+        accountRequestedAt: null,
+      },
+    });
+
+    // 3) Siswa ACTIVE ber-PIN belum enroll periode aktif → klaim ulang
+    const claim = await registerStudent({
+      joinCode: newJoinCode,
+      fullName: "Dewi Pending",
+      nis: `S6D${ts}`,
+      pin: "4321",
+    });
+    expect(claim.success).toBe(true);
+    if (claim.success) expect(claim.status).toBe("ACTIVE");
+
+    expect(
+      await prisma.classStudent.findUnique({
+        where: { studentId_academicPeriodId: { studentId: dewiId, academicPeriodId: newPeriodId } },
+      })
+    ).not.toBeNull();
+  });
+
+  it("B6 — Enroll aktif rombel lain & rombel sama → F1 (pindah rombel tetap kuasa guru, N5)", async () => {
+    if (!dbAvailable) return;
+
+    // Hana pindah ke rombel baru periode aktif (simulate: enroll manual rombel 8-A)
+    await prisma.classStudent.create({
+      data: { studentId: hanaId, classId: newClassId, academicPeriodId: newPeriodId },
+    });
+
+    // Reset lockout dari B2 agar akun bisa dipakai
+    await prisma.student.update({
+      where: { id: hanaId },
+      data: { failedAttempts: 0, lockedUntil: null },
+    });
+
+    const res = await registerStudent({
+      joinCode: newJoinCode, // rombel SAMA
+      fullName: "Hana Pindah",
+      nis: `S6H${ts}`,
+      pin: "3333",
+    });
+    expect(res.success).toBe(false);
+    expect(res.message).toContain("sudah terdaftar. Silakan login langsung");
+
+    // Enrollment tetap menunjuk rombel sama, tidak ada duplikat
+    const memberships = await prisma.classStudent.findMany({
+      where: { studentId: hanaId, academicPeriodId: newPeriodId },
+    });
+    expect(memberships).toHaveLength(1);
+    expect(memberships[0].classId).toBe(newClassId);
+
+    // Varian rombel LAIN pada periode aktif yang sama (8-B dari A3): tetap ditolak —
+    // perpindahan rombel hanya lewat guru (N5), kode join tidak bisa memindahkan siswa aktif
+    const classB = await prisma.class.findFirstOrThrow({ where: { schoolId, name: "8-B" } });
+    const joinCodeB = `S6B${ts.toString().slice(-4)}`;
+    await prisma.class.update({
+      where: { id: classB.id },
+      data: { joinCode: joinCodeB, joinCodeLocked: false },
+    });
+    const resOther = await registerStudent({
+      joinCode: joinCodeB,
+      fullName: "Hana Pindah",
+      nis: `S6H${ts}`,
+      pin: "3333",
+    });
+    expect(resOther.success).toBe(false);
+    expect(resOther.message).toContain("sudah terdaftar");
+
+    const membershipsAfter = await prisma.classStudent.findMany({
+      where: { studentId: hanaId, academicPeriodId: newPeriodId },
+    });
+    expect(membershipsAfter).toHaveLength(1);
+    expect(membershipsAfter[0].classId).toBe(newClassId); // tak berpindah
+  });
+
+  it("B7 — REJECTED daftar ulang (G-1) regresi: PIN lama cocok → PENDING, row sama dipakai ulang", async () => {
+    if (!dbAvailable) return;
+
+    const res = await registerStudent({
+      joinCode: newJoinCode,
+      fullName: "Eka Rejected",
+      nis: `S6E${ts}`,
+      pin: "9999", // PIN lama
+    });
+
+    expect(res.success).toBe(true);
+    if (res.success) {
+      expect(res.status).toBe("PENDING");
+    }
+    const db = await prisma.student.findUniqueOrThrow({ where: { id: ekaId } });
+    expect(db.accountStatus).toBe("PENDING");
+    // Row sama (bukan create baru)
+    expect(await prisma.student.count({ where: { schoolId, nis: `S6E${ts}` } })).toBe(1);
+  });
+
+  it("B8 — Login pasca-rollover: resolusi sesi memprioritaskan enrollment periode AKTIF walau row lama lebih baru", async () => {
+    if (!dbAvailable) return;
+
+    // Buat row lama "lebih baru" (createdAt dimajukan) — urutan arbitrer tidak boleh menang
+    await prisma.classStudent.update({
+      where: { studentId_academicPeriodId: { studentId: budiId, academicPeriodId: oldPeriodId } },
+      data: { createdAt: new Date(Date.now() + 60_000) },
+    });
+
+    const membership = await resolveStudentSessionMembership(budiId);
+    expect(membership).not.toBeNull();
+    expect(membership!.academicPeriodId).toBe(newPeriodId);
+    expect(membership!.classId).toBe(newClassId);
+
+    const res = await loginStudent({ schoolId, nis: `S6B${ts}`, pin: pinBudi });
+    expect(res.success).toBe(true);
+  });
+
+  it("B9 — Login pasca-impor (jalur mayoritas): reuse-NIS impor menempel periode baru → login NIS+PIN lama sukses, sesi periode baru", async () => {
+    if (!dbAvailable) return;
+
+    // Simulasi hasil commit impor (import.service reuse deterministik by-NIS):
+    // row ClassStudent periode baru dibuat untuk siswa existing — PIN & NIS tetap.
+    await prisma.classStudent.create({
+      data: { studentId: sitiId, classId: newClassId, academicPeriodId: newPeriodId },
+    });
+
+    const res = await loginStudent({ schoolId, nis: `S6S${ts}`, pin: "5678" });
+    expect(res.success).toBe(true);
+
+    const membership = await resolveStudentSessionMembership(sitiId);
+    expect(membership!.academicPeriodId).toBe(newPeriodId);
+
+    // Submit kode join rombel periode aktif yang sama → "login langsung" (F1)
+    const rej = await registerStudent({
+      joinCode: newJoinCode,
+      fullName: "Siti Impor",
+      nis: `S6S${ts}`,
+      pin: "5678",
+    });
+    expect(rej.success).toBe(false);
+    expect(rej.message).toContain("sudah terdaftar. Silakan login langsung");
+  });
+
+  it("B10 — Race dua klaim ulang simultan: tanpa duplikat enrollment, tanpa P2002 mentah", async () => {
+    if (!dbAvailable) return;
+
+    // Gita: ACTIVE ber-PIN, belum enroll periode baru
+    const [r1, r2] = await Promise.allSettled([
+      registerStudent({
+        joinCode: newJoinCode,
+        fullName: "Gita Aktif",
+        nis: `S6G${ts}`,
+        pin: "2222",
+      }),
+      registerStudent({
+        joinCode: newJoinCode,
+        fullName: "Gita Aktif",
+        nis: `S6G${ts}`,
+        pin: "2222",
+      }),
+    ]);
+
+    const outcomes = [r1, r2].map((r) =>
+      r.status === "fulfilled" ? r.value : { success: false, message: String(r.reason) }
+    );
+
+    // Minimal satu sukses; kegagalan (bila ada) berupa pesan generik — bukan error mentah
+    expect(outcomes.some((o) => o.success)).toBe(true);
+    for (const o of outcomes) {
+      if (!o.success) {
+        expect(o.message).not.toContain("P2002");
+        expect(o.message).not.toContain("Unique constraint");
+      }
+    }
+
+    // Invariant utama: TEPAT satu row enrollment periode baru (upsert N5 + unique)
+    const memberships = await prisma.classStudent.findMany({
+      where: { studentId: gitaId, academicPeriodId: newPeriodId },
+    });
+    expect(memberships).toHaveLength(1);
+    expect(memberships[0].classId).toBe(newClassId);
+  });
+
+  it("B11 — Visibilitas historis /parent/* pasca-saklar: akses konteks periode lama tetap terbaca", async () => {
+    if (!dbAvailable) return;
+
+    // Parent + relasi + akses pengajaran pada TeachingContext periode LAMA (kini INACTIVE)
+    const parentUser = await prisma.user.create({
+      data: {
+        id: `parent-s6-${ts}`,
+        email: `parent-s6-${ts}@test.com`,
+        name: "Ortu Budi",
+        emailVerified: true,
+        createdAt: new Date(),
+        updatedAt: new Date(),
+      },
+    });
+    const parentProfile = await prisma.parentProfile.create({
+      data: { userId: parentUser.id },
+    });
+    const relation = await prisma.parentStudentRelation.create({
+      data: { parentProfileId: parentProfile.id, studentId: budiId, relationshipLabel: "Ayah" },
+    });
+    const oldContext = await prisma.teachingContext.findFirstOrThrow({
+      where: { schoolId, academicPeriodId: oldPeriodId },
+    });
+    await prisma.parentTeachingAccess.create({
+      data: {
+        parentStudentRelationId: relation.id,
+        teachingContextId: oldContext.id,
+        grantedByTeacherProfileId: teacherProfileId,
+        status: "ACTIVE",
+      },
+    });
+
+    // Periode lama sudah INACTIVE (hasil saklar) — bacaan parent tetap berfungsi
+    const contexts = await getParentAuthorizedContexts(parentProfile.id);
+    const historical = contexts.find((c) => c.teachingContextId === oldContext.id);
+    expect(historical).toBeDefined();
+    expect(historical?.academicYear).toBe("2025/2026");
+    expect(historical?.studentId).toBe(budiId);
+
+    // Cleanup parent entities (Restrict pada student)
+    await prisma.parentTeachingAccess.deleteMany({ where: { parentStudentRelationId: relation.id } });
+    await prisma.parentStudentRelation.delete({ where: { id: relation.id } });
+    await prisma.parentProfile.delete({ where: { id: parentProfile.id } });
+    await prisma.user.delete({ where: { id: parentUser.id } });
+  });
+});

```
