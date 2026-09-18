# OS Teacher: Master Report Desain Sistem Global UI/UX (Modern Edu-Teal Edition)

> **Dokumen Spesifikasi Desain & Panduan Arsitektur UI/UX BMad**  
> **Versi:** 3.0 (Official Design System Standard)  
> **Penulis:** Sally (UX Designer & UI Specialist) bersama Tim BMad (Winston - Architect, Mary - Analyst, Amelia - Dev, John - PM)  
> **Status:** Approved by User & Ready for Execution  

---

## 1. Visi & Filosofi Desain (*The Modern Edu-Teal Philosophy*)

Aplikasi **OS Teacher** mengadopsi standar visual **Modern Edu-Teal & Soft Mint Canvas**. Filosofi ini dirancang untuk:
1. **Menghilangkan Kesan Kaku & Birokratis:** Memutus stigma software administrasi kuno, bertransformasi menjadi *Personal Teacher Operating System* yang estetik, modern, dan bernuansa *Gen-Z product* (terinspirasi dari platform kelas dunia seperti Linear, Notion, dan Duolingo).
2. **Kenyamanan Mata Menatap Layar Seharian (*Zero Eye Fatigue*):** Mengganti warna putih polos menyilaukan (*stark white*) dengan latar *Soft Pearl-Mint Canvas* yang menyejukkan retina mata saat guru merekap nilai dan menyusun kurikulum.
3. **Sentuhan Ramah & Taktil (*Humanist Touch*):** Menggunakan sudut melengkung lembut (`rounded-2xl` / 16px), gradasi AI halus, dan umpan balik sentuhan (*active micro-scale*) yang memuaskan.

---

## 2. Peta 8 Pilar Desain Sistem Global

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ PETA 8 PILAR DESAIN SISTEM OS TEACHER (MODERN EDU-TEAL)                                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                             │
│ 1.  WARNA SEMANTIK       ──► Deep Pine Teal (#0F766E), Soft Mint (#CCFBF1), AI Violet-Indigo (#6366F1).     │
│ 2. ☁️ CANVAS NON-STARK    ──► Soft Pearl-Mint / Tinted Slate (#F6F8F8) + Kartu Putih Bersih (#FFFFFF).       │
│ 3. ✍️ TIPOGRAFI           ──► Plus Jakarta Sans (Ramah, Humanis, Geometris & Angka Presisi).                │
│ 4.  BENTUK & KELENGKUNGAN ──► Sudut Kartu Melengkung Lembut (`rounded-2xl` / 16px) & Pill Kapsul.          │
│ 5. ⚡ HIERARKI TOMBOL      ──► Primary Teal, AI Gradient Sparkle, Soft Mint Secondary, Pill Toggles (44px).  │
│ 6.  NAVIGASI KELAS      ──► Container 4 Ruang Kerja (Soft Mint) + Sub-Pills Kapsul Kontekstual.           │
│ 7.  ERGONOMI HP / MODE 1 ──► Thumb-Zone Architecture + Sticky Bottom Action Bar (Presensi 1 Tangan).        │
│ 8.  PAKET 3-IN-1 DOKUMEN ──► Ekspor Resmi Otomatis: ATP (Word), PROTA (Word), PROSEM (Excel Bergaris).    │
│                                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Spesifikasi Detail 8 Pilar Desain

### Pilar 1: Palet Warna & Token Semantik (*Color Tokens*)

| Token Semantik | Kode Warna / Tailwind | Peran & Makna Visual |
| :--- | :---: | :--- |
| **Primary Brand (Deep Teal)** | `#0F766E` / `teal-700` | Identitas utama sekolah, tombol aksi primer, header aktif. Kontras tinggi (WCAG AAA). |
| **Light Highlight (Soft Mint)** | `#F0FDFA` / `#CCFBF1` | Latar kartu aktif, chip status terpilih, hover baris tabel data. |
| **AI Co-Pilot Gradient** | `from-teal-600 to-indigo-600` | Fitur kecerdasan buatan, tombol generate otomatis, dan badge otomatisasi. |
| **Education Emerald** | `#10B981` / `emerald-600` | Kehadiran penuh (Hadir), kelulusan KKTP, dan data berhasil disimpan. |
| **Attention Warm Amber** | `#F59E0B` / `amber-500` | Tugas butuh koreksi, Sumatif Tengah Semester (STS), dan antrean nilai. |
| **Soft Coral Red** | `#EF4444` / `rose-500` | Status Alpa/Tidak Hadir, aksi hapus permanen, dan notifikasi kritis. |
| **Info Sky Blue** | `#0284C7` / `sky-600` | Status Izin, Sumatif Akhir Semester (SAS), dan dokumen referensi. |

---

### Pilar 2: Latar Belakang & Kedalaman (*Canvas & Depth Hierarchy*)

* **Background Layar Utama & Sidebar:** Berwarna **Soft Pearl-Mint / Tinted Slate** (`#F6F8F8` atau `#F4F7F6`). Memberikan rasa teduh dan menghilangkan efek silau putih mentah.
* **Kartu Konten & Container Data:** Berwarna **Pure White** (`#FFFFFF`) yang diletakkan di atas latar Pearl-Mint.
* **Hasil Visual:** Menghasilkan efek timbul alami (*natural visual layering*) yang elegan tanpa perlu bayangan tebal yang kotor.
* **Bayangan Halus (*Elevation*):** Menggunakan `shadow-2xs` (`0 1px 2px 0 rgb(0 0 0 / 0.03)`) untuk kesan melayang ringan.

---

### Pilar 3: Tipografi & Hierarki Teks (*Typography Scale*)

* **Font Utama:** **Inter / Geist** (dengan fallback modern system-sans: Segoe UI / Apple System).
* **Karakteristik:** Memiliki ketajaman presisi tinggi, garis huruf super bersih (*Silicon Valley Minimalist Precision*), dan bentuk angka (1-9) yang sangat rapi untuk buku nilai, jadwal, dan tabel matriks.

| Skala Tipografi | Ukuran & Weight | Penerapan dalam Aplikasi |
| :--- | :---: | :--- |
| **Display / Page Title** | `22–24px` Bold | Judul halaman utama (Beranda, Detail Kelas, Akademik). |
| **Card Title / Section** | `16–18px` Semi-Bold | Judul kartu ringkasan, nama mata pelajaran, nama modul. |
| **Body Text (Standar)** | `13–14px` Regular/Medium | Teks deskripsi, label formulir, instruksi materi. |
| **Data Grid & Badges** | `11–12px` Semi-Bold | Angka JP pada tabel, badge status kehadiran, tanggal. |
| **Micro Caption** | `10–11px` Medium | Tooltip, sub-keterangan, waktu sesi. |

---

### Pilar 4: Bentuk, Sudut & Geometri (*Corner Geometry*)

* **Container & Kartu Utama:** `rounded-2xl` (`16px`) — Melengkung lembut, modern, dan ramah.
* **Dialog Modal & Floating Panels:** `rounded-3xl` (`20–24px`).
* **Tombol Aksi & Input Form:** `rounded-xl` (`12px`) — Presisi dan mudah diklik.
* **Pills, Chip Status & Toggle Presensi:** `rounded-full` (Kapsul melingkar penuh) — Sangat ramah untuk layar sentuh HP.

---

### Pilar 5: Hierarki Tombol & Micro-Interactions

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ HIERARKI TOMBOL (BUTTON DESIGN SYSTEM)                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│ 1. PRIMARY BUTTON:                                                              │
│    `bg-teal-700 hover:bg-teal-800 text-white font-semibold rounded-xl shadow-xs` │
│    Contoh: [ ▶️ Mulai Sesi Mengajar ], [ 💾 Simpan Matriks ]                    │
│                                                                                 │
│ 2. AI CO-PILOT BUTTON (GRADASI BERKILAU):                                       │
│    `bg-gradient-to-r from-teal-600 via-teal-500 to-indigo-600 text-white shadow`│
│    Contoh: [ ✨ Susun Ulang via AI ], [ 🤖 Mulai AI Generator ]                 │
│                                                                                 │
│ 3. SECONDARY / SOFT OUTLINE BUTTON:                                             │
│    `bg-teal-50/80 hover:bg-teal-100 text-teal-800 border border-teal-200`       │
│    Contoh: [ + Tambah Bab ], [ 📊 Unduh Excel ], [ 📄 Unduh Word ]              │
│                                                                                 │
│ 4. TACTILE CLICK FEEDBACK:                                                      │
│    Semua tombol memiliki efek `active:scale-[0.98] transition-transform`        │
│    yang memberi sensasi membal fisik saat ditekan.                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Pilar 6: Navigasi 4 Ruang Kerja Kelas (`KelasTabs.tsx`)

* **Level 1 (4 Tab Utama):** 
  Wadah berkapsul `bg-teal-50/70 border border-teal-100 p-1.5 rounded-2xl`.
  Tab aktif berubah menjadi kartu putih bersih `bg-white text-teal-900 font-bold shadow-2xs border border-teal-200/80`.
* **Level 2 (Sub-Pills Kontekstual):** 
  Pill kapsul `rounded-full`. Sub-pill aktif menggunakan `bg-teal-700 text-white font-semibold shadow-xs`. Sub-pill pasif menggunakan `bg-teal-50/50 text-teal-800 hover:bg-teal-100/70`.

---

### Pilar 7: Ergonomi Mobile & Handheld (Mode 1 Live Teaching)

* **Thumb-Zone Architecture:**
  Di layar HP/Tablet, area bawah layar dialokasikan untuk tombol tindakan cepat jempol:
  - Tombol `[ ✅ Tandai Semua Hadir ]` & `[ 💾 Selesaikan Sesi ]` melayang di bagian bawah (*Sticky Bottom Bar*).
  - Pill toggle presensi `[ H ] [ S ] [ I ] [ A ] [ T ]` berukuran **44px × 44px** dengan warna semantik kontras tinggi.
* **Isolasi Mode 1:**
  Tab navigasi umum otomatis disembunyikan saat masuk ke layar sesi mengajar langsung agar guru fokus 100% pada siswa di kelas.

---

### Pilar 8: Paket Trilogi Dokumen Administrasi Cetak Resmi

Sistem menyediakan 3 format dokumen resmi siap cetak untuk diserahkan ke Waka Kurikulum:

1. **📄 Alur Tujuan Pembelajaran (ATP) — Word (`.docx`):** Tabel pemetaan CP, elemen, materi pokok, JP, dan Profil Pelajar Pancasila lengkap dengan kop dan tanda tangan Kepala Sekolah.
2. **📄 Program Tahunan (PROTA) — Word (`.docx`):** Tabel alokasi jam pembelajaran semester 1 & 2.
3. **📊 Program Semester (PROSEM) — Excel (`.xlsx`):** Matriks mingguan resmi bergaris lengkap (*full gridlines*), warna kategori STS/SAS, dan rumus total jam otomatis.

---

## 4. Langkah Eksekusi Kode Bertahap (*Phased Execution Plan*)

```text
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 3 LANGKAH EKSEKUSI PEMBARUAN TEMA (ZERO REGRESSION)                                                         │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                             │
│ 🚀 TAHAP 1: PEMBARUAN CSS TOKENS & CANVAS GLOBAL                                                            │
│ • Perbarui `src/app/globals.css` dengan variabel Modern Edu-Teal, Soft Mint, dan Pearl Canvas.              │
│ • Pasang font Plus Jakarta Sans / Google Font stack di `layout.tsx`.                                        │
│                                                                                                             │
│ 🎨 TAHAP 2: PEMBARUAN KOMPONEN KELAS & TOMBOL (KelasTabs, Ruang Mengajar, Button Styles)                    │
│ • Terapkan gaya kartu melengkung lembut (`rounded-2xl`) dan gradasi AI pada tombol generator.               │
│ • Perbarui warna badge dan pill toggle presensi (Mode 1).                                                   │
│                                                                                                             │
│ 📄 TAHAP 3: PEMBUATAN ENDPOINT EKSPOR DOKUMEN ATP (.docx)                                                   │
│ • Tambahkan fungsi `exportAtpToDocx` di `src/modules/academic/academic.export.ts`.                           │
│ • Pasang endpoint `/api/reports/export/atp-docx` dan tombol `[ 📄 Unduh ATP (.docx) ]` di halaman Akademik. │
│ • Verifikasi akhir: `npm run build` dan `npm test` lulus 100%.                                              │
│                                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---
*Dokumen Master Report ini telah disetujui dan menjadi acuan resmi implementasi sistem.*
