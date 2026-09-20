---
title: 'Story 1c — Allowlist & Seeder Superadmin'
type: 'feature'
created: '2026-09-20'
status: 'done'
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
- 2026-09-20 (review pass 1 patch): 18 grup temuan (2 high: fallback exit-0-on-hang + promosi arbitrer row kembar varian-case; 9 medium; 6 low; 3 rejected by rule; 2 defer) — semua patch in-tree: guard `dbAvailable` per-test, hard-exit `settled`+`??1`+30s, abort AMBIGUOUS utk kembar varian-case (`ambiguous` di report), laporan abort → stdout, denylist diperluas (key/credential/session/otp/bearer/jwt — enumerasi spec = floor), `url.host` (port), identitas DB dicetak SEBELUM init/koneksi, parseArgs dijaga, fail-fast via core (CLI render), fault-injection atomicitas F4, peringatan non-localhost, opsi `pool?` mati dihapus, `hasTeacherProfile=true` teruji. +18 test (formatter 6, CLI 5, integrasi +3, denylist +1, guard lintas suite). Verifikasi ulang: tsc+eslint bersih, **569/569 (48 file)**.

## Spec Change Log

- 2026-09-20 — Pecahan 3 arah Story 1 (Build step-02 token-gate, disetujui human): scope allowlist+seeder menjadi story ini. Seluruh pengerasan elicitation dipindah utuh; sejarah lengkap: `1-fondasi-database-primitif-keamanan.elicitation-report.md` (file selevel).
- 2026-09-20 — Elicitation 1a (lintas story): koreksi typo frozen Never "`migrate migrate deploy`" → "`prisma migrate deploy`" (disetujui human).
- 2026-09-20 — Elicitation 1b/1c (5 metode konsolidasi): script seeder → `tsx --env-file-if-exists=.env ...` (tsx tak memuat .env otomatis — repo tanpa dotenv; C1 kritis); shutdown eksplisit `pool.end()`/`process.exit` + audit hanya saat perubahan state.
- 2026-09-20 — Build step-02 (persiapan 1c): konsumsi 4 entri deferred-work review 1a yang menarget spec ini — BH6 `redactMetadata()`+test, BH7 semantik penyusutan (laporan drift tiap run, tanpa demosi otomatis), BH8 invariant lowercase terpecahkan dengan membaca better-auth 1.6.29 langsung (sign-up.mjs:165,222 — `normalizedEmail` lowercase di lookup DAN createUser; lookup insensitive tetap dipasang), BH12 test integrasi seeder (idempotensi + rollback) via pemisahan inti ke `src/lib/superadmin-seeder.ts`. Interpretasi door criteria "test lama" mengikuti presedepun OQ1=A 1b (failure-set comparison; baseline kini 520/520).
- 2026-09-20 — Elicitation menyeluruh 1c (pass terkonsolidasi 13 metode, ground-truth repo; nol temuan 🔴): (F1) koreksi premis dotenv — `vitest.config.ts:1` memuat `.env` via dotenv transitive/phantom sehingga test integrasi mewarisi `DATABASE_URL` tanpa plumbing (fix C1 tetap benar untuk CLI); (F2) shutdown `process.exitCode` + drain alami menggantikan hard `process.exit` (anti truncation stdout ter-pipe); (F4) batas transaksi dipatok — lookup+update+audit dalam SATU interactive tx + timeout eksplisit, edge concurrent-run diterima sadar; (F3) penguatan RT1 — laporan plan/drift menambah sinyal akun (platformRole, TeacherProfile) + audit metadata mencatat `allowUnverified:true` saat bypass; (F6) kontrak parser eksplisit (collect-all invalid, `{emails, invalid}`, validator dipatok, env berkutip = fail-fast); (F7) referensi test dikoreksi ke path asli `src/modules/imports/__tests__/import.db-concurrency.test.ts` + pola guard `dbAvailable`; (F8) catatan verifikasi C1 — dibuktikan run env-valid, fallback `node --import tsx`; (F5) split ditolak — diganti urutan commit 3 tahap (Implementation Notes). Semua perubahan non-frozen. Laporan lengkap: `1c-allowlist-seeder-superadmin.elicitation-report.md` (file selevel).

## Review Triage Log

Pass 1 (2026-09-20, 3 layer: blind-hunter 15 findings / edge-case-hunter 5 / verification-gap 3+5; banyak tumpang-tindih lintas layer — didedupe per root cause). Verdict counts (unik per grup): high 2, medium 9, low 6, false 0; 3 ditolak via aturan; 2 defer. Tidak ada intent_gap/bad_spec — semua route patch/defer/reject; seluruh patch diterapkan pass ini.

- **high — G2 (BH2+ECH4+VG-other2, patch)**: fallback hard-exit CLI default `?? 0` + timer 5s < `TRANSACTION_TIMEOUT_MS` 15s — hang/apply-lambat terbunuh dan keluar kode **0** (sukses palsu di CI). Fix: flag `settled`, `?? 1`, fallback 30s (> timeout tx).
- **high — G3 (BH4+ECH1+VG-other1, patch)**: `findFirst` insensitive + row kembar varian-case (unique Postgres case-sensitive) → promosi row arbitrer — kelas kebingungan identitas RT1, persis kelas row yang dibuktikan mungkin oleh test BH8 sendiri. Fix: `findMany take:2` + abort **AMBIGUOUS** (field `ambiguous` di report, semua kandidat dicetak, nol row tersentuh) + test kembar varian-case.
- **medium — G1 (BH1+VG-main1, patch)**: flag `dbAvailable` hanya dipakai `afterAll` — DB down = merah keras, bukan skip; insiden Neon cold-start terdokumentasi = bukti dampak. Fix: guard literal referensi (`if (!dbAvailable) { expect(true).toBe(true); return; }`) di semua test DB.
- **medium — G4 (ECH5+VG-other4, patch)**: laporan abort hanya ke stderr — matriks frozen menuntut "laporan lengkap di stdout". Fix: laporan → `console.log` (stdout); baris alasan tetap stderr.
- **medium — G5 (BH5, patch)**: denylist redaksi terlalu sempit untuk konsumen Stories 3–5 (`apiKey`/`credential`/`sessionId`/`otp`/`bearer`/`jwt` lolos). Enumerasi spec diperlakukan sebagai **floor** (kontrak inti "output selalu aman" dilayani oleh perluasan); pattern diperluas + test.
- **medium — G7 (BH7+VG-main2, patch)**: `formatSeederReport`/`describeDatabaseTarget` + seluruh CLI nol verifikasi otomatis — AC story literalnya keluaran CLI. Fix: 6 unit test formatter (identitas blast-radius, port, dry-run, drift, ambigu, bypass) + 5 test CLI spawn (`node --import tsx` fallback F8) memverifikasi exit code/pesan/identitas/peringatan.
- **medium — G8 (BH8+ECH2, patch)**: `url.hostname` membuang port — sinyal wrong-DB lokal multi-instance hilang. Fix: `url.host` + test pembeda port.
- **medium — G9 (BH9+ECH3, patch)**: `parseArgs` di luar try → flag typo = exit 1 senyap. Fix: dibungkus + pesan eksplisit + test `--dryrun`.
- **medium — G12 (BH12, patch)**: fail-fast allowlist diduplikasi CLI vs core (dua sumber kebenaran). Fix: core jadi satu sumber (`SeedConfigError`), CLI hanya merender (init Pool/Prisma lazy = tetap "sebelum DB disentuh").
- **medium — G16 (VG-main3, patch)**: atomicitas F4 tak diobservasi test (refactor audit keluar tx tetap hijau). Fix: test fault-injection via Proxy client — `auditLog.create` gagal untuk user kedua → user pertama rollback + nol entri audit.
- **low — G6 (BH6, patch)**: kontrak "hanya DB lokal" tak ditegakkan. Fix: peringatan mencolok saat host ≠ localhost (+ test).
- **low — G10 (BH10, patch)**: opsi `pool?: Pool` mati di API publik. Fix: dihapus + import `Pool` dibuang.
- **low — G13 (BH13, patch)**: pesan "script memuat .env otomatis" menyesatkan (loading oleh flag npm script). Fix: redaksi akurat.
- **low — G15 (BH15, patch)**: `hasTeacherProfile` tak pernah teruji true. Fix: test dengan row TeacherProfile nyata.
- **low — VG-other5 (patch)**: `--env-file-if-exists` butuh Node ≥ 20.12 tanpa deklarasi. Fix: catatan di `.env.example`; keputusan field `engines` → defer (kebijakan manifest seluruh app).
- **rejected — BH11 (fix = edit spec)**: penandaan item Verification yang disubstitusi test integrasi — deviasi sudah tercatat di Implementation Notes; mengedit checklist story build ini dilarang aturan triage.
- **low-rejected — BH14**: churn lockfile = artefak regen npm versi berbeda (machine-generated); tanpa bad outcome terdemonstrasi di repo; "verifikasi dengan npm pinned" = saran proses di luar scope.
- **defer — VG-other3**: `vitest.config.ts` mengimpor `dotenv/config` tapi dotenv phantom (transitive) — infra warisan env semua test integrasi (F1) bertumpu dependency tak terdeklarasi; pre-existing, bukan caused-by 1c.
- **defer — VG-other5b**: keputusan field `engines` (node >= 20.12) untuk seluruh app — kebijakan manifest, bukan keputusan seeder sendirian.

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
