---
title: 'Story 3 — Mesin Autentikasi Siswa'
type: 'feature'
created: '2026-09-21'
status: 'done'
baseline_commit: '92374690a1d2e6240b199b88686e3dbb3700fa7c'
route: 'full'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/execution-stages.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/architecture-diagrams.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/security-amendum.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/glossary.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Siswa belum memiliki akun login mandiri (G4); guru menjadi bottleneck pengisian nilai kuis/administrasi; serta belum ada mesin autentikasi NIS+PIN dengan isolasi sesi siswa dari guru, proteksi pembajakan akun (takeover via re-registration), dan benteng anti-brute-force (G7, B3, B4).

**Approach:** Bangun modul `student-auth` (sesi mandiri `klassa_student_session` via HMAC signed cookie terikat `pinUpdatedAt`, ko-eksis dengan better-auth, dan hash/verify PIN 4-digit scrypt+pepper dari 1b); implementasikan actions pendaftaran 4 cabang via kode rombel (`registerStudent` berbenteng anti-takeover), login NIS+PIN ter-scope sekolah (`loginStudent({ schoolId, nis, pin })`) berbenteng timing-defense dummy-verify & lockout persisten bertingkat (15m→1j→24j), `logoutStudent`, kendali kode rombel guru (generate/rotasi/lock), boot-time fail-fast di `src/instrumentation.ts`, serta selesaikan Gate N3 (audit backfill NIS kanonik).

## Boundaries & Constraints

**Always:**
- **Pencegahan Pembajakan Akun (Anti-Takeover)**: Pada `registerStudent`, jika siswa dengan NIS target ditemukan dan **`accessPinHash !== null`** (akun sudah terdaftar/aktif), pendaftaran **MUTLAK DITOLAK** (*"Akun siswa dengan NIS ini sudah terdaftar. Silakan login atau hubungi guru pengampu untuk mereset PIN jika lupa."*).
- **Scope Login Eksplisit**: `loginStudent` wajib menerima `{ schoolId: string, nis: string, pin: string }` (karena NIS unik per sekolah via `@@unique([schoolId, nis])`).
- **Gate N3 Wajib**: Seluruh `Student.nis` di DB wajib kanonik (trim, uppercase, `""` -> `null`) dan bebas duplikat sebelum actions siswa dibuka.
- **Isolasi Sesi & Invalidasi Token (B4)**: Cookie `klassa_student_session` (httpOnly, secure di prod, sameSite=lax, path=/). Payload token memuat `{ studentId, schoolId, pinUpdatedAt, iat, exp }`. `verifyStudentSession()` wajib memvalidasi `accountStatus === "ACTIVE"`, `status === "ACTIVE"`, dan `student.pinUpdatedAt === token.pinUpdatedAt` (otomatis logout jika PIN di-reset oleh guru atau akun di-ban).
- **Boot-Time Fail-Fast (`src/instrumentation.ts`)**: Hook `register()` wajib memanggil `resolvePinPepper()` dan `getStudentSessionSecret()`; di production (`NODE_ENV === "production"`), wajib throw error seketika saat boot jika secret kosong atau tidak aman.
- **Proteksi Brute-Force & Timing (B3)**:
  - Lockout persisten DB via `failedAttempts` dan `lockedUntil` ($5\times \rightarrow 15\text{ menit}$, $6\text{--}9\times \rightarrow 1\text{ jam}$, $\ge 10\times \rightarrow 24\text{ jam}$).
  - Pesan error login generik seragam: *"NIS atau PIN salah."*
  - **Dummy-Verify Defense**: Jika NIS tidak ditemukan atau `accessPinHash === null`, wajib jalankan `await verifyPin(pin, DUMMY_HASH)` secara asinkron agar durasi CPU scrypt identik dengan user valid (anti-enumerasi timing attack).
- **Pendaftaran 4 Cabang (`registerStudent`)**:
  - (a) NIS ada di sekolah, `accessPinHash === null`, nama cocok exact -> **ACTIVE (L0 Otomatis)**, set PIN, buat sesi langsung.
  - (b) NIS ada di sekolah, `accessPinHash === null`, nama beda -> **PENDING L1**, set PIN, tanpa sesi aktif.
  - (c) NIS baru di sekolah -> **PENDING L1**, buat Student baru status PENDING, set PIN, tanpa sesi aktif.
  - (d) Sudah di rombel lain pada periode aktif sama -> **TOLAK MUTLAK** (*"Siswa sudah terdaftar di rombel lain pada tahun ajaran ini."*).
- **Kode Rombel**: Format 6–8 karakter alfanumerik (uppercase, alfabet tanpa 0/O/1/I). Rate-limit percobaan 10x/jam/IP. Jika `joinCodeLocked === true`, pendaftaran ditolak.
- Seluruh query/mutasi siswa wajib memakai `SAFE_STUDENT_SELECT` (tanpa `accessPinHash`).

**Never:**
- Mengizinkan penimpaan `accessPinHash` via pendaftaran kode rombel jika akun sudah memiliki PIN aktif (re-registration takeover).
- Mengizinkan login tanpa parameter `schoolId`.
- Menggunakan session guru (`better-auth`) untuk autentikasi siswa.
- Mengembalikan `accessPinHash` ke klien dalam response apa pun.
- Membedakan pesan error atau timing response antara NIS tidak terdaftar vs PIN salah.
- Mengizinkan siswa pindah rombel sendiri via kode jika sudah aktif di rombel lain pada periode sama.
- Memakai memory-store sementara untuk rate-limiting login siswa (wajib persisten di DB).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Join Code Valid | Lookup kode aktif tidak terkunci | Konteks: `{ schoolName, className, academicYear, teacherName }` | Tidak ditemukan -> Error ("Kode rombel tidak valid") |
| Join Code Terkunci | `Class.joinCodeLocked === true` | Ditolak | Error ("Kode rombel dikunci oleh guru") |
| Daftar L0 (Klaim Otomatis) | NIS ada, `accessPinHash == null`, nama cocok | `accountStatus = "ACTIVE"`, PIN ter-hash, sesi siswa diset | Redirect ke portal siswa |
| Daftar L1 (Nama Mismatch) | NIS ada, `accessPinHash == null`, nama beda | `accountStatus = "PENDING"`, PIN ter-hash, tanpa sesi | Respon status PENDING ("Menunggu persetujuan guru") |
| Daftar L1 (Siswa Baru) | NIS belum ada di sekolah | Row baru status PENDING, tanpa sesi | Respon status PENDING ("Menunggu persetujuan guru") |
| Daftar Akun Sudah Ada | NIS ada dan `accessPinHash !== null` | Pendaftaran ditolak (Anti-Takeover) | Error ("Akun siswa dengan NIS ini sudah terdaftar. Silakan login...") |
| Daftar Ditolak (Rombel Lain) | NIS sudah di `ClassStudent` aktif lain | Pendaftaran dibatalkan | Error ("Siswa sudah terdaftar di rombel lain") |
| Login NIS Tidak Terdaftar | NIS asing di `schoolId` target | Dummy verify scrypt jalan, timing seragam | Pesan: "NIS atau PIN salah." |
| Login PIN Salah | NIS terdaftar di `schoolId`, PIN beda | `failedAttempts` +1, timing scrypt seragam | Pesan: "NIS atau PIN salah." |
| Login Lockout 5x | `failedAttempts >= 5` | `lockedUntil = now() + 15m` | Pesan: "Akun terkunci sementara karena 5x percobaan salah. Coba lagi dalam 15 menit." |
| Login Berhasil | `{ schoolId, nis, pin }` cocok, status ACTIVE | Reset `failedAttempts = 0`, `lockedUntil = null`, sesi diset | `{ success: true, redirect: "/siswa/portal" }` |
| Sesi Pasca Reset PIN | Token lama dengan `pinUpdatedAt` usang | Akses ditolak, cookie dibersihkan | Redirect ke `/siswa` untuk login ulang |
| Login Akun PENDING | Kredensial benar tapi status PENDING | Login ditolak | Pesan: "Akun Anda masih menunggu persetujuan guru." |
| Logout Siswa | Panggil `logoutStudent()` | Cookie `klassa_student_session` dihapus | Sesi Better Auth guru tetap utuh jika ada |

</frozen-after-approval>

## Code Map

- `src/lib/student-pin.ts` — Primitif PIN (Story 1b): `validatePinFormat`, `hashPin`, `verifyPin`, `resolvePinPepper`.
- `src/instrumentation.ts` — Next.js boot check `register()`: memanggil `resolvePinPepper()` dan `getStudentSessionSecret()` (fail-fast di production jika secret kosong/tidak aman).
- `src/modules/student-auth/student-session.ts` — Engine token sesi: signing HMAC-SHA256, verifikasi sesi, validasi status aktif DB & binding `pinUpdatedAt`, manajemen cookie `klassa_student_session` (sliding 7 hari, max 30 hari).
- `src/modules/student-auth/student-auth.actions.ts` — Server actions: `lookupJoinCode`, `registerStudent` (4 cabang berbenteng anti-takeover), `loginStudent({ schoolId, nis, pin })` (lockout persisten + dummy timing verify), `logoutStudent`.
- `src/modules/classes/class-join-code.actions.ts` — Server actions guru: `generateClassJoinCode`, `rotateClassJoinCode`, `lockClassJoinCode`.
- `scripts/backfill-student-canonical-nis.ts` — Script Gate N3: audit dan kanonisasi seluruh `Student.nis` di DB.
- `src/middleware.ts` — Proteksi rute `/siswa/portal/*` via `verifyStudentSession()`.

## Tasks & Acceptance

**Execution:**
- [x] `src/instrumentation.ts` & `package.json` — Buat hook `register()` untuk fail-fast boot check secret (`PIN_PEPPER`, `STUDENT_SESSION_SECRET`).
- [x] `scripts/backfill-student-canonical-nis.ts` & `package.json` — Buat script Gate N3, pasang script `audit:nis`, jalankan untuk memverifikasi kanonisasi NIS di database aktif.
- [x] `src/modules/student-auth/student-session.ts` & unit test — Implementasikan token sesi `klassa_student_session` (HMAC tamper-evident, payload `{ studentId, schoolId, pinUpdatedAt, iat, exp }`, sliding expiry 7/30 hari, isolasi dari better-auth).
- [x] `src/modules/classes/class-join-code.actions.ts` & unit test — Buat aksi guru untuk generate, rotasi, dan lock kode rombel kelas (alfabet 32 karakter tanpa karakter rancu).
- [x] `src/modules/student-auth/student-auth.actions.ts` & unit test — Bangun `lookupJoinCode`, `registerStudent` (4 cabang dengan blokir anti-takeover jika `accessPinHash !== null`), `loginStudent({ schoolId, nis, pin })` (dummy timing verify & lockout DB 15m/1j/24j), `logoutStudent`.
- [x] `src/modules/student-auth/__tests__/student-auth.security.test.ts` — Pengujian keamanan: timing defense (<1ms diff NIS ada vs absen), brute-force lockout, pencegahan takeover re-registration, dan koeksistensi sesi siswa↔guru.
- [x] `src/middleware.ts` — Wiring verifikasi sesi siswa pada rute `/siswa/portal/*`.

**Acceptance Criteria:**
- Given database siswa existing, when `npm run audit:nis` dijalankan, then seluruh NIS terkanonisasi (uppercase, trim, empty -> null) dan bebas duplikat.
- Given siswa mencoba mendaftar ulang dengan NIS yang sudah memiliki `accessPinHash`, when `registerStudent` dipanggil, then pendaftaran ditolak (anti-takeover).
- Given siswa mendaftar dengan NIS belum terdaftar/unclaimed dan nama cocok data guru, when `registerStudent` selesai, then status langsung `ACTIVE` (L0) dan sesi langsung aktif.
- Given siswa mendaftar dengan nama beda atau NIS baru, when diproses, then akun `PENDING` (L1) tanpa sesi otomatis.
- Given siswa sudah di rombel lain pada periode aktif sama, when mendaftar kode rombel baru, then sistem menolak pendaftaran.
- Given login dengan `{ schoolId, nis, pin }`, when NIS tidak terdaftar di sekolah tersebut, then durasi CPU setara verifikasi PIN riil (dummy verify aktif) dengan pesan generik *"NIS atau PIN salah."*
- Given 5x login salah berturut-turut, when percobaan ke-6 dilakukan, then akun terkunci selama 15 menit.
- Given PIN siswa di-reset oleh guru di database (`pinUpdatedAt` berubah), when request berikutnya dilakukan oleh browser dengan cookie lama, then sesi otomatis hangus dan diarahkan login ulang.
- Given browser dengan sesi login guru, when siswa login di tab sama via `klassa_student_session`, then kedua sesi tetap aktif independen.
- Given seluruh rangkaian test, when `npm test` dan `npm run verify:migrations` dijalankan, then lulus 100%.

## Implementation Notes

- **Anti-Takeover Rule**: Pendaftaran akun via kode rombel hanya diizinkan untuk siswa baru atau siswa terdata yang belum memiliki `accessPinHash` (`accessPinHash === null`). Jika sudah terisi, siswa wajib login biasa atau meminta reset PIN dari guru di Story 5.
- **Dummy Timing Defense**: Inisialisasi konstanta hash dummy (`scrypt:16384:8:1:...`) saat module load. Saat NIS tidak ditemukan atau siswa belum memiliki PIN, tetap panggil `await verifyPin(pin, DUMMY_HASH)` secara asinkron agar waktu CPU seragam (<1ms selisih).
- **Lockout Escalation**: `failedAttempts` di-increment saat login salah. Nilai 5: `lockedUntil = now + 15m`. Nilai 6-9: `now + 1h`. Nilai >= 10: `now + 24h`. Reset ke 0 hanya saat login berhasil atau di-reset guru.
- **Join Code Entropy**: Alfabet `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (32 karakter, tanpa 0/O, 1/I), panjang 6 karakter = $32^6 \approx 1,07$ miliar kombinasi unik.

## Spec Change Log

- 2026-09-21 — **Elicitation Refinement (Complete 71-Methods Synthesis: F1–F8)**:
  - **[F1 Critical]** Memasang guard anti-takeover pada `registerStudent`: menolak keras registrasi ulang jika akun sudah memiliki `accessPinHash`.
  - **[F2 Critical]** Mengoreksi signature `loginStudent` menjadi `{ schoolId, nis, pin }` eksplisit untuk menyelesaikan ambiguitas NIS antar-sekolah.
  - **[F3 Critical]** Mengikat `pinUpdatedAt` pada payload token sesi siswa untuk invalidasi instan saat PIN di-reset atau status akun di-ban.
  - **[F4 Medium]** Menambahkan `src/instrumentation.ts` `register()` hook untuk fail-fast boot check secret di production (melunasi utang Story 1b deferred).
  - **[F5 Medium]** Mempertegas penanganan konstanta `DUMMY_HASH` asinkron pada hot-path login NIS absen/unlinked (timing attack defense).
  - **[F6-F8 Low-Med]** Formula matematis eskalasi lockout bertingkat dan standarisasi pesan error generik.

## Review Triage Log

| ID | Severity | Finding & Action Taken | Disposition |
|----|----------|------------------------|-------------|
| F1 | CRITICAL | Celah pembajakan akun (takeover PIN via re-registration) → diblokir di Always, Never, Matrix, AC. | Applied |
| F2 | CRITICAL | Ambiguitas scope sekolah pada login NIS → signature `loginStudent` dibuat `{ schoolId, nis, pin }`. | Applied |
| F3 | CRITICAL | Sesi cookie stateless tidak hangus saat PIN di-reset → token diikat ke `pinUpdatedAt` & divalidasi di DB. | Applied |
| F4 | MEDIUM | Utang fail-fast boot secret Next.js → dibuatkan task `src/instrumentation.ts` dengan hook `register()`. | Applied |
| F5 | MEDIUM | Enumerasi NIS via perbedaan timing scrypt → wajib panggil `verifyPin(pin, DUMMY_HASH)` asinkron. | Applied |
| F6 | MEDIUM | Aturan eskalasi lockout bertingkat diperjelas (15m / 1j / 24j) di DB via `failedAttempts`. | Applied |
| F7-F8 | LOW | Konflik rombel periode aktif dan standarisasi pesan generik anti-enumerasi. | Applied |

## Design Notes

- **Koeksistensi Sesi Multi-Peran:** Guru dan siswa dapat memakai satu komputer bersama tanpa saling membatalkan login.
- **Status PENDING:** Siswa berstatus PENDING sudah memiliki baris `Student` dan PIN ter-hash di DB, namun baru bisa login setelah di-approve guru pengampu (Story 5).

## Verification

**Commands:**
- `npm run audit:nis` -- expected: konfirmasi seluruh NIS kanonik tanpa duplikat.
- `npm test` -- expected: seluruh unit test autentikasi siswa & security tests lulus 100%.
- `npx tsc --noEmit` -- expected: exit 0 tanpa error tipe.
- `npm run verify:migrations` -- expected: rantai migrasi tetap sinkron 100%.
