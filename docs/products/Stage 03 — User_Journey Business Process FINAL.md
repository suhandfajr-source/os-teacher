# Stage 03 — User Journey & Business Process
## AI Teacher Assistant — Final Revised

## 1. Tujuan Stage

Menentukan bagaimana aplikasi digunakan dalam aktivitas nyata guru sehari-hari hingga menghasilkan analisis dan laporan.

Prinsip utama:

> **Aplikasi harus tetap berguna dengan input minimal, dan semakin pintar ketika semakin banyak konteks tersedia.**

## 2. Konsep Utama Penggunaan

Teacher Assistant tidak mewajibkan guru menyelesaikan seluruh administrasi kurikulum sebelum menggunakan aplikasi.

```text
MINIMUM DATA
Guru + Mapel + Kelas + Siswa
        ↓
APLIKASI SUDAH BISA DIGUNAKAN
        ↓
Aktivitas Guru Berjalan
        ↓
Data Semakin Banyak
        ↓
Analisis Semakin Dalam
        ↓
Report Semakin Lengkap
```

Prinsip:

> **Minimum Input = Immediate Value**  
> **Maximum Context = Maximum Intelligence**

## 3. Minimal Setup

Untuk mulai menggunakan aplikasi, guru cukup menyiapkan:

```text
Guru
+
Mata Pelajaran
+
Kelas
+
Daftar Siswa
```

Dengan data tersebut guru sudah dapat:

- Absensi
- Input nilai
- Membuat soal
- Membuat kunci jawaban
- Membuat materi
- Membuat PPT
- Membuat LKPD / worksheet
- Tracking tugas
- Catatan siswa
- Jurnal mengajar
- Remedial
- Monitoring siswa
- Komunikasi orang tua

Kurikulum, CP, TP, ATP, Prota, dan Prosem **bukan syarat aplikasi dapat digunakan**.

## 4. Progressive Context

### Level 1 — Daily Teacher Assistant

```text
Guru
Kelas
Mapel
Siswa
```

Fokus pada pekerjaan sehari-hari.

### Level 2 — Smart Teacher Workspace

Data mulai terkumpul:

```text
Absensi
+
Materi yang diajarkan
+
Tugas
+
Assessment
+
Nilai
+
Remedial
+
Catatan
```

Sistem mulai menghasilkan monitoring dan insight.

### Level 3 — Full Academic Intelligence

Guru dapat menambahkan:

```text
Kurikulum
CP / TP
ATP
Prota
Prosem
KKTP
Planning
```

Sistem dapat memberikan analisis akademik dan laporan lebih lengkap.

## 5. Core Business Process

```text
PLAN
 ↓
TEACH
 ↓
ASSESS
 ↓
ANALYZE
 ↓
FOLLOW UP
 ↓
MONITOR
 ↓
REPORT
```

Namun guru tidak harus selalu memulai dari PLAN.

Guru dapat langsung:

- Absensi
- Buat soal
- Input nilai
- Buat PPT
- Buat materi
- Buat LKPD
- Melihat siswa

tanpa harus menyelesaikan Prota/Prosem terlebih dahulu.

## 6. Daily Teaching Flow

```text
Guru Login
 ↓
Lihat Aktivitas / Kelas
 ↓
Pilih Kelas
 ↓
Absensi
 ↓
Mengajar
 ↓
Catat Materi / Aktivitas
 ↓
Jurnal Terbentuk
```

Jika sistem sudah mengetahui tanggal, guru, kelas, mata pelajaran, dan siswa, maka informasi tersebut tidak diminta ulang.

## 7. Learning Content Flow

```text
IPA
+
Kelas VIII
+
Sistem Pernapasan
+
2 × 40 menit
        ↓
       AI
        ↓
├── Rekomendasi Pembelajaran
├── Materi
├── PPT
├── LKPD
├── Worksheet
├── Aktivitas
├── Kisi-kisi
├── Soal
└── Kunci Jawaban
```

CP/TP meningkatkan kualitas hasil, tetapi tidak wajib tersedia.

## 8. Assessment Flow — V1 Final

Assessment tetap merupakan satu rangkaian, tetapi **koreksi dilakukan manual oleh guru**.

```text
Materi / TP
    ↓
Kisi-kisi
    ↓
Soal
    ↓
Kunci Jawaban
    ↓
Assessment / Ujian
    ↓
Guru Koreksi Manual
    ↓
Input Nilai
    ↓
Sistem Mengolah Data
    ↓
Analisis
    ↓
Remedial
```

### AI membantu:
- membuat kisi-kisi,
- membuat soal,
- membuat variasi soal,
- membuat kunci jawaban,
- membantu perencanaan assessment.

### Guru:
- melaksanakan assessment,
- mengoreksi jawaban siswa,
- menentukan nilai final.

### Sistem:
- mempermudah input nilai,
- menyimpan nilai,
- menghitung statistik,
- menganalisis hasil,
- mendeteksi siswa belum tuntas,
- membantu remedial,
- monitoring,
- reporting.

## 9. Input Nilai

Input nilai harus dibuat sangat cepat.

Dapat mendukung:

- input per siswa,
- input massal,
- keyboard navigation,
- autosave,
- paste dari spreadsheet,
- import Excel / CSV,
- status belum dinilai,
- bulk update.

Contoh:

```text
UTS IPA — VIII A

Ahmad       82
Budi        76
Fauzan      91
Rizky       68
```

## 10. Analysis Flow

```text
Absensi
+
Nilai
+
Assessment
+
Tugas
+
Remedial
+
Catatan
        ↓
     ANALYSIS
```

Tanpa Academic Context:

> 9 siswa belum tuntas pada materi Sistem Pernapasan.

Dengan TP:

> 9 siswa belum mencapai TP 3.

Prinsip:

> **Tanpa kurikulum = analisis pembelajaran tetap berjalan.**  
> **Dengan kurikulum = analisis lebih akademik dan terstruktur.**

## 11. Remedial & Follow Up

```text
Nilai Assessment
 ↓
Sistem Identifikasi Kandidat Remedial
 ↓
Guru Review
 ↓
Remedial
 ↓
Guru Koreksi Manual
 ↓
Input Nilai Remedial
 ↓
Update Progress
```

Sistem menyimpan:

- nilai awal,
- nilai remedial,
- nilai final,
- riwayat remedial,
- status ketuntasan.

Nilai awal tidak ditimpa.

## 12. Student Monitoring

```text
ABSENSI
   │
NILAI
   │
TUGAS
   │
ASSESSMENT
   │
REMEDIAL
   │
CATATAN
   │
   ↓
STUDENT PROFILE
```

Contoh:

```text
AHMAD

Kehadiran          92%
Nilai Rata-rata    78
Tugas Belum         2
Remedial             1
Trend Akademik       ↓
Catatan Guru         3
```

Monitoring dibuat otomatis dari aktivitas guru.

## 13. Journey Orang Tua

```text
Login
 ↓
Anak Saya
 ↓
├── Kehadiran
├── Nilai
├── Tugas
├── Remedial
├── Catatan Guru
└── Perkembangan
```

Orang tua bersifat **viewer** pada versi awal.

## 14. Reporting

```text
Absensi
+
Nilai
+
Jurnal
+
Assessment
+
Remedial
+
Catatan
+
Optional Academic Context
        ↓
   REPORT ENGINE
        ↓
Generate Document
```

Output:

- Rekap absensi
- Rekap nilai
- Jurnal mengajar
- Analisis hasil belajar
- Rekap remedial
- Laporan perkembangan siswa
- Administrasi rapor
- RPP / Modul Ajar
- Prota
- Prosem
- Dokumen akademik lainnya

Dokumen dapat disetorkan kepada Wali Kelas, Kurikulum, Akademik, atau Pimpinan Sekolah. Mereka bukan user aplikasi.

## 15. Prota, Prosem & Administrasi Kurikulum

```text
CORE DATA
+
DATA PEMBELAJARAN
+
KURIKULUM OPTIONAL
        ↓
TEMPLATE / DOCUMENT ENGINE
        ↓
Prota
Prosem
RPP
Modul Ajar
Jurnal
Laporan
```

Sistem dapat mendukung:

- Template Sekolah A
- Template Sekolah B
- Template Sekolah C
- Custom Template

## 16. Planned vs Actual Teaching

Sistem membedakan:

```text
PLANNED TEACHING
Apa yang direncanakan
```

dan:

```text
ACTUAL TEACHING
Apa yang benar-benar diajarkan
```

Actual Teaching tetap berjalan meskipun Prota/Prosem tidak tersedia.

## 17. Start Anytime

Guru dapat masuk kapan saja dalam semester.

Pilihan:

### Start Now
Mulai dari kondisi sekarang.

### Quick Backfill
Masukkan histori penting secara ringkas.

### Full Import
Import data lama seperti:
- nilai,
- absensi,
- materi,
- Prosem,
- assessment,
- RPP.

Prinsip:

> **Start Anytime, Grow the Context.**

## 18. Business Process Principles

1. Input Once, Use Everywhere
2. Ask Only When Needed
3. Progressive Context
4. More Context = Better Experience
5. Connected Workflow
6. AI as Assistant
7. Report by Product
8. Start Anytime, Grow the Context
9. Teacher Corrects, System Processes

## 19. Journey Utama

```text
MINIMAL SETUP
Guru + Mapel + Kelas + Siswa
        ↓
    MULAI BEKERJA
        ↓
┌───────┼────────┐
↓       ↓        ↓
TEACH  ASSESS  CREATE
↓       ↓        ↓
Absensi Soal    Materi
Jurnal  Nilai   Media
        ↓
   DATA TERKUMPUL
        ↓
     ANALYZE
        ↓
    FOLLOW UP
        ↓
     MONITOR
        ↓
      REPORT
```

Optional enrichment:

```text
Kurikulum
CP / TP
ATP
Prota
Prosem
        ↓
Analisis & Report Lebih Dalam
```

**STAGE 03 — USER JOURNEY & BUSINESS PROCESS: FINAL REVISED**
