# Elicitation Report — Story 1: Fondasi Database & Primitif Keamanan

> **Sesi:** BMad Advanced Elicitation · 2026-09-20
> **Target:** `stories/1-fondasi-database-primitif-keamanan.md`
> **Metode (5, dijalankan berurutan, masing-masing Apply penuh):**
> 1. Security Audit Personas (#69)
> 2. Boundary & Edge Case Sweep (#71)
> 3. Assumption Audit (#64)
> 4. Pre-mortem Analysis (#59)
> 5. Red Team vs Blue Team (#21)
>
> **Total dampak:** ~56 edit · 10 titik frozen direnegosiasi (semua disetujui human owner) ·
> jejak lengkap per ronde tercatat di *Spec Change Log* story.

---

## Ringkasan Eksekutif

Story fondasi diaudit dari lima sudut: keamanan (persona hacker/defender/auditor),
batas & tepi kasus, asumsi tersembunyi, kegagalan masa depan (pre-mortem), dan serangan
adversarial (red team vs blue team). Dua asumsi pecah saat diuji terhadap repo nyata
(`tsx` tidak terpasang; penamaan `stage11` tanpa akar), satu kontradiksi internal ditutup
(`User` = tabel Better Auth), dan satu serangan kritis ditemukan & dipertahankan
(perebutan email allowlist sebelum seeder). Semua perbaikan sudah **ditulis langsung ke
story** — file ini adalah laporan perubahan, bukan daftar tugas terpisah.

---

## Ronde 1 — Security Audit Personas (#69)

Persona: **Rey** (red teamer) · **Dina** (defender) · **Ayu** (auditor)

| # | Severity | Temuan | Perubahan |
|---|----------|--------|-----------|
| R1 | 🔴 | PIN 4-digit + dump DB = brute-force offline 10.000 kombinasi (B3 hanya lindungi jalur online) | Pepper `PIN_PEPPER` (HMAC sebelum scrypt, fail-fast ala `getAuthSecret()`) — task, Design Notes, `.env.example` |
| R2 | 🟡 | `verifyPin` parse params dari string hash → hash korup `N` raksasa = DoS memori | Cap parameter parse + `maxmem` eksplisit + baris matriks hash korup + acceptance |
| R3 | 🟡 | `joinCode` tanpa `@unique` → join-by-code ambigu & tanpa index | `joinCode String? @unique` (murni `CREATE UNIQUE INDEX`, banyak NULL diizinkan Postgres) |
| R4 | 🔵 | `timingSafeEqual` throw bila panjang buffer beda | Pre-check panjang buffer |
| D1 | 🟡 | Parameter scrypt tidak dipatok | Dipatok: `N=16384, r=8, p=1, keyLen=32, salt 16B` |
| D2 | 🟡 | **Kontradiksi internal**: `User` = tabel Better Auth (`@@map("user")`), Never melarang menyentuhnya tapi Task menambah `platformRole` | ⚠️ *Frozen*: Never diklarifikasi — kolom aditif ber-default = pengecualian disengaja (N1) |
| D3 | 🔵 | Guard butuh role tanpa menyentuh `auth.ts` | `platformRole` tersedia via `session.user` (adapter Prisma kembalikan row mentah) |
| D4 | 🔵 | SPEC bilang 4-digit tapi matriks tak menolak `"12345"` | ⚠️ *Frozen*: + baris matriks; `validatePinFormat` dipatok `/^\d{4}$/` |
| A1 | 🟡 | Append-only `AuditLog` hanya konvensi; metadata bisa bocor secret | Aturan redaksi metadata + utang penegakan DB-level dicatat |
| A2 | 🟡 | `actorId` nullability tak dispesifikasi | `actorId String?` (null untuk `SYSTEM`) |
| A3 | 🟡 | Seeder ambigu (partial-apply?) + email case-sensitive Postgres | ⚠️ *Frozen*: baris seeder → **all-or-nothing**; + baris email campuran case (trim+lowercase) |
| A4 | 🔵 | Acceptance seeder tanpa jalur test otomatis | Parser dipisah ke `src/lib/superadmin-allowlist.ts` + test baru |

---

## Ronde 2 — Boundary & Edge Case Sweep (#71)

| # | Severity | Temuan | Perubahan |
|---|----------|--------|-----------|
| S4 | 🔴 | **Koreksi self-bug Ronde 1**: cap `N≤2^20, r=32` berlubang (`128×N×r` bisa 1–4 GB, lolos cap tapi OOM) | ⚠️ *Frozen* (konsekuensi): aturan memori tunggal — `maxmem` eksplisit (mis. 64 MB), param di atasnya ditolak parse, error scrypt apa pun → `false` |
| S7 | 🔴 | Kasus produksi paling umum — **tanpa sesi** — tak punya kontrak guard | ⚠️ *Frozen*: + baris matriks + acceptance |
| S8 | 🔴 | `!== "USER"` pada guard meloloskan nilai role asing jadi admin | **Deny-by-default strict equality** `=== "ADMIN"`; ⚠️ *Frozen* tidak perlu — task + design + test `"MODERATOR"` |
| S1 | 🟡 | `hashPin` bisa dipanggil tanpa validasi | Kontrak: `hashPin` memanggil `validatePinFormat` dulu (defense in depth) |
| S3 | 🟡 | Perilaku `verifyPin` pada input invalid tak terdefinisi | ⚠️ *Frozen*: + baris matriks; kontrak asimetris: `verifyPin` → `false` (boolean hot-path), `hashPin` → throw |
| S5 | 🟡 | Entri non-email lolos parser → pesan menyesatkan di DB | ⚠️ *Frozen*: + baris matriks (ditolak saat parse); test |
| S6 | 🔵 | `unset` (undefined) ≠ `""`; `,,,` tak terdefinisi | ⚠️ *Frozen*: baris diperluas `"" / unset`; `,,,` masuk test |
| S9 | 🟡 | Pepper dibaca per-panggilan → crash runtime di login pertama, bukan saat deploy | `PIN_PEPPER` resolve saat **module load** (mirror `getAuthSecret()`) |
| S10 | 🟡 | Nullability `AuditLog` baru sebagian | `actorId/targetId/ip String?`, `metadata Json?`, `createdAt @default(now())` |
| S2 | 🔵 | Digit Unicode kebetulan ditolak `\d` ASCII | Dikunci jadi kontrak test eksplisit |

---

## Ronde 3 — Assumption Audit (#64)

**22 asumsi diaudit → 7 terverifikasi jadi fakta, 2 pecah saat diuji, 4 dishoring.**

### ❌ Pecah saat diuji

| # | Asumsi | Temuan | Perbaikan |
|---|--------|--------|-----------|
| A8 | `npx tsx` akan jalan | `tsx` **tidak ada** di `package.json` — jalur lahir superadmin bergantung unduhan on-the-fly npx | + Task `package.json` (`tsx` devDependency + script `seed:superadmin`); Code Map & Verification → `npm run seed:superadmin` |
| A21 | `stage11_foundation` konsisten | Angka 11 tanpa akar — history berakhir `stage_09_import_session` lalu beralih deskriptif | Nama migrasi → **`student_portal_foundation`** |

### ✅ Terverifikasi terhadap repo (baseline dicatat di Implementation Notes)

- `npx tsc --noEmit` → **exit 0** (2026-09-20)
- `npx prisma migrate status` → **"Database schema is up to date!"** (18 migrasi, nol drift)
- Line number Code Map eksak: `Student :263`, `Class :357`, `User :155`, `EntityStatus :26`
- `AcademicPeriod.status` bertipe `String` ✓ · vitest ^4.1.11 · better-auth ^1.6.29 · prisma ^7.9.1 ✓
- `scripts/` & `.env.example` ada ✓

### Shoring asumsi tak teruji

| # | Risiko | Shore |
|---|--------|-------|
| A13 | Rotasi pepper = lockout massal diam-diam | Design Note kebijakan rotasi (sebelum produksi gratis; pasca = re-issue massal; opsi versi pepper) |
| A4 | Better Auth menimpa `platformRole` saat update user | Manual check: login guru pasca-seeder → ADMIN tak ter-reset |
| A15 | `session.user` tak memuat field asing di versi tertentu | Fallback `prisma.user.findUnique` by `session.userId` — tetap tanpa ubah `auth.ts` |
| A1 | "475 test" drift saat merge | ⚠️ *Frozen*: door criteria → "seluruh test lama (475 saat story ditulis)" |

---

## Ronde 4 — Pre-mortem Analysis (#59)

*"Beberapa bulan lagi, story sudah di-merge, bencana terjadi — kenapa?"*

| Skenario | Severity | Pencegahan |
|----------|----------|------------|
| **A — Seeder/migrasi menghantam DB salah** (orang salah jadi superadmin di prod) | 🔴 | Seeder wajib cetak **identitas DB target** (host+dbname) sebelum apply · mode **`--dry-run`** · Verification: `migrate dev` hanya lokal, prod via `migrate deploy` |
| **B — `migrate dev` macet shadow DB → improvise `db push` → drift history** | 🟡 | Code Map mereferensikan `scripts/create-shadow-db.js` (bekas luka tim, `localhost:51214`) + larangan `db push` eksplisit |
| **C — Deploy Story 3 crash seluruh platform** (`PIN_PEPPER` belum di env prod; fail-fast module-load baru aktif saat modul pertama diimpor) | 🟡 | Design Note: `PIN_PEPPER` wajib terpasang **sebelum deploy Story 3** |
| **D — `AuditLog` raksasa tanpa pemilik kebijakan** | 🔵 | Design Note: retensi = keputusan upstream; sengaja tanpa purge/TTL |

---

## Ronde 5 — Red Team vs Blue Team (#21)

| Serangan | Hasil | Hardening |
|----------|-------|-----------|
| 🔴 **RT1 — Perebutan email**: register email allowlist lebih dulu (registrasi Better Auth terbuka) → seeder promote akun attacker | **Jebol** — "superadmin tak bisa diciptakan via register" benar sempit, tapi identitas bisa dicuri | Seeder cek **`emailVerified`**: belum verified → abort default; `--allow-unverified` escape hatch sadar (wajib — repo belum punya email verification, semua user `emailVerified=false`); cetak **profil user** (nama, emailVerified, createdAt); ⚠️ *Frozen*: + baris matriks |
| 🟡 **RT2 — Preseden plaintext**: `QuizStudentAccess.pin` & `classroomPin` tersimpan plaintext (terverifikasi di schema) — godaan meniru | Setengah jebol | Design Note: larangan eksplisit; utang "hash PIN quiz" untuk amendum |
| 🟡 **RT3 — Enumerasi via jenis error guard** | Setengah jebol | Satu error tunggal `SuperAdminRequiredError`, pesan statis identik semua jalur; test identitas error |
| 🔵 **RT4 — NODE_ENV salah konfig → pepper dev fallback diam-diam** | Bertahan, luka ringan | Komentar `.env.example` + opsi inverted-default di Design Notes |

**Pertahanan yang tahan (divalidasi positif):** pepper & `maxmem` vs dump-DB/DoS · deny-by-default guard · seeder all-or-nothing + dry-run + identitas DB · migrasi aditif terverifikasi manual.

---

## Dampak Kumulatif pada Story

| Bagian | Sebelum | Sesudah |
|--------|---------|---------|
| I/O Matrix | 12 baris | **17 baris** |
| Tasks | 8 | **12** (11 eksekusi + `package.json`) |
| Acceptance Criteria | 6 | **10** |
| Design Notes | 4 | **14** |
| Verification | 5 cmd + 1 manual | **7 cmd + 2 manual** |
| Spec Change Log | kosong | **5 entri** (jejak renegosiasi lengkap) |
| Implementation Notes | kosong | baseline terverifikasi 2026-09-20 |

## Utang yang Dicatat (bukan scope story ini)

1. **Hash PIN quiz plaintext** (`QuizStudentAccess.pin`, `Quiz.classroomPin`) → calon amendum baru.
2. **Penegakan DB-level append-only `AuditLog`** (REVOKE/trigger) → v1 konvensi service-only-create.
3. **Retensi `AuditLog`** → open question SPEC, keputusan upstream.

## Titik Frozen yang Direnegosiasi (10 — semua disetujui human)

1. Never-block: pengecualian disengaja `User.platformRole` (Ronde 1)
2. Matriks: + PIN >4 digit (Ronde 1)
3. Matriks: seeder email-tak-dikenal → all-or-nothing (Ronde 1)
4. Matriks: + email campuran case (Ronde 1)
5. Matriks: + verifyPin input invalid → `false` (Ronde 2)
6. Matriks: + guard tanpa sesi (Ronde 2)
7. Matriks: + seeder entri non-email (Ronde 2)
8. Matriks: env kosong diperluas `/ unset`; baris hash korup → aturan memori (Ronde 2)
9. Door criteria: "475 saat story ditulis" (Ronde 3)
10. Matriks: + seeder email belum verified (Ronde 5)

---

## Addendum — Pasca-Sesi (2026-09-20, dikonfirmasi saat restrukturisasi token)

1. **Token-gate Split (Build step-02)** terjadi setelah sesi elicitation ini: guard `requireSuperAdmin()` di-defer ke Story 5 — 4 baris matriks guard keluar dari frozen block story, task & test-nya dipindah. Seluruh kontrak hasil elicitation (deny-by-default `=== "ADMIN"`, tanpa sesi → denied, error tunggal anti enumerasi, fallback `findUnique`) dipertahankan utuh di `_bmad-output/implementation-artifacts/deferred-work.md` untuk dikonsumsi Story 5. Entri Ronde 2 (S7/S8), Ronde 3 (A15), dan Ronde 5 (RT3) di report ini yang menyangkut guard kini berlaku sebagai **kontrak historis yang dieksekusi di Story 5**, bukan di Story 1.
2. **Restrukturisasi token (maintenance, 2026-09-20):** detail Spec Change Log story dipindah ke report ini; kontrak teknis dikonsolidasi ke Design Notes; frozen block byte-identical (terverifikasi diff); nol perubahan semantik. Backup pra-restrukturisasi: `1-fondasi-database-primitif-keamanan.md.bak-pre-restructure`.
