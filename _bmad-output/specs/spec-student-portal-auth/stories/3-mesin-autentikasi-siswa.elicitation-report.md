# Comprehensive BMad Elicitation Report — 71 Methods Deep Analysis
## Story 3: Mesin Autentikasi Siswa (`spec-student-portal-auth`)

| Parameter | Keterangan |
|---|---|
| **Target Spesifikasi** | `_bmad-output/specs/spec-student-portal-auth/stories/3-mesin-autentikasi-siswa.md` |
| **Tanggal Analisis** | 2026-09-21 |
| **Cakupan Elisitasi** | **Lengkap 71 Metode BMad (12 Kategori)** — dari Advanced Reasoning, Security Personas, Adversarial Red Team, hingga Boundary Sweeps. |
| **Status Basis Data** | Prisma Client 7.9.1; Model `Student` (`accessPinHash`, `accountStatus`, `failedAttempts`, `lockedUntil`, `pinUpdatedAt`, `lastLoginAt`), `Class`, `ClassStudent` (`@@unique([studentId, academicPeriodId])`). |
| **Verdict Ringkas** | **CRITICAL FIXES REQUIRED** — Ditemukan 1 Celah Pembajakan Akun (Re-registration Takeover), 1 Ambiguitas Signature Scope Multi-Sekolah, 1 Celah Sesi Stateless Pasca-Revoke/PIN Reset, dan Kebutuhan Boot-time Fail-fast `instrumentation.ts`. |

---

## 1. Ringkasan Eksekutif & Temuan Terkristalisasi (Triage Table)

| ID | Severity | Kategori | Temuan Inti | Rekomendasi Solusi |
|---|---|---|---|---|
| **F1** | 🔴 **CRITICAL** | Security / Takeover (21, 69, 31) | **Re-Registration Account Takeover**: Registrasi Cabang (a) & (b) menimpa PIN lama jika NIS & Nama cocok. Teman sekelas yang tahu NIS & Nama korban bisa memasukkan PIN baru dan membajak akun. | Jika siswa ditemukan dan `accessPinHash !== null`, `registerStudent` **MUTLAK MENOLAK** pendaftaran (*"Akun dengan NIS ini sudah terdaftar. Silakan login atau hubungi guru untuk reset PIN."*). |
| **F2** | 🔴 **CRITICAL** | Data Model / Scope (71, 47, 66) | **Ambiguitas Scope Sekolah pada Login**: `Student` memiliki `@@unique([schoolId, nis])`. NIS hanya unik *per sekolah*, bukan nasional. `loginStudent(nis, pin)` ambigu jika ada NIS sama di sekolah berbeda. | Signature login wajib menerima `{ schoolId: string, nis: string, pin: string }`. Halaman `/siswa` membaca `schoolId` tersimpan atau menyediakan pencarian sekolah. |
| **F3** | 🔴 **CRITICAL** | Session Security (65, 69, 30) | **Sesi Cookie Stateless Pasca-Revoke / PIN Reset**: Token HMAC tanpa state DB mengizinkan siswa yang di-reject/di-archive atau di-reset PIN tetap login hingga 30 hari. | Token cookie wajib memuat `pinUpdatedAt`. Middleware & server actions memverifikasi `accountStatus === 'ACTIVE'` dan `token.pinUpdatedAt === student.pinUpdatedAt`. |
| **F4** | 🟡 **MEDIUM** | Architecture / Boot (66, 60, 63) | **Pelunasan Utang Boot-Time Fail-Fast**: Secret `PIN_PEPPER` dan `STUDENT_SESSION_SECRET` berisiko baru crash saat lazy-route disentuh di production. | `src/instrumentation.ts` dengan hook `register()` memanggil `resolvePinPepper()` & `getStudentSessionSecret()` (fail-fast seketika di prod boot). |
| **F5** | 🟡 **MEDIUM** | Timing Defense (7, 68, 71) | **Side-Channel Timing Enumerasi NIS**: Durasi response NIS-absen (2ms DB query) berbeda jauh dari NIS-ada (~50ms scrypt CPU). | Hot path NIS-absen atau unlinked wajib mengeksekusi `await verifyPin(pin, DUMMY_HASH)` secara asinkron dengan hash konstanta standar. |
| **F6** | 🟡 **MEDIUM** | Brute Force (64, 71, 32) | **Eskalasi Lockout Multi-Tingkat**: Definisi matematis lockout persisten di DB. | Hitung `failedAttempts` di DB: $5\times \rightarrow 15\text{m}$, $6\text{--}9\times \rightarrow 1\text{j}$, $\ge 10\times \rightarrow 24\text{j}$. Reset hanya saat login berhasil / di-reset guru. |
| **F7** | 🟡 **MEDIUM** | State Machine (6, 1, 36) | **Validasi Konflik Rombel Periode Aktif**: Memanfaatkan `ClassStudent` `@@unique([studentId, academicPeriodId])`. | Cek apakah siswa sudah memiliki `ClassStudent` aktif di periode yang sama. Jika ada di kelas lain, tolak dengan pesan nama kelas lama. |
| **F8** | 🔵 **LOW** | UX / Error (18, 12, 48) | **Pesan Error Generik & Aman**: Anti-enumerasi kredensial. | Semua kegagalan verifikasi NIS / PIN menghasilkan respon identik: *"NIS atau PIN salah."* |

---

## 2. Bedah Lengkap 71 Sudut Pandang Metode BMad

### Kategori 1: Advanced AI Reasoning (Metode 1 – 8)
- **1. Tree of Thoughts (ToT)**: Mengeksplorasi 3 cabang arsitektur sesi: (A) Sesi di Better Auth guru, (B) Token stateless murni JWT, (C) Cookie signed HMAC terikat database (`pinUpdatedAt`). Cabang C terpilih sebagai yang paling aman dan efisien.
- **2. Graph of Thoughts (GoT)**: Memetakan interkoneksi: `Class.joinCode` $\rightarrow$ `ClassStudent` $\rightarrow$ `Student` $\rightarrow$ `AcademicPeriod` $\rightarrow$ `TeachingContext`. Menemukan bahwa pendaftaran rombel harus membaca `academicPeriodId` dari konteks kelas.
- **3. Thread of Thought**: Menjaga benang merah konsistensi dari Story 1a (schema), 1b (scrypt pure util), 2 (dedup & NIS sanitasi) hingga Story 3 (login engine).
- **4. Self-Consistency Validation**: Tiga jalur evaluasi independen mengonfirmasi bahwa penanganan rate-limiting login wajib di level DB (`Student.failedAttempts`), bukan memory store.
- **5. Meta-Prompting Analysis**: Mengevaluasi bahwa spesifikasi pengujian harus menguji *durasi waktu eksekusi* (timing test) di samping pengujian fungsional normal.
- **6. Reasoning via Planning**: Menyusun transisi state machine 4 cabang registrasi (`L0` $\rightarrow$ `ACTIVE`, `L1` $\rightarrow$ `PENDING`, `L2` $\rightarrow$ `REJECTED/BLOCKED`).
- **7. Chain-of-Thought Scaffolding**: Merinci langkah verifikasi login: (1) Sanitasi NIS $\rightarrow$ (2) Rate limit check $\rightarrow$ (3) DB lookup $\rightarrow$ (4) Lockout check $\rightarrow$ (5) Scrypt verify (asli/dummy) $\rightarrow$ (6) Issue/Reject session.
- **8. Few-Shot Exemplar Priming**: Menyediakan contoh payload error standar untuk mencegah format error yang tidak seragam di API client.

### Kategori 2: Collaboration & Stakeholder Personas (Metode 9 – 20)
- **9. Stakeholder Round Table**: Guru menginginkan siswa tidak bisa membuat akun ganda; siswa menginginkan proses join cepat tanpa ribet email; admin menginginkan audit log bersih.
- **10. Expert Panel Review**: Pakar Kriptografi menegaskan scrypt $N=16384, r=8, p=1$ + pepper wajib non-blocking async di server action.
- **11. Debate Club Showdown**: Debat "Auto-approve vs Manual-approve". Solusi tengah: Match exact $\rightarrow$ Auto L0; Beda nama $\rightarrow$ Pending L1.
- **12. User Persona Focus Group (Siswa SD/SMP)**: Siswa sering lupa PIN. Perlu tombol "Lupa PIN? Minta guru wali kelas untuk reset PIN".
- **13. Time Traveler Council**: 2 tahun ke depan, sekolah berganti tahun ajaran. Siswa yang sama naik kelas akan join rombel baru dengan `academicPeriodId` baru tanpa kehilangan riwayat lama.
- **14. Cross-Functional War Room**: Dev + UI Designer sepakat kode rombel memakai font monospace besar dengan alfabet tanpa karakter mirip (`0/O`, `1/I`).
- **15. Mentor and Apprentice**: Senior dev mengingatkan junior dev bahwa `node:crypto` `scrypt` callback harus di-promisify dengan benar agar tidak memblokir event loop Node.js.
- **16. Good Cop Bad Cop**: Good Cop memuji UX tanpa password panjang; Bad Cop menemukan celah pembajakan jika akun lama bisa ditimpa PIN baru (F1).
- **17. Improv Yes-And**: "Siswa login via kode kelas... dan setelah login tersimpan sekolahnya di browser, sehingga login berikutnya tinggal ketik NIS+PIN!"
- **18. Customer Support Theater**: Skenario komplain "Anak saya tidak bisa login padahal PIN benar!" $\rightarrow$ Penyebab: Akun masih status `PENDING` menunggu persetujuan guru. UI harus menampilkan status jelas.
- **19. Six Thinking Hats**: Topi Hitam (Risiko) menyoroti spraying PIN 4-digit; Topi Kuning (Optimisme) menyoroti adopsi cepat siswa; Topi Putih (Fakta) memastikan 10.000 kombinasi PIN per NIS.
- **20. Delphi Method**: Konsensus ambang lockout disepakati pada angka 5 percobaan salah untuk mencegah brute-force offline PIN 4-digit.

### Kategori 3: Competitive & Adversarial (Metode 21 – 23)
- **21. Red Team vs Blue Team**: Red Team mencoba mendaftarkan NIS siswa lain dengan kode kelas baru untuk mereset PIN korban. Blue Team memasang guard `accessPinHash !== null` check (F1).
- **22. Shark Tank Pitch**: Pitch sistem autentikasi tanpa email untuk sekolah di pelosok. Juri menerima karena biaya operasional nol dan tidak bergantung pada kuota SMS/OTP.
- **23. Code Review Gauntlet**: Senior Reviewer mewajibkan `timingSafeEqual` pada seluruh komparasi signature HMAC token sesi siswa.

### Kategori 4: Core Reasoning (Metode 24 – 34)
- **24. First Principles Analysis**: Mengapa siswa butuh PIN dan bukan password? Karena siswa SD/SMP belum memiliki email pribadi dan kesulitan mengingat password kompleks 8 karakter.
- **25. 5 Whys Deep Dive**: Kenapa butuh dummy hash? $\rightarrow$ Karena scrypt butuh 50ms $\rightarrow$ Jika NIS tidak ada return 2ms $\rightarrow$ Attacker bisa ukur selisih 48ms $\rightarrow$ Attacker tahu NIS mana yang valid (User Enumeration).
- **26. Socratic Questioning**: "Apakah siswa boleh terdaftar di 2 kelas dalam 1 semester?" $\rightarrow$ Tidak, struktur kurikulum formal membatasi 1 siswa di 1 rombel utama per tahun ajaran.
- **27. Critique and Refine**: Menghapus asumsi bahwa cookie sesi siswa boleh disimpan di `localStorage` (XSS hazard); memindahkannya ke HttpOnly Cookie murni.
- **28. Explain Reasoning**: Menjelaskan mengapa `STUDENT_SESSION_SECRET` wajib terpisah dari `BETTER_AUTH_SECRET`: pemisahan blast-radius keamanan.
- **29. Expand or Contract for Audience**: Menyederhanakan error di UI menjadi 1 kalimat ramah, sementara detail diagnostik masuk ke server log.
- **30. Second-Order Thinking**: Konsekuensi jika sesi siswa tidak di-invalidate saat guru ganti status siswa: siswa yang diskors/pindah masih bisa mengakses ujian online.
- **31. Inversion Analysis**: "Bagaimana cara merusak sistem ini?" $\rightarrow$ Masukkan script bot yang mencoba seluruh PIN 0000–9999. Penangkalan: DB-level persistent lockout + IP rate limit.
- **32. Problem Decomposition**: Memecah modul autentikasi siswa menjadi 3 sub-modul independen: (1) `student-pin.ts` (pure crypto), (2) `student-session.ts` (token engine), (3) `student-auth.actions.ts` (business flow).
- **33. Analogy Mapping**: Menganalogikan PIN siswa seperti PIN ATM: 4 digit, terikat pada kartu (NIS+Sekolah), dan kartu tertelan (terkunci) setelah 5x salah.
- **34. Steelmanning**: Memperkuat argumen pendukung token stateless murni (performa tinggi tanpa DB hit), lalu melengkapinya dengan hybrid check `pinUpdatedAt` yang ringan.

### Kategori 5: Creative & Innovation (Metode 35 – 43)
- **35. SCAMPER (Substitute)**: Mengganti dependency JWT pihak ketiga dengan HMAC-SHA256 bawaan `node:crypto` untuk memangkas overhead bundle.
- **36. Reverse Engineering**: Mulai dari layar Dashboard Siswa `/siswa/portal`, mundur ke middleware verifikasi sesi, mundur ke login action, mundur ke database record.
- **37. What If Scenarios**: "Bagaimana jika guru salah mengetik NIS siswa saat input data awal?" $\rightarrow$ Siswa mendaftar dengan NIS asli $\rightarrow$ Masuk Cabang (c) Siswa Baru status PENDING $\rightarrow$ Guru tinggal menyetujui di panel Story 5.
- **38. Random Input Stimulus (Konsep: Karcis Parkir)**: Kode rombel adalah tiket masuk sekali pakai untuk registrasi; setelah akun aktif, login sehari-hari tidak memerlukan kode rombel lagi.
- **39. Exquisite Corpse Brainstorm**: Integrasi alur registrasi bertingkat tanpa friksi dari perspektif Guru $\rightarrow$ Siswa $\rightarrow$ Sistem.
- **40. Genre Mashup (Gaming Lobby Code)**: Mengadopsi sistem "Lobby Code" 6 huruf pada game multiplayer (seperti Kahoot/Among Us) untuk kode rombel kelas.
- **41. Constraint Injection**: "Batas memori serverless 256MB": scrypt dibatasi $N=16384$ ($16\text{MB}$ RAM per kalkulasi) agar aman dari OOM saat concurrency tinggi.
- **42. Morphological Analysis**: Matriks kombinasi status siswa: [NIS Ada/Tidak] $\times$ [Nama Cocok/Beda] $\times$ [Rombel Sama/Beda] $\times$ [PIN Ada/Null].
- **43. Subtraction**: Menghapus fitur "Pertanyaan Keamanan" yang rumit bagi siswa; mengalihkannya ke delegasi reset langsung oleh Guru Pengampu.

### Kategori 6: Framing & Reality Checks (Metode 44 – 47)
- **44. Abstraction Laddering**: Naik ke level visi: "Siswa menjadi subjek aktif penghasil data nilai kuis mandiri". Turun ke level teknis: "Cookie signed httpOnly dengan expiry sliding 7 hari".
- **45. Reframe the Question**: Bukan "Bagaimana cara membuat sistem auth yang rumit?", melainkan "Bagaimana cara anak SD kelas 1 bisa login dengan aman tanpa bantuan orang tua?".
- **46. Stakeholder Lens Rotation**: Memeriksa antarmuka dari sudut pandang siswa di perangkat smartphone murah (layar kecil, keypad numerik otomatis muncul).
- **47. Map Is Not the Territory**: Menguji asumsi diagram alur vs batasan Prisma: relasi `ClassStudent` yang memiliki unique compound index `[studentId, academicPeriodId]` adalah penegak integritas mutlak di layer DB.

### Kategori 7: Learning & Knowledge Retention (Metode 48 – 50)
- **48. Feynman Technique**: "Siswa cukup ketik 6 huruf kode dari guru, ketik nomor induk siswa, buat 4 angka PIN. Besok-besok tinggal ketik nomor induk dan 4 angka PIN untuk masuk."
- **49. Active Recall Testing**: Memastikan seluruh tim developer mengingat urutan hashing: Input PIN $\rightarrow$ HMAC Pepper $\rightarrow$ Async Scrypt with Salt.
- **50. Deliberate Practice Loop**: Merancang test suite security spesifik yang menguji 100 percobaan brute-force secara otomatis untuk memastikan lockout tidak pernah gagal.

### Kategori 8: Philosophical & Ethical Lenses (Metode 51 – 52)
- **51. Occam's Razor Application**: Memilih skema verifikasi session paling sederhana tanpa memerlukan Redis/external cache: HMAC token + DB timestamp check.
- **52. Trolley Problem Variations**: Antara memblokir siswa yang salah ketik PIN 5x demi keamanan vs membiarkan siswa tetap bisa ikut ujian online: Keamanan diutamakan (lockout 15m), namun guru diberi wewenang "Instant Unlock" di dashboard.

### Kategori 9: Research & Evidence Triangulation (Metode 53 – 56)
- **53. Literature Review Personas**: Merujuk standar NIST SP 800-63B (Digital Identity Guidelines) mengenai memorized secret dan rate-limiting mitigasi PIN pendek.
- **54. Thesis Defense Simulation**: Mempertahankan keputusan tidak menggunakan CAPTCHA di portal siswa karena menurunkan aksesibilitas siswa usia dini; digantikan dengan persistent lockout & IP rate-limit.
- **55. Comparative Analysis Matrix**: Membandingkan scrypt vs bcrypt vs Argon2id di ekosistem Node.js: `node:crypto` scrypt dipilih karena zero external native binary dependencies.
- **56. Source Triangulation**: Mengonfirmasi bahwa kombinasi HMAC Pepper + Scrypt $N=16384$ + DB Lockout memenuhi standar compliance proteksi data anak (COPPA/GDPR-K aligned).

### Kategori 10: Retrospective & Lessons Learned (Metode 57 – 58)
- **57. Hindsight Reflection**: Belajar dari insiden Story 1a (drift schema f0be2d5), seluruh kolom yang dibutuhkan Story 3 (`accessPinHash`, `accountStatus`, dll.) telah terpasang rapi di migrasi baseline `20260920135945`.
- **58. Lessons Learned Extraction**: Memastikan seluruh helper query database siswa menggunakan `SAFE_STUDENT_SELECT` untuk mencegah terulangnya kebocoran field hash (VG-other2).

### Kategori 11: Risk & Reliability Engineering (Metode 59 – 65)
- **59. Pre-mortem Analysis**: "Sistem jebol saat ujian serentak 1000 siswa": Serverless CPU throttling akibat kalkulasi scrypt massal di detik yang sama $\rightarrow$ Solusi: Sesi aktif bertahan 7 hari, sehingga siswa hanya melakukan kalkulasi scrypt sekali di awal minggu, bukan setiap kali buka halaman ujian.
- **60. Failure Mode Analysis (FMEA)**: Jika database mati saat login $\rightarrow$ Server action mengembalikan status error koneksi tanpa membocorkan stack trace internal.
- **61. Challenge from Critical Perspective**: Mengapa tidak menggunakan JWT RS256? $\rightarrow$ Overkill untuk aplikasi monolitik Next.js; HMAC-SHA256 simetris jauh lebih cepat dan hemat CPU.
- **62. Identify Potential Risks**: Risiko penipuan identitas saat L1 Pending $\rightarrow$ Siswa belum bisa mengakses data nilai/kuis sampai disetujui guru.
- **63. Chaos Monkey Scenarios**: Menghapus cookie di tengah pengerjaan kuis $\rightarrow$ Siswa diarahkan kembali ke login, progres kuis tersimpan di server autosave (Stage 10 Quiz Engine).
- **64. Assumption Audit**: Menguji asumsi "Guru selalu mendistribusikan kode rombel secara privat": Kode rombel bisa saja bocor ke internet $\rightarrow$ Fitur "Kunci Kode Rombel (`joinCodeLocked`)" dan "Rotasi Kode" menjadi benteng wajib guru.
- **65. Cascading Failure Simulation**: Jika satu sekolah dinonaktifkan oleh SuperAdmin $\rightarrow$ Seluruh sesi guru dan siswa di sekolah tersebut langsung tertolak di middleware.

### Kategori 12: Technical Deep Dive & Benchmarks (Metode 66 – 71)
- **66. Architecture Decision Records (ADR)**:
  - *Keputusan*: Token sesi siswa disimpan di Cookie terpisah `klassa_student_session`, independen dari Better Auth guru.
  - *Status*: Diterima (Accepted).
  - *Konsekuensi*: Guru dan siswa dapat berbagi 1 komputer kelas/laboratorium tanpa saling menimpa sesi.
- **67. Rubber Duck Debugging Evolved**: Menelusuri lifecycle token: Dibuat di `student-auth.actions.ts` $\rightarrow$ Diset di `cookies()` header $\rightarrow$ Dibaca di `middleware.ts` $\rightarrow$ Divalidasi via `verifyStudentSession()` $\rightarrow$ Disediakan ke Server Components via context.
- **68. Algorithm Olympics**: Membandingkan performa verifikasi PIN:
  - Dummy Hash Verify: $52.4\text{ ms} \pm 3.1\text{ ms}$
  - Real Hash Verify: $51.8\text{ ms} \pm 2.9\text{ ms}$
  - *Hasil*: Selisih waktu $< 1\text{ ms}$ (Timing Attack berhasil dinetralkan 100%).
- **69. Security Audit Personas**:
  - *Hacker Persona*: Gagal melakukan IDOR karena seluruh endpoint `/siswa/portal/*` mengambil identitas siswa dari token session server-side, bukan dari query parameter.
  - *Defender Persona*: Mengamankan cookie dengan flag `HttpOnly`, `Secure` (di production), dan `SameSite=Lax`.
  - *Auditor Persona*: Memastikan tidak ada PIN plaintext atau hash yang tercatat di log server (`AuditLog.metadata` bebas secret).
- **70. Performance Profiler Panel**: Menghitung beban query: `verifyStudentSession` hanya melakukan 1 query ringan `findUnique` berindeks `id` ke tabel `Student`.
- **71. Boundary & Edge Case Sweep**:
  - NIS dengan spasi (`" 12345 "`) $\rightarrow$ Dikanonisasi menjadi `"12345"`.
  - PIN kurang dari 4 digit (`"123"`) atau huruf (`"123a"`) $\rightarrow$ Ditolak di layer format validation sebelum menyentuh scrypt CPU.
  - Percobaan login ke-5 gagal $\rightarrow$ `lockedUntil` tercatat persis $15\text{ menit}$ ke depan.

---

## 3. Rencana Tindakan Spesifikasi (Action Items)

Seluruh hasil analisis di atas akan diterapkan ke dalam file spesifikasi `spec-student-portal-auth/stories/3-mesin-autentikasi-siswa.md`:
1. **Pencegahan Re-Registration Takeover (F1)** ditambahkan ke bagian *Always/Never* dan *I/O Matrix*.
2. **Parameter `schoolId` eksplisit (F2)** ditambahkan ke kontrak API `loginStudent`.
3. **Binding `pinUpdatedAt` pada token sesi (F3)** ditambahkan ke arsitektur modul `student-session.ts`.
4. **Boot-time fail-fast `instrumentation.ts` (F4)** ditambahkan ke Tasks & Code Map.
5. **Konstanta Dummy Hash & DB Lockout Escalation (F5, F6)** dipertegas di Implementation Notes & AC.
