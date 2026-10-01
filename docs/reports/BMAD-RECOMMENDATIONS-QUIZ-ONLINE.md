# 📋 LAPORAN ANALISIS STRATEGIS & REKOMENDASI BMAD
## Modul Quiz Online & PPT Studio — AI Teacher Assistant

> **Dokumen Rujukan:** `docs/REPORT-QUIZ-ONLINE.md`  
> **Tanggal Analisis:** 13 September 2026  
> **Lensa Analisis:**  
> 1. `bmad-agent-analyst` / `bmad-brainstorming` (Analisis Domain & Ideasi)  
> 2. `bmad-spec` / `bmad-prd` (Spesifikasi Produk & Requirement Fase 2)  
> 3. `bmad-create-epics-and-stories` + `bmad-sprint-planning` (Dekomposisi Backlog & Sprint Plan)  
> 4. `bmad-code-review` (Audit Kode, Keamanan, & Arsitektur)  
> **Status:** Siap Direview oleh Pemangku Kepentingan (Stakeholder / Tim Pengembang)

---

## DAFTAR ISI
1. [Ringkasan Eksekutif & Status Terkini](#1-ringkasan-eksekutif--status-terkini)
2. [Analisis Bisnis & Ideasi Lapangan (Analyst & Brainstorming)](#2-analisis-bisnis--ideasi-lapangan-analyst--brainstorming)
3. [Spesifikasi Produk & PRD Fase 2 (Spec & PRD)](#3-spesifikasi-produk--prd-fase-2-spec--prd)
4. [Dekomposisi Epics & Rencana Sprint (Stories & Sprint Planning)](#4-dekomposisi-epics--rencana-sprint-stories--sprint-planning)
5. [Audit Teknis, Arsitektur & Keamanan (Code Review)](#5-audit-teknis-arsitektur--keamanan-code-review)
6. [Matriks Keputusan & Tindakan Prioritas](#6-matriks-keputusan--tindakan-prioritas)

---

## 1. RINGKASAN EKSEKUTIF & STATUS TERKINI

Berdasarkan `docs/REPORT-QUIZ-ONLINE.md`, tim pengembang telah berhasil merilis fondasi MVP Quiz Online hingga Tahap 2 (Keamanan PIN & Analitik Soal) pada branch `explore`.

### Capaian Inti yang Sudah Terbukti Berhasil:
- **Arsitektur Snapshot Soal (`QuizAttempt.questionOrder`):** Menjadi keputusan kunci terpenting yang memisahkan data pengerjaan siswa dari perubahan/penghapusan master soal oleh guru.
- **Validasi Nilai & Normalisasi Skor:** Koreksi otomatis MCQ dengan acak soal dan acak opsi per siswa berjalan akurat setelah bug pemetaan kunci pada attempt legacy diselesaikan.
- **Integrasi Ekosistem Guru:** Terhubung dengan roster kelas, publikasi nilai ke `AssessmentResult` (Gradebook), dan integrasi pembuatan soal berbasis AI (Gemini Flash).
- **Stabilitas:** 15 unit test spesifik modul kuis lulus, total 98 test project hijau, serta zero linter/TypeScript errors.

### Masalah Terbuka & Keputusan yang Perlu Diambil:
1. **Friction Operasional PIN:** Beban guru membagikan PIN baru setiap ulangan.
2. **Kesiapan Ulangan Serentak di Kelas (Skenario A):** Kebutuhan jadwal mulai bersama dan mitigasi koneksi internet drop di sekolah.
3. **Ekspansi Tipe Soal:** Kebutuhan soal Isian Singkat (*Short Answer*) dan Esai (*Essay*) beserta antrean koreksi manual.
4. **Housekeeping Repositori:** Berkas sementara dan artefak yang belum terorganisir di git.

---

## 2. ANALISIS BISNIS & IDEASI LAPANGAN (`bmad-agent-analyst` & `bmad-brainstorming`)

### 2.1 Karakteristik Pengguna & Realitas Kelas di Indonesia
1. **Guru:** Mengajar 4 hingga 6 rombongan belajar (rombel), rata-rata 32–40 siswa per kelas (total 150–240 siswa).
   - *Pain Point:* Guru tidak memiliki waktu untuk mendistribusikan 40 kode PIN yang berbeda melalui WhatsApp setiap kali mengadakan kuis cepat/ulangan harian.
2. **Siswa:** Menggunakan smartphone pribadi dengan kondisi variatif:
   - Kuota data terbatas atau mengandalkan Wi-Fi sekolah yang kerap *unstable* saat puluhan siswa mengakses bersamaan.
   - Rentan terjadi *accidental reload* atau aplikasi tertutup saat berpindah tab.
3. **Pola Asesmen Kurikulum Merdeka / Nasional:**
   - **Ulangan Harian (Formatif/Sumatif Lingkup Materi):** Wajib dikerjakan serentak di kelas (40–80 menit).
   - **Tugas Mandiri/PR:** Dikerjakan fleksibel di rumah hingga tenggat waktu tertentu.
   - **Remedial:** Hak siswa yang nilainya di bawah KKM/Kriteria Ketercapaian Tujuan Pembelajaran (KKTP).

### 2.2 Evaluasi Model Identifikasi Siswa (PIN vs Alternatif)
| Model Identifikasi | Kelebihan | Kekurangan | Rekomendasi |
|---|---|---|---|
| **A. PIN Unik Per-Quiz (Status Saat Ini)** | Sangat aman dari kecurangan teman sekelas yang saling login nama lain. | Guru harus membagikan daftar PIN baru setiap kuis (beban operasional tinggi). | Pertahankan sebagai **Opsi Ketat (Strict Mode)** untuk ujian berisiko tinggi. |
| **B. PIN Siswa Statis (Per Semester)** | Guru hanya membagikan 1 kali di awal semester (misal: kartu PIN siswa). | Jika bocor, siswa bisa memakai PIN temannya sepanjang semester. | Cocok untuk sekolah dengan administrasi kelas yang tertib. |
| **C. Room Session Code (Model Kahoot/Quizizz)** | Guru hanya menyebutkan/menulis 1 kode (misal: `742-198`) di papan tulis. Siswa pilih nama + masukkan kode sesi. | Siswa di kelas yang sama bisa saling memilih nama teman jika berniat jahat. | **SANGAT DIREKOMENDASIKAN** untuk ulangan serentak di kelas (didukung pengawasan fisik guru). |

### 2.3 Evaluasi Skenario Pelaksanaan Kuis
- **Skenario A (Serentak Terjadwal di Kelas):**  
  *Skor Kebutuhan: 10/10 (Mendesak).*  
  Guru memerlukan kepastian bahwa kuis hanya bisa diakses saat jam pelajarannya berlangsung. Butuh fitur *Window of Examination* (contoh: aktif jam 08.00–09.30 WIB).
- **Skenario B (Tugas Mandiri Asinkron):**  
  *Skor Kebutuhan: 8/10 (Sudah terpenuhi).*  
  Konfigurasi `deadline` dan `durationMinutes` saat ini sudah mencukupi kebutuhan pekerjaan rumah.
- **Skenario C (Live Mode Gamifikasi Real-time):**  
  *Skor Kebutuhan: 4/10 (Tunda ke Fase 3).*  
  Live multiplayer membutuhkan koneksi stateful (WebSocket). Mengingat arsitektur aplikasi berbasis Next.js App Router + Neon Serverless PostgreSQL, implementasi ini memicu lonjakan biaya server dan kompleksitas operasional tanpa mendongkrak fungsi pedagogis inti.

---

## 3. SPESIFIKASI PRODUK & PRD FASE 2 (`bmad-spec` & `bmad-prd`)

### 3.1 Visi & Batasan Produk
- **Tujuan Fase 2:** Mengubah Quiz Online dari alat kuis mandiri menjadi sistem Asesmen Kelas yang tangguh (*reliable in-class examination tool*), tahan gangguan jaringan, dan fleksibel dalam skenario autentikasi.
- **Batasan (Out-of-Scope):**
  - Tidak ada pengawasan kamera (*AI webcam proctoring*) karena membebani perangkat siswa kelas bawah.
  - Tidak ada *lockdown browser* tingkat OS (cukup peringatan saat keluar tab di browser biasa).

### 3.2 Kebutuhan Fungsional (Functional Requirements)

#### FR-1: Mode Ujian Terjadwal (Scheduled Exam Window)
- Guru dapat menentukan rentang waktu: `validFrom` (Waktu Mulai) dan `validUntil` (Waktu Selesai).
- Jika siswa mengakses sebelum `validFrom`, halaman menampilkan hitung mundur menuju waktu mulai.
- **Server-Authoritative Duration Clamping:** Jika durasi kuis adalah 60 menit, namun siswa baru menekan "Mulai" 15 menit sebelum `validUntil`, maka durasi pengerjaan siswa dipotong menjadi maksimal 15 menit.

#### FR-2: Ketahanan Jaringan & Autosave Lokal (Offline Resilience)
- Halaman siswa `/q/[token]` menyimpan status jawaban setiap kali opsi diklik ke dalam `localStorage` perangkat browser siswa (`ai-teacher:quiz:[attemptId]`).
- Jika koneksi terputus atau halaman tidak sengaja di-*refresh*, jawaban terakhir langsung terisi kembali secara instan tanpa kehilangan progres.
- Tersedia tombol status indikator koneksi: *"Tersimpan di HP (Offline)"* atau *"Tersinkron ke Server"*.

#### FR-3: Fleksibilitas Akses Masuk Siswa
- Guru memiliki toggle pengaturan akses kuis:
  1. *Mode Bebas:* Siswa cukup memilih namanya dari roster.
  2. *Mode Kode Kelas (Room PIN):* 1 PIN yang sama untuk seluruh siswa pada kuis tersebut.
  3. *Mode PIN Individual:* PIN 4-digit unik per siswa (seperti sistem yang berjalan saat ini).

#### FR-4: Dukungan Soal Esai & Isian Singkat
- Model soal mendukung tipe `SHORT_ANSWER` dan `ESSAY`.
- Sistem koreksi kuis memiliki status: `COMPLETED` (jika semua MCQ selesai dinilai otomatis) atau `NEEDS_GRADING` (jika terdapat soal esai).
- Guru memiliki antrean periksa (*Grading Sheet*) per-siswa atau per-soal dengan input skor manual (0 s.d. Poin Maksimal) dan feedback teks.

### 3.3 Kebutuhan Non-Fungsional (Non-Functional Requirements)
- **NFR-TIME-SYNC:** Seluruh penentuan sisa waktu dihitung dari jam server saat inisialisasi sesi, mencegah manipulasi jam lokal pada perangkat siswa.
- **NFR-CONCURRENCY:** Sistem sanggup menerima lonjakan 40–50 *request submission* dalam jendela 30 detik terakhir tanpa melepaskan koneksi Prisma Neon.
- **NFR-UI-COMPATIBILITY:** Halaman publik siswa mempertahankan kesederhanaan komponen UI murni (bebas dependency berat) agar lancar dibuka pada Android versi lama (Chrome v90+).

---

## 4. DEKOMPOSISI EPICS & RENCANA SPRINT (`bmad-create-epics-and-stories` + `bmad-sprint-planning`)

Roadmap dipecah menjadi 3 Sprint terukur:

```
┌─────────────────────────────────────────────────────────────┐
│ SPRINT 1: Hardening & Security (Pondasi & Quick Wins)       │
│ • Housekeeping repo & git hygiene                           │
│ • Rate limiting PIN brute force                             │
│ • Unified AI Prompt Engine                                  │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ SPRINT 2: Classroom Exam & Resilience (Fitur Utama Kelas)   │
│ • Scheduled Window (validFrom / validUntil)                 │
│ • LocalStorage Autosave & Crash Recovery                    │
│ • Room PIN / Simplified Verification                        │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ SPRINT 3: Expanded Assessment (Esai & Koreksi Guru)         │
│ • Schema & Editor Soal Isian Singkat & Esai                 │
│ • Lembar Periksa Jawaban Esai Guru                          │
│ • Draf Saran Nilai Esai berbasis Gemini (Opsional)          │
└─────────────────────────────────────────────────────────────┘
```

---

### SPRINT 1: Hardening, Keamanan & Housekeeping (Estimasi: 1 Minggu)
*Fokus: Mengamankan sistem yang ada, menutup celah keamanan, dan menata repositori.*

#### Story 1.1: Pembersihan Repositori & Higienitas Git
- **Deskripsi:** Sebagai pengembang, saya ingin membersihkan artefak sementara agar riwayat git tetap bersih dan tidak membebani build server.
- **Acceptance Criteria (AC):**
  - File `_tmp_pin_actions.py` dihapus dari root.
  - Folder `problem/` dan `_ppt_sample/` didaftarkan ke `.gitignore`.
  - Berkas skills BMad (`.agents/skills/`) dipastikan status komitmennya (di-commit sebagai dependensi tim atau di-ignore).

#### Story 1.2: Rate Limiting Percobaan PIN Publik
- **Deskripsi:** Sebagai guru, saya ingin tebakan PIN dibatasi agar siswa lain tidak bisa melakukan brute-force PIN 4-digit teman sekelasnya.
- **Acceptance Criteria (AC):**
  - Endpoint `startAttemptAction` membatasi maksimal 5 kali kegagalan PIN per IP/Token dalam 1 menit.
  - Percobaan ke-6 menghasilkan pesan error *"Terlalu banyak percobaan salah. Tunggu 1 menit."* tanpa membebani database.

#### Story 1.3: Penyatuan Engine AI Quiz (Unified Prompt Builder)
- **Deskripsi:** Sebagai pengembang, saya ingin generator soal AI dan ekstraktor dokumen menggunakan satu fungsi sentral agar konsisten saat terjadi peningkatan model AI.
- **Acceptance Criteria (AC):**
  - Fungsi sanitasi, skema JSON output zod, dan instruksi kurikulum digabungkan dalam helper terpusat `quiz-ai.service.ts`.

---

### SPRINT 2: Ujian Terjadwal & Ketahanan Jaringan (Estimasi: 1–2 Minggu)
*Fokus: Memastikan kuis siap dipakai untuk ulangan serentak di kelas.*

#### Story 2.1: Pengaturan Jadwal Kuis Terbuka (Scheduled Window)
- **Deskripsi:** Sebagai guru, saya ingin mengatur jam kuis mulai dan berakhir agar siswa hanya dapat mengerjakan saat ulangan kelas berlangsung.
- **Acceptance Criteria (AC):**
  - Model `Quiz` menambahkan field opsional `validFrom: DateTime?`.
  - Jika siswa membuka tautan kuis sebelum `validFrom`, layar menunjukkan status jadwal dan timer hitung mundur.
  - Siswa yang mulai terlambat mendapatkan durasi waktu yang dipotong otomatis sesuai batas `deadline`/`validUntil`.

#### Story 2.2: Autosave Jawaban Siswa (Offline-Resilient Recovery)
- **Deskripsi:** Sebagai siswa, saya ingin jawaban saya tetap tersimpan meskipun koneksi internet terputus atau halaman ter-refresh secara tidak sengaja.
- **Acceptance Criteria (AC):**
  - Setiap perubahan opsi jawaban langsung disimpan di `localStorage`.
  - Saat halaman dimuat ulang, aplikasi membaca data dari `localStorage` dan merestorasi status jawaban siswa seketika.
  - Data `localStorage` otomatis dibersihkan setelah submit berhasil diverifikasi oleh server.

#### Story 2.3: Pilihan Mode Kode Kelas (Room PIN)
- **Deskripsi:** Sebagai guru, saya ingin opsi membagikan 1 kode kuis yang sama untuk satu kelas agar saya tidak perlu menyalin 40 PIN individual ke grup WhatsApp.
- **Acceptance Criteria (AC):**
  - Guru dapat memilih mode akses: `INDIVIDUAL_PIN` atau `CLASSROOM_PIN`.
  - Pada mode `CLASSROOM_PIN`, sistem menghasilkan 1 kode 6-digit yang dapat ditampilkan guru di proyektor kelas.

---

### SPRINT 3: Soal Esai & Antrean Penilaian Guru (Estimasi: 2 Minggu)
*Fokus: Memperluas ragam asesmen untuk mata pelajaran non-eksakta.*

#### Story 3.1: Dukungan Soal Esai di Builder Kuis
- **Deskripsi:** Sebagai guru, saya ingin menambahkan soal uraian dan isian singkat di builder kuis dengan menentukan rubrik pedoman penskoran.
- **Acceptance Criteria (AC):**
  - `QuizQuestionType` mendukung `SHORT_ANSWER` dan `ESSAY`.
  - Editor soal memungkinkan pengisian pedoman jawaban/kunci jawaban esai.

#### Story 3.2: Antrean Penilaian Manual Guru (Teacher Grading Sheet)
- **Deskripsi:** Sebagai guru, saya ingin memeriksa lembar jawaban esai siswa satu per satu, memberikan skor poin parsial, serta mencatat umpan balik.
- **Acceptance Criteria (AC):**
  - Status attempt kuis menjadi `PENDING_REVIEW` sampai guru menyelesaikan koreksi esai.
  - Terdapat UI khusus koreksi esai di detail kuis guru dengan input skor 0 s.d. poin maksimal soal.
  - Nilai akhir teragregasi otomatis dan dapat diterbitkan ke Gradebook.

---

## 5. AUDIT TEKNIS, ARSITEKTUR & KEAMANAN (`bmad-code-review`)

### 5.1 Evaluasi Arsitektur yang Berjalan
1. **Keputusan Snapshot JSON (`QuizAttempt.questionOrder`):**
   - **Evaluasi:** **Sangat Tepat (Architectural Win).**
   - Pendekatan ini memotong dependensi langsung antara pengerjaan siswa dengan baris tabel `QuizQuestion`. Guru bebas melakukan perbaikan typo atau penghapusan soal tanpa merusak integritas lembar jawaban siswa yang sudah selesai.
2. **Pemisahan Logika Murni (`quiz.service.ts`):**
   - **Evaluasi:** **Sangat Baik.**
   - Fungsi `shuffleOptions`, `buildAttemptSnapshot`, dan `gradeAttempt` bersifat deterministik dan bebas dependensi I/O. Ini adalah alasan utama test suite kuis dapat dijalankan secara instan dan andal.

### 5.2 Analisis Titik Risiko & Mitigasi
1. **Risiko Lonjakan Database Pool (Neon Connection Exhaustion):**
   - *Kondisi:* Pada akhir ujian serentak, 30–40 siswa akan menekan tombol submit dalam waktu bersamaan.
   - *Mitigasi:* Hindari pemanggilan query Prisma berantai di dalam loop. Pastikan proses penyimpanan jawaban menggunakan transaksi `prisma.$transaction` atau batch `createMany` dengan connection timeout yang aman.
2. **Arbitrary Class pada Tailwind CSS v4:**
   - *Pelajaran dari Bug #4:* Class arbitrary dinamis seperti `max-h-[85vh]` terbukti tidak ter-compile ke dalam CSS bundle jika tidak terdeteksi oleh static scanner.
   - *Aturan:* Untuk properti tata letak kritis pada modal/dialog, selalu gunakan inline style murni (`style={{ maxHeight: '85vh', overflowY: 'auto' }}`) atau pastikan class masuk dalam whitelist template.
3. **Kerahasiaan Data pada Endpoint Publik `/q/[token]`:**
   - *Verifikasi:* Verifikasi kembali bahwa serializer view publik (`PublicQuizView`) tidak pernah membocorkan `correctIndex`, `explanation`, atau data pribadi siswa lain (seperti NISN/PIN) saat mengembalikan daftar roster kelas.

---

## 6. MATRIKS KEPUTUSAN & TINDAKAN PRIORITAS

Berikut adalah panduan keputusan terstruktur untuk disepakati:

| No | Area / Topik | Status Saat Ini | Opsi Keputusan yang Direkomendasikan | Dampak / Manfaat |
|---|---|---|---|---|
| **1** | **Kebijakan PIN Siswa** | PIN unik 4-digit per siswa per kuis. | Tambahkan opsi **"Kode Kelas (Room PIN)"** untuk ujian serentak di kelas. | Mengurangi 90% komplain guru terkait repotnya membagikan PIN per siswa. |
| **2** | **Arah Fase 2 Kuis** | Belum ada jadwal serentak. | Implementasikan **Skenario A (Jendela Ujian Terjadwal + Autosave Lokal)**. | Membuka adopsi ulangan harian resmi di sekolah tanpa takut mati koneksi. |
| **3** | **Kuis Live ala Kahoot** | Terbuka di backlog. | **Tunda ke Fase 3 (Deprioritized).** | Menghemat bandwidth arsitektur dan menghindari kebutuhan server WebSocket eksternal. |
| **4** | **Fitur PPT v3** | Renderer rasterisasi HTML stabil; AI image nonaktif di `.env`. | **Pertahankan konfigurasi saat ini** sampai ada anggaran billing API Gemini berbayar. | Mencegah runtime error pada pengguna umum akibat kuota gratis Google habis. |
| **5** | **Housekeeping Repositori** | Ada skrip temp dan folder uji coba tak terlacak. | Eksekusi Sprint 1 Story 1.1 (`.gitignore` dan cleanup berkas sementara). | Repositori bersih, rapi, dan aman dari kebocoran data uji coba. |

---

*Dokumen ini disusun untuk panduan sprint planning dan pengembangan arsitektur lanjutan AI Teacher Assistant.*
