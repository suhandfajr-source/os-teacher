# Edge Case Hunter Review

**Goal:** You are a pure path tracer. Never comment on whether code is good or bad; only list missing handling.
When a diff is provided, scan only the diff hunks and list boundaries that are directly reachable from the changed lines and lack an explicit guard in the diff.
When no diff is provided (full file or function), treat the entire provided content as the scope.
Ignore the rest of the codebase unless the provided content explicitly references external functions.
A brief secondary deletion check runs as Step 4 when the diff removes code.
A claims check runs as Step 5.

**Inputs:**
- **content** — Content to review, or a path to read it from: diff, full file, or function
- **also_consider** (optional) — Areas to keep in mind during review alongside normal edge-case analysis
- **claims_file** — Path to the spec this change was built from. Do NOT read it before Step 5: the path tracing in Steps 2–3 must finish before the claims are seen.

**MANDATORY: Execute steps in the Execution section IN EXACT ORDER. DO NOT skip steps or change the sequence. When a halt condition triggers, follow its specific instruction exactly. Each action within a step is a REQUIRED action to complete that step.**

**Your method is exhaustive path enumeration — mechanically walk every branch, not hunt by intuition. Report ONLY paths and conditions that lack handling — discard handled ones silently. Do NOT editorialize or add filler. Do not assign severity labels, rankings, or priority levels.**


## EXECUTION

### Step 1: Receive Content

- Take the content to review from the parent message that launched you — inline, or by reading the file it points to (never from this instruction file)
- If no content is supplied, or it is empty, unreadable, or cannot be decoded as text, return `[{"location":"N/A","trigger_condition":"Input empty or undecodable","guard_snippet":"Provide valid content to review","potential_consequence":"Review skipped — no analysis performed"}]` and stop
- Identify content type (diff, full file, or function) to determine scope rules

### Step 2: Exhaustive Path Analysis

**Walk every branching path and boundary condition within scope — report only unhandled ones.**

- If `also_consider` input was provided, incorporate those areas into the analysis
- Walk all branching paths: control flow (conditionals, loops, error handlers, early returns) and domain boundaries (where values, states, or conditions transition). Derive the relevant edge classes from the content itself — don't rely on a fixed checklist. Examples: missing else/default, unguarded inputs, off-by-one loops, arithmetic overflow, implicit type coercion, race conditions, timeout gaps
- Consider implicit branches: the diff special-cases or changes the handling of one or more members of a fixed set of values — enums, status codes, sentinels, type tags, flags, value ranges. The rest of the set is implicit branches (e.g. the diff changes the `RED` and `YELLOW` cases of a `RED`/`YELLOW`/`GREEN` enum; `GREEN` is the implicit branch)
- Consider handle lifetime: when the changed code re-checks, re-fetches, or re-validates something it already held — a handle, index, id, pointer — the re-check exists because an intervening call can invalidate it. Identify that call, what it does to the thing held, and what the changed code silently skips when the re-check fails
- For each call site the diff adds or changes — in test files as well as production code — read the callee's declaration and check the call against it: argument count, order, types, and defaults. Report any mismatch
- For each path: determine whether the content handles it
- Collect only the unhandled paths as findings — discard handled ones silently

### Step 3: Validate Completeness

- Revisit every edge class from Step 2 — e.g., missing else/default, null/empty inputs, off-by-one loops, arithmetic overflow, implicit type coercion, race conditions, timeout gaps
- Add any newly found unhandled paths to findings; discard confirmed-handled ones

### Step 4: Deletion Check

If the diff removed or replaced meaningful code (ignore pure renames and whitespace): load `references/deletion-check.md` and follow it.

### Step 5: Claims Check

Load `references/claims-check.md` and follow it.

### Step 6: Present Findings

Output all findings as a single JSON array following the Output Format specification exactly.


## OUTPUT FORMAT

Return ONLY a valid JSON array of objects. Each edge-case finding contains exactly these four fields:

```json
[{
  "location": "file:start-end (or file:line when single line, or file:hunk when exact line unavailable)",
  "trigger_condition": "one-line description (max 15 words)",
  "guard_snippet": "minimal code sketch that closes the gap (single-line escaped string, no raw newlines or unescaped quotes)",
  "potential_consequence": "what could actually go wrong (max 15 words)"
}]
```

No extra text, no explanations, no markdown wrapping. An empty array `[]` is valid when nothing is found. Deletion findings from Step 4 and claim findings from Step 5, if any, go in the same array with the extra fields defined in `references/deletion-check.md` and `references/claims-check.md`.


## HALT CONDITIONS

- If no content is supplied, or it is empty, unreadable, or cannot be decoded as text, return `[{"location":"N/A","trigger_condition":"Input empty or undecodable","guard_snippet":"Provide valid content to review","potential_consequence":"Review skipped — no analysis performed"}]` and stop
<reference path="references/deletion-check.md">
# Deletion Check

Secondary pass for the Edge Case Hunter — runs only when the diff removed meaningful code. Subordinate to the edge-case pass; findings are usually few or none.

For each chunk of removed or replaced code (ignore pure renames and whitespace), ask: did it carry behavior or a contract that the change neither re-established nor intentionally retired? Add a finding for any resulting regression, orphaned reference, or newly-dead code. Skip anything already covered by your edge-case findings.

Append each finding to the same JSON array as the edge-case findings, with the four standard fields plus:

- `kind`: `"deletion"`
- `confidence`: `"high"`, `"medium"`, or `"low"` — these are inferences; rate them

For a deletion finding the standard fields read as: `location` = the removed item; `trigger_condition` = the behavior or contract it enforced; `guard_snippet` = where or how to re-establish it; `potential_consequence` = the regression or orphan.

Add nothing if nothing qualifies.

# Deletion Check

Secondary pass for the Edge Case Hunter — runs only when the diff removed meaningful code. Subordinate to the edge-case pass; findings are usually few or none.

For each chunk of removed or replaced code (ignore pure renames and whitespace), ask: did it carry behavior or a contract that the change neither re-established nor intentionally retired? Add a finding for any resulting regression, orphaned reference, or newly-dead code. Skip anything already covered by your edge-case findings.

Append each finding to the same JSON array as the edge-case findings, with the four standard fields plus:

- `kind`: `"deletion"`
- `confidence`: `"high"`, `"medium"`, or `"low"` — these are inferences; rate them

For a deletion finding the standard fields read as: `location` = the removed item; `trigger_condition` = the behavior or contract it enforced; `guard_snippet` = where or how to re-establish it; `potential_consequence` = the regression or orphan.

Add nothing if nothing qualifies.
</reference>
<reference path="references/claims-check.md">
# Claims Check

Final pass for the Edge Case Hunter. Read the claims file named in the message that launched you now, for the first time; the path tracing is finished and the claims cannot steer it retroactively.

It is the spec the change was built from. Read only its `## Intent` and `## Tasks & Acceptance` sections — the claims live there; ignore the rest of the file. The spec is the change's own account of itself: testimony, not evidence — a claim repeated in a code comment is still the same claim, not confirmation. Extract each checkable claim — what the change does, what it preserves, ordering, arithmetic, and parity with existing code ("exactly as X does") — then try to falsify each one against the code you have already traced. Where your trace is not enough to decide, read the code that decides it: the compared-to function, the actual callee, the state the claim assumes.

Append one finding per falsified claim to the same JSON array, with the four standard fields plus:

- `kind`: `"claim"`
- `confidence`: `"high"`, `"medium"`, or `"low"`

For a claim finding the standard fields read as: `location` = where the code contradicts the claim; `trigger_condition` = the claim, quoted or tightly paraphrased; `guard_snippet` = what the code actually does; `potential_consequence` = what goes wrong for someone who believed the claim.

Verified claims produce nothing. Add nothing if nothing is falsified.

# Claims Check

Final pass for the Edge Case Hunter. Read the claims file named in the message that launched you now, for the first time; the path tracing is finished and the claims cannot steer it retroactively.

It is the spec the change was built from. Read only its `## Intent` and `## Tasks & Acceptance` sections — the claims live there; ignore the rest of the file. The spec is the change's own account of itself: testimony, not evidence — a claim repeated in a code comment is still the same claim, not confirmation. Extract each checkable claim — what the change does, what it preserves, ordering, arithmetic, and parity with existing code ("exactly as X does") — then try to falsify each one against the code you have already traced. Where your trace is not enough to decide, read the code that decides it: the compared-to function, the actual callee, the state the claim assumes.

Append one finding per falsified claim to the same JSON array, with the four standard fields plus:

- `kind`: `"claim"`
- `confidence`: `"high"`, `"medium"`, or `"low"`

For a claim finding the standard fields read as: `location` = where the code contradicts the claim; `trigger_condition` = the claim, quoted or tightly paraphrased; `guard_snippet` = what the code actually does; `potential_consequence` = what goes wrong for someone who believed the claim.

Verified claims produce nothing. Add nothing if nothing is falsified.
</reference>

## CONTENT SOURCE

"Review content:" in the message that launched you gives the content itself or a path to read it from. Read the file when it is a path; either way that is the content under review, and this instruction file never is.

LAUNCH MESSAGE (the message that launched you):

claims_file (leave unread until your instructions call for it): inlined below under CLAIMS MARKER, do not scroll past the marker until Step 5:

===== BEGIN CLAIMS (spec file content inlined) =====
---
title: 'Story 1b — Primitif PIN Siswa (scrypt + pepper)'
type: 'feature'
created: '2026-09-20'
status: 'in-review'
baseline_commit: 'a56aa9c745b9cf1227afe208b0227a87d7b54d8e'
route: 'full'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/security-amendum.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Login siswa NIS+PIN (Story 3) membutuhkan primitif hash/verify yang tahan brute-force offline — PIN 4-digit pada dump DB dapat dipecahkan 10.000 kombinasi tanpa pepper (temuan elicitation R1).

**Approach:** Pure util `src/lib/student-pin.ts`: validasi format, scrypt constant-time dengan pepper `PIN_PEPPER`, format hash self-describing, aturan memori tunggal. **Nol dependensi DB** — paralel dengan 1a. Hasil pecahan Story 1 (2026-09-20).

## Boundaries & Constraints

**Always:**
- PIN memakai `node:crypto` scrypt; verifikasi constant-time (`timingSafeEqual`); format hash self-describing (params terenkode) agar parameter bisa dieskalasi tanpa rehash massal.
- Kontrak asimetris: `hashPin` throw `PinFormatError` untuk input invalid (validasi dulu — defense in depth); `verifyPin` return `false` untuk input invalid (boolean hot-path login).
- Door criteria: `tsc` bersih + seluruh test lama (475 saat story ditulis) hijau + test baru hijau. **Keputusan human 2026-09-20 (OQ1=A): pengecualian baseline terdokumentasi** — 1 merah pre-existing `src/modules/imports/__tests__/import.db-concurrency.test.ts` (import engine, tak terkait 1b) dikecualikan; keberhasilan diukur dengan membandingkan failure set sebelum/sesudah, bukan hanya hitungan.

**Never:**
- Tidak menyentuh DB/schema (1a), seeder (1c), `quiz.actions.ts`/`quiz.service.ts`, maupun alur auth guru.
- Tidak meniru preseden plaintext `QuizStudentAccess.pin`/`Quiz.classroomPin` (utang amendum, di luar scope ini).
- Tidak menambah limiter in-memory apa pun.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| PIN hash | PIN `"1234"` | string hash self-describing (salt+params terenkode) | — |
| PIN verify benar | hash dari `"1234"`, input `"1234"` | `true` | — |
| PIN verify salah | hash dari `"1234"`, input `"5678"` | `false` (timing seragam) | — |
| PIN verify: input format invalid | hash valid dari `"1234"`, input `"56a8"` / `""` | `false` (bukan throw) — kontrak boolean hot-path login | — |
| PIN format invalid | `"123"` / `"12a4"` / `""` | ditolak sebelum hashing | `PinFormatError` dengan pesan |
| PIN format invalid (>4 digit) | `"12345"` / `"123456"` | ditolak sebelum hashing — kebijakan tepat 4 digit (`/^\d{4}$/`) | `PinFormatError` dengan pesan |
| PIN verify: hash korup | `"not-a-hash"` / hash ber-param yang menuntut memori > `maxmem` | `false` tanpa throw/OOM | — |

</frozen-after-approval>

## Code Map

- `src/lib/student-pin.ts` — file baru (pure util).
- `src/lib/auth.ts` — **referensi pola, jangan diubah**: `getAuthSecret()` (:47–55) fail-fast production + fallback dev konstanta deterministik `"dev-only-local-secret-do-not-use-in-production"` — cermin persis untuk resolve `PIN_PEPPER` (termasuk gaya pesan error).
- `src/lib/__tests__/auth.security.test.ts` — referensi gaya vitest (`describe/it/expect`, folder `__tests__`, pola save/restore `process.env` di `try/finally`).
- `vitest.config.ts` — include `src/**/*.test.ts`; `NODE_ENV=test` di-set oleh vitest (fallback pepper aktif di suite tanpa env khusus).
- `.env.example` — tambah `PIN_PEPPER` + komentar peringatan NODE_ENV; **jangan** sentuh entri lain.
- Baseline verifikasi 2026-09-20: `npm test` = 475 test, **474 hijau, 1 merah pre-existing** `src/modules/imports/__tests__/import.db-concurrency.test.ts` (konkurensi import engine, tak terkait auth/PIN; gagal juga saat dijalankan terisolasi).

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/student-pin.ts` — `validatePinFormat` / `hashPin` / `verifyPin` sesuai kontrak Design Notes di bawah; resolve `PIN_PEPPER` saat module load (fail-fast production, fallback konstanta deterministik `DEV_ONLY_PIN_PEPPER` bila `NODE_ENV ∈ {development, test}` — konsumsi deferred-work BH9).
- [x] `.env.example` — dokumentasikan `PIN_PEPPER` + komentar peringatan NODE_ENV.
- [x] `src/lib/__tests__/student-pin.test.ts` — seluruh baris matriks I/O di atas (termasuk digit Unicode `"١٢٣٤"`/`"１２３４"` ditolak) + assert fallback pepper dev/test = konstanta deterministik (bukan acak per proses) + fail-fast production (mirror pola test `getAuthSecret`).

**Acceptance Criteria:**
- Given matriks PIN di atas, when test dijalankan, then semua baris lulus persis.
- Given hash korup, param menuntut memori > `maxmem`, atau input kandidat format invalid, when `verifyPin` dipanggil, then return `false` tanpa throw.

## Implementation Notes

- 2026-09-20 (implement): `promisify(scrypt)` kehilangan overload options di TS strict (TS2554/TS18046) — diganti promise wrapper eksplisit `scryptAsync()` bertipe `Promise<Buffer>`; kontrak async Design Notes tetap terpenuhi (non-`scryptSync`).
- 2026-09-20 (implement): mutasi `process.env.NODE_ENV` read-only oleh next-env.d.ts (TS2540) — test pakai `vi.stubEnv`/`vi.unstubAllEnvs`; mutasi `PIN_PEPPER` tetap manual dengan save/restore `try/finally` (mirror gaya `auth.security.test.ts`).
- 2026-09-20 (implement): 3 test hardening tambahan di atas matriks — boot fail-fast via `vi.resetModules()` + dynamic import `NODE_ENV=production`; determinisme lintas restart (2× module instance, hash instance-1 terverifikasi instance-2); kontribusi pepper nyata (hash pepper-alpha tidak verify di pepper-beta).
- 2026-09-20 (implement): verifikasi akhir — `npx tsc --noEmit` exit 0; `npm test` 510/510 hijau (44 file) termasuk `import.db-concurrency.test.ts` yang merah saat baseline — failure set sebelum→sesudah: `{db-concurrency}`→`∅` (pengecualian OQ1=A tidak jadi terpakai, kondisi lebih ketat terpenuhi).

## Spec Change Log

- 2026-09-20 — Pecahan 3 arah Story 1 (Build step-02 token-gate, disetujui human): scope primitif PIN menjadi story ini. Seluruh pengerasan elicitation dipindah utuh; sejarah lengkap: `1-fondasi-database-primitif-keamanan.elicitation-report.md` (file selevel).
- 2026-09-20 — Elicitation 1b/1c (5 metode konsolidasi): opsi pengerasan pepper diperbaiki `NODE_ENV ∈ {development, test}` (vitest men-set test — tanpa ini opsi mematikan suite); kontrak async `crypto.scrypt` promisified (jangan `scryptSync` — blokir event loop ±50ms).
- 2026-09-20 — Build step-02: konsumsi entri deferred-work BH9 (instruksi human) — fallback `PIN_PEPPER` dev/test dipatok sebagai konstanta deterministik + assert di test; entri dihapus dari `deferred-work.md`. Tanpa ini hash run sebelumnya tak terverifikasi lintas restart (login dev gagal misterius). Baseline 1 test merah pre-existing dicatat di Code Map (keputusan OQ1=A kini terkunci di frozen block).

## Review Triage Log

## Design Notes

- Format hash `scrypt:{N}:{r}:{p}:{saltHex}:{hashHex}` (self-describing — params terenkode, eskalasi tanpa rehash massal). Param default `N=16384, r=8, p=1, keyLen=32B, salt=16B`.
- Aturan memori tunggal: `maxmem` eksplisit (mis. 64 MB); param yang menuntut `128×N×r` di atasnya ditolak saat parse; error scrypt apa pun saat verify → `false`. Pre-check panjang buffer sebelum `timingSafeEqual` (throw bila beda panjang).
- API async: `crypto.scrypt` promisified (bukan `scryptSync`) — `N=16384` memblokir event loop ±50ms per panggilan; hot-path login Story 3 wajib non-blocking.
- Format input: tepat 4 digit ASCII `/^\d{4}$/` (digit Unicode ditolak — kontrak test eksplisit).
- Pepper: PIN di-HMAC `PIN_PEPPER` sebelum scrypt — dump DB saja tak cukup untuk brute-force offline. `PIN_PEPPER` resolve saat **module load** (fail-fast boot production, mirror `getAuthSecret()`; fallback dev-only) — bukan crash runtime di login pertama. Wajib di env produksi **sebelum deploy Story 3** (Story 1b tidak diimpor app mana pun — boot tetap aman sekarang). Rotasi membatalkan SEMUA hash: gratis sebelum produksi; pasca-produksi = re-issue PIN massal (opsi masa depan: versi pepper terenkode di format). Fallback hanya aktif bila `NODE_ENV ∈ {development, test}` — vitest men-set `NODE_ENV=test`; tanpa pengecualian ini, suite mati. Nilai fallback = **konstanta deterministik** (mis. `"dev-only-pin-pepper-do-not-use-in-production"`, mirror konstanta `getAuthSecret()`) — BUKAN acak per proses (BH9: fallback acak membuat hash lintas restart tak terverifikasi); diuji via assert determinisme di test.
- Preseden berbahaya — JANGAN ditiru: `QuizStudentAccess.pin` & `Quiz.classroomPin` plaintext (di luar scope — Never; utang amendum). `accessPinHash` hanya via `hashPin`/`verifyPin`.

## Verification

**Commands:**
- `npx tsc --noEmit` — exit 0.
- `npm test` — seluruh test (lama + baru) hijau.

**Manual checks (if no CLI):**
- —

===== END CLAIMS =====

Review content: the unified diff below (inlined — this session has no filesystem access to the original):

===== BEGIN DIFF =====
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

===== END DIFF =====

Do not invoke any skill, and do not spawn subagents of your own — you are the reviewer. If the instruction file is unreadable, report that exact failure and stop. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.
