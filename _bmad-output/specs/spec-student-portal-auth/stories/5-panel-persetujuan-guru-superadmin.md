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
   - Aksi **approve** (set `accountStatus = ACTIVE` + `approvedById` + `approvedAt`), **reject** (set `REJECTED` + alasan), dan **batch approve** atomic dengan semantik skip-baris-gagal + laporan (keputusan OQ-2; N6).
   - **Perbaikan jalur daftar ulang REJECTED (F1)**: amend guard `registerStudent` agar mengizinkan registrasi ulang bila `accountStatus === "REJECTED"` — reuse row `Student`, update `accessPinHash`/`fullName`, kembali `PENDING`, reset `failedAttempts`/`lockedUntil`, upsert `ClassStudent` ke rombel kode baru; guard anti-takeover tetap keras untuk `PENDING`/`ACTIVE`; attempt kedua tercatat di `AuditLog`.
   - **Highlight eskalasi berbasis `Student.accountRequestedAt` (F2)**: pending >48 jam di panel pengampu (L1); pending >7 hari di panel semua guru (L2). Field ini diisi saat akun mengaju, di-null-kan saat keputusan, di-reset saat daftar ulang.
   - **Aksi pindah rombel** untuk siswa pending (N5): UPDATE `classId` pada row `ClassStudent` existing, menghormati `@@unique([studentId, academicPeriodId])`; kuasa = pengampu rombel sumber ATAU tujuan (F12).
   - **Reset PIN siswa** (B2): hanya pengampu rombel aktif di periode aktif atau superadmin; guru mengetik PIN baru 4-digit (OQ-4); wajib hygiene akun lengkap (F8); rotasi `pinUpdatedAt` menghanguskan sesi perangkat lain.
   - **Semua transisi status memakai conditional update** (F5): `updateMany where { id, accountStatus: "PENDING" }` + cek `count === 1` di dalam transaksi — kebal race approve-vs-batch dan approve-vs-daftar-ulang tanpa bergantung unique constraint yang tidak ada.
   - Setiap transisi tangga L1–L3 tercatat di `AuditLog`.
2. **Guard `requireSuperAdmin()`** (pelunasan deferred work Story 1): deny-by-default strict equality `platformRole === "ADMIN"` (nilai asing seperti `"MODERATOR"` tertolak), tanpa sesi → denied, satu jenis error tunggal `SuperAdminRequiredError` dengan pesan statis identik semua jalur (anti-enumerasi), baca role via `session.user` dengan fallback `prisma.user.findUnique({ where: { id: session.userId } })`, tanpa mengubah `src/lib/auth.ts` untuk keperluan guard ini. **Satu-satunya gerbang** — dilarang menyebar pengecekan `platformRole` manual di handler mana pun.
3. **Infrastruktur notifikasi aditif (OQ-3, F4)**: model `Notification` minimal (`userId`, `schoolId`, `type`, `payload Json`, `readAt`, `createdAt`) + badge/feed sederhana di header dashboard. Approve L2 memicu **satu notifikasi ringkasan per aksi** (individu maupun batch) ke semua membership `ACTIVE` sekolah — bukan per-baris. Model ini reusable untuk Gelombang 3 (koreksi tugas) dan 4.
4. **Area backstop `/admin/*` untuk superadmin (CAP-7)** — route group **top-level terpisah** dengan layout sendiri (F3; dilarang menest di `(dashboard)` yang me-redirect superadmin tanpa school-context ke `/onboarding`):
   - Force approve siswa (tingkat L3, lintas sekolah — OQ-8 dikonfirmasi penuh tanpa membership).
   - Ban guru + reset password guru → wajib revoke SEMUA sesi Better Auth aktif milik user via `revokeUserSessions` (pasang admin plugin Better Auth di `src/lib/auth.ts` — B5); superadmin dilarang mem-ban superadmin lain (F6).
   - Nonaktifkan sekolah → **fail-closed di SEMUA gerbang** (F7): login guru (hook Better Auth `databaseHooks.session.create`, OQ-6), `loginStudent`, `registerStudent`, `lookupJoinCode`, aksi portal siswa, dan layanan baca `/parent/*`; sesi existing di-revoke (guru/parent) dan fail-closed per-request (siswa); **clear `npsn`** saat deaktivasi (B5; tanpa ini NPSN sah terkunci permanen oleh `School.npsn @unique`); urutan aman: tandai nonaktif → revoke sesi → fail-closed → clear npsn → `AuditLog`.
   - AuditLog UI: viewer berfilter (aktor, aksi, target, rentang waktu).
   - Percobaan akses `/admin/*` oleh non-superadmin ter-audit dengan dedup 60 detik, hanya bila sesi valid (OQ-7, F10).
   - Proteksi berlapis: blok optimistic di `src/proxy.ts` + validasi server-side nyata via `requireSuperAdmin()` di layout/handler.
5. **Migrasi aditif** (N1): penanda nonaktif `School` (nullable), `Student.accountRequestedAt` (nullable, F2), FK formal `Student.approvedById` → `User` (aman tanpa backfill — data existing `null` semua, OQ-5), `@@index([schoolId, accountStatus])` pada `Student` (F9), model `Notification`, serta sinkronisasi kolom plugin admin Better Auth di tabel `user` (`banned`, `banReason`, `banExpires`, … — F6). Nol drop/rename; `npm run verify:migrations` exit 0.

## Boundaries & Constraints

**Always:**
- **Guard `requireSuperAdmin()` deny-by-default (kontrak deferred work Story 1, terkeras)**: strict equality `platformRole === "ADMIN"`; tanpa sesi → denied; satu jenis error `SuperAdminRequiredError` dengan pesan statis identik di semua jalur (anti-enumerasi); fallback baca DB `prisma.user.findUnique` bila role tidak ada di `session.user`; tanpa mengubah `src/lib/auth.ts` demi guard ini (perubahan `auth.ts` hanya untuk plugin admin + hook OQ-6).
- **Satu gerbang untuk semua aksi admin**: seluruh handler `/admin/*` memanggil `requireSuperAdmin()` — dilarang menyebar pengecekan `platformRole` manual yang mengunduk lupa satu jalur.
- **Monopoli kuasa reset PIN (Amendum B2)**: reset PIN siswa HANYA oleh pengampu rombel siswa tersebut di periode aktif, atau Superadmin. Guru sekolah lain dilarang meski satu sekolah (Mode Santai membuat akun guru muran — reset PIN adalah kunci impersonasi siswa).
- **Notifikasi approve L2 ter-aggregate (B2 + F4)**: satu notifikasi ringkasan per aksi (individu/batch) ke semua membership `ACTIVE` sekolah + entri `AuditLog`; `AuditLog` tetap per-baris untuk batch (N6).
- **Batch approve atomic dengan semantik skip + laporan (N6, keputusan OQ-2)**: satu `$transaction`; baris yang kalah race di-skip dan dilaporkan eksplisit; `AuditLog` per-baris sukses; tidak ada baris ter-approve senyap.
- **Conditional update untuk semua transisi status (F5)**: `updateMany` berkondisi `accountStatus` lama + cek `count`, di dalam transaksi — wajib di approve, reject, batch, force approve, dan daftar ulang.
- **Siklus hidup `accountRequestedAt` (F2)**: diisi `now()` saat akun mengaju (PENDING), di-null-kan saat keputusan (approve/reject), di-reset saat daftar ulang — satu-satunya sumber kebenaran highlight eskalasi.
- **Pindah rombel via UPDATE `classId` (N5)**: pada row `ClassStudent` existing periode aktif — bukan delete-insert; menghormati `@@unique([studentId, academicPeriodId])`; kuasa = pengampu rombel sumber ATAU tujuan (F12).
- **Siklus hidup sesi superadmin (Amendum B5)**: ban guru dan reset password guru wajib revoke SEMUA sesi Better Auth aktif milik user (`revokeUserSessions` — admin plugin terpasang di `src/lib/auth.ts`); nonaktif sekolah wajib fail-closed di semua gerbang (login guru via `databaseHooks.session.create`, `loginStudent`, `registerStudent`, `lookupJoinCode`, aksi portal siswa, layanan baca `/parent/*`), meng-invalidate sesi existing, dan clear `School.npsn`.
- **Reset PIN wajib hygiene akun (F8)**: `accessPinHash` baru + `pinUpdatedAt = now()` + reset `failedAttempts = 0`, `lockedUntil = null`, dalam satu transaksi.
- **Jejak audit total**: setiap aksi superadmin dan setiap transisi tangga L1–L3 (approve/reject/pindah rombel/reset PIN/ban/reset password/nonaktif sekolah/force approve) wajib menulis `AuditLog`; `metadata` dilarang memuat PIN/hash/secret (N4). Percobaan akses `/admin/*` oleh sesi valid non-admin ter-audit dengan dedup 60 detik (F10).
- **Migrasi 100% aditif (N1)**: semua kolom baru nullable/ber-default; nol drop/rename; `npm run verify:migrations` tetap exit 0.
- **Scope & periode aktif**: seluruh query panel di-scope ke sekolah aktif guru (dari sesi) dan periode akademik aktif; superadmin bebas lintas-sekolah (OQ-8).
- **Pesan error statis & generik** untuk semua aksi sensitif (approve/reject/reset PIN/admin) — tidak membocorkan keberadaan status baris lain.
- **Regresi nol (N9)**: alur `/q/[token]`, `/parent/*` (sekolah aktif), `/siswa/portal/*`, onboarding, dan panel member Story 2 tetap hijau; `tsc` bersih; seluruh test lama & baru hijau.

**Never:**
- Menciptakan superadmin melalui registrasi/aplikasi — env allowlist + seeder (Story 1c) adalah satu-satunya jalur kelahiran (CAP-7).
- Mengizinkan guard anti-takeover `registerStudent` membuka jalur untuk akun `PENDING`/`ACTIVE` — perlawanan F1 HANYA untuk `accountStatus === "REJECTED"`.
- Mengizinkan guru bukan-pengampu melakukan approve L1, reset PIN, atau pindah rombel.
- Mengizinkan akses `/admin/*` oleh siapa pun selain `platformRole === "ADMIN"` — termasuk guru OWNER sekolah.
- Mem-ban superadmin lain (F6) — aksi ban terhadap `platformRole === "ADMIN"` wajib ditolak.
- Menest `/admin/*` di bawah route group `(dashboard)` atau layout ber-school-context (F3) — superadmin tanpa membership akan ter-redirect ke `/onboarding`.
- Mengeksekusi batch approve yang membiarkan sebagian baris ter-approve secara diam-diam tanpa laporan/jejak.
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
| **Portal & parent saat sekolah nonaktif (F7)** | Sesi existing siswa/parent sekolah nonaktif request | Aksi portal siswa & layanan baca `/parent/*` menolak fail-closed | Tidak ada baca/tulis lanjutan ke sekolah mati |
| **Non-superadmin akses `/admin/*`** | Guru biasa membuka `/admin/*` | Diblok optimistic di proxy + ditolak server-side oleh `requireSuperAdmin()` | Redirect/403 generik; jika sesi valid → `AuditLog` `ADMIN_ACCESS_DENIED` dengan dedup 60 detik (F10) |
| **AuditLog viewer** | Superadmin membuka `/admin/*` audit | Daftar log terfilter (aktor, aksi, target, waktu), terpaginasi | Index `[actorId, createdAt]` & `[targetType, targetId]` terpakai |
| **Siswa REJECTED daftar ulang (F1)** | Siswa submit kode rombel lagi setelah ditolak | Guard `registerStudent` mengizinkan `REJECTED`: reuse row, update pin/nama, kembali `PENDING`, reset hygiene, upsert `ClassStudent` rombel baru | Attempt kedua tercatat di `AuditLog` (glosarium §9.2) |
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

## Code Map

### 1. Guard & Infrastruktur
- `src/lib/superadmin.ts`: `requireSuperAdmin()` + `SuperAdminRequiredError` (kontrak deferred work Story 1).
- `src/lib/auth.ts`: pasang admin plugin Better Auth (F6) + hook `databaseHooks.session.create` deny sekolah nonaktif (OQ-6) — dua-satunya perubahan file ini yang diizinkan.
- `prisma/schema.prisma` + migrasi aditif: penanda nonaktif `School`, `Student.accountRequestedAt` (F2), FK formal `Student.approvedById` → `User` (OQ-5), `@@index([schoolId, accountStatus])` (F9), model `Notification` (OQ-3), sinkronisasi kolom plugin admin di tabel `user` (F6).
- `src/modules/notifications/`: service create/list/mark-read (aggregate per aksi, F4).
- `src/proxy.ts`: blok optimistic `/admin/*` (tanpa cookie sesi → redirect login).

### 2. Modul Server Actions
- `src/modules/approvals/approvals.actions.ts`: `getPendingStudentsForClassAction`, `getPendingStudentsForSchoolAction`, `approveStudentAction`, `rejectStudentAction`, `batchApproveStudentsAction` (N6 + OQ-2), `moveStudentClassAction` (N5 + F12), `resetStudentPinAction` (B2 + OQ-4 + F8). Semua transisi memakai conditional update (F5).
- `src/modules/admin/admin.actions.ts`: `forceApproveStudentAction`, `banTeacherAction` (+ revoke sesi, guard anti-ban-ADMIN F6), `resetTeacherPasswordAction` (+ revoke sesi), `deactivateSchoolAction` (urutan aman B5 + F7 + clear npsn), `getAuditLogsAction`, audit `ADMIN_ACCESS_DENIED` ber-dedup (F10).
- `src/modules/student-auth/student-auth.actions.ts`: amend guard `registerStudent` untuk jalur REJECTED (F1) + fail-closed sekolah nonaktif pada `loginStudent`, `registerStudent`, `lookupJoinCode` (F7).
- Konsumen aksi portal siswa & layanan baca `/parent/*`: guard fail-closed sekolah nonaktif (F7).
- `src/lib/auth.ts` (hook, OQ-6): blokir sesi guru baru sekolah nonaktif.

### 3. Antarmuka
- Tab "Menunggu Persetujuan" L1 pada alur rombel/roster siswa guru — highlight eskalasi >48 jam berbasis `accountRequestedAt`.
- Halaman panel L2 sekolah-wide — highlight >7 hari, checklist batch + tombol sticky "Setujui (N)", pindah rombel, reset PIN (one-thumb friendly, F-persona guru HP kecil).
- Route group top-level `src/app/admin/*` (bukan di `(dashboard)` — F3): dashboard superadmin — force approve, ban guru, reset password guru, nonaktif sekolah, AuditLog viewer (dilindungi layout `requireSuperAdmin()`).
- Badge/feed `Notification` sederhana di header dashboard guru (OQ-3).

---

## Tasks & Acceptance

### Execution Checklist

**Fase 1 — Guard, Migrasi & Infrastruktur:**
- [ ] Tulis `requireSuperAdmin()` + `SuperAdminRequiredError` di `src/lib/superadmin.ts` (kontrak terkeras deferred work Story 1) + unit test.
- [ ] Migrasi aditif: penanda nonaktif `School`, `Student.accountRequestedAt` (F2), FK formal `approvedById` → `User` (OQ-5), `@@index([schoolId, accountStatus])` (F9), model `Notification` (OQ-3), sinkronisasi kolom plugin admin (F6); `npm run verify:migrations` exit 0.
- [ ] Pasang admin plugin Better Auth di `src/lib/auth.ts` + sinkron kolom `user`; verifikasi `revokeUserSessions` berfungsi (F6).
- [ ] Pasang hook `databaseHooks.session.create` deny sekolah nonaktif (OQ-6).
- [ ] Blok optimistic `/admin/*` di `src/proxy.ts`.

**Fase 2 — Panel Persetujuan Guru (CAP-4, B2, N5, N6, F1):**
- [ ] Panel L1 per-rombel (tab pending) dengan verifikasi kuasa pengampu server-side + highlight >48 jam (dari `accountRequestedAt`).
- [ ] Panel L2 sekolah-wide dengan highlight >7 hari + checklist batch + pindah rombel + reset PIN.
- [ ] `approveStudentAction` / `rejectStudentAction` dengan conditional update (F5) + `accountRequestedAt = null` + `AuditLog`.
- [ ] `batchApproveStudentsAction`: satu `$transaction`, skip-baris-gagal + laporan, `AuditLog` per-baris sukses (N6, OQ-2).
- [ ] `moveStudentClassAction`: UPDATE `classId` row existing, kuasa pengampu sumber/tujuan (N5, F12).
- [ ] `resetStudentPinAction`: validasi kuasa, PIN dari guru (OQ-4), hygiene lengkap (F8), satu transaksi + `AuditLog`.
- [ ] Amend guard `registerStudent` untuk jalur REJECTED (F1) + AuditLog attempt kedua.
- [ ] Model + service `Notification` dengan aggregate per aksi + badge feed header dashboard (OQ-3, F4).

**Fase 3 — Area Superadmin `/admin/*` (CAP-7, B5):**
- [ ] Route group top-level `src/app/admin/*` dengan layout `requireSuperAdmin()` (F3).
- [ ] `forceApproveStudentAction` lintas-sekolah + `AuditLog` + conditional update.
- [ ] `banTeacherAction` (+ guard anti-ban-ADMIN, F6) + `resetTeacherPasswordAction`, keduanya revoke SEMUA sesi (B5) + `AuditLog`.
- [ ] `deactivateSchoolAction` urutan aman: tandai nonaktif → revoke sesi guru/parent → fail-closed siswa → clear `npsn` → `AuditLog` (B5, F7).
- [ ] Fail-closed sekolah nonaktif: `loginStudent`, `registerStudent`, `lookupJoinCode`, konsumen aksi portal siswa, layanan baca `/parent/*` (F7).
- [ ] Audit percobaan akses `/admin/*` ber-dedup 60 detik, hanya sesi valid (OQ-7, F10).
- [ ] AuditLog viewer berfilter + terpaginasi (pakai index N4).

**Fase 4 — Verifikasi Pengujian:**
- [ ] Integration test real-db: seluruh tangga L1–L3 + batch (skip+laporan) + konkurensi conditional update (F5) + pindah rombel + reset PIN (positif & negatif kuasa).
- [ ] Test E2E F1: `REJECTED → daftar ulang (row sama) → approve → login sukses`; guard tetap menolak takeover `PENDING`/`ACTIVE`.
- [ ] Security test: guard deny-by-default (role asing `"MODERATOR"`, tanpa sesi, pesan statis), akses `/admin/*` oleh guru biasa (+ audit dedup), reset PIN oleh non-pengampu, ban terhadap ADMIN ditolak (F6), ban tanpa revoke-sesi mustahil.
- [ ] Test siklus nonaktif sekolah: login guru/siswa baru gagal, **sesi existing** (guru, siswa, parent) gagal/fail-closed (F7), `npsn` ter-clear dan bisa didaftarkan ulang sekolah lain.
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
   - *Given* siswa REJECTED mendaftar ulang, *when* submit kode rombel lagi, *then* guard `registerStudent` mengizinkan (F1), row `Student` yang sama dipakai ulang, status kembali `PENDING`, `failedAttempts`/`lockedUntil` reset, dan attempt kedua tercatat di `AuditLog`; sedangkan percobaan takeover atas NIS siswa `PENDING`/`ACTIVE` tetap ditolak keras.
3. **Superadmin & Siklus Hidup Sesi (CAP-7, B5, F3, F6, F7):**
   - *Given* user dengan `platformRole` bukan `"ADMIN"` (termasuk `"MODERATOR"` atau OWNER sekolah), *when* mengakses `/admin/*` atau memanggil aksi admin, *then* ditolak deny-by-default dengan `SuperAdminRequiredError` berpesan statis identik di semua jalur; bila sesi valid, percobaan ter-audit dengan dedup 60 detik.
   - *Given* superadmin mencoba mem-ban `platformRole === "ADMIN"`, *when* dieksekusi, *then* ditolak keras.
   - *Given* guru di-ban atau password-nya di-reset, *when* sesi lama mencoba request, *then* seluruh sesi Better Auth aktif miliknya sudah di-revoke.
   - *Given* sekolah dinonaktifkan, *when* guru/siswa mencoba login, sesi existing guru/parent/siswa mencoba request, atau siswa mencoba register/lookup kode, *then* semua gagal fail-closed, `School.npsn` kosong sehingga NPSN itu dapat dipakai sekolah lain, dan tidak ada jendela re-klaim sebelum status nonaktif tercatat.
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
