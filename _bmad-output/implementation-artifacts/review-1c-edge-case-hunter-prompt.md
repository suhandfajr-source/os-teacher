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
title: 'Story 1c — Allowlist & Seeder Superadmin'
type: 'feature'
created: '2026-09-20'
status: 'in-review'
baseline_commit: '02aad37470b9567241e2f6f2a5fb3ce1f0804fce'
route: 'full'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/security-amendum.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Platform butuh backstop superadmin (reset password, ban, force approve — Story 5) tetapi tidak boleh ada jalur registrasi menjadi admin; registrasi Better Auth yang terbuka membuat email allowlist bisa diperebutkan (elicitasi RT1).

**Approach:** Parser allowlist pure + seeder CLI idempotent dari env `SUPERADMIN_EMAILS`: validasi menyeluruh → transaksi all-or-nothing → `AuditLog` per aksi. **Prasyarat: Story 1a merged** (kolom `platformRole` + tabel `AuditLog`). Hasil pecahan Story 1 (2026-09-20).

## Boundaries & Constraints

**Always:**
- Superadmin HANYA lahir dari env `SUPERADMIN_EMAILS` (allowlist, dipisah koma); idempotent (re-run aman); setiap aksi tercatat `AuditLog`.
- Validasi semua email dulu → **all-or-nothing** dalam satu transaksi; email dinormalisasi (trim+lowercase) sebelum match (`@@unique([email])` Postgres case-sensitive).
- Anti perebutan email: cek `emailVerified` — belum verified → abort default dengan profil user di laporan; `--allow-unverified` melewati secara sadar (repo belum mengonfigurasi email verification — semua user `emailVerified=false`).
- Door criteria: `tsc` bersih + seluruh test lama (475 saat story ditulis) hijau + test baru hijau.

**Never:**
- Tidak mengubah schema (1a), primitif PIN (1b), `src/lib/auth.ts`, maupun alur auth guru.
- Tidak menjalankan `migrate dev` pada DB mana pun di repo ini hingga migrasi rekonsiliasi drift (deferred-work) lunas — tuntutan RESET destruktif; produksi hanya via `prisma migrate deploy`; jangan `db push` ke Neon.
- Tidak menambah limiter in-memory apa pun.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Seeder: allowlist berisi email user | `SUPERADMIN_EMAILS="a@b.c"` | `platformRole="ADMIN"` + entri `AuditLog` | — |
| Seeder: env kosong/whitespace/unset | `SUPERADMIN_EMAILS=""` / undefined | exit non-zero, DB tak tersentuh | pesan fail-fast jelas |
| Seeder: entri bukan email valid | `"not-an-email"` di allowlist | ditolak saat parse (sebelum DB disentuh), exit non-zero | daftar entri invalid dicetak |
| Seeder: email tidak dikenal | email tanpa row `User` | validasi semua dulu → DB tak tersentuh (all-or-nothing), laporan lengkap di stdout, exit non-zero | daftar email gagal dicetak |
| Seeder: email campuran case | `"Admin@Sekolah.ID"` vs DB `admin@sekolah.id` | dinormalisasi (trim+lowercase) sebelum match → ditemukan | — |
| Seeder: email belum verified | user allowlist `emailVerified=false` | abort default + profil user di laporan (anti perebutan email); `--allow-unverified` melewati sadar | pesan eksplisit profil & opsi |

</frozen-after-approval>

## Code Map

- `src/lib/superadmin-allowlist.ts` — file baru: parser pure `parseSuperadminEmails(env)`.
- `src/lib/superadmin-seeder.ts` — file baru: logika inti seeder (validasi → rencana → apply dalam transaksi) sebagai modul teruji; CLI tetap tipis.
- `scripts/seed-superadmin.ts` — file baru (CLI tipis: env, init Pool+PrismaPg ala `src/lib/auth.ts`:5,:23,:27, exit code, shutdown); jalankan via `npm run seed:superadmin`.
- `src/lib/audit-metadata.ts` — file baru (BH6): `redactMetadata()` — helper redaksi untuk SEMUA penulis AuditLog berikutnya (Stories 3–5).
- `src/lib/auth.ts` — **referensi pola, jangan diubah**: pg Pool + `PrismaPg` (:5,:23), `PrismaClient` init (:27).
- `src/lib/__tests__/auth.security.test.ts` — referensi gaya vitest.
- `vitest.config.ts` — include `src/**/*.test.ts` + `src/**/*.spec.ts` (exclude `tests/**` = Playwright) — test integrasi seeder (BH12) wajib tinggal di bawah `src/` (dipilih `src/lib/__tests__/`; alasan pemisahan `superadmin-seeder.ts`). Referensi pola guard: `src/modules/imports/__tests__/import.db-concurrency.test.ts` — flag `dbAvailable` di-set dari try/catch `beforeAll`, bukan skipIf.
- **BH8 terpecahkan (baca better-auth 1.6.29 langsung)**: `sign-up.mjs:165,222` — `normalizedEmail = email.toLowerCase()` untuk lookup DAN `createUser` → registrasi selalu simpan lowercase; seeder tetap pakai `mode: "insensitive"` (pengaman row non-better-auth).
- `package.json` — tambah `tsx` devDependency + script `"seed:superadmin": "tsx --env-file-if-exists=.env scripts/seed-superadmin.ts"` (tsx **tidak memuat `.env` otomatis**; manifest memang tanpa dotenv — namun `vitest.config.ts:1` memuat `.env` via dotenv **transitive/phantom** (`prisma→c12`, `shadcn→dotenvx`), sehingga test integrasi mewarisi `DATABASE_URL` tanpa plumbing env; untuk CLI, tanpa `--env-file-if-exists` seeder selalu fail-fast palsu).
- `.env.example` — tambah blok `SUPERADMIN_EMAILS` dengan komentar; **jangan** sentuh entri lain (`PIN_PEPPER` milik 1b).
- Baseline 2026-09-20 pasca-1b: 520/520 hijau, `tsc` bersih. "Test lama hijau" mengikuti presedepun OQ1=A 1b (failure-set comparison; flake dikenal `import.db-concurrency.test.ts`).

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/superadmin-allowlist.ts` — parser pure sesuai Design Notes (Parser).
- [x] `src/lib/audit-metadata.ts` — `redactMetadata()` sesuai kontrak Design Notes (BH6).
- [x] `src/lib/superadmin-seeder.ts` — inti seeder sesuai Design Notes (Seeder): validasi → rencana (termasuk laporan drift ADMIN-not-in-allowlist, BH7) → apply all-or-nothing + audit ter-redaksi + lookup insensitive (BH8).
- [x] `scripts/seed-superadmin.ts` — CLI tipis (env → parser → inti → exit code; `--dry-run`, `--allow-unverified` pass-through).
- [x] `package.json` — `tsx` devDependency + script `seed:superadmin` (dengan `--env-file-if-exists=.env` — lihat Code Map).
- [x] `.env.example` — dokumentasikan `SUPERADMIN_EMAILS`.
- [x] `src/lib/__tests__/superadmin-allowlist.test.ts` — seluruh baris parser seeder pada matriks I/O (env kosong/whitespace/unset, duplikat, campuran case, koma ganda/`,,,`, entri non-email) + unit `redactMetadata()` (BH6).
- [x] `src/lib/__tests__/superadmin-seeder.int.test.ts` — integrasi DB nyata (DATABASE_URL, ala `import.db-concurrency.test.ts`): idempotensi run 2× → 0 entri audit baru; email tak dikenal → rollback, nol row berubah; mixed-case stored row ditemukan via insensitive lookup; cleanup mandiri (BH12+BH8).

**Acceptance Criteria:**
- Given `SUPERADMIN_EMAILS` kosong/unset, when seeder dijalankan, then exit non-zero dan nol row berubah.
- Given allowlist berisi email tak dikenal atau entri non-valid, when seeder dijalankan, then nol row berubah (all-or-nothing), exit non-zero, laporan lengkap.
- Given email allowlist valid, when seeder dijalankan ulang, then idempotent (tanpa duplikat entri audit untuk state sama) — diverifikasi otomatis via test integrasi (BH12), bukan manual saja.
- Given ada user `platformRole="ADMIN"` yang emailnya tak ada di allowlist, when seeder berjalan, then laporan drift tercetak (warning) dan TIDAK ada demosi otomatis (BH7).

## Implementation Notes

- **Urutan commit (alternatif split story — split DITOLAK):** pipeline sekuensial per `stories.yaml` ("Urutan = urutan list") membuat lane paralel tak bernilai; granularitas review didapat lewat urutan commit: **commit 1** = primitif murni (`audit-metadata.ts` + `superadmin-allowlist.ts` + unit test) → **commit 2** = core seeder (`superadmin-seeder.ts` + test integrasi) → **commit 3** = CLI + `package.json` + `.env.example`. Frozen tak tersentuh; tanpa biaya story baru.
- 2026-09-20 (implement stage 1): regex validator dipatok + tolak karakter kutip — regex F6 asli (`[^\s@]`) ternyata MELULUSKAN `"a@b.c"` (kutip bukan spasi/@), kontradiktif dgn fail-fast-berkutip; diperketat ke `[^\s@'"]` (kontrak F6 dipertahankan, redaksinya dipatok). Cycle-guard redactMetadata: objek top-level kini masuk `seen` sejak awal (back-reference langsung langsung dibuang).
- 2026-09-20 (implement stage 2): test integrasi memakai email unik per pembuatan (konstanta email lintas test → pelanggaran `@@unique` intra-run); `afterAll` TIDAK memanggil `$disconnect()` pada singleton `prisma` dari `@/lib/auth` — pola referensi import.db-concurrency juga tidak, dan disconnect bisa mematikan file test berikutnya di worker sama.
- 2026-09-20 (implement stage 3): top-level await tak didukung tsx (CJS) — CLI membungkus `main().then(code => process.exitCode = code)`; C1 terbukti: `--env-file-if-exists=.env` via tsx memuat `DATABASE_URL` (dry-run ke Neon sukses). **Apply nyata CLI sengaja TIDAK dijalankan** saat verifikasi: `.env` menunjuk Neon dev bersama (bukan "DB lokal" peringatan Verification) — promosi user nyata = aksi operator; semantik apply dibuktikan test integrasi. Insiden: Neon sempat cold-start/unreachable (probe timeout) → 1 run suite merah environmental (4 file), pulih otomatis setelah wake; bukan regresi kode.
- 2026-09-20 (verifikasi akhir): `tsc` exit 0, eslint bersih; `npm test` **551/551 hijau (46 file)** termasuk `import.db-concurrency` (flake-nya environmental Neon cold-start — kini terkonfirmasi); CLI: no-env exit 1, invalid-entry exit 1 + daftar tercetak, dry-run exit 0 + identitas DB + rencana ber-profil + nol row. DB diperiksa pasca-test: 0 row test yatim, 0 audit sisa.

## Spec Change Log

- 2026-09-20 — Pecahan 3 arah Story 1 (Build step-02 token-gate, disetujui human): scope allowlist+seeder menjadi story ini. Seluruh pengerasan elicitation dipindah utuh; sejarah lengkap: `1-fondasi-database-primitif-keamanan.elicitation-report.md` (file selevel).
- 2026-09-20 — Elicitation 1a (lintas story): koreksi typo frozen Never "`migrate migrate deploy`" → "`prisma migrate deploy`" (disetujui human).
- 2026-09-20 — Elicitation 1b/1c (5 metode konsolidasi): script seeder → `tsx --env-file-if-exists=.env ...` (tsx tak memuat .env otomatis — repo tanpa dotenv; C1 kritis); shutdown eksplisit `pool.end()`/`process.exit` + audit hanya saat perubahan state.
- 2026-09-20 — Build step-02 (persiapan 1c): konsumsi 4 entri deferred-work review 1a yang menarget spec ini — BH6 `redactMetadata()`+test, BH7 semantik penyusutan (laporan drift tiap run, tanpa demosi otomatis), BH8 invariant lowercase terpecahkan dengan membaca better-auth 1.6.29 langsung (sign-up.mjs:165,222 — `normalizedEmail` lowercase di lookup DAN createUser; lookup insensitive tetap dipasang), BH12 test integrasi seeder (idempotensi + rollback) via pemisahan inti ke `src/lib/superadmin-seeder.ts`. Interpretasi door criteria "test lama" mengikuti presedepun OQ1=A 1b (failure-set comparison; baseline kini 520/520).
- 2026-09-20 — Elicitation menyeluruh 1c (pass terkonsolidasi 13 metode, ground-truth repo; nol temuan 🔴): (F1) koreksi premis dotenv — `vitest.config.ts:1` memuat `.env` via dotenv transitive/phantom sehingga test integrasi mewarisi `DATABASE_URL` tanpa plumbing (fix C1 tetap benar untuk CLI); (F2) shutdown `process.exitCode` + drain alami menggantikan hard `process.exit` (anti truncation stdout ter-pipe); (F4) batas transaksi dipatok — lookup+update+audit dalam SATU interactive tx + timeout eksplisit, edge concurrent-run diterima sadar; (F3) penguatan RT1 — laporan plan/drift menambah sinyal akun (platformRole, TeacherProfile) + audit metadata mencatat `allowUnverified:true` saat bypass; (F6) kontrak parser eksplisit (collect-all invalid, `{emails, invalid}`, validator dipatok, env berkutip = fail-fast); (F7) referensi test dikoreksi ke path asli `src/modules/imports/__tests__/import.db-concurrency.test.ts` + pola guard `dbAvailable`; (F8) catatan verifikasi C1 — dibuktikan run env-valid, fallback `node --import tsx`; (F5) split ditolak — diganti urutan commit 3 tahap (Implementation Notes). Semua perubahan non-frozen. Laporan lengkap: `1c-allowlist-seeder-superadmin.elicitation-report.md` (file selevel).

## Review Triage Log

## Design Notes

**Parser:**
- `parseSuperadminEmails(env)`: trim, lowercase, dedupe, validasi sintaks email (entri invalid ditolak saat parse), deteksi kosong (termasuk unset dan `,,,`).
- Kontrak eksplisit: **kumpulkan SEMUA entri invalid** lalu laporkan sekaligus (bukan fail-on-first) — return `{ emails: string[]; invalid: string[] }`; validator sintaks dipatok di story ini (regex sederhana ala `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` memadai — kontrak, bukan implementasi bebas); nilai env berkutip (mis. `"a@b.c"` dari CI YAML) gagal validasi → fail-fast terdokumentasi.

**Seeder:**
- Validasi semua email dulu → **all-or-nothing**: lookup user (termasuk cek `emailVerified` dan drift) + UPDATE + insert `AuditLog` dijalankan dalam **SATU interactive transaction** dengan timeout eksplisit (default Prisma 5 detik — jangan diandalkan) (pg Pool + PrismaPg ala `src/lib/auth.ts`); `AuditLog` per aksi (`actorType="SYSTEM"`, metadata bebas secret); idempotent. Edge diterima sadar: dua seeder paralel bisa menghasilkan entri audit duplikat (state tetap konsisten) — tidak perlu advisory lock.
- Anti perebutan email (RT1): cek `emailVerified` + cetak profil user (nama, emailVerified, createdAt, **platformRole saat ini, keberadaan TeacherProfile** — sinyal akun untuk penilaian operator) di rencana — operator bisa konfirmasi pemilik sah. Karena semua user saat ini `emailVerified=false`, gerbang ini inert dalam praktik (tiap run nyata wajib `--allow-unverified`): saat flag dipakai, **audit metadata wajib mencatat `allowUnverified: true`** dan stdout mencetak warning eksplisit (jejak forensik + anti-habituation).
- `--dry-run` mencetak rencana tanpa menulis; output selalu mencantumkan identitas DB target (host+dbname) sebelum apply (blast-radius wrong-DB).
- Shutdown di akhir script: `await pool.end()` (+ `prisma.$disconnect()`) lalu set **`process.exitCode = code`** dan biarkan event loop drain alami — hard `process.exit(code)` berisiko **memotong stdout yang di-pipe** (laporan adalah deliverable inti; Windows/CI rawan) dan hanya menjadi fallback bila loop masih hidup setelah drain. Pool memang menjaga event loop (tanpa `pool.end()` → CI timeout). Audit hanya ditulis saat perubahan state nyata (no-op re-run = nol entri).
- Lookup email `mode: "insensitive"` atas nilai ternormalisasi (BH8: jalur registrasi better-auth 1.6.29 terbukti selalu lowercase — sign-up.mjs:165,222; insensitive melindungi dari row yang ditulis di luar better-auth).
- Semantik penyusutan allowlist (BH7): seeder TIDAK PERNAH mendemosi; setiap run melaporkan drift — user `platformRole="ADMIN"` yang emailnya ∉ allowlist — sebagai warning berikut profilnya; demosi hanya via keputusan eksplisit masa depan (opsi `--demote`, di luar scope 1c).
- Struktur modul: inti di `src/lib/superadmin-seeder.ts` (dapat diuji), `scripts/seed-superadmin.ts` hanya CLI — vitest mengambil `src/**/*.test.ts` + `src/**/*.spec.ts` (bukan `tests/**`) sehingga test integrasi (BH12) harus tinggal di bawah `src/` — dipilih `src/lib/__tests__/`.
- Jalur seeder hanya untuk DB lokal; produksi via `prisma migrate deploy`; bila shadow DB gagal → `scripts/create-shadow-db.js`; jangan `db push`.

**Redaksi metadata (BH6):**
- `redactMetadata(input: Record<string, unknown>): Record<string, unknown>` — salinan dalam; key yang match pola denylist case-insensitive (`pin`, `password`, `secret`, `token`, `hash`, `pepper`, `authorization`, `cookie`) → `"[REDACTED]"` (nilai apa pun); nilai non-JSON-safe (function/symbol/undefined/bigint) dibuang; string dipotong ke 256 char; guard kedalaman/siklus. Kontrak inti: output selalu aman dimasukkan ke `AuditLog.metadata`.

## Verification

**Commands:**
- `npx tsc --noEmit` — exit 0.
- `npm test` — seluruh test (lama + baru) hijau.
- `npm run seed:superadmin` (tanpa env) — fail-fast non-zero dengan pesan allowlist. Catatan C1: run ini tak membuktikan apa pun tentang flag `--env-file-if-exists` (env memang absen) — yang membuktikannya adalah run env-valid di bawah; bila tsx ternyata tak meneruskan flag node ke runtime, fallback: `node --env-file-if-exists=.env --import tsx scripts/seed-superadmin.ts`.
- `npm run seed:superadmin -- --dry-run` (env valid) — rencana + identitas DB target, nol row berubah.
- `npm run seed:superadmin` (env valid, 2×) — idempotent; run kedua tanpa entri audit baru. ⚠️ DB lokal saja.

**Manual checks:**
- Pasca-seeder: satu alur login guru; `platformRole="ADMIN"` tidak ter-reset oleh update user Better Auth.

===== END CLAIMS =====

Review content: the unified diff below (inlined — this session has no filesystem access to the original):

===== BEGIN DIFF =====
diff --git a/.env.example b/.env.example
index be38653..58c9c56 100644
--- a/.env.example
+++ b/.env.example
@@ -15,6 +15,15 @@ GEMINI_API_KEY=
 # test fall back to a deterministic constant when unset.
 PIN_PEPPER=
 
+# --- Superadmin allowlist (platform backstop) ---
+# Comma-separated emails promoted to platformRole=ADMIN by:
+#   npm run seed:superadmin
+# Registration can NEVER grant ADMIN — only this env. Idempotent; every
+# promotion writes an AuditLog entry. Removing an email does NOT demote the
+# user (the seeder reports the drift as a warning); demotion stays a manual,
+# deliberate decision. Local DB only.
+SUPERADMIN_EMAILS=
+
 # --- AI Slide Illustration (optional, requires Gemini paid tier) ---
 # Uncomment to enable AI image generation for key presentation slides.
 # Without it, exports fall back to the themed illustration panel.
diff --git a/_bmad-output/specs/spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md b/_bmad-output/specs/spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md
index 24c5a19..611466c 100644
--- a/_bmad-output/specs/spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md
+++ b/_bmad-output/specs/spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md
@@ -2,7 +2,8 @@
 title: 'Story 1c — Allowlist & Seeder Superadmin'
 type: 'feature'
 created: '2026-09-20'
-status: 'draft'
+status: 'in-review'
+baseline_commit: '02aad37470b9567241e2f6f2a5fb3ce1f0804fce'
 route: 'full'
 review_loop_iteration: 0
 context:
@@ -47,33 +48,50 @@ context:
 ## Code Map
 
 - `src/lib/superadmin-allowlist.ts` — file baru: parser pure `parseSuperadminEmails(env)`.
-- `scripts/seed-superadmin.ts` — file baru; jalankan via `npm run seed:superadmin`.
-- `package.json` — tambah `tsx` devDependency + script `"seed:superadmin": "tsx --env-file-if-exists=.env scripts/seed-superadmin.ts"` (tsx belum terpasang; tsx **tidak memuat `.env` otomatis** — repo tanpa dotenv; tanpa `--env-file-if-exists` seeder selalu fail-fast palsu).
-- `src/lib/auth.ts` — **referensi pola, jangan diubah**: pg Pool + `PrismaPg` (:5,:23), `PrismaClient` init (:27). Seeder mengikuti pola init client ini.
+- `src/lib/superadmin-seeder.ts` — file baru: logika inti seeder (validasi → rencana → apply dalam transaksi) sebagai modul teruji; CLI tetap tipis.
+- `scripts/seed-superadmin.ts` — file baru (CLI tipis: env, init Pool+PrismaPg ala `src/lib/auth.ts`:5,:23,:27, exit code, shutdown); jalankan via `npm run seed:superadmin`.
+- `src/lib/audit-metadata.ts` — file baru (BH6): `redactMetadata()` — helper redaksi untuk SEMUA penulis AuditLog berikutnya (Stories 3–5).
+- `src/lib/auth.ts` — **referensi pola, jangan diubah**: pg Pool + `PrismaPg` (:5,:23), `PrismaClient` init (:27).
 - `src/lib/__tests__/auth.security.test.ts` — referensi gaya vitest.
+- `vitest.config.ts` — include `src/**/*.test.ts` + `src/**/*.spec.ts` (exclude `tests/**` = Playwright) — test integrasi seeder (BH12) wajib tinggal di bawah `src/` (dipilih `src/lib/__tests__/`; alasan pemisahan `superadmin-seeder.ts`). Referensi pola guard: `src/modules/imports/__tests__/import.db-concurrency.test.ts` — flag `dbAvailable` di-set dari try/catch `beforeAll`, bukan skipIf.
+- **BH8 terpecahkan (baca better-auth 1.6.29 langsung)**: `sign-up.mjs:165,222` — `normalizedEmail = email.toLowerCase()` untuk lookup DAN `createUser` → registrasi selalu simpan lowercase; seeder tetap pakai `mode: "insensitive"` (pengaman row non-better-auth).
+- `package.json` — tambah `tsx` devDependency + script `"seed:superadmin": "tsx --env-file-if-exists=.env scripts/seed-superadmin.ts"` (tsx **tidak memuat `.env` otomatis**; manifest memang tanpa dotenv — namun `vitest.config.ts:1` memuat `.env` via dotenv **transitive/phantom** (`prisma→c12`, `shadcn→dotenvx`), sehingga test integrasi mewarisi `DATABASE_URL` tanpa plumbing env; untuk CLI, tanpa `--env-file-if-exists` seeder selalu fail-fast palsu).
 - `.env.example` — tambah blok `SUPERADMIN_EMAILS` dengan komentar; **jangan** sentuh entri lain (`PIN_PEPPER` milik 1b).
+- Baseline 2026-09-20 pasca-1b: 520/520 hijau, `tsc` bersih. "Test lama hijau" mengikuti presedepun OQ1=A 1b (failure-set comparison; flake dikenal `import.db-concurrency.test.ts`).
 
 ## Tasks & Acceptance
 
 **Execution:**
-- [ ] `src/lib/superadmin-allowlist.ts` — parser pure sesuai Design Notes (Parser).
-- [ ] `scripts/seed-superadmin.ts` — sesuai Design Notes (Seeder).
-- [ ] `package.json` — `tsx` devDependency + script `seed:superadmin` (dengan `--env-file-if-exists=.env` — lihat Code Map).
-- [ ] `.env.example` — dokumentasikan `SUPERADMIN_EMAILS`.
-- [ ] `src/lib/__tests__/superadmin-allowlist.test.ts` — seluruh baris parser seeder pada matriks I/O (env kosong/whitespace/unset, duplikat, campuran case, koma ganda/`,,,`, entri non-email).
+- [x] `src/lib/superadmin-allowlist.ts` — parser pure sesuai Design Notes (Parser).
+- [x] `src/lib/audit-metadata.ts` — `redactMetadata()` sesuai kontrak Design Notes (BH6).
+- [x] `src/lib/superadmin-seeder.ts` — inti seeder sesuai Design Notes (Seeder): validasi → rencana (termasuk laporan drift ADMIN-not-in-allowlist, BH7) → apply all-or-nothing + audit ter-redaksi + lookup insensitive (BH8).
+- [x] `scripts/seed-superadmin.ts` — CLI tipis (env → parser → inti → exit code; `--dry-run`, `--allow-unverified` pass-through).
+- [x] `package.json` — `tsx` devDependency + script `seed:superadmin` (dengan `--env-file-if-exists=.env` — lihat Code Map).
+- [x] `.env.example` — dokumentasikan `SUPERADMIN_EMAILS`.
+- [x] `src/lib/__tests__/superadmin-allowlist.test.ts` — seluruh baris parser seeder pada matriks I/O (env kosong/whitespace/unset, duplikat, campuran case, koma ganda/`,,,`, entri non-email) + unit `redactMetadata()` (BH6).
+- [x] `src/lib/__tests__/superadmin-seeder.int.test.ts` — integrasi DB nyata (DATABASE_URL, ala `import.db-concurrency.test.ts`): idempotensi run 2× → 0 entri audit baru; email tak dikenal → rollback, nol row berubah; mixed-case stored row ditemukan via insensitive lookup; cleanup mandiri (BH12+BH8).
 
 **Acceptance Criteria:**
 - Given `SUPERADMIN_EMAILS` kosong/unset, when seeder dijalankan, then exit non-zero dan nol row berubah.
 - Given allowlist berisi email tak dikenal atau entri non-valid, when seeder dijalankan, then nol row berubah (all-or-nothing), exit non-zero, laporan lengkap.
-- Given email allowlist valid, when seeder dijalankan ulang, then idempotent (tanpa duplikat entri audit untuk state sama).
+- Given email allowlist valid, when seeder dijalankan ulang, then idempotent (tanpa duplikat entri audit untuk state sama) — diverifikasi otomatis via test integrasi (BH12), bukan manual saja.
+- Given ada user `platformRole="ADMIN"` yang emailnya tak ada di allowlist, when seeder berjalan, then laporan drift tercetak (warning) dan TIDAK ada demosi otomatis (BH7).
 
 ## Implementation Notes
 
+- **Urutan commit (alternatif split story — split DITOLAK):** pipeline sekuensial per `stories.yaml` ("Urutan = urutan list") membuat lane paralel tak bernilai; granularitas review didapat lewat urutan commit: **commit 1** = primitif murni (`audit-metadata.ts` + `superadmin-allowlist.ts` + unit test) → **commit 2** = core seeder (`superadmin-seeder.ts` + test integrasi) → **commit 3** = CLI + `package.json` + `.env.example`. Frozen tak tersentuh; tanpa biaya story baru.
+- 2026-09-20 (implement stage 1): regex validator dipatok + tolak karakter kutip — regex F6 asli (`[^\s@]`) ternyata MELULUSKAN `"a@b.c"` (kutip bukan spasi/@), kontradiktif dgn fail-fast-berkutip; diperketat ke `[^\s@'"]` (kontrak F6 dipertahankan, redaksinya dipatok). Cycle-guard redactMetadata: objek top-level kini masuk `seen` sejak awal (back-reference langsung langsung dibuang).
+- 2026-09-20 (implement stage 2): test integrasi memakai email unik per pembuatan (konstanta email lintas test → pelanggaran `@@unique` intra-run); `afterAll` TIDAK memanggil `$disconnect()` pada singleton `prisma` dari `@/lib/auth` — pola referensi import.db-concurrency juga tidak, dan disconnect bisa mematikan file test berikutnya di worker sama.
+- 2026-09-20 (implement stage 3): top-level await tak didukung tsx (CJS) — CLI membungkus `main().then(code => process.exitCode = code)`; C1 terbukti: `--env-file-if-exists=.env` via tsx memuat `DATABASE_URL` (dry-run ke Neon sukses). **Apply nyata CLI sengaja TIDAK dijalankan** saat verifikasi: `.env` menunjuk Neon dev bersama (bukan "DB lokal" peringatan Verification) — promosi user nyata = aksi operator; semantik apply dibuktikan test integrasi. Insiden: Neon sempat cold-start/unreachable (probe timeout) → 1 run suite merah environmental (4 file), pulih otomatis setelah wake; bukan regresi kode.
+- 2026-09-20 (verifikasi akhir): `tsc` exit 0, eslint bersih; `npm test` **551/551 hijau (46 file)** termasuk `import.db-concurrency` (flake-nya environmental Neon cold-start — kini terkonfirmasi); CLI: no-env exit 1, invalid-entry exit 1 + daftar tercetak, dry-run exit 0 + identitas DB + rencana ber-profil + nol row. DB diperiksa pasca-test: 0 row test yatim, 0 audit sisa.
+
 ## Spec Change Log
 
 - 2026-09-20 — Pecahan 3 arah Story 1 (Build step-02 token-gate, disetujui human): scope allowlist+seeder menjadi story ini. Seluruh pengerasan elicitation dipindah utuh; sejarah lengkap: `1-fondasi-database-primitif-keamanan.elicitation-report.md` (file selevel).
 - 2026-09-20 — Elicitation 1a (lintas story): koreksi typo frozen Never "`migrate migrate deploy`" → "`prisma migrate deploy`" (disetujui human).
 - 2026-09-20 — Elicitation 1b/1c (5 metode konsolidasi): script seeder → `tsx --env-file-if-exists=.env ...` (tsx tak memuat .env otomatis — repo tanpa dotenv; C1 kritis); shutdown eksplisit `pool.end()`/`process.exit` + audit hanya saat perubahan state.
+- 2026-09-20 — Build step-02 (persiapan 1c): konsumsi 4 entri deferred-work review 1a yang menarget spec ini — BH6 `redactMetadata()`+test, BH7 semantik penyusutan (laporan drift tiap run, tanpa demosi otomatis), BH8 invariant lowercase terpecahkan dengan membaca better-auth 1.6.29 langsung (sign-up.mjs:165,222 — `normalizedEmail` lowercase di lookup DAN createUser; lookup insensitive tetap dipasang), BH12 test integrasi seeder (idempotensi + rollback) via pemisahan inti ke `src/lib/superadmin-seeder.ts`. Interpretasi door criteria "test lama" mengikuti presedepun OQ1=A 1b (failure-set comparison; baseline kini 520/520).
+- 2026-09-20 — Elicitation menyeluruh 1c (pass terkonsolidasi 13 metode, ground-truth repo; nol temuan 🔴): (F1) koreksi premis dotenv — `vitest.config.ts:1` memuat `.env` via dotenv transitive/phantom sehingga test integrasi mewarisi `DATABASE_URL` tanpa plumbing (fix C1 tetap benar untuk CLI); (F2) shutdown `process.exitCode` + drain alami menggantikan hard `process.exit` (anti truncation stdout ter-pipe); (F4) batas transaksi dipatok — lookup+update+audit dalam SATU interactive tx + timeout eksplisit, edge concurrent-run diterima sadar; (F3) penguatan RT1 — laporan plan/drift menambah sinyal akun (platformRole, TeacherProfile) + audit metadata mencatat `allowUnverified:true` saat bypass; (F6) kontrak parser eksplisit (collect-all invalid, `{emails, invalid}`, validator dipatok, env berkutip = fail-fast); (F7) referensi test dikoreksi ke path asli `src/modules/imports/__tests__/import.db-concurrency.test.ts` + pola guard `dbAvailable`; (F8) catatan verifikasi C1 — dibuktikan run env-valid, fallback `node --import tsx`; (F5) split ditolak — diganti urutan commit 3 tahap (Implementation Notes). Semua perubahan non-frozen. Laporan lengkap: `1c-allowlist-seeder-superadmin.elicitation-report.md` (file selevel).
 
 ## Review Triage Log
 
@@ -81,20 +99,27 @@ context:
 
 **Parser:**
 - `parseSuperadminEmails(env)`: trim, lowercase, dedupe, validasi sintaks email (entri invalid ditolak saat parse), deteksi kosong (termasuk unset dan `,,,`).
+- Kontrak eksplisit: **kumpulkan SEMUA entri invalid** lalu laporkan sekaligus (bukan fail-on-first) — return `{ emails: string[]; invalid: string[] }`; validator sintaks dipatok di story ini (regex sederhana ala `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` memadai — kontrak, bukan implementasi bebas); nilai env berkutip (mis. `"a@b.c"` dari CI YAML) gagal validasi → fail-fast terdokumentasi.
 
 **Seeder:**
-- Validasi semua email dulu → **all-or-nothing** dalam satu transaksi (pg Pool + PrismaPg ala `src/lib/auth.ts`); `AuditLog` per aksi (`actorType="SYSTEM"`, metadata bebas secret); idempotent.
-- Anti perebutan email (RT1): cek `emailVerified` + cetak profil user (nama, emailVerified, createdAt) di rencana — operator bisa konfirmasi pemilik sah.
+- Validasi semua email dulu → **all-or-nothing**: lookup user (termasuk cek `emailVerified` dan drift) + UPDATE + insert `AuditLog` dijalankan dalam **SATU interactive transaction** dengan timeout eksplisit (default Prisma 5 detik — jangan diandalkan) (pg Pool + PrismaPg ala `src/lib/auth.ts`); `AuditLog` per aksi (`actorType="SYSTEM"`, metadata bebas secret); idempotent. Edge diterima sadar: dua seeder paralel bisa menghasilkan entri audit duplikat (state tetap konsisten) — tidak perlu advisory lock.
+- Anti perebutan email (RT1): cek `emailVerified` + cetak profil user (nama, emailVerified, createdAt, **platformRole saat ini, keberadaan TeacherProfile** — sinyal akun untuk penilaian operator) di rencana — operator bisa konfirmasi pemilik sah. Karena semua user saat ini `emailVerified=false`, gerbang ini inert dalam praktik (tiap run nyata wajib `--allow-unverified`): saat flag dipakai, **audit metadata wajib mencatat `allowUnverified: true`** dan stdout mencetak warning eksplisit (jejak forensik + anti-habituation).
 - `--dry-run` mencetak rencana tanpa menulis; output selalu mencantumkan identitas DB target (host+dbname) sebelum apply (blast-radius wrong-DB).
-- Shutdown eksplisit di akhir script: `await pool.end()` (+ `prisma.$disconnect()`) lalu `process.exit(code)` — Pool menjaga event loop hidup (script "selesai" tanpa exit → CI timeout). Audit hanya ditulis saat perubahan state nyata (no-op re-run = nol entri).
+- Shutdown di akhir script: `await pool.end()` (+ `prisma.$disconnect()`) lalu set **`process.exitCode = code`** dan biarkan event loop drain alami — hard `process.exit(code)` berisiko **memotong stdout yang di-pipe** (laporan adalah deliverable inti; Windows/CI rawan) dan hanya menjadi fallback bila loop masih hidup setelah drain. Pool memang menjaga event loop (tanpa `pool.end()` → CI timeout). Audit hanya ditulis saat perubahan state nyata (no-op re-run = nol entri).
+- Lookup email `mode: "insensitive"` atas nilai ternormalisasi (BH8: jalur registrasi better-auth 1.6.29 terbukti selalu lowercase — sign-up.mjs:165,222; insensitive melindungi dari row yang ditulis di luar better-auth).
+- Semantik penyusutan allowlist (BH7): seeder TIDAK PERNAH mendemosi; setiap run melaporkan drift — user `platformRole="ADMIN"` yang emailnya ∉ allowlist — sebagai warning berikut profilnya; demosi hanya via keputusan eksplisit masa depan (opsi `--demote`, di luar scope 1c).
+- Struktur modul: inti di `src/lib/superadmin-seeder.ts` (dapat diuji), `scripts/seed-superadmin.ts` hanya CLI — vitest mengambil `src/**/*.test.ts` + `src/**/*.spec.ts` (bukan `tests/**`) sehingga test integrasi (BH12) harus tinggal di bawah `src/` — dipilih `src/lib/__tests__/`.
 - Jalur seeder hanya untuk DB lokal; produksi via `prisma migrate deploy`; bila shadow DB gagal → `scripts/create-shadow-db.js`; jangan `db push`.
 
+**Redaksi metadata (BH6):**
+- `redactMetadata(input: Record<string, unknown>): Record<string, unknown>` — salinan dalam; key yang match pola denylist case-insensitive (`pin`, `password`, `secret`, `token`, `hash`, `pepper`, `authorization`, `cookie`) → `"[REDACTED]"` (nilai apa pun); nilai non-JSON-safe (function/symbol/undefined/bigint) dibuang; string dipotong ke 256 char; guard kedalaman/siklus. Kontrak inti: output selalu aman dimasukkan ke `AuditLog.metadata`.
+
 ## Verification
 
 **Commands:**
 - `npx tsc --noEmit` — exit 0.
 - `npm test` — seluruh test (lama + baru) hijau.
-- `npm run seed:superadmin` (tanpa env) — fail-fast non-zero dengan pesan allowlist.
+- `npm run seed:superadmin` (tanpa env) — fail-fast non-zero dengan pesan allowlist. Catatan C1: run ini tak membuktikan apa pun tentang flag `--env-file-if-exists` (env memang absen) — yang membuktikannya adalah run env-valid di bawah; bila tsx ternyata tak meneruskan flag node ke runtime, fallback: `node --env-file-if-exists=.env --import tsx scripts/seed-superadmin.ts`.
 - `npm run seed:superadmin -- --dry-run` (env valid) — rencana + identitas DB target, nol row berubah.
 - `npm run seed:superadmin` (env valid, 2×) — idempotent; run kedua tanpa entri audit baru. ⚠️ DB lokal saja.
 
diff --git a/package-lock.json b/package-lock.json
index cff74e4..d15ff62 100644
--- a/package-lock.json
+++ b/package-lock.json
@@ -52,6 +52,7 @@
         "eslint-config-next": "^16.3.3",
         "prisma": "^7.9.1",
         "tailwindcss": "^4",
+        "tsx": "^4.23.15",
         "typescript": "^5",
         "vitest": "^4.1.11"
       }
@@ -953,6 +954,448 @@
         "tslib": "^2.4.0"
       }
     },
+    "node_modules/@esbuild/aix-ppc64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/aix-ppc64/-/aix-ppc64-0.28.2.tgz",
+      "integrity": "sha512-XExcO+dvLKvVtNTibSTBej1NCAbaGhWn9Ww1ZPx80qsahhPFe/8jgWP0IchNe0F3HwkU7n8ejhH8bjonqht8mQ==",
+      "cpu": [
+        "ppc64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "aix"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/android-arm": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/android-arm/-/android-arm-0.28.2.tgz",
+      "integrity": "sha512-kXXoiPVVGQcnIYGOeaovwOURpniDBpSq4A03qkQ+BMQqtGG6HYap3xne9C1O1yo4TR3qxlCX5IqqmX6fFo2Lqg==",
+      "cpu": [
+        "arm"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "android"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/android-arm64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/android-arm64/-/android-arm64-0.28.2.tgz",
+      "integrity": "sha512-5YfKeeI8qWfBZIX+u2xZC3Zlb3Os/gLS2sbEKM+I4ZOcsWmHS2WLysCcQZDAFRslDUU5Oiq44gf6PYN1vGwG5A==",
+      "cpu": [
+        "arm64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "android"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/android-x64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/android-x64/-/android-x64-0.28.2.tgz",
+      "integrity": "sha512-O387ite7SzUyCcy3JQX4P4bLtEA7bLLkx+esve5JHnyYfNTxcVpXZo9jhdB0lTKN44gztELTdU7nS8Nr16Fs1Q==",
+      "cpu": [
+        "x64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "android"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/darwin-arm64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-0.28.2.tgz",
+      "integrity": "sha512-n4KqkOQrraxHJcgjM1RvwbigfQKIKJVpM7xp+KsxiyUSrRdIXnt73VhrPAx0fV44hgfmIVKjxMN9J1t5jySVkw==",
+      "cpu": [
+        "arm64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "darwin"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/darwin-x64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/darwin-x64/-/darwin-x64-0.28.2.tgz",
+      "integrity": "sha512-uq6suIWYP37qzGddBKPw5QEQPi6HiLGsO7UmkpfyaYNQ3D+rN6w6WfwH+nuqcGXWvawGwxOEroO4YGnFh95azw==",
+      "cpu": [
+        "x64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "darwin"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/freebsd-arm64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/freebsd-arm64/-/freebsd-arm64-0.28.2.tgz",
+      "integrity": "sha512-n+I0BTSRIoy+d6RPKnEVwql5UwBJolytvY4mAOIEJorKlqgPII8ix6slVVrfZ5Tnj7glIZvloylbB/EJPMWEXw==",
+      "cpu": [
+        "arm64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "freebsd"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/freebsd-x64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/freebsd-x64/-/freebsd-x64-0.28.2.tgz",
+      "integrity": "sha512-78XJTJkvPs0kz2w61301PJjXl4g7q3JqiYMZ/M/yVI73EHBrCRTgkhu9oqG7vPqq+a/yadEW8aD+agKlk5xrmg==",
+      "cpu": [
+        "x64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "freebsd"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/linux-arm": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/linux-arm/-/linux-arm-0.28.2.tgz",
+      "integrity": "sha512-XlDnu2q5yoqems+xay6wSAcg9DDD7K9RLKZEBOMZm3ckNpJBvOX20tSfby8KfrrhINDyv9V2YVZKY/SpoGJI8w==",
+      "cpu": [
+        "arm"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/linux-arm64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/linux-arm64/-/linux-arm64-0.28.2.tgz",
+      "integrity": "sha512-pW4AC0P3it8c7do9MVM4p51FzHzdM/TZrerurgRcHJ2WTa1VQ1CIq18xncfpBJw4ojkiZZrKW2yIBWBP92j6Ug==",
+      "cpu": [
+        "arm64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/linux-ia32": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/linux-ia32/-/linux-ia32-0.28.2.tgz",
+      "integrity": "sha512-CYbnj78HsIeA+DhgUKgFCfvNsTHFhMMrinUrMZpDXJXKN8T3XViTZ/+wtHeVxEWY8ewSzTFN+nRmSwO2tZaLUQ==",
+      "cpu": [
+        "ia32"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/linux-loong64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/linux-loong64/-/linux-loong64-0.28.2.tgz",
+      "integrity": "sha512-buwkd8nsph4R+ajRvw0qM5Hja/TXQow3ptzWO2EbG/cqcIkHloRrdlBtQlshyYGTNFvfkfJ5tpPLVkY4DtsPfQ==",
+      "cpu": [
+        "loong64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/linux-mips64el": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/linux-mips64el/-/linux-mips64el-0.28.2.tgz",
+      "integrity": "sha512-ZVykbDyk7519VwiNb9Lcj9m8XM6v5V9uKPvrEMkkEedVewf+0itkhahp4HDpgERXhwLRpWFypsGbG/J8s0QjJA==",
+      "cpu": [
+        "mips64el"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/linux-ppc64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/linux-ppc64/-/linux-ppc64-0.28.2.tgz",
+      "integrity": "sha512-CAXl+Dtd9UUuJd8pKKdwh6MLm3MUMiqMPmhZ3tTSXPqfyQ3vDl6R5hZdZ/kYojK4ofXtdfSv1tFq8XzWx3heNQ==",
+      "cpu": [
+        "ppc64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/linux-riscv64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/linux-riscv64/-/linux-riscv64-0.28.2.tgz",
+      "integrity": "sha512-GeXCej4IQtU1B+QlDV8W/RRvbzI3O/Stss+/bCXv4lZls5WGRtu2a+3JkA3i4qIUlMXpcHebWpF8AkJhATowuA==",
+      "cpu": [
+        "riscv64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/linux-s390x": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/linux-s390x/-/linux-s390x-0.28.2.tgz",
+      "integrity": "sha512-3H1weTYZPxt/WOhByszQZybS9w5lKzUn1FDMsgEChbHWQwHYQQRfBxgCcZvPhjHfKyJjIievvMmEUawJrdY9Dg==",
+      "cpu": [
+        "s390x"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/linux-x64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/linux-x64/-/linux-x64-0.28.2.tgz",
+      "integrity": "sha512-4xTZr1FUmSoQW4XIWmit3tzQrUTZM+N3P0XV8xROKYF50XfI7xeO90+1bZvNwxIufQ9hDQVRJH5YhgPVF8A/HQ==",
+      "cpu": [
+        "x64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "linux"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/netbsd-arm64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/netbsd-arm64/-/netbsd-arm64-0.28.2.tgz",
+      "integrity": "sha512-sSATRjPeDBg3pdgHoQfoYBob11Kk1FGa9lui5RIHZCoCkJa9QKlvl3/vKz2usCmYYjs7ymJR/2Nnsqe+Hjt5nw==",
+      "cpu": [
+        "arm64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "netbsd"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/netbsd-x64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/netbsd-x64/-/netbsd-x64-0.28.2.tgz",
+      "integrity": "sha512-lqnzCV+mM0gIADaKihiCg6ifgfU2L3h5E33rNQBN1Y4MaVGnzryzmvvf7UHxprpQdE8hpqLolJ9Rl+SkIRDpyw==",
+      "cpu": [
+        "x64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "netbsd"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/openbsd-arm64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/openbsd-arm64/-/openbsd-arm64-0.28.2.tgz",
+      "integrity": "sha512-AL2qJILH7lNjrDmCQDvdxMfAUIv8KMNZOvrwAQ8i8//ntL9FflhOyMJ8OZSMBb8/AWXe3/5v5S20y3zCoZWKoQ==",
+      "cpu": [
+        "arm64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "openbsd"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/openbsd-x64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/openbsd-x64/-/openbsd-x64-0.28.2.tgz",
+      "integrity": "sha512-QtiuPytchRyC4rwUKhexJdQKvDuZ6hWloi3igqPQNUJCS1/v9EiO3UTOXR6A3FoMo4fnAKbWJdqaIwhOzh8qEw==",
+      "cpu": [
+        "x64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "openbsd"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/openharmony-arm64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/openharmony-arm64/-/openharmony-arm64-0.28.2.tgz",
+      "integrity": "sha512-WkhYDmpTjLvGlScA1rwjRUmhl4k8oXR3cIbtqWmELgU/dFeHHlEllxDvdWcNJV9rbzCexB5vz8gtNewWLgCT7Q==",
+      "cpu": [
+        "arm64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "openharmony"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/sunos-x64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/sunos-x64/-/sunos-x64-0.28.2.tgz",
+      "integrity": "sha512-GPMSkTOtMnv2U2F8gxe4Io6qmVs+YKyp832Etqqxr0hFngmXQ3rzwytelm3GIn7T4VviRUlf3sOgBOiTdvaf7g==",
+      "cpu": [
+        "x64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "sunos"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/win32-arm64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/win32-arm64/-/win32-arm64-0.28.2.tgz",
+      "integrity": "sha512-PIhhEkE9uPBleRBrQEJpUn7MBnibZzbGzYWPmY3x+YoVg/95zbjB4CxPPOQ8l5tYYM4mMaCthF8/1DIfBQQyWQ==",
+      "cpu": [
+        "arm64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "win32"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/win32-ia32": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/win32-ia32/-/win32-ia32-0.28.2.tgz",
+      "integrity": "sha512-YmJbfTlvU7Sdn9BB+4PRES4oB6pxgS37MAONj+hBr/cpXS1aBPKXxNnDbu+QCWPj0o9dgyxeq79g6c5P8KeuYA==",
+      "cpu": [
+        "ia32"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "win32"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
+    "node_modules/@esbuild/win32-x64": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/@esbuild/win32-x64/-/win32-x64-0.28.2.tgz",
+      "integrity": "sha512-5ebpxr3nWMzrL/rnUI755Jkuee0bHL/Gq0WTF9lvcpv73wAp5eu8MfBUgWK9bhWvZjj7yX8etf/8tI8Ney695g==",
+      "cpu": [
+        "x64"
+      ],
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "win32"
+      ],
+      "engines": {
+        "node": ">=18"
+      }
+    },
     "node_modules/@eslint-community/eslint-utils": {
       "version": "4.10.1",
       "resolved": "https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.10.1.tgz",
@@ -1390,9 +1833,6 @@
       "cpu": [
         "arm"
       ],
-      "libc": [
-        "glibc"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1409,9 +1849,6 @@
       "cpu": [
         "arm64"
       ],
-      "libc": [
-        "glibc"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1428,9 +1865,6 @@
       "cpu": [
         "ppc64"
       ],
-      "libc": [
-        "glibc"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1447,9 +1881,6 @@
       "cpu": [
         "riscv64"
       ],
-      "libc": [
-        "glibc"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1466,9 +1897,6 @@
       "cpu": [
         "s390x"
       ],
-      "libc": [
-        "glibc"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1485,9 +1913,6 @@
       "cpu": [
         "x64"
       ],
-      "libc": [
-        "glibc"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1504,9 +1929,6 @@
       "cpu": [
         "arm64"
       ],
-      "libc": [
-        "musl"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1523,9 +1945,6 @@
       "cpu": [
         "x64"
       ],
-      "libc": [
-        "musl"
-      ],
       "license": "LGPL-3.0-or-later",
       "optional": true,
       "os": [
@@ -1542,9 +1961,6 @@
       "cpu": [
         "arm"
       ],
-      "libc": [
-        "glibc"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -1567,9 +1983,6 @@
       "cpu": [
         "arm64"
       ],
-      "libc": [
-        "glibc"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -1592,9 +2005,6 @@
       "cpu": [
         "ppc64"
       ],
-      "libc": [
-        "glibc"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -1617,9 +2027,6 @@
       "cpu": [
         "riscv64"
       ],
-      "libc": [
-        "glibc"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -1642,9 +2049,6 @@
       "cpu": [
         "s390x"
       ],
-      "libc": [
-        "glibc"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -1667,9 +2071,6 @@
       "cpu": [
         "x64"
       ],
-      "libc": [
-        "glibc"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -1692,9 +2093,6 @@
       "cpu": [
         "arm64"
       ],
-      "libc": [
-        "musl"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -1717,9 +2115,6 @@
       "cpu": [
         "x64"
       ],
-      "libc": [
-        "musl"
-      ],
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -2044,9 +2439,6 @@
       "cpu": [
         "arm64"
       ],
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2063,9 +2455,6 @@
       "cpu": [
         "arm64"
       ],
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2082,9 +2471,6 @@
       "cpu": [
         "x64"
       ],
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2101,9 +2487,6 @@
       "cpu": [
         "x64"
       ],
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2701,6 +3084,7 @@
       "cpu": [
         "arm"
       ],
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2717,6 +3101,7 @@
       "cpu": [
         "arm64"
       ],
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2733,6 +3118,7 @@
       "cpu": [
         "arm64"
       ],
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2749,6 +3135,7 @@
       "cpu": [
         "x64"
       ],
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2765,6 +3152,7 @@
       "cpu": [
         "x64"
       ],
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2781,6 +3169,7 @@
       "cpu": [
         "arm"
       ],
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2797,9 +3186,7 @@
       "cpu": [
         "arm64"
       ],
-      "libc": [
-        "glibc"
-      ],
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2816,9 +3203,7 @@
       "cpu": [
         "arm64"
       ],
-      "libc": [
-        "musl"
-      ],
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2835,9 +3220,7 @@
       "cpu": [
         "ppc64"
       ],
-      "libc": [
-        "glibc"
-      ],
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2854,9 +3237,7 @@
       "cpu": [
         "s390x"
       ],
-      "libc": [
-        "glibc"
-      ],
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2873,9 +3254,7 @@
       "cpu": [
         "x64"
       ],
-      "libc": [
-        "glibc"
-      ],
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2892,9 +3271,7 @@
       "cpu": [
         "x64"
       ],
-      "libc": [
-        "musl"
-      ],
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2911,6 +3288,7 @@
       "cpu": [
         "arm64"
       ],
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2927,6 +3305,7 @@
       "cpu": [
         "arm64"
       ],
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2943,6 +3322,7 @@
       "cpu": [
         "x64"
       ],
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "os": [
@@ -3132,9 +3512,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -3152,9 +3529,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -3172,9 +3546,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -3192,9 +3563,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -3567,7 +3935,7 @@
       "version": "19.2.4",
       "resolved": "https://registry.npmjs.org/@types/react-dom/-/react-dom-19.2.4.tgz",
       "integrity": "sha512-Bsc+QHgp+P/F02XDzNCY9jnZNCUuLki36KT7VKrTXXLdHf+vHMNZnW1rVu5DNW/rCK+fya3DATySbLM4yhtKUw==",
-      "devOptional": true,
+      "dev": true,
       "license": "MIT",
       "peerDependencies": {
         "@types/react": "^19.2.0"
@@ -4003,9 +4371,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -4020,9 +4385,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -4037,9 +4399,6 @@
         "loong64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -4054,9 +4413,6 @@
         "loong64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -4071,9 +4427,6 @@
         "ppc64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -4088,9 +4441,6 @@
         "riscv64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -4105,9 +4455,6 @@
         "riscv64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -4122,9 +4469,6 @@
         "s390x"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -4139,9 +4483,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -4156,9 +4497,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -6970,6 +7308,48 @@
         "url": "https://github.com/sponsors/ljharb"
       }
     },
+    "node_modules/esbuild": {
+      "version": "0.28.2",
+      "resolved": "https://registry.npmjs.org/esbuild/-/esbuild-0.28.2.tgz",
+      "integrity": "sha512-HKVLS8dvII+xoKW9kmqxbRKrnWEXfJJr/FZhhJmiqIB0e053QNYFqOBouTMO/k5sID4MvCiUCvv8b9M4h32wIA==",
+      "dev": true,
+      "hasInstallScript": true,
+      "license": "MIT",
+      "bin": {
+        "esbuild": "bin/esbuild"
+      },
+      "engines": {
+        "node": ">=18"
+      },
+      "optionalDependencies": {
+        "@esbuild/aix-ppc64": "0.28.2",
+        "@esbuild/android-arm": "0.28.2",
+        "@esbuild/android-arm64": "0.28.2",
+        "@esbuild/android-x64": "0.28.2",
+        "@esbuild/darwin-arm64": "0.28.2",
+        "@esbuild/darwin-x64": "0.28.2",
+        "@esbuild/freebsd-arm64": "0.28.2",
+        "@esbuild/freebsd-x64": "0.28.2",
+        "@esbuild/linux-arm": "0.28.2",
+        "@esbuild/linux-arm64": "0.28.2",
+        "@esbuild/linux-ia32": "0.28.2",
+        "@esbuild/linux-loong64": "0.28.2",
+        "@esbuild/linux-mips64el": "0.28.2",
+        "@esbuild/linux-ppc64": "0.28.2",
+        "@esbuild/linux-riscv64": "0.28.2",
+        "@esbuild/linux-s390x": "0.28.2",
+        "@esbuild/linux-x64": "0.28.2",
+        "@esbuild/netbsd-arm64": "0.28.2",
+        "@esbuild/netbsd-x64": "0.28.2",
+        "@esbuild/openbsd-arm64": "0.28.2",
+        "@esbuild/openbsd-x64": "0.28.2",
+        "@esbuild/openharmony-arm64": "0.28.2",
+        "@esbuild/sunos-x64": "0.28.2",
+        "@esbuild/win32-arm64": "0.28.2",
+        "@esbuild/win32-ia32": "0.28.2",
+        "@esbuild/win32-x64": "0.28.2"
+      }
+    },
     "node_modules/escalade": {
       "version": "3.2.0",
       "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
@@ -8042,6 +8422,7 @@
       "version": "2.3.2",
       "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.2.tgz",
       "integrity": "sha512-xiqMQR4xAeHTuB9uWm+fFRcIOgKBMiOBP+eXiyT7jsgVCq1bkVygt00oASowB7EdtpOHaaPgKt812P9ab+DDKA==",
+      "dev": true,
       "hasInstallScript": true,
       "license": "MIT",
       "optional": true,
@@ -9820,9 +10201,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MPL-2.0",
       "optional": true,
       "os": [
@@ -9844,9 +10222,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MPL-2.0",
       "optional": true,
       "os": [
@@ -9868,9 +10243,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MPL-2.0",
       "optional": true,
       "os": [
@@ -9892,9 +10264,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MPL-2.0",
       "optional": true,
       "os": [
@@ -13510,6 +13879,40 @@
       "integrity": "sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==",
       "license": "0BSD"
     },
+    "node_modules/tsx": {
+      "version": "4.23.15",
+      "resolved": "https://registry.npmjs.org/tsx/-/tsx-4.23.15.tgz",
+      "integrity": "sha512-Yiex1Ovn8z2xPpOWckIiysV1SSyRMY9BkLF++q0yKiDxCqRhosKfMg3janKkiLBwZ5c/YryloKwGZcrEmtwxKw==",
+      "dev": true,
+      "license": "MIT",
+      "dependencies": {
+        "esbuild": "~0.28.0"
+      },
+      "bin": {
+        "tsx": "dist/cli.mjs"
+      },
+      "engines": {
+        "node": ">=18.0.0"
+      },
+      "optionalDependencies": {
+        "fsevents": "~2.3.3"
+      }
+    },
+    "node_modules/tsx/node_modules/fsevents": {
+      "version": "2.3.3",
+      "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
+      "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
+      "dev": true,
+      "hasInstallScript": true,
+      "license": "MIT",
+      "optional": true,
+      "os": [
+        "darwin"
+      ],
+      "engines": {
+        "node": "^8.16.0 || ^10.6.0 || >=11.0.0"
+      }
+    },
     "node_modules/tw-animate-css": {
       "version": "1.4.0",
       "resolved": "https://registry.npmjs.org/tw-animate-css/-/tw-animate-css-1.4.0.tgz",
@@ -14001,6 +14404,7 @@
       "version": "2.3.3",
       "resolved": "https://registry.npmjs.org/fsevents/-/fsevents-2.3.3.tgz",
       "integrity": "sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==",
+      "dev": true,
       "hasInstallScript": true,
       "license": "MIT",
       "optional": true,
@@ -14048,6 +14452,7 @@
       "cpu": [
         "arm64"
       ],
+      "dev": true,
       "license": "MPL-2.0",
       "optional": true,
       "os": [
@@ -14068,6 +14473,7 @@
       "cpu": [
         "arm64"
       ],
+      "dev": true,
       "license": "MPL-2.0",
       "optional": true,
       "os": [
@@ -14088,6 +14494,7 @@
       "cpu": [
         "x64"
       ],
+      "dev": true,
       "license": "MPL-2.0",
       "optional": true,
       "os": [
@@ -14108,6 +14515,7 @@
       "cpu": [
         "x64"
       ],
+      "dev": true,
       "license": "MPL-2.0",
       "optional": true,
       "os": [
@@ -14128,6 +14536,7 @@
       "cpu": [
         "arm"
       ],
+      "dev": true,
       "license": "MPL-2.0",
       "optional": true,
       "os": [
@@ -14148,9 +14557,7 @@
       "cpu": [
         "arm64"
       ],
-      "libc": [
-        "glibc"
-      ],
+      "dev": true,
       "license": "MPL-2.0",
       "optional": true,
       "os": [
@@ -14171,9 +14578,7 @@
       "cpu": [
         "arm64"
       ],
-      "libc": [
-        "musl"
-      ],
+      "dev": true,
       "license": "MPL-2.0",
       "optional": true,
       "os": [
@@ -14194,9 +14599,7 @@
       "cpu": [
         "x64"
       ],
-      "libc": [
-        "glibc"
-      ],
+      "dev": true,
       "license": "MPL-2.0",
       "optional": true,
       "os": [
@@ -14217,9 +14620,7 @@
       "cpu": [
         "x64"
       ],
-      "libc": [
-        "musl"
-      ],
+      "dev": true,
       "license": "MPL-2.0",
       "optional": true,
       "os": [
@@ -14240,6 +14641,7 @@
       "cpu": [
         "arm64"
       ],
+      "dev": true,
       "license": "MPL-2.0",
       "optional": true,
       "os": [
@@ -14260,6 +14662,7 @@
       "cpu": [
         "x64"
       ],
+      "dev": true,
       "license": "MPL-2.0",
       "optional": true,
       "os": [
diff --git a/package.json b/package.json
index 1e0c0b2..acb97b5 100644
--- a/package.json
+++ b/package.json
@@ -8,7 +8,8 @@
     "start": "next start",
     "lint": "eslint .",
     "test": "vitest run",
-    "postinstall": "prisma generate"
+    "postinstall": "prisma generate",
+    "seed:superadmin": "tsx --env-file-if-exists=.env scripts/seed-superadmin.ts"
   },
   "dependencies": {
     "@base-ui/react": "^1.7.0",
@@ -54,6 +55,7 @@
     "eslint-config-next": "^16.3.3",
     "prisma": "^7.9.1",
     "tailwindcss": "^4",
+    "tsx": "^4.23.15",
     "typescript": "^5",
     "vitest": "^4.1.11"
   }
diff --git a/src/lib/__tests__/superadmin-allowlist.test.ts b/src/lib/__tests__/superadmin-allowlist.test.ts
new file mode 100644
index 0000000..55096cc
--- /dev/null
+++ b/src/lib/__tests__/superadmin-allowlist.test.ts
@@ -0,0 +1,129 @@
+import { describe, it, expect } from "vitest";
+import { parseSuperadminEmails } from "../superadmin-allowlist";
+import { redactMetadata, REDACTED } from "../audit-metadata";
+
+describe("parseSuperadminEmails", () => {
+    it("parses a single valid email", () => {
+        expect(parseSuperadminEmails("a@b.c")).toEqual({ emails: ["a@b.c"], invalid: [] });
+    });
+
+    it("parses multiple emails, trimming whitespace and lowercasing", () => {
+        expect(parseSuperadminEmails("  Admin@Sekolah.ID , b@x.io ")).toEqual({
+            emails: ["admin@sekolah.id", "b@x.io"],
+            invalid: [],
+        });
+    });
+
+    it("dedupes after normalization (first occurrence order)", () => {
+        expect(parseSuperadminEmails("A@b.c,a@B.C,c@d.e,a@b.c")).toEqual({
+            emails: ["a@b.c", "c@d.e"],
+            invalid: [],
+        });
+    });
+
+    it.each([
+        ["", { emails: [], invalid: [] }],
+        ["   ", { emails: [], invalid: [] }],
+        [",,,", { emails: [], invalid: [] }],
+        [", , ,", { emails: [], invalid: [] }],
+        [undefined, { emails: [], invalid: [] }],
+    ])("treats env %j as empty allowlist", (env, expected) => {
+        expect(parseSuperadminEmails(env as string | undefined)).toEqual(expected);
+    });
+
+    it("collects ALL invalid entries at once (no fail-on-first), keeping raw spelling", () => {
+        expect(parseSuperadminEmails("a@b.c,not-an-email,x@y@z,b@d.e")).toEqual({
+            emails: ["a@b.c", "b@d.e"],
+            invalid: ["not-an-email", "x@y@z"],
+        });
+    });
+
+    it.each(["\"a@b.c\"", "'a@b.c'", "a b@c.d", "a@b", "@b.c", "a@.c"] as const)(
+        "rejects quoted/malformed entry %j",
+        (entry) => {
+            const result = parseSuperadminEmails(`${entry},ok@x.io`);
+            expect(result.invalid).toEqual([entry]); // raw entry verbatim (quotes visible in report)
+            expect(result.emails).toEqual(["ok@x.io"]);
+        }
+    );
+
+    it("an all-invalid env yields zero emails and the full invalid list", () => {
+        expect(parseSuperadminEmails("nope,also nope")).toEqual({
+            emails: [],
+            invalid: ["nope", "also nope"],
+        });
+    });
+});
+
+describe("redactMetadata (BH6)", () => {
+    it("redacts values under sensitive keys regardless of case or substring position", () => {
+        const out = redactMetadata({
+            email: "a@b.c",
+            studentPin: "1234",
+            accessPinHash: "scrypt:1:1:1:aa:bb",
+            AUTH_TOKEN: "xyz",
+            Authorization: "Bearer x",
+            cookie: "session=1",
+            pepperValue: "s",
+            name: "Guru",
+        });
+        expect(out.studentPin).toBe(REDACTED);
+        expect(out.accessPinHash).toBe(REDACTED);
+        expect(out.AUTH_TOKEN).toBe(REDACTED);
+        expect(out.Authorization).toBe(REDACTED);
+        expect(out.cookie).toBe(REDACTED);
+        expect(out.pepperValue).toBe(REDACTED);
+        expect(out.email).toBe("a@b.c");
+        expect(out.name).toBe("Guru");
+    });
+
+    it("redacts nested objects and arrays, dropping non-JSON-safe values", () => {
+        const fn = (): number => 1;
+        const out = redactMetadata({
+            actor: { name: "x", password: "hunter2", nested: { token: "t", keep: 1 } },
+            items: ["a", { secret: "s", n: 2 }],
+            drop: fn,
+            alsoDrop: Symbol("s"),
+            bigintDrop: BigInt(10),
+            undef: undefined,
+        });
+        expect(out.actor).toEqual({ name: "x", password: REDACTED, nested: { token: REDACTED, keep: 1 } });
+        expect(out.items).toEqual(["a", { secret: REDACTED, n: 2 }]);
+        expect(out).not.toHaveProperty("drop");
+        expect(out).not.toHaveProperty("alsoDrop");
+        expect(out).not.toHaveProperty("bigintDrop");
+        expect(out).not.toHaveProperty("undef");
+    });
+
+    it("truncates long strings to 256 chars", () => {
+        const long = "x".repeat(500);
+        const out = redactMetadata({ note: long }) as { note: string };
+        expect(out.note.length).toBe(256);
+    });
+
+    it("keeps JSON-safe primitives (non-finite numbers become null) and converts Date to ISO string", () => {
+        const d = new Date("2026-09-20T10:00:00Z");
+        const out = redactMetadata({ n: 5, b: true, z: null, d, inf: Infinity });
+        expect(out).toEqual({ n: 5, b: true, z: null, d: "2026-09-20T10:00:00.000Z", inf: null });
+    });
+
+    it("survives cycles without hanging", () => {
+        const a: Record<string, unknown> = { name: "a" };
+        a.self = a;
+        const out = redactMetadata(a);
+        expect(out).toEqual({ name: "a" });
+    });
+
+    it("drops content beyond the depth guard (subtree past depth 6 disappears)", () => {
+        let deep: Record<string, unknown> = { leaf: "x" };
+        for (let i = 0; i < 10; i++) deep = { child: deep };
+        const out = redactMetadata({ deep });
+        expect(JSON.stringify(out).includes("leaf")).toBe(false); // bounded, leaf unreachable
+    });
+
+    it("does not mutate the input", () => {
+        const input = { password: "hunter2", inner: { token: "t" } };
+        redactMetadata(input);
+        expect(input).toEqual({ password: "hunter2", inner: { token: "t" } });
+    });
+});
diff --git a/src/lib/__tests__/superadmin-seeder.int.test.ts b/src/lib/__tests__/superadmin-seeder.int.test.ts
new file mode 100644
index 0000000..4fd1325
--- /dev/null
+++ b/src/lib/__tests__/superadmin-seeder.int.test.ts
@@ -0,0 +1,180 @@
+import { describe, it, expect, beforeAll, afterAll } from "vitest";
+import { prisma } from "@/lib/auth";
+import { runSuperadminSeed, SeedAbortError, SeedConfigError } from "../superadmin-seeder";
+import { parseSuperadminEmails } from "../superadmin-allowlist";
+
+/**
+ * Integration tests against the real DATABASE_URL (Story 1c, BH12).
+ * Pattern: dbAvailable flag from a try/catch beforeAll — mirrors
+ * src/modules/imports/__tests__/import.db-concurrency.test.ts (NOT skipIf).
+ * Env is inherited via vitest.config.ts (phantom dotenv loads .env) — no
+ * extra plumbing here (elicitation F1).
+ */
+
+let dbAvailable = false;
+const createdUserIds: string[] = [];
+let seq = 0;
+
+const TARGET = { host: "(test)", database: "(test)" };
+
+interface TestUser {
+    id: string;
+    email: string;
+    name: string;
+}
+
+async function createTestUser(prefix: string, extra?: { platformRole?: string; emailVerified?: boolean; emailOverride?: string }): Promise<TestUser> {
+    seq += 1;
+    const email = extra?.emailOverride ?? `${prefix}-${Date.now()}-${seq}@test.local`;
+    const user = await prisma.user.create({
+        data: {
+            id: `1c-test-${Math.random().toString(36).slice(2, 12)}`,
+            name: `1c Test ${prefix}`,
+            email,
+            emailVerified: extra?.emailVerified ?? false,
+            platformRole: extra?.platformRole ?? "USER",
+            createdAt: new Date(),
+            updatedAt: new Date(),
+        },
+    });
+    createdUserIds.push(user.id);
+    return { id: user.id, email: user.email, name: user.name };
+}
+
+async function auditCountFor(userId: string, action = "SUPERADMIN_PROMOTE"): Promise<number> {
+    return prisma.auditLog.count({ where: { targetId: userId, action, actorType: "SYSTEM" } });
+}
+
+beforeAll(async () => {
+    try {
+        await prisma.$queryRaw`SELECT 1`;
+        dbAvailable = true;
+    } catch {
+        dbAvailable = false;
+    }
+});
+
+afterAll(async () => {
+    if (!dbAvailable) return;
+    try {
+        if (createdUserIds.length > 0) {
+            await prisma.auditLog.deleteMany({ where: { targetId: { in: createdUserIds } } });
+            await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
+        }
+    } catch {
+        // Ignore cleanup error (reference pattern: import.db-concurrency.test.ts)
+    }
+    // NOTE: no $disconnect() — the shared singleton must survive for any test
+    // file that runs after this one in the same worker (reference pattern).
+});
+
+describe("Story 1c — superadmin seeder core (real DB)", () => {
+    it("fail-fasts on an empty allowlist without touching the DB", async () => {
+        for (const env of ["", "   ", undefined, ",,,"]) {
+            const parsed = parseSuperadminEmails(env as string | undefined);
+            await expect(
+                runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET })
+            ).rejects.toBeInstanceOf(SeedConfigError);
+        }
+    });
+
+    it("aborts all-or-nothing on unknown email: zero rows change, report carries the plan", async () => {
+        const known = await createTestUser("1c-known");
+        const unknownEmail = `1c-unknown-${Date.now()}-${seq}@test.local`;
+        const parsed = parseSuperadminEmails(`${known.email},${unknownEmail}`);
+        const attempt = runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, allowUnverified: true });
+        await expect(attempt).rejects.toMatchObject({
+            name: "SeedAbortError",
+            report: { unknown: [{ email: unknownEmail }] },
+        });
+        const after = await prisma.user.findUnique({ where: { id: known.id } });
+        expect(after?.platformRole).toBe("USER"); // not promoted — all-or-nothing held
+        expect(await auditCountFor(known.id)).toBe(0);
+    });
+
+    it("blocks unverified email by default; --allow-unverified proceeds and marks the audit", async () => {
+        const user = await createTestUser("1c-unverified"); // emailVerified=false
+        const parsed = parseSuperadminEmails(user.email);
+        const base = { prisma, allowlist: parsed, target: TARGET } as const;
+
+        const blocked = runSuperadminSeed(base);
+        await expect(blocked).rejects.toMatchObject({
+            name: "SeedAbortError",
+            report: { unverified: [{ email: user.email, emailVerified: false }] },
+        });
+        expect((await prisma.user.findUnique({ where: { id: user.id } }))?.platformRole).toBe("USER");
+
+        const report = await runSuperadminSeed({ ...base, allowUnverified: true });
+        expect(report.promoted).toBe(1);
+        expect(report.auditEntries).toBe(1);
+
+        const audit = await prisma.auditLog.findFirst({
+            where: { targetId: user.id, actorType: "SYSTEM" },
+        });
+        expect(audit).not.toBeNull();
+        expect(audit?.metadata).toMatchObject({ email: user.email, allowUnverified: true });
+        expect(JSON.stringify(audit?.metadata)).not.toMatch(/pin|password|secret|token|hash|pepper/i);
+    });
+
+    it("finds a mixed-case stored row via insensitive lookup (BH8)", async () => {
+        // Stored verbatim in mixed case (row written outside better-auth).
+        const stored = `1C-Mixed-${Date.now()}-${seq}@Test.LOCAL`;
+        const user = await createTestUser("1c-mixed", { emailOverride: stored });
+        const parsed = parseSuperadminEmails(stored.toLowerCase());
+        const report = await runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, allowUnverified: true });
+        expect(report.plan[0].found).toBe(true);
+        expect(report.plan[0].userId).toBe(user.id);
+        expect(report.promoted).toBe(1);
+        expect((await prisma.user.findUnique({ where: { id: user.id } }))?.platformRole).toBe("ADMIN");
+    });
+
+    it("is idempotent: second run promotes nothing and writes zero new audit entries (BH12)", async () => {
+        const user = await createTestUser("1c-idem");
+        const parsed = parseSuperadminEmails(user.email);
+        const base = { prisma, allowlist: parsed, target: TARGET, allowUnverified: true } as const;
+
+        const first = await runSuperadminSeed(base);
+        expect(first.promoted).toBe(1);
+        const auditAfterFirst = await auditCountFor(user.id);
+        expect(auditAfterFirst).toBe(1);
+
+        const second = await runSuperadminSeed(base);
+        expect(second.promoted).toBe(0);
+        expect(second.auditEntries).toBe(0);
+        expect(await auditCountFor(user.id)).toBe(auditAfterFirst); // no new entries
+        expect((await prisma.user.findUnique({ where: { id: user.id } }))?.platformRole).toBe("ADMIN");
+    });
+
+    it("reports ADMIN-not-in-allowlist as drift without demoting (BH7)", async () => {
+        const admin = await createTestUser("1c-drift-admin", { platformRole: "ADMIN" });
+        const other = await createTestUser("1c-drift-other"); // in allowlist, stays USER
+        const parsed = parseSuperadminEmails(other.email);
+        const report = await runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, allowUnverified: true });
+
+        expect(report.drift.find((d) => d.userId === admin.id)).toMatchObject({
+            email: admin.email,
+            name: admin.name,
+        });
+        // NOT demoted:
+        expect((await prisma.user.findUnique({ where: { id: admin.id } }))?.platformRole).toBe("ADMIN");
+    });
+
+    it("dry-run produces the plan without changing any row", async () => {
+        const user = await createTestUser("1c-dryrun");
+        const parsed = parseSuperadminEmails(user.email);
+        const report = await runSuperadminSeed({ prisma, allowlist: parsed, target: TARGET, dryRun: true, allowUnverified: true });
+        expect(report.plan[0].willPromote).toBe(true);
+        expect(report.promoted).toBe(0);
+        expect((await prisma.user.findUnique({ where: { id: user.id } }))?.platformRole).toBe("USER");
+        expect(await auditCountFor(user.id)).toBe(0);
+    });
+});
+
+describe("Story 1c — seeder core guards (no DB needed)", () => {
+    it("rejects an allowlist containing invalid entries before any DB work", async () => {
+        const parsed = parseSuperadminEmails("a@b.c,not-an-email");
+        await expect(
+            runSuperadminSeed({ prisma: {} as never, allowlist: parsed, target: TARGET })
+        ).rejects.toBeInstanceOf(SeedConfigError);
+    });
+});
diff --git a/src/lib/audit-metadata.ts b/src/lib/audit-metadata.ts
new file mode 100644
index 0000000..0e5d1cb
--- /dev/null
+++ b/src/lib/audit-metadata.ts
@@ -0,0 +1,81 @@
+/**
+ * AuditLog metadata redaction (Story 1c, deferred-work BH6).
+ *
+ * The schema comment on `AuditLog.metadata` forbids PIN/hash/secrets, but
+ * nothing enforces it mechanically. Every AuditLog writer (this story's
+ * seeder first, Stories 3–5 after) passes its metadata through
+ * `redactMetadata()` so the invariant holds by construction:
+ *
+ *   output is ALWAYS safe to store in `AuditLog.metadata` —
+ *   sensitive keys redacted, non-JSON-safe values dropped, strings
+ *   truncated, depth/cycles guarded.
+ */
+
+const REDACTED = "[REDACTED]";
+const MAX_STRING_LENGTH = 256;
+const MAX_DEPTH = 6;
+
+/** Substring, case-insensitive — "studentPin", "AUTH_TOKEN", "accessPinHash" all match. */
+const SENSITIVE_KEY_PATTERN = /pin|password|secret|token|hash|pepper|authorization|cookie/i;
+
+function isPlainObject(value: unknown): value is Record<string, unknown> {
+    return typeof value === "object" && value !== null && !Array.isArray(value);
+}
+
+function redactValue(value: unknown, keyHint: string | undefined, depth: number, seen: WeakSet<object>): unknown {
+    if (keyHint !== undefined && SENSITIVE_KEY_PATTERN.test(keyHint)) {
+        return REDACTED; // any value type under a sensitive key
+    }
+    if (value === null) return null;
+    const type = typeof value;
+    if (type === "string") {
+        const str = value as string;
+        return str.length > MAX_STRING_LENGTH ? str.slice(0, MAX_STRING_LENGTH) : str;
+    }
+    if (type === "number") return Number.isFinite(value as number) ? value : null;
+    if (type === "boolean") return value;
+    if (type === "bigint" || type === "function" || type === "symbol" || type === "undefined") {
+        return undefined; // dropped by the caller
+    }
+    if (value instanceof Date) {
+        return value.toISOString(); // Json-safe
+    }
+    if (Array.isArray(value)) {
+        if (depth >= MAX_DEPTH) return undefined;
+        if (seen.has(value)) return undefined; // cycle guard
+        seen.add(value);
+        const out = value
+            .map((item) => redactValue(item, undefined, depth + 1, seen))
+            .filter((item) => item !== undefined);
+        seen.delete(value);
+        return out;
+    }
+    if (isPlainObject(value)) {
+        if (depth >= MAX_DEPTH) return undefined;
+        if (seen.has(value)) return undefined; // cycle guard
+        seen.add(value);
+        const out = redactRecord(value, depth + 1, seen);
+        seen.delete(value);
+        return out;
+    }
+    return undefined; // Map/Set/class instances etc. — dropped
+}
+
+function redactRecord(record: Record<string, unknown>, depth: number, seen: WeakSet<object>): Record<string, unknown> {
+    const out: Record<string, unknown> = {};
+    for (const [key, value] of Object.entries(record)) {
+        const redacted = redactValue(value, key, depth, seen);
+        if (redacted !== undefined) {
+            out[key] = redacted;
+        }
+    }
+    return out;
+}
+
+export function redactMetadata(input: Record<string, unknown>): Record<string, unknown> {
+    const seen = new WeakSet<object>();
+    seen.add(input); // direct self/back references from the top level drop immediately
+    return redactRecord(input, 0, seen);
+}
+
+export { REDACTED, SENSITIVE_KEY_PATTERN };
diff --git a/src/lib/superadmin-allowlist.ts b/src/lib/superadmin-allowlist.ts
new file mode 100644
index 0000000..26c3a7c
--- /dev/null
+++ b/src/lib/superadmin-allowlist.ts
@@ -0,0 +1,50 @@
+/**
+ * Superadmin allowlist parser (Story 1c) — pure util, zero dependencies.
+ *
+ * Contract (spec-student-portal-auth/stories/1c-allowlist-seeder-superadmin.md,
+ * Design Notes "Parser" + elicitation F6):
+ * - trim + lowercase each entry, dedupe (first occurrence order preserved);
+ * - collect ALL invalid entries at once (no fail-on-first) into `invalid`
+ *   (raw, pre-normalization, for the report);
+ * - empty segments after trim (from ",,," or trailing commas) are list-syntax
+ *   noise — silently dropped, NOT invalid;
+ * - unset / empty / whitespace-only / ",,," env ⇒ { emails: [], invalid: [] }
+ *   — the seeder fail-fasts on that (empty allowlist never touches the DB);
+ * - quoted values (e.g. `"a@b.c"` leaking from CI YAML) fail validation —
+ *   the quote characters are not valid email syntax.
+ */
+
+export interface ParsedAllowlist {
+    /** Normalized (trim+lowercase), deduped, syntactically valid emails. */
+    emails: string[];
+    /** Raw entries that failed syntax validation (reported, then abort). */
+    invalid: string[];
+}
+
+/** Pinned syntax validator — deliberately simple (contract, not RFC 5322).
+ * Quote characters are rejected so CI-YAML-quoted values fail fast (F6). */
+const EMAIL_PATTERN = /^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/;
+
+export function parseSuperadminEmails(env: string | undefined): ParsedAllowlist {
+    if (env === undefined || env.trim() === "") {
+        return { emails: [], invalid: [] };
+    }
+    const emails: string[] = [];
+    const invalid: string[] = [];
+    const seen = new Set<string>();
+    for (const rawEntry of env.split(",")) {
+        const normalized = rawEntry.trim().toLowerCase();
+        if (normalized === "") {
+            continue; // ",,," / trailing commas — syntax noise, not an entry
+        }
+        if (!EMAIL_PATTERN.test(normalized)) {
+            invalid.push(rawEntry.trim());
+            continue;
+        }
+        if (!seen.has(normalized)) {
+            seen.add(normalized);
+            emails.push(normalized);
+        }
+    }
+    return { emails, invalid };
+}
diff --git a/src/lib/superadmin-seeder.ts b/src/lib/superadmin-seeder.ts
new file mode 100644
index 0000000..93eea3a
--- /dev/null
+++ b/src/lib/superadmin-seeder.ts
@@ -0,0 +1,280 @@
+import type { PrismaClient, Prisma } from "@prisma/client";
+import type { Pool } from "pg";
+import { redactMetadata } from "./audit-metadata";
+import type { ParsedAllowlist } from "./superadmin-allowlist";
+
+/**
+ * Superadmin seeder core (Story 1c) — testable module; the CLI in
+ * `scripts/seed-superadmin.ts` is a thin env/exit-code wrapper.
+ *
+ * Contract highlights (spec 1c Design Notes, incl. elicitation F3/F4):
+ * - ALL validation happens up front; then lookup + UPDATE + AuditLog insert
+ *   run inside ONE interactive transaction with an explicit timeout —
+ *   plan and apply cannot drift apart (TOCTOU), and a promotion without its
+ *   audit entry is impossible.
+ * - All-or-nothing: any unknown email (or an unverified one without
+ *   --allow-unverified) aborts BEFORE any write; zero rows change.
+ * - Idempotent: only actual state changes (USER -> ADMIN) are written and
+ *   audited; a no-op re-run writes nothing.
+ * - Never demotes: ADMIN users missing from the allowlist are reported as
+ *   drift warnings (BH7); demotion stays a deliberate future decision.
+ * - Email lookup is case-insensitive on the normalized value (BH8).
+ */
+
+const AUDIT_ACTION_PROMOTE = "SUPERADMIN_PROMOTE";
+const TRANSACTION_TIMEOUT_MS = 15_000;
+
+export class SeedAbortError extends Error {
+    constructor(
+        message: string,
+        public readonly report: SeederReport
+    ) {
+        super(message);
+        this.name = "SeedAbortError";
+    }
+}
+
+export class SeedConfigError extends Error {
+    constructor(message: string) {
+        super(message);
+        this.name = "SeedConfigError";
+    }
+}
+
+export interface SeedPlanEntry {
+    email: string;
+    found: boolean;
+    userId?: string;
+    name?: string;
+    emailVerified?: boolean;
+    currentPlatformRole?: string;
+    hasTeacherProfile?: boolean;
+    createdAt?: Date;
+    /** found && currentPlatformRole !== "ADMIN" — would be promoted on apply. */
+    willPromote: boolean;
+}
+
+export interface DriftEntry {
+    userId: string;
+    email: string;
+    name: string;
+    currentPlatformRole: string;
+    createdAt: Date;
+}
+
+export interface SeederReport {
+    target: { host: string; database: string };
+    dryRun: boolean;
+    allowUnverified: boolean;
+    plan: SeedPlanEntry[];
+    /** ADMIN users whose email is NOT in the allowlist (warning only, BH7). */
+    drift: DriftEntry[];
+    /** Plan entries that exist but are emailVerified=false (RT1 gate). */
+    unverified: SeedPlanEntry[];
+    /** Plan entries with no matching User row. */
+    unknown: SeedPlanEntry[];
+    promoted: number;
+    auditEntries: number;
+}
+
+interface UserRow {
+    id: string;
+    name: string;
+    email: string;
+    emailVerified: boolean;
+    platformRole: string;
+    createdAt: Date;
+}
+
+type Tx = Prisma.TransactionClient;
+
+async function findUserInsensitive(tx: Tx, email: string): Promise<UserRow | null> {
+    // mode:"insensitive" over the normalized value (BH8). If the PrismaPg
+    // adapter ever rejects it, door criteria catch it; LOWER() raw is the
+    // documented fallback (elicitation F9).
+    return tx.user.findFirst({
+        where: { email: { equals: email, mode: "insensitive" } },
+        select: {
+            id: true,
+            name: true,
+            email: true,
+            emailVerified: true,
+            platformRole: true,
+            createdAt: true,
+        },
+    });
+}
+
+export async function runSuperadminSeed(options: {
+    prisma: PrismaClient;
+    allowlist: ParsedAllowlist;
+    target: { host: string; database: string };
+    dryRun?: boolean;
+    allowUnverified?: boolean;
+    /** Optional pool so tests reusing a shared client can pass the same target info. */
+    pool?: Pool;
+}): Promise<SeederReport> {
+    const { prisma, allowlist, target } = options;
+    const dryRun = options.dryRun ?? false;
+    const allowUnverified = options.allowUnverified ?? false;
+
+    if (allowlist.invalid.length > 0) {
+        throw new SeedConfigError(
+            `Allowlist berisi entri tidak valid: ${allowlist.invalid.join(", ")}`
+        );
+    }
+    if (allowlist.emails.length === 0) {
+        throw new SeedConfigError(
+            "SUPERADMIN_EMAILS kosong/unset — seeder tidak berjalan (fail-fast)."
+        );
+    }
+
+    return prisma.$transaction(
+        async (tx) => {
+            const allowlistSet = new Set(allowlist.emails);
+
+            // --- Plan: lookup every allowlist email (same tx as apply — F4).
+            const plan: SeedPlanEntry[] = [];
+            for (const email of allowlist.emails) {
+                const user = await findUserInsensitive(tx, email);
+                const teacherProfile = user
+                    ? await tx.teacherProfile.findUnique({ where: { userId: user.id }, select: { userId: true } })
+                    : null;
+                plan.push({
+                    email,
+                    found: user !== null,
+                    userId: user?.id,
+                    name: user?.name,
+                    emailVerified: user?.emailVerified,
+                    currentPlatformRole: user?.platformRole,
+                    hasTeacherProfile: teacherProfile !== null,
+                    createdAt: user?.createdAt,
+                    willPromote: user !== null && user.platformRole !== "ADMIN",
+                });
+            }
+
+            // --- Drift: ADMIN users not in the allowlist (report-only — BH7).
+            const adminUsers = await tx.user.findMany({
+                where: { platformRole: "ADMIN" },
+                select: { id: true, email: true, name: true, platformRole: true, createdAt: true },
+            });
+            const drift: DriftEntry[] = adminUsers
+                .filter((u) => !allowlistSet.has(u.email.trim().toLowerCase()))
+                .map((u) => ({
+                    userId: u.id,
+                    email: u.email,
+                    name: u.name,
+                    currentPlatformRole: u.platformRole,
+                    createdAt: u.createdAt,
+                }));
+
+            const unknown = plan.filter((p) => !p.found);
+            const unverified = plan.filter((p) => p.found && p.emailVerified === false);
+
+            const baseReport: SeederReport = {
+                target,
+                dryRun,
+                allowUnverified,
+                plan,
+                drift,
+                unverified,
+                unknown,
+                promoted: 0,
+                auditEntries: 0,
+            };
+
+            // --- Gates (before ANY write; zero rows change on abort).
+            if (unknown.length > 0) {
+                throw new SeedAbortError(
+                    `Email tidak dikenal (tanpa row User): ${unknown.map((u) => u.email).join(", ")} — all-or-nothing, nol row diubah.`,
+                    baseReport
+                );
+            }
+            if (unverified.length > 0 && !allowUnverified) {
+                throw new SeedAbortError(
+                    `Email belum verified (anti perebutan email, RT1): ${unverified.map((u) => u.email).join(", ")} — jalankan ulang dengan --allow-unverified setelah memeriksa profil di laporan.`,
+                    baseReport
+                );
+            }
+
+            if (dryRun) {
+                return baseReport; // no writes inside this tx
+            }
+
+            // --- Apply: promote + audit per actual state change.
+            let promoted = 0;
+            let auditEntries = 0;
+            for (const entry of plan) {
+                if (!entry.willPromote || entry.userId === undefined) continue;
+                await tx.user.update({
+                    where: { id: entry.userId },
+                    data: { platformRole: "ADMIN" },
+                });
+                promoted += 1;
+                await tx.auditLog.create({
+                    data: {
+                        actorType: "SYSTEM",
+                        action: AUDIT_ACTION_PROMOTE,
+                        targetType: "USER",
+                        targetId: entry.userId,
+                        metadata: redactMetadata({
+                            email: entry.email,
+                            source: "SUPERADMIN_EMAILS",
+                            allowUnverified: entry.emailVerified === false ? true : undefined,
+                        }) as Prisma.InputJsonValue,
+                    },
+                });
+                auditEntries += 1;
+            }
+
+            return { ...baseReport, promoted, auditEntries };
+        },
+        { timeout: TRANSACTION_TIMEOUT_MS }
+    );
+}
+
+/** Human-readable report for stdout (the story's core deliverable). */
+export function formatSeederReport(report: SeederReport): string {
+    const lines: string[] = [];
+    lines.push(`DB target : ${report.target.host}/${report.target.database}`);
+    lines.push(`Mode      : ${report.dryRun ? "DRY-RUN (nol row diubah)" : "APPLY"}${report.allowUnverified ? " + allow-unverified" : ""}`);
+    lines.push("");
+    lines.push("Rencana (allowlist):");
+    for (const p of report.plan) {
+        const flags = [
+            p.found ? `role=${p.currentPlatformRole}` : "TIDAK DITEMUKAN",
+            p.found ? `verified=${p.emailVerified}` : null,
+            p.found && p.hasTeacherProfile ? "TeacherProfile=ada" : null,
+            p.willPromote ? "AKAN-DIPROMOSI" : "sudah-ADMIN",
+        ].filter(Boolean);
+        lines.push(`  - ${p.email}${p.name ? ` (${p.name})` : ""} [${flags.join(", ")}]`);
+    }
+    if (report.drift.length > 0) {
+        lines.push("");
+        lines.push("PERINGATAN drift — ADMIN di luar allowlist (TIDAK didemosi otomatis, BH7):");
+        for (const d of report.drift) {
+            lines.push(`  ! ${d.email} (${d.name}, ${d.userId}, sejak ${d.createdAt.toISOString()})`);
+        }
+    }
+    if (report.unverified.length > 0) {
+        lines.push("");
+        lines.push(
+            report.allowUnverified
+                ? "PERINGATAN: bypass emailVerified aktif (--allow-unverified) — tercatat di audit metadata."
+                : "Email belum verified — profil di atas wajib diperiksa sebelum bypass."
+        );
+    }
+    lines.push("");
+    lines.push(`Hasil: promoted=${report.promoted}, auditEntries=${report.auditEntries}`);
+    return lines.join("\n");
+}
+
+/** Parse a DATABASE_URL into a display-safe target identity (host + dbname). */
+export function describeDatabaseTarget(databaseUrl: string): { host: string; database: string } {
+    try {
+        const url = new URL(databaseUrl);
+        return { host: url.hostname, database: url.pathname.replace(/^\//, "") || "(default)" };
+    } catch {
+        return { host: "(unparseable)", database: "(unparseable)" };
+    }
+}
diff --git a/scripts/seed-superadmin.ts b/scripts/seed-superadmin.ts
new file mode 100644
index 0000000..8c7b85c
--- /dev/null
+++ b/scripts/seed-superadmin.ts
@@ -0,0 +1,102 @@
+import { Pool } from "pg";
+import { PrismaPg } from "@prisma/adapter-pg";
+import { PrismaClient } from "@prisma/client";
+import { parseArgs } from "node:util";
+import { parseSuperadminEmails } from "../src/lib/superadmin-allowlist";
+import {
+    runSuperadminSeed,
+    formatSeederReport,
+    describeDatabaseTarget,
+    SeedAbortError,
+    SeedConfigError,
+} from "../src/lib/superadmin-seeder";
+
+/**
+ * Superadmin seeder CLI (Story 1c) — thin wrapper: env + args + client init
+ * + exit codes. All logic lives in the tested `src/lib/superadmin-seeder.ts`.
+ *
+ * Run: npm run seed:superadmin [-- --dry-run] [-- --allow-unverified]
+ * LOCAL DB ONLY — production schema moves via `prisma migrate deploy` (Never list).
+ */
+
+async function main(): Promise<number> {
+    const { values } = parseArgs({
+        options: {
+            "dry-run": { type: "boolean", default: false },
+            "allow-unverified": { type: "boolean", default: false },
+        },
+    });
+
+    // --- Parse + validate allowlist BEFORE touching the DB (matrix rows 2-3).
+    const allowlist = parseSuperadminEmails(process.env.SUPERADMIN_EMAILS);
+    if (allowlist.emails.length === 0 && allowlist.invalid.length === 0) {
+        console.error(
+            "SUPERADMIN_EMAILS kosong/unset — seeder tidak berjalan. " +
+                "Isi dengan email superadmin (dipisah koma) di environment / .env."
+        );
+        return 1;
+    }
+    if (allowlist.invalid.length > 0) {
+        console.error("Entri allowlist tidak valid (ditolak sebelum DB disentuh):");
+        for (const entry of allowlist.invalid) {
+            console.error(`  - "${entry}"`);
+        }
+        return 1;
+    }
+
+    const databaseUrl = process.env.DATABASE_URL;
+    if (!databaseUrl) {
+        console.error("DATABASE_URL tidak ter-set — periksa .env (script memuat .env otomatis).");
+        return 1;
+    }
+    const target = describeDatabaseTarget(databaseUrl);
+
+    // --- Client init mirrors src/lib/auth.ts (Pool + PrismaPg + PrismaClient).
+    const pool = new Pool({ connectionString: databaseUrl, max: 5 });
+    const adapter = new PrismaPg(pool);
+    const prisma = new PrismaClient({ adapter, log: ["error"] });
+
+    try {
+        const report = await runSuperadminSeed({
+            prisma,
+            allowlist,
+            target,
+            dryRun: values["dry-run"],
+            allowUnverified: values["allow-unverified"],
+        });
+        console.log(formatSeederReport(report));
+        if (values["allow-unverified"]) {
+            console.log(
+                "\nPERINGATAN: --allow-unverified aktif — pastikan profil di laporan sudah diperiksa (anti perebutan email RT1). Tercatat di audit metadata."
+            );
+        }
+        return 0;
+    } catch (error) {
+        if (error instanceof SeedConfigError || error instanceof SeedAbortError) {
+            console.error(`\nSEEDER DIBATALKAN: ${error.message}`);
+            if (error instanceof SeedAbortError) {
+                console.error("\n--- Laporan (nol row diubah) ---");
+                console.error(formatSeederReport(error.report));
+            }
+            return 1;
+        }
+        console.error("Seeder gagal (tak terduga):", error instanceof Error ? error.message : error);
+        return 1;
+    } finally {
+        // --- Explicit shutdown (elicitation C1/F2): pool keeps the event loop
+        // alive; set exitCode and let stdout drain naturally — hard exit is
+        // only a fallback if something still holds the loop open.
+        await prisma.$disconnect();
+        await pool.end();
+    }
+}
+
+main()
+    .then((code) => {
+        process.exitCode = code;
+    })
+    .catch(() => {
+        process.exitCode = 1; // main() handles its own errors; belt-and-braces
+    });
+// Fallback hard-exit if anything unexpected still keeps the loop alive (CI safety).
+setTimeout(() => process.exit(process.exitCode ?? 0), 5_000).unref();

===== END DIFF =====

Do not invoke any skill, and do not spawn subagents of your own — you are the reviewer. If the instruction file is unreadable, report that exact failure and stop. Return your findings as text in your final message; do not route them through any findings-reporting tool the host may offer.
