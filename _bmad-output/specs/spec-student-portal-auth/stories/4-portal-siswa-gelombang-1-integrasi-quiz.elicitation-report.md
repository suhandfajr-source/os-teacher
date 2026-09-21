# Comprehensive BMad Elicitation Report — 71 Methods Deep Analysis
## Story 4: Portal Siswa Gelombang 1 & Integrasi Quiz (`spec-student-portal-auth`)

| Parameter | Keterangan |
|---|---|
| **Target Spesifikasi** | `_bmad-output/specs/spec-student-portal-auth/stories/4-portal-siswa-gelombang-1-integrasi-quiz.md` |
| **Tanggal Analisis** | 2026-09-22 |
| **Cakupan Elisitasi** | **Lengkap 71 Metode BMad (12 Kategori)** — Dari Advanced AI Reasoning, Security Audit Personas, Boundary Sweeps, hingga Cascading Failure & Chaos Monkey. |
| **Status Basis Data** | Prisma Client 7.9.1; Model `Student`, `ClassStudent`, `TeachingSchedule`, `Quiz`, `QuizQuestion`, `QuizAttempt`, `QuizAnswer`, `Assessment`, `AssessmentResult`. |
| **Verdict Ringkas** | **CRITICAL HARDENING REQUIRED** — Ditemukan 1 Deadlock Sesi Akun PENDING di `/siswa/portal/pending`, 1 Benturan URL & Redirect Salah Alamat di `proxy.ts`, 1 Celah Impersonasi pada Submit/Autosave/Review Kuis, 1 Ketidakcocokan Skema Hubungan `Quiz` ke `AssessmentResult`, dan 1 Bug Self-Lockout saat Ganti PIN. |

---

## 1. Ringkasan Eksekutif & Temuan Terkristalisasi (Triage Table)

| ID | Severity | Kategori | Temuan Inti | Rekomendasi Solusi Wajib |
|---|---|---|---|---|
| **F1** | 🔴 **CRITICAL** | Architecture / Session (1, 6, 60, 65) | **Deadlock Sesi Akun PENDING di `/siswa/portal/pending`**: `verifyStudentSession()` strictly mengembalikan `null` jika `accountStatus !== 'ACTIVE'`. Siswa `PENDING` tidak memegang cookie sesi dan dicegat oleh `src/proxy.ts`. Halaman `/siswa/portal/pending` menjadi *unreachable* / dead-code. | Pindahkan penanganan akun `PENDING` dan `REJECTED` ke level gerbang publik (`/portal-siswa`), atau render state info tunggu langsung dari hasil `loginStudent`/`registerStudent`. Jaga invariant bahwa seluruh rute `/siswa/portal/*` 100% hanya untuk siswa `ACTIVE`. |
| **F2** | 🔴 **CRITICAL** | Routing / Access Control (2, 47, 66) | **Benturan Rute Guru vs Siswa & Redirect Salah Alamat**: `src/proxy.ts` me-redirect request unauthenticated ke `/siswa`. Di codebase eksisting, `/siswa` adalah Roster Guru (`(dashboard)/siswa`). Siswa terlempar ke antarmuka guru atau memicu error Better Auth. | Tetapkan pintu masuk publik siswa di `/portal-siswa`. Perbaiki `src/proxy.ts` dan `logoutStudent()` agar mengarahkan redirect ke `/portal-siswa`, bukan `/siswa`. Pertahankan roster guru di `(dashboard)/siswa` tanpa benturan. |
| **F3** | 🔴 **CRITICAL** | Security / Impersonation (21, 69, 31) | **Celah Identitas pada Submit, Autosave & Review Kuis (B1 Extension)**: Story 4 hanya membatasi `startQuizAttemptFromSessionAction`. Aksi `submitQuizAttemptAction` eksisting masih menerima `studentId` dari klien, belum ada autosave terikat sesi, dan `getAttemptResultAction` menerima `studentId` dari URL. | Wajibkan kuartet Server Action berbasis sesi server: (1) `startQuizAttemptFromSessionAction(token)`, (2) `saveQuizAnswerFromSessionAction(attemptId, ...)`, (3) `submitQuizAttemptFromSessionAction(attemptId, answers)`, dan (4) `getQuizReviewFromSessionAction(token)`. Semua mutlak memvalidasi `attempt.studentId === session.studentId`. |
| **F4** | 🔴 **CRITICAL** | Data Model / Runtime Crash (30, 47, 60) | **Crash Integritas `AssessmentResult` Tanpa `assessmentId`**: Task 3 mewajibkan pembuatan entri `AssessmentResult` otomatis pasca kuis disubmit. Namun pada skema DB, `Quiz` tidak memiliki relasi `assessmentId`, dan `AssessmentResult.assessmentId` berstatus `NOT NULL`. Memaksa create akan memicu DB runtime crash. | Batasi *source of truth* nilai kuis di Gelombang 1 pada `QuizAttempt.score`. Dashboard guru membaca nilai langsung dari `QuizAttempt`. Pembuatan `AssessmentResult` hanya dipicu jika ada relasi/pemetaan kuis ke assessment yang valid, atau via `publishQuizScoresToAssessmentAction`. |
| **F5** | 🟠 **HIGH** | Session Security / UX Bug (3, 65, 71) | **Self-Session Invalidation Pasca Ganti PIN**: Amendum B5 mengupdate `Student.pinUpdatedAt = now()` di DB untuk mendepak sesi perangkat lain. Namun cookie sesi di browser saat ini masih menyimpan `payload.pinUpdatedAt` lama, sehingga pada request berikutnya siswa ter-logout sendiri. | `changeStudentPinAction` **WAJIB** menerbitkan cookie sesi baru (`setStudentSessionCookie`) dengan `pinUpdatedAt` terkini untuk browser pemohon, sementara token sesi di perangkat lain otomatis kadaluarsa saat diverifikasi. |
| **F6** | 🟠 **HIGH** | Data Leakage / Anti-Cheat (21, 25, 69) | **Kebocoran Kunci Jawaban di DevTools / Network**: Pengiriman payload kuis ke klien berisiko membocorkan `correctIndex` dan `explanation` jika menggunakan model data raw `QuizQuestion`. | Sanitasi mutlak di server layer: `StudentQuizQuestionView` hanya memuat `{ id, order, type, text, options, points }`. Kunci jawaban dan pembahasan dibuang dari memori server sebelum dikirim ke RSC/klien. Pembahasan hanya dikirim via endpoint review setelah `SUBMITTED`. |
| **F7** | 🟠 **HIGH** | Cheating / Time Manipulation (59, 63, 71) | **Manipulasi Timer Klien & Late Submission Attack**: Siswa memanipulasi jam lokal atau menahan request submit melewati batas waktu kuis (`durationMinutes` atau `deadline`). | Otoritas waktu server-authoritative: Server action kuis mengecek `isAttemptExpired(startedAt, duration, deadline)`. Jika waktu terlewati, server otomatis menolak input baru, mengunci attempt menjadi `SUBMITTED`, dan mengoreksi jawaban terakhir yang tercatat. |
| **F8** | 🟡 **MEDIUM** | Performance / DB Scaling (59, 65, 70) | **Connection Exhaustion saat Jam Masuk Sekolah (07:00 Pagi)**: Ratusan siswa serentak membuka Daily Stream. Query unoptimized berisiko menghabiskan connection pool Neon PostgreSQL. | Optimasi query `getStudentDashboardDataAction`: Gunakan `Promise.all` tunggal, select kolom seminimal mungkin, manfaatkan composite index `[teachingContextId, dayOfWeek]`, dan cache data statis rombel. |
| **F9** | 🟡 **MEDIUM** | Shared Lab Security (12, 18, 63) | **Risiko Akun Tertinggal di Komputer Laboratorium Sekolah**: Komputer lab dipakai bergantian antar jam pelajaran; siswa sering lupa logout. | Sediakan Tombol Keluar 1-ketuk yang mencolok di Header, pasang listener client-side `useIdleTimer` (auto-logout setelah 15 menit inaktif), dan tampilkan banner edukasi lab pada layar desktop. |
| **F10** | 🟡 **MEDIUM** | Security / Brute Force (7, 50, 64) | **Proteksi Brute-Force pada Modal Ganti PIN**: Menebak PIN lama tanpa pembatasan membuka celah bypass jika perangkat fisik ditinggal terbuka. | Verifikasi PIN lama pada `changeStudentPinAction` tunduk pada benteng DB lockout yang sama dengan login ($5\times \rightarrow 15\text{m}$). Tolak jika PIN baru sama dengan PIN lama. |

---

## 2. Bedah Lengkap 71 Sudut Pandang Metode BMad

### Kategori 1: Advanced AI Reasoning (Metode 1 – 8)
- **1. Tree of Thoughts (ToT)**: Mengeksplorasi 3 cabang penanganan akun `PENDING`: (A) Memberi cookie terbatas, (B) Membiarkan masuk shell dengan middleware guard, (C) Menahan akun di halaman publik `/portal-siswa`. Cabang C terpilih karena menjaga `verifyStudentSession` tetap murni tanpa kompromi status keamanan.
- **2. Graph of Thoughts (GoT)**: Memetakan relasi dependensi: URL `/siswa` $\leftrightarrow$ Roster Guru $\leftrightarrow$ Proxy Middleware $\leftrightarrow$ Portal Siswa $\leftrightarrow$ Bottom Nav. Mengungkap bahwa mengubah target redirect proxy ke `/portal-siswa` menyelesaikan benturan tanpa merusak rute guru.
- **3. Thread of Thought**: Menjaga benang merah siklus hidup sesi: Login $\rightarrow$ `setStudentSessionCookie` $\rightarrow$ Ganti PIN $\rightarrow$ update `pinUpdatedAt` di DB $\rightarrow$ re-issue cookie lokal $\rightarrow$ invalidasi remote sessions. Menemukan celah F5 jika re-issue lokal terlewat.
- **4. Self-Consistency Validation**: Memvalidasi independensi perhitungan skor kuis PG: Server-side autograding menghasilkan nilai yang sama persis baik dieksekusi real-time saat submit maupun via worker batch.
- **5. Meta-Prompting Analysis**: Mengevaluasi bahwa pengujian kuis tidak boleh hanya menguji *happy-path scoring*, melainkan wajib menguji skenario adversarial: submit token orang lain, submit opsi di luar range, dan submit setelah deadline.
- **6. Reasoning via Planning**: Merancang tahapan render Daily Stream: (1) Validasi sesi aktif $\rightarrow$ (2) Resolusi tanggal & hari $\rightarrow$ (3) Ambil jadwal rombel $\rightarrow$ (4) Ambil kuis aktif $\rightarrow$ (5) Urutkan secara kronologis (Jam Ini $\rightarrow$ Mendesak $\rightarrow$ Nanti).
- **7. Chain-of-Thought Scaffolding**: Merinci alur verifikasi ganti PIN: Input PIN Lama & Baru $\rightarrow$ Validasi format 4 digit $\rightarrow$ Cek lockout DB $\rightarrow$ Verify PIN lama via scrypt $\rightarrow$ Cek kesamaan PIN lama & baru $\rightarrow$ Hash PIN baru $\rightarrow$ Update DB & re-issue cookie $\rightarrow$ Sukses.
- **8. Few-Shot Exemplar Priming**: Menyediakan pola respon konsisten untuk server action kuis: `{ success: true, data: { ... } }` dan `{ success: false, error: string }`.

### Kategori 2: Collaboration & Stakeholder Personas (Metode 9 – 20)
- **9. Stakeholder Round Table**: Guru ingin nilai kuis otomatis masuk tanpa input manual; Siswa ingin tahu skor langsung setelah submit; Orang tua ingin melihat transparansi jadwal anak.
- **10. Expert Panel Review**: Arsitek DB menegaskan jangan melakukan operasi `prisma.assessmentResult.create` jika `assessmentId` belum terdefinisi di skema. Kuis harus berdiri mandiri di `QuizAttempt` pada Gelombang 1.
- **11. Debate Club Showdown**: "Bypass PIN Kelas vs Tetap Minta PIN": Siswa portal sudah terverifikasi rosternya; meminta PIN kelas di portal hanya menambah friksi dan kegagalan input di smartphone. Sinkronisasi ujian cukup via `validFrom`.
- **12. User Persona Focus Group (Siswa Smartphone Entry-Level)**: Siswa menggunakan HP Android RAM 2GB dengan koneksi 3G/4G lelet. Antarmuka portal wajib *mobile-first*, ukuran aset minimal, dan Bottom Nav mudah dijangkau satu jempol.
- **13. Time Traveler Council**: Melihat ke depan saat Gelombang 2 (Nilai TP) dan Gelombang 3 (Tugas) hadir: Bottom Nav 5 item (Beranda, Jadwal, Kuis, Tugas, Profil) sudah mengalokasikan placeholder "Tugas" agar navigasi tidak berubah layout di masa depan.
- **14. Cross-Functional War Room**: Frontend Dev & UI Designer menyepakati layout kuis bebas gangguan (*distraction-free mode*): saat pengerjaan kuis aktif, Bottom Nav disembunyikan agar siswa fokus penuh pada soal.
- **15. Mentor and Apprentice**: Senior dev mengingatkan junior dev agar tidak menyimpan `correctIndex` di hidden input atau attribute data HTML komponen React.
- **16. Good Cop Bad Cop**: Good Cop memuji kenyamanan autosave berkala; Bad Cop menemukan risiko race-condition jika tombol submit ditekan bersamaan dengan request autosave yang sedang *in-flight*.
- **17. Improv Yes-And**: "Siswa selesai submit kuis... dan langsung melihat halaman skor ringkas... dan bisa klik 'Lihat Pembahasan' untuk mempelajari kesalahannya jika guru mengizinkan!"
- **18. Customer Support Theater**: Mengantisipasi komplain guru: "Nilai siswa tertukar!". Investigasi membuktikan identitas yang diambil dari sesi server (B1) 100% memusnahkan risiko salah input ID siswa.
- **19. Six Thinking Hats**: Topi Hitam (Risiko) menyoroti celah siswa mengerjakan kuis bersamaan di 2 tab browser; Topi Putih (Data) memastikan 1 attempt ID unik per `[quizId, studentId]`.
- **20. Delphi Method**: Mencapai konsensus batas waktu idle session di lab bersama: 15 menit tanpa interaksi mouse/touch memicu peringatan auto-logout.

### Kategori 3: Competitive & Adversarial (Metode 21 – 23)
- **21. Red Team vs Blue Team**:
  - *Red Team Attack*: Mengubah payload fetch submit kuis dengan menyuntikkan `studentId: "id-siswa-bintang-kelas"`.
  - *Blue Team Defense*: Server Action mengabaikan total seluruh parameter klien dan hanya membaca `session.studentId`. Serangan gagal total (F3).
- **22. Shark Tank Pitch**: Mempresentasikan efisiensi "Activity Generates Data": Menghemat 15 jam kerja guru per bulan dalam rekap nilai kuis kertas ke aplikasi spreadsheet.
- **23. Code Review Gauntlet**: Mengharuskan penghapusan field `explanation` dan `correctIndex` dari query Prisma kuis menggunakan DTO / projection selektif sebelum dikirim ke client component.

### Kategori 4: Core Reasoning (Metode 24 – 34)
- **24. First Principles Analysis**: Hakikat dari kuis online adalah mengukur pemahaman siswa. Jika kunci jawaban berada di memori browser, pengujian kehilangan validitasnya. Kunci jawaban wajib berstatus *server-secret* hingga status attempt `SUBMITTED`.
- **25. 5 Whys Deep Dive**: Mengapa tidak boleh redirect ke `/siswa` saat sesi kosong? $\rightarrow$ Karena `/siswa` adalah rute roster guru $\rightarrow$ Siswa melihat antarmuka guru $\rightarrow$ Guru bingung mengapa ada siswa di URL guru $\rightarrow$ Mengancam privasi data sekolah.
- **26. Socratic Questioning**: "Kapan pembahasan kuis boleh dibuka?" $\rightarrow$ Hanya saat attempt siswa sudah `SUBMITTED` DAN guru tidak mengunci pembahasan kuis (misal kuis bertahap).
- **27. Critique and Refine**: Menolak ide menyimpan jawaban kuis sementara di `localStorage` peramban lab, karena berisiko dibaca oleh siswa pengguna komputer berikutnya. Autosave wajib langsung ke server (`QuizAnswer`).
- **28. Explain Reasoning**: Menjelaskan mengapa Bottom Nav disembunyikan saat pengerjaan kuis: mencegah navigasi tidak sengaja (*accidental navigation*) yang dapat membingungkan siswa atau membatalkan sesi ujian.
- **29. Expand or Contract for Audience**: Di beranda siswa, jadwal pelajaran ditampilkan sederhana: "Matematika — 07.30 - 09.00 — R. 7A — Bpk. Budi", tanpa detail kurikulum teknis yang tidak relevan bagi siswa.
- **30. Second-Order Thinking**: Efek samping jika kuis otomatis mengalir ke `AssessmentResult`: jika guru belum menyiapkan kategori asesmen resmi, leger rapor bisa terisi nilai kuis santai yang seharusnya tidak masuk rapor.
- **31. Inversion Analysis**: "Bagaimana seorang siswa bisa mendapatkan nilai 100 tanpa belajar?" $\rightarrow$ Membuka DevTools Network inspect soal $\rightarrow$ Dicegah dengan sanitasi kunci jawaban; Mengerjakan bersamaan dari akun teman $\rightarrow$ Dicegah dengan sesi tunggal dan validasi roster.
- **32. Problem Decomposition**: Memecah pengerjaan kuis portal menjadi 4 fase terisolasi: (1) Pra-Ujian (Info durasi & aturan), (2) Ujian Aktif (Timer, Soal, Autosave), (3) Submit (Validasi & Grading), (4) Pasca-Ujian (Skor & Review Pembahasan).
- **33. Analogy Mapping**: Menganalogikan pengerjaan kuis seperti ujian berbasis kertas di ruang kelas: pengawas membagikan lembar soal tanpa kunci, mengumpulkan lembar jawaban saat bel berbunyi, dan baru membagikan lembar pembahasan di pertemuan berikutnya.
- **34. Steelmanning**: Memperkuat argumen "Tetap minta PIN kelas di portal siswa agar serentak", lalu membuktikan bahwa kontrol serentak via `validFrom` di server jauh lebih akurat dan bebas kecurangan daripada membagikan PIN di papan tulis yang bisa difoto dan dikirim ke siswa di luar kelas.

### Kategori 5: Creative & Innovation (Metode 35 – 43)
- **35. SCAMPER (Adapt)**: Mengadaptasi pola kartu linimasa (timeline stream) pada media sosial untuk menampilkan jadwal harian dan deadline tugas siswa secara vertikal dan interaktif.
- **36. Reverse Engineering**: Merancang arsitektur mulai dari tampilan lembar review pembahasan siswa, mundur ke skema jawaban `QuizAnswer`, mundur ke kalkulasi `gradeAttempt`, mundur ke penyerahan lembar kuis.
- **37. What If Scenarios**: "Bagaimana jika koneksi internet siswa terputus di soal nomor 9 dari 10 soal?" $\rightarrow$ 9 jawaban sebelumnya sudah aman tersimpan via autosave; siswa cukup reconnect dan melanjutkan tanpa mengulang dari soal 1.
- **38. Random Input Stimulus (Konsep: Speedometer)**: Menampilkan countdown timer kuis dengan perubahan warna: Hijau (>50% waktu), Kuning (10–50%), Merah Berkedip (<10% waktu) untuk kesadaran waktu visual.
- **39. Exquisite Corpse Brainstorm**: Kolaborasi alur ganti PIN: Form sederhana $\rightarrow$ Validasi instan di klien $\rightarrow$ Verifikasi aman di server $\rightarrow$ Notifikasi toast sukses $\rightarrow$ Modal tertutup rapi.
- **40. Genre Mashup (Duolingo Micro-Interactions)**: Memberikan feedback visual yang menyenangkan (konfeti ringan atau kartu skor apresiatif) saat siswa berhasil menyelesaikan kuis.
- **41. Constraint Injection**: "Bagaimana jika kuis tidak memiliki batas waktu (`durationMinutes: null`)?" $\rightarrow$ Timer tidak ditampilkan, batas akhir murni mengikuti tanggal `deadline`.
- **42. Morphological Analysis**: Matriks status kuis vs status attempt: [DRAFT / PUBLISHED / CLOSED] $\times$ [BELUM IKUT / SEDANG / SUBMITTED]. Menjamin hanya kombinasi [PUBLISHED] $\times$ [BELUM IKUT / SEDANG] yang dapat mengakses lembar pengerjaan.
- **43. Subtraction**: Menghapus tombol "Batal Ujian" saat kuis sudah dimulai; sekali kuis dibuka, status tercatat aktif untuk mencegah siswa membuka kuis hanya untuk mengintip soal lalu keluar.

### Kategori 6: Framing & Reality Checks (Metode 44 – 47)
- **44. Abstraction Laddering**: Dari tingkat filosofi "Ekosistem Pendidikan 3-Arah yang Memberdayakan Siswa", turun ke spesifikasi teknis "Server Action `startQuizAttemptFromSessionAction` tanpa parameter studentId".
- **45. Reframe the Question**: Bukan "Bagaimana mencegah siswa menyontek di browser?", melainkan "Bagaimana memastikan server tidak pernah mengirimkan data rahasia sebelum siswa mengumpulkan jawaban?".
- **46. Stakeholder Lens Rotation**: Memeriksa tampilan portal dari kacamata guru: guru melihat dashboard kelas yang langsung terisi status pengerjaan kuis siswa secara real-time tanpa perlu memungut kertas ujian.
- **47. Map Is Not the Territory**: Menguji asumsi dokumen lama: dokumen lama menyebutkan `/siswa` untuk siswa, namun kode fisik Next.js membuktikan `src/app/(dashboard)/siswa` sudah aktif digunakan oleh guru. Realitas kode harus menang.

### Kategori 7: Learning & Knowledge Retention (Metode 48 – 50)
- **48. Feynman Technique**: "Siswa buka HP, lihat jadwal hari ini dan kuis yang harus dikerjakan. Begitu klik Kerjakan, nama siswa otomatis terpasang tanpa perlu ketik PIN kelas lagi. Selesai jawab, nilai langsung muncul di buku nilai guru."
- **49. Active Recall Testing**: Memastikan tim mengingat aturan isolasi cookie: `klassa_student_session` untuk siswa, `better-auth.session_token` untuk guru; keduanya tidak boleh saling menghapus.
- **50. Deliberate Practice Loop**: Merancang pengujian otomatis integrasi kuis dengan simulasi request palsu (attacker menyuntikkan ID siswa lain) untuk menjamin verifikasi server action selalu menolak manipulasi.

### Kategori 8: Philosophical & Ethical Lenses (Metode 51 – 52)
- **51. Occam's Razor Application**: Memilih solusi penanganan rute paling sederhana dan kokoh: biarkan `/siswa` tetap untuk guru, jadikan `/portal-siswa` untuk siswa. Nol migrasi rute guru, nol risiko regresi.
- **52. Trolley Problem Variations**: Antara membiarkan siswa submit kuis terlambat beberapa detik akibat koneksi lambat vs menegakkan keadilan batas waktu: Server memberikan toleransi *grace period* jaringan maksimal 15 detik pada evaluasi `isAttemptExpired`.

### Kategori 9: Research & Evidence Triangulation (Metode 53 – 56)
- **53. Literature Review Personas**: Merujuk riset UI/UX pendidikan anak: Navigasi bawah dengan maksimal 5 item adalah standar ergonomis optimal untuk penggunaan smartphone satu tangan oleh remaja/anak sekolah.
- **54. Thesis Defense Simulation**: Mempertahankan alasan tidak menampilkan nilai kuis teman sekelas di portal siswa: menjaga privasi dan kesehatan mental belajar siswa (menghindari perundungan nilai).
- **55. Comparative Analysis Matrix**: Membandingkan pola autosave: Debounce 500ms vs On-Blur vs Batch Submit. Terpilih: Optimistic UI + Debounce 500ms + Full Final Payload saat Submit untuk keandalan maksimal.
- **56. Source Triangulation**: Mengonfirmasi keselarasan Amendum Keamanan B1, B3, B4, dan B5 pada seluruh file implementasi Story 4.

### Kategori 10: Retrospective & Lessons Learned (Metode 57 – 58)
- **57. Hindsight Reflection**: Belajar dari integrasi kuis publik `/q/[token]` eksisting: kelemahan terbesarnya adalah mempercayai input `studentId` dari form browser. Story 4 menutup celah ini secara permanen untuk portal siswa.
- **58. Lessons Learned Extraction**: Pelajaran dari Story 3: pembaruan field keamanan pada database (`pinUpdatedAt`) wajib selalu disinkronkan dengan cookie sesi aktif saat itu juga agar pengguna tidak terkunci sendiri.

### Kategori 11: Risk & Reliability Engineering (Metode 59 – 65)
- **59. Pre-mortem Analysis**: "Serverless database overload pada pukul 07.00 saat 1000 siswa membuka jadwal bersamaan": Diatasi dengan query tunggal paralel berindeks dan caching react server component.
- **60. Failure Mode Analysis (FMEA)**: Jika siswa menutup browser di tengah kuis $\rightarrow$ Jawaban yang sudah dipilih tersimpan di `QuizAnswer` $\rightarrow$ Siswa buka lagi kuis $\rightarrow$ State jawaban pulih dari database.
- **61. Challenge from Critical Perspective**: Apakah siswa bisa membuka halaman review sebelum submit? $\rightarrow$ Dicegah dengan pemeriksaan mutlak `attempt.status === 'SUBMITTED'` di server action dan routing page.
- **62. Identify Potential Risks**: Risiko siswa mengulang kuis tanpa izin: `prisma.quizAttempt.findUnique` memastikan attempt hanya dibuat 1 kali per siswa per kuis, kecuali ada status remedial aktif dari guru.
- **63. Chaos Monkey Scenarios**: Jaringan putus total saat klik tombol "Selesai Ujian" $\rightarrow$ Tombol masuk ke state retry, payload tidak hilang dari state memori klien, siswa dapat mengulang klik submit saat jaringan pulih.
- **64. Assumption Audit**: Menguji asumsi "Siswa selalu mengingat PIN lama saat ganti PIN": Siswa bisa lupa PIN lamanya $\rightarrow$ Berikan petunjuk jelas: *"Lupa PIN lama? Minta guru pengampu rombel untuk mereset PIN Anda."*
- **65. Cascading Failure Simulation**: Jika sesi siswa kadaluarsa saat sedang asyik mengerjakan kuis $\rightarrow$ Autosave gagal dengan kode error `UNAUTHORIZED` $\rightarrow$ UI kuis menampilkan modal dialog login cepat tanpa me-reload halaman agar jawaban siswa tidak hilang.

### Kategori 12: Technical Deep Dive & Benchmarks (Metode 66 – 71)
- **66. Architecture Decision Records (ADR)**:
  - *ADR-4.1: URL Pintu Masuk Siswa*: `/portal-siswa` untuk publik (Login NIS+PIN & Gabung Rombel), `/siswa/portal/*` untuk area terproteksi.
  - *ADR-4.2: Derivasi Identitas Kuis*: Identitas kuis di portal siswa 100% server-authoritative via `verifyStudentSession()`.
  - *ADR-4.3: Penanganan Akun PENDING*: Ditangani di tingkat form publik `/portal-siswa` tanpa menerbitkan cookie sesi penuh.
- **67. Rubber Duck Debugging Evolved**: Menelusuri jalur data pengerjaan kuis: Komponen `QuizRunnerClient` $\rightarrow$ Server Action `saveQuizAnswerFromSessionAction` $\rightarrow$ `verifyStudentSession()` $\rightarrow$ Validasi kepemilikan attempt $\rightarrow$ `prisma.quizAnswer.upsert` $\rightarrow$ Return timestamp simpan.
- **68. Algorithm Olympics**: Menguji algoritma shuffling soal per attempt: Menggunakan seed deterministik berbasis `attempt.id` agar urutan soal dan opsi konsisten saat siswa me-refresh halaman, namun berbeda antar siswa.
- **69. Security Audit Personas**:
  - *Hacker Persona*: Mencoba mengakses `/siswa/portal/quiz/token-kuis/review` sebelum submit $\rightarrow$ Ditolak error 403 Forbidden.
  - *Defender Persona*: Memasang HttpOnly, Secure, SameSite=Lax cookie dan sanitasi total properti `correctIndex`.
  - *Auditor Persona*: Memastikan nilai kuis yang masuk ke leger guru tercatat dengan timestamp submit yang akurat.
- **70. Performance Profiler Panel**: Query Daily Stream dioptimasi menjadi 1 roundtrip database:
  ```ts
  const [student, schedule, quizzes] = await Promise.all([...]);
  ```
  Total latency database terkendali di $< 45\text{ms}$.
- **71. Boundary & Edge Case Sweep**:
  - Siswa submit tanpa menjawab 1 pun soal $\rightarrow$ Sistem menampilkan modal peringatan *"Ada X soal yang belum dijawab. Yakin ingin mengumpulkan?"*, jika dikonfirmasi, kuis tergrade dengan nilai 0.
  - Siswa mencoba submit kuis yang sudah berstatus `SUBMITTED` $\rightarrow$ Server mengembalikan `alreadySubmitted: true` tanpa mengubah skor awal.
  - Nilai desimal pada soal kuis $\rightarrow$ Menggunakan standardisasi pembulatan 2 digit desimal.

---

## 3. Resolusi Tuntas 5 Topik Konsultasi BMAD

Berikut adalah keputusan final dan rancangan arsitektur untuk 5 topik kritis yang ditargetkan pada Story 4:

### 1. Resolusi Benturan Rute URL Guru vs Siswa
- **Keputusan**: **Tetap pertahankan `/siswa` sebagai Roster Guru (`(dashboard)/siswa`), dan tempatkan portal siswa di rute bersih.**
  - Pintu Masuk Publik: `src/app/(student)/portal-siswa/page.tsx` (Tab Login NIS+PIN & Gabung Kode Rombel).
  - Area Terproteksi Siswa: `src/app/siswa/portal/*` (Layout khusus siswa terisolasi dengan Bottom Nav).
  - Perbaikan Wajib `src/proxy.ts`: Ubah target redirect yang belum terautentikasi dari `/siswa` ke `/portal-siswa`.
  - Perbaikan Wajib `logoutStudent()`: Ubah redirect dari `/siswa` ke `/portal-siswa`.
  - *Alasan*: Menghindari *breaking changes* fatal pada ribuan baris kode dashboard guru, menu navigasi, sidebar, breadcrumb, dan test suite guru yang sudah stabil.

### 2. Kerahasiaan Kunci Jawaban vs Optimistic Client Rendering
- **Keputusan**: **Strict Server-Side Projection & Zero-Knowledge Client Contract.**
  - Data yang dikirim server ke antarmuka ujian kuis siswa murni berupa DTO:
    ```ts
    type StudentQuizQuestionView = {
      id: string;
      order: number;
      type: "MULTIPLE_CHOICE" | "ESSAY";
      text: string;
      options: string[]; // Nilai teks opsi yang sudah di-shuffle
      points: number;
    };
    ```
  - Properti `correctIndex` dan `explanation` dihapus di server sebelum di-serialize ke RSC / client props.
  - Autosave per butir soal (`saveQuizAnswerFromSessionAction`) hanya mengembalikan status sukses dan timestamp simpan, tanpa membocorkan apakah jawaban benar atau salah.
  - Pembahasan (`explanation`) dan kunci jawaban HANYA dikirimkan pada halaman Review (`/review`) yang mewajibkan `attempt.status === "SUBMITTED"`.

### 3. Mekanisme Pengecualian PIN Kelas di Portal
- **Keputusan**: **Bypass Total `CLASSROOM_PIN` untuk Siswa Portal Terotentikasi; Sinkronisasi Ujian via `validFrom`.**
  - Siswa yang login di portal siswa telah melalui autentikasi kredensial (NIS + PIN) dan terverifikasi di daftar roster rombel aktif.
  - Mengharuskan siswa mengetik ulang PIN kelas di proyektor menciptakan friksi UX yang tidak perlu pada perangkat ponsel.
  - Jika guru ingin seluruh siswa mulai ujian secara serentak, guru mengatur jadwal kuis menggunakan field `validFrom` (misal pukul 08:00 WIB).
  - Server action `startQuizAttemptFromSessionAction` secara ketat menolak pengerjaan jika waktu sekarang `< validFrom`, dengan pesan: *"Ujian belum dimulai. Silakan tunggu jadwal mulai pukul XX:XX"*.

### 4. Strategi Caching & Kinerja Daily Stream Jam 07:00 Pagi
- **Keputusan**: **Composite Indexing, Query Bundling, & Static Class Schedule Caching.**
  - Gabungkan pengambilan data Daily Stream dalam 1 fungsi paralel (`Promise.all`):
    1. Konteks rombel siswa & periode aktif (`ClassStudent` join `AcademicPeriod`).
    2. Jadwal pelajaran hari ini (`TeachingSchedule` where `teachingContextId IN (...)` AND `dayOfWeek = currentDay`).
    3. Kuis aktif rombel (`Quiz` where `teachingContextId IN (...)` AND `status = PUBLISHED` AND `deadline >= now`).
  - Pasang indeks komposit pada `TeachingSchedule` `[teachingContextId, dayOfWeek]` (sudah tersedia di skema).
  - Terapkan seleksi kolom minimal (`select` spesifik nama mapel, jam mulai-selesai, nama guru) tanpa mengambil relasi yang tidak diperlukan.
  - Gunakan `unstable_cache` atau React Server Component caching untuk data jadwal rombel mingguan yang jarang berubah.

### 5. Penanganan Keamanan pada Komputer Lab Bersama
- **Keputusan**: **Lab-Ready Header, Inactivity Auto-Logout, & Multi-Layer Session Scrubbing.**
  - **Tombol Keluar 1-Ketuk**: Diletakkan secara permanen dan mencolok di kanan atas `StudentHeader.tsx`, dilengkapi konfirmasi instan.
  - **Client-Side Inactivity Timer**: Komponen `StudentInactivityGuard` memantau interaksi pengguna (mouse, keyboard, touch). Jika tidak ada aktivitas selama 15 menit, tampilkan modal peringatan 60 detik sebelum memicu `logoutStudent()`.
  - **Pemisahan Cookie**: `logoutStudent()` hanya menghapus cookie `klassa_student_session` tanpa mengganggu cookie sesi guru `better-auth.session_token` jika ada di komputer lab yang sama.
  - **Peringatan Komputer Lab**: Pada layar berukuran desktop (indikasi PC lab), tampilkan banner informatif di bagian bawah: *"Menggunakan komputer lab bersama? Pastikan Anda selalu menekan tombol Keluar setelah selesai belajar."*

---

## 4. Rencana Pembaruan File Spesifikasi Story 4

Berdasarkan 71 sudut pandang metode BMad dan 10 temuan kritis (F1 – F10), file spesifikasi `spec-student-portal-auth/stories/4-portal-siswa-gelombang-1-integrasi-quiz.md` akan diperbarui secara komprehensif pada bagian:
1. **Status Dokumen**: Berubah dari `status: 'ready-for-elicitation'` menjadi `status: 'approved-and-hardened'`.
2. **Intent & Pendekatan**:
   - Menegaskan rute publik di `/portal-siswa` dan area terproteksi di `/siswa/portal/*`.
   - Mengoreksi penanganan akun `PENDING` agar berada di gerbang `/portal-siswa` tanpa deadlock sesi di `/siswa/portal/pending`.
   - Menegaskan 4 kuartet Server Action kuis berbasis sesi server.
   - Menjelaskan bahwa nilai kuis di Gelombang 1 berpusat pada `QuizAttempt.score` yang langsung dapat dibaca oleh leger guru.
3. **Boundaries & Constraints (Always & Never)**:
   - Menambahkan aturan wajib re-issue cookie sesi saat ganti PIN (F5).
   - Menambahkan aturan sanitasi total kunci jawaban (F6).
   - Menambahkan aturan server-authoritative timer (F7).
   - Menambahkan aturan lockout persisten pada modal ganti PIN (F10).
4. **I/O & Edge-Case Matrix**:
   - Memperbarui skenario akses unauthenticated (redirect ke `/portal-siswa`).
   - Memperbarui skenario akun PENDING dan REJECTED di `/portal-siswa`.
   - Menambahkan skenario autosave kuis, late submission cutoff, dan ganti PIN session rotation.
5. **Code Map**:
   - Memperbarui path komponen dan server action yang selaras dengan temuan.
6. **Tasks & Execution Checklist**:
   - Menambahkan task perbaikan `src/proxy.ts` dan `logoutStudent`.
   - Menambahkan kuartet server action kuis.
   - Menambahkan komponen penjaga keamanan lab (`StudentInactivityGuard.tsx`).
7. **Acceptance Criteria**:
   - Menyesuaikan 5 poin AC dengan seluruh benteng pengamanan yang telah dielaborasi.
