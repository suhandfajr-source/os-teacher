# Stage 09 — PRD & Development Stages
## AI Teacher Assistant

## 1. Tujuan Stage

Stage ini mengubah seluruh blueprint Stage 01–08 menjadi **rencana pembangunan aplikasi yang bertahap dan terkontrol**.

Prinsip utama:

> **Jangan membangun seluruh aplikasi sekaligus.**

Setiap stage harus:

```text
BUILD
  ↓
TEST
  ↓
FIX
  ↓
PASS
  ↓
LOCK
  ↓
NEXT STAGE
```

Fitur yang sudah PASS tidak boleh diubah sembarangan oleh development stage berikutnya.

---

# 2. Development Philosophy

Antigravity tidak diberikan satu megaprompt untuk membuat seluruh aplikasi.

Strateginya:

```text
MASTER PRD
    ↓
PROJECT RULES
    ↓
STAGE PRD
    ↓
BUILD
    ↓
QA
    ↓
PASS
    ↓
NEXT STAGE
```

Setiap Stage PRD hanya berisi scope yang sedang dikerjakan.

---

# 3. Master PRD

Master PRD menjadi sumber utama seluruh project.

Berisi:

- Product Vision
- User & Role
- Business Process
- Module Architecture
- Data Model
- Business Rules
- UX Architecture
- UI Design System
- Development Principles
- Scope V1
- Future Roadmap

Master PRD **tidak digunakan untuk meminta Antigravity membangun semua fitur sekaligus**.

Master PRD hanya menjadi context utama.

---

# 4. PROJECT_RULES.md

Project harus memiliki aturan tetap.

Contoh:

```text
1. Jangan mengubah fitur yang sudah PASS tanpa instruksi.

2. Jangan menghapus existing functionality untuk
   menyelesaikan fitur baru.

3. Jangan membuat duplicate source of truth.

4. Gunakan reusable component.

5. Semua database change menggunakan migration.

6. Data optional tidak boleh menjadi blocking.

7. Academic Context tidak wajib.

8. AI output adalah draft sampai direview guru.

9. AI tidak menentukan nilai siswa pada V1.

10. Guru melakukan koreksi manual.

11. Sistem mengolah nilai setelah guru input.

12. Planned Teaching dan Actual Teaching harus terpisah.

13. Report berasal dari core data.

14. Parent hanya dapat melihat data anak sendiri.

15. Teacher Note default PRIVATE.

16. Setiap destructive action membutuhkan confirmation
    jika berpotensi menghilangkan data penting.

17. Jangan menggunakan mock data setelah real data layer tersedia.

18. Setelah menyelesaikan stage:
    - run build
    - run lint
    - test core flow
    - report errors
    - report changed files
```

---

# 5. Scope V1

V1 difokuskan pada:

> **Automate Administration First, Automate Judgment Later.**

### Masuk V1

- Teacher Workspace
- Kelas
- Siswa
- Absensi
- Teaching Session
- Jurnal
- Tugas
- Assessment
- Bank Soal
- Kisi-kisi
- AI Generate Soal
- Kunci Jawaban
- Input Nilai Manual
- Analisis Nilai
- Remedial
- Student Monitoring
- AI Content Studio
- Reporting
- Academic Context
- Parent Portal
- Import Data

### Tidak Masuk V1

- Online CBT
- Student Portal penuh
- Auto Correction PG
- OCR lembar jawaban
- AI Essay Correction
- AI Score Recommendation
- Mass AI Correction

---

# 6. Urutan Development

Project dibagi menjadi:

```text
STAGE 0 — PROJECT FOUNDATION

STAGE 1 — AUTH & BASIC SETUP

STAGE 2 — CLASS & STUDENT CORE

STAGE 3 — DAILY TEACHING

STAGE 4 — ASSESSMENT & SCORE

STAGE 5 — STUDENT MONITORING

STAGE 6 — AI CONTENT STUDIO

STAGE 7 — REPORTING & ACADEMIC CONTEXT

STAGE 8 — PARENT PORTAL

STAGE 9 — IMPORT & MID-SEMESTER ONBOARDING

STAGE 10 — POLISH, QA & RELEASE
```

---

# DEVELOPMENT STAGE 0
# Project Foundation

## Objective

Membangun fondasi project tanpa feature bisnis kompleks.

### Scope

- Project structure
- Database connection
- Environment configuration
- Authentication foundation
- Base API architecture
- Error handling
- Logging
- Design tokens
- Core UI components
- App Shell
- Sidebar
- Topbar
- Responsive layout
- Empty state
- Loading state
- Toast
- Modal
- Confirmation dialog

---

## Output

Aplikasi sudah dapat dibuka dengan:

```text
Login Placeholder
        ↓
App Shell
        ↓
Sidebar
        ↓
Empty Dashboard
```

Belum ada fitur bisnis.

---

## PASS Criteria

- Project build berhasil
- Tidak ada blocking error
- Responsive shell berjalan
- Component system tersedia
- Database terkoneksi
- Environment configuration aman
- Struktur project sudah stabil

---

# DEVELOPMENT STAGE 1
# Authentication & Basic Setup

## Objective

Guru dapat memiliki akun dan membuat context minimum.

### Scope

Authentication:

- Register
- Login
- Logout
- Forgot password jika diperlukan

Teacher Profile:

- Nama
- Sekolah
- Profil dasar

Basic Setup:

- Tahun ajaran / semester
- Mata pelajaran
- Kelas

---

## Onboarding

```text
Register
 ↓
Profil Guru
 ↓
Mapel
 ↓
Kelas
 ↓
Masuk Dashboard
```

Academic Context belum diwajibkan.

---

## PASS Criteria

Guru dapat:

- register,
- login,
- membuat profil,
- membuat mapel,
- membuat kelas,
- kembali login tanpa kehilangan data.

---

# DEVELOPMENT STAGE 2
# Class & Student Core

## Objective

Membangun fondasi data siswa.

### Scope

- Kelas Saya
- Detail Kelas
- Tambah siswa
- Edit siswa
- Import siswa
- Search siswa
- Student profile dasar
- Hubungan guru → kelas → siswa

---

## Flow

```text
Guru
 ↓
Kelas Saya
 ↓
VIII A
 ↓
Tambah / Import Siswa
 ↓
32 Siswa
```

---

## PASS Criteria

Guru dapat:

- membuat beberapa kelas,
- memasukkan siswa,
- import siswa,
- mencari siswa,
- melihat detail kelas,
- melihat profil dasar siswa.

Tidak boleh terjadi duplikasi data siswa tanpa warning.

---

# DEVELOPMENT STAGE 3
# Daily Teaching

## Objective

Menyelesaikan aktivitas mengajar sehari-hari.

### Scope

- Beranda
- Hari Ini
- Teaching Session
- Absensi
- Materi yang diajarkan
- Aktivitas
- Teacher Note
- Tugas
- Jurnal mengajar

---

## Core Flow

```text
Guru
 ↓
Hari Ini
 ↓
VIII A
 ↓
Teaching Session
 ↓
Absensi
 ↓
Materi / Aktivitas
 ↓
Catatan
 ↓
Jurnal
```

---

## Absensi

Optimasi:

```text
Tandai Semua Hadir
        ↓
Guru ubah siswa yang tidak hadir
```

---

## Jurnal

Jurnal menggunakan data session:

```text
Tanggal
+
Guru
+
Kelas
+
Mapel
+
Materi
+
Aktivitas
        ↓
Draft Jurnal
```

Guru review sebelum finalize.

---

## PASS Criteria

Guru dapat menyelesaikan satu kegiatan mengajar lengkap tanpa input berulang.

---

# DEVELOPMENT STAGE 4
# Assessment & Score

## Objective

Membangun assessment V1 tanpa automatic correction.

### Scope

- Buat assessment
- Kisi-kisi
- Bank soal
- Soal manual
- Generate soal AI
- Kunci jawaban
- Input nilai
- Import nilai
- Ketuntasan
- Analisis nilai
- Remedial

---

## Flow

```text
Assessment
 ↓
Kisi-kisi
 ↓
Soal
 ↓
Kunci
 ↓
Ujian Dilakukan di Luar Sistem
 ↓
Guru Koreksi Manual
 ↓
Input Nilai
 ↓
Analysis Engine
 ↓
Remedial
```

---

## Fast Score Input

Wajib mendukung:

- keyboard navigation,
- autosave,
- paste dari spreadsheet,
- import CSV / Excel,
- validasi nilai,
- missing score indicator.

---

## Analysis

Minimum:

- rata-rata,
- tertinggi,
- terendah,
- jumlah tuntas,
- jumlah belum tuntas,
- distribusi nilai.

Jika materi tersedia:

- analisis berdasarkan materi.

Jika TP tersedia:

- analisis ketercapaian TP.

---

## Remedial

```text
Nilai
 ↓
Sistem Rekomendasi
 ↓
Guru Review
 ↓
Remedial
 ↓
Input Nilai Remedial
```

Nilai lama tetap tersimpan.

---

## PASS Criteria

Guru dapat menjalankan:

```text
Assessment
→ Input Nilai
→ Analysis
→ Remedial
```

tanpa AI melakukan penilaian siswa.

---

# DEVELOPMENT STAGE 5
# Student Monitoring

## Objective

Mengubah data aktivitas menjadi Student 360°.

### Scope

Student Profile:

- Absensi
- Nilai
- Assessment
- Tugas
- Remedial
- Catatan

Analysis:

- attendance rate,
- average score,
- trend nilai,
- missing assignment,
- remedial history,
- student attention indicator.

---

## Flow

```text
ACTIVITY DATA
      ↓
STUDENT PROFILE
      ↓
ANALYSIS
      ↓
INSIGHT
```

Guru tidak menginput monitoring secara manual.

---

## PASS Criteria

Guru dapat membuka satu siswa dan memahami kondisi siswa tanpa membuka banyak modul.

---

# DEVELOPMENT STAGE 6
# AI Content Studio

## Objective

Membantu guru membuat perangkat pembelajaran dengan AI.

### Scope

AI dapat menghasilkan:

- RPP / Modul Ajar
- Rencana Pembelajaran
- Materi
- PPT
- LKPD
- Worksheet
- Aktivitas
- Kisi-kisi
- Soal
- Kunci jawaban
- Quiz
- Konten lainnya

---

## Dual Generation Mode

### Automatic

```text
Existing Context
       ↓
AI
       ↓
Generate
```

### Manual

```text
Manual Input
       ↓
AI
       ↓
Generate
```

---

## Automatic Context

Dapat menggunakan:

- guru,
- mapel,
- kelas,
- materi,
- teaching history,
- TP jika tersedia,
- kurikulum jika tersedia,
- RPP opsional.

---

## AI Flow

```text
Generate
 ↓
Preview
 ↓
Edit
 ↓
Save
 ↓
Use / Download
```

AI output tidak langsung dianggap final.

---

## PASS Criteria

Guru dapat menghasilkan minimal:

- soal,
- materi,
- RPP,
- PPT,
- LKPD

melalui Automatic maupun Manual Mode.

---

# DEVELOPMENT STAGE 7
# Reporting & Academic Context

## Objective

Membangun penggunaan maksimum aplikasi.

---

## Academic Context

### Scope

- Kurikulum
- CP
- TP
- ATP
- KKTP
- Prota
- Prosem
- Planning

Academic Context tetap optional.

---

## Reporting

Report:

- Rekap absensi
- Rekap nilai
- Jurnal mengajar
- Assessment report
- Analisis hasil belajar
- Rekap remedial
- Perkembangan siswa
- Administrasi rapor
- Prota
- Prosem
- Dokumen akademik lainnya

---

## Report Flow

```text
CORE DATA
 ↓
REPORT ENGINE
 ↓
PREVIEW
 ↓
EDIT
 ↓
FINALIZE
 ↓
DOWNLOAD
```

---

## Template

Support:

```text
Default Template
School Template
Custom Template
Uploaded Template
```

---

## Planned vs Actual

Sistem mulai menampilkan:

```text
PLANNED
VS
ACTUAL
```

tanpa mengubah data asli.

---

## PASS Criteria

Guru dapat menggunakan data aktivitas untuk menghasilkan dokumen tanpa rekap ulang manual.

---

# DEVELOPMENT STAGE 8
# Parent Portal

## Objective

Memberikan informasi perkembangan siswa kepada orang tua.

### Scope

Parent:

- Login
- Anak Saya
- Kehadiran
- Nilai
- Tugas
- Remedial
- Perkembangan
- Catatan yang parent-visible

---

## Security Rule

Parent hanya dapat:

```text
VIEW OWN CHILD
```

Tidak dapat:

- edit nilai,
- edit absensi,
- melihat siswa lain,
- melihat private notes,
- melihat workspace guru.

---

## PASS Criteria

Parent dapat login dan hanya melihat data anak yang terhubung dengan akunnya.

---

# DEVELOPMENT STAGE 9
# Import & Mid-Semester Onboarding

## Objective

Memungkinkan guru mulai kapan saja.

### Scope

### Start Now

Guru langsung menggunakan aplikasi mulai hari ini.

### Quick Backfill

Input ringkas:

- materi yang sudah diajarkan,
- assessment yang sudah dilakukan,
- nilai,
- absensi,
- TP selesai.

### Full Import

Import:

- siswa,
- nilai,
- absensi,
- teaching history,
- assessment,
- Academic Context.

---

## Import Flow

```text
Upload
 ↓
Preview
 ↓
Mapping
 ↓
Validation
 ↓
Confirm
 ↓
Import
```

---

## Data Coverage

Sistem mulai menampilkan:

```text
Attendance        100%
Grades             90%
Teaching History   65%
TP Mapping         40%
```

---

## PASS Criteria

Guru yang mulai di tengah semester tetap dapat menggunakan fitur analisis tanpa harus menginput seluruh semester dari nol.

---

# DEVELOPMENT STAGE 10
# Polish, QA & Release

## Objective

Menyiapkan aplikasi untuk production.

### Scope

- UX consistency
- Responsive testing
- Performance
- Security
- Validation
- Error handling
- Empty state
- Loading state
- Audit behaviour
- Data integrity
- Backup strategy
- Browser compatibility
- Accessibility
- Production environment

---

# 7. Testing Strategy per Stage

Setiap stage diuji melalui:

```text
FUNCTIONAL TEST
+
DATA TEST
+
PERMISSION TEST
+
EDGE CASE TEST
+
RESPONSIVE TEST
```

Contoh Stage Assessment:

```text
CASE 01
Input semua nilai normal

CASE 02
Ada siswa belum memiliki nilai

CASE 03
Paste nilai dari Excel

CASE 04
Nilai lebih dari maksimum

CASE 05
Nilai diubah

CASE 06
Remedial

CASE 07
Nilai remedial lebih rendah

CASE 08
Assessment diarsipkan
```

---

# 8. Definition of PASS

Sebuah stage hanya dianggap PASS jika:

```text
✓ Semua core flow berjalan

✓ Build berhasil

✓ Tidak ada blocking error

✓ Data tersimpan dengan benar

✓ Tidak merusak stage sebelumnya

✓ Responsive pada target screen

✓ Error state tersedia

✓ Loading state tersedia

✓ Empty state tersedia

✓ Acceptance criteria terpenuhi
```

---

# 9. Stage Lock

Setelah PASS:

```text
STAGE PASS
    ↓
COMMIT
    ↓
TAG / DOCUMENT
    ↓
LOCK
```

Next development tidak boleh mengubah behaviour stage tersebut tanpa requirement baru.

---

# 10. Dependency Strategy

Urutan development dibuat berdasarkan dependency.

```text
USER
 ↓
CLASS
 ↓
STUDENT
 ↓
TEACHING
 ↓
ASSESSMENT
 ↓
SCORE
 ↓
MONITORING
 ↓
REPORT
```

AI Content dapat mulai setelah core context cukup tersedia.

---

# 11. V1 Release Definition

V1 dianggap layak digunakan jika guru sudah dapat:

```text
SETUP
 ↓
KELOLA KELAS
 ↓
ABSENSI
 ↓
MENGAJAR
 ↓
JURNAL
 ↓
BUAT MATERI / SOAL DENGAN AI
 ↓
ASSESSMENT
 ↓
INPUT NILAI
 ↓
ANALISIS
 ↓
REMEDIAL
 ↓
MONITOR SISWA
 ↓
GENERATE REPORT
```

Tanpa membutuhkan:

- AI correction,
- OCR,
- online CBT.

---

# 12. Future Development

Setelah V1 stabil:

## V1.1

- AI improvement
- report template improvement
- additional analytics
- workflow optimization

## V2

```text
Online Assessment
Student Limited Access
Auto Correction Objective Questions
Advanced Question Bank
```

## V3

```text
Upload Answer Sheet
OCR
AI Essay Review
Score Recommendation
Confidence System
Mass Correction
```

Prinsip:

> **Core system harus firm sebelum automation akademik yang lebih sensitif ditambahkan.**

---

# 13. Recommended Development Order

Prioritas:

```text
FOUNDATION
    ↓
DAILY VALUE
    ↓
DATA COLLECTION
    ↓
ASSESSMENT
    ↓
ANALYSIS
    ↓
AI PRODUCTIVITY
    ↓
REPORTING
    ↓
PARENT
    ↓
ADVANCED CONTEXT
```

Aplikasi harus mulai terasa berguna sedini mungkin.

---

# 14. Philosophy Stage 09

> **Build Small, Validate Fast.**

> **One Stage, One Goal.**

> **PASS Before Progress.**

> **Never Break a Passed Stage.**

> **Daily Value Before Advanced Intelligence.**

> **Data Foundation Before Deep AI.**

> **Automate Administration First, Automate Judgment Later.**

---

# 15. Development Map Final

```text
STAGE 0
Project Foundation
        ↓
STAGE 1
Authentication & Setup
        ↓
STAGE 2
Class & Student
        ↓
STAGE 3
Daily Teaching
        ↓
STAGE 4
Assessment & Score
        ↓
STAGE 5
Student Monitoring
        ↓
STAGE 6
AI Content Studio
        ↓
STAGE 7
Reporting & Academic Context
        ↓
STAGE 8
Parent Portal
        ↓
STAGE 9
Import & Mid-Semester Onboarding
        ↓
STAGE 10
QA & Production Release
```

---

# 16. Status

```text
01. PRODUCT PROBLEM                    ✅
        ↓
02. USER & ROLE                        ✅
        ↓
03. USER JOURNEY / BUSINESS PROCESS    ✅
        ↓
04. SYSTEM & MODULE ARCHITECTURE       ✅
        ↓
05. DATA MODEL                         ✅
        ↓
06. BUSINESS RULE                      ✅
        ↓
07. UX FLOW & INFORMATION ARCHITECTURE ✅
        ↓
08. UI DESIGN SYSTEM & SCREEN DESIGN   ✅
        ↓
09. PRD / DEVELOPMENT STAGES           ✅
        ↓
10. DEVELOPMENT                        ← NEXT
        ↓
11. TESTING / QA
        ↓
12. PRODUCTION
        ↓
13. ITERATION
```

**STAGE 09 — PRD & DEVELOPMENT STAGES: COMPLETE**