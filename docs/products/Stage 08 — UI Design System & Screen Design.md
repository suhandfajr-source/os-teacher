# Stage 08 — UI Design System & Screen Design
## AI Teacher Assistant

## 1. Tujuan Stage

Stage ini menentukan bagaimana sistem diterjemahkan menjadi antarmuka yang:

- mudah digunakan guru,
- cepat dipahami,
- nyaman untuk penggunaan harian,
- tidak terasa seperti software administrasi yang rumit,
- tetap mampu menampilkan data dan analisis yang kompleks,
- responsif di laptop maupun HP.

Prinsip utama:

> **Complex system, simple interface.**

Kompleksitas sistem disimpan di belakang layar. Guru cukup melihat apa yang dibutuhkan untuk pekerjaannya saat itu.

---

# 2. Design Direction

Aplikasi menggunakan gaya:

## Clean + Calm + Productive

Karakter visual:

- modern,
- bersih,
- ringan,
- spacious,
- profesional,
- friendly,
- tidak terlalu formal,
- tidak terlihat seperti ERP sekolah,
- tidak terlalu banyak warna,
- fokus pada pekerjaan guru.

Hindari:

- dashboard penuh chart,
- terlalu banyak card,
- terlalu banyak menu,
- tabel padat,
- warna terlalu ramai,
- istilah teknis,
- halaman form panjang.

---

# 3. Visual Hierarchy

Prioritas tampilan:

```text
PEKERJAAN YANG HARUS DILAKUKAN
        ↓
INFORMASI PENTING
        ↓
ACTION
        ↓
DETAIL
        ↓
ADVANCED INFORMATION
```

Contoh:

Guru membuka aplikasi.

Yang pertama dilihat:

```text
Selamat siang, Pak Ahmad

Hari ini Anda mengajar 3 kelas.

08:00 — IPA VIII A
10:00 — IPA VIII B
13:00 — IPA VIII C
```

Bukan:

```text
Total Siswa: 96
Assessment: 17
Attendance: 92%
Average: 78.4
Learning Gap: 14
Remedial: 12
...
```

Statistik menjadi informasi sekunder.

---

# 4. App Shell

Desktop:

```text
┌──────────────────────────────────────────────────┐
│ Logo        Search                      Profile  │
├──────────────┬───────────────────────────────────┤
│              │                                   │
│ Sidebar      │          Main Content             │
│              │                                   │
│              │                                   │
│              │                                   │
└──────────────┴───────────────────────────────────┘
```

Struktur:

### Topbar

Berisi:

- global search,
- quick create,
- notification,
- profile.

### Sidebar

Berisi navigasi utama.

### Content Area

Menampilkan pekerjaan / informasi sesuai context.

---

# 5. Sidebar Teacher

Sidebar utama:

```text
Beranda

Hari Ini

Kelas Saya

Pembelajaran

Assessment

Siswa

AI Studio

Laporan

────────────

Akademik

Dokumen Saya

Pengaturan
```

Menu sehari-hari ditempatkan di atas.

Menu administrasi lanjutan ditempatkan lebih bawah.

Academic Context tidak boleh lebih menonjol dibanding aktivitas harian.

---

# 6. Mobile Navigation

Di HP, sidebar berubah menjadi bottom navigation.

Contoh:

```text
[Beranda]

[Hari Ini]

[Kelas]

[AI Studio]

[Lainnya]
```

Menu lain berada pada:

```text
Lainnya
│
├── Assessment
├── Siswa
├── Laporan
├── Akademik
├── Dokumen
└── Pengaturan
```

Aktivitas rutin seperti absensi harus nyaman digunakan melalui HP.

---

# 7. Design Tokens

Design system minimal memiliki:

```text
Color
Typography
Spacing
Radius
Shadow
Border
Iconography
Motion
```

Semua halaman menggunakan token yang sama.

Tidak boleh ada styling khusus yang tidak konsisten antar-modul.

---

# 8. Color System

Palet final brand dapat ditentukan kemudian.

Namun struktur warna harus menggunakan sistem:

```text
Primary
Secondary
Neutral
Success
Warning
Danger
Info
AI Accent
```

Prinsip:

### Primary
Digunakan untuk action utama.

### Neutral
Mendominasi tampilan aplikasi.

### Semantic Color

```text
Success → selesai / baik
Warning → perlu perhatian
Danger  → masalah / overdue
Info    → informasi
```

Warna tidak boleh menjadi satu-satunya indikator status.

Contoh:

```text
⚠ 5 siswa perlu remedial
```

bukan hanya card merah tanpa label.

---

# 9. AI Visual Language

Fitur AI harus terlihat berbeda, tetapi tidak terlalu mencolok.

Gunakan indikator seperti:

```text
✦ AI Generate
✦ AI Suggestion
✦ AI Insight
```

Tujuannya agar guru mengetahui:

> ini hasil AI,

bukan data faktual langsung dari sistem.

Perbedaan harus jelas antara:

```text
DATA
```

dan:

```text
AI INTERPRETATION
```

---

# 10. Typography

Gunakan font sans-serif modern yang mudah dibaca.

Hierarki:

```text
Display
Page Title
Section Heading
Body
Label
Caption
Helper Text
```

Prioritas:

- readability,
- angka mudah dibaca,
- tabel tidak terlalu kecil,
- tidak terlalu banyak variasi ukuran.

---

# 11. Spacing

Gunakan spacing system konsisten.

Contoh:

```text
4
8
12
16
24
32
48
```

Whitespace digunakan untuk memisahkan konteks.

Jangan menggunakan border untuk memisahkan semua elemen.

---

# 12. Component Library

Core component:

```text
Button
Input
Textarea
Select
Combobox
Checkbox
Radio
Switch
Date Picker
File Upload
Search
Card
Table
Tabs
Badge
Avatar
Tooltip
Dropdown
Modal
Drawer
Toast
Empty State
Skeleton
Progress
Alert
Pagination
```

Semua modul harus menggunakan component library yang sama.

---

# 13. Button Hierarchy

### Primary

Untuk action utama.

```text
[Simpan]
[Generate]
[Buat Assessment]
```

### Secondary

```text
[Preview]
[Edit]
```

### Tertiary

```text
[Batal]
[Lihat Detail]
```

### Destructive

```text
[Hapus]
```

Satu area idealnya hanya memiliki satu primary action.

---

# 14. Status System

Gunakan Badge untuk status.

Contoh:

```text
● Selesai
● Draft
● Belum Dinilai
● Remedial
● Terlambat
● Belum Mengumpulkan
```

Status harus konsisten di seluruh aplikasi.

---

# 15. Form Design

Form harus mengikuti prinsip:

> **Only ask what is needed.**

Tidak menampilkan seluruh opsi sekaligus.

Contoh Generate Soal:

```text
Materi
Jumlah Soal
Jenis Soal

[Generate]
```

Pilihan lanjutan:

```text
[Pengaturan Tambahan]
```

baru membuka:

- TP,
- level kognitif,
- tingkat kesulitan,
- distribusi soal,
- instruksi khusus.

---

# 16. Context Bar

Pada aktivitas yang memiliki context, tampilkan context secara konsisten.

Contoh:

```text
IPA  •  VIII A  •  Sistem Pernapasan
```

Guru dapat klik untuk mengubah context.

Tujuan:

> Guru selalu tahu sedang bekerja pada kelas/mapel apa.

---

# 17. Screen — Beranda

Struktur:

```text
Selamat siang, Pak Ahmad

────────────────────────────

HARI INI

08:00
IPA — VIII A
[Mulai]

10:00
IPA — VIII B
[Mulai]

────────────────────────────

PERLU PERHATIAN

12 nilai belum diinput

7 siswa belum mengumpulkan tugas

5 siswa direkomendasikan remedial

────────────────────────────

QUICK ACTION

[Absensi]
[Buat Soal]
[Input Nilai]
[Buat Materi]
```

Dashboard tidak dipenuhi statistik.

---

# 18. Screen — Hari Ini

Berorientasi timeline.

```text
Hari Ini
Senin, 16 Agustus

08:00–09:20

IPA — VIII A
Sistem Pernapasan

Absensi        ✓
Materi         ✓
Jurnal         Belum

[ Buka Pertemuan ]
```

Setiap class session memiliki progress sederhana.

---

# 19. Screen — Teaching Session

```text
← IPA — VIII A

Sistem Pernapasan
16 Agustus 2026 • 2 × 40 menit

[Absensi] [Tugas] [Materi]

────────────────────

Materi Hari Ini

Sistem Pernapasan

────────────────────

Aktivitas Pembelajaran

Diskusi kelompok...

────────────────────

Catatan

...

────────────────────

Jurnal

[Generate Jurnal]
```

Guru bekerja dalam satu context.

---

# 20. Screen — Absensi

Mobile-first.

```text
IPA VIII A
32 Siswa

[ Tandai Semua Hadir ]

Ahmad
● Hadir
○ Sakit
○ Izin
○ Alpha

Budi
● Hadir
○ Sakit
○ Izin
○ Alpha
```

Untuk mempercepat:

```text
Semua Hadir
↓
Guru hanya mengubah siswa yang tidak hadir
```

Ini lebih cepat daripada input satu per satu.

---

# 21. Screen — Kelas Saya

Card sederhana:

```text
VIII A

IPA

32 siswa

Pertemuan: 12
Nilai terakhir: 78

[ Buka Kelas ]
```

Tidak perlu terlalu banyak statistik di card.

---

# 22. Screen — Detail Kelas

Header:

```text
VIII A — IPA
32 siswa
```

Tabs:

```text
Overview
Pertemuan
Siswa
Tugas
Assessment
Nilai
Materi
```

Overview berisi:

- pertemuan terakhir,
- tugas aktif,
- assessment terakhir,
- siswa perlu perhatian,
- progress pembelajaran.

---

# 23. Screen — Assessment

Landing:

```text
Assessment

[ + Buat Assessment ]

────────────────────

UTS IPA
VIII A
32 siswa

Status:
Nilai 28 / 32

[ Input Nilai ]

────────────────────

Quiz Sistem Pernapasan
VIII B

Status:
Selesai

[ Lihat Analisis ]
```

---

# 24. Screen — Input Nilai

UX ini menjadi salah satu screen terpenting.

```text
UTS IPA — VIII A

Search Siswa...

Nama                    Nilai

Ahmad                  [ 82 ]

Budi                   [ 76 ]

Fauzan                 [ 91 ]

Rizky                  [    ]
```

Action:

```text
[Paste dari Excel]

[Import]

[Simpan]
```

Harus mendukung:

- keyboard navigation,
- Enter untuk pindah siswa,
- paste column dari spreadsheet,
- autosave,
- validasi angka,
- bulk input.

---

# 25. Screen — Analisis Nilai

Setelah nilai masuk:

```text
UTS IPA — VIII A

Rata-rata          76

Tertinggi          94

Terendah           52

Tuntas             25 siswa

Belum Tuntas        7 siswa
```

Kemudian:

```text
PERLU TINDAK LANJUT

7 siswa direkomendasikan remedial

[ Lihat Siswa ]
```

Jika TP tersedia:

```text
TP dengan pencapaian terendah:

TP 3 — 61%
```

---

# 26. Screen — Remedial

```text
Remedial — UTS IPA

☑ Budi       67
☑ Rizky      63
☑ Ahmad      70

[ Buat Program Remedial ]
```

Setelah remedial:

```text
Budi

Nilai Awal       67
Nilai Remedial   82
Nilai Final      82
```

---

# 27. Screen — Student 360°

```text
AHMAD FAUZAN
VIII A

────────────────────

Kehadiran        92%

Nilai Rata-rata  78

Tugas Belum       2

Remedial           1

────────────────────

Trend Akademik

[ chart ]

────────────────────

Perlu Perhatian

Nilai turun pada 3 assessment terakhir.

────────────────────

Tabs:

Overview
Nilai
Absensi
Tugas
Remedial
Catatan
```

Insight ditempatkan dekat data pendukungnya.

---

# 28. Screen — AI Studio

Landing menggunakan card besar:

```text
Apa yang ingin Anda buat?

RPP / Modul Ajar

Rencana Pembelajaran

PPT

LKPD

Worksheet

Materi

Kisi-kisi

Soal

Quiz

Konten Lainnya
```

Tidak dimulai dengan blank chatbot.

---

# 29. Screen — AI Generation Mode

Setelah memilih:

```text
Buat Soal
```

tampilkan dua card:

```text
┌──────────────────────────┐
│ ✦ OTOMATIS               │
│                          │
│ Gunakan data yang sudah  │
│ tersedia di sistem.      │
│                          │
│ [Gunakan Otomatis]       │
└──────────────────────────┘


┌──────────────────────────┐
│ MANUAL                   │
│                          │
│ Tentukan sendiri context │
│ dan kebutuhan.           │
│                          │
│ [Isi Manual]             │
└──────────────────────────┘
```

---

# 30. Screen — Automatic AI

```text
Buat PPT

Context yang akan digunakan:

IPA
VIII A
Sistem Pernapasan
2 × 40 menit

TP 3
RPP tersedia

[ Ubah Context ]

────────────────────

Instruksi Tambahan
[ Optional ]

[ ✦ Generate PPT ]
```

Academic context hanya ditampilkan jika tersedia.

---

# 31. Screen — Manual AI

Gunakan basic form terlebih dahulu.

```text
Buat Soal

Kelas
[ VIII ]

Mapel
[ IPA ]

Materi
[ Sistem Pernapasan ]

Pilihan Ganda
[ 20 ]

Essay
[ 5 ]

[ Pengaturan Tambahan ]

[ ✦ Generate ]
```

---

# 32. Screen — AI Result

Layout:

```text
HASIL GENERATE

Soal Sistem Pernapasan

────────────────────

1. ...
2. ...
3. ...

────────────────────

[Edit]

[Generate Ulang]

[Simpan]

[Download]

[Gunakan]
```

AI output selalu dianggap draft sampai guru memilih simpan/finalize.

---

# 33. Screen — Laporan

```text
Laporan

Apa yang ingin Anda buat?

[ Rekap Absensi ]

[ Rekap Nilai ]

[ Jurnal Mengajar ]

[ Analisis Hasil ]

[ Remedial ]

[ Perkembangan Siswa ]

[ Administrasi Rapor ]
```

Flow dibuat seperti wizard sederhana.

---

# 34. Screen — Report Preview

```text
Rekap Nilai IPA VIII A

Template:
Sekolah Saya

────────────────────

[ Preview Document ]

────────────────────

[Edit]

[Finalize]

[Download]
```

Finalized report disimpan sebagai snapshot.

---

# 35. Screen — Academic Context

Tidak boleh terasa seperti checklist wajib.

```text
Academic Context

Data ini membantu sistem memberi
analisis yang lebih mendalam.

Aplikasi tetap dapat digunakan
tanpa melengkapi seluruh bagian.

────────────────────

Kurikulum      ✓

CP             ✓

TP             70%

ATP            40%

Prota          -

Prosem         -
```

CTA:

```text
[ Lengkapi Jika Dibutuhkan ]
```

bukan:

```text
[ Wajib Lengkapi ]
```

---

# 36. Screen — Mid-Semester Onboarding

```text
Mulai dari mana?

○ Mulai dari sekarang

   Gunakan aplikasi mulai hari ini.

○ Tambahkan data semester sebelumnya

   Agar analisis semester lebih lengkap.
```

Jika histori:

```text
[Quick Backfill]

[Import Data]
```

Semua langkah dapat dilewati.

---

# 37. Screen — Parent Portal

Parent UI lebih sederhana.

```text
Selamat datang

AHMAD
VIII A

────────────────────

Kehadiran
92%

Nilai Terbaru
82

Tugas Belum
2

────────────────────

Perkembangan Terbaru

Nilai IPA meningkat...

────────────────────

Informasi Guru

...
```

Orang tua tidak melihat:

- konfigurasi assessment,
- Academic Context,
- AI Studio,
- internal note,
- internal analytics guru.

---

# 38. Chart & Data Visualization

Gunakan chart hanya jika membantu keputusan.

Prioritas:

- line chart → trend,
- bar chart → perbandingan,
- progress bar → pencapaian,
- distribution → hasil assessment.

Hindari:

- pie chart berlebihan,
- chart dekoratif,
- terlalu banyak grafik dalam satu halaman.

Data penting selalu tetap tersedia dalam angka/text.

---

# 39. Empty State

Setiap empty state harus menawarkan langkah berikutnya.

Contoh:

```text
Belum ada nilai untuk assessment ini.

[ Input Nilai ]

[ Import dari Excel ]
```

Bukan hanya:

```text
No Data
```

---

# 40. Loading State

Gunakan skeleton untuk halaman data.

Untuk AI:

```text
✦ Sedang menyusun materi...
```

Jika proses terdiri dari beberapa langkah, dapat menampilkan progress seperti:

```text
Membaca context
✓

Menyusun struktur
✓

Membuat konten
...
```

---

# 41. Error State

Error harus menggunakan bahasa yang membantu.

Jangan:

```text
Error 500
```

Gunakan:

```text
Nilai belum berhasil disimpan.

Data Anda masih aman.

[ Coba Lagi ]
```

Jika relevan.

---

# 42. Confirmation

Confirmation digunakan terutama untuk destructive action.

Contoh:

```text
Hapus assessment?

Data nilai yang terkait juga dapat terpengaruh.

[Batal]

[Hapus Assessment]
```

Tidak perlu confirmation untuk setiap action kecil.

---

# 43. Motion & Transition

Gunakan transition ringan:

- fade,
- slide,
- skeleton,
- smooth state change.

Durasi singkat.

Motion digunakan untuk membantu orientasi, bukan dekorasi.

---

# 44. Responsive Strategy

## Desktop / Laptop

Optimal untuk:

- input nilai massal,
- reporting,
- Academic Context,
- AI editing,
- analisis.

## Mobile

Optimal untuk:

- absensi,
- melihat agenda,
- catatan siswa,
- quick action,
- parent portal,
- monitoring sederhana.

Tidak semua screen desktop harus dipaksakan sama di HP.

---

# 45. Accessibility

Minimum:

- contrast jelas,
- ukuran font terbaca,
- click target cukup besar,
- keyboard navigation untuk desktop,
- form label jelas,
- status tidak bergantung pada warna,
- focus state terlihat.

---

# 46. Screen Priority untuk Development

Tidak semua screen dibuat sekaligus.

Priority:

```text
P0
App Shell
Login
Onboarding
Beranda
Hari Ini
Kelas Saya

P1
Teaching Session
Absensi
Input Nilai
Assessment
Student 360°

P2
AI Studio
AI Generator
Pembelajaran
Reporting

P3
Academic Context
Template Management
Parent Portal
Advanced Analytics
```

Urutan final development akan ditentukan pada Stage 09.

---

# 47. UI Philosophy

UI Teacher Assistant harus terasa:

```text
MUDAH
↓
CEPAT
↓
TENANG
↓
KONTEKSTUAL
↓
PINTAR
```

Bukan:

```text
BANYAK MENU
↓
BANYAK FORM
↓
BANYAK DATA
↓
BANYAK DASHBOARD
```

---

# 48. Prinsip Final Stage 08

1. **Complex System, Simple Interface**
2. **Daily Work First**
3. **Task-Based UI**
4. **Minimum Click**
5. **Context Aware**
6. **Progressive Disclosure**
7. **AI Clearly Identified**
8. **Data ≠ AI Interpretation**
9. **Mobile Friendly for Daily Tasks**
10. **Desktop Optimized for Heavy Work**
11. **Optional Data Never Feels Mandatory**
12. **Fast Score Input is Critical UX**
13. **Consistent Components Everywhere**
14. **Useful Empty & Error States**
15. **Teacher Workflow Over Dashboard Decoration**

---

# 49. Status

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
09. PRD / DEVELOPMENT STAGES           ← NEXT
        ↓
10. DEVELOPMENT
        ↓
11. TESTING / QA
        ↓
12. PRODUCTION
        ↓
13. ITERATION
```

**STAGE 08 — UI DESIGN SYSTEM & SCREEN DESIGN: COMPLETE**