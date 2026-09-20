---
title: 'Story 1b — Primitif PIN Siswa (scrypt + pepper)'
type: 'feature'
created: '2026-09-20'
status: 'draft'
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
- Door criteria: `tsc` bersih + seluruh test lama (475 saat story ditulis) hijau + test baru hijau.

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
- `src/lib/auth.ts` — **referensi pola, jangan diubah**: `getAuthSecret()` fail-fast (:53) — cermin pola resolve `PIN_PEPPER`.
- `src/lib/__tests__/auth.security.test.ts` — referensi gaya vitest (`describe/it/expect`, folder `__tests__`).
- `.env.example` — tambah `PIN_PEPPER` + komentar peringatan NODE_ENV; **jangan** sentuh entri lain.

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/student-pin.ts` — `validatePinFormat` / `hashPin` / `verifyPin` sesuai kontrak Design Notes di bawah.
- [ ] `.env.example` — dokumentasikan `PIN_PEPPER` + komentar peringatan NODE_ENV.
- [ ] `src/lib/__tests__/student-pin.test.ts` — seluruh baris matriks I/O di atas (termasuk digit Unicode `"١٢٣٤"`/`"１２３４"` ditolak).

**Acceptance Criteria:**
- Given matriks PIN di atas, when test dijalankan, then semua baris lulus persis.
- Given hash korup, param menuntut memori > `maxmem`, atau input kandidat format invalid, when `verifyPin` dipanggil, then return `false` tanpa throw.

## Implementation Notes

## Spec Change Log

- 2026-09-20 — Pecahan 3 arah Story 1 (Build step-02 token-gate, disetujui human): scope primitif PIN menjadi story ini. Seluruh pengerasan elicitation dipindah utuh; sejarah lengkap: `1-fondasi-database-primitif-keamanan.elicitation-report.md` (file selevel).
- 2026-09-20 — Elicitation 1b/1c (5 metode konsolidasi): opsi pengerasan pepper diperbaiki `NODE_ENV ∈ {development, test}` (vitest men-set test — tanpa ini opsi mematikan suite); kontrak async `crypto.scrypt` promisified (jangan `scryptSync` — blokir event loop ±50ms).

## Review Triage Log

## Design Notes

- Format hash `scrypt:{N}:{r}:{p}:{saltHex}:{hashHex}` (self-describing — params terenkode, eskalasi tanpa rehash massal). Param default `N=16384, r=8, p=1, keyLen=32B, salt=16B`.
- Aturan memori tunggal: `maxmem` eksplisit (mis. 64 MB); param yang menuntut `128×N×r` di atasnya ditolak saat parse; error scrypt apa pun saat verify → `false`. Pre-check panjang buffer sebelum `timingSafeEqual` (throw bila beda panjang).
- API async: `crypto.scrypt` promisified (bukan `scryptSync`) — `N=16384` memblokir event loop ±50ms per panggilan; hot-path login Story 3 wajib non-blocking.
- Format input: tepat 4 digit ASCII `/^\d{4}$/` (digit Unicode ditolak — kontrak test eksplisit).
- Pepper: PIN di-HMAC `PIN_PEPPER` sebelum scrypt — dump DB saja tak cukup untuk brute-force offline. `PIN_PEPPER` resolve saat **module load** (fail-fast boot production, mirror `getAuthSecret()`; fallback dev-only) — bukan crash runtime di login pertama. Wajib di env produksi **sebelum deploy Story 3** (Story 1b tidak diimpor app mana pun — boot tetap aman sekarang). Rotasi membatalkan SEMUA hash: gratis sebelum produksi; pasca-produksi = re-issue PIN massal (opsi masa depan: versi pepper terenkode di format). Opsi pengerasan: fallback hanya aktif bila `NODE_ENV ∈ {development, test}` — vitest men-set `NODE_ENV=test`; tanpa pengecualian ini, opsi mematikan test suite.
- Preseden berbahaya — JANGAN ditiru: `QuizStudentAccess.pin` & `Quiz.classroomPin` plaintext (di luar scope — Never; utang amendum). `accessPinHash` hanya via `hashPin`/`verifyPin`.

## Verification

**Commands:**
- `npx tsc --noEmit` — exit 0.
- `npm test` — seluruh test (lama + baru) hijau.

**Manual checks (if no CLI):**
- —
