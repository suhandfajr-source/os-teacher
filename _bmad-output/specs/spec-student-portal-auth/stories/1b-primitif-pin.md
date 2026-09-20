---
title: 'Story 1b — Primitif PIN Siswa (scrypt + pepper)'
type: 'feature'
created: '2026-09-20'
status: 'done'
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
- 2026-09-20 (review pass 1 patch): `resolvePinPepper` fail-closed untuk NODE_ENV ∉ {production, development, test}; guard `typeof storedHash` di `verifyPin`; cap parse salt ≤64 B/hash ≤128 B; regex hex panjang-genap; komentar `.env.example` diakuratkan (import-pertama + build/CI). Test +7 (boundary env, null-hash, odd-hex, oversized-segment, uppercase-hex, golden-vector, hazard-comment) + fix floating rejects → suite 42/42; `tsc` exit 0; full suite 516/517 — satu-satunya merah = `import.db-concurrency.test.ts` (flake pre-existing yang dikecualikan OQ1=A; lolos 2× sebelumnya hari ini, failure set tak berubah). Eksperimen triage: Node menolak p besar sinkron via maxmem (BH7 refuted); keylen tak dibatasi Node (ECH3 dikonfirmasi) — keduanya dicatat di Review Triage Log.

## Spec Change Log

- 2026-09-20 — Pecahan 3 arah Story 1 (Build step-02 token-gate, disetujui human): scope primitif PIN menjadi story ini. Seluruh pengerasan elicitation dipindah utuh; sejarah lengkap: `1-fondasi-database-primitif-keamanan.elicitation-report.md` (file selevel).
- 2026-09-20 — Elicitation 1b/1c (5 metode konsolidasi): opsi pengerasan pepper diperbaiki `NODE_ENV ∈ {development, test}` (vitest men-set test — tanpa ini opsi mematikan suite); kontrak async `crypto.scrypt` promisified (jangan `scryptSync` — blokir event loop ±50ms).
- 2026-09-20 — Build step-02: konsumsi entri deferred-work BH9 (instruksi human) — fallback `PIN_PEPPER` dev/test dipatok sebagai konstanta deterministik + assert di test; entri dihapus dari `deferred-work.md`. Tanpa ini hash run sebelumnya tak terverifikasi lintas restart (login dev gagal misterius). Baseline 1 test merah pre-existing dicatat di Code Map (keputusan OQ1=A kini terkunci di frozen block).

## Review Triage Log

Pass 1 (2026-09-20, 3 layer: blind-hunter 11 findings / edge-case-hunter 3 / verification-gap 1+1). Verdict counts: high 2, medium 5, low 5, false 1; 3 low/other ditolak via aturan. Semua entri patch diterapkan pass ini (no loopback: tidak ada intent_gap/bad_spec — spec sudah benar di titik kode menyimpang).

- **high — BH1 + ECH2 (grup, patch)**: `resolvePinPepper` return fallback konstanta publik untuk SEMUA `nodeEnv ≠ "production"` (undefined/"staging"/typo) — menyimpang dari Design Notes "fallback hanya bila NODE_ENV ∈ {development, test}"; deploy salah-konfigurasi diam-diam memakai konstanta ter-commit sebagai HMAC key (proteksi brute-force offline hangus). Fix: gate eksplisit dev/test + throw fail-closed untuk env asing.
- **medium — BH9 (grup BH1, patch)**: test boundary NODE_ENV hilang justru di titik kode menyimpang. Fix: test staging/"produciton"/unset (via dynamic import — param default JS membuat `resolvePinPepper(undefined)` tak terdistinguish dari env proses).
- **medium — ECH1 (patch)**: `verifyPin(pin, null/undefined)` → `parseStoredHash` memanggil `.split` DI LUAR try → TypeError menembus kontrak boolean; reachable via `accessPinHash` nullable (Student belum klaim). Fix: guard `typeof storedHash !== "string"` → false.
- **medium — ECH3 + VG-other (grup, patch)**: panjang segmen hex tak dibatasi — keylen = `parsed.hash.length` tak dibatasi Node via maxmem (VG verifikasi eksperimental: keylen 70 MB selesai tanpa throw di bawah maxmem 64 MB) → hash korup multi-MB mengarahkan alokasi scrypt tak terbatas, melanggar baris matriks "tanpa throw/OOM". Fix: cap parse salt ≤64 B / hash ≤128 B.
- **medium — VG-main (pre-verified, patch)**: derivasi KDF (urutan arg HMAC + operand scrypt) tidak ter-pin — roundtrip/format/determinisme/pepper-contribution semuanya tetap hijau bila konstruksi di-swap konsisten, padahal seluruh hash tersimpan mati (mode kegagalan BH9 pada skala code-drift). Fix: golden-vector test literal (`scrypt:16384:8:1:0011…eeff:bd3b…f51b` untuk PIN "1234" + negatif "5678").
- **medium — BH4 (patch)**: dua blok `it.each` rejection non-async dan `expect(hashPin(pin)).rejects…` tidak di-await — asersi rejection bisa tak tuntas sebelum test berakhir (green palsu). Fix: callback async + await.
- **low — BH2 + BH3 (grup, patch)**: komentar `.env.example` "REFUSES TO BOOT" overpromise (fail terjadi saat import pertama; modul belum punya konsumen; Next lazy per-route) + kebutuhan env build/CI tak terdokumentasi. Fix: reword komentar (import pertama, termasuk build/CI saat prerender).
- **low — BH8 (patch)**: hex panjang-ganjil lolos regex lalu di-truncate senyap oleh `Buffer.from(..., "hex")`. Fix: regex `(?:[0-9a-f]{2})+` + test odd-hex.
- **low — BH10 (patch)**: hex uppercase tak teruji (round-trip case-insensitive dipin dengan test) + hazard `vi.resetModules()` menciptakan class `PinFormatError` kedua — dikomentari di suite.
- **low — BH5 (REJECTED)**: produksi mengembalikan pepper tanpa trim — perilaku identik dengan mirror `getAuthSecret()` yang di-mandatkan spec (auth.ts:57–60 cek trim tapi return untrimmed); perubahan justru menyimpang dari kontrak mirror; kasus whitespace-padded env tak tercapai di pemakaian normal.
- **low — BH6 (REJECTED)**: minimum kekuatan PIN_PEPPER tak divalidasi — kebijakan baru di luar spec (Design Notes tidak menuntut), mirror juga tidak memilikinya, ops mengikuti instruksi generate 32-byte hex di `.env.example`; fix = guard/policy tambahan untuk state tak terdemonstrasi.
- **false — BH7 (REJECTED, refuted)**: klaim `p` raksasa (`scrypt:16:1:1e9`) membuat verifyPin berputar ber-menit — eksperimen: Node menolak sinkron `ERR_CRYPTO_INVALID_SCRYPT_PARAMS` bahkan untuk p legal-maksimum 524272 di bawah maxmem 64 MB (formula Node memperhitungkan `128·r·(N+p)`); rejection ditangkap wrapper → `false`. Putaran ber-menit mustahil.
- **rejected — BH11 (REJECTED by rule)**: fix-nya mengedit spec build ini (catatan stabilitas konstanta di Implementation Notes) — dilarang aturan triage; esensinya (konstanta load-bearing) sudah tercakup Design Notes + catatan BH9.

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
