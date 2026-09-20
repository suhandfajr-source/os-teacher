Conduct a review of CONTENT.
Look for what's missing, not only what's wrong.
Compute your finding floor N from the diff file's size: N = min(floor(sqrt(kB) + 1), 10), where kB is the file's size in kilobytes. State the arithmetic in one line, then find at least N issues to fix or improve.
Output a Markdown list of findings only — no severity, priority, or ranking.
If the content is empty, stop and say so.
If you have zero findings, re-check and keep thinking; do not stop with an empty list.

CONTENT: the unified diff below (inlined — this session has no filesystem access to the original):

diff --git a/.env.example b/.env.example
index 73cc969..ad9ffc1 100644
--- a/.env.example
+++ b/.env.example
@@ -5,6 +5,14 @@ BETTER_AUTH_SECRET=
 BETTER_AUTH_URL=
 GEMINI_API_KEY=
 
+# --- Student portal PIN pepper (required in production) ---
+# Secret mixed into student PIN hashing (HMAC before scrypt). Generate with:
+#   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
+# WARNING: rotating this value invalidates ALL existing student PIN hashes.
+# The server REFUSES TO BOOT in production (NODE_ENV=production) without it;
+# development/test falls back to a deterministic constant when unset.
+PIN_PEPPER=
+
 # --- AI Slide Illustration (optional, requires Gemini paid tier) ---
 # Uncomment to enable AI image generation for key presentation slides.
 # Without it, exports fall back to the themed illustration panel.
diff --git a/_bmad-output/implementation-artifacts/deferred-work.md b/_bmad-output/implementation-artifacts/deferred-work.md
index 6494d73..6ce5c04 100644
--- a/_bmad-output/implementation-artifacts/deferred-work.md
+++ b/_bmad-output/implementation-artifacts/deferred-work.md
@@ -30,9 +30,6 @@
 - source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md`
   summary: Verifikasi invariant "Better Auth selalu menyimpan email lowercase" ATAU pakai lookup insensitive di seeder; tambah baris matriks stored-mixed-case.
   evidence: BH8 maybe-false: bila DB menyimpan mixed-case, lookup normalized miss (laporan "tidak dikenal" palsu); disetel dengan membaca normalisasi email better-auth versi 1.6.29.
-- source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md`
-  summary: Patok nilai fallback PIN_PEPPER dev/test sebagai konstanta deterministik + assert di test spec 1b.
-  evidence: BH9: fallback acak per proses membuat hash run sebelumnya tak terverifikasi — login dev gagal misterius lintas restart.
 - source_spec: `_bmad-output/specs/spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md`
   summary: Tambah test integrasi seeder ke spec 1c: idempotensi (run 2× → 0 entri audit baru) + transaksi-rollback (email tak dikenal → nol row berubah).
   evidence: BH12: jaminan inti keamanan (all-or-nothing, idempotent) hanya diverifikasi manual via Verification commands.
diff --git a/_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md b/_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md
index a0cf0be..fd787ad 100644
--- a/_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md
+++ b/_bmad-output/specs/spec-student-portal-auth/stories/1b-primitif-pin.md
@@ -2,7 +2,8 @@
 title: 'Story 1b — Primitif PIN Siswa (scrypt + pepper)'
 type: 'feature'
 created: '2026-09-20'
-status: 'draft'
+status: 'in-review'
+baseline_commit: 'a56aa9c745b9cf1227afe208b0227a87d7b54d8e'
 route: 'full'
 review_loop_iteration: 0
 context:
@@ -23,7 +24,7 @@ context:
 **Always:**
 - PIN memakai `node:crypto` scrypt; verifikasi constant-time (`timingSafeEqual`); format hash self-describing (params terenkode) agar parameter bisa dieskalasi tanpa rehash massal.
 - Kontrak asimetris: `hashPin` throw `PinFormatError` untuk input invalid (validasi dulu — defense in depth); `verifyPin` return `false` untuk input invalid (boolean hot-path login).
-- Door criteria: `tsc` bersih + seluruh test lama (475 saat story ditulis) hijau + test baru hijau.
+- Door criteria: `tsc` bersih + seluruh test lama (475 saat story ditulis) hijau + test baru hijau. **Keputusan human 2026-09-20 (OQ1=A): pengecualian baseline terdokumentasi** — 1 merah pre-existing `src/modules/imports/__tests__/import.db-concurrency.test.ts` (import engine, tak terkait 1b) dikecualikan; keberhasilan diukur dengan membandingkan failure set sebelum/sesudah, bukan hanya hitungan.
 
 **Never:**
 - Tidak menyentuh DB/schema (1a), seeder (1c), `quiz.actions.ts`/`quiz.service.ts`, maupun alur auth guru.
@@ -47,16 +48,18 @@ context:
 ## Code Map
 
 - `src/lib/student-pin.ts` — file baru (pure util).
-- `src/lib/auth.ts` — **referensi pola, jangan diubah**: `getAuthSecret()` fail-fast (:53) — cermin pola resolve `PIN_PEPPER`.
-- `src/lib/__tests__/auth.security.test.ts` — referensi gaya vitest (`describe/it/expect`, folder `__tests__`).
+- `src/lib/auth.ts` — **referensi pola, jangan diubah**: `getAuthSecret()` (:47–55) fail-fast production + fallback dev konstanta deterministik `"dev-only-local-secret-do-not-use-in-production"` — cermin persis untuk resolve `PIN_PEPPER` (termasuk gaya pesan error).
+- `src/lib/__tests__/auth.security.test.ts` — referensi gaya vitest (`describe/it/expect`, folder `__tests__`, pola save/restore `process.env` di `try/finally`).
+- `vitest.config.ts` — include `src/**/*.test.ts`; `NODE_ENV=test` di-set oleh vitest (fallback pepper aktif di suite tanpa env khusus).
 - `.env.example` — tambah `PIN_PEPPER` + komentar peringatan NODE_ENV; **jangan** sentuh entri lain.
+- Baseline verifikasi 2026-09-20: `npm test` = 475 test, **474 hijau, 1 merah pre-existing** `src/modules/imports/__tests__/import.db-concurrency.test.ts` (konkurensi import engine, tak terkait auth/PIN; gagal juga saat dijalankan terisolasi).
 
 ## Tasks & Acceptance
 
 **Execution:**
-- [ ] `src/lib/student-pin.ts` — `validatePinFormat` / `hashPin` / `verifyPin` sesuai kontrak Design Notes di bawah.
-- [ ] `.env.example` — dokumentasikan `PIN_PEPPER` + komentar peringatan NODE_ENV.
-- [ ] `src/lib/__tests__/student-pin.test.ts` — seluruh baris matriks I/O di atas (termasuk digit Unicode `"١٢٣٤"`/`"１２３４"` ditolak).
+- [x] `src/lib/student-pin.ts` — `validatePinFormat` / `hashPin` / `verifyPin` sesuai kontrak Design Notes di bawah; resolve `PIN_PEPPER` saat module load (fail-fast production, fallback konstanta deterministik `DEV_ONLY_PIN_PEPPER` bila `NODE_ENV ∈ {development, test}` — konsumsi deferred-work BH9).
+- [x] `.env.example` — dokumentasikan `PIN_PEPPER` + komentar peringatan NODE_ENV.
+- [x] `src/lib/__tests__/student-pin.test.ts` — seluruh baris matriks I/O di atas (termasuk digit Unicode `"١٢٣٤"`/`"１２３４"` ditolak) + assert fallback pepper dev/test = konstanta deterministik (bukan acak per proses) + fail-fast production (mirror pola test `getAuthSecret`).
 
 **Acceptance Criteria:**
 - Given matriks PIN di atas, when test dijalankan, then semua baris lulus persis.
@@ -64,10 +67,16 @@ context:
 
 ## Implementation Notes
 
+- 2026-09-20 (implement): `promisify(scrypt)` kehilangan overload options di TS strict (TS2554/TS18046) — diganti promise wrapper eksplisit `scryptAsync()` bertipe `Promise<Buffer>`; kontrak async Design Notes tetap terpenuhi (non-`scryptSync`).
+- 2026-09-20 (implement): mutasi `process.env.NODE_ENV` read-only oleh next-env.d.ts (TS2540) — test pakai `vi.stubEnv`/`vi.unstubAllEnvs`; mutasi `PIN_PEPPER` tetap manual dengan save/restore `try/finally` (mirror gaya `auth.security.test.ts`).
+- 2026-09-20 (implement): 3 test hardening tambahan di atas matriks — boot fail-fast via `vi.resetModules()` + dynamic import `NODE_ENV=production`; determinisme lintas restart (2× module instance, hash instance-1 terverifikasi instance-2); kontribusi pepper nyata (hash pepper-alpha tidak verify di pepper-beta).
+- 2026-09-20 (implement): verifikasi akhir — `npx tsc --noEmit` exit 0; `npm test` 510/510 hijau (44 file) termasuk `import.db-concurrency.test.ts` yang merah saat baseline — failure set sebelum→sesudah: `{db-concurrency}`→`∅` (pengecualian OQ1=A tidak jadi terpakai, kondisi lebih ketat terpenuhi).
+
 ## Spec Change Log
 
 - 2026-09-20 — Pecahan 3 arah Story 1 (Build step-02 token-gate, disetujui human): scope primitif PIN menjadi story ini. Seluruh pengerasan elicitation dipindah utuh; sejarah lengkap: `1-fondasi-database-primitif-keamanan.elicitation-report.md` (file selevel).
 - 2026-09-20 — Elicitation 1b/1c (5 metode konsolidasi): opsi pengerasan pepper diperbaiki `NODE_ENV ∈ {development, test}` (vitest men-set test — tanpa ini opsi mematikan suite); kontrak async `crypto.scrypt` promisified (jangan `scryptSync` — blokir event loop ±50ms).
+- 2026-09-20 — Build step-02: konsumsi entri deferred-work BH9 (instruksi human) — fallback `PIN_PEPPER` dev/test dipatok sebagai konstanta deterministik + assert di test; entri dihapus dari `deferred-work.md`. Tanpa ini hash run sebelumnya tak terverifikasi lintas restart (login dev gagal misterius). Baseline 1 test merah pre-existing dicatat di Code Map (keputusan OQ1=A kini terkunci di frozen block).
 
 ## Review Triage Log
 
@@ -77,7 +86,7 @@ context:
 - Aturan memori tunggal: `maxmem` eksplisit (mis. 64 MB); param yang menuntut `128×N×r` di atasnya ditolak saat parse; error scrypt apa pun saat verify → `false`. Pre-check panjang buffer sebelum `timingSafeEqual` (throw bila beda panjang).
 - API async: `crypto.scrypt` promisified (bukan `scryptSync`) — `N=16384` memblokir event loop ±50ms per panggilan; hot-path login Story 3 wajib non-blocking.
 - Format input: tepat 4 digit ASCII `/^\d{4}$/` (digit Unicode ditolak — kontrak test eksplisit).
-- Pepper: PIN di-HMAC `PIN_PEPPER` sebelum scrypt — dump DB saja tak cukup untuk brute-force offline. `PIN_PEPPER` resolve saat **module load** (fail-fast boot production, mirror `getAuthSecret()`; fallback dev-only) — bukan crash runtime di login pertama. Wajib di env produksi **sebelum deploy Story 3** (Story 1b tidak diimpor app mana pun — boot tetap aman sekarang). Rotasi membatalkan SEMUA hash: gratis sebelum produksi; pasca-produksi = re-issue PIN massal (opsi masa depan: versi pepper terenkode di format). Opsi pengerasan: fallback hanya aktif bila `NODE_ENV ∈ {development, test}` — vitest men-set `NODE_ENV=test`; tanpa pengecualian ini, opsi mematikan test suite.
+- Pepper: PIN di-HMAC `PIN_PEPPER` sebelum scrypt — dump DB saja tak cukup untuk brute-force offline. `PIN_PEPPER` resolve saat **module load** (fail-fast boot production, mirror `getAuthSecret()`; fallback dev-only) — bukan crash runtime di login pertama. Wajib di env produksi **sebelum deploy Story 3** (Story 1b tidak diimpor app mana pun — boot tetap aman sekarang). Rotasi membatalkan SEMUA hash: gratis sebelum produksi; pasca-produksi = re-issue PIN massal (opsi masa depan: versi pepper terenkode di format). Fallback hanya aktif bila `NODE_ENV ∈ {development, test}` — vitest men-set `NODE_ENV=test`; tanpa pengecualian ini, suite mati. Nilai fallback = **konstanta deterministik** (mis. `"dev-only-pin-pepper-do-not-use-in-production"`, mirror konstanta `getAuthSecret()`) — BUKAN acak per proses (BH9: fallback acak membuat hash lintas restart tak terverifikasi); diuji via assert determinisme di test.
 - Preseden berbahaya — JANGAN ditiru: `QuizStudentAccess.pin` & `Quiz.classroomPin` plaintext (di luar scope — Never; utang amendum). `accessPinHash` hanya via `hashPin`/`verifyPin`.
 
 ## Verification
diff --git a/src/lib/__tests__/student-pin.test.ts b/src/lib/__tests__/student-pin.test.ts
new file mode 100644
index 0000000..55735f6
--- /dev/null
+++ b/src/lib/__tests__/student-pin.test.ts
@@ -0,0 +1,195 @@
+import { describe, it, expect, vi } from "vitest";
+import {
+    PinFormatError,
+    DEV_ONLY_PIN_PEPPER,
+    resolvePinPepper,
+    validatePinFormat,
+    hashPin,
+    verifyPin,
+} from "../student-pin";
+
+const HASH_PATTERN = /^scrypt:16384:8:1:[0-9a-f]{32}:[0-9a-f]{64}$/;
+
+describe("Student PIN primitives - validatePinFormat / hashPin contract", () => {
+    it("accepts exactly 4 ASCII digits", () => {
+        expect(validatePinFormat("1234")).toBe(true);
+        expect(validatePinFormat("0000")).toBe(true);
+        expect(validatePinFormat("9999")).toBe(true);
+    });
+
+    it.each(["123", "12", "12345", "123456", "12a4", "", " 1234", "1234 "])(
+        "rejects %j with PinFormatError before hashing",
+        (pin) => {
+            expect(() => validatePinFormat(pin)).toThrow(PinFormatError);
+            expect(() => validatePinFormat(pin)).toThrow(/tepat 4 digit/);
+            expect(hashPin(pin)).rejects.toBeInstanceOf(PinFormatError);
+        }
+    );
+
+    it.each(["١٢٣٤", "１２３４"])("rejects Unicode digit PIN %j", (pin) => {
+        expect(() => validatePinFormat(pin)).toThrow(PinFormatError);
+        expect(hashPin(pin)).rejects.toBeInstanceOf(PinFormatError);
+        expect(verifyPin(pin, "scrypt:16384:8:1:00:00")).resolves.toBe(false);
+    });
+
+    it("hashes a valid 4-digit PIN into a self-describing format (params + salt encoded)", async () => {
+        const hash = await hashPin("1234");
+        expect(hash).toMatch(HASH_PATTERN);
+    });
+
+    it("generates a fresh random salt per hash (two hashes of one PIN differ)", async () => {
+        const [a, b] = await Promise.all([hashPin("1234"), hashPin("1234")]);
+        expect(a).not.toEqual(b);
+    });
+});
+
+describe("Student PIN primitives - verifyPin contract", () => {
+    it("returns true for the correct PIN", async () => {
+        const hash = await hashPin("1234");
+        await expect(verifyPin("1234", hash)).resolves.toBe(true);
+    });
+
+    it("returns false for a wrong PIN", async () => {
+        const hash = await hashPin("1234");
+        await expect(verifyPin("5678", hash)).resolves.toBe(false);
+    });
+
+    it.each(["56a8", "", "123", "12345"])(
+        "returns false (does NOT throw) for invalid candidate format %j",
+        async (pin) => {
+            const hash = await hashPin("1234");
+            await expect(verifyPin(pin, hash)).resolves.toBe(false);
+        }
+    );
+
+    it.each([
+        "not-a-hash",
+        "",
+        "argon2:16384:8:1:00:00",
+        "scrypt:16384:8:1",
+        "scrypt:x:8:1:00:00",
+        "scrypt:0:8:1:00:00",
+        "scrypt:16384:8:1:zz:00",
+        "scrypt:16384:8:1::00",
+        "scrypt:16384:8:1:00:",
+    ])("returns false (does NOT throw) for corrupt stored hash %j", async (bad) => {
+        await expect(verifyPin("1234", bad)).resolves.toBe(false);
+    });
+
+    it("returns false without throw/OOM when hash params demand memory above the single memory rule", async () => {
+        // 128 * 2^24 * 8 bytes ≈ 16 GiB >> 64 MB maxmem.
+        const overBudget = "scrypt:16777216:8:1:" + "ab".repeat(16) + ":" + "cd".repeat(32);
+        await expect(verifyPin("1234", overBudget)).resolves.toBe(false);
+
+        // Just over the boundary (128*N*8 > 64MB ⇒ N > 65536) — also rejected.
+        const barelyOver = "scrypt:65537:8:1:" + "ab".repeat(16) + ":" + "cd".repeat(32);
+        await expect(verifyPin("1234", barelyOver)).resolves.toBe(false);
+    });
+});
+
+describe("Student PIN primitives - PIN_PEPPER resolution (deferred-work BH9)", () => {
+    const originalPepper = process.env.PIN_PEPPER;
+
+    function restorePepper() {
+        if (originalPepper === undefined) {
+            delete process.env.PIN_PEPPER;
+        } else {
+            process.env.PIN_PEPPER = originalPepper;
+        }
+    }
+
+    it("falls back to the deterministic DEV_ONLY_PIN_PEPPER constant in development/test", () => {
+        try {
+            delete process.env.PIN_PEPPER;
+            expect(resolvePinPepper("development")).toBe(DEV_ONLY_PIN_PEPPER);
+            expect(resolvePinPepper("test")).toBe(DEV_ONLY_PIN_PEPPER);
+            // Deterministic, not random per process: two resolutions agree.
+            expect(resolvePinPepper("test")).toBe(resolvePinPepper("development"));
+        } finally {
+            restorePepper();
+        }
+    });
+
+    it("fails closed (throws) in production if PIN_PEPPER is unset, empty, or whitespace", () => {
+        try {
+            delete process.env.PIN_PEPPER;
+            expect(() => resolvePinPepper("production")).toThrow(
+                "Missing required PIN_PEPPER configuration in production environment."
+            );
+
+            process.env.PIN_PEPPER = "   ";
+            expect(() => resolvePinPepper("production")).toThrow(
+                "Missing required PIN_PEPPER configuration in production environment."
+            );
+        } finally {
+            restorePepper();
+        }
+    });
+
+    it("returns the configured PIN_PEPPER in production when present", () => {
+        try {
+            process.env.PIN_PEPPER = "prod-pepper-random-32-byte-secret";
+            expect(resolvePinPepper("production")).toBe("prod-pepper-random-32-byte-secret");
+        } finally {
+            restorePepper();
+        }
+    });
+
+    it("fails fast at module load in production without PIN_PEPPER (boot, not first login)", async () => {
+        try {
+            delete process.env.PIN_PEPPER;
+            vi.stubEnv("NODE_ENV", "production");
+            vi.resetModules();
+            await expect(import("../student-pin")).rejects.toThrow(
+                "Missing required PIN_PEPPER configuration in production environment."
+            );
+        } finally {
+            vi.unstubAllEnvs();
+            restorePepper();
+            vi.resetModules();
+        }
+    });
+
+    it("hashes remain verifiable across process restarts in dev (fallback is stable, not per-process random)", async () => {
+        try {
+            delete process.env.PIN_PEPPER;
+            vi.stubEnv("NODE_ENV", "development");
+
+            vi.resetModules();
+            const firstBoot = await import("../student-pin");
+            const hash = await firstBoot.hashPin("1234");
+            expect(hash).toMatch(HASH_PATTERN);
+
+            // Simulate a restart: fresh module instance under the same fallback.
+            vi.resetModules();
+            const secondBoot = await import("../student-pin");
+            await expect(secondBoot.verifyPin("1234", hash)).resolves.toBe(true);
+        } finally {
+            vi.unstubAllEnvs();
+            restorePepper();
+            vi.resetModules();
+        }
+    });
+
+    it("hashes bound to one pepper value do not verify under another (pepper actually contributes)", async () => {
+        const originalPepperLocal = process.env.PIN_PEPPER;
+        try {
+            process.env.PIN_PEPPER = "pepper-alpha";
+            vi.resetModules();
+            const alphaModule = await import("../student-pin");
+            const hash = await alphaModule.hashPin("1234");
+
+            process.env.PIN_PEPPER = "pepper-beta";
+            vi.resetModules();
+            const betaModule = await import("../student-pin");
+            await expect(betaModule.verifyPin("1234", hash)).resolves.toBe(false);
+        } finally {
+            if (originalPepperLocal === undefined) {
+                delete process.env.PIN_PEPPER;
+            } else {
+                process.env.PIN_PEPPER = originalPepperLocal;
+            }
+            vi.resetModules();
+        }
+    });
+});
diff --git a/src/lib/student-pin.ts b/src/lib/student-pin.ts
new file mode 100644
index 0000000..b3c2dcc
--- /dev/null
+++ b/src/lib/student-pin.ts
@@ -0,0 +1,172 @@
+import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
+import type { ScryptOptions } from "node:crypto";
+
+/**
+ * Student PIN primitives (Story 1b) — pure util, zero DB dependencies.
+ *
+ * Hash format (self-describing so parameters can be escalated without mass
+ * rehashing): `scrypt:{N}:{r}:{p}:{saltHex}:{hashHex}`
+ *
+ * SECURITY CONTRACT (spec-student-portal-auth/stories/1b-primitif-pin.md):
+ * - `hashPin` THROWS `PinFormatError` for invalid input (validate first).
+ * - `verifyPin` RETURNS `false` for invalid input (boolean login hot-path —
+ *   never throws, including corrupt/over-budget hashes).
+ * - The PIN is HMAC'd with `PIN_PEPPER` before scrypt, so a DB dump alone is
+ *   not enough for offline brute-force of 4-digit PINs.
+ * - Async `crypto.scrypt` (promisified) — N=16384 blocks the event loop
+ *   ~50ms per call with `scryptSync`; Story 3's login path must stay
+ *   non-blocking.
+ */
+
+// Explicit promise wrapper (typing `promisify(scrypt)` loses the options overload).
+function scryptAsync(
+    password: Buffer,
+    salt: Buffer,
+    keylen: number,
+    options: ScryptOptions
+): Promise<Buffer> {
+    return new Promise((resolve, reject) => {
+        scryptCallback(password, salt, keylen, options, (err, derivedKey) => {
+            if (err) reject(err);
+            else resolve(derivedKey);
+        });
+    });
+}
+
+/** Deterministic dev/test fallback pepper (deferred-work BH9): a per-process
+ * random fallback would make hashes unverifiable across restarts. Mirrors the
+ * dev fallback constant of `getAuthSecret()` in `src/lib/auth.ts`. */
+export const DEV_ONLY_PIN_PEPPER = "dev-only-pin-pepper-do-not-use-in-production";
+
+// scrypt parameters encoded into every hash string.
+const SCRYPT_N = 16384;
+const SCRYPT_R = 8;
+const SCRYPT_P = 1;
+const KEY_LENGTH = 32; // bytes
+const SALT_LENGTH = 16; // bytes
+
+// Single memory rule: scrypt needs roughly 128*N*r bytes. Anything demanding
+// more than 64 MB is rejected (at parse time in verify, and Node enforces the
+// same limit inside scrypt).
+const SCRYPT_MAXMEM = 64 * 1024 * 1024;
+
+const PIN_PATTERN = /^\d{4}$/; // exactly 4 ASCII digits — Unicode digits rejected
+
+export class PinFormatError extends Error {
+    constructor(message: string) {
+        super(message);
+        this.name = "PinFormatError";
+    }
+}
+
+export function validatePinFormat(pin: string): true {
+    if (!PIN_PATTERN.test(pin)) {
+        throw new PinFormatError(
+            "PIN harus tepat 4 digit angka ASCII (contoh: 1234)."
+        );
+    }
+    return true;
+}
+
+/**
+ * Resolve `PIN_PEPPER` the way `getAuthSecret()` resolves `BETTER_AUTH_SECRET`:
+ * fail-fast at module load in production, deterministic-constant fallback only
+ * when `NODE_ENV` is development/test (vitest sets test).
+ */
+export function resolvePinPepper(nodeEnv: string | undefined = process.env.NODE_ENV): string {
+    const pepper = process.env.PIN_PEPPER;
+    if (nodeEnv === "production") {
+        if (!pepper || pepper.trim() === "") {
+            throw new Error("Missing required PIN_PEPPER configuration in production environment.");
+        }
+        return pepper;
+    }
+    return pepper || DEV_ONLY_PIN_PEPPER;
+}
+
+const pinPepper = resolvePinPepper();
+
+function pepperPin(pin: string): Buffer {
+    return createHmac("sha256", pinPepper).update(pin, "utf8").digest();
+}
+
+interface ScryptParams {
+    N: number;
+    r: number;
+    p: number;
+    salt: Buffer;
+    hash: Buffer;
+}
+
+/** Parse + validate a stored hash string. Returns null for anything malformed
+ * (wrong scheme, non-numeric params, non-hex segments, empty buffers, or
+ * parameters demanding more memory than the single memory rule allows). */
+function parseStoredHash(storedHash: string): ScryptParams | null {
+    const parts = storedHash.split(":");
+    if (parts.length !== 6 || parts[0] !== "scrypt") {
+        return null;
+    }
+    const N = Number(parts[1]);
+    const r = Number(parts[2]);
+    const p = Number(parts[3]);
+    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) {
+        return null;
+    }
+    if (N <= 0 || r <= 0 || p <= 0) {
+        return null;
+    }
+    // Single memory rule — reject before touching scrypt.
+    if (128 * N * r > SCRYPT_MAXMEM) {
+        return null;
+    }
+    if (!/^[0-9a-f]+$/i.test(parts[4]) || !/^[0-9a-f]+$/i.test(parts[5])) {
+        return null;
+    }
+    const salt = Buffer.from(parts[4], "hex");
+    const hash = Buffer.from(parts[5], "hex");
+    if (salt.length === 0 || hash.length === 0) {
+        return null;
+    }
+    return { N, r, p, salt, hash };
+}
+
+export async function hashPin(pin: string): Promise<string> {
+    validatePinFormat(pin);
+    const salt = randomBytes(SALT_LENGTH);
+    const derived = await scryptAsync(pepperPin(pin), salt, KEY_LENGTH, {
+        N: SCRYPT_N,
+        r: SCRYPT_R,
+        p: SCRYPT_P,
+        maxmem: SCRYPT_MAXMEM,
+    });
+    return `scrypt:${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt.toString("hex")}:${derived.toString("hex")}`;
+}
+
+export async function verifyPin(pin: string, storedHash: string): Promise<boolean> {
+    // Boolean contract: invalid candidate format → false, never a throw.
+    if (!PIN_PATTERN.test(pin)) {
+        return false;
+    }
+    const parsed = parseStoredHash(storedHash);
+    if (parsed === null) {
+        return false;
+    }
+    try {
+        const derived = await scryptAsync(pepperPin(pin), parsed.salt, parsed.hash.length, {
+            N: parsed.N,
+            r: parsed.r,
+            p: parsed.p,
+            maxmem: SCRYPT_MAXMEM,
+        });
+        // timingSafeEqual throws on length mismatch — pre-check by construction
+        // is guaranteed (keylen = parsed.hash.length), but guard anyway.
+        if (derived.length !== parsed.hash.length) {
+            return false;
+        }
+        return timingSafeEqual(derived, parsed.hash);
+    } catch {
+        // Any scrypt failure during verify (including over-budget params that
+        // slipped past parse) degrades to false — no throw, no OOM crash.
+        return false;
+    }
+}

Do not invoke any skill, and do not spawn subagents of your own — you are the reviewer. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.
