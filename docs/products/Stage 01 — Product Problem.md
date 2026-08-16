# Stage 01 — Product Problem
## Teacher OS / Asisten Guru Terintegrasi

### 1. Latar Belakang

Guru menghadapi banyak pekerjaan administratif, akademik, dan pelaporan yang berulang serta tersebar di berbagai tools seperti spreadsheet, dokumen, aplikasi pembelajaran, chat, dan file lokal.

Akibatnya, waktu guru banyak habis untuk pekerjaan administratif dibandingkan aktivitas yang benar-benar membutuhkan kompetensi guru seperti merancang pembelajaran, membimbing siswa, mengevaluasi pemahaman, dan melakukan intervensi.

---

## 2. Masalah yang Ditemukan

Terdapat 20 masalah utama:

1. Absensi siswa masih membutuhkan input dan rekap berulang.
2. Input nilai memiliki banyak komponen dan perhitungan manual.
3. Koreksi soal, terutama essay, membutuhkan banyak waktu.
4. Guru harus membuat soal berulang untuk berbagai materi dan ujian.
5. Kisi-kisi ujian dibuat manual.
6. RPP/Modul Ajar memiliki format berulang tetapi tetap dibuat manual.
7. Guru membutuhkan waktu untuk mencari metode dan aktivitas pembelajaran yang sesuai.
8. Pembuatan media pembelajaran seperti PPT, LKPD, dan worksheet membutuhkan waktu.
9. Tracking siswa remedial dan nilai remedial masih sulit.
10. Perkembangan siswa sulit dilihat secara cepat.
11. Catatan perilaku siswa tersebar di berbagai tempat.
12. Laporan wali kelas membutuhkan penggabungan banyak sumber data.
13. Komunikasi kepada orang tua banyak yang bersifat berulang.
14. Tracking pengumpulan tugas sulit dilakukan.
15. Jurnal mengajar masih membutuhkan input ulang data yang sebenarnya sudah tersedia.
16. Prota dan Prosem masih membutuhkan pembagian waktu manual.
17. Administrasi rapor membutuhkan rekap nilai, deskripsi, dan catatan.
18. Materi pembelajaran lama sulit ditemukan karena file tidak terorganisir.
19. Permintaan laporan dari pimpinan membutuhkan rekap manual terlebih dahulu.
20. Guru sulit mengetahui materi atau kompetensi yang belum dikuasai siswa.

---

# 3. Problem Cluster

20 masalah tersebut dikelompokkan menjadi 5 kelompok utama.

## A. Administrasi Guru

Mencakup:

- Absensi siswa
- Input nilai
- Jurnal mengajar
- Prota
- Prosem
- RPP / Modul Ajar
- Administrasi rapor
- Laporan pimpinan

**Masalah utama:**

Data yang sama sering dimasukkan dan direkap berkali-kali.

---

## B. Pembelajaran

Mencakup:

- Merancang pembelajaran
- Menentukan metode pembelajaran
- Membuat materi
- Membuat PPT
- Membuat LKPD
- Membuat worksheet
- Mencari materi pembelajaran lama

**Masalah utama:**

Guru masih banyak membuat perangkat pembelajaran dari awal meskipun sumber data dan polanya sering sama.

---

## C. Assessment

Mencakup:

- Membuat kisi-kisi
- Membuat soal
- Pelaksanaan assessment
- Koreksi soal
- Input nilai
- Remedial
- Evaluasi hasil pembelajaran

Assessment harus dipandang sebagai satu alur:

```text
Materi / Tujuan Pembelajaran
        ↓
Kisi-kisi
        ↓
Soal
        ↓
Assessment
        ↓
Koreksi
        ↓
Nilai
        ↓
Analisis
        ↓
Remedial
```

**Masalah utama:**

Proses assessment masih terfragmentasi dan banyak pekerjaan dilakukan secara manual.

---

## D. Student Monitoring

Mencakup:

- Nilai
- Absensi
- Pengumpulan tugas
- Remedial
- Perilaku siswa
- Perkembangan siswa

**Masalah utama:**

Data siswa tersebar sehingga guru sulit melihat kondisi siswa secara menyeluruh.

Target sistem ke depan adalah menciptakan:

### 360° Student View

Contoh:

```text
AHMAD

Attendance        93%
Average Grade     78
Missing Tasks     3
Remedial          2
Behaviour         Good
Academic Trend    ↓
```

---

## E. Reporting & Communication

Mencakup:

- Laporan wali kelas
- Laporan pimpinan
- Rapor
- Komunikasi orang tua
- Monitoring perkembangan siswa

**Masalah utama:**

Laporan masih dibuat melalui proses rekap manual dari berbagai sumber data.

Prinsip yang digunakan:

> Report bukan tempat input data. Report adalah output dari data operasional sistem.

---

# 4. Root Problem

Dari seluruh masalah tersebut ditemukan 5 akar masalah utama.

### P01 — Fragmented Data

Data guru, siswa, pembelajaran, assessment, dan administrasi tersebar di banyak tempat.

---

### P02 — Repetitive Work

Guru harus memasukkan, menghitung, atau mengolah informasi yang sama berkali-kali.

---

### P03 — Manual Content Creation

Perangkat pembelajaran masih dibuat manual meskipun memiliki struktur, pola, dan sumber data yang sama.

---

### P04 — Lack of Actionable Insight

Data tersedia tetapi belum otomatis diubah menjadi informasi yang membantu guru mengambil keputusan.

---

### P05 — Manual Reporting

Laporan membutuhkan pengumpulan dan rekap ulang dari berbagai sumber.

---

# 5. Kondisi Saat Ini

Secara sederhana:

```text
                    GURU
                     │
       ┌─────────────┼─────────────┐
       │             │             │
      Word         Excel         Drive
       │             │             │
 RPP / Modul      Nilai          Materi
 Kisi-kisi        Absensi        PPT
 Jurnal           Remedial       LKPD

             + Chat / WhatsApp
             + LMS
             + Catatan pribadi
             + File lokal

                     ↓

                DATA TERPECAH

                     ↓

                INPUT BERULANG

                     ↓

                REKAP MANUAL

                     ↓

          BEBAN ADMINISTRASI TINGGI
```

---

# 6. Desired Condition

Sistem yang ingin dibangun:

```text
                  TEACHER OS
                      │
                CENTRAL DATA
                      │
       ┌──────────────┼──────────────┐
       │              │              │
   Curriculum      Student        Teaching
       │              │              │
       └──────────────┼──────────────┘
                      │
                     AI
                      │
 ┌──────────┬─────────┼─────────┬──────────┐
 │          │         │         │          │
RPP       Soal       PPT      Analisis   Report
Modul     Kisi-kisi  LKPD     Student    Parent
```

Satu data dapat digunakan oleh banyak proses.

---

# 7. Product Vision

> Membangun platform terpadu yang membantu guru merencanakan pembelajaran, menjalankan administrasi, melakukan assessment, memonitor perkembangan siswa, dan menghasilkan laporan dengan memanfaatkan data dan AI dalam satu sistem.

Sistem tidak ditujukan untuk menggantikan guru.

AI digunakan terutama untuk membantu pekerjaan:

- administratif,
- repetitif,
- perhitungan,
- drafting,
- formatting,
- summarization,
- analisis data.

Keputusan pedagogis dan keputusan penting mengenai siswa tetap berada di tangan guru.

---

# 8. Core Value Proposition

## 1. Input Once, Use Everywhere

Informasi cukup dimasukkan sekali kemudian digunakan di seluruh sistem.

Contoh:

```text
Tujuan Pembelajaran
        │
        ├── Modul Ajar
        ├── Jurnal Mengajar
        ├── Kisi-kisi
        ├── Soal
        ├── Assessment
        ├── Analisis Hasil Belajar
        └── Remedial
```

---

## 2. AI Teaching Assistant

AI menggunakan konteks yang sudah tersedia di dalam sistem seperti:

- guru,
- mata pelajaran,
- kelas,
- kurikulum,
- tujuan pembelajaran,
- siswa,
- materi,
- riwayat assessment.

Sehingga guru tidak perlu menjelaskan konteks dari awal setiap kali menggunakan AI.

---

## 3. Data-Driven Teacher

Sistem tidak hanya menampilkan angka tetapi memberikan insight yang bisa ditindaklanjuti.

Contoh:

```text
⚠ 8 siswa belum menguasai TP 3.

⚠ Nilai rata-rata assessment TP 3 hanya 61.

⚠ 5 siswa memiliki tingkat kehadiran di bawah 80%.

⚠ Ahmad mengalami penurunan nilai pada 3 assessment terakhir.

✓ Direkomendasikan remedial untuk TP 3.
```

---

# 9. Prinsip Utama Produk

Prinsip utama yang harus dijaga sejak awal:

> **Jangan meminta guru menginput data yang sebenarnya sudah diketahui sistem.**

Contoh:

Jika sistem sudah mengetahui:

- hari dan tanggal,
- jadwal guru,
- kelas,
- mata pelajaran,
- daftar siswa,
- materi,
- tujuan pembelajaran,

maka informasi tersebut tidak boleh diminta kembali ketika guru melakukan:

- absensi,
- jurnal mengajar,
- assessment,
- pembuatan soal,
- pembuatan laporan,
- atau aktivitas lainnya.

---

# 10. Konsep Produk Awal

Produk sementara diposisikan sebagai:

## Teacher Operating System

Bukan sekadar aplikasi administrasi guru.

Teacher OS menjadi pusat kerja guru untuk:

```text
PLAN
Perencanaan Pembelajaran
        ↓
TEACH
Pelaksanaan Pembelajaran
        ↓
ASSESS
Assessment & Penilaian
        ↓
MONITOR
Monitoring Siswa
        ↓
INTERVENE
Remedial / Tindak Lanjut
        ↓
REPORT
Pelaporan
```

Seluruh proses menggunakan sumber data yang sama dan saling terhubung.

---

# 11. Scope Stage 01

Stage 01 hanya menetapkan:

- masalah yang ingin diselesaikan,
- akar masalah,
- kondisi saat ini,
- kondisi yang diinginkan,
- product vision,
- value proposition,
- dan prinsip dasar sistem.

Pada Stage 01 belum ditentukan secara final:

- fitur,
- sidebar,
- role permission,
- database,
- teknologi,
- UI,
- API,
- maupun arsitektur teknis.

Hal-hal tersebut akan ditentukan pada stage selanjutnya.

---

# 12. Status

**STAGE 01 — PRODUCT PROBLEM: COMPLETE**

Next:

```text
01. PRODUCT PROBLEM                 ✅
        ↓
02. USER & ROLE                     ← NEXT
        ↓
03. USER JOURNEY / BUSINESS PROCESS
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