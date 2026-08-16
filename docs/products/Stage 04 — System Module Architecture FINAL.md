# Stage 04 — System & Module Architecture
## AI Teacher Assistant — Final Revised

## 1. Tujuan Stage

Menentukan struktur modul utama aplikasi, hubungan antar-modul, serta bagaimana sistem tetap berguna dengan input minimal tetapi dapat berkembang menjadi sistem analisis dan reporting lengkap.

## 2. Arsitektur Utama

```text
TEACHER ASSISTANT
│
├── Daily Workspace
├── Teaching
├── Assessment
├── Student Monitoring
├── Content & AI
├── Reporting
├── Academic Context
├── Parent Portal
└── Setup / Import
```

Didukung oleh:

```text
CORE DATA
+
AI ENGINE
+
ANALYSIS ENGINE
```

## 3. Daily Workspace

Menjadi pusat aktivitas harian guru.

Mencakup:

- jadwal / kelas hari ini,
- absensi,
- jurnal,
- tugas,
- assessment,
- input nilai,
- remedial,
- siswa yang perlu perhatian,
- shortcut pekerjaan utama.

Prinsip:

> Guru login dan langsung dapat bekerja tanpa melewati banyak menu.

## 4. Teaching Module

```text
TEACHING
│
├── Kelas Saya
├── Absensi
├── Pertemuan
├── Jurnal Mengajar
├── Materi
├── Aktivitas
└── Tugas
```

Satu pertemuan menjadi shared context:

```text
PERTEMUAN
│
├── Absensi
├── Materi
├── Aktivitas
├── Tugas
└── Jurnal
```

## 5. Assessment Module — V1 Final

```text
ASSESSMENT
│
├── Assessment Saya
├── Kisi-kisi
├── Bank Soal
├── Generate Soal AI
├── Kunci Jawaban
├── Input Nilai
├── Analisis
└── Remedial
```

Flow:

```text
Materi / TP
↓
Kisi-kisi
↓
Soal
↓
Kunci Jawaban
↓
Assessment
↓
Guru Koreksi Manual
↓
Input Nilai
↓
Analysis Engine
↓
Remedial
```

### Deferred / Future Development

Tidak dibangun pada V1:

- Student digital responses
- Online assessment
- Auto correction PG
- OCR lembar jawaban
- AI essay correction
- AI score recommendation
- Mass AI correction

Arsitektur tetap memungkinkan fitur tersebut ditambahkan kemudian.

## 6. Student Monitoring

```text
Absensi
+
Nilai
+
Tugas
+
Assessment
+
Remedial
+
Catatan
        ↓
STUDENT 360° VIEW
```

## 7. Content & AI Studio

Dapat menghasilkan:

- RPP / Modul Ajar
- Rencana Pembelajaran
- Materi
- PPT
- LKPD
- Worksheet
- Aktivitas pembelajaran
- Kisi-kisi
- Soal
- Kunci jawaban
- Quiz
- Konten lainnya

## 8. Dual AI Generation Mode

```text
CREATE WITH AI
       ↓
┌──────┴──────┐
↓             ↓
OTOMATIS     MANUAL
```

### Automatic Mode

Menggunakan:

- guru,
- mapel,
- kelas,
- materi,
- riwayat pembelajaran,
- Academic Context jika tersedia,
- RPP sebagai referensi opsional.

### Manual Mode

Guru mengisi sendiri:

- kelas,
- mapel,
- materi,
- kurikulum opsional,
- CP / TP / ATP opsional,
- jumlah soal,
- PG / essay,
- tingkat kesulitan,
- durasi,
- instruksi tambahan.

## 9. RPP sebagai Context Source

```text
RPP
 ↓
├── PPT
├── LKPD
├── Worksheet
├── Soal
├── Quiz
└── Aktivitas Pembelajaran
```

RPP tetap opsional.

## 10. Reporting & Document Engine

```text
DATA AKTIVITAS
+
ACADEMIC CONTEXT
        ↓
REPORT ENGINE
        ↓
DOCUMENT
```

Guru dapat:

- preview,
- edit,
- finalize,
- download,
- print.

## 11. Academic Context

Optional enrichment:

- Kurikulum
- CP
- TP
- ATP
- Kalender akademik
- Prota
- Prosem
- KKTP
- Planning

Tanpa Academic Context aplikasi tetap berjalan.

## 12. Template Engine

```text
CORE DATA
+
ACADEMIC DATA
+
ACTUAL TEACHING
        ↓
TEMPLATE ENGINE
        ↓
├── Template Sistem
├── Template Sekolah
└── Custom Template
```

## 13. Parent Portal

Menampilkan:

- kehadiran,
- nilai,
- tugas,
- remedial,
- catatan yang diizinkan,
- perkembangan.

Parent Portal tidak mengakses workspace internal guru.

## 14. Setup Minimal

```text
GURU
+
MAPEL
+
KELAS
+
SISWA
```

## 15. AI Layer

AI membantu:

- generate,
- drafting,
- summarization,
- rekomendasi,
- analisis naratif,
- document generation.

Untuk V1:

> **AI tidak mengoreksi jawaban siswa dan tidak menentukan nilai.**

## 16. Analysis Engine

```text
DATA
 ↓
RULE / CALCULATION
 ↓
ANALYSIS
 ↓
INSIGHT
 ↓
AI EXPLANATION jika diperlukan
```

Contoh:

- rata-rata,
- distribusi nilai,
- ketuntasan,
- attendance risk,
- trend akademik,
- missing assignment,
- remedial frequency,
- learning gap.

## 17. Mid-Semester Onboarding

Guru dapat memilih:

### Start Now
Mulai dari kondisi sekarang.

### Quick Backfill
Masukkan histori penting secara ringkas.

### Full Import
Import data lama.

Guru tidak perlu merekonstruksi setiap pertemuan sejak awal semester.

## 18. Historical Baseline

Contoh:

```text
Juli–September

Materi selesai:
- Sistem Gerak
- Sistem Pencernaan
- Sistem Pernapasan

Assessment:
3 kali

Nilai:
Imported

Absensi:
Imported

TP selesai:
TP 1–5
```

## 19. Data Coverage & Confidence

Contoh:

```text
Attendance        100%
Grades             95%
Teaching History   70%
TP Mapping         60%
Behaviour          35%
```

Insight harus mempertimbangkan kelengkapan data.

## 20. Minimum vs Maximum Usage

### Minimum Usage

```text
Setup
↓
Teaching
↓
Assessment
↓
Student Monitoring
```

### Maximum Usage

```text
Historical Data
+
Academic Context
+
Planning
+
Actual Teaching
+
Assessment
+
Student Data
        ↓
Analysis
        ↓
Insight
        ↓
Recommendation
        ↓
Follow Up
        ↓
Reporting
```

## 21. Prinsip Final Architecture

1. Input Once, Use Everywhere
2. Ask Only When Needed
3. More Context = Better Experience
4. Start Anytime, Grow the Context
5. Automatic + Manual AI Generation
6. Activity Generates Data
7. Report by Product
8. Flexible School Format
9. AI as Assistant
10. Transparent Analysis
11. **Automate Administration First, Automate Judgment Later**

## 22. Arsitektur Final

```text
                  AI TEACHER ASSISTANT
                         │
        ┌────────────────┴────────────────┐
        │                                 │
    TEACHER APP                      PARENT PORTAL
        │
        ├── Daily Workspace
        ├── Teaching
        ├── Assessment
        ├── Student Monitoring
        ├── Content & AI
        ├── Reporting
        ├── Academic Context
        └── Setup / Import
                 │
                 ↓
              CORE DATA
                 │
        ┌────────┴────────┐
        ↓                 ↓
 ANALYSIS ENGINE       AI ENGINE
        │                 │
        └────────┬────────┘
                 ↓
      INSIGHT / RECOMMENDATION
                 ↓
        DOCUMENT / REPORT
```

**STAGE 04 — SYSTEM & MODULE ARCHITECTURE: FINAL REVISED**
