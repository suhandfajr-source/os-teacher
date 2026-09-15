# OS Teacher UI/UX Improvement Plan v2

## 1. Arah Produk

OS Teacher diarahkan bukan hanya sebagai aplikasi pembuat materi dengan
AI, tetapi sebagai **Teacher Operating System** yang membantu guru dari
tahap persiapan mengajar, pelaksanaan pembelajaran, hingga evaluasi.

Tujuan utama:

> Membuat satu workspace tempat guru mengelola seluruh aktivitas
> mengajarnya.

------------------------------------------------------------------------

# 2. Prinsip UX Utama

## Guru sebagai pusat desain

Aplikasi harus menjawab kebutuhan utama guru:

-   Apa yang saya ajarkan hari ini?
-   Apa yang harus saya siapkan?
-   Bagaimana AI membantu saya?
-   Bagaimana progres siswa saya?

## Prinsip:

1.  Dashboard menampilkan pekerjaan, bukan hanya statistik.
2.  AI hadir sebagai asisten di setiap aktivitas.
3.  Alur kerja sederhana tanpa membutuhkan kemampuan teknis.
4.  Informasi penting harus bisa ditemukan dalam maksimal 1-2 klik.

------------------------------------------------------------------------

# 3. Konsep Dashboard Baru

## Daily Teaching Workspace

Dashboard utama diarahkan menjadi ruang kerja guru.

Komponen utama:

### 1. Aktivitas Hari Ini

Menampilkan:

-   Jadwal mengajar
-   Mata pelajaran
-   Kelas
-   Materi
-   Status kesiapan

Contoh:

    07:30 - 09:00

    Pendidikan Agama Islam
    XI RPL 1

    Materi:
    Ketauhidan Nabi Ibrahim

    Status:
    ✓ Materi tersedia
    ⚠ PPT belum dibuat

    [Mulai Mengajar]

------------------------------------------------------------------------

### 2. Quick Create AI

Guru tidak diarahkan ke prompt kosong.

Pilihan:

-   Buat PPT
-   Buat Soal
-   Buat Materi
-   Buat LKPD
-   Buat Modul Ajar

Input:

-   Mata pelajaran
-   Kelas
-   Topik
-   Jenis output

------------------------------------------------------------------------

### 3. Lanjutkan Pekerjaan

Menampilkan pekerjaan terakhir:

-   PPT yang belum selesai
-   Soal yang belum direview
-   Modul yang masih draft

------------------------------------------------------------------------

### 4. Ringkasan Kelas

Menampilkan:

-   Jumlah siswa
-   Jadwal berikutnya
-   Progress pembelajaran

------------------------------------------------------------------------

# 4. Struktur Navigasi Baru

Rekomendasi sidebar:

    AI Teacher

    ⌂ Beranda

    📅 Hari Ini

    🏫 Kelas Saya

    📚 Perangkat Ajar

    ✨ Asisten AI

    📊 Evaluasi


    ----------------

    ⚙ Pengaturan

## Catatan:

Menu "Daftar Siswa" tidak perlu berdiri sendiri.

Siswa adalah bagian dari:

    Kelas Saya

    |
    ├── Siswa
    ├── Presensi
    ├── Nilai
    ├── Catatan
    └── Materi

------------------------------------------------------------------------

# 5. Konsep AI Experience

AI tidak dibuat sebagai fitur terpisah.

AI menjadi co-pilot guru.

Contoh:

Saat membuka kelas:

    XI RPL 1

    Materi Hari Ini

    Ketauhidan Nabi Ibrahim


    [ Buka Materi ]

    [✨ Buat PPT]
    [✨ Buat Soal]
    [✨ Buat Aktivitas]

------------------------------------------------------------------------

# 6. Teaching Readiness Feature

Fitur pembeda OS Teacher.

Sebelum mengajar:

    Persiapan Mengajar

    Materi       ✓
    PPT          ✕
    LKPD         ✕
    Soal         ✓

    Kesiapan:
    60%

    [Lengkapi dengan AI]

------------------------------------------------------------------------

# 7. Color Palette OS Teacher

## Konsep Visual

**Intelligent Teaching Workspace**

Gabungan:

-   Profesional
-   Humanis
-   Modern AI
-   Nyaman digunakan lama

------------------------------------------------------------------------

## Primary Brand

### Deep Education Navy

HEX:

    #1E293B

Penggunaan:

-   Logo
-   Sidebar
-   Heading utama
-   Brand identity

Makna:

-   Kepercayaan
-   Ilmu
-   Profesionalisme

------------------------------------------------------------------------

## AI Identity

### AI Purple

HEX:

    #7C3AED

Soft:

    #F5F3FF

Penggunaan:

-   Tombol AI
-   Generate content
-   AI assistant
-   Magic action

Catatan:

Purple hanya digunakan untuk aktivitas AI.

------------------------------------------------------------------------

## Learning Success

### Education Green

HEX:

    #16A34A

Soft:

    #F0FDF4

Penggunaan:

-   Selesai
-   Siap mengajar
-   Progress berhasil

------------------------------------------------------------------------

## Attention

### Teacher Amber

HEX:

    #F59E0B

Soft:

    #FFFBEB

Penggunaan:

-   Reminder
-   Perlu tindakan
-   Belum selesai

------------------------------------------------------------------------

## Error

### Soft Red

HEX:

    #DC2626

Soft:

    #FEF2F2

Penggunaan:

-   Error
-   Masalah
-   Status gagal

------------------------------------------------------------------------

## Background

Main:

    #F8FAFC

Card:

    #FFFFFF

------------------------------------------------------------------------

## Typography Color

Primary:

    #0F172A

Secondary:

    #64748B

Muted:

    #94A3B8

------------------------------------------------------------------------

# 8. Aturan Penggunaan Warna

  Warna    Fungsi
  -------- ---------------------
  Navy     Fondasi aplikasi
  Purple   Aktivitas AI
  Green    Berhasil
  Amber    Perhatian
  Red      Masalah
  Gray     Informasi pendukung

------------------------------------------------------------------------

# 9. Prioritas Development

## Sprint 1 - High Impact

-   Redesign dashboard
-   Quick Create AI
-   Recent Work
-   Hari Ini workspace

## Sprint 2

-   Kelas menjadi pusat aktivitas
-   Student management
-   Teaching readiness

## Sprint 3

-   AI Copilot seluruh modul
-   Template Kurikulum Merdeka
-   Learning analytics

------------------------------------------------------------------------

# 10. Arah Visual Akhir

Karakter OS Teacher:

    Notion simplicity
    +
    Canva creativity
    +
    Google Classroom reliability
    +
    AI Purple intelligence

Target akhir:

> OS Teacher menjadi workspace utama guru untuk merencanakan, mengajar,
> mengevaluasi, dan meningkatkan kualitas pembelajaran.
