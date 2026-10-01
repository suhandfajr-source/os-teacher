# DEV STAGE 11 — Student Portal & Unified Auth (Guru ⇄ Siswa)

> **Dokumen:** Master Blueprint Terpadu — Register/Login + Modul Portal Siswa
> **Status:** APPROVED & FINAL — Siap Dieksekusi (Tahap 1 menunggu trigger)
> **Amendum A (19 Sep 2026):** Review lensa BMAD (adversarial + edge-case + structure) terhadap kode nyata — 5 temuan blocking (§10), glosarium kanonik (§9), penguatan non-blocking (§11). **Bila bertentangan dengan teks lama, amendum menang.**
> **Sumber:** Sesi diskusi BMAD Roundtable (Owner + Sally/John/Winston/Mary)
> **Tradisi:** Lanjutan DEV_STAGE_00–10

---

## 1. Latar & Tujuan

KLASSA berkembang dari ekosistem 2-arah (Guru → Orang Tua) menjadi **3-arah (Guru ⇄ Siswa ⇄ Orang Tua)** dengan prinsip:

> **"Activity Generates Data"** — Aktivitas belajar siswa otomatis mengisi administrasi guru (nilai, ketuntasan, presensi kuis), bukan sebaliknya.

Tujuan khusus:
1. Siswa punya pintu masuk mandiri (**tanpa email**, NIS + PIN) untuk belajar & mengerjakan.
2. Guru tidak lagi memasukkan nilai hasil kuis/ujian secara manual.
3. Sekolah tidak pernah terduplikasi di database (Single School Multi-Teacher Workspace).
4. Portal siswa matang bertahap: dari "portal hidup" harian → progres belajar → kolaborasi dua arah → AI tutor.

---

## 2. Keputusan Arsitektur Terkunci 🔒

### 2.1 Autentikasi & Identitas

| # | Keputusan |
| :--- | :--- |
| 1 | Role user: **Guru & Siswa** saja (+ **Superadmin** platform-level, non-registrable). Tanpa wali kelas / admin sekolah / kepsek di fase awal. |
| 2 | Identitas siswa: **NIS (lokal, unik per sekolah) + PIN 4-digit**. Tanpa email. NIS wajib untuk klaim akun; siswa tanpa NIS menunggu guru mengisi. |
| 3 | Siswa bergabung ke **ROMBEL** (bukan per mapel): 1x join → semua `TeachingContext` rombel muncul otomatis. |
| 4 | Guru gabung sekolah: **Mode Santai** — bebas via pencarian + transparansi (panel member, notifikasi, revoke antar-guru). OWNER = metadata teknis tanpa kewajiban operasional. |
| 5 | **NPSN = data publik**: kunci pencarian & dedup, BUKAN gerbang keamanan. Opsional diisi; jika diisi → dedup dipaksa. |
| 6 | **Tangga Persetujuan**: L0 Auto (klaim NIS+nama cocok) → L1 Pengampu Rombel → L2 Semua Guru Sekolah → L3 Superadmin. Batch approve tersedia. |
| 7 | Portal `/parent/*` dipertahankan paralel; sunset setelah Mode Keluarga di portal siswa stabil (Tahap 8+). |
| 8 | Sesi siswa = cookie terpisah `klassa_student_session` (httpOnly, signed, secret env `STUDENT_SESSION_SECRET`, 30 hari) — ko-eksis dengan sesi guru. |

### 2.2 Modul Portal Siswa (hasil pematanangan)

| # | Keputusan |
| :--- | :--- |
| 9 | **Pohon Ketuntasan TP tetap Gelombang 2** (Tahap 7) — nol skema baru, tapi jangan membebani Tahap 4. |
| 10 | **Tugas dua langkah**: read-only (Gelombang 2/Tahap 7) → submission penuh (Gelombang 3/Tahap 8). |
| 11 | **Gamifikasi mikro ditunda ke Gelombang 4** (Tahap 9, opsional) — validasi kegunaan dulu. |
| 12 | Modul Nilai hanya menampilkan **Nilai FINAL** (definisi kanonik §9.1 — tidak ada enum `FINAL` di schema) — nilai draft/PENDING tidak boleh bocor ke siswa. |
| 13 | `StudentMonitoringNote` (catatan internal guru) **tidak ditampilkan** mentah ke siswa; kanal ortu tetap terkurasi. |
| 14 | Perubahan identitas siswa (nama/NIS) hanya via guru — siswa tidak bisa sunting mandiri (integritas leger). |

---

## 3. Arsitektur Target — Register & Login

### 3.1 Alur Guru

```
Register (email+password) → Onboarding:
  [1] Cari Sekolah (nama/NPSN) → GABUNG (Mode Santai, langsung MEMBER aktif)
      ATAU buat baru → GERBANG DEDUP:
        a) NPSN sudah ada        → tolak create, tawarkan GABUNG
        b) normalizedName exact  → tolak create, tawarkan GABUNG
        c) kemiripan nama ≥85%   → konfirmasi "Maksud Anda?"
        d) lolos a–c             → create + OWNER (metadata)
  [2] Periode Akademik → [3] Mapel → [4] Rombel → TeachingContext
→ Dashboard guru: kode rombel, siswa pending, panel guru sekolah

Login harian: /login (email+password)
  • onboardingCompleted=false → resume /onboarding (sekolah tersimpan)
  • Lupa password → backstop reset oleh Superadmin (SMTP menyusul)
```

### 3.2 Alur Siswa

```
Kode Rombel dari guru → kartu konfirmasi konteks (sekolah/rombel/TA/guru pembagi)
→ Form kilat: Nama + NIS + PIN 4-digit (normalisasi NIS: trim/uppercase)
   (a) NIS ada & nama cocok   → ACTIVE  ⭐ L0 otomatis
   (b) NIS ada & nama beda    → PENDING L1 + catatan mismatch (guru memutuskan)
   (c) NIS baru               → PENDING L1 (approve pengampu rombel)
   (d) sudah di rombel lain periode aktif → TOLAK + pesan "minta guru pindahkan"

Login harian: /siswa → Sekolah (tersimpan) + NIS + PIN
  • Rate-limit (§10-B3, storage persisten): per-akun 5x salah → 15 mnt, eskalasi beruntun 15m→1j→24j; plus limiter per-IP+sekolah
  • Pesan error generik "NIS atau PIN salah" (anti-enumerasi, timing seragam)
  • Lupa PIN → reset HANYA oleh pengampu rombel aktif atau Superadmin (§10-B2)

State machine: (row tanpa PIN) ──klaim L0──► ACTIVE
               (daftar baru) ──► PENDING ──approve L1/L2/L3──► ACTIVE
                                    └──reject──► REJECTED (boleh coba kode baru)
Rollover TA: impor ulang roster → klaim ulang L0 ATAU kode rombel baru; NIS & PIN tetap.
```

### 3.3 Superadmin (`/admin/*`)

Platform-scope, **backstop bukan gerbang harian**, seeded via script internal dari env allowlist, semua aksi tercatat `AuditLog`. Kuasa eksklusif: force approve/reject siswa pending, ban akun guru, **reset password guru**, nonaktifkan sekolah.

---

## 4. Arsitektur Target — Portal Siswa (UI & Modul)

### 4.1 Dashboard Beranda (mobile-first, Bottom Nav 5 item)

```
┌─────────────────────────────────────┐
│  Hai, Ahmad! 👋           [🔔] [⋮]  │
│  Rombel 8-B • SMPN 1 Madani         │
├─────────────────────────────────────┤
│  ⚡ HARI INI — 3 PELAJARAN          │
│  │ 07.30 IPA — Lab Sains       ✅   │
│  │ 09.15 MTK — R.12          🔴 LIVE│
│  │ 11.00 B. Indonesia         ⏳    │
│                                     │
│  ⏰ PERLU DIPERHATIKAN              │
│  📝 Kuis IPA berakhir malam 21.00   │
│  📚 Tugas Aljabar: sisa 2 hari      │
│                                     │
│  🌱 KETUNTASAN: 12/18 TP ✅  (G2+)  │
├─────────────────────────────────────┤
│ [🏠][🎒 Kelas][📝 Tugas][📊 Nilai][👤]│
└─────────────────────────────────────┘
```

**Aturan informasi bertingkat:** *sekarang* (jam ini) → *mendesak* (deadline ≤3 hari) → *capaian* (ketuntasan). Kuis akses ≤2 ketukan dari beranda. Tombol Keluar menonjol (skenario komputer lab bersama).

### 4.2 Peta Modul 4 Gelombang

**GELOMBANG 1 — Portal Hidup** (melebur ke Tahap 4). *Siswa punya alasan buka aplikasi setiap hari.*

| # | Modul | Sifat | Fondasi Data | Skema Baru |
| :--- | :--- | :--- | :--- | :--- |
| 1.1 | Beranda "Hari Ini" (daily stream) | Pasif | `TeachingSchedule` + `Quiz.deadline` + `Assignment.dueDate` | ✗ |
| 1.2 | Pusat Kuis & Ujian (+ riwayat, pembahasan `explanation`, badge remedial) | AKTIF | `Quiz` + `QuizAttempt` | ✗ |
| 1.3 | Jadwal Mingguan rombel | Pasif | `TeachingSchedule` | ✗ |
| 1.4 | Profil & Ganti PIN | AKTIF | `Student` (Tahap 1) | ✗ |

**GELOMBANG 2 — Portal Matang** (Tahap 7). *Transparansi capaian belajar.*

| # | Modul | Sifat | Fondasi Data | Skema Baru |
| :--- | :--- | :--- | :--- | :--- |
| 2.1 | Nilai & **Pohon Ketuntasan TP** (per mapel; hanya FINAL) | Pasif | `LearningObjective` + `AssessmentLearningObjective` + `AssessmentResult` + `RemedialAttempt` | ✗ (agregasi) |
| 2.2 | Presensi Saya (rekap bulanan H/S/I/A) | Pasif | `AttendanceRecord` | ✗ |
| 2.3 | Daftar Tugas read-only (judul/deskripsi/deadline) | Pasif | `Assignment` | ✗ |
| 2.4 | Widget ketuntasan ringkas di beranda | Pasif | idem 2.1 | ✗ |

**GELOMBANG 3 — Kolaborasi Dua Arah** (Tahap 8).

| # | Modul | Sifat | Fondasi Data | Skema Baru |
| :--- | :--- | :--- | :--- | :--- |
| 3.1 | Pengumpulan Tugas (submission teks/tautan + antrean koreksi guru) | AKTIF | — | ✓ `AssignmentSubmission` |
| 3.2 | Materi Belajar (guru publish draf AI/ringkasan) | Pasif | `AiContentDraft` | ✓ flag publish |
| 3.3 | Mode Keluarga (tab pantauan ort. di portal siswa) | Pasif | reuse layanan baca parent | minor |

**GELOMBANG 4 — Cerdas** (Tahap 9).

| # | Modul | Catatan |
| :--- | :--- | :--- |
| 4.1 | AI Tutor (tanya-jawab terkurasi materi guru) | Grounding ketat; "AI membantu, guru menentukan"; rate-limit + log |
| 4.2 | Gamifikasi mikro (streak, badge ketuntasan) | Opsional — setelah pola pemakaian terlihat |

### 4.3 Pemetaan "Activity Generates Data"

| Aksi Siswa | Data Otomatis Mengalir ke Guru |
| :--- | :--- |
| Kerjakan kuis PG | Skor masuk `QuizAttempt` → leger (0 input manual) |
| Submit jawaban esai | Masuk antrean koreksi guru |
| Klaim akun via NIS | Roster terisi identitas login tanpa guru membuat akun |
| Pantau ketuntasan | Angka partisipasi kuis → sinyal kelas mana perlu perhatian |

### 4.4 Sengaja Dikecualikan dari Portal Siswa

| Item | Alasan |
| :--- | :--- |
| `StudentMonitoringNote` mentah | Catatan internal guru; risiko nada/motivasi |
| Prota/Prosem (`AcademicPlanItem`) | Perencanaan internal guru |
| Sunting identitas mandiri | Integritas leger — via guru |
| Pengumuman sekolah | Belum ada sumber resmi (tanpa role kepsek); kandidat: pengumuman per-mapel dari guru |

---

## 5. Temuan Review Kode (baseline 18 Sep 2026)

| # | Temuan | Status Rencana |
| :--- | :--- | :--- |
| G1 | `createSchool`/`submitOnboarding` tanpa cek duplikasi normalizedName | Ditutup Tahap 2 |
| G2 | `searchSchools` tak mendukung NPSN & konteks sekolah | Ditutup Tahap 2 |
| G3 | `joinSchool` tanpa transparansi/notifikasi/revoke | Ditutup Tahap 2 |
| G4 | Siswa belum punya jalur login (`Student` = data pasif) | Ditutup Tahap 3–4 |
| G5 | Struktur data mendukung join per-rombel | Dimanfaatkan desain |
| G6 | Lupa password guru belum ada (butuh SMTP) | Backstop superadmin Tahap 5 |
| G7 | Brute-force PIN & kode rombel belum dibatasi | Ditutup Tahap 3 |

Fondasi solid yang dipertahankan: Better Auth (guru), onboarding multi-langkah, `TeacherSchoolMembership` multi-sekolah, `@@unique([schoolId, nis])`, quiz engine lengkap, tautan TP↔penilaian.

---

## 6. Rencana Eksekusi 9 Tahap

> **Aturan main:** akhir setiap tahap wajib `tsc` bersih + seluruh test lama hijau + test baru tahap hijau.
> **Aturan amendum:** §9–§11 mengikat semua tahap; alur `/q/[token]` lama wajib tetap hijau (regresi nol pada jalur quiz existing).

### FASE A — FONDASI & AUTH (Tahap 1–6)

**TAHAP 1 — Fondasi Database & Primitif Keamanan** (0,5–1 hari; Winston)
- Migrasi `Student`: `accessPinHash`, `accountStatus`, `pinUpdatedAt`, `lastLoginAt`, `failedAttempts`, `lockedUntil`, `approvedById`, `approvedAt`
- Migrasi `Class`: `joinCode`, `joinCodeLocked`, `joinCodeUpdatedAt`; `User.platformRole`; model `AuditLog`
- Seeder superadmin (`scripts/seed-superadmin.ts`, env allowlist); `requireSuperAdmin()`; util PIN `scrypt`
- **DoD:** migrasi bersih; seeder jalan; unit test PIN; test hijau.

**TAHAP 2 — Gerbang Dedup Sekolah & Penguatan Alur Guru** (1–1,5 hari; John+Winston)
- `searchSchools` v2 (nama ATAU NPSN + jumlah guru/rombel); normalisasi v2 (+ alias smpn≡smp negeri)
- Gerbang dedup a–d di `createSchool` & `submitOnboarding`; UI "Maksud Anda?"
- Panel "Guru di Sekolah Kita" (+ revoke), saklar sekolah aktif, edit NIS siswa
- **DoD:** test 4 skenario dedup + revocasi; E2E onboarding hijau.

**TAHAP 3 — Mesin Autentikasi Siswa** (1–1,5 hari; Winston)
- `src/modules/student-auth`: hash/verify PIN, sesi terpisah, `verifyStudentSession()`
- Actions: `lookupJoinCode`, `registerStudent` (4 cabang), `loginStudent` (+lockout), `logoutStudent`
- Actions guru: generate/rotasi/lock kode rombel; rate-limit percobaan kode (10x/jam/IP)
- **DoD:** unit test 4 cabang; security test brute-force & isolasi sesi siswa↔guru.

**TAHAP 4 — Portal Siswa Gelombang 1: UI & Integrasi Quiz** (2–3 hari; Sally)
- `/siswa` (login + gabung), `/siswa/portal` (dashboard + bottom nav 5 item)
- Daily stream "Hari Ini"; Jadwal Mingguan; Profil & Ganti PIN; layar pending
- Integrasi quiz: identitas dari sesi siswa → `QuizAttempt` atas nama benar (+ riwayat & pembahasan)
- **DoD:** E2E: guru buat kode → siswa join → approve → login → kerjakan quiz → nilai muncul di dashboard guru.

**TAHAP 5 — Panel Persetujuan Guru & Superadmin** (1–2 hari; John)
- Panel siswa pending (L1 per-rombel + L2 sekolah-wide) + approve/reject + batch + jejak
- Highlight eskalasi (>48 jam pengampu; >7 hari semua guru); aksi pindah rombel
- `/admin/*`: force approve, ban guru, reset password guru, nonaktif sekolah, AuditLog UI
- **DoD:** test tangga L1–L3; superadmin tak bisa dibuat via register; audit terisi.

**TAHAP 6 — Pengerasan, Rollover TA & Dokumentasi** (0,5–1 hari; Mary+Winston)
- Playbook rollover TA; update `MASTER_CONTEXT.md`; smoke & review keamanan akhir
- **DoD:** playbook tertulis; review keamanan lolos.

### FASE B — PORTAL MATANG (Tahap 7)

**TAHAP 7 — Student Progress (Gelombang 2)** (2–3 hari; Sally+Winston)
- **Pohon Ketuntasan TP**: service agregasi `LearningObjective` ⇄ `AssessmentLearningObjective` ⇄ `AssessmentResult` (hanya FINAL; pertimbangkan `GradePolicy`/KKTP); visual progres per mapel + tren nilai + info remedial
- Presensi Saya (rekap bulanan H/S/I/A); Daftar Tugas read-only; widget ketuntasan di beranda
- **DoD:** unit test agregasi ketuntasan; nilai non-FINAL tidak bocor; E2E siswa melihat nilai setelah guru finalisasi.

### FASE C — KOLABORASI DUA ARAH (Tahap 8)

**TAHAP 8 — Submission, Materi & Mode Keluarga (Gelombang 3)** (3–4 hari; John+Sally)
- Model `AssignmentSubmission` (teks/tautan dulu; unggah berkas menyusul) + antrean koreksi guru + feedback/opsional skor
- Materi Belajar: flag publish pada `AiContentDraft` + tampilan baca siswa
- Mode Keluarga: tab pantauan ort. read-only di portal siswa (reuse layanan baca parent)
- **DoD:** E2E guru buat tugas → siswa submit → guru beri umpan balik; materi publish terlihat; Mode Keluarga read-only aman.

### FASE D — CERDAS (Tahap 9)

**TAHAP 9 — AI Tutor & Gamifikasi (Gelombang 4)** (2–3 hari; Winston+Mary)
- AI Tutor terkurasi materi publish + TP; guardrail "AI membantu, guru menentukan"; rate-limit & log
- Gamifikasi mikro (opsional, tergantung pola pemakaian): streak, badge ketuntasan
- **DoD:** AI tidak menjawab di luar konteks materi; audit log terisi; keputusan go/no-go gamifikasi berbasis data pemakaian.

---

## 7. Luar Lingkup (Disengaja)

| Item | Alasan |
| :--- | :--- |
| Perubahan `/parent/*` | Paralel sampai Mode Keluarga stabil (evaluasi pasca-Tahap 8) |
| Reset password via email | Butuh SMTP; backstop superadmin memadai v1 |
| Merge otomatis sekolah duplikat | Tahap 2 membuatnya nyaris mustahil; sementara: nonaktifkan via superadmin |
| Toggle "Rombel Terbuka" (auto-approve) | Tunda sampai pola pemakaian terlihat |
| Unggah berkas tugas (file upload) | Submission teks/tautan dulu di Tahap 8; berkas menyusul |
| Role wali kelas/admin sekolah/kepsek | Tidak ada di fase awal |

---

## 8. Definisi Selesai Keseluruhan

- [ ] Guru gabung sekolah existing tanpa bisa menciptakan duplikat (4 skenario dedup teruji)
- [ ] Siswa daftar via kode rombel → L0/L1 sesuai state machine → login NIS+PIN
- [ ] Quiz dikerjakan dari portal siswa atas nama sesi → nilai otomatis di dashboard guru
- [ ] Tangga persetujuan L0–L3 + batch approve berfungsi dengan jejak audit
- [ ] Superadmin: reset password guru, ban, force approve — semua ter-audit
- [ ] Rollover TA teruji (klaim ulang L0 memakai NIS & PIN lama)
- [ ] Pohon Ketuntasan TP tampil akurat & hanya nilai FINAL
- [ ] Submission tugas dua arah + Mode Keluarga read-only berjalan
- [ ] AI Tutor terkurasi (jika Tahap 9 dieksekusi)
- [ ] Amendum A dipatuhi & teruji: filter Nilai FINAL sesuai §9.1 (unit test), impersonasi quiz via param klien mustahil (security test), reset PIN terbatas pengampu, limiter persisten, sesi di-invalidate saat ban/reset password
- [ ] `tsc` bersih; seluruh test hijau; E2E golden journey lulus

**Estimasi total: ± 13–20 hari kerja fokus** (Fase A: 6–10 hari • Fase B: 2–3 • Fase C: 3–4 • Fase D: 2–3).

---

## 9. Glosarium & Definisi Kanonik (Amendum A)

> Sumber ketidaksepakatan lintas tahap harus diselesaikan di sini, bukan di kode.

### 9.1 "Nilai FINAL"

**Tidak ada status `FINAL` pada schema.** Enum nyata: `AssessmentResultStatus = PENDING | GRADED | ABSENT | EXCUSED` dan `AssessmentStatus = DRAFT | IN_PROGRESS | COMPLETED | ARCHIVED`. Definisi kanonik mengikat:

> **Nilai FINAL** = `AssessmentResult.status === 'GRADED'` **DAN** parent-nya `Assessment.status === 'COMPLETED'`.

Semua penyebutan "FINAL"/"hanya FINAL" di dokumen ini (§2.2 #12, §4.2 modul 2.1, Tahap 7, §8) mengacu definisi tersebut. Query wajib join `Assessment` dan memeriksa keduanya — memfilter `AssessmentResult` saja tidak cukup (nilai GRADED pada assessment yang masih IN_PROGRESS tetap tersembunyi).

### 9.2 Dua field status siswa — jangan dicampur

| Field | Rentang | Makna |
| :--- | :--- | :--- |
| `Student.status` (existing, `EntityStatus`) | ACTIVE / ARCHIVED | Keberadaan siswa di leger sekolah (data) |
| `Student.accountStatus` (baru, Tahap 1) | PENDING / ACTIVE / REJECTED | Hak login portal siswa (akun) |

Login & akses portal = `accountStatus === 'ACTIVE'` **dan** `status === 'ACTIVE'`. Riwayat eks-siswa (REJECTED/ARCHIVED) hanya terlihat via Mode Keluarga (Tahap 8), tidak via login siswa.

**Transisi REJECTED → daftar ulang:** reuse row `Student` yang sama (jangan buat baru) → set `accountStatus = PENDING`, reset `failedAttempts`/`lockedUntil`, catat attempt kedua di `AuditLog`.

### 9.3 NIS kanonik

Bentuk kanonik: `trim()` + `uppercase()` (tanpa transformasi lain). Lookup klaim/login selalu exact terhadap bentuk kanonik.

⚠️ **Prasyarat data:** `Student.nis` lama tersimpan raw (import mencocokkan case-insensitive tapi menyimpan apa adanya) dan `@@unique([schoolId, nis])` case-sensitive → tanpa backfill, "0123" dan " 0123 " menjadi dua baris siswa berbeda. Wajib: migrasi backfill normalisasi seluruh NIS existing + laporan duplikat (resolve manual oleh guru) **sebelum actions Tahap 3 aktif**.

### 9.4 "Periode aktif"

= `AcademicPeriod.status === 'ACTIVE'` pada sekolah tersebut. Schema (`status String`) TIDAK menjamin satu periode aktif per sekolah — service layer wajib memvalidasi maksimal satu, dan semua query portal siswa (daily stream, jadwal, tugas, deadline) wajib di-scope ke periode aktif agar data TA lama tidak tampil.

### 9.5 Kecocokan nama klaim L0

Exact match setelah normalisasi (trim, collapse whitespace, case-insensitive). **Bukan** fuzzy/similarity — ambang kemiripan ≥85% hanya berlaku untuk dedup nama sekolah (§3.1 gerbang c). Alasan: mencegah pihak yang mengetahui NIS+nama teman (daftar siswa sering terpampang) membajak akun.

## 10. Amendum Keamanan — 5 Temuan BLOCKING (wajib sebelum eksekusi)

### B1. Integrasi quiz: identitas dari SESI server, bukan parameter klien

`startQuizAttemptAction(token, studentId, pin?)` (quiz.actions.ts) menerima `studentId` dari klien — itu desain alur `/q/[token]` lama dan **signature-nya tidak boleh diubah**. Portal siswa wajib memakai variant baru (mis. `startQuizAttemptFromSessionAction(token)`):

- `studentId` di-derive dari `verifyStudentSession()`; parameter identitas dari klien **diabaikan sepenuhnya**;
- roster check tetap dijalankan;
- `accessMode = INDIVIDUAL_PIN` → otomatis terpenuhi oleh sesi terautentikasi (dokumentasikan di kode sebagai pengecualian yang disengaja);
- `accessMode = CLASSROOM_PIN` → portal men-skip PIN kelas; kendali akses tetap via `status PUBLISHED` + `validFrom` + `deadline` (keputusan eksplisit, dicatat di kode).

**Konsekuensi bila dilanggar:** siswa yang login dapat menuliskan nilai atas nama teman sekelas (cukup tahu PIN kelas) — manipulasi leger senyap.

### B2. Reset PIN & kuasa L2 dipersempit

- **Reset PIN siswa**: HANYA pengampu rombel siswa tersebut di periode aktif (atau Superadmin) — bukan "semua guru sekolah".
- **Approve L2** (eskalasi): tetap terbuka semua guru sekolah, namun setiap aksi L2 memicu notifikasi ke semua guru + `AuditLog`.

Alasan: Mode Santai memungkinkan akun guru mana pun bergabung bebas ke sekolah; reset PIN adalah kunci impersonasi siswa sehingga tidak boleh setara kuasa onboarding.

### B3. Rate-limit persisten + lockout berlapis

Semua limiter baru wajib disimpan di DB — **bukan** Map in-memory (mati di serverless multi-instance; preseden `checkPinRateLimit` di quiz.service.ts tidak boleh ditiru untuk fitur baru):

- **Per-akun** (`failedAttempts`/`lockedUntil` pada `Student`): 5x salah → kunci 15 menit; pelanggaran beruntun eskalasi 15m → 1j → 24j.
- **Per-IP+sekolah** (tabel limiter kecil): menahan spraying lintas banyak NIS dari satu sumber.
- **Kode rombel**: 10x/jam/IP pada storage yang sama.
- Pesan error seragam "NIS atau PIN salah" untuk NIS-tak-ditemukan maupun PIN-salah + dummy-verify agar timing tidak membocorkan keberadaan NIS.

### B4. Fail-fast `STUDENT_SESSION_SECRET` + atribut cookie

Mirror pola `getAuthSecret()` (src/lib/auth.ts): **throw di production** bila unset/empty — tanpa fallback secret apa pun (fallback diam-diam = cookie bisa dipalsukan). Cookie `klassa_student_session`: httpOnly, signed, `secure` di production, `sameSite=lax`, 30 hari absolute cap + idle 7 hari (sliding).

### B5. Siklus hidup sesi & aksi superadmin

- **Ganti PIN**: wajib verifikasi PIN lama (dengan lockout sama seperti login) + rotasi session id + tombol "Keluar semua perangkat".
- **Ban guru / reset password guru**: wajib revoke SEMUA sesi Better Auth aktif milik user (`revokeUserSessions`; perlu admin plugin di src/lib/auth.ts — belum terpasang).
- **Nonaktifkan sekolah**: semua login guru & siswa sekolah itu gagal + sesi existing di-invalidate; **clear `npsn`** saat deaktivasi — jika tidak, NPSN sah terkunci permanen oleh `School.npsn @unique` dan sekolah asli tak bisa didaftarkan (merge otomatis memang out-of-scope §7).

## 11. Amendum — Penguatan Non-Blocking (melekat ke tahap terkait)

| # | Penguatan | Melekat di |
| :--- | :--- | :--- |
| N1 | Semua kolom migrasi baru nullable/ber-default; `User.platformRole` default non-admin; nol drop/rename | Tahap 1 |
| N2 | Backfill recompute `School.normalizedName` dengan normalisasi v2 (+alias) untuk baris lama — tanpa ini gerbang dedup (c) membandingkan format baru vs lama | Tahap 2 |
| N3 | Backfill NIS kanonik + laporan duplikat (§9.3) — **gate**: selesai sebelum actions siswa Tahap 3 aktif | Tahap 1–3 |
| N4 | `AuditLog` minimal: `actorType, actorId, action, targetType, targetId, metadata(Json), ip, createdAt`; append-only (tanpa jalur update/delete); index `[actorId, createdAt]` & `[targetType, targetId]` | Tahap 1 |
| N5 | "Pindah rombel" = UPDATE `classId` pada row `ClassStudent` existing (bukan create baru) — menghormati `@@unique([studentId, academicPeriodId])` | Tahap 5 |
| N6 | Batch approve = `$transaction` atomic + laporan baris gagal; `AuditLog` per-baris tetap terisi agar jejak konsisten dengan state DB | Tahap 5 |
| N7 | Rantai E2E Tahap 4 memuat langkah "guru publish quiz" sebelum siswa mengerjakan (attempt butuh `status PUBLISHED`) | Tahap 4 |
| N8 | Playbook rollover TA menambah langkah: guru isi NIS siswa yang belum ber-NIS **sebelum** klaim ulang L0 (siswa tanpa NIS tidak punya jalur klaim) | Tahap 6 |
| N9 | Regresi nol: seluruh alur `/q/[token]` dan `/parent/*` tetap hijau di setiap tahap (door criteria, bukan sekadar harapan) | Semua |

> **Sisa temuan review** (enumerasi pesan, state machine lengkap, AuditLog retensi, dsb.) tercakup oleh B1–B5 + N1–N9 + §9. Temuan editorial struktur (pengulangan aturan FINAL 3×) diselesaikan oleh §9.1 sebagai satu sumber definisi.
