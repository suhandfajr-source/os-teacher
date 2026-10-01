# OS Teacher: Master Blueprint UI/UX (4 Ruang Kerja Terpadu)

> **Dokumen Arsitektur & Spesifikasi Desain BMad (Sally - UX Designer)**  
> **Target:** Transformasi Holistik Workspace Kelas & Daily Teaching  
> **Status:** Approved & Ready for Phased Execution  

---

## 1. Visi & Filosofi Desain

Aplikasi bertransformasi dari antarmuka administratif terfragmentasi (13 tab horizontal berderet) menjadi **OS Teacher** yang ergonomis, berbasis dua mode mental guru:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ PETA DUA DUNIA PENGALAMAN GURU (THE TWO CORE MODES)                                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ ⚡ MODE 1: LIVE TEACHING SESSION (/kelas/[id]/pertemuan/[sessionId])                │ │
│ │ • Konteks: Guru sedang berdiri di kelas (Waktu terbatas 2-5 menit).                │ │
│ │ • Tata Letak: Sticky Header + Jurnal di Atas + Presensi Cepat (Pill Toggles) di Bawah│ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
│                                        ▲                                               │
│                                        │ (Dipicu dari Tombol "Mulai Sesi")             │
│                                        ▼                                               │
│ ┌────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 🏛️ MODE 2: CLASS WORKSPACE & REVIEW (/kelas/[id])                                   │ │
│ │ • Konteks: Guru sedang mengelola kelas, merekap data, atau mengevaluasi siswa.      │ │
│ │ • Tata Letak: 4 Ruang Kerja Terpadu (Mengajar, Nilai, Siswa & Ortu, Administrasi).   │ │
│ └────────────────────────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Spesifikasi Mode 1: Live Teaching Session (`/kelas/[id]/pertemuan/[sessionId]`)

### A. Struktur Antarmuka
1. **Top Sticky Bar:**
   - Judul Sesi & Kelas
   - Tombol Keluar & Tombol Utama `[ 🔒 Selesaikan & Kunci Sesi ]`
2. **Kartu Atas: Jurnal & Materi Hari Ini (~200px - Fixed & Visible)**
   - Input `actualTopic` (Wajib untuk menyelesaikan sesi)
   - Input `plannedTopic` (Referensi rencana)
   - Textarea `activitySummary` (Ringkasan kegiatan kelas)
   - Tombol `[ ✨ Buat Catatan Otomatis via AI ]`
   - Tombol `[ 💾 Simpan Draf Jurnal ]`
3. **Kartu Bawah: Presensi Cepat Siswa (Quick Attendance Toggles)**
   - Bar Aksi Cepat: `[ ✅ Tandai Semua Hadir ]` + Counter Status (`Hadir`, `Sakit`, `Izin`, `Alpa`, `Terlambat`)
   - Pill Toggle Interaktif per siswa: `[ H ] [ S ] [ I ] [ A ] [ T ]`
   - Catatan individual per siswa
   - Tombol `[ 💾 Simpan Presensi Saja ]`

---

## 3. Spesifikasi Mode 2: 4 Ruang Kerja Kelas Terpadu (`/kelas/[id]`)

### 🏛️ Ruang Kerja 1: RUANG MENGAJAR
* **Fokus:** Sesi hari ini & Riwayat pertemuan terpadu.
* **Sub-Pills:**
  - `Ringkasan & Timeline Pertemuan` (`/kelas/[id]`)
  - `Daftar Sesi` (`/kelas/[id]/pertemuan`)
  - `Rekap Kehadiran` (`/kelas/[id]/absensi`)
  - `Jurnal Mengajar` (`/kelas/[id]/jurnal`)
* **Fitur Utama:** Hero Sesi Hari Ini, Metrik Capaian Pertemuan (X/16 Selesai), Tabel Riwayat Mengajar Terpadu.

### 🏛️ Ruang Kerja 2: NILAI & EVALUASI
* **Fokus:** Buku nilai, tugas kelas, dan bobot evaluasi.
* **Sub-Pills:**
  - `Buku Nilai Terpadu` (`/kelas/[id]/penilaian`)
  - `Tugas Siswa` (`/kelas/[id]/tugas`)
  - `Pengaturan Bobot Nilai` (`/kelas/[id]/pengaturan-nilai`)
* **Fitur Utama:** Matriks Buku Nilai Berjalan dengan Sticky Nama Siswa, Ringkasan Ketuntasan KKTP & Remedial Flag, Antrean Tugas Masuk.

### 🏛️ Ruang Kerja 3: SISWA & KOMUNIKASI
* **Fokus:** Roster siswa & Manajemen Akun Portal Orang Tua (Sesuai Backend).
* **Sub-Pills:**
  - `Daftar Siswa & Status 360` (`/kelas/[id]` / `/kelas/[id]#roster`)
  - `Monitoring Belajar` (`/kelas/[id]/monitoring`)
  - `Akses & Akun Orang Tua` (`/kelas/[id]/orang-tua`)
* **Fitur Utama:** Tabel Roster Cerdas dengan indikator kehadiran % & nilai rata-rata, Manajemen Undangan Email & Token Akun Orang Tua (`/parent/undangan/[token]`).

### 🏛️ Ruang Kerja 4: ADMINISTRASI & RAPOR
* **Fokus:** Capaian Kurikulum CP/TP, Ekspor Rapor, dan Impor Data.
* **Sub-Pills:**
  - `Capaian CP / TP` (`/kelas/[id]/akademik`)
  - `Rekap Nilai Rapor` (`/kelas/[id]/laporan`)
  - `Pusat Impor Data Excel` (`/kelas/[id]/import`)
* **Fitur Utama:** Tampilan spesifik kelas (tanpa dropdown ganda), Ekspor Excel & PDF satu klik, Wizard Impor Data.

---

## 4. Rencana Eksekusi Bertahap (Phased Execution Plan)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ TAHAP 1: KONSOLIDASI TAB KELAS (KelasTabs.tsx)                                         │
│ • Ubah 13 tab flat menjadi 4 Parent Workspaces + Sub-Pills Responsif                   │
│ • Bersihkan duplikasi render KelasTabs di sub-halaman                                  │
│ • Verifikasi 100% Backward Compatibility untuk semua sub-rute                          │
│                                                                                        │
│ TAHAP 2: LIVE TEACHING ERGONOMICS (SessionClient.tsx)                                  │
│ • Terapkan Top Sticky Bar + Jurnal di Atas + Presensi Cepat di Bawah                   │
│ • Terapkan Tombol "Tandai Semua Hadir" + Pill Toggles H/S/I/A/T                        │
│                                                                                        │
│ TAHAP 3: UNIFIED TEACHING LOG (Ruang Mengajar)                                         │
│ • Gabungkan timeline pertemuan, presensi, dan jurnal pada halaman utama kelas          │
│                                                                                        │
│ TAHAP 4: POLISHING NILAI, SISWA & ADMINISTRASI                                         │
│ • Sempurnakan tabel buku nilai & integrasi sub-pills orang tua dan laporan             │
└────────────────────────────────────────────────────────────────────────────────────────┘
```
