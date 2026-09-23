# Verification Gap Review — Report

**Tanggal:** 2026-09-23
**Lens:** Verification Gap (`review-6-verification-gap-prompt.md`)
**Baseline:** `4f9f870` (working tree berisi diff Story 6 — diverifikasi `git status`)
**Scope diff:** `classes.actions.ts` (saklar periode atomik + audit), `student-auth.actions.ts` (cabang klaim ulang + gate periode target + `loginStudent` via helper), `student-session.ts` (helper `resolveStudentSessionMembership`), unit test `student-auth.actions.test.ts`, suite baru `story-6-rollover.int.test.ts` (A1–A5, B1–B11), docs/spec/MASTER_CONTEXT (non-behavioral — dilewati).

---

## Temuan

### 1. `loginStudent`'s adoption of `resolveStudentSessionMembership` (the session payload) is never observed by any test

- **Changed surface:** `loginStudent` switched from an inline `prisma.classStudent.findFirst({ where: { studentId }, orderBy: { createdAt: "desc" } })` to the new ACTIVE-period-prioritizing helper — `src/modules/student-auth/student-auth.actions.ts:799`, dengan membership hasil resolusi ditulis ke payload sesi di `student-auth.actions.ts:802-811`. Ini fix #2 inti story ("sesi pasca-rollover tidak lagi membawa periode lama").
- **Impacted consumer or site:** action `loginStudent` sendiri — entry point form login siswa, yang payload sesinya (`classId`, `academicPeriodId`) dikonsumsi seluruh aksi portal via `verifyStudentSession()`.
- **Existing test evidence:**
  - Unit test `src/modules/student-auth/__tests__/student-auth.actions.test.ts:456` meng-override mock helper mengembalikan `{ classId: "cls_1", academicPeriodId: "prd_1" }`, tetapi test hanya assert `expect(setStudentSessionCookie).toHaveBeenCalled()` di `:483` plus `redirect` — payload tidak pernah diinspeksi, sehingga nilai mock di-set lalu tidak dibaca.
  - Int test `story-6-rollover.int.test.ts` B8 meng-assert helper secara terisolasi (`:758-761`) lalu hanya `expect(res.success).toBe(true)` untuk `loginStudent` (`:763-764`); B9 pola sama (`:776-777` success, helper di-assert terpisah di `:779-780`). Di int suite, `setStudentSessionCookie` yang riil menelan write cookie di luar request store dan token-nya dibuang, sehingga payload tidak teramati.
  - Pencarian yang dijalankan: `setStudentSessionCookie` di seluruh `*.test.*` — hasil: mock unit (assert tanpa argumen), `student-portal.actions.test.ts:312` (meng-assert `changeStudentPinAction`, aksi berbeda yang memang sengaja memakai ulang nilai sesi lama), `student-session.test.ts` (mengetes cookie helper langsung), dan import di story-3 saja; test `loginStudent` di story-3/story-5 meng-assert success/redirect/penghitung lockout DB saja. Tidak ada test di mana pun yang membaca apa yang `loginStudent` berikan ke `setStudentSessionCookie`.
- **Missing verification:** assertion bahwa payload yang `loginStudent` berikan ke `setStudentSessionCookie` memuat membership yang helper kembalikan — mis. `expect(setStudentSessionCookie).toHaveBeenCalledWith(expect.objectContaining({ classId: "cls_1", academicPeriodId: "prd_1" }))` di unit test existing yang sudah menyiapkan override.
- **Demonstration:** kembalikan `student-auth.actions.ts:799` ke `findFirst({ orderBy: { createdAt: "desc" } })` inline semula. B8 sengaja menjadikan row periode lama terbaru by `createdAt`, sehingga sesi login kembali membawa periode lama INACTIVE — namun assert helper di B8 tidak terpengaruh (helper sendiri tak berubah) dan return value `loginStudent` tidak bergantung pada membership, sehingga `:764` tetap hijau; B9 dan unit test juga tetap hijau. Fix #2 regresi dengan full suite tetap 740/740.
- **Consequence:** sesi login pasca-rollover diam-diam kembali membawa periode lama (bug persis yang ingin ditutup story ini), dan tidak ada verifikasi di repo yang gagal.
- **Disposition:** `patch` — tambah satu baris assert payload ke test login `student-auth.actions.test.ts` existing, di mana kedua mock sudah tersedia.

### 2. The fallback branch of `resolveStudentSessionMembership` (no ACTIVE-period enrollment → latest row) is executed by no test anywhere

- **Changed surface:** helper baru `resolveStudentSessionMembership` — `src/modules/student-auth/student-session.ts:229-243`; query kedua di `:238-242` adalah fallback yang terdokumentasi ("fallback row terbaru") untuk siswa yang hanya punya enrollment periode INACTIVE.
- **Impacted consumer or site:** `loginStudent` (`student-auth.actions.ts:799`) untuk siswa yang belum ter-enroll di periode ACTIVE baru — jendela pasca-saklar/pra-impor yang playbook repo sendiri dokumentasikan sebagai kondisi saat siswa tetap login (`docs/PLAYBOOK-ROLLOVER-TA.md` §5: "Portal siswa (uji 1 akun): Data harian kosong/rombel belum terpasang"), serta sekolah tanpa periode ACTIVE.
- **Existing test evidence:** pencarian simbol `resolveStudentSessionMembership` di seluruh repo menghasilkan tepat empat referensi: definisi (`student-session.ts:229`), import/pemakaian di `student-auth.actions.ts`, dan dua call site int test (`story-6-rollover.int.test.ts:758`, `:779`) — keduanya hanya menjalankan cabang primer periode ACTIVE, karena semua test B berjalan setelah A1 menciptakan periode ACTIVE (A4/A5 memakai sekolah terpisah dan tidak menyentuh helper). `student-session.test.ts`, rumah unit alami helper ini, tidak memuat referensi apa pun ke `resolveStudentSessionMembership` maupun `classStudent` (hasil rg). Tidak ada test yang mencapai fallback.
- **Missing verification:** assertion bahwa saat siswa hanya punya enrollment periode INACTIVE, helper mengembalikan row terbaru tersebut, bukan `null`.
- **Demonstration:** rusak query fallback (mis. `where: { studentId, classId: "none" }` atau return `null`). Siswa yang login di jendela rollover lalu mendapat sesi dengan `classId: ""` / `academicPeriodId: ""` (`student-auth.actions.ts:804-805`), memutus seluruh lookup portal yang berkunci sesi — dan B8/B9, satu-satunya test yang memanggil helper, sama-sama punya membership periode ACTIVE dan tetap hijau.
- **Consequence:** jalur login jendela transisi (dahulu seluruh perilaku, kini hanya fallback) bisa regresi menjadi login bersesi kosong tanpa terdeteksi.
- **Disposition:** `patch` — satu test real-db kecil di harness `story-6-rollover.int.test.ts` existing (seed siswa yang hanya ter-enroll di periode lama kini INACTIVE, assert helper mengembalikan row tersebut), mengikuti gaya suite sendiri.

---

## Other findings

- Semua suite real-db di repo ini — termasuk `story-6-rollover.int.test.ts` yang baru — lulus vakum saat database tidak dapat dijangkau: `beforeAll` menangkap error koneksi dan men-set `dbAvailable = false`, dan setiap badan test diawali `if (!dbAvailable) return;`. Ini konvensi mapan (9 suite) sehingga bukan yang diperkenalkan di sini, tetapi artinya bukti DoD utama story ("klaim ulang teruji", 14 test real-db) menguap senyap di lingkungan mana pun tanpa akses DB sementara `vitest run` tetap exit green. Memperkuat hal ini: cabang klaim ulang (~130 baris) di `registerStudent` juga tidak punya coverage unit — mock prisma unit (`student-auth.actions.test.ts:5-26`) tidak memiliki `auditLog`, `classStudent.count`, maupun `student.updateMany`, dan fixture test F1 (`accountStatus` undefined, fixture class tanpa `academicPeriod.status`) membuat gate klaim ulang baru bernilai false, sehingga tidak ada test unit yang bisa maupun memang melalui cabang tersebut. Tidak ada apa pun di output suite yang saat ini membedakan "14 berjalan" dari "0 berjalan".

---

## Bukti penelusuran (ringkas)

| Yang dilakukan | Hasil |
|---|---|
| `rg "resolveStudentSessionMembership"` (seluruh src) | 4 referensi: definisi, import di actions, 2 call site int test (keduanya cabang primer) |
| `rg "setStudentSessionCookie"` di semua `*.test.*` | Tidak ada yang meng-assert payload dari `loginStudent` (unit: tanpa args; portal: aksi lain; story-3: import saja) |
| `rg "pinUpdatedAt"` di `story-6-rollover.int.test.ts` | Hanya asersi B1 (:512-524); karena `pinUpdatedAt` nullable tanpa default di schema, `db.pinUpdatedAt!.toISOString()` akan throw bila rotasi di-drop — rotasi jalur nama-exact ternyata ter-pin (meski secara tidak sengaja), jadi tidak dilaporkan sebagai gap |
| `rg "classStudent"` di `student-session.test.ts` | Nol — helper tidak punya coverage unit |
| `vitest.config.ts` | `include: ["src/**/*.test.ts", ...]` — `*.int.test.ts` ikut dijalankan `vitest run` normal |
| Pola `dbAvailable` | Konvensi 9 suite real-db (termasuk story-3/story-5) — bukan pola baru story 6 |
| E2E (`tests/*.spec.ts`) | Playwright terblokir lokal (isu Turbopack pra-existing, terdokumentasi); tidak ada spec e2e rollover/klaim ulang |
