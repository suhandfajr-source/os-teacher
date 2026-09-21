---
title: 'Story 4 — Portal Siswa Gelombang 1 & Integrasi Quiz'
type: 'feature'
created: '2026-09-22'
status: 'done'
baseline_commit: '8e5e785691746916521de19276f4022ae1e87fb3'
route: 'full'
review_loop_iteration: 2
context:
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/execution-stages.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/architecture-diagrams.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/security-amendum.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/portal-modules.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/glossary.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/stories/4-portal-siswa-gelombang-1-integrasi-quiz.elicitation-report.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 
Hingga saat ini, siswa di KLASSA masih merupakan entitas data pasif tanpa antarmuka (*UI*) mandiri. Guru menjadi *bottleneck* input administrasi karena harus memasukkan nilai kuis dan presensi secara manual. Selain itu, pengerjaan kuis publik eksisting (`/q/[token]`) menerima `studentId` dari form browser yang rentan manipulasi/impersonasi siswa lain (Temuan B1 & F3). Di sisi perutean (*routing*), terdapat benturan URL kritis karena rute `/siswa` di codebase telah digunakan untuk Roster Siswa Guru (`(dashboard)/siswa`), dan `src/proxy.ts` saat ini salah me-redirect siswa unauthenticated ke rute guru tersebut (Temuan F2). Terakhir, akun siswa `PENDING` mengalami deadlock jika ditempatkan di dalam shell terproteksi (Temuan F1).

**Approach:**
1. Bangun antarmuka portal siswa *mobile-first* (Gelombang 1: CAP-5 & CAP-6) yang meliputi:
   - Pintu masuk siswa publik di `/portal-siswa` (Tab Login NIS+PIN ter-scope sekolah & Tab Gabung Rombel via kode 6-karakter).
   - Shell Portal Siswa di `/siswa/portal/*` dengan **Bottom Navigation 5 Item** (Beranda Hari Ini, Jadwal, Kuis, Tugas/Nilai placeholder, Profil) yang ergonomis pada layar 360px (D10) dan Header ringkas dilengkapi Tombol Keluar lab-ready (F9).
   - Daily Stream "Hari Ini" (pelajaran jam aktif, deadline $\le$ 3 hari, status rombel) dengan optimasi query paralel, composite index, normalisasi zona waktu Indonesia via `schedule-date-utils.ts` (D2), dan penanganan gracefully jika periode akademik belum aktif (D9).
   - Jadwal Mingguan rombel ter-scope periode akademik aktif.
   - Profil Siswa & Aksi Ganti PIN Aman (Amendum B5): verifikasi PIN lama via scrypt + DB lockout bertingkat, update `pinUpdatedAt = now()` di DB, serta **wajib re-issue cookie sesi lokal** agar pengguna tidak terkunci sendiri (Temuan F5).
   - Penanganan akun `PENDING` dan `REJECTED` secara elegan langsung pada gerbang `/portal-siswa` (menampilkan kartu status tunggu persetujuan guru dengan kontak guru tanpa menerbitkan sesi penuh) untuk menjaga integritas keamanan `/siswa/portal/*` 100% khusus siswa `ACTIVE` (Temuan F1).
2. Terapkan kuartet integrasi kuis berbasis sesi server (Amendum B1, Temuan F3, D1, D3, D4):
   - `startQuizAttemptFromSessionAction(quizToken)`: derivasi murni dari `verifyStudentSession()`, mengabaikan parameter `studentId` klien, dengan proteksi konkurensi *double-start* via `upsert` / penanganan P2002 (D1).
   - `saveQuizAnswerFromSessionAction(attemptId, questionId, selectedIndex, essayAnswer)`: autosave per butir soal terproteksi sesi server, menolak penulisan jika status sudah `SUBMITTED`.
   - `submitQuizAttemptFromSessionAction(attemptId, answers)`: submit kuis atomik dengan kalkulasi otomatis PG, server-authoritative timer (F7), dan penerimaan peta jawaban final lengkap untuk mencegah *lost answers* akibat *in-flight autosave* (D4).
   - `getQuizReviewFromSessionAction(quizToken)`: review lembar jawaban dan pembahasan hanya jika status attempt adalah `SUBMITTED` (F6).
   - Aliran nilai otomatis (*Activity Generates Data*): Skor kuis langsung tersimpan di `QuizAttempt.score` yang otomatis terbaca di dashboard & agregasi guru tanpa input manual. Jika kuis terhubung ke `Assessment`, lakukan sinkronisasi ke `AssessmentResult` (Temuan F4).
   - *Zero-regression*: Alur kuis publik `/q/[token]` dan signature `startQuizAttemptAction` lama tetap 100% utuh tanpa gangguan.
3. Selesaikan benturan perutean URL & isolasi keamanan (Temuan F2):
   - Roster siswa guru tetap berada di `/siswa` (`(dashboard)/siswa`).
   - Pintu masuk siswa berada di `/portal-siswa`.
   - Area terproteksi siswa berada di `/siswa/portal/*`.
   - Perbaiki `src/proxy.ts` dan `logoutStudent()` agar mengarahkan redirect unauthenticated ke `/portal-siswa`, bukan `/siswa`.

## Boundaries & Constraints

**Always:**
- **Derivasi Identitas Server-Side (Amendum B1 & Temuan F3)**: Seluruh mutasi dan query kuis portal siswa (`start`, `save`, `submit`, `review`) **WAJIB** mengekstrak identitas `studentId`, `schoolId`, dan `classId` langsung dari token sesi terverifikasi server `verifyStudentSession()`. Seluruh parameter identitas siswa dari form/request/URL klien wajib diabaikan secara mutlak.
- **Roster & Scope Check Dinamis (D7)**: Keanggotaan rombel siswa (`ClassStudent`) wajib divalidasi dinamis terhadap database pada `AcademicPeriod` yang sedang aktif (`isActive === true`), bukan hanya mengandalkan nilai statis yang tersemat pada token cookie.
- **Pencegahan Kebocoran Kunci Jawaban (Temuan F6)**: Payload kuis yang dikirim ke browser siswa hanya memuat `{ id, order, type, text, options, points }`. Kunci jawaban (`correctIndex`) dan pembahasan (`explanation`) **DILARANG** dikirim ke memori klien/RSC selama pengerjaan berlangsung. Pembahasan hanya boleh diakses via endpoint review setelah status attempt adalah `SUBMITTED`.
- **Server-Authoritative Timer & Batas Waktu (Temuan F7 & D3)**: Batas waktu kuis (`durationMinutes` dan `deadline`) ditegakkan di sisi server. Penghitungan sisa waktu di klien wajib berbasis waktu mutlak (*wall-clock time*) dengan listener `visibilitychange` (D3). Jika request submit atau autosave masuk setelah waktu habis (`isAttemptExpired`), server secara sepihak mengunci attempt menjadi `SUBMITTED` dan mengoreksi jawaban terakhir yang tersimpan.
- **Atomisitas Submit & Penyelamatan In-Flight Autosave (D4)**: `submitQuizAttemptFromSessionAction` wajib menerima peta seluruh jawaban terkini dari klien (`answers`) dan memproses pembaruan jawaban serta kalkulasi skor dalam satu transaksi atomik `prisma.$transaction`.
- **Ganti PIN Aman & Re-Issue Sesi Lokal (Amendum B5 & Temuan F5)**:
  - Form ganti PIN wajib meminta PIN Lama dan PIN Baru 4-digit angka.
  - Verifikasi PIN lama tunduk pada benteng anti brute-force dan lockout persisten DB yang sama dengan login ($5\times \rightarrow 15\text{m}$).
  - PIN baru dilarang sama persis dengan PIN lama.
  - Saat PIN baru disimpan, wajib memperbarui `Student.pinUpdatedAt = now()` di DB (membatalkan token sesi di perangkat lain).
  - Server action `changeStudentPinAction` **WAJIB** menerbitkan cookie sesi baru (`setStudentSessionCookie`) dengan `pinUpdatedAt` terkini untuk browser pemohon agar siswa tidak terkunci sendiri.
- **Isolasi Lockout Login vs Sesi Ujian Berjalan (D6)**: Lockout `Student.lockedUntil` hanya membatasi aksi login baru (`loginStudent`) dan penggantian kredensial (`changeStudentPinAction`). Sesi aktif yang sedang berjalan diizinkan menyelesaikan ujian yang sedang berlangsung guna mencegah serangan *Denial-of-Service* (DoS) antar-teman sekelas via *spraying* PIN di halaman login.
- **Lab-Ready Security & Inactivity Timeout (Temuan F9)**:
  - Tombol Keluar / Logout diletakkan secara permanen di kanan atas Header portal siswa.
  - Sediakan listener client-side `StudentInactivityGuard` (auto-logout setelah 15 menit tanpa aktivitas interaksi pada perangkat).
  - Tampilkan banner pengingat lab pada layar beresolusi desktop non-touch.
- **Normalisasi Tanggal & Zona Waktu Indonesia (D2)**: Seluruh penghitungan hari harian (`dayOfWeek`) wajib dinormalisasi menggunakan `getNormalizedDayOfWeek(new Date(), "Asia/Jakarta")` dari `src/lib/schedule-date-utils.ts` untuk mencegah *day-offset* akibat serverless cloud yang berjalan di UTC.
- **Integritas Format NIS (D8)**: NIS siswa di seluruh Zod schema dan Prisma query wajib bertipe `z.string().trim().toUpperCase()` guna mencegah hilangnya angka nol di depan (contoh: NIS `"01234"` tidak boleh terkonversi menjadi angka `1234`).
- **Isolasi Sesi Guru & Siswa (Amendum B4)**:
  - Cookie siswa `klassa_student_session` dan cookie Better Auth guru `better-auth.session_token` saling terisolasi. Logout salah satu pihak tidak boleh menghapus atau merusak sesi pihak lain.
- **Zero-Regression Alur Publik (`/q/[token]`) & Roster Guru (`/siswa`)**:
  - Alur kuis proyektor `/q/[token]` tetap berjalan normal.
  - Halaman roster guru di `(dashboard)/siswa` tidak boleh terganggu oleh perutean portal siswa.

**Never:**
- Mengizinkan klien mengirimkan `studentId` untuk memulai, menyimpan jawaban, mengumpulkan, atau mereview kuis di portal siswa.
- Mengirimkan `correctIndex` atau `explanation` kuis ke klien sebelum status attempt adalah `SUBMITTED`.
- Menulis entri `AssessmentResult` tanpa `assessmentId` yang valid (mencegah DB runtime crash).
- Menampilkan data rahasia guru ke siswa: catatan pembinaan mental (`StudentMonitoringNote`), perencanaan prota/prosem (`AcademicPlanItem`), atau draf kuis berstatus `DRAFT`.
- Mengizinkan pengerjaan kuis jika status belum `PUBLISHED`, atau waktu sekarang belum mencapai `validFrom`, atau sudah melewati `deadline`.
- Me-redirect request portal siswa yang tidak terautentikasi ke `/siswa` (wajib ke `/portal-siswa`).
- Memberikan izin akses rute `/siswa/portal/*` kepada siswa berstatus selain `ACTIVE`.
- Menghitung mundur timer kuis hanya mengandalkan interval detik `setSeconds(s => s - 1)` (rentan *throttle* saat tab tidur).
- Melakukan konversi tipe data NIS menjadi `number` / `parseInt` (merusak format *leading zeroes*).
- Menggunakan local storage browser sebagai penyimpan kredensial atau jawaban kuis rahasia.

## I/O & Edge-Case Matrix

| Skenario | Input / State | Perilaku yang Diharapkan | Penanganan Galat / Respon |
| :--- | :--- | :--- | :--- |
| **Akses Portal Tanpa Sesi** | GET `/siswa/portal/*` tanpa cookie `klassa_student_session` | Dicegat oleh `src/proxy.ts` | Redirect instan ke `/portal-siswa` |
| **Sesi Token Invalid / Kadaluarsa** | GET `/siswa/portal/*` dengan token rusak/expired | Dicegat oleh `src/proxy.ts` | Hapus cookie rusak, redirect instan ke `/portal-siswa` |
| **Akses Portal Akun PENDING** | Login NIS+PIN siswa dengan `accountStatus === "PENDING"` | Ditampilkan Kartu Menunggu Persetujuan di `/portal-siswa` | Menampilkan nama rombel, sekolah, kontak guru pengampu, dan tombol cek status ulang |
| **Akses Portal Akun REJECTED** | Login NIS+PIN siswa dengan `accountStatus === "REJECTED"` | Ditampilkan Kartu Ditolak di `/portal-siswa` | Menampilkan alasan penolakan dan form untuk memasukkan kode rombel baru |
| **Pelajaran Hari Ini Kosong** | Hari libur atau tidak ada jadwal `TeachingSchedule` hari ini | Stream Hari Ini menampilkan *empty state* informatif | "Tidak ada jadwal pelajaran hari ini. Selamat beristirahat atau cek tugas & kuis!" |
| **Pelajaran Hari Ini Ada** | Ada entri `TeachingSchedule` untuk rombel siswa hari ini | Ditampilkan kartu pelajaran terurut jam: nama mapel, jam mulai-selesai, ruang, nama guru | Badge indikator LIVE jika jam sekarang berada di rentang pelajaran aktif |
| **Periode Akademik Kosong / Void (D9)** | Sekolah belum mengaktifkan semester baru (`AcademicPeriod` aktif = 0) | Daily stream tidak crash 500 | Menampilkan pesan ramah: "Tahun ajaran baru belum diaktifkan oleh sekolah. Hubungi wali kelas." |
| **Deadline Kuis Mendekat** | Kuis rombel aktif dengan deadline $\le$ 3 hari | Ditampilkan di widget "Perlu Diperhatikan" | Badge waktu tersisa ("Sisa 2 jam", "Berakhir malam ini") |
| **Mulai Kuis dari Portal (B1)** | Klik "Kerjakan" pada kuis `PUBLISHED` | Panggil `startQuizAttemptFromSessionAction(quizToken)` | Identitas `studentId` diekstrak murni dari sesi; attempt dibuat/dilanjutkan; soal di-shuffle deterministik |
| **Double-Click Start Kuis (D1)** | Siswa klik "Kerjakan" 2x cepat atau 2 tab serentak | Operasi `upsert` / tangkap P2002 mengembalikan attempt yang sama | Kuis terbuka mulus di kedua tab tanpa melempar error crash P2002 |
| **Kuis dengan Classroom PIN** | Kuis diatur mode `CLASSROOM_PIN` oleh guru | Portal siswa otomatis men-skip input PIN kelas | Siswa langsung masuk ujian (akses terkendali aman via status PUBLISHED & deadline) |
| **Kuis Belum Terbit / Draf** | Siswa mencoba membuka kuis yang statusnya `DRAFT` | Akses ditolak | "Kuis belum dibuka oleh guru." |
| **Kuis Belum Mulai (`validFrom`)** | Siswa membuka kuis sebelum waktu `validFrom` | Tombol kerjakan nonaktif | "Ujian belum dimulai. Silakan tunggu jadwal mulai ujian pukul XX:XX." |
| **Kuis Lewat Batas Waktu** | Siswa membuka kuis setelah `deadline` | Tombol kerjakan nonaktif | "Batas waktu pengerjaan kuis telah berakhir." |
| **Autosave Jawaban Kuis** | Siswa memilih opsi jawaban saat ujian berlangsung | Panggil `saveQuizAnswerFromSessionAction(attemptId, ...)` | Jawaban disimpan ke DB; status sinkronisasi UI berubah "Tersimpan" |
| **Tab HP Tidur Saat Ujian (D3)** | Layar HP mati 10 menit saat kuis aktif | Saat layar menyala, timer otomatis sync dengan *wall-clock time* | Sisa waktu langsung terpotong 10 menit secara presisi tanpa ilusi waktu |
| **Submit saat Autosave Berjalan (D4)** | Klik kumpul kuis saat request autosave sedang *in-flight* | `submitQuizAttemptFromSessionAction` mengirim seluruh peta jawaban final | Seluruh jawaban (termasuk soal terakhir) tersimpan & terkoreksi atomik |
| **Late Submission Attack (F7)** | Siswa menahan submit hingga melewati durasi kuis | Server mendeteksi `isAttemptExpired === true` | Attempt otomatis ditutup menjadi `SUBMITTED`, dikoreksi, dan menolak jawaban baru |
| **Kuis Sudah Selesai** | Siswa membuka kuis yang sudah berstatus `SUBMITTED` | Ditampilkan ringkasan skor dan tombol "Lihat Pembahasan" | Masuk ke lembar jawaban dengan pembahasan jika diizinkan guru |
| **Ganti PIN Sukses (F5)** | PIN Lama cocok, PIN Baru 4-digit valid | `Student.accessPinHash` diperbarui via `scrypt`, `pinUpdatedAt = now()`, re-issue cookie lokal | Pesan sukses, sesi lokal tetap aktif, sesi perangkat lain otomatis invalid |
| **Ganti PIN Sama dengan Lama** | PIN Baru sama persis dengan PIN Lama | Validasi pra-hash menolak | "PIN baru tidak boleh sama dengan PIN lama." |
| **Ganti PIN Gagal (PIN Salah)** | PIN Lama salah | Tambah `failedAttempts`, jika $\ge 5$ picu lockout bertingkat | "PIN lama salah. Percobaan tersisa: X" |
| **Logout dari Portal (F2)** | Klik tombol "Keluar" | Panggil `logoutStudent()`, hapus cookie `klassa_student_session` | Redirect ke `/portal-siswa`; sesi Better Auth guru tetap utuh jika ada |
| **Inactivity 15 Menit di Lab (F9)** | Tidak ada interaksi mouse/keyboard/touch selama 15 menit | `StudentInactivityGuard` memicu peringatan 60 detik | Jika tidak ada respon, otomatis logout dan redirect ke `/portal-siswa` |

</frozen-after-approval>

## Code Map

### 1. Routing & Shell Antarmuka
- `src/app/(student)/portal-siswa/page.tsx`: Pintu masuk publik siswa (Tab Login NIS+PIN, Tab Gabung Kode Rombel, dan State Kartu Siswa PENDING/REJECTED).
- `src/app/siswa/portal/layout.tsx`: Layout shell siswa *mobile-first*, memvalidasi sesi via `verifyStudentSession()`, menyediakan navigasi bawah (**Bottom Nav 5 Item**), dan `StudentHeader.tsx` (dilengkapi `StudentInactivityGuard`).
- `src/app/siswa/portal/page.tsx`: Beranda "Hari Ini" (Daily Stream jadwal pelajaran, status kuis mendesak, kartu sambutan).
- `src/app/siswa/portal/jadwal/page.tsx`: Halaman jadwal mingguan (Senin–Sabtu) rombel siswa ter-scope periode aktif.
- `src/app/siswa/portal/quiz/page.tsx`: Pusat Kuis (daftar kuis tersedia, sedang dikerjakan, dan riwayat selesai).
- `src/app/siswa/portal/quiz/[shareToken]/page.tsx`: Antarmuka pengerjaan kuis siswa (bebas gangguan / no Bottom Nav, autosave debounced, server-authoritative timer).
- `src/app/siswa/portal/quiz/[shareToken]/review/page.tsx`: Lembar pembahasan hasil kuis pasca submit (hanya dapat diakses jika attempt `SUBMITTED`).
- `src/app/siswa/portal/profil/page.tsx`: Halaman profil siswa (data NIS, Nama, Rombel, Sekolah, Ganti PIN, Logout).

### 2. Modul Service & Server Actions
- `src/modules/student-portal/student-portal.actions.ts`:
  - `getStudentDashboardDataAction()`: Mengambil pelajaran hari ini (dengan normalisasi zona waktu `getNormalizedDayOfWeek`), kuis aktif, dan profil rombel via query paralel teroptimasi.
  - `getStudentWeeklyScheduleAction()`: Mengambil jadwal mingguan rombel aktif ter-scope periode aktif.
  - `changeStudentPinAction({ oldPin, newPin })`: Aksi ganti PIN aman dengan verifikasi PIN lama via scrypt, rotasi `pinUpdatedAt`, DB lockout persisten, dan re-issue cookie sesi lokal (F5).
- `src/modules/quiz/quiz.actions.ts`:
  - `startQuizAttemptFromSessionAction(quizToken)`: Server action kuis berbasis sesi server (Amendum B1) dengan proteksi `upsert` terhadap konstrain `P2002` (D1).
  - `saveQuizAnswerFromSessionAction(attemptId, questionId, selectedIndex, essayAnswer)`: Autosave jawaban kuis per butir soal terproteksi sesi siswa.
  - `submitQuizAttemptFromSessionAction(attemptId, answers)`: Submit kuis atomik dengan kalkulasi nilai PG otomatis, validasi durasi server-authoritative, dan penyimpanan skor ke `QuizAttempt.score`.
  - `getQuizReviewFromSessionAction(quizToken)`: Mengambil hasil pengerjaan dan pembahasan soal secara aman murni berdasarkan sesi siswa.
- `src/modules/student-auth/student-auth.actions.ts`:
  - Update `logoutStudent()`: Mengarahkan redirect ke `/portal-siswa`.
- `src/proxy.ts`:
  - Update `proxy()`: Mengarahkan redirect unauthenticated portal siswa ke `/portal-siswa`.

### 3. Komponen Pendukung
- `src/components/student/StudentBottomNav.tsx`: Navigasi bawah responsif khusus portal siswa (5 ikon: Beranda, Jadwal, Kuis, Tugas/Nilai placeholder, Profil). Dioptimasi untuk layar smartphone 360px (label `text-[10px]`, tap target 48px). Otomatis disembunyikan saat kuis aktif dikerjakan.
- `src/components/student/StudentHeader.tsx`: Header ringkas dengan identitas nama, rombel, sekolah, tombol Keluar 1-ketuk, dan banner edukasi lab komputer.
- `src/components/student/StudentInactivityGuard.tsx`: Komponen client-side pemantau inaktivitas pengguna (15 menit idle timeout untuk proteksi lab bersama).
- `src/components/student/ChangePinModal.tsx`: Modal interaktif ganti PIN 4-digit dengan proteksi UI, validasi perbedaan PIN, dan konfirmasi.
- `src/components/student/QuizRunnerClient.tsx`: Antarmuka pengerjaan kuis interaktif dengan timer countdown berbasis *wall-clock time* dan listener `visibilitychange`, optimasi autosave debounced, dan konfirmasi submit atomik.

---

## Tasks & Acceptance

### Execution Checklist

**Fase 1 — Resolusi Rute & Shell Portal Siswa:**
- [x] Perbaiki `src/proxy.ts`: ubah target redirect unauthenticated `/siswa/portal/*` ke `/portal-siswa` (bukan `/siswa`).
- [x] Perbaiki `logoutStudent()` di `src/modules/student-auth/student-auth.actions.ts`: ubah redirect ke `/portal-siswa`.
- [x] Buat rute pintu masuk publik siswa di `src/app/portal-siswa/page.tsx` dengan tab **Masuk dengan NIS & PIN**, tab **Gabung dengan Kode Rombel**, dan state kartu siswa `PENDING`/`REJECTED`.
- [x] Buat layout `/siswa/portal/layout.tsx` khusus siswa dengan verifikasi server-side `verifyStudentSession()`.
- [x] Buat komponen `StudentBottomNav.tsx` (5 item, optimasi lebar 360px) dan `StudentHeader.tsx` dengan tombol Keluar 1-ketuk.
- [x] Buat komponen `StudentInactivityGuard.tsx` (auto-logout 15 menit idle untuk lab sekolah).

**Fase 2 — Beranda "Hari Ini" & Jadwal Mingguan (CAP-5):**
- [x] Bangun query teroptimasi `getStudentDashboardDataAction()` di `src/modules/student-portal/student-portal.actions.ts`:
  - Ambil `ClassStudent` aktif pada `AcademicPeriod.status === "ACTIVE"`. Tangani kondisi null jika periode belum aktif.
  - Normalisasi tanggal hari ini menggunakan `getNormalizedDayOfWeek(new Date(), "Asia/Jakarta")` dari `src/lib/schedule-date-utils.ts`.
  - Tarik jadwal `TeachingSchedule` terurut jam, menggunakan composite index `[teachingContextId, dayOfWeek]`.
  - Tarik kuis `Quiz` berstatus `PUBLISHED` dengan batas waktu terdekat.
- [x] Implementasikan tampilan Beranda "Hari Ini" di `src/app/siswa/portal/page.tsx` dengan urutan linimasa: Jam Sekarang (Live Badge) $\rightarrow$ Mendesak ($\le$ 3 hari) $\rightarrow$ Jadwal Hari Ini.
- [x] Implementasikan halaman Jadwal Mingguan di `src/app/siswa/portal/jadwal/page.tsx` dengan tab hari Senin s/d Sabtu.

**Fase 3 — Integrasi Kuis Berbasis Sesi Server (CAP-6 & Amendum B1):**
- [x] Implementasikan kuartet Server Action kuis berbasis sesi di `src/modules/quiz/quiz.actions.ts`:
  - `startQuizAttemptFromSessionAction(quizToken)`: identitas diambil murni dari sesi; bypass `CLASSROOM_PIN`; kunci jawaban disanitasi; tangani konkurensi P2002 via upsert.
  - `saveQuizAnswerFromSessionAction(attemptId, questionId, selectedIndex, essayAnswer)`: memvalidasi `attempt.studentId === session.studentId` dan tolak jika `SUBMITTED`.
  - `submitQuizAttemptFromSessionAction(attemptId, answers)`: terima peta jawaban final lengkap; grading atomik ke `QuizAttempt.score`; validasi late-submission server-authoritative.
  - `getQuizReviewFromSessionAction(quizToken)`: hanya kirim pembahasan jika attempt berstatus `SUBMITTED`.
- [x] Bangun halaman daftar kuis di `src/app/siswa/portal/quiz/page.tsx` (Kuis Aktif, Sedang Dikerjakan, Riwayat Selesai).
- [x] Bangun komponen `QuizRunnerClient.tsx` dan halaman pengerjaan di `src/app/siswa/portal/quiz/[shareToken]/page.tsx`:
  - Shuffling soal deterministik per attempt.
  - Sembunyikan Bottom Nav saat kuis aktif berlangsung.
  - Debounced autosave jawaban ke server.
  - Timer berbasis *wall-clock time* dan listener `visibilitychange`.
- [x] Bangun halaman pembahasan di `src/app/siswa/portal/quiz/[shareToken]/review/page.tsx`.

**Fase 4 — Profil & Ganti PIN Aman (Amendum B5):**
- [x] Implementasikan `changeStudentPinAction({ oldPin, newPin })` di `src/modules/student-portal/student-portal.actions.ts`:
  - Verifikasi PIN lama via `verifyPin` (Story 1b) + DB lockout persisten (Amendum B3).
  - Validasi PIN baru: 4-digit angka dan dilarang sama dengan PIN lama.
  - Hash PIN baru via `hashPin`.
  - Update `Student.accessPinHash` dan `Student.pinUpdatedAt = new Date()`.
  - **Re-issue cookie sesi lokal** via `setStudentSessionCookie` dengan `pinUpdatedAt` baru (Temuan F5).
- [x] Bangun antarmuka Profil di `src/app/siswa/portal/profil/page.tsx` dengan `ChangePinModal.tsx` dan tombol Keluar lab-ready.

**Fase 5 — Verifikasi Pengujian & Keamanan:**
- [x] Buat security integration test untuk kuartet server action kuis (memastikan seluruh parameter klien diabaikan total dan upaya impersonasi gagal).
- [x] Buat test konkurensi double-start kuis (memastikan bebas error P2002).
- [x] Buat test ganti PIN: verifikasi lockout pada PIN lama yang salah, tolak PIN identik, dan pastikan sesi lokal tetap aktif sementara sesi perangkat lain hangus.
- [x] Buat test late submission cutoff (jawaban setelah deadline ditolak server).
- [x] Verifikasi regresi alur publik kuis `/q/[token]` dan roster guru `/siswa` tetap berjalan normal 100%.
- [x] Jalankan `npm run build` dan `npm test` untuk memastikan 100% hijau.

---

## Acceptance Criteria

1. **Akses & Keamanan Sesi Siswa (Temuan F1 & F2):**
   - *Given* pengunjung tanpa cookie `klassa_student_session`, *when* mencoba mengakses `/siswa/portal/*`, *then* dicegat oleh `src/proxy.ts` dan dialihkan ke `/portal-siswa` (bukan ke `/siswa`).
   - *Given* siswa dengan akun berstatus `PENDING` atau `REJECTED`, *when* login di `/portal-siswa`, *then* sistem menampilkan kartu status persetujuan guru secara ramah tanpa mengizinkan masuk ke area terproteksi `/siswa/portal/*`.
2. **Beranda & Jadwal (CAP-5, Temuan F8, D2, D9):**
   - *Given* siswa aktif membuka `/siswa/portal`, *then* sistem menampilkan jadwal pelajaran hari ini sesuai rombelnya dan daftar kuis/tugas mendesak ($\le$ 3 hari) pada periode aktif via query paralel teroptimasi.
   - *Given* jam serverless cloud berada di UTC dini hari sementara waktu lokal WIB sudah berganti hari, *then* normalisasi zona waktu menampilkan jadwal hari yang tepat sesuai kalender sekolah.
   - *Given* hari tanpa jadwal pelajaran atau sekolah belum mengaktifkan periode akademik baru, *then* sistem menampilkan *empty state* yang informatif tanpa error 500.
3. **Pengerjaan Kuis Berbasis Sesi (CAP-6, Amendum B1, Temuan F3, F6, F7, D1, D3, D4):**
   - *Given* siswa yang terotentikasi membuka kuis aktif rombelnya, *when* kuis dimulai, *then* kuis dibuat atas nama `studentId` dari sesi server tanpa siswa perlu menginput PIN kelas atau memilih nama.
   - *Given* siswa menekan tombol "Kerjakan" dua kali berturut-turut dengan cepat, *when* diproses server, *then* sistem mengembalikan attempt yang sama tanpa error duplikasi `P2002`.
   - *Given* siswa mencoba mengirimkan `studentId` palsu atau mengubah attempt kuis siswa lain, *when* diproses oleh server action, *then* sistem menolak aksi tersebut dengan pesan unauthorized.
   - *Given* siswa sedang mengerjakan kuis, *when* payload kuis diperiksa di DevTools/Network, *then* tidak ada informasi `correctIndex` maupun `explanation` pada state klien.
   - *Given* durasi atau batas waktu kuis habis, *when* siswa mencoba mengirimkan jawaban susulan, *then* server menolak jawaban tambahan dan otomatis mengunci status menjadi `SUBMITTED`.
   - *Given* kuis selesai disubmit bersamaan dengan autosave yang sedang berjalan, *when* grading diproses, *then* seluruh jawaban final tersimpan secara atomik dan skor PG langsung masuk ke `QuizAttempt.score`.
4. **Ganti PIN, Rotasi Sesi, & Isolasi Lab (Amendum B5, Temuan F5, F9, D6):**
   - *Given* siswa salah memasukkan PIN lama sebanyak 5 kali di modal ganti PIN, *when* mencoba ke-6 kali, *then* akun terkena lockout persisten 15 menit di level database.
   - *Given* siswa berhasil mengganti PIN, *when* melanjutkan navigasi di browser yang sama, *then* sesi tetap aktif tanpa ter-logout; namun request dari peramban lain dengan token lama langsung tertolak.
   - *Given* akun siswa terkunci akibat percobaan login gagal dari luar, *when* siswa yang sedang aktif ujian menyelesaikan pengerjaan, *then* sesi ujian yang sedang berjalan tidak terputus secara sepihak.
   - *Given* siswa menekan tombol "Keluar" atau inaktif selama 15 menit di komputer lab bersama, *when* sesi berakhir, *then* cookie sesi siswa dihapus seketika dan jika ada sesi guru di peramban yang sama, sesi guru tetap aman.
5. **Zero Regression:**
   - *Given* seluruh test suite kuis publik `/q/[token]` dan rute roster guru `/siswa`, *when* dijalankan bersamaan dengan test baru Story 4, *then* seluruh pengujian tetap lolos 100%.

---

## Implementation Notes

- **Double-Start Concurrency Handling**: Pada `startQuizAttemptFromSessionAction`, gunakan pola `upsert` atau `try-catch` spesifik Prisma error code `P2002` (Unique constraint failed on `[quizId, studentId]`). Jika terjadi race condition, tangkap error dan panggil `prisma.quizAttempt.findUnique` untuk mengembalikan attempt yang sudah tercipta.
- **Timezone Normalization**: Gunakan helper `getNormalizedDayOfWeek(new Date(), "Asia/Jakarta")` dari `src/lib/schedule-date-utils.ts` untuk memetakan hari 1–7 (Senin–Minggu) sesuai kalender lokal sekolah di Indonesia.
- **Wall-Clock Countdown Timer**: Komponen `QuizRunnerClient.tsx` menghitung sisa waktu pengerjaan kuis menggunakan formula:
  $$\text{sisaMs} = \max(0, \text{attempt.startedAt} + \text{durasiMs} - \text{Date.now()})$$
  Tambahkan listener event `visibilitychange` agar sinkronisasi waktu terjadi seketika saat siswa membuka kembali tab browser setelah layar ponsel sempat mati/terkunci.
- **Atomic Submit Transaction**: Aksi submit kuis menerima peta seluruh jawaban terkini dari klien (`answers`) dan memproses upsert jawaban serta kalkulasi skor PG dalam satu transaksi atomik `prisma.$transaction`. Ini menjamin jawaban soal terakhir tidak hilang akibat autosave yang masih *in-flight*.
- **Ergonomi Layar 360px**: Pada `StudentBottomNav.tsx`, atur ikon berukuran $20\times 20\text{px}$, label teks `text-[10px]` dengan properti `truncate`, dan area sentuh tombol memenuhi batas minimum WCAG $48\text{px}$.
- **Academic Period Void Fallback**: Pastikan seluruh query portal siswa yang mencari `AcademicPeriod` aktif memiliki pengecekan null yang aman untuk mencegah error 500 saat masa transisi libur sekolah.

---

## Spec Change Log

- 2026-09-22 — **Consolidated Elicitation Hardening (Full 71-Methods & Deep Latent Hazards Review)**:
  - **[F1 Critical]** Memindahkan penanganan akun `PENDING` dan `REJECTED` ke level form publik `/portal-siswa` untuk mencegah deadlock sesi di dalam shell `/siswa/portal/*`.
  - **[F2 Critical]** Memperbaiki target redirect unauthenticated pada `src/proxy.ts` dan `logoutStudent()` dari `/siswa` (roster guru) ke `/portal-siswa`.
  - **[F3 Critical]** Mewajibkan Kuartet Server Action Kuis berbasis sesi server (`start`, `save`, `submit`, `review`) dengan derivasi identitas mutlak dari sesi server (Amendum B1).
  - **[F4 Critical]** Mengamankan integrasi leger guru dengan memusatkan skor kuis Gelombang 1 pada `QuizAttempt.score` guna mencegah runtime crash database akibat kolom `assessmentId` yang mandatory pada model `AssessmentResult`.
  - **[F5 High]** Mewajibkan re-issue cookie sesi lokal saat ganti PIN berhasil pada `changeStudentPinAction` untuk mencegah pengguna ter-logout dari perangkatnya sendiri.
  - **[F6 High]** Memasang DTO sanitasi kunci jawaban dan pembahasan pada antarmuka pengerjaan kuis siswa (hanya dikirim via endpoint review pasca submit).
  - **[F7 High]** Menerapkan otoritas batas waktu server-authoritative (`isAttemptExpired`) pada mutasi kuis untuk mencegah manipulasi jam lokal dan *late submission*.
  - **[F8 Medium]** Mengoptimasi query Daily Stream via bundling paralel, composite index `[teachingContextId, dayOfWeek]`, dan caching jadwal rombel.
  - **[F9 Medium]** Menambahkan tombol Keluar 1-ketuk di Header, komponen client-side `StudentInactivityGuard` (timeout 15 menit), dan banner edukasi lab komputer.
  - **[F10 Medium]** Menegakkan benteng lockout persisten DB ($5\times \rightarrow 15\text{m}$) pada modal ganti PIN.
  - **[D1 Concurrency]** Menambahkan penanganan `P2002` via `upsert` pada inisialisasi attempt kuis untuk mencegah crash saat *double-click*.
  - **[D2 Timezone]** Mengintegrasikan `getNormalizedDayOfWeek` dari `schedule-date-utils.ts` untuk mencegah *off-by-one day bug* pada hosting serverless cloud UTC.
  - **[D3 Mobile UX]** Menerapkan penghitungan mundur kuis berbasis *wall-clock time* dan listener `visibilitychange` untuk mencegah timer terhenti saat layar ponsel mati.
  - **[D4 Data Integrity]** Menyelamatkan *in-flight autosave* via pengiriman peta jawaban final atomik saat submit kuis.
  - **[D6 DoS Defense]** Mengisolasi `lockedUntil` hanya untuk login baru dan ganti PIN, sehingga siswa yang sedang aktif ujian tidak terputus akibat *spraying* dari luar.
  - **[D8 Data Integrity]** Menjaga tipe data NIS sebagai string kanonik di seluruh pipeline untuk mencegah kerusakan angka nol di depan (*leading zeroes*).
  - **[D9 Edge State]** Menambahkan graceful fallback saat sekolah berada di masa transisi antar-semester (periode akademik aktif = 0).
  - **[D10 Accessibility]** Mengoptimasi Bottom Navigation 5-item untuk layar smartphone sempit beresolusi $360\text{px}$.
