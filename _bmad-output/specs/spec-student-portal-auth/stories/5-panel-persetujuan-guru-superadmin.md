---
title: 'Story 5 — Panel Persetujuan Guru & Superadmin'
type: 'feature'
created: '2026-09-23'
status: 'approved'
baseline_commit: '013603f8dbee0dab0d3299d10ecb5fec5aeff72b'
route: 'full'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/execution-stages.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/architecture-diagrams.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/security-amendum.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/glossary.md'
  - '{project-root}/_bmad-output/implementation-artifacts/deferred-work.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.elicitation-report.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:**
Mesin autentikasi siswa (Story 3) menciptakan akun berstatus `PENDING` pada dua cabang pendaftaran (nama mismatch L1, NIS baru L1), namun **hingga saat ini belum ada satu pun antarmuka persetujuan** — siswa `PENDING` menggantung permanen di layar tunggu `/portal-siswa` dan guru tidak punya cara menyetujui, menolak, atau me-reset PIN mereka. Lebih parah lagi, temuan forensik elisitasi (F1) membuktikan **jalur daftar ulang siswa `REJECTED` mati total di kode eksisting**: guard anti-takeover `registerStudent` menolak semua siswa yang sudah memiliki `accessPinHash` — dan siswa REJECTED pasti punya hash — sehingga kriteria sukses CAP-4 mustahil tercapai tanpa perbaikan. Fitur highlight eskalasi juga tidak punya fondasi data (`Student.createdAt` = waktu row leger, bukan waktu pengajuan akun — F2). Kuasa reset PIN yang seharusnya ketat (Amendum B2) belum diimplementasikan di mana pun. Di sisi platform, superadmin sudah dapat lahir via seeder allowlist (Story 1c) tetapi belum memiliki area kerja `/admin/*`, guard `requireSuperAdmin()` masih menjadi deferred work Story 1, plugin admin Better Auth belum terpasang di `src/lib/auth.ts` sehingga **ban/reset password guru mustahil me-revoke sesi aktif** (Amendum B5), dan model `School` tidak memiliki penanda nonaktif sehingga deaktivasi sekolah belum mungkin. Setiap hari tanpa panel ini, siswa baru menumpuk sebagai data mati dan guru kehilangan kontrol akses atas kelasnya.

**Approach:**
1. **Panel Persetujuan Guru dua tingkat (CAP-4 & CAP-7):**
   - **L1 per-rombel**: tab "Menunggu Persetujuan" pada alur rombel pengampu (definisi pengampu: keputusan OQ-1 di Implementation Notes), hanya menampilkan siswa `PENDING` rombel tersebut pada periode aktif.
   - **L2 sekolah-wide**: halaman persetujuan tingkat sekolah yang dapat diakses semua guru sekolah, menampilkan seluruh `PENDING` lintas rombel.
   - Aksi **approve** (set `accountStatus = ACTIVE` + `approvedById` + `approvedAt`), **reject** (set `REJECTED` + alasan), dan **batch approve** atomic dengan semantik skip-baris-gagal + laporan (keputusan OQ-2; N6) — **cap maksimum 100 baris per aksi batch, divalidasi server-side (G-8)**.
   - **Perbaikan jalur daftar ulang REJECTED (F1 + G-1 + G-2)**: amend guard `registerStudent` agar mengizinkan registrasi ulang bila `accountStatus === "REJECTED"` **dengan verifikasi anti-takeover wajib: PIN lama harus cocok (G-1); bila nama baru berbeda dari `fullName` existing, perubahan ditandai red-flag pada `AuditLog` dan UI approve** — reuse row `Student`, update `accessPinHash`, kembali `PENDING`, reset `failedAttempts`/`lockedUntil`; **amend guard skenario (d) agar siswa REJECTED yang daftar ulang ke kode rombel berbeda diarahkan ke UPDATE `classId` pada row `ClassStudent` existing (G-2), bukan ditolak**; guard anti-takeover tetap keras untuk `PENDING`/`ACTIVE`; attempt kedua (sukses maupun PIN-lama-salah) tercatat di `AuditLog`.
   - **Highlight eskalasi berbasis `Student.accountRequestedAt` (F2)**: pending >48 jam di panel pengampu (L1); pending >7 hari di panel semua guru (L2). Field ini diisi saat akun mengaju, di-null-kan saat keputusan, di-reset saat daftar ulang.
   - **Aksi pindah rombel** untuk siswa pending (N5): UPDATE `classId` pada row `ClassStudent` existing, menghormati `@@unique([studentId, academicPeriodId])`; kuasa = pengampu rombel sumber ATAU tujuan (F12).
   - **Reset PIN siswa** (B2): hanya pengampu rombel aktif di periode aktif atau superadmin; guru mengetik PIN baru 4-digit (OQ-4); wajib hygiene akun lengkap (F8); rotasi `pinUpdatedAt` menghanguskan sesi perangkat lain.
   - **Semua transisi status memakai conditional update** (F5): `updateMany where { id, accountStatus: "PENDING" }` + cek `count === 1` di dalam transaksi — kebal race approve-vs-batch dan approve-vs-daftar-ulang tanpa bergantung unique constraint yang tidak ada.
   - Setiap transisi tangga L1–L3 tercatat di `AuditLog`.
2. **Guard `requireSuperAdmin()`** (pelunasan deferred work Story 1): deny-by-default strict equality `platformRole === "ADMIN"` (nilai asing seperti `"MODERATOR"` tertolak), tanpa sesi → denied, satu jenis error tunggal `SuperAdminRequiredError` dengan pesan statis identik semua jalur (anti-enumerasi), baca role via `session.user` dengan fallback `prisma.user.findUnique({ where: { id: session.userId } })`, tanpa mengubah `src/lib/auth.ts` untuk keperluan guard ini. **Satu-satunya gerbang** — dilarang menyebar pengecekan `platformRole` manual di handler mana pun.
3. **Infrastruktur notifikasi aditif (OQ-3, F4)**: model `Notification` minimal (`userId`, `schoolId`, `type`, `payload Json`, `readAt`, `createdAt`) + badge/feed sederhana di header dashboard. Approve L2 memicu **satu notifikasi ringkasan per aksi** (individu maupun batch) ke semua membership `ACTIVE` sekolah — bukan per-baris. Model ini reusable untuk Gelombang 3 (koreksi tugas) dan 4.
4. **Area backstop `/admin/*` untuk superadmin (CAP-7)** — route group **top-level terpisah** dengan layout sendiri (F3; dilarang menest di `(dashboard)` yang me-redirect superadmin tanpa school-context ke `/onboarding`):
   - Force approve siswa (tingkat L3, lintas sekolah — OQ-8 dikonfirmasi penuh tanpa membership).
   - Ban guru + reset password guru → wajib revoke SEMUA sesi Better Auth aktif milik user via `revokeUserSessions` (pasang admin plugin Better Auth di `src/lib/auth.ts` — B5); superadmin dilarang mem-ban ATAU me-reset password superadmin lain (F6 + G-3).
   - Nonaktifkan sekolah → **fail-closed di SEMUA gerbang** (F7 + G-4 + G-5): login guru **dan login parent** (hook Better Auth `databaseHooks.session.create`, OQ-6 + G-5), `loginStudent`, `registerStudent`, `lookupJoinCode`, aksi portal siswa, **alur kuis publik `/q/[token]` + aksi kuis token-based (G-4)**, dan layanan baca `/parent/*`; sesi existing di-revoke (guru/parent) dan fail-closed per-request (siswa); **clear `npsn`** saat deaktivasi (B5; tanpa ini NPSN sah terkunci permanen oleh `School.npsn @unique`); urutan aman: tandai nonaktif → revoke sesi → fail-closed → clear npsn → `AuditLog`. **Kebijakan reaktivasi (G-6)**: reaktivasi mengembalikan status aktif **tanpa NPSN** (`npsn` tetap null); pengisian NPSN ulang via update eksplisit yang menangkap konflik `@unique` dengan pesan generik — tidak pernah P2002 mentah, tidak pernah crash saat NPSN sudah diklaim sekolah lain.
   - AuditLog UI: viewer berfilter (aktor, aksi, target, rentang waktu).
   - Percobaan akses `/admin/*` oleh non-superadmin ter-audit dengan dedup 60 detik, hanya bila sesi valid (OQ-7, F10).
   - Proteksi berlapis: blok optimistic di `src/proxy.ts` + validasi server-side nyata via `requireSuperAdmin()` di layout/handler.
5. **Migrasi aditif** (N1): penanda nonaktif `School` (nullable), `Student.accountRequestedAt` (nullable, F2), FK formal `Student.approvedById` → `User` (aman tanpa backfill — data existing `null` semua, OQ-5), `@@index([schoolId, accountStatus])` pada `Student` (F9), model `Notification` **dengan `@@index([userId, readAt])` (G-10)**, serta sinkronisasi kolom plugin admin Better Auth di tabel `user` (`banned`, `banReason`, `banExpires`, … — F6). Nol drop/rename; `npm run verify:migrations` exit 0.

## Boundaries & Constraints

**Always:**
- **Guard `requireSuperAdmin()` deny-by-default (kontrak deferred work Story 1, terkeras)**: strict equality `platformRole === "ADMIN"`; tanpa sesi → denied; satu jenis error `SuperAdminRequiredError` dengan pesan statis identik di semua jalur (anti-enumerasi); fallback baca DB `prisma.user.findUnique` bila role tidak ada di `session.user`; tanpa mengubah `src/lib/auth.ts` demi guard ini (perubahan `auth.ts` hanya untuk plugin admin + hook OQ-6).
- **Satu gerbang untuk semua aksi admin**: seluruh handler `/admin/*` memanggil `requireSuperAdmin()` — dilarang menyebar pengecekan `platformRole` manual yang mengunduk lupa satu jalur.
- **Monopoli kuasa reset PIN (Amendum B2)**: reset PIN siswa HANYA oleh pengampu rombel siswa tersebut di periode aktif, atau Superadmin. Guru sekolah lain dilarang meski satu sekolah (Mode Santai membuat akun guru muran — reset PIN adalah kunci impersonasi siswa). Kuasa reset PIN berlaku juga untuk siswa `REJECTED` (jalur pembuka daftar ulang bila PIN lama terlupa).
- **Verifikasi kepemilikan saat daftar ulang REJECTED (G-1)**: `registerStudent` untuk siswa `REJECTED` wajib memvalidasi PIN lama (`verifyPin` terhadap `accessPinHash` existing) SEBELUM reuse row; PIN salah → tolak generik + `AuditLog` percobaan; nama berbeda dari `fullName` existing → red-flag di metadata `AuditLog` dan UI approve.
- **Guard skenario (d) ikut di-amend (G-2)**: siswa REJECTED yang daftar ulang ke kode rombel berbeda diarahkan ke UPDATE `classId` row `ClassStudent` existing — bukan ditolak dengan pesan "sudah terdaftar di rombel X".
- **Notifikasi approve L2 ter-aggregate (B2 + F4)**: satu notifikasi ringkasan per aksi (individu/batch) ke semua membership `ACTIVE` sekolah + entri `AuditLog`; `AuditLog` tetap per-baris untuk batch (N6).
- **Cap batch approve (G-8)**: maksimum 100 baris per aksi batch, divalidasi server-side; lebih dari itu wajib dipecah menjadi beberapa aksi.
- **Audit akses admin lahir dari server (G-9)**: `ADMIN_ACCESS_DENIED` ditulis dari `requireSuperAdmin()` di layout/handler (runtime Node, Prisma tersedia) — `src/proxy.ts` HANYA blok/redirect optimistic tanpa menulis DB; dedup 60 detik bersifat best-effort terhadap request konkuren.
- **Batch approve atomic dengan semantik skip + laporan (N6, keputusan OQ-2)**: satu `$transaction`; baris yang kalah race di-skip dan dilaporkan eksplisit; `AuditLog` per-baris sukses; tidak ada baris ter-approve senyap.
- **Conditional update untuk semua transisi status (F5)**: `updateMany` berkondisi `accountStatus` lama + cek `count`, di dalam transaksi — wajib di approve, reject, batch, force approve, dan daftar ulang.
- **Siklus hidup `accountRequestedAt` (F2)**: diisi `now()` saat akun mengaju (PENDING), di-null-kan saat keputusan (approve/reject), di-reset saat daftar ulang — satu-satunya sumber kebenaran highlight eskalasi.
- **Pindah rombel via UPDATE `classId` (N5)**: pada row `ClassStudent` existing periode aktif — bukan delete-insert; menghormati `@@unique([studentId, academicPeriodId])`; kuasa = pengampu rombel sumber ATAU tujuan (F12).
- **Siklus hidup sesi superadmin (Amendum B5)**: ban guru dan reset password guru wajib revoke SEMUA sesi Better Auth aktif milik user (`revokeUserSessions` — admin plugin terpasang di `src/lib/auth.ts`); nonaktif sekolah wajib fail-closed di semua gerbang (login guru **dan parent** via `databaseHooks.session.create` — G-5, `loginStudent`, `registerStudent`, `lookupJoinCode`, aksi portal siswa, **alur kuis publik `/q/[token]` + aksi kuis token-based — G-4**, layanan baca `/parent/*`), meng-invalidate sesi existing, dan clear `School.npsn`.
- **Reset PIN wajib hygiene akun (F8)**: `accessPinHash` baru + `pinUpdatedAt = now()` + reset `failedAttempts = 0`, `lockedUntil = null`, dalam satu transaksi.
- **Jejak audit total**: setiap aksi superadmin dan setiap transisi tangga L1–L3 (approve/reject/pindah rombel/reset PIN/ban/reset password/nonaktif sekolah/force approve) wajib menulis `AuditLog`; `metadata` dilarang memuat PIN/hash/secret (N4). Percobaan akses `/admin/*` oleh sesi valid non-admin ter-audit dengan dedup 60 detik (F10).
- **Migrasi 100% aditif (N1)**: semua kolom baru nullable/ber-default; nol drop/rename; `npm run verify:migrations` tetap exit 0.
- **Scope & periode aktif**: seluruh query panel di-scope ke sekolah aktif guru (dari sesi) dan periode akademik aktif; superadmin bebas lintas-sekolah (OQ-8).
- **Pesan error statis & generik** untuk semua aksi sensitif (approve/reject/reset PIN/admin) — tidak membocorkan keberadaan status baris lain.
- **Regresi nol (N9)**: alur `/q/[token]`, `/parent/*` (sekolah aktif), `/siswa/portal/*`, onboarding, dan panel member Story 2 tetap hijau; `tsc` bersih; seluruh test lama & baru hijau.

**Never:**
- Menciptakan superadmin melalui registrasi/aplikasi — env allowlist + seeder (Story 1c) adalah satu-satunya jalur kelahiran (CAP-7).
- Mengizinkan guard anti-takeover `registerStudent` membuka jalur untuk akun `PENDING`/`ACTIVE` — perlawanan F1 HANYA untuk `accountStatus === "REJECTED"`, **dan hanya setelah PIN lama terverifikasi cocok (G-1)**.
- Mem-ban ATAU me-reset password superadmin lain (F6 + G-3) — kedua aksi wajib menolak target `platformRole === "ADMIN"` dengan guard yang sama.
- Mengizinkan guru bukan-pengampu melakukan approve L1, reset PIN, atau pindah rombel.
- Mengizinkan akses `/admin/*` oleh siapa pun selain `platformRole === "ADMIN"` — termasuk guru OWNER sekolah.
- Mem-ban superadmin lain (F6) — aksi ban terhadap `platformRole === "ADMIN"` wajib ditolak.
- Menest `/admin/*` di bawah route group `(dashboard)` atau layout ber-school-context (F3) — superadmin tanpa membership akan ter-redirect ke `/onboarding`.
- Mengeksekusi batch approve yang membiarkan sebagian baris ter-approve secara diam-diam tanpa laporan/jejak.
- Menerima batch approve melebihi 100 baris dalam satu aksi/transaksi (G-8).
- Mengirim notifikasi per-baris untuk batch approve (wajib aggregate per aksi, F4).
- Menulis PIN, hash, atau secret ke metadata `AuditLog`.
- Mengubah signature alur existing yang mengikat (`startQuizAttemptAction`, kontrak Story 2–4) — amend `registerStudent` (F1) diperbolehkan karena menutup celah kepatuhan CAP-4, bukan mengubah signature.
- Menonaktifkan sekolah tanpa clear `npsn` (mengunci permanen NPSN sah via `@unique`) atau dengan urutan yang membuka jendela re-klaim NPSN sebelum status nonaktif tercatat.
- Mem-ban atau reset password guru tanpa me-revoke seluruh sesi aktifnya.
- Menghapus atau membuat ulang row `Student` saat siswa REJECTED mendaftar ulang (wajib reuse row, glosarium §9.2).
- Menampilkan data lintas-sekolah ke guru biasa di panel persetujuan mana pun.
- Menghitung eskalasi dari `Student.createdAt` (F2) — sumber tunggal adalah `accountRequestedAt`.

## I/O & Edge-Case Matrix

| Skenario | Input / State | Perilaku yang Diharapkan | Penanganan Galat / Respon |
| :--- | :--- | :--- | :--- |
| **Pengampu membuka panel L1** | Guru pengampu rombel membuka tab pending rombelnya | Daftar siswa `PENDING` rombel itu pada periode aktif, terurut `accountRequestedAt` terlama | Pending >48 jam diberi highlight eskalasi |
| **Guru bukan pengampu buka panel L1** | Guru tanpa TeachingContext pada rombel tsb | Panel L1 rombel itu tidak tersedia/tidak berisi | Aksi server memverifikasi kuasa pengampu; tolak generik |
| **Approve L1 sukses** | Pengampu approve siswa `PENDING` | Conditional update sukses: `ACTIVE`, `approvedById`, `approvedAt`, `accountRequestedAt = null`, `AuditLog` | Siswa dapat login di `/portal-siswa` seketika |
| **Reject dengan alasan** | Pengampu reject siswa + alasan | `accountStatus = REJECTED`, alasan tercatat, `accountRequestedAt = null`, `AuditLog` | Siswa melihat kartu ditolak + dapat daftar ulang (reuse row) |
| **Batch approve skip + laporan (N6, OQ-2)** | Pengampu men-checklist N siswa → approve batch | Satu `$transaction`; baris valid ter-approve; baris kalah race di-skip + dilaporkan; `AuditLog` per-baris sukses; **satu notifikasi ringkasan** | Tidak ada baris ter-approve senyap; tanpa crash P2002 mentah |
| **Konkurensi batch vs approve tunggal (F5)** | Siswa A di-approve guru lain saat batch berjalan | `updateMany` batch baris A menghasilkan `count = 0` → baris dilaporkan gagal | Tanpa double-write, tanpa duplikat AuditLog |
| **Daftar ulang vs approve race (F5)** | Siswa REJECTED daftar ulang bersamaan dengan approve | Salah satu transisi kalah (count = 0) → dilaporkan/diulang aman | State akhir konsisten satu kondisi |
| **Panel L2 sekolah-wide** | Guru mana pun sekolah membuka panel L2 | Seluruh `PENDING` lintas rombel + highlight >7 hari (`accountRequestedAt`) | Approve L2 → notifikasi ringkasan semua guru + `AuditLog` (B2) |
| **Pindah rombel (N5, F12)** | Siswa pending dipindah oleh pengampu rombel sumber ATAU tujuan | UPDATE `classId` pada row `ClassStudent` existing | Kuasa divalidasi server-side; target lintas-sekolah ditolak; `@@unique` terjaga |
| **Pindah rombel oleh guru asing** | Guru tanpa kuasa pada rombel sumber maupun tujuan | Ditolak server-side | Pesan generik |
| **Reset PIN oleh pengampu (B2, F8)** | Pengampu mengetik PIN baru 4-digit | `accessPinHash` baru + `pinUpdatedAt = now()` + reset `failedAttempts`/`lockedUntil`, satu transaksi + `AuditLog` | Sesi perangkat lain hangus; kuasa divalidasi server-side |
| **Reset PIN saat siswa mengerjakan kuis** | Siswa sedang attempt aktif, pengampu reset PIN | Sesi siswa hangus (perilaku benar — keamanan > kelancaran) | Siswa login ulang dengan PIN baru dari guru; attempt tersimpan dapat dilanjutkan |
| **Reset PIN oleh guru non-pengampu** | Guru sekolah sama (bukan pengampu) mencoba reset | Ditolak server-side | Pesan generik; bukan sekadar disembunyikan di UI |
| **Force approve oleh superadmin (L3)** | Superadmin force approve siswa sekolah mana pun | `ACTIVE` + jejak audit bertanda aktor superadmin | Berlaku meski tanpa pengampu |
| **Ban guru (B5)** | Superadmin ban akun guru | User diblokir login; SEMUA sesi Better Auth aktif di-revoke | `AuditLog` terisi; guru tidak bisa melanjutkan sesi berjalan |
| **Ban superadmin (F6)** | Superadmin mencoba ban `platformRole === "ADMIN"` | Ditolak keras server-side | Pesan generik + `AuditLog` percobaan |
| **Reset password guru (B5)** | Superadmin reset password guru | Password baru berlaku; SEMUA sesi lama di-revoke | Sesi lama hangus; `AuditLog` terisi |
| **Nonaktifkan sekolah (B5, F7)** | Superadmin menonaktifkan sekolah | Urutan aman: tandai nonaktif → revoke sesi guru/parent → fail-closed siswa → clear `npsn` → `AuditLog` | NPSN dapat dipakai sekolah lain; tidak ada jendela re-klaim |
| **Login saat sekolah nonaktif** | Guru/siswa sekolah nonaktif mencoba login | Guru: `databaseHooks.session.create` deny; siswa: guard `loginStudent` | Pesan generik tanpa membocorkan status sekolah |
| **Register/lookup saat sekolah nonaktif (F7)** | Siswa submit kode rombel sekolah nonaktif | `lookupJoinCode`/`registerStudent` menolak fail-closed | Pesan generik |
| **Kuis publik saat sekolah nonaktif (G-4)** | Siswa membuka link `/q/[token]` kuis sekolah nonaktif | Titik masuk attempt menolak fail-closed (baca `Quiz` → `Class` → `School`) | Pesan generik tanpa membocorkan status sekolah |
| **Parent login ulang saat sekolah nonaktif (G-5)** | Parent sekolah nonaktif mencoba login setelah sesi di-revoke | `databaseHooks.session.create` menolak (resolusi school via `ParentStudentRelation` → `student.schoolId`) | Pesan generik |
| **Reset password sesama superadmin (G-3)** | Superadmin mencoba reset password `platformRole === "ADMIN"` | Ditolak keras server-side (guard sama seperti ban) | Pesan generik + `AuditLog` percobaan |
| **Reaktivasi sekolah pasca-NPSN diklaim (G-6)** | Sekolah nonaktif direaktivasi, NPSN lama sudah dipakai sekolah lain | Reaktivasi sukses TANPA NPSN (`npsn` tetap null); pengisian NPSN menangkap konflik `@unique` | Pesan generik, tanpa P2002 mentah, tanpa crash |
| **Siswa PENDING periode lampau (G-7)** | PENDING dengan row `ClassStudent` di periode selain aktif | Tetap tampil di panel L2 sekolah-wide (tanpa filter periode); dapat dipindah rombel/di-reset PIN via L2 dengan target rombel periode aktif | Tidak ada pending yang menggantung tak terlihat selamanya |
| **Portal & parent saat sekolah nonaktif (F7)** | Sesi existing siswa/parent sekolah nonaktif request | Aksi portal siswa & layanan baca `/parent/*` menolak fail-closed | Tidak ada baca/tulis lanjutan ke sekolah mati |
| **Non-superadmin akses `/admin/*`** | Guru biasa membuka `/admin/*` | Diblok optimistic di proxy + ditolak server-side oleh `requireSuperAdmin()` | Redirect/403 generik; jika sesi valid → `AuditLog` `ADMIN_ACCESS_DENIED` dengan dedup 60 detik (F10) |
| **AuditLog viewer** | Superadmin membuka `/admin/*` audit | Daftar log terfilter (aktor, aksi, target, waktu), terpaginasi | Index `[actorId, createdAt]` & `[targetType, targetId]` terpakai |
| **Siswa REJECTED daftar ulang (F1 + G-1)** | Siswa submit kode rombel lagi setelah ditolak, PIN lama cocok | Guard `registerStudent` mengizinkan `REJECTED`: reuse row, update pin (nama dired-flag bila berubah), kembali `PENDING`, reset hygiene; bila pindah rombel → guard (d) mengizinkan via UPDATE `classId` row existing (G-2) | Attempt kedua tercatat di `AuditLog` (glosarium §9.2) |
| **Daftar ulang REJECTED, PIN lama salah (G-1)** | NIS REJECTED + PIN lama tidak cocok | Ditolak generik, row TIDAK disentuh | `AuditLog` percobaan; pesan identik tanpa membocorkan status |
| **Daftar ulang REJECTED, PIN lupa (G-1)** | Siswa REJECTED lupa PIN | Guru pengampu/superadmin reset PIN siswa REJECTED via panel (PIN baru disampaikan offline) → siswa daftar ulang memakai PIN itu sebagai verifikasi | Reset PIN REJECTED ter-audit; tanpa jalur pintas tanpa verifikasi |
| **Batch approve >100 baris (G-8)** | Pengampu mengirim batch 150 siswa | Ditolak server-side dengan pesan generik, nol baris dieksekusi | UI meminta pecah; `AuditLog` percobaan |
| **Takeover attempt tetap diblokir** | Pihak lain mendaftar memakai NIS siswa `PENDING`/`ACTIVE` yang sudah ber-PIN | Guard anti-takeover menolak keras (perilaku Story 4 dipertahankan) | Pesan "Akun sudah terdaftar" |
| **Guard tanpa sesi** | `requireSuperAdmin()` dipanggil tanpa sesi valid | Denied seketika | `SuperAdminRequiredError`, pesan statis identik |

</frozen-after-approval>

## Keputusan Elicitasi (TERKUNCI 2026-09-23 — apply semua, disetujui human)

| OQ | Keputusan Terkunci |
|---|---|
| **OQ-1** | **Pengampu rombel = semua guru dengan `TeachingContext` aktif pada rombel tsb di periode aktif** (tanpa kolom/UI baru). Konsekuensi diterima: beberapa guru = pengampu. |
| **OQ-2** | **Batch = satu `$transaction`, baris valid ter-approve, baris kalah race di-skip + dilaporkan, `AuditLog` per-baris sukses.** All-or-nothing murni ditolak (baris batch independen). |
| **OQ-3** | **Model `Notification` aditif minimal** (`userId`, `schoolId`, `type`, `payload Json`, `readAt`, `createdAt`) + badge/feed header dashboard; reusable Gelombang 3/4; email tetap non-goal; aggregate per aksi. |
| **OQ-4** | **Guru mengetik PIN baru 4-digit**, wajib berbeda dari lama, tampil sekali; hygiene F8; siswa diberi tahu PIN offline oleh guru. |
| **OQ-5** | **FK formal `approvedById` → `User` ditambah sekarang** — data existing `null` semua (forensik: Story 3 tidak pernah mengisi) → aman tanpa backfill. |
| **OQ-6** | **Better Auth `databaseHooks.session.create` (deny)** di `src/lib/auth.ts` mencegah sesi guru baru pada sekolah nonaktif + guard status sekolah pada layout dashboard server-side. Ini hook lifecycle, bukan modifikasi kontrak guard — sah. |
| **OQ-7** | **Audit percobaan akses `/admin/*`**: dicatat (`ADMIN_ACCESS_DENIED`) hanya bila sesi valid, dengan dedup 60 detik anti-noise. |
| **OQ-8** | **Superadmin dikonfirmasi lintas-sekolah penuh** tanpa membership, termasuk AuditLog semua sekolah (viewer berfilter). |

### Amendemen Round 2 — TERKUNCI 2026-09-22 (apply-all, disetujui human; sumber: sesi elisitasi + party mode)

| # | Keputusan Terkunci |
|---|---|
| **G-1** | Daftar ulang REJECTED wajib verifikasi PIN lama; perubahan nama = red-flag AuditLog + UI approve; PIN lupa → guru reset PIN REJECTED lebih dulu (kuasa reset diperluas ke REJECTED). |
| **G-2** | Guard skenario (d) `existingEnrollment` di-amend: REJECTED pindah rombel = UPDATE `classId` row existing, bukan tolak. |
| **G-3** | `resetTeacherPasswordAction` menolak target `platformRole === "ADMIN"` — guard identik dengan ban. |
| **G-4** | Fail-closed deaktivasi mencakup alur kuis publik `/q/[token]` + aksi kuis token-based. |
| **G-5** | Hook `databaseHooks.session.create` menolak sesi baru guru DAN parent sekolah nonaktif. |
| **G-6** | Reaktivasi sekolah = tanpa NPSN; pengisian NPSN ulang menangkap konflik `@unique` dengan pesan generik. |
| **G-7** | Panel L2 menampilkan seluruh PENDING sekolah tanpa filter periode — tidak ada pending lintas-periode yang menggantung tak terlihat. |
| **G-8** | Cap batch approve 100 baris per aksi, divalidasi server-side. |
| **G-9** | `ADMIN_ACCESS_DENIED` ditulis dari `requireSuperAdmin()` server-side; proxy hanya redirect. |
| **G-10** | Migrasi menambah `@@index([userId, readAt])` pada `Notification`. |
| **G-11** | Aksi plugin admin menangani penolakan karena role sesi stale dengan pesan generik; integration test ban dengan sesi fresh wajib. |

## Code Map

### 1. Guard & Infrastruktur
- `src/lib/superadmin.ts` (BARU): `requireSuperAdmin()` + `SuperAdminRequiredError` (kontrak deferred work Story 1).
- `src/lib/auth.ts`: pasang `admin()` plugin dari `better-auth/plugins` dengan **`adminRoles: ["ADMIN"]`, `defaultRole: "USER"`** (investigasi: plugin memakai field `user.role` sendiri, bukan `platformRole` — lihat Design Notes) + hook `databaseHooks.session.create` deny sekolah nonaktif (OQ-6) — dua-satunya perubahan file ini yang diizinkan. Endpoint plugin yang dipakai: `auth.api.banUser`, `auth.api.setUserPassword`, `auth.api.revokeUserSession(s)` (tersedia di v1.6.29).
- `src/lib/superadmin-seeder.ts`: extend agar set `role: "ADMIN"` sinkron dengan `platformRole: "ADMIN"` (kolom `role` baru); update test seeder.
- `prisma/schema.prisma` + migrasi aditif: penanda nonaktif `School` (mis. `deactivatedAt DateTime?`), `Student.accountRequestedAt` (F2), FK formal `Student.approvedById` → `User` (OQ-5), `@@index([schoolId, accountStatus])` (F9), model `Notification` (OQ-3, **+ `@@index([userId, readAt])` — G-10**), kolom plugin admin di `User` (`role @default("USER")`, `banned @default(false)`, `banReason`, `banExpires`) + `Session.impersonatedBy` (F6 — sesuai `better-auth/dist/plugins/admin/schema`).
- `src/lib/audit-metadata.ts` — **reuse**: semua penulisan `AuditLog` wajib lewat `redactMetadata()` (invariant anti-PIN/hash sudah ada sejak Story 1c).
- `src/modules/notifications/` (BARU): service create/list/mark-read (aggregate per aksi, F4).
- `src/lib/authorization.ts` — **reuse pattern**: `requireAuthSession()` + `verifyActiveSchoolMembership()` untuk aksi guru; jangan meniru isinya, panggil.
- `src/modules/student-auth/student-session.ts`: `verifyStudentSession()` (line ~140) sudah DB-check per request (status siswa + `pinUpdatedAt`) — extend select dengan penanda nonaktif sekolah → satu choke point fail-closed portal siswa (F7).
- `src/proxy.ts`: tambah branch blok optimistic `/admin/*` (tanpa cookie sesi → redirect login); matcher existing sudah mencakup `/admin`.

### 2. Modul Server Actions
- `src/modules/approvals/approvals.actions.ts` (BARU): `getPendingStudentsForClassAction`, `getPendingStudentsForSchoolAction` (tanpa filter periode — G-7), `approveStudentAction`, `rejectStudentAction`, `batchApproveStudentsAction` (N6 + OQ-2, cap ≤100 baris server-side — G-8), `moveStudentClassAction` (N5 + F12), `resetStudentPinAction` (B2 + OQ-4 + F8, berlaku juga untuk siswa REJECTED — G-1). Semua transisi memakai conditional update (F5). Pengampu diverifikasi via query `TeachingContext` (teacherProfileId, classId, academicPeriodId aktif).
- `src/modules/admin/admin.actions.ts` (BARU): `forceApproveStudentAction`, `banTeacherAction` (+ revoke sesi via `auth.api.banUser`, guard anti-ban-ADMIN F6), `resetTeacherPasswordAction` (+ `setUserPassword` + `revokeUserSessions` + **guard anti-target-ADMIN G-3**), `deactivateSchoolAction` (urutan aman B5 + F7 + clear npsn), reaktivasi sekolah tanpa-NPSN dengan konflik `@unique` tertangani (G-6), `getAuditLogsAction`, audit `ADMIN_ACCESS_DENIED` ber-dedup 60 detik **yang ditulis dari `requireSuperAdmin()` server-side, bukan dari proxy (F10 + G-9)**.
- `src/modules/student-auth/student-auth.actions.ts`: amend guard `registerStudent` untuk jalur REJECTED (F1 — blok `accessPinHash !== null` di line ~155, sisipkan cabang REJECTED sebelum skenario (b) **dengan verifikasi PIN lama wajib — G-1; amend guard skenario (d) `existingEnrollment` agar REJECTED pindah rombel via UPDATE `classId` — G-2**) + fail-closed sekolah nonaktif pada `loginStudent` (extend select `school` di line ~366), `registerStudent`, `lookupJoinCode` (F7).
- `src/modules/quiz/quiz.actions.ts` (alur publik token-based `/q/[token]`): guard fail-closed sekolah nonaktif di titik masuk attempt (G-4).
- `src/modules/student-portal/student-portal.actions.ts` + kuartet FromSession `quiz.actions.ts`: guard fail-closed sekolah nonaktif via `verifyStudentSession` extension (F7).
- `src/modules/parent/parent.service.ts`: guard fail-closed sekolah nonaktif (F7).
- `src/lib/auth.ts` (hook, OQ-6 + G-5): `databaseHooks.session.create` deny sekolah nonaktif untuk guru (resolusi via membership) DAN parent (resolusi via `ParentStudentRelation` → `student.schoolId`).

### 3. Antarmuka
- `src/app/(dashboard)/siswa/page.tsx` + `SiswaListClient.tsx` — tempat tab "Menunggu Persetujuan" L1 (per-rombel pengampu), highlight >48 jam.
- Halaman panel L2 sekolah-wide (BARU, mis. `src/app/(dashboard)/persetujuan/page.tsx`) — highlight >7 hari, checklist batch + tombol sticky "Setujui (N)", pindah rombel, reset PIN.
- Route group top-level `src/app/admin/*` (BARU — F3, dilarang di `(dashboard)`): layout `requireSuperAdmin()`, halaman force approve, ban guru, reset password guru, nonaktif sekolah, AuditLog viewer.
- Badge/feed `Notification` sederhana di header dashboard guru (OQ-3).

---

## Tasks & Acceptance

### Execution Checklist

**Fase 1 — Guard, Migrasi & Infrastruktur:**
- [ ] Tulis `requireSuperAdmin()` + `SuperAdminRequiredError` di `src/lib/superadmin.ts` (kontrak terkeras deferred work Story 1) + unit test.
- [ ] Migrasi aditif: penanda nonaktif `School`, `Student.accountRequestedAt` (F2), FK formal `approvedById` → `User` (OQ-5), `@@index([schoolId, accountStatus])` (F9), model `Notification` (OQ-3), kolom plugin admin `User.role/banned/banReason/banExpires` + `Session.impersonatedBy` (F6); `npm run verify:migrations` exit 0.
- [ ] Pasang admin plugin Better Auth (`adminRoles: ["ADMIN"]`, `defaultRole: "USER"`) di `src/lib/auth.ts`; extend `superadmin-seeder.ts` set `role: "ADMIN"` sinkron + update test seeder (F6).
- [ ] Pasang hook `databaseHooks.session.create` deny sekolah nonaktif (OQ-6).
- [ ] Extend `verifyStudentSession()` dengan fail-closed penanda nonaktif sekolah (F7).
- [ ] Blok optimistic `/admin/*` di `src/proxy.ts`.

**Fase 2 — Panel Persetujuan Guru (CAP-4, B2, N5, N6, F1):**
- [ ] Panel L1 per-rombel (tab pending) dengan verifikasi kuasa pengampu server-side + highlight >48 jam (dari `accountRequestedAt`).
- [ ] Panel L2 sekolah-wide dengan highlight >7 hari + checklist batch + pindah rombel + reset PIN.
- [ ] `approveStudentAction` / `rejectStudentAction` dengan conditional update (F5) + `accountRequestedAt = null` + `AuditLog`.
- [ ] `batchApproveStudentsAction`: satu `$transaction`, skip-baris-gagal + laporan, `AuditLog` per-baris sukses (N6, OQ-2), cap ≤100 baris divalidasi server-side (G-8).
- [ ] `moveStudentClassAction`: UPDATE `classId` row existing, kuasa pengampu sumber/tujuan (N5, F12).
- [ ] `resetStudentPinAction`: validasi kuasa, PIN dari guru (OQ-4), hygiene lengkap (F8), satu transaksi + `AuditLog`.
- [ ] Amend guard `registerStudent` untuk jalur REJECTED (F1 + G-1 + G-2): verifikasi PIN lama, red-flag perubahan nama, amend skenario (d) pindah rombel, AuditLog attempt kedua (sukses & gagal).
- [ ] Model + service `Notification` dengan aggregate per aksi + badge feed header dashboard (OQ-3, F4).

**Fase 3 — Area Superadmin `/admin/*` (CAP-7, B5):**
- [ ] Route group top-level `src/app/admin/*` dengan layout `requireSuperAdmin()` (F3).
- [ ] `forceApproveStudentAction` lintas-sekolah + `AuditLog` + conditional update.
- [ ] `banTeacherAction` (+ guard anti-ban-ADMIN, F6) + `resetTeacherPasswordAction` (+ guard anti-target-ADMIN, G-3), keduanya revoke SEMUA sesi (B5) + `AuditLog`.
- [ ] `deactivateSchoolAction` urutan aman: tandai nonaktif → revoke sesi guru/parent → fail-closed siswa → clear `npsn` → `AuditLog` (B5, F7).
- [ ] Fail-closed sekolah nonaktif: `loginStudent`, `registerStudent`, `lookupJoinCode`, konsumen aksi portal siswa, alur kuis publik `/q/[token]` (G-4), hook login guru + parent (G-5), layanan baca `/parent/*` (F7).
- [ ] Reaktivasi sekolah: sukses tanpa NPSN, pengisian NPSN ulang menangkap konflik `@unique` dengan pesan generik (G-6).
- [ ] Audit percobaan akses `/admin/*` ber-dedup 60 detik, hanya sesi valid (OQ-7, F10).
- [ ] AuditLog viewer berfilter + terpaginasi (pakai index N4).

**Fase 4 — Verifikasi Pengujian:**
- [ ] Integration test real-db: seluruh tangga L1–L3 + batch (skip+laporan, cap >100 ditolak — G-8) + konkurensi conditional update (F5) + pindah rombel + reset PIN (positif & negatif kuasa) + pending lintas periode tampil di L2 (G-7).
- [ ] Test E2E F1: `REJECTED → verifikasi PIN lama → daftar ulang (row sama) → approve → login sukses`; varian PIN-lama-salah ditolak generik + ter-audit; varian pindah rombel via guard (d) hijau (G-2); guard tetap menolak takeover `PENDING`/`ACTIVE`.
- [ ] Security test: guard deny-by-default (role asing `"MODERATOR"`, tanpa sesi, pesan statis), akses `/admin/*` oleh guru biasa (+ audit dedup, lahir dari server — G-9), reset PIN oleh non-pengampu, ban terhadap ADMIN ditolak (F6), reset password terhadap ADMIN ditolak (G-3), ban/reset password oleh superadmin dengan sesi fresh sukses (G-11), ban tanpa revoke-sesi mustahil.
- [ ] Test siklus nonaktif sekolah: login guru/parent/siswa baru gagal (hook dua persona — G-5), **sesi existing** (guru, siswa, parent) gagal/fail-closed (F7), kuis `/q/[token]` ditolak (G-4), `npsn` ter-clear dan bisa didaftarkan ulang sekolah lain, reaktivasi pasca-NPSN-diklaim aman (G-6).
- [ ] Test notifikasi: batch N siswa → tepat satu notifikasi ringkasan per guru (F4).
- [ ] Regresi nol dua arah: `/q/[token]`, `/parent/*` sekolah aktif tetap hijau, `/siswa/portal/*`, onboarding, panel member Story 2; `npm run build` + `npm test` hijau penuh.

---

## Acceptance Criteria

1. **Tangga Persetujuan L1–L3 (CAP-4, CAP-7):**
   - *Given* siswa `PENDING` hasil pendaftaran Story 3, *when* pengampu rombel approve via panel L1, *then* `accountStatus` menjadi `ACTIVE` lengkap dengan `approvedById`, `approvedAt`, `accountRequestedAt = null`, dan entri `AuditLog`, dan siswa dapat login seketika.
   - *Given* guru yang bukan pengampu, *when* mencoba approve L1, reset PIN, atau pindah rombel, *then* server menolak dengan pesan generik meskipun UI disembunyikan.
   - *Given* guru mana pun di sekolah, *when* membuka panel L2, *then* seluruh `PENDING` sekolah terlihat dengan highlight >7 hari (dari `accountRequestedAt`), dan setiap approve L2 memicu satu notifikasi ringkasan ke semua guru + `AuditLog`.
   - *Given* superadmin, *when* force approve siswa sekolah mana pun, *then* aksi berhasil dan ter-audit sebagai aktor superadmin (L3).
2. **Batch, Pindah Rombel & Reset PIN (N5, N6, B2, F5, F8, F12):**
   - *Given* batch approve berisi baris yang kalah race (mis. sudah di-approve guru lain secara konkuren), *when* transaksi selesai, *then* baris valid ter-approve, baris gagal dilaporkan eksplisit, `AuditLog` per-baris sukses, dan satu notifikasi ringkasan terkirim.
   - *Given* dua transisi status dieksekusi bersamaan pada siswa yang sama, *when* keduanya selesai, *then* tepat satu yang menang (conditional update `count = 1`), tanpa duplikat `AuditLog` dan tanpa P2002 mentah.
   - *Given* siswa pending dipindah rombel oleh pengampu sumber atau tujuan, *when* diproses, *then* hanya `classId` pada row `ClassStudent` existing yang berubah dan `@@unique([studentId, academicPeriodId])` tetap terhormat.
   - *Given* pengampu mereset PIN siswa, *when* berhasil, *then* PIN baru ter-hash via scrypt, `pinUpdatedAt` diperbarui, `failedAttempts`/`lockedUntil` reset, sesi perangkat lain hangus, dan `AuditLog` terisi tanpa PIN/hash di metadata.
   - *Given* siswa REJECTED mendaftar ulang dengan PIN lama yang cocok, *when* submit kode rombel lagi, *then* guard `registerStudent` mengizinkan (F1 + G-1), row `Student` yang sama dipakai ulang, status kembali `PENDING`, `failedAttempts`/`lockedUntil` reset, perubahan nama ter-red-flag, dan attempt kedua tercatat di `AuditLog`; PIN lama salah ditolak generik tanpa menyentuh row; pindah rombel via guard (d) menghasilkan UPDATE `classId` (G-2); sedangkan percobaan takeover atas NIS siswa `PENDING`/`ACTIVE` tetap ditolak keras.
3. **Superadmin & Siklus Hidup Sesi (CAP-7, B5, F3, F6, F7):**
   - *Given* user dengan `platformRole` bukan `"ADMIN"` (termasuk `"MODERATOR"` atau OWNER sekolah), *when* mengakses `/admin/*` atau memanggil aksi admin, *then* ditolak deny-by-default dengan `SuperAdminRequiredError` berpesan statis identik di semua jalur; bila sesi valid, percobaan ter-audit dengan dedup 60 detik.
   - *Given* superadmin mencoba mem-ban `platformRole === "ADMIN"`, *when* dieksekusi, *then* ditolak keras.
   - *Given* guru di-ban atau password-nya di-reset, *when* sesi lama mencoba request, *then* seluruh sesi Better Auth aktif miliknya sudah di-revoke.
   - *Given* sekolah dinonaktifkan, *when* guru/parent/siswa mencoba login (hook dua persona — G-5), sesi existing guru/parent/siswa mencoba request, siswa mencoba register/lookup kode, atau kuis `/q/[token]` diakses (G-4), *then* semua gagal fail-closed, `School.npsn` kosong sehingga NPSN itu dapat dipakai sekolah lain, dan tidak ada jendela re-klaim sebelum status nonaktif tercatat; reaktivasi pasca-NPSN-diklaim sukses tanpa NPSN dan tanpa P2002 mentah (G-6).
   - *Given* superadmin tanpa TeacherProfile membuka `/admin/*`, *when* halaman dirender, *then* tidak terjadi redirect `/onboarding` (route group top-level, F3).
4. **Jejak Audit & Regresi Nol:**
   - *Given* seluruh aksi tangga L1–L3 dan aksi superadmin, *when* dieksekusi, *then* masing-masing meninggalkan `AuditLog` dengan metadata bebas PIN/hash/secret.
   - *Given* seluruh test suite lama (kuis publik, parent sekolah aktif, portal siswa, onboarding, panel member), *when* dijalankan bersama test baru Story 5, *then* 100% hijau dan `tsc` bersih.

---

## Implementation Notes

- **Kontrak `requireSuperAdmin()` (deferred work Story 1, terkeras)**: strict equality `platformRole === "ADMIN"` — nilai asing seperti `"MODERATOR"` tertolak (bukan pola `!== "USER"`); tanpa sesi → denied; satu jenis error tunggal `SuperAdminRequiredError` dengan pesan statis identik semua jalur (anti-enumerasi); baca role via `session.user` dengan fallback `prisma.user.findUnique({ where: { id: session.userId } })`; tanpa mengubah `src/lib/auth.ts` demi guard ini. Detail lengkap: `_bmad-output/implementation-artifacts/deferred-work.md` (Ronde 2 S7/S8, Ronde 5 RT3, Ronde 3 A15 laporan elicitation Story 1).
- **Pengampu rombel (OQ-1)**: kuasa L1 dan reset PIN diverifikasi server-side via eksistensi `TeachingContext` (guru, classId, academicPeriodId aktif). Beberapa guru dapat menjadi pengampu rombel yang sama — konsekuensi diterima.
- **Conditional update pattern (F5)**: `const r = await tx.student.updateMany({ where: { id, accountStatus: "PENDING" }, data: {...} }); if (r.count !== 1) → baris gagal/dilaporkan`. Jangan bergantung pada unique constraint yang tidak ada untuk mencegah double-transition.
- **Admin plugin Better Auth (F6)**: belum terpasang saat baseline (versi `better-auth` 1.6.29, plugin tersedia). Sinkronkan kolom tabel `user` yang disyaratkan plugin secara aditif; guard anti-ban-ADMIN wajib sebelum aksi ban dieksekusi.
- **Hook sekolah nonaktif (OQ-6)**: `databaseHooks.session.create` di `src/lib/auth.ts` menolak sesi guru baru bila sekolahnya nonaktif — ini hook lifecycle, bukan modifikasi kontrak guard. Sesi lama sudah ditangani revoke saat deaktivasi.
- **Urutan deaktivasi sekolah (B5, F7)**: (1) tandai nonaktif → (2) revoke sesi guru/parent → (3) fail-closed siswa/portal/parent per-request → (4) clear `npsn` → (5) `AuditLog`. Clear `npsn` sebelum status tercatat membuka jendela re-klaim NPSN — dilarang.
- **Nonaktif sekolah & NPSN**: `School.npsn @unique` membuat NPSN sah terkunci permanen bila tidak di-clear saat deaktivasi (B5). Kolom penanda nonaktif wajib aditif (N1) — `School` saat baseline tidak punya kolom status sama sekali.
- **Eskalasi highlight (F2)**: threshold 48 jam (L1) dan 7 hari (L2) dihitung dari `Student.accountRequestedAt` — konstanta terpusat, bukan angka tersebar. `Student.createdAt` adalah waktu row leger (bisa hasil impor bertahun lalu) dan **dilarang** dipakai.
- **FK formal `approvedById` (OQ-5)**: aman tanpa backfill karena data existing `null` semua (forensik: Story 3 tidak pernah mengisi field ini).
- **Reset PIN (OQ-4 + F8)**: guru mengetik PIN baru 4-digit (wajib berbeda dari lama), ditampilkan sekali; hygiene akun lengkap dalam satu transaksi; siswa menerima PIN secara offline. Reset PIN saat siswa mengerjakan kuis memang menghanguskan sesi berjalan — perilaku benar (keamanan > kelancaran), attempt tersimpan dapat dilanjutkan.
- **Pindah rombel hanya untuk siswa pending** pada periode aktif; siswa `ACTIVE` tidak dipindah lewat panel ini (keluar scope CAP-7). Kuasa: pengampu rombel sumber ATAU tujuan (F12).
- **Filter AuditLog** wajib memanfaatkan index `[actorId, createdAt]` dan `[targetType, targetId]` yang sudah ada sejak N4 — hindari full scan; panel pending memakai index baru `[schoolId, accountStatus]` (F9).
- **Verifikasi daftar ulang REJECTED (G-1)**: PIN lama adalah bukti kepemilikan satu-satunya di jalur ini (REJECTED tidak punya sesi). Bila PIN lupa, satu-satunya jalur pulih = pengampu/superadmin me-reset PIN siswa REJECTED via panel (PIN baru disampaikan offline) — karenanya kuasa reset PIN diperluas ke siswa REJECTED. Tidak ada jalur daftar ulang tanpa verifikasi.
- **Reaktivasi sekolah (G-6)**: `deactivateSchoolAction` tidak bersifat terminal — reaktivasi mengembalikan status aktif dengan `npsn = null`; NPSN diisi ulang lewat update eksplisit yang menangkap P2002 menjadi pesan generik. Keputusan ini dikunci sekarang supaya tidak diimprovisasi implementer.
- **Pending lintas periode (G-7)**: L1 tetap ter-scope periode aktif (per-rombel), tetapi L2 sekolah-wide TIDAK memfilter periode — siswa PENDING dari periode lampau tetap terlihat dan dapat diproses (pindah rombel target wajib rombel periode aktif). Test khusus mencegah regresi "pending abadi".
- **Audit akses admin (G-9)**: proxy berjalan di edge runtime dan tidak menulis DB — blok `/admin/*` di proxy murni redirect. `ADMIN_ACCESS_DENIED` lahir dari `requireSuperAdmin()` di layout/handler; dedup 60 detik best-effort (request konkuren bisa menghasilkan >1 entri — diterima).
- **Role stale plugin admin (G-11)**: plugin admin Better Auth memvalidasi `user.role` dari data sesi; superadmin dengan sesi yang dibuat sebelum role ter-set bisa ditolak plugin meski `platformRole === "ADMIN"`. Action admin menangkap penolakan plugin menjadi pesan generik; integration test ban/reset password wajib memakai sesi fresh.

---

## Review Triage Log

<!-- Kosong sampai review pass pertama (step-04). -->

## Design Notes

- **Mapping role Better Auth vs `platformRole` (investigasi plugin v1.6.29)**: plugin `admin` mengotori field `user.role` sendiri (schema: `role`, `banned`, `banReason`, `banExpires`; default role `"user"`, admin role `"admin"`). `platformRole` kita tetap kanonik untuk `requireSuperAdmin()` (kontrak deferred work). Sinkronisasi: kolom `User.role @default("USER")` baru + seeder menulis `role: "ADMIN"` bersama `platformRole: "ADMIN"` + konfigurasi `admin({ adminRoles: ["ADMIN"], defaultRole: "USER" })`. Alternatif `adminUserIds` (bypass role) ditolak — butuh resolusi ID saat boot dari env, rapuh saat rotasi superadmin.
- **Choke point fail-closed siswa (F7)**: `verifyStudentSession()` sudah DB-check per request (bukan token stateless murni) — menambah penanda nonaktif sekolah pada select yang sama = satu titik perubahan untuk seluruh portal siswa, tanpa menyentuh tiap aksi.
- **Pengampu rombel (OQ-1)**: query keberadaan `TeachingContext` (teacherProfileId sesi, classId, academicPeriodId aktif) — tanpa kolom baru; diterima bahwa beberapa guru = pengampu.

## Verification

**Commands:**
- `npm run verify:migrations` -- expected: exit 0 (chain migrasi = schema.prisma).
- `npx tsc --noEmit` -- expected: 0 error.
- `npx vitest run` -- expected: seluruh test unit + integration (termasuk suite baru Story 5) hijau.
- `npm run build` -- expected: sukses tanpa error.
- `npx playwright test` -- expected: rantai E2E existing (stage01–stage10, smoke) tetap hijau (regresi nol N9).

**Manual checks:**
- Alur manual `/admin/*` sebagai superadmin hasil seeder: semua aksi terjangkau tanpa redirect `/onboarding` (F3).
- Inspect `AuditLog`: tidak ada PIN/hash/secret di `metadata` untuk seluruh aksi baru.

---

## Spec Change Log

- 2026-09-23 — **Consolidated Elicitation Hardening (multi-method pass + forensic code verification — apply ALL disetujui human)**:
  - **[F1 Critical]** Amend guard `registerStudent`: jalur daftar ulang `REJECTED` diizinkan (reuse row + reset hygiene + AuditLog attempt kedua) — guard anti-takeover tetap keras untuk `PENDING`/`ACTIVE`. Menutup kepatuhan CAP-4 yang sebelumnya mustahil tercapai.
  - **[F2 Critical]** Kolom aditif `Student.accountRequestedAt` sebagai satu-satunya sumber kebenaran highlight eskalasi 48 jam/7 hari (`createdAt` dilarang dipakai).
  - **[F3 Critical]** `/admin/*` wajib route group top-level terpisah — layout `(dashboard)` me-redirect superadmin tanpa school-context ke `/onboarding`.
  - **[F4 High]** Notifikasi approve L2 di-aggregate satu ringkasan per aksi (individu/batch) — mencegah spam 1.500 notifikasi sekali klik batch.
  - **[F5 High]** Semua transisi status wajib conditional update (`updateMany` berkondisi + cek `count`) — kebal race approve/batch/daftar-ulang.
  - **[F6 High]** Sinkronisasi kolom plugin admin Better Auth di tabel `user` + guard anti-ban-`ADMIN`.
  - **[F7 High]** Deaktivasi sekolah fail-closed di semua gerbang (login guru/siswa, register, lookup, portal siswa, `/parent/*`) dengan urutan aman; sesi parent dimasukkan scope invalidasi.
  - **[F8 Medium]** Reset PIN wajib hygiene akun: reset `failedAttempts`/`lockedUntil` + `pinUpdatedAt` dalam satu transaksi.
  - **[F9 Medium]** Index aditif `@@index([schoolId, accountStatus])` untuk query panel pending.
  - **[F10 Medium]** Audit `ADMIN_ACCESS_DENIED` ber-dedup 60 detik, hanya untuk sesi valid.
  - **[F11 Medium]** Suite test wajib: E2E REJECTED→daftar ulang→approve→login, sesi existing pasca-deaktivasi, race conditional update, ban-ADMIN-ditolak.
  - **[F12 Low]** Kuasa pindah rombel = pengampu rombel sumber ATAU tujuan.
  - **OQ-1…OQ-8 terkunci** (pengampu = TeachingContext aktif; batch = skip+laporan; model `Notification` aditif; guru ketik PIN; FK formal; hook `databaseHooks`; audit dedup; superadmin lintas-sekolah) — rincian di bagian "Keputusan Elicitasi" dan report elicitation.
- 2026-09-22 — **Amendemen Round 2 (elisitasi multi-metode + party mode pra-implementasi — apply-all disetujui human; frozen section direnegosiasi & disetujui eksplisit)**:
  - **[G-1 Critical]** Daftar ulang REJECTED wajib verifikasi PIN lama (anti-takeover: NIS semi-ditebak, nama bebas tidak lagi cukup); perubahan nama = red-flag AuditLog + UI approve; PIN lupa → reset PIN REJECTED oleh pengampu/superadmin sebagai jalur pulih; kuasa reset PIN diperluas ke REJECTED.
  - **[G-2 Critical]** Amend guard skenario (d) `existingEnrollment` — REJECTED pindah rombel = UPDATE `classId` row existing, bukan ditolak; tanpa ini CAP-4 gagal lagi di cabang rombel-berbeda.
  - **[G-3 Critical]** `resetTeacherPasswordAction` menolak target `platformRole === "ADMIN"` — menutup kontradiksi F6 (ban dilarang, password bisa diganti).
  - **[G-4 High]** Fail-closed deaktivasi mencakup alur kuis publik `/q/[token]` + aksi kuis token-based.
  - **[G-5 High]** Hook `databaseHooks.session.create` menolak sesi baru guru DAN parent sekolah nonaktif.
  - **[G-6 High]** Kebijakan reaktivasi sekolah terkunci: sukses tanpa NPSN, konflik `@unique` ditangkap generik.
  - **[G-7 High]** Panel L2 tanpa filter periode — pending lintas-periode tidak menggantung tak terlihat.
  - **[G-8 Medium]** Cap batch approve 100 baris per aksi, server-side.
  - **[G-9 Medium]** `ADMIN_ACCESS_DENIED` lahir dari `requireSuperAdmin()` server-side; proxy hanya redirect; dedup best-effort.
  - **[G-10 Medium]** Migrasi menambah `@@index([userId, readAt])` pada `Notification`.
  - **[G-11 Medium]** Penanganan penolakan plugin admin akibat role sesi stale + integration test sesi fresh.
