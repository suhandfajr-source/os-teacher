---
title: 'Story 1c — Allowlist & Seeder Superadmin'
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
- `scripts/seed-superadmin.ts` — file baru; jalankan via `npm run seed:superadmin`.
- `package.json` — tambah `tsx` devDependency + script `"seed:superadmin": "tsx --env-file-if-exists=.env scripts/seed-superadmin.ts"` (tsx belum terpasang; tsx **tidak memuat `.env` otomatis** — repo tanpa dotenv; tanpa `--env-file-if-exists` seeder selalu fail-fast palsu).
- `src/lib/auth.ts` — **referensi pola, jangan diubah**: pg Pool + `PrismaPg` (:5,:23), `PrismaClient` init (:27). Seeder mengikuti pola init client ini.
- `src/lib/__tests__/auth.security.test.ts` — referensi gaya vitest.
- `.env.example` — tambah blok `SUPERADMIN_EMAILS` dengan komentar; **jangan** sentuh entri lain (`PIN_PEPPER` milik 1b).

## Tasks & Acceptance

**Execution:**
- [ ] `src/lib/superadmin-allowlist.ts` — parser pure sesuai Design Notes (Parser).
- [ ] `scripts/seed-superadmin.ts` — sesuai Design Notes (Seeder).
- [ ] `package.json` — `tsx` devDependency + script `seed:superadmin` (dengan `--env-file-if-exists=.env` — lihat Code Map).
- [ ] `.env.example` — dokumentasikan `SUPERADMIN_EMAILS`.
- [ ] `src/lib/__tests__/superadmin-allowlist.test.ts` — seluruh baris parser seeder pada matriks I/O (env kosong/whitespace/unset, duplikat, campuran case, koma ganda/`,,,`, entri non-email).

**Acceptance Criteria:**
- Given `SUPERADMIN_EMAILS` kosong/unset, when seeder dijalankan, then exit non-zero dan nol row berubah.
- Given allowlist berisi email tak dikenal atau entri non-valid, when seeder dijalankan, then nol row berubah (all-or-nothing), exit non-zero, laporan lengkap.
- Given email allowlist valid, when seeder dijalankan ulang, then idempotent (tanpa duplikat entri audit untuk state sama).

## Implementation Notes

## Spec Change Log

- 2026-09-20 — Pecahan 3 arah Story 1 (Build step-02 token-gate, disetujui human): scope allowlist+seeder menjadi story ini. Seluruh pengerasan elicitation dipindah utuh; sejarah lengkap: `1-fondasi-database-primitif-keamanan.elicitation-report.md` (file selevel).
- 2026-09-20 — Elicitation 1a (lintas story): koreksi typo frozen Never "`migrate migrate deploy`" → "`prisma migrate deploy`" (disetujui human).
- 2026-09-20 — Elicitation 1b/1c (5 metode konsolidasi): script seeder → `tsx --env-file-if-exists=.env ...` (tsx tak memuat .env otomatis — repo tanpa dotenv; C1 kritis); shutdown eksplisit `pool.end()`/`process.exit` + audit hanya saat perubahan state.

## Review Triage Log

## Design Notes

**Parser:**
- `parseSuperadminEmails(env)`: trim, lowercase, dedupe, validasi sintaks email (entri invalid ditolak saat parse), deteksi kosong (termasuk unset dan `,,,`).

**Seeder:**
- Validasi semua email dulu → **all-or-nothing** dalam satu transaksi (pg Pool + PrismaPg ala `src/lib/auth.ts`); `AuditLog` per aksi (`actorType="SYSTEM"`, metadata bebas secret); idempotent.
- Anti perebutan email (RT1): cek `emailVerified` + cetak profil user (nama, emailVerified, createdAt) di rencana — operator bisa konfirmasi pemilik sah.
- `--dry-run` mencetak rencana tanpa menulis; output selalu mencantumkan identitas DB target (host+dbname) sebelum apply (blast-radius wrong-DB).
- Shutdown eksplisit di akhir script: `await pool.end()` (+ `prisma.$disconnect()`) lalu `process.exit(code)` — Pool menjaga event loop hidup (script "selesai" tanpa exit → CI timeout). Audit hanya ditulis saat perubahan state nyata (no-op re-run = nol entri).
- Jalur seeder hanya untuk DB lokal; produksi via `prisma migrate deploy`; bila shadow DB gagal → `scripts/create-shadow-db.js`; jangan `db push`.

## Verification

**Commands:**
- `npx tsc --noEmit` — exit 0.
- `npm test` — seluruh test (lama + baru) hijau.
- `npm run seed:superadmin` (tanpa env) — fail-fast non-zero dengan pesan allowlist.
- `npm run seed:superadmin -- --dry-run` (env valid) — rencana + identitas DB target, nol row berubah.
- `npm run seed:superadmin` (env valid, 2×) — idempotent; run kedua tanpa entri audit baru. ⚠️ DB lokal saja.

**Manual checks:**
- Pasca-seeder: satu alur login guru; `platformRole="ADMIN"` tidak ter-reset oleh update user Better Auth.
