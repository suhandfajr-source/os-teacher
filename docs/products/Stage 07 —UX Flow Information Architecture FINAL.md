# Stage 07 — UX Flow & Information Architecture
## AI Teacher Assistant — Final Revised

## 1. Tujuan Stage

Menentukan bagaimana user berpindah dari satu aktivitas ke aktivitas lain, struktur navigasi, urutan informasi, posisi fitur utama, dan bagaimana aplikasi tetap sederhana meskipun fiturnya banyak.

Prinsip utama:

> **Guru tidak harus memahami struktur sistem untuk menggunakan aplikasi. Sistem harus mengikuti cara kerja guru.**

## 2. Prinsip UX

1. **Daily First** — aktivitas sehari-hari paling mudah diakses.
2. **Task-Based Navigation** — navigasi mengikuti pekerjaan guru.
3. **Progressive Disclosure** — fitur kompleks muncul saat diperlukan.
4. **Context Aware** — sistem menggunakan data yang sudah diketahui.
5. **Minimum Click** — aktivitas rutin dibuat sesingkat mungkin.
6. **Optional Means Optional** — data optional tidak menjadi blocking.
7. **Start Anywhere** — guru dapat langsung masuk ke pekerjaan yang sedang dibutuhkan.

## 3. Navigasi Utama Guru

```text
Beranda

Hari Ini

Kelas Saya

Pembelajaran

Assessment

Siswa

AI Studio

Laporan

Akademik

Dokumen Saya

Pengaturan
```

Struktur ini menjadi dasar Information Architecture, belum desain visual final.

## 4. Beranda

Beranda menampilkan:

- kegiatan hari ini,
- kelas,
- nilai yang belum lengkap,
- tugas yang belum terkumpul,
- siswa yang perlu perhatian,
- remedial,
- quick action.

Quick Action:

```text
[ Absensi ]

[ Buat Soal ]

[ Buat Materi ]

[ Input Nilai ]

[ Buat PPT ]

[ Lihat Siswa ]
```

## 5. Hari Ini

```text
HARI INI

08:00
IPA — VIII A

[Absensi]
[Jurnal]
[Materi]
[Tugas]

10:00
IPA — VIII B

[Absensi]
[Jurnal]
[Materi]
```

Guru tidak perlu membuka banyak menu untuk satu sesi mengajar.

## 6. Kelas Saya

```text
KELAS SAYA
│
├── VIII A — IPA
├── VIII B — IPA
└── VIII C — IPA
```

Detail kelas:

```text
VIII A — IPA

Overview
Pertemuan
Siswa
Tugas
Assessment
Nilai
Materi
```

Kelas menjadi salah satu context utama sistem.

## 7. Teaching Session UX

```text
IPA — VIII A
16 Agustus 2026

Materi:
Sistem Pernapasan

[Absensi]

[Materi & Aktivitas]

[Tugas]

[Catatan]

[Jurnal]
```

Guru tidak perlu membuat jurnal dari nol karena sebagian besar konteks berasal dari session.

## 8. Pembelajaran

```text
PEMBELAJARAN

├── Rencana Pembelajaran
├── Materi
├── Aktivitas
├── Tugas
├── RPP / Modul Ajar
├── PPT
├── LKPD
└── Worksheet
```

Sebagian besar konten dapat dibuat melalui AI Studio.

## 9. Assessment — UX V1 Final

```text
ASSESSMENT

├── Assessment Saya
├── Buat Assessment
├── Bank Soal
├── Kisi-kisi
├── Kunci Jawaban
├── Input Nilai
├── Analisis
└── Remedial
```

Flow:

```text
Buat Assessment
↓
Kisi-kisi
↓
Soal
↓
Kunci Jawaban
↓
Guru Melaksanakan Ujian
↓
Guru Koreksi Manual
↓
Input Nilai
↓
Analisis
↓
Remedial
```

Menu **Koreksi AI** tidak ada pada V1.

## 10. Input Nilai UX

Input Nilai menjadi salah satu UX prioritas.

Contoh:

```text
UTS IPA — VIII A

Nama              Nilai

Ahmad             [ 85 ]
Budi              [ 72 ]
Fauzan            [ 91 ]
Rizky             [ 68 ]
```

Support:

- Paste dari Excel
- Import Excel / CSV
- Bulk Input
- Autosave
- Keyboard Navigation
- Status belum dinilai

Tujuan:

> **Walaupun koreksi manual, pekerjaan administratif setelah koreksi harus sangat cepat.**

## 11. AI Studio

Landing:

```text
Apa yang ingin Anda buat?

[ RPP / Modul ]

[ Rencana Pembelajaran ]

[ PPT ]

[ LKPD ]

[ Worksheet ]

[ Materi ]

[ Kisi-kisi ]

[ Soal ]

[ Quiz ]

[ Konten Lainnya ]
```

## 12. AI Generation Flow

```text
Pilih Konten
↓
Pilih Cara Membuat
↓
┌───────────────┬───────────────┐
│ OTOMATIS      │ MANUAL        │
└───────────────┴───────────────┘
↓
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

## 13. Mode Otomatis

Contoh:

```text
Buat PPT

Context ditemukan:

IPA
VIII A
Sistem Pernapasan
2 × 40 menit
TP 3
RPP tersedia

[Ubah Context]

[Generate]
```

Guru cukup memastikan context yang digunakan benar.

## 14. Mode Manual

Contoh generate soal:

```text
Mapel:
IPA

Kelas:
VIII

Materi:
Sistem Pernapasan

CP / TP:
Opsional

Jumlah PG:
20

Jumlah Essay:
5

Kesulitan:
Sedang

Instruksi Tambahan:
Opsional

[Generate]
```

Field lanjutan dapat ditempatkan pada:

```text
[ Pengaturan Tambahan ]
```

agar form tidak terasa berat.

## 15. AI Result Flow

```text
GENERATE
↓
PREVIEW
↓
EDIT
↓
SAVE
↓
USE
```

Action:

- Edit
- Generate Ulang
- Simpan
- Download
- Gunakan di Kelas

## 16. Siswa / Student 360°

Menu Siswa menyediakan pencarian dan detail siswa.

Contoh detail:

```text
AHMAD

Kehadiran        92%
Nilai Rata-rata  78
Tugas Belum       2
Remedial           1

Trend Nilai

Absensi
Assessment
Tugas
Remedial
Catatan
```

## 17. Insight Siswa

Contoh:

```text
PERLU PERHATIAN

Ahmad

Nilai turun pada 3 assessment terakhir.

2 tugas belum dikumpulkan.

[ Lihat Detail ]
```

Insight tidak perlu memenuhi dashboard dengan terlalu banyak informasi.

## 18. Parent Visibility

Saat membuat catatan:

```text
Catatan:

Ahmad perlu meningkatkan
konsistensi pengumpulan tugas.

Visibility:

● Internal Guru
○ Tampilkan ke Orang Tua
```

Default:

```text
Internal Guru
```

## 19. Parent Portal UX

Navigasi:

```text
Beranda
Anak Saya
Perkembangan
Informasi Guru
```

Contoh:

```text
AHMAD

Kehadiran        92%
Nilai Terbaru    82
Tugas Belum       2
Remedial          1
```

Orang tua tidak melihat kompleksitas Teacher Workspace.

## 20. Laporan

```text
LAPORAN

├── Rekap Absensi
├── Rekap Nilai
├── Jurnal Mengajar
├── Assessment
├── Remedial
├── Perkembangan Siswa
├── Administrasi Rapor
└── Dokumen Akademik
```

Flow:

```text
Pilih Report
↓
Pilih Context
↓
Generate
↓
Preview
↓
Edit
↓
Finalize
↓
Download
```

## 21. Document Template UX

```text
Format Dokumen

○ Template Default

○ Template Sekolah Saya

○ Upload Template Baru
```

Format sekolah dapat berubah tanpa mengubah workflow utama aplikasi.

## 22. Academic Context UX

```text
AKADEMIK

├── Kurikulum
├── CP / TP
├── ATP
├── Prota
├── Prosem
├── KKTP
└── Planning
```

Jika belum lengkap:

> Academic Context Anda belum lengkap.  
> Aplikasi tetap dapat digunakan. Lengkapi jika ingin analisis dan laporan lebih mendalam.

## 23. Mid-Semester Onboarding

```text
Kapan Anda mulai menggunakan Teacher Assistant?

○ Mulai dari sekarang

○ Saya ingin menambahkan data sebelumnya
```

Jika memilih histori:

```text
[ Quick Backfill ]

[ Import Data ]
```

Tidak ada kewajiban menginput semester dari awal.

## 24. Quick Backfill

Wizard:

1. Materi yang sudah diajarkan
2. Assessment yang sudah dilakukan
3. Import nilai
4. Import absensi
5. TP yang sudah selesai

Semua bagian dapat dilewati.

## 25. Global Quick Create

Aplikasi memiliki tombol:

```text
+ Buat
```

Pilihan dapat mencakup:

- Absensi
- Teaching Session
- Tugas
- Assessment
- Soal AI
- Materi AI
- PPT AI
- LKPD AI
- Catatan Siswa

## 26. Global Search

Guru dapat mencari:

- siswa,
- kelas,
- materi,
- soal,
- assessment,
- dokumen,
- RPP,
- PPT.

Tujuan utamanya juga membantu masalah pencarian file dan materi lama.

## 27. Context Selector

Pola context dibuat konsisten:

```text
Kelas:
VIII A

Mapel:
IPA

Materi:
Sistem Pernapasan
```

Jika context sudah diketahui sistem, otomatis terisi.

Guru hanya mengganti bila perlu.

## 28. Empty State

Jangan hanya menampilkan:

> Belum ada data.

Tetapi berikan next action.

Contoh:

```text
Belum ada assessment.

[ Buat Assessment ]

atau

[ Generate dengan AI ]
```

## 29. UX untuk Data Tidak Lengkap

Data optional tidak boleh memblokir user.

Contoh:

```text
TP belum tersedia.

Anda tetap dapat membuat soal berdasarkan materi.

[ Lanjutkan ]

[ Tambahkan TP ]
```

Prinsip:

> **Warning lebih baik daripada blocking jika data tersebut optional.**

## 30. Information Architecture Final

```text
TEACHER APP
│
├── Beranda
│
├── Hari Ini
│
├── Kelas Saya
│   ├── Overview
│   ├── Pertemuan
│   ├── Siswa
│   ├── Tugas
│   ├── Assessment
│   ├── Nilai
│   └── Materi
│
├── Pembelajaran
│   ├── Rencana
│   ├── Materi
│   ├── RPP / Modul
│   ├── PPT
│   ├── LKPD
│   └── Worksheet
│
├── Assessment
│   ├── Assessment
│   ├── Bank Soal
│   ├── Kisi-kisi
│   ├── Kunci Jawaban
│   ├── Input Nilai
│   ├── Analisis
│   └── Remedial
│
├── Siswa
│
├── AI Studio
│
├── Laporan
│
├── Akademik
│
├── Dokumen Saya
│
└── Pengaturan
```

Parent:

```text
PARENT PORTAL
│
├── Beranda
├── Anak Saya
├── Perkembangan
└── Informasi Guru
```

## 31. UX Priority Final

```text
1. QUICK ACTION

2. DAILY WORKFLOW

3. FAST SCORE INPUT

4. CONTEXTUAL ACTION

5. AI GENERATION

6. STUDENT MONITORING

7. REPORTING

8. ADVANCED ACADEMIC SETUP
```

Academic Context tidak boleh lebih menonjol daripada pekerjaan harian.

## 32. Prinsip Final UX

1. Daily First
2. Task First
3. Minimum Click
4. Context Aware
5. Progressive Disclosure
6. Optional Means Optional
7. Auto + Manual AI
8. Start Anywhere
9. One Workflow, Connected Data
10. Simple Teacher Experience
11. **Manual Correction, Frictionless Score Input**

## 33. Scope Assessment V1

### AI
- Generate kisi-kisi
- Generate soal
- Generate variasi soal
- Generate kunci jawaban

### Guru
- Melaksanakan assessment
- Mengoreksi jawaban siswa
- Menentukan nilai
- Input / import nilai

### Sistem
- Menyimpan nilai
- Mempercepat input nilai
- Menghitung statistik
- Analisis hasil belajar
- Identifikasi ketuntasan
- Rekomendasi remedial
- Student monitoring
- Trend analysis
- Reporting

### Deferred Development
- Online Assessment
- Student Digital Answer
- Auto Correction PG
- Upload Lembar Jawaban
- OCR Tulisan Tangan
- AI Essay Correction
- AI Score Recommendation
- Confidence Grading
- Mass AI Correction

**STAGE 07 — UX FLOW & INFORMATION ARCHITECTURE: FINAL REVISED**
