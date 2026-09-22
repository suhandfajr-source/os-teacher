# Comprehensive BMad Elicitation Report — Full Multi-Method Deep Analysis
## Story 5: Panel Persetujuan Guru & Superadmin (`spec-student-portal-auth`)

| Parameter | Keterangan |
|---|---|
| **Target Spesifikasi** | `_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md` (status draft, baseline `013603f`) |
| **Tanggal Analisis** | 2026-09-23 |
| **Cakupan Elisitasi** | Konsolidasi multi-metode (Tree/Graph of Thoughts, Red Team, Inversion, Pre-Mortem, Six Hats, Stakeholder Round Table, Failure Mode, Chaos, Verification Gap, dsb.) + **verifikasi forensik langsung ke kode Story 3/4** |
| **Status Basis Data** | Better Auth 1.6.29 (plugin `admin` tersedia di `node_modules/better-auth/dist/plugins/admin`); `Student.approvedById` belum memiliki relation formal & tidak pernah diisi Story 3; tidak ada field timestamp permintaan akun |
| **Verdict Ringkas** | **CRITICAL HARDENING REQUIRED** — Ditemukan 1 jalur wajib CAP-4 yang **mati total di kode eksisting** (daftar ulang REJECTED terblokir guard Story 3), 1 kolom skema yang **hilang** untuk seluruh fitur highlight eskalasi, 1 **perangkap routing superadmin**, dan 7 temuan hardening lain. |

---

## 1. Ringkasan Eksekutif & Temuan Terkristalisasi (Triage Table)

| ID | Severity | Kategori | Temuan Inti | Rekomendasi Solusi Wajib |
|---|---|---|---|---|
| **F1** | 🔴 **CRITICAL** | Kepatuhan CAP-4 / Forensik Kode | **Jalur daftar ulang REJECTED MATI di kode eksisting**: `registerStudent` (Story 3) menolak keras registrasi ulang bila `existingStudent.accessPinHash !== null` (guard F1 anti-takeover Story 4). Siswa REJECTED **memiliki** `accessPinHash` (dipasang saat pendaftaran pertama) → selamanya ditolak dengan pesan "Akun sudah terdaftar". Kriteria sukses CAP-4 "REJECTED dapat mendaftar ulang pada row Student yang sama" **mustahil tercapai** dengan kode saat ini. | Amankan guard di `registerStudent`: izinkan registrasi ulang bila `accountStatus === "REJECTED"` (reuse row, update `accessPinHash`/`fullName`/`accountStatus = PENDING`, reset `failedAttempts`/`lockedUntil`, upsert `ClassStudent` ke rombel kode baru — pola upsert-update yang sudah ada di cabang (b)), tulis `AuditLog` attempt kedua. Guard anti-takeover tetap keras untuk `PENDING`/`ACTIVE`. |
| **F2** | 🔴 **CRITICAL** | Skema / Fitur Highlight | **Tidak ada sumber waktu untuk eskalasi 48 jam / 7 hari**: `Student.createdAt` = waktu row leger dibuat (bisa bertahun lalu via impor roster), bukan waktu akun MENGAJU. Siswa eksisting yang baru daftar akun hari ini akan langsung tampak "eskalasi 2 tahun", atau sebaliknya highlight tidak pernah akurat. Seluruh fitur highlight eskalasi draft tidak punya fondasi data. | Migrasi aditif: kolom `Student.accountRequestedAt DateTime?` — diisi `now()` saat `registerStudent` menghasilkan PENDING (cabang b/c & jalur daftar ulang F1), di-null-kan saat keputusan (approve/reject), di-reset saat daftar ulang. Threshold eskalasi menghitung dari field ini. |
| **F3** | 🔴 **CRITICAL** | Routing / Perangkap Onboarding | **Superadmin ter-perangkap redirect `/onboarding`**: `src/app/(dashboard)/layout.tsx` me-redirect ke `/onboarding` bila `!profile?.onboardingCompleted || !activeSchoolId`. Superadmin tidak punya `TeacherProfile`/membership → jika `/admin/*` dinest di grup `(dashboard)` atau berbagi layout, superadmin justru terlempar ke onboarding dan area admin tidak terjangkau. | Bangun `/admin/*` sebagai route group top-level terpisah dengan layout sendiri yang memanggil `requireSuperAdmin()`. Dilarang menest di `(dashboard)` atau mewarisi layout school-context. Branch proxy `/admin/*` hanya blok optimistic tanpa cookie. |
| **F4** | 🟠 **HIGH** | Notifikasi / Spam | **Spam notifikasi batch L2**: B2 mewajibkan "setiap approve L2 memicu notifikasi semua guru". Batch 50 siswa × 30 guru = 1.500 notifikasi sekali klik. | Notifikasi L2 di-aggregate: **satu notifikasi ringkasan per aksi** (individu maupun batch: "5 siswa disetujui di rombel 7A oleh Budi"), sementara `AuditLog` tetap per-baris (N6). Penerima = semua membership `ACTIVE` sekolah (bukan banned/pending membership). |
| **F5** | 🟠 **HIGH** | Konkurensi / Integritas State | **Race transisi status tanpa conditional update**: guru A approve siswa X bersamaan dengan batch guru B, atau daftar ulang REJECTED (F1) bersamaan dengan approve → double-write, duplikat AuditLog, atau P2002 mentah. | Semua transisi status wajib **conditional update** (`updateMany where { id, accountStatus: "PENDING" }`, cek `count === 1`) di dalam transaksi — optimistic concurrency tanpa bergantung pada unique constraint yang tidak ada. Baris yang kalah race = baris gagal terlaporkan (selaras OQ-2 opsi b). |
| **F6** | 🟠 **HIGH** | Skema / Plugin Admin | **Plugin admin Better Auth menuntut kolom baru di tabel `user`**: fitur ban (`banned`, `banReason`, `banExpires`, dsb.) tidak ada di `schema.prisma` saat ini. Tanpa migrasi, plugin gagal saat runtime. | Fase 1 wajib memuat sinkronisasi kolom plugin admin secara aditif (N1) + `npx @better-auth/cli generate` untuk verifikasi. Tambah guard: superadmin **dilarang mem-ban superadmin lain** (`platformRole === "ADMIN"` → tolak). |
| **F7** | 🟠 **HIGH** | Deaktivasi Sekolah / Fail-Closed | **Cakupan invalidasi tidak jelas & jalur siswa stateless**: token siswa terverifikasi tanpa DB hit — menonaktifkan sekolah tidak otomatis mematikan sesi siswa berjalan. B5 hanya menyebut guru & siswa; sesi **orang tua** (`/parent/*`) tidak disinggung padahal ikut ter-scope sekolah. | Nonaktif sekolah = (1) revoke sesi Better Auth semua user sekolah, (2) siswa: guard fail-closed di layer aksi — `verifyStudentSession`-consumer (portal actions) menolak bila sekolah nonaktif, plus guard di `loginStudent`/`registerStudent`/`lookupJoinCode`; (3) putuskan cakupan sesi parent (rekomendasi: ikut di-revoke — akses read-only tetap data sekolah nonaktif). Semua gerbang (login/register/lookup/portal/parent) wajib fail-closed, bukan hanya login. |
| **F8** | 🟡 **MEDIUM** | Reset PIN / Hygiene | **Reset PIN belum menyentuh hygiene akun**: draft belum menyebut reset `failedAttempts`/`lockedUntil` saat guru reset PIN — siswa yang terkunci lalu di-reset PIN tetap terkunci. Juga `pinUpdatedAt = now()` wajib agar sesi lama hangus (rotasi). | `resetStudentPinAction`: update `accessPinHash` + `pinUpdatedAt = now()` + reset `failedAttempts = 0`, `lockedUntil = null` dalam satu transaksi + `AuditLog`. |
| **F9** | 🟡 **MEDIUM** | Performa / Index | **Query panel pending tanpa index**: `Student` hanya punya `@@index([fullName])` dan unique `[schoolId, nis]`. Panel L2 (satu sekolah, filter `accountStatus = "PENDING"`, join `ClassStudent`) akan full scan seiring tumbuh data leger. | Migrasi aditif: `@@index([schoolId, accountStatus])` pada `Student`. Select projection minimal (reuse pola `SAFE_STUDENT_SELECT`). Eskalasi dihitung dari `accountRequestedAt` (F2) di sisi query, bukan stream JS. |
| **F10** | 🟡 **MEDIUM** | Audit / Anti-Enumerasi | **Percobaan akses `/admin/*` oleh guru biasa** (OQ-7): ditolak senyap = tanpa forensik; di-audit tanpa dedup = noise spam (refresh loop bisa menumpuk ribuan baris). | Rekomendasi: catat `AuditLog` (`action = "ADMIN_ACCESS_DENIED"`) **hanya bila ada sesi valid** (tidak audit bot anonim), dengan dedup sederhana (skip bila log identik actor+action dalam 60 detik terakhir). |
| **F11** | 🟡 **MEDIUM** | Verification Gap | **Tidak ada test yang membuktikan matinya jalur daftar ulang REJECTED (F1)** — test Story 3 justru mengunci perilaku salah itu. Tanpa test baru, regresi tak terdeteksi. | Suite Story 5 wajib: E2E `REJECTED → daftar ulang (row sama) → approve → login sukses`; test guard REJECTED-allowed vs PENDING/ACTIVE-ditolak; test deaktivasi sekolah terhadap **sesi existing** (bukan hanya login baru); test conditional-update race (F5). |
| **F12** | 🟢 **LOW** | Kuasa Pindah Rombel | **Siapa yang boleh memindah rombel belum dispesifikasi**: pengampu rombel sumber? tujuan? atau L2+? | Rekomendasi: pengampu rombel **sumber** ATAU **tujuan** (keduanya punya kepentingan sah), atau L2+. Finalisasi sebagai keputusan elicitation, ditulis tegas di blueprint. |

---

## 2. Keputusan Open Question yang Didorong oleh Elisitasi

| OQ | Rekomendasi Hasil Elisitasi | Alasan Singkat |
|---|---|---|
| **OQ-1** pengampu rombel | **Opsi (a)**: semua guru dengan `TeachingContext` aktif pada rombel tsb di periode aktif | Tanpa kolom/UI baru; Mode Santai memang tanpa konsep wali kelas; opsi (b) butuh fitur penetapan homeroom yang belum ada di produk. Konsekuensi diterima: beberapa guru = pengampu. |
| **OQ-2** semantik batch | **Opsi (b)**: transaksi tunggal, baris valid ter-approve, baris gagal di-skip + dilaporkan, AuditLog per-baris sukses | All-or-nothing murni menjatuhkan 39 siswa sah karena 1 race — buruk untuk UX guru dan tidak dibutuhkan integritasnya (masing-masing baris independen). Tetap atomic di level transaksi tunggal (F5). |
| **OQ-3** notifikasi | **Model `Notification` aditif minimal** (`userId`, `schoolId`, `type`, `payload Json`, `readAt`, `createdAt`) + badge/feed sederhana di header dashboard | Story 2 tidak membangun infrastruktur ini dan B2 memintanya; model kecil ini reusable untuk Gelombang 3 (koreksi tugas) & 4. Email tetap non-goal. Aggregate per aksi (F4). |
| **OQ-4** UX reset PIN | **Guru mengetik PIN baru 4-digit**, tampil sekali, wajib berbeda dari lama; hygiene F8 | Terpaling sederhana & tanpa jalur distribusi (SMTP non-goal). Siswa diberi tahu PIN secara lisan/offline oleh guru. |
| **OQ-5** FK formal | **Tambah relation aditif sekarang** (`approvedById` → `User`) | Data existing `null` semua (forensik: Story 3 tidak pernah mengisi) → FK aman tanpa backfill; tabel masih kecil; menutup komentar "FK formal di Story 3/5". |
| **OQ-6** blokir login guru sekolah nonaktif | **Better Auth `databaseHooks.session.create` (deny) di `src/lib/auth.ts`** + guard status sekolah pada server-side layout dashboard | Mencegah sesi BARU lahir; sesi lama sudah di-revoke saat deaktivasi (B5). Perubahan `auth.ts` ini adalah hook lifecycle, bukan modifikasi kontrak guard — sah dan diperlukan. Plugin admin dipasang di file yang sama (F6). |
| **OQ-7** audit percobaan akses | **Audit dengan dedup 60 detik**, hanya untuk sesi valid | Forensik tanpa noise (rincian F10). |
| **OQ-8** cakupan superadmin | **Dikonfirmasi lintas-sekolah penuh** tanpa membership; termasuk AuditLog semua sekolah (viewer berfilter) | Prinsip backstop platform-level CAP-7; area `/admin/*` terpisah dari konteks sekolah (F3). |

---

## 3. Bedah Metode Elisitasi (Sudut Pandang Terpilih)

### Kategori 1: Advanced Reasoning
- **1. Tree of Thoughts (jalur daftar ulang)**: Menguji 3 cabang penyelesaian REJECTED: (A) delete+create row baru — melanggar glosarium §9.2 & merusak FK leger; (B) jalur "unlock" guru sebelum daftar ulang — menambah aksi baru di luar scope CAP; (C) amankan guard `registerStudent` agar mengizinkan `REJECTED` dengan reuse row + reset hygiene. Cabang C terpilih — satu titik perubahan, mematuhi glosarium, dan menutup F1.
- **2. Graph of Thoughts (graf dependensi skema)**: Memetakan `accountStatus` ⇄ `accessPinHash` ⇄ guard F1 Story 3 ⇄ `AuditLog` ⇄ tangga L1–L3. Mengungkap bahwa fitur highlight (draft) menggantung tanpa node waktu (`accountRequestedAt`) — memunculkan F2.
- **5. Meta-Prompting (adversarial test)**: Test wajib mencakup jalur adversarial, bukan happy-path: approve konkuren, daftar ulang saat batch berjalan, ban saat guru sedang punya sesi aktif, deaktivasi sekolah saat siswa sedang mengerjakan kuis.
- **7. CoT Scaffolding (deaktivasi sekolah)**: Urutan wajib atomik-logis: (1) tandai sekolah nonaktif → (2) revoke sesi guru → (3) sesi siswa/parent fail-closed → (4) clear `npsn` → (5) `AuditLog`. Jika `npsn` di-clear duluan sebelum status tercatat, dedup sekolah bisa gagal saat re-aktivasi/re-registration NPSN sama.

### Kategori 2: Personas & Stakeholder
- **9. Stakeholder Round Table**: Guru pengampu: "saya tidak mau panel saya penuh siswa rombel lain"; guru L2: "saya bisa bantu approve kalau pengampunya cuti"; siswa REJECTED: "kode errornya harus jelas, bukan 'NIS/PIN salah'"; superadmin: "saya tidak akan daftar sekolah — jangan paksa saya onboarding" → lahir F3.
- **10. Expert Panel (DBA)**: FK baru di kolom nullable berisi `null` semua = aman tanpa backfill; index `[schoolId, accountStatus]` murah dan langsung terpakai panel; jangan index pada `accountRequestedAt` saja — filter utama selalu schoolId dulu (F9).
- **12. User Persona (Guru HP kecil)**: Panel persetujuan harus one-thumb: checklist batch + tombol sticky "Setujui (N)" — bukan approve satu-satu 40 kali. Batch (OQ-2 opsi b) adalah fitur, bukan kemewahan.
- **16. Good Cop Bad Cop**: Good Cop memuji conditional update; Bad Cop menemukan race daftar-ulang-vs-approve (F5) dan spam notifikasi (F4).
- **19. Six Thinking Hats — Topi Hitam**: "Apa yang terjadi jika guru reset PIN siswa yang sedang mengerjakan kuis?" → `pinUpdatedAt` berganti → sesi hangus di tengah ujian. Keputusan: **diterima sebagai perilaku benar** (keamanan > kelancaran ujian); siswa login ulang dengan PIN baru dari guru dan attempt kuisnya tetap ada (resume).

### Kategori 3: Adversarial
- **21. Red Team vs Blue Team**:
  - *Red Team*: "Saya guru biasa (Mode Santai, baru gabung 5 menit lalu) — saya reset PIN semua siswa sekolah ini lalu login atas nama mereka." → *Blue Team*: B2 membatasi reset PIN hanya pengampu rombel (OQ-1 opsi a) + `AuditLog` + notifikasi L2 menutup senyapnya.
  - *Red Team*: "Saya ban superadmin rival." → *Blue Team*: guard anti-ban-ADMIN (F6).
  - *Red Team*: "Saya spam `/admin/*` pakai bot untuk menumpuk AuditLog." → *Blue Team*: audit hanya untuk sesi valid + dedup 60 detik (F10).
- **23. Code Review Gauntlet**: Semua aksi admin wajib lewat satu gerbang `requireSuperAdmin()` — dilarang menyebar pengecekan `platformRole` manual di tiap handler (pola yang mengunduk lupa satu jalur).

### Kategori 4: Core Reasoning
- **24. First Principles**: Hakikat panel persetujuan adalah **kontrol keputusan manusia atas klaim identitas**. Timestamp yang dipertaruhkan adalah waktu klaim (`accountRequestedAt`), bukan waktu lahirnya baris data — F2 adalah koreksi ontologis, bukan kosmetik.
- **25. 5 Whys (mengapa REJECTED tidak bisa daftar ulang)**: Guard anti-takeover mengecek `accessPinHash` → REJECTED punya hash → guard menolak → siswa mati permanen → karena guard dirancang sebelum status REJECTED ada di alur daftar ulang. Akar: asumsi "punya hash = akun aktif/sudah dipakai" yang tidak lagi valid.
- **31. Inversion**: "Bagaimana seorang guru nakal merebut akun siswa tanpa terdeteksi?" → Reset PIN massal lintas rombel (dicegah B2 + OQ-1), approve diri sendiri (bukan jalur — guru bukan siswa), menonaktifkan sekolah (hanya superadmin). Celah tersisa: reset PIN oleh pengampu rombelnya sendiri — **diterima sebagai risiko residual** yang tepat karena justru pekerjaan sah pengampu, tapi selalu ter-audit (N4) — tak pernah senyap.
- **34. Steelmanning (all-or-nothing batch)**: Argumen terkuatnya = konsistensi mental guru ("kalau gagal, ya semua gagal, saya ulangi"). Dibantah: baris batch bersifat independen; race tunggal bukan sinyal kondisi rombel berubah; laporan baris gagal memberi konsistensi mental yang lebih baik daripada rollback misterius.

### Kategori 5: Skema & Failure Mode
- **Failure Mode & Effects (deaktivasi sekolah)**: Kegagalan enkripsi titik: (a) lupa clear npsn → NPSN terkunci permanen (sudah di Never); (b) lupa guard di `lookupJoinCode` → siswa baru tetap bisa mendaftar ke sekolah mati; (c) lupa parent → `/parent/*` membaca sekolah mati. Semua masuk F7.
- **Chaos Monkey (ditengah jalan)**: Deaktivasi sekolah dieksekusi saat siswa sedang submit kuis → submit ditolak fail-closed; attempt yang sudah SUBMITTED tidak rusak (read-only). Terdokumentasi sebagai perilaku benar.
- **Pre-Mortem**: "Story 5 rilis, dua minggu kemudian guru komplain: 'semua siswa saya tertanda merah eskalasi 2 tahun!'" → akar: F2 tidak dieksekusi. "Panel admin kosong padahal ada pending" → akar: F3 (superadmin ter-perangkap onboarding).

### Kategori 6: Verification Gap
- **VG-1**: Draft acceptance criteria belum menyentuh **sesi existing** saat deaktivasi (hanya login baru) → diperbaiki di AC-3.
- **VG-2**: Tidak ada test negative untuk plugin admin (ban ADMIN ditolak) → masuk fase 4.
- **VG-3**: Regresi `/parent/*` disebut generik, tapi deaktivasi sekolah adalah **perubahan perilaku parent** — test parent sekolah aktif tetap hijau + parent sekolah nonaktif fail-closed.

---

## 4. Dampak ke Blueprint (Menunggu Persetujuan Human)

Bila disetujui, perubahan berikut diaplikasikan ke `5-panel-persetujuan-guru-superadmin.md`:

1. **Fase 1** ditambah: kolom `Student.accountRequestedAt` (F2), index `[schoolId, accountStatus]` (F9), sinkronisasi kolom plugin admin (F6), guard anti-ban-ADMIN (F6).
2. **Fase 2** ditambah: amend guard `registerStudent` untuk REJECTED (F1), conditional update semua transisi (F5), hygiene reset PIN (F8), aggregate notifikasi batch (F4), spesifikasi kuasa pindah rombel (F12).
3. **Fase 3** ditambah: guard fail-closed lengkap (login/register/lookup/portal/parent) (F7), `/admin/*` top-level route group (F3), dedup audit percobaan akses (F10).
4. **Fase 4** ditambah: test E2E REJECTED→daftar ulang→approve→login (F11), test sesi existing pasca-deaktivasi, test race, test ban-ADMIN-ditolak, regresi parent dua arah (VG-3).
5. Seluruh rekomendasi OQ-1 s/d OQ-8 ditulis sebagai **keputusan terikat** di Boundaries & Implementation Notes.
6. `Spec Change Log` di blueprint diisi dengan temuan F1–F12 + rekomendasi OQ.

> **Status: HALT — menunggu keputusan human: Apply semua / Apply sebagian / Reject / arahan lain.**
