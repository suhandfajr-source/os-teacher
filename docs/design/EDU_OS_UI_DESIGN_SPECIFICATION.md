# KLASSA EDU-OS: SPESIFIKASI & GARIS BESAR DESAIN UI/UX LENGKAP

> **Dokumen Master Arsitektur Desain Sistem & Spesifikasi Antarmuka BMad**  
> **Acuan Prototipe:** `docs/preview-edu-os-full.html` & `public/preview-edu-os-full.html`  
> **Disusun Oleh:** Sally (UX Designer & UI Specialist) bersama Winston (Architect), Mary (Analyst), dan Amelia (Dev)  
> **Status:** Official Master Specification (Approved & Production-Ready)  

---

## 1. Visi & Filosofi Desain (*The Edu-OS Philosophy*)

**Klassa Edu-OS** mentransformasi sistem administrasi sekolah konvensional yang kaku menjadi **Personal Teacher Operating System** yang berkecepatan tinggi, ergonomis, dan bebas kelelahan mata (*Zero Eye Fatigue*).

### A. Tiga Target Pengguna & Karakteristik Kebutuhan

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PETA MULTI-GENERASI PENGGUNA (TARGET USER ARCHETYPES)                                                  │
├──────────────────────────┬──────────────────────────────────────┬──────────────────────────────────────┤
│ Segmen Pengguna          │ Karakteristik & Kondisi Kerja        │ Kebutuhan Desain Utama               │
├──────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤
│ 👨‍🏫 GURU UTAMA           │ Usia 23–45 tahun. Sangat sibuk,      │ • Kecepatan aksi tinggi (< 5 detik)  │
│ (Primary Persona)        │ mobilitas tinggi di ruang kelas nyata│ • Presensi 1-ketukan [H][S][I][A]    │
│                          │ dan butuh rekap nilai tanpa lembur.  │ • Freeze column roster nama siswa    │
│                          │                                      │ • Command Palette instan (Ctrl + K)  │
├──────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤
│ 👨‍👩‍👦 ORANG TUA          │ Usia 30–45 tahun. Membuka aplikasi   │ • Antarmuka ramah mobile (WhatsApp)  │
│ (Secondary Persona)      │ via smartphone di sela kesibukan     │ • Status kehadiran real-time         │
│                          │ bekerja, butuh transparansi santun.  │ • 1-Klik lapor surat izin dokter WA  │
├──────────────────────────┼──────────────────────────────────────┼──────────────────────────────────────┤
│ 🎒 SISWA SD – SMA        │ Usia 7–18 tahun (Gen-Z & Alpha).     │ • Antarmuka kuis bersih & to-the-pt  │
│ (Tertiary Persona)       │ Menyukai umpan balik cepat dan       │ • Status tugas jelas tanpa distraksi │
│                          │ elemen gamifikasi yang memotivasi.   │ • Papan capaian & streak belajar     │
└──────────────────────────┴──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 2. Peta 8 Pilar Desain Sistem Visual (*Design Tokens*)

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 8 PILAR DESAIN SISTEM EDU-OS                                                                                │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. 🌲 PALET SEMANTIK      ──► Deep Pine Teal (#0F766E), Soft Mint (#CCFBF1), AI Indigo-Violet (#6366F1)     │
│ 2. ☁️ KANVAS ANTI-LELAH   ──► Soft Pearl-Mint (#F6F8F8) + Pure White Cards (#FFFFFF) [Zero Eye Fatigue]   │
│ 3. ✍️ TIPOGRAFI PRESISI   ──► Plus Jakarta Sans (Angka tabular geometris rapi untuk nilai dan jadwal)    │
│ 4. 🔘 GEOMETRI RAMAH      ──► Sudut rounded-2xl (16px), rounded-3xl (24px), dan Pill Capsules            │
│ 5. ⚡ HIERARKI TOMBOL     ──► Primary Teal, AI Sparkle Gradient, Soft Outline, Tactile Active Scale (0.97)│
│ 6. 🧭 NAVIGASI EDU-OS     ──► Sidebar Modular 4 Kategori + Command Palette Cepat (Ctrl + K Spotlight)       │
│ 7. 📱 DUA MODE GURU       ──► Mode 1: Live Teaching Session (<10s) vs Mode 2: Class Workspace Review      │
│ 8. 📊 MATRIKS DATA LEBAR  ──► Freeze Kolom Nama Siswa (sticky left-0) pada Buku Nilai & Matriks PROSEM     │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### A. Palet Warna & Token Semantik (*Color Tokens*)

| Token Semantik | Kode Hex / CSS | Makna & Penggunaan |
| :--- | :---: | :--- |
| **Primary Brand (Deep Teal)** | `#0F766E` | Tombol utama, header status aktif, identitas utama sekolah (WCAG AAA). |
| **Canvas Background (Pearl-Mint)** | `#F6F8F8` | Latar belakang seluruh layar; sejuk di mata seharian, mencegah silau. |
| **Card Surface (Crisp White)** | `#FFFFFF` | Latar kartu informasi dan tabel data di atas kanvas Pearl-Mint. |
| **Highlight Accent (Soft Mint)** | `#CCFBF1` / `#F0FDFA` | Chip status aktif, hover baris tabel, badge informasi kelas. |
| **AI Co-Pilot Gradient** | `#6366F1` ➔ `#0D9488` | Tombol generate otomatis AI, prompt omnibar, fitur cerdas. |
| **Success Emerald** | `#10B981` | Status kehadiran Hadir (H), kelulusan KKTP, data tersimpan. |
| **Attention Amber** | `#F59E0B` | Status Sakit (S), antrean tugas perlu dinilai, remedial flag. |
| **Info Sky Blue** | `#0284C7` | Status Izin (I), dokumen referensi silabus, token terhubung. |
| **Alert Coral Rose** | `#EF4444` | Status Alpa (A), nilai kritis di bawah standar, aksi destruktif. |

---

## 3. Arsitektur Tata Letak & Navigasi (*Layout Architecture*)

### A. Struktur Tampilan Layar (Dua Kolom: Sidebar + Content Area)

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STRUKTUR UTAMA APLIKASI (SHELL ARCHITECTURE)                                                           │
├───────────────────┬────────────────────────────────────────────────────────────────────────────────────┤
│ 🧭 SIDEBAR EDU-OS │ 🖥️ TOP COMMAND BAR (Sticky Header)                                                │
│ (Lebar 256px)     │ • Breadcrumbs Halaman • Status Real-Time • Shortcut [Mulai Sesi] & [AI Studio]     │
│                   ├────────────────────────────────────────────────────────────────────────────────────┤
│ • Logo & Sekolah  │ 📄 DYNAMIC PAGE CONTAINER                                                          │
│ • Quick Search    │                                                                                    │
│   (Ctrl + K)      │ (Area Halaman yang Berubah Sesuai Rute yang Dipilih)                              │
│ • 4 Menu Group    │                                                                                    │
│ • User Profile    │                                                                                    │
└───────────────────┴────────────────────────────────────────────────────────────────────────────────────┘
```

### B. Struktur 4 Kelompok Menu Sidebar

1. **Workspace Utama:**
   - 🏠 `Hari Ini (Beranda)` (`/hari-ini`)
   - 📁 `Daftar Kelas Binaan` (`/kelas`)
   - 🏫 `Kelas VIII-A (Workspace)` (`/kelas/8a`)
   - ⚡ `Mode 1: Live Sesi Mengajar` (`/kelas/8a/pertemuan/12`)
2. **Kurikulum & Asesmen:**
   - 🗓️ `PROTA & PROSEM Engine` (`/akademik`)
   - ❓ `Quiz & Ujian Online` (`/quiz`)
   - 🏆 `Buku Nilai & Tugas` (`/assessment`)
   - 🪄 `AI Studio Generator` (`/ai-studio`)
3. **Siswa & Komunikasi:**
   - 📈 `Monitoring 360° Siswa` (`/monitoring`)
   - 👥 `Direktori Siswa` (`/siswa`)
   - 💬 `Portal Orang Tua (WA Hub)` (`/parent`)
4. **Dokumen & Sistem:**
   - 📊 `Pusat Rekap & Rapor` (`/laporan`)
   - ⚙️ `Pengaturan Sekolah` (`/pengaturan`)

---

## 4. Garis Besar Desain 13 Halaman Inti Proyek

---

### Halaman 1: Beranda Guru (`/hari-ini`)
* **Hero Banner Dinamis:** Menyapa guru (*"Selamat Pagi, Pak Budi! ☕"*), menampilkan status pekan efektif kurikulum, dan tombol 1-klik *"Mulai Sesi Mengajar"*.
* **4 Kartu Metrik Bebas Lelah (*Zero Fatigue Cards*):**
  1. *Jadwal Mengajar Hari Ini:* 2 Sesi (4 JP).
  2. *Kehadiran Siswa Teragregasi:* 97.4% (31/32 Hadir).
  3. *Antrean Koreksi:* 14 Tugas Masuk.
  4. *Status PROSEM:* 100% Valid (32/32 JP).
* **Linimasa Jadwal Pembelajaran:** Kartu kelas aktif hari ini dengan rincian materi rencana, ruang kelas, dan tombol mulai instan.

---

### Halaman 2: Daftar Kelas Binaan (`/kelas`)
* **Kartu Grid Modular Kelas:** Menampilkan kartu terpisah untuk setiap kelas binaan (Kelas VIII-A, VIII-B, IX-A).
* **Indikator Progres:** Menampilkan rasio pertemuan yang telah tuntas (11/16 Sesi), persentase kehadiran berjalan, dan status wali kelas.

---

### Halaman 3: Workspace Detail Kelas (`/kelas/[id]`)
* **Header Konteks Terpadu:** Nama kelas, mata pelajaran, fase kurikulum (Fase D SMP), tahun ajaran, dan jumlah siswa.
* **4 Ruang Kerja Terpadu (`KelasTabs.tsx`):**
  1. **Ruang Mengajar:** Hero sesi aktif, 3 kartu metrik capaian pertemuan, dan linimasa riwayat mengajar terpadu (Pertemuan + Materi + Presensi dalam 1 baris).
  2. **Nilai & Evaluasi:** Matriks buku nilai berjalan dengan kolom Nama Siswa terkunci di sisi kiri (*freeze column* `sticky left-0`).
  3. **Siswa & Ortu:** Integrasi link WhatsApp 1-klik untuk komunikasi langsung dengan wali murid.
  4. **Administrasi & Rapor:** Ringkasan capaian CP/TP dan ekspor resmi PROSEM.

---

### Halaman 4: Mode 1 Live Teaching Session (`/kelas/[id]/pertemuan/[sessionId]`)
* **Konteks:** Guru sedang berdiri di depan kelas dengan keterbatasan waktu (target presensi `< 10 detik`).
* **Top Sticky Action Bar:** Judul sesi, tombol draf, dan tombol utama `[ 🔒 Selesaikan & Kunci Sesi ]`.
* **Bar Presensi Cepat:** Tombol `[ ✅ Tandai Semua Hadir ]` + Counter Status Real-time.
* **Pill Toggle Interaktif Siswa:** Tombol sentuh berbentuk kapsul per siswa `[ H ] [ S ] [ I ] [ A ] [ T ]`.
* **Auto-Open Note Drawer:** Input alasan terbuka otomatis ketika status diubah ke Sakit atau Izin.
* **Kartu Jurnal Terpadu:** Input materi aktual dan ringkasan aktivitas kelas dengan bantuan asisten AI.

---

### Halaman 5: Kurikulum & PROSEM Engine (`/akademik`)
* **Kalkulator Distribusi JP Mingguan:** Menghitung total jam efektif semester (16 Pekan × 2 JP = 32 JP) dan membaginya ke dalam matriks pekan mingguan secara seimbang (*zero manual calculation*).
* **Paket Ekspor Resmi Dinas:**
  - 1-Klik Unduh **PROSEM Matriks Mingguan** bergaris resmi format Excel (`.xlsx`).
  - 1-Klik Unduh **PROTA & Alur Tujuan Pembelajaran (ATP)** format Word siap cetak (`.docx`).

---

### Halaman 6: Quiz & Ujian Online (`/quiz`)
* **Manajemen Bank Soal & Kuis:** Daftar kuis aktif, draf, dan kuis terjadwal.
* **Projector Mode & Room PIN:** Menampilkan nomor PIN ruangan ujian (contoh: `#7821`) untuk diproyeksikan ke layar proyektor kelas saat siswa masuk via URL ujian publik (`/q/[token]`).
* **Live Attempt Tracker & Lembar Koreksi Guru:** Monitoring pengerjaan siswa secara *real-time* dan penilaian soal esai terintegrasi.

---

### Halaman 7: Buku Nilai & Penilaian Tugas (`/assessment`)
* **Antrean Pengumpulan Tugas:** Menampilkan daftar tugas PR dan praktikum yang membutuhkan penilaian guru.
* **Pengaturan Bobot:** Pembagian persentase Formatif TP, Sumatif Tengah Semester (STS), dan Sumatif Akhir Semester (SAS).

---

### Halaman 8: AI Studio Generator (`/ai-studio`)
* **Teacher Prompt Omnibar:** Bilah instruksi kecerdasan buatan berbasis Google Gemini 2.5 Flash.
* **Template Presets:**
  1. *Kuis & Soal HOTS:* Soal pilihan ganda bertingkat penalaran C4 lengkap dengan kunci dan pembahasan.
  2. *Modul Ajar RPP 1 Lembar:* Draf kurikulum standar dinas.
  3. *Analisis Siswa Butuh Remedial:* Rekomendasi materi remedial terarah.
  4. *Draf Pesan Orang Tua:* Format pesan apresiasi/informasi santun via WhatsApp.
* **Live Output Editor:** Hasil draf dapat langsung diedit, disalin, atau diekspor ke Word (`.docx`).

---

### Halaman 9: Monitoring 360° Perkembangan Siswa (`/monitoring`)
* **Deteksi Dini Siswa (*Early Warning System*):** Filter siswa di bawah KKTP (< 75), presensi kritis (< 85%), dan siswa yang membutuhkan tindak lanjut khusus.
* **Ringkasan Ketuntasan Kelas:** Indikator visual persentase siswa tuntas vs butuh bimbingan.

---

### Halaman 10: Direktori Siswa 360° (`/siswa`)
* **Profil Lengkap Siswa:** NISN, data identitas, nomor telepon WhatsApp orang tua/wali, serta riwayat catatan perilaku dan nilai akademik individual.

---

### Halaman 11: Pusat Laporan & Rapor Dinas (`/laporan`)
* **Pusat Ekspor Dokumen Resmi:** Cetak rapor siswa format Kurikulum Merdeka / K13, cetak buku nilai induk, dan ekspor sinkronisasi format Dapodik.

---

### Halaman 12: Portal Akses Orang Tua (`/parent`)
* **Antarmuka Mobile-First untuk Orang Tua:**
  - Status presensi real-time ananda hari ini (Hadir / Sakit / Izin) dengan penanda waktu tepat.
  - Ringkasan nilai kuis terakhir beserta catatan apresiasi dari guru wali kelas.
  - Tombol 1-klik kirim surat izin dokter langsung ke WhatsApp wali kelas.

---

### Halaman 13: Pengaturan Sekolah (`/pengaturan`)
* **Konfigurasi Global:** Pemilihan tahun ajaran & semester aktif, batas Kriteria Ketercapaian Tujuan Pembelajaran (KKTP), dan konfigurasi jadwal KBM sekolah.

---

## 5. Fitur Interaktivitas Global (*Command Palette & Micro-Interactions*)

```text
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ COMMAND PALETTE (CTRL + K SPOTLIGHT SEARCH)                                                            │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                        │
│  🔍 Ketik nama siswa, kelas, jadwal, atau fitur...                     [ ESC untuk tutup ]             │
│  ────────────────────────────────────────────────────────────────────────────────────────────          │
│  • 🏠 Buka Beranda Guru                     /hari-ini                                                  │
│  • 🏫 Kelas VIII-A (Matematika)             Workspace 4 Ruang Kerja                                    │
│  • 🗓️ Perencanaan Kurikulum PROTA & PROSEM  Matriks Mingguan 32 JP                                    │
│  • ❓ Quiz Online & Live Projector PIN      Bank Soal & Koreksi Live                                   │
│  • 💬 Portal Orang Tua (WhatsApp)           Feed & Surat Izin Sakit                                    │
│                                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

* **Keyboard Shortcut `Ctrl + K` (atau `Cmd + K`):** Membuka dialog pencarian cepat universal di seluruh halaman untuk navigasi instan tanpa memindahkan tangan dari keyboard.
* **Tactile Click Feedback:** Semua tombol interaktif menggunakan efek `active:scale-[0.97]` yang memberikan sensasi membal fisik saat disentuh di layar HP maupun diklik dengan mouse.

---

## 6. Standar Aksesibilitas & Kinerja Teknis

1. **Rasio Kontras WCAG AAA:** Teks gelap `#0F172A` di atas kanvas Soft Pearl-Mint `#F6F8F8` menghasilkan kontras tinggi yang nyaman bagi mata saat digunakan seharian.
2. **Ukuran Target Sentuh (*Touch Targets*):**
   - Standar tombol aplikasi: minimal `40px` s.d `44px`.
   - Mode 1 Live Controller: tombol jempol jumbo `56px` untuk kenyamanan pengoperasian satu tangan saat guru berdiri di kelas.
3. **Kinerja Render Next.js 16 App Router:** Seluruh kalkulasi metrik diproses melalui *Server-Side Rendering (SSR)* untuk menjamin *Cumulative Layout Shift* (CLS) `< 0.05` dan *Time to Interactive* (TTI) `< 300ms`.

---

*Dokumen ini merupakan panduan spesifikasi resmi implementasi UI/UX Klassa Edu-OS.*
