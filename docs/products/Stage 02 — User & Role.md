# Stage 02 — User & Role
## AI Teacher Assistant

## 1. Tujuan Stage

Menentukan siapa pengguna utama aplikasi dan batas aksesnya.

Aplikasi difokuskan sebagai **AI Teacher Assistant**, bukan sistem manajemen sekolah penuh.

---

# 2. Role Utama

Hanya ada 2 role utama:

```text
01. GURU
02. ORANG TUA / WALI MURID
```

Pihak seperti:

- Wali Kelas
- Kurikulum
- Akademik
- Kepala Sekolah

tidak menjadi user aplikasi pada tahap awal.

Mereka cukup menerima dokumen atau report yang dihasilkan oleh guru.

---

# 3. Role — Guru

Guru adalah **primary user** aplikasi.

Guru menggunakan sistem untuk membantu pekerjaan:

### Administrasi
- Absensi siswa
- Input nilai
- Jurnal mengajar
- Prota
- Prosem
- RPP / Modul Ajar
- Administrasi rapor

### Pembelajaran
- Merancang pembelajaran
- Membuat materi
- Membuat PPT
- Membuat LKPD
- Membuat worksheet

### Assessment
- Membuat kisi-kisi
- Membuat soal
- Koreksi
- Penilaian
- Analisis hasil belajar
- Remedial

### Monitoring Siswa
- Kehadiran
- Nilai
- Tugas
- Remedial
- Perkembangan akademik
- Catatan siswa

### Reporting
Guru dapat menghasilkan dokumen untuk disetorkan kepada pihak sekolah.

Contoh:

```text
DATA GURU
   ↓
SISTEM
   ↓
GENERATE REPORT / DOCUMENT
   ↓
├── Wali Kelas
├── Kurikulum
├── Akademik
└── Pimpinan
```

Contoh dokumen:

- Rekap absensi
- Rekap nilai
- Jurnal mengajar
- Prota
- Prosem
- Modul Ajar / RPP
- Analisis hasil belajar
- Data remedial
- Laporan perkembangan siswa
- Administrasi rapor

---

# 4. Role — Orang Tua / Wali Murid

Orang tua merupakan **secondary user**.

Orang tua hanya dapat melihat data anaknya sendiri.

Informasi yang dapat diberikan antara lain:

```text
ANAK SAYA

├── Kehadiran
├── Perkembangan Nilai
├── Tugas
├── Remedial
├── Catatan Guru
└── Informasi Perkembangan
```

Orang tua tidak dapat:

- melihat data siswa lain,
- mengubah nilai,
- mengubah absensi,
- mengakses administrasi guru,
- mengakses data internal guru.

---

# 5. Hubungan Antar-Role

```text
GURU
 │
 ├── Mengajar
 ├── Absensi
 ├── Assessment
 ├── Nilai
 ├── Catatan
 └── Monitoring
          │
          ↓
      DATA SISWA
          │
     ┌────┴────┐
     ↓         ↓
  REPORT     ORANG TUA
     │
     ↓
Wali Kelas /
Kurikulum /
Akademik /
Sekolah
```

Perbedaannya:

**Orang tua** melihat informasi melalui aplikasi.

**Pihak sekolah** menerima report atau dokumen dari guru.

---

# 6. Prinsip Akses

Struktur akses dibuat sederhana.

```text
GURU
↓
Data kelas dan siswa yang diajar
```

```text
ORANG TUA
↓
Data anak sendiri
```

Belum diperlukan sistem role dan permission yang kompleks.

---

# 7. Prinsip Produk

Aplikasi menggunakan:

> **Teacher First Approach**

Prioritas utama sistem adalah mengurangi beban kerja guru.

Orang tua menjadi pengguna pendukung untuk membantu komunikasi dan monitoring perkembangan siswa.

Aplikasi tidak diarahkan menjadi:

- SIS sekolah,
- ERP sekolah,
- LMS penuh,
- sistem manajemen akademik sekolah.

---

# 8. Keputusan Final Stage 02

```text
PRIMARY USER

Guru
```

```text
SECONDARY USER

Orang Tua / Wali Murid
```

Sedangkan:

```text
Wali Kelas
Kurikulum
Akademik
Kepala Sekolah
```

diposisikan sebagai:

```text
REPORT RECIPIENT
```

bukan user aplikasi.

---

# 9. Status

```text
01. PRODUCT PROBLEM                 ✅
        ↓
02. USER & ROLE                     ✅
        ↓
03. USER JOURNEY / BUSINESS PROCESS ← NEXT
        ↓
04. SYSTEM & MODULE ARCHITECTURE
        ↓
05. DATA MODEL
        ↓
06. BUSINESS RULE
        ↓
07. UX FLOW & INFORMATION ARCHITECTURE
        ↓
08. UI DESIGN SYSTEM & SCREEN DESIGN
        ↓
09. PRD / DEVELOPMENT STAGES
        ↓
10. DEVELOPMENT
        ↓
11. TESTING / QA
        ↓
12. PRODUCTION
        ↓
13. ITERATION
```

**STAGE 02 — USER & ROLE: COMPLETE**