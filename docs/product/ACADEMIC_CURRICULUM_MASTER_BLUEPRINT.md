# OS Teacher: Blueprint Spesifikasi Modul Perencanaan Akademik & Kurikulum (CP, TP/ATP, PROTA & PROSEM Engine)

> **Dokumen Arsitektur & Spesifikasi Desain BMad**  
> **Versi:** 1.0  
> **Target:** Modul Akademik & Kurikulum (`/akademik`), AI Studio (`/ai-studio`), dan Jurnal Pertemuan (`/kelas/[id]/pertemuan`)  
> **Tim Penyusun BMad:** Mary (Business Analyst), Sally (UX Designer), Winston (System Architect), Amelia (Senior Dev)  
> **Status:** Siap Dieksekusi (*Ready for Phased Delivery*)  

---

## 1. Ringkasan Eksekutif & Nilai Produk

### A. Latar Belakang Masalah (Analisis *Screenshot* & Audit Sistem)
Pada implementasi sebelumnya, modul **Akademik & Kurikulum** (khususnya tab **Program Perencanaan / PROTA-PROSEM**) memiliki friksi tinggi bagi guru:
1. **Beban Input Manual Tinggi (*High Friction*):** Guru harus menambah item bab, mengetik judul, memilih bulan, dan menginput JP satu per satu secara berulang.
2. **Redundansi Data:** Terdapat pemisahan kaku antara tab *Tujuan Pembelajaran (TP)* dan tab *Prota/Prosem*, memaksa guru mengetik ulang data yang sama (melanggar prinsip produk: *"Input Once, Use Everywhere"*).
3. **Format Tidak Standar Dinas:** Tampilan lama hanya menyimpan *dropdown* bulan statis (1-12), padahal standar administrasi sekolah di Indonesia menuntut **Matriks Mingguan (Bulan & Pekan 1-5)**.
4. **Resiko Perbedaan Buku Pegangan:** Di lapangan, guru sering menggunakan buku terbitan swasta (Erlangga, Yudhistira, dll.) yang daftar babnya berbeda dengan CP generik kementerian.

### B. Visi Solusi (*The Outcome*)
Mentransformasi modul akademik menjadi **AI-Assisted Curriculum Planning Engine** yang:
1. **Fleksibel Menangkap Materi:** Mendukung 3 cara input materi (Generate Otomatis dari CP, **Scan/Foto Daftar Isi Buku Fisik via AI OCR**, atau Tempel Teks Bebas).
2. **Otomatisasi Hitung JP & Distribusi Mingguan:** Menghitung total jam efektif dan menyusun draf PROTA & PROSEM Matriks dalam hitungan detik.
3. **Editor Matriks Interaktif:** Menyediakan grid tabel mingguan yang mudah diedit langsung (*inline-edit*) dan divalidasi keseimbangan jamnya (*zero manual calculation*).
4. **Export Dokumen Resmi:** 1-klik unduh file Excel (`.xlsx`) matriks resmi dinas dan Word (`.docx`) siap cetak & tanda tangan.
5. **Koneksi Hilir (*Downstream Value*):** Data Prosem otomatis menjadi panduan materi di Jurnal Mengajar Harian dan penyedia konteks instan di AI Studio.

---

## 2. Analisis Domain Kurikulum Indonesia (Mary - Business Analyst)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STRUKTUR ADMINISTRASI PERENCANAAN KURIKULUM (INDONESIAN CURRICULUM REALITIES)          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                        │
│ 1. CAPAIAN PEMBELAJARAN (CP)                                                           │
│    Standar kompetensi per fase (Fase A s.d. Fase F) yang ditetapkan pemerintah.        │
│                                │                                                       │
│                                ▼                                                       │
│ 2. TUJUAN PEMBELAJARAN (TP) & ALUR (ATP)                                               │
│    Penjabaran CP menjadi poin-poin kompetensi materi dan urutan pembelajarannya.       │
│                                │                                                       │
│                                ▼                                                       │
│ 3. PROGRAM TAHUNAN (PROTA)                                                             │
│    Pemetaan alokasi total Jam Pelajaran (JP) dalam 1 tahun ajaran (Semester 1 & 2).    │
│    Total JP = (Jumlah Pekan Efektif Sem 1 + Sem 2) × Beban JP/Minggu.                  │
│                                │                                                       │
│                                ▼                                                       │
│ 4. PROGRAM SEMESTER (PROSEM / PROMES)                                                  │
│    Distribusi materi dan alokasi JP ke dalam matriks bulan & pekan mingguan.           │
│    - Semester Ganjil: Juli s.d. Desember (Bulan 7–12, masing-masing 4–5 pekan).        │
│    - Semester Genap: Januari s.d. Juni (Bulan 1–6, masing-masing 4–5 pekan).           │
│    - Menyisipkan slot non-KBM: Sumatif Tengah Semester (STS), Sumatif Akhir            │
│      Semester (SAS), Pengolahan Rapor, dan Cadangan/Remedial.                          │
│                                                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Arsitektur Data & Skema Database (Winston - System Architect)

### A. Perubahan Model Prisma (`prisma/schema.prisma`)

```prisma
// 1. Tambahan konfigurasi di AcademicContextProfile
model AcademicContextProfile {
  id                String          @id @default(cuid())
  teachingContextId String          @unique
  teachingContext   TeachingContext @relation(fields: [teachingContextId], references: [id], onDelete: Restrict)
  curriculumName    String?         // e.g. "Kurikulum Merdeka"
  phase             String?         // e.g. "Fase E (Kelas 10)"
  academicNote      String?         @db.Text
  cpText            String?         @db.Text

  // Config beban & kalender akademik
  hoursPerWeek      Int             @default(3)   // Beban mengajar jam/minggu (e.g. 2, 3, 4 JP)
  effectiveWeeksSem1 Int            @default(18)  // Pekan efektif semester ganjil
  effectiveWeeksSem2 Int            @default(16)  // Pekan efektif semester genap

  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  @@map("academic_context_profile")
}

// 2. Hubungan Langsung TP ke Alokasi Jam & Rencana Mengajar
model LearningObjective {
  id                String          @id @default(cuid())
  teachingContextId String
  teachingContext   TeachingContext @relation(fields: [teachingContextId], references: [id], onDelete: Restrict)
  code              String?         // e.g. "TP-10.1"
  description       String          @db.Text
  orderIndex        Int             @default(0)
  targetSemester    Int?            @default(1)   // 1 = Ganjil, 2 = Genap
  allocatedHours    Int?            @default(6)   // Estimasi JP untuk TP ini
  status            EntityStatus    @default(ACTIVE)
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  sessionLinks      TeachingSessionLearningObjective[]
  assessmentLinks   AssessmentLearningObjective[]
  planItems         AcademicPlanItem[]

  @@index([teachingContextId, status])
  @@index([teachingContextId, orderIndex])
  @@map("learning_objective")
}

// 3. Enum Kategori Item Perencanaan
enum PlanItemCategory {
  REGULAR_MATERIAL // Materi pokok / Bab
  STS              // Asesmen Sumatif Tengah Semester (UTS)
  SAS              // Asesmen Sumatif Akhir Semester (UAS)
  RESERVE          // Cadangan / Pengayaan / Remedial
}

// 4. Upgrade AcademicPlanItem untuk Matriks Mingguan
model AcademicPlanItem {
  id                  String             @id @default(cuid())
  teachingContextId   String
  teachingContext     TeachingContext    @relation(fields: [teachingContextId], references: [id], onDelete: Restrict)
  learningObjectiveId String?
  learningObjective   LearningObjective? @relation(fields: [learningObjectiveId], references: [id], onDelete: SetNull)

  planType            AcademicPlanType   // PROTA atau PROSEM
  category            PlanItemCategory   @default(REGULAR_MATERIAL)
  title               String             // Judul Bab / Materi Pokok
  targetSemester      Int                @default(1) // 1 = Ganjil, 2 = Genap
  allocatedHours      Int                // Total alokasi jam untuk materi ini
  notes               String?            @db.Text
  orderIndex          Int                @default(0)

  // Distribusi Mingguan (JSON Array)
  // Format: [ { "month": 7, "week": 3, "hours": 3 }, { "month": 7, "week": 4, "hours": 3 } ]
  weeklyDistribution  Json?

  status              EntityStatus       @default(ACTIVE)
  createdAt           DateTime           @default(now())
  updatedAt           DateTime           @updatedAt

  @@index([teachingContextId, planType, status])
  @@index([teachingContextId, targetSemester, orderIndex])
  @@map("academic_plan_item")
}
```

---

## 4. Alur Kerja Pengguna & Interaksi UX (Sally - UX Designer)

### A. Navigasi Terpadu (2 Tab Ringkas)
Mengganti 3 tab lama yang membingungkan menjadi **2 Tab Komprehensif**:
* **Tab 1: Profil Kurikulum & Capaian (CP):** Konteks umum, Fase, Beban Jam/Minggu, dan Input CP.
* **Tab 2: Alur TP & Matriks Perencanaan (Prota/Prosem):** Ruang kerja visual interaktif untuk alur TP, PROTA, dan PROSEM.

---

### B. Wizard Pembuatan Materi: Pilihan 3 Sumber Fleksibel

Ketika guru menekan tombol **`✨ Buat / Generate Rencana Pembelajaran`**, dialog modal interaktif muncul:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🚀 Mulai Perencanaan Akademik (Pilih Sumber Materi)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ [ 🌐 1. Generate Otomatis dari Capaian Pembelajaran (CP) ]                 │
│   Cocok untuk kurikulum baru atau jika belum memiliki buku referensi.       │
│   AI mengekstrak TP dan menyusun alokasi waktu standar secara otomatis.     │
│                                                                             │
│ [ 📸 2. Scan / Upload Foto Daftar Isi Buku Paket ]  ⭐️ REKOMENDASI GURU     │
│   Ambil foto halaman "Daftar Isi" buku cetak Anda (Erlangga/Yudhistira/dll)  │
│   AI Vision membaca judul bab dan menyelaraskan 100% dengan buku siswa.     │
│                                                                             │
│ [ ✍️ 3. Tempel / Tulis Daftar Bab Bebas (Copy-Paste) ]                      │
│   Punya silabus sendiri di Word/PDF? Cukup tempel daftar bab Anda di sini.  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### C. Komponen Matriks Mingguan Interaktif (`InteractiveProsemGrid`)

Tampilan visual berupa tabel matriks yang responsif dan mendukung pengeditan instan:

```text
Semester: [ Ganjil (Juli - Des) ▼ ]   Beban: 3 JP/Minggu   Total Terjadwal: [ 54 / 54 JP ✅ Seimbang ]

┌────┬─────────────────────────────┬────┬───────────┬───────────┬───────────┬───────────┬───────────┬───────────┐
│ NO │ MATERI / TUJUAN PEMBELAJARAN│ JP │ JULI      │ AGUSTUS   │ SEPTEMBER │ OKTOBER   │ NOVEMBER  │ DESEMBER  │
│    │                             │    │ 1 2 3 4 5 │ 1 2 3 4 5 │ 1 2 3 4 5 │ 1 2 3 4 5 │ 1 2 3 4 5 │ 1 2 3 4 5 │
├────┼─────────────────────────────┼────┼───────────┼───────────┼───────────┼───────────┼───────────┼───────────┤
│ 1  │ Bab 1: Teks Lap. Observasi  │ 12 │ · · 3 3 · │ 3 3 · · · │ · · · · · │ · · · · · │ · · · · · │ · · · · · │
│ 2  │ Bab 2: Teks Anekdot         │ 15 │ · · · · · │ · · 3 3 3 │ 3 3 · · · │ · · · · · │ · · · · · │ · · · · · │
│ 3  │ Sumatif Tengah Sem. (STS)   │ 3  │ · · · · · │ · · · · · │ · · 3 · · │ · · · · · │ · · · · · │ · · · · · │
│ 4  │ Bab 3: Cerita Hikayat       │ 12 │ · · · · · │ · · · · · │ · · · 3 3 │ 3 3 · · · │ · · · · · │ · · · · · │
│ 5  │ Bab 4: Teks Negosiasi       │ 9  │ · · · · · │ · · · · · │ · · · · · │ · · 3 3 3 │ · · · · · │ · · · · · │
│ 6  │ Sumatif Akhir Sem. (SAS)    │ 3  │ · · · · · │ · · · · · │ · · · · · │ · · · · · │ · · · · 3 │ · · · · · │
└────┴─────────────────────────────┴────┴───────────┴───────────┴───────────┴───────────┴───────────┴───────────┘
```

**Fitur Grid:**
* **Klik Sel untuk Toggle Jam:** Klik sel kosong untuk mengisi `3 JP` (atau nilai custom).
* **Inline Edit Judul:** Klik langsung teks nama bab untuk mengubah judul materi tanpa dialog popup.
* **Smart Validation Badge:** Indikator di header yang memberi tahu jika jumlah jam belum genap (*"Kurang 3 JP"* / *"Kelebihan 2 JP"* / *"Pas 54 JP"*).
* **Tombol Cepat:** `[+ Tambah Materi]`, `[+ Sisipkan STS/SAS]`, `[🔄 Reset AI Distribution]`.

---

## 5. Mesin AI & Multi-Modal Processing (Amelia - Senior Dev)

### A. Algoritma Perhitungan & Distribusi Waktu (AI Core Logic)

1. **Kalkulasi Jam Semester:**
   $$\text{Target JP Semester} = \text{Pekan Efektif} \times \text{Beban Jam per Minggu}$$
   *Contoh:* $18 \text{ pekan} \times 3 \text{ JP} = 54 \text{ JP}$.

2. **Aturan Proporsionalitas Pembagian Bab:**
   * **Materi Pokok:** 75% – 80% dari total jam.
   * **Asesmen Tengah Semester (STS):** 1 pekan (3 JP) di pekan ke-8 atau ke-9 (September).
   * **Asesmen Akhir Semester (SAS):** 1 pekan (3 JP) di pekan ke-16 atau ke-17 (Desember).
   * **Cadangan / Remedial / P5:** 1–2 pekan (3–6 JP).

3. **Prompt AI Vision untuk Ekstraksi Daftar Isi Buku:**
   ```typescript
   export const EXTRACT_TOC_PROMPT = `
   Anda adalah asisten kurikulum ahli di Indonesia. Analisis foto Daftar Isi buku pelajaran berikut.
   Ekstrak struktur bab dan sub-bab secara berurutan.
   
   Output JSON yang wajib dihasilkan:
   {
     "bookTitle": "string",
     "chapters": [
       {
         "chapterNumber": 1,
         "title": "Judul Bab",
         "subTopics": ["Sub Bab A", "Sub Bab B"],
         "suggestedHours": 12,
         "suggestedSemester": 1
       }
     ]
   }
   `;
   ```

---

## 6. Mesin Export Dokumen Resmi Dinas (Excel & Word)

### A. Format Output Excel (`.xlsx`)
Menggunakan `exceljs` untuk merender berkas spreadsheet dengan spesifikasi:
1. **Header Administratif:** Logo/Kop Sekolah, Nama Mata Pelajaran, Kelas/Fase, Semester, Tahun Pelajaran, Nama Guru Pengampu, NIP.
2. **Tabel Matriks Berwarna:**
   * Merge Cell baris bulan (Juli: Kolom 1-5, dst).
   * Shading warna khusus untuk pekan STS (Kuning Muda), SAS (Biru Muda), dan Libur Semester (Abu-abu).
   * Rumus `SUM` otomatis pada kolom Total JP per baris dan per bulan.
3. **Bagian Validasi & Pengesahan:**
   * Tanggal penetapan dokumen (e.g. *"Jakarta, 15 Juli 2026"*).
   * Kolom Tanda Tangan Mengetahui: **Kepala Sekolah** dan **Guru Mata Pelajaran**.

---

## 7. Integrasi Downstream (Koneksi ke Seluruh Ekosistem Aplikasi)

### A. Jurnal Pertemuan Harian (`/kelas/[id]/pertemuan`)
* Saat guru membuat atau membuka sesi pertemuan:
* Sistem membaca tanggal saat ini (misal: 20 Agustus / Minggu ke-3 Agustus).
* Sistem menampilkan *smart recommendation chip*:
  > 💡 *"Rekomendasi Prosem Minggu Ini: **Bab 2: Teks Anekdot (3 JP)**. Terapkan ke Jurnal?"*
* Guru klik **`Terapkan`** ➔ Judul materi dan TP langsung terisi tanpa ketik ulang.

### B. Shortcut AI Content Studio (`/ai-studio`)
* Di samping setiap baris bab di matriks PROSEM, terdapat tombol aksi cepat:
  * `[📄 Buat Modul Ajar]` ➔ Membuka AI Studio dengan form terisi lengkap untuk Bab tersebut.
  * `[📝 Buat Soal Formatif]` ➔ Menghasilkan 5-10 butir soal kuis sesuai cakupan materi bab.
  * `[📑 Buat LKPD]` ➔ Menghasilkan Lembar Kerja Peserta Didik siap pakai.

---

## 8. Rencana Tahapan Eksekusi (Implementation Phases)

| Fase | Nama Modul / Deliverable | Deskripsi Pekerjaan | Estimasi Output |
| :---: | :--- | :--- | :--- |
| **Fase 1** | **Database & Schema Upgrade** | Update Prisma model (`AcademicContextProfile`, `LearningObjective`, `AcademicPlanItem` + `weeklyDistribution`), run migration, perbarui Typescript types. | Schema & Types siap |
| **Fase 2** | **AI Engine & Extraction Services** | Buat Server Actions: `extractCurriculumMaterialAction` (Vision/OCR + Text), `generateAcademicPlanAction` (Auto-distribute engine), dan `refineAcademicPlanAction`. | AI Service siap diuji |
| **Fase 3** | **Interactive Matrix UI & Source Dialog** | Bangun dialog modal pemilihan sumber (CP / Scan Buku / Paste Teks) dan komponen grid interaktif `InteractiveProsemGrid.tsx` dengan inline editing & live balance indicator. | UI Frontend interaktif |
| **Fase 4** | **Official Document Export Engine** | Bangun endpoint export file Excel `.xlsx` format matriks dinas dan Word `.docx` siap cetak. | Download dokumen resmi |
| **Fase 5** | **Downstream Integration Loop** | Integrasikan data Prosem ke *auto-suggest* pertemuan harian (`/pertemuan`) dan tombol *Quick Generate* di AI Studio. | Fitur terhubung end-to-end |
| **Fase 6** | **QA, Security & E2E Validation** | Unit test kalkulasi alokasi jam, RBAC security verification, dan pengetesan alur pengguna lengkap. | Siap rilis ke produksi |

---

## 9. Kesimpulan & Nilai Tambah

Dengan implementasi blueprint ini:
1. **Beban Administrasi Guru Turun Drastis:** Dari mengetik manual berjam-jam menjadi cukup foto daftar isi buku atau 1-klik AI.
2. **Kesesuaian Nyata 100%:** Guru tidak khawatir materi AI melenceng dari buku fisik yang dipegang siswa di kelas.
3. **Kepatuhan Supervisi Dinas:** Guru langsung memiliki file Excel/Word resmi siap cetak untuk diserahkan ke Kepala Sekolah dan Pengawas.
4. **Ekosistem Aplikasi Terintegrasi Penuh:** Perencanaan di awal tahun langsung memandu aktivitas mengajar harian dan pembuatan materi AI sepanjang semester.
