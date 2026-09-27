# Verification Gap Review — Findings

**Review ID:** 36c5321
**Reviewer:** Verification Gap Review (bmad-review lens)
**Content:** Unified diff — Story: pendaftaran siswa via kode rombel progresif (roster dropdown, NIS matching, tanggal lahir), panel persetujuan, join code di kelas, redesign UI portal/auth.
**Scope method:** Setiap perubahan behavioral ditelusuri ke konsumernya, lalu diperiksa apakah ada test yang akan gagal bila behavior itu rusak.

---

## Verification Gaps

### 1. Filter "hanya pengajuan nyata" tidak diadopsi oleh `getPendingStudentsForMyClassesAction` (Missing-adoption gap)

- **Changed surface:** `getPendingStudentsForClassAction` dan `getPendingStudentsForSchoolAction` kini mensyaratkan `OR: [{ accountRequestedAt: { not: null } }, { accessPinHash: { not: null } }]` pada student — `src/modules/approvals/approvals.actions.ts:223` dan `:253`.
- **Impacted consumer/site:** `getPendingStudentsForMyClassesAction` di `src/modules/approvals/approvals.actions.ts:548`, yang mengisi panel "Menunggu Persetujuan" di halaman Daftar Siswa via `src/app/(dashboard)/siswa/page.tsx:77` → `SiswaListClient` (prop `pendingStudents`).
- **Existing test evidence:** Test satu-satunya yang memanggil aksi my-classes adalah `G-7` di `src/modules/approvals/__tests__/story-5-full-audit.int.test.ts:512-535` — kedua siswa fixture dibuat *dengan* `accountRequestedAt: new Date()` (baris 513, 517) dan diassert muncul; tidak ada test yang membuat siswa PENDING tanpa pengajuan untuk aksi ini. Pencarian repo `accountRequestedAt: { not` / `accessPinHash: { not` di file test: nol hasil.
- **Missing verification:** Tidak ada test yang meng-assert `getPendingStudentsForMyClassesAction` mengecualikan siswa yang `accountStatus`-nya default `"PENDING"` (`prisma/schema.prisma:324`) tanpa pengajuan akun dan tanpa PIN.
- **Demonstration:** Siswa hasil import roster (default PENDING, `accountRequestedAt` null, `accessPinHash` null) tidak tampil di panel Persetujuan (karena guard baru), tetapi tetap tampil di panel pending Daftar Siswa — dua panel saling kontradiksi. Sinyal supersesi ada di diff yang sama: guard identik sengaja ditambahkan ke dua query sibling yang berbagi kontrak `PendingStudentView`, `PENDING_INCLUDE`, dan tujuan panel yang sama. Tidak ada test yang akan menandai non-adopsi ini; assertion my-classes pada `G-7` lolos dengan atau tanpa filter.
- **Consequence:** Aturan "hanya tampilkan siswa yang benar-benar mengajukan akun" ter-ship tidak konsisten — semua siswa hasil import membanjiri satu surface approval tapi terfilter di surface lainnya.
- **Disposition:** **patch** — tambahkan guard `OR` yang sama ke `getPendingStudentsForMyClassesAction`, dan perluas test `G-7` story-5 (gaya audit-DB milik repo) dengan siswa default-PENDING yang di-assert absen dari ketiga aksi.

### 2. Aturan eksklusi baru tidak ter-assert pada dua query yang diubah (Regression gap)

- **Changed surface:** Filter student `OR: [accountRequestedAt not null, accessPinHash not null]` di `getPendingStudentsForClassAction` (`src/modules/approvals/approvals.actions.ts:218-226`) dan `getPendingStudentsForSchoolAction` (`:248-256`).
- **Impacted consumer/site:** Panel Persetujuan yang dibangun dari `getPendingStudentsForSchoolAction()` di `src/app/(dashboard)/persetujuan/page.tsx:21`, dan panel L1 per-rombel dari `getPendingStudentsForClassAction`.
- **Existing test evidence:** `story-5-full-audit.int.test.ts:512-535` (G-7) satu-satunya test yang memanggil aksi-aksi ini dengan assertion baris bermakna; kedua siswa fixture membawa `accountRequestedAt`, sehingga test lolos dengan atau tanpa guard. Test batch (`:442-460`) membuat siswa PENDING tanpa pengajuan tetapi tidak pernah mem-query pending list. Pencarian simbol bentuk guard di seluruh file test: nol hasil.
- **Missing verification:** Tidak ada test yang membuat siswa `PENDING` tanpa `accountRequestedAt`/`accessPinHash` lalu meng-assert siswa tersebut *tidak* muncul di hasil kedua aksi.
- **Demonstration:** Revert guard `OR` (misal saat refaktor where-clause) — semua siswa import default-PENDING kembali membanjiri panel approval; semua test yang dibaca tetap lolos karena G-7 hanya memberi input requester.
- **Consequence:** Perbaikan inti dari perubahan ini (membedakan pengajuan akun nyata dari baris import default-PENDING) bisa regresi secara diam-diam.
- **Disposition:** **patch** — satu fixture tambahan + assertion `not.toContain` di dalam test G-7 yang sudah ada, sesuai gaya assertion file tersebut.

### 3. Payload `roster` pada `lookupJoinCode` tidak punya test coverage di mana pun (Regression gap)

- **Changed surface:** `lookupJoinCode` kini mengembalikan `roster` (id, fullName, nis, `hasAccount`) dari siswa ACTIVE di kelas — `src/modules/student-auth/student-auth.actions.ts:54-74` (include query) dan `:109-115` (mapping).
- **Impacted consumer/site:** Form registrasi baru di `src/app/portal-siswa/page.tsx`: submit terblokir sampai siswa roster dipilih (`:274-276`, tombol disabled di `:894`), dan input NIS, tanggal lahir, serta PIN semuanya digerbangi oleh `selectedRosterStudent` — dengan roster kosong, self-registration buntu.
- **Existing test evidence:** Tiga test `lookupJoinCode` di `src/modules/student-auth/__tests__/student-auth.actions.test.ts:63-101` me-mock `prisma.class.findUnique` tanpa `classStudents` dan hanya meng-assert className/schoolName/teacherName; test integrasi story-3 (`story-3-full-audit.int.test.ts:226-233`) sama, hanya kartu konteks. Pencarian repo `roster`/`hasAccount` di file test hanya mengenai modul tak terkait (quiz, monitoring, imports).
- **Missing verification:** Tidak ada test yang meng-assert `res.data.roster` terisi, terfilter ke siswa ACTIVE, atau `hasAccount` diturunkan dari `accessPinHash && accountStatus === "ACTIVE"`.
- **Demonstration:** Rusak include `classStudents` (atau filter `student.status === "ACTIVE"`-nya; fallback `|| []` juga menelan error query) sehingga selalu `roster: []` — `lookupJoinCode` tetap sukses, semua test yang ada lolos, dan langkah lookup kode pada registrasi merender form yang tak pernah bisa dipakai memilih nama.
- **Consequence:** Satu-satunya entry point self-registration siswa bisa rusak tanpa sinyal test apa pun.
- **Disposition:** **patch** — perluas describe mock `lookupJoinCode` yang sudah ada (gaya repo di `student-auth.actions.test.ts`) dengan fixture ber-`classStudents` dan assert mapping roster serta derivasi `hasAccount`.

### 4. Cabang baru re-registrasi PENDING / konflik tanggal lahir sepenuhnya tak teruji (Regression gap)

- **Changed surface:** Cabang "Skenario PENDING" baru pada `registerStudent` — `src/modules/student-auth/student-auth.actions.ts:684-732` — yang mem-persist `birthDateConflict: true` / `conflictBirthDates` (`:702-703`), me-refresh `accountRequestedAt`, dan menyimpan `birthDate` + `accessPinHash` bila belum ada (`:717-721`); plus skenario (a) yang ditulis ulang: kini set `accountStatus: "PENDING"`, `birthDate`, `accountRequestedAt`, tanpa cookie sesi (`:733-777`).
- **Impacted consumer/site:** Badge panel Persetujuan yang merender `p.birthDate` dan peringatan "Konflik Tgl Lahir" dari `p.conflictBirthDates` — `src/app/(dashboard)/persetujuan/PersetujuanClient.tsx:217-228`, diisi oleh `PENDING_INCLUDE` (`approvals.actions.ts:182-185`).
- **Existing test evidence:** `rg birthDate --glob "*.test.*" src` menghasilkan nol hasil di seluruh repo; tidak ada test di `student-auth.actions.test.ts` (describe state machine, baris 104-273), `story-3-full-audit.int.test.ts`, atau `story-5-full-audit.int.test.ts` yang menjalankan re-registrasi saat PENDING atau meng-assert field tanggal lahir.
- **Missing verification:** Tidak ada test yang memanggil `registerStudent` dua kali untuk siswa PENDING yang sama dan meng-assert konflik ditandai/di-persist (atau tidak, bila tanggal sama), dan tidak ada yang meng-assert skenario (a) kini mem-persist `birthDate` dan men-set `accountRequestedAt`.
- **Demonstration:** Hapus write `birthDateConflict`/`conflictBirthDates` (atau balik perbandingan tanggal sama/beda) — siswa yang mendaftar ulang dengan tanggal lahir yang dimanipulasi tidak lagi memunculkan sinyal konflik untuk guru, jam eskalasi `accountRequestedAt` berhenti ter-refresh, dan semua test yang diperiksa tetap lolos.
- **Consequence:** Mekanisme verifikasi guru yang dibangun perubahan ini (deteksi konflik tanggal lahir sebagai bahan keputusan approval) ter-ship tanpa proteksi regresi.
- **Disposition:** **patch** — tambahkan kasus re-registrasi (tanggal sama, tanggal bentrok, tanggal pertama) ke describe state-machine mock di `student-auth.actions.test.ts`, dengan assertion payload `prisma.student.update`.

### 5. Pembuatan join code di `createClassAction` tidak pernah di-assert (Regression gap)

- **Changed surface:** `createClassAction` kini membangkitkan join code 6 karakter dengan cek kolisi (10 percobaan) dan menulis `joinCode`, `joinCodeLocked: false`, `joinCodeUpdatedAt` — `src/modules/classes/classes.actions.ts:123-142`.
- **Impacted consumer/site:** Chip salin kode rombel yang dirender dari `ctx.class.joinCode` di `src/app/(dashboard)/kelas/KelasOverviewClient.tsx:239-255` dan `RuangMengajarClient.tsx:167-183`, serta seluruh alur join siswa (`lookupJoinCode` di-key pada `joinCode`) — kelas baru tanpa kode tidak pernah bisa di-join.
- **Existing test evidence:** Test satu-satunya yang memanggil `createClassAction` ada di `src/modules/student-auth/__tests__/story-6-rollover.int.test.ts` (baris 290, 330, 354, 395, 443, 479); mereka meng-assert `res.success` dan state pergantian periode, lalu langsung menimpa kode dengan fixture (`:319-324`). Tidak ada test yang meng-assert `joinCode` hasil generate tidak null, valid charset, atau unik — `rg joinCode` di file itu hanya menunjukkan penulisan fixture. Tidak ada file test lain yang mereferensikan `createClassAction`.
- **Missing verification:** Tidak ada assertion di mana pun yang mengamati join code yang dihasilkan `createClassAction`.
- **Demonstration:** Balik cek kolisi (`if (!exists)` → `if (exists)`) atau hapus `joinCode: uniqueCode` dari payload create — semua kelas dibuat dengan `joinCode: null`, chip salin hilang diam-diam, siswa tidak bisa join rombel baru, dan seluruh suite tetap hijau.
- **Consequence:** Pengaktor inti fitur (setiap rombel baru mendapat kode yang bisa dibagikan) bisa rusak tanpa terdeteksi.
- **Disposition:** **patch** — di story-6 A1/A2 (atau mock test kecil meniru `class-join-code.actions.test.ts`), assert `res.classEntity.joinCode` cocok dengan charset aman 32-karakter dan dua kelas yang dibuat mendapat kode berbeda.

---

## Other Findings

- **Test pinning lama kini gagal (suite merah):** Diff membalik skenario (a) `registerStudent` dari auto-ACTIVE L0 (cookie sesi + redirect) menjadi PENDING, tetapi tidak memperbarui test yang mem-pinning kontrak lama: `src/modules/student-auth/__tests__/student-auth.actions.test.ts:165-206` ("Skenario A … -> ACTIVE & auto-login session") meng-assert `status === "ACTIVE"`, `accountStatus: "ACTIVE"`, dan `setStudentSessionCookie` dipanggil; `story-3-full-audit.int.test.ts:274-293` meng-assert ACTIVE di respons maupun DB. `vitest run` (jalur normal `npm test`, mencakup kedua file per `vitest.config.ts`) kini gagal — test mock gagal tanpa syarat; test int gagal setiap kali DB Neon terjangkau.
- **Migrasi Prisma hilang:** `prisma/schema.prisma` menambah `birthDate`, `birthDateConflict`, `conflictBirthDates` pada `Student`, tetapi tidak ada migrasi: migrasi terakhir `20260926024031_add_teacher_revocation_request` dan tidak ada file di `prisma/migrations` yang menyebut kolom-kolom ini. Deployment ke database eksisting akan merusak semua query pending-panel (`PENDING_INCLUDE` me-select `birthDate`) dengan error unknown-column sampai migrasi dibuat.
- **Dead code `verifyStudentIdentity`:** `src/modules/student-auth/student-auth.actions.ts:169-246` — pencarian repo hanya menemukan definisinya; halaman portal memvalidasi nama/NIS secara client-side terhadap `joinContext.roster`, dan tidak ada test yang mencakupnya.
- **Eksposur PII roster:** `lookupJoinCode` adalah aksi tanpa autentikasi yang kini mengembalikan nama lengkap + NIS setiap siswa ACTIVE kepada siapa pun yang memegang kode 6 karakter (sebelumnya hanya metadata kelas/sekolah/guru) — permukaan eksposur PII yang layak keputusan eksplisit.
- **Checkbox dekoratif:** Checkbox "Ingat sesi saya" pada form login portal-siswa (state `rememberMe`) tidak terhubung ke perilaku apa pun.

---

## Ringkasan

| # | Gap | Tipe | Disposisi |
|---|-----|------|-----------|
| 1 | Guard OR tidak diadopsi `getPendingStudentsForMyClassesAction` | Missing-adoption | patch |
| 2 | Aturan eksklusi tidak ter-assert di dua aksi yang diubah | Regression | patch |
| 3 | Payload `roster` `lookupJoinCode` tanpa coverage | Regression | patch |
| 4 | Cabang re-registrasi PENDING / konflik birthDate tanpa coverage | Regression | patch |
| 5 | Join code `createClassAction` tidak pernah di-assert | Regression | patch |

Other findings: 5 (test stale gagal, migrasi hilang, dead code, eksposur PII, checkbox dekoratif).
