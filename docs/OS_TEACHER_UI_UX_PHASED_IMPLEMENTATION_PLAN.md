# OS Teacher: Rencana Implementasi Bertahap UI/UX (Phased Master Plan)

> **Dokumen Arsitektur & Panduan Eksekusi BMad**  
> **Versi:** 2.0  
> **Target:** Transformasi Holistik OS Teacher (Daily Teaching Workspace)  
> **Penulis:** Tim BMad (Sally - UX Designer & Winston - Architect)  
> **Status:** Siap Eksekusi (*Ready for Phased Delivery*)

---

## 1. Ringkasan Eksekutif & Visi Produk

Aplikasi ini sedang bertransformasi dari sekadar **kumpulan fitur admin/utilitas AI (*Feature Soup / Admin Grid*)** menjadi **Teacher Operating System (OS Teacher)** yang sesungguhnya.

### Tujuan Utama:
1. **Mengurangi Beban Kognitif (*Zero Cognitive Friction*):** Guru tidak lagi dihadapkan pada navigasi rumit (seperti 13 tab horizontal di dalam kelas).
2. **Berorientasi Tindakan (*Action-Oriented*):** Beranda menjadi *Daily Command Center* yang langsung menjawab *"Apa yang harus saya ajar hari ini?"* dan *"Tugas apa yang belum saya nilai?"*.
3. **Menghilangkan Dinding Adopsi (*Adoption-Friendly*):** Memudahkan pembagian laporan ke orang tua melalui WhatsApp tanpa memaksa orang tua membuat akun email yang rumit.
4. **AI yang Tertanam (*In-Situ AI*):** AI hadir langsung di dalam formulir tugas dan sesi mengajar, bukan terisolasi di satu halaman tersendiri.

---

## 2. Design System & Semantic Color Tokens

Desain visual mengadopsi standar **Deep Navy & AI Purple** yang memisahkan secara jelas antara tanggung jawab administratif sekolah dan daya ungkit kecerdasan buatan:

| Token Semantik | Kode Warna | Peran dalam UX |
| :--- | :---: | :--- |
| **Primary Navy** | `#1E293B` | Identitas utama sekolah, stabilitas institusional, navigasi primer. |
| **AI Purple** | `#7C3AED` | Aksi cerdas AI co-pilot, tombol generator, dan fitur otomatisasi. |
| **Education Green** | `#16A34A` | Status kehadiran, kelulusan KKM, dan kesiapan materi ajar. |
| **Teacher Amber** | `#F59E0B` | Tugas yang butuh perhatian guru, koreksi esai, dan antrean nilai. |
| **Surface Background**| `#F8FAFC` | Latar belakang lembut yang nyaman untuk mata guru berjam-jam. |

---

## 3. Peta Rincian Fase Eksekusi (Phased Delivery Roadmap)

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│ PETA 4 FASE TRANSFORMASI UI/UX OS TEACHER                                       │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ FASE 1: KONSOLIDASI TAB KELAS (13 Tab ──> 4 Ruang Kerja Terpadu)             │ │
│ │ • Menata ulang KelasTabs.tsx menjadi 4 domain logis                          │ │
│ │ • Sub-navigation pills responsif & clean                                     │ │
│ │ • Nol risiko backend (Murni optimasi layout frontend)                        │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│                                        ▼                                         │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ FASE 2: DAILY COMMAND CENTER & UNIFIED GRADING INBOX                         │ │
│ │ • Interactive Schedule Stream di Beranda (Timeline Hari Ini)                 │ │
│ │ • Kotak Tugas & Penilaian Tertunda (Agregasi Asesmen & Esai Lintas Kelas)    │ │
│ │ • Penyatuan alur /hari-ini dan Beranda (Eliminasi redundansi)                │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│                                        ▼                                         │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ FASE 3: WHATSAPP-FIRST PARENT ACCESS (Magic Link & Digital Report Card)      │ │
│ │ • Tombol 1-klik "Salin Pesan WA" & Batch Link Generator untuk Guru           │ │
│ │ • Rute publik /p/[token] ramah mobile tanpa kewajiban login email            │ │
│ │ • Digital Student Progress Card (Kehadiran %, Nilai Ujian, Catatan Guru)     │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
│                                        ▼                                         │
│ ┌──────────────────────────────────────────────────────────────────────────────┐ │
│ │ FASE 4: IN-SITU AI CO-PILOT INTEGRATION                                      │ │
│ │ • Tombol bantuan AI di form Tugas (Generate Rubrik & Kisi-kisi)              │ │
│ │ • Tombol ringkas AI di Jurnal Sesi Pembelajaran                              │ │
│ └──────────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

###  FASE 1: Konsolidasi 13 Tab Kelas Menjadi 4 Ruang Kerja Terpadu

#### A. Latar Belakang & Masalah
Saat ini halaman detail kelas (`/kelas/[id]`) memiliki 13 tab horizontal berderet yang sering terpotong di layar laptop/tablet, memicu kebingungan navigasi, dan memecah aktivitas yang sebenarnya berhubungan erat.

#### B. Solusi Desain (4 Ruang Kerja Utama):
1. ** Ruang Mengajar (`icon: BookOpen`)**
   * *Sub-item:* Pertemuan & Sesi (`/pertemuan`), Presensi Harian (`/absensi`), Jurnal Mengajar (`/jurnal`), Ringkasan Kelas (`/`).
2. ** Nilai & Evaluasi (`icon: Award`)**
   * *Sub-item:* Lembar Penilaian (`/penilaian`), Tugas Siswa (`/tugas`), Pengaturan Bobot Nilai (`/pengaturan-nilai`).
3. ** Siswa & Komunikasi (`icon: Users`)**
   * *Sub-item:* Daftar Siswa (`#roster`), Monitoring Siswa (`/monitoring`), Akses Orang Tua (`/orang-tua`).
4. ** Administrasi & Rapor (`icon: FileText`)**
   * *Sub-item:* Rekap Rapor (`/laporan`), Capaian Pembelajaran CP/TP (`/akademik`), Impor Data (`/import`).

#### C. File yang Terdampak:
* `src/app/(dashboard)/kelas/[teachingContextId]/KelasTabs.tsx` (Perombakan komponen tab)
* `src/app/(dashboard)/kelas/[teachingContextId]/layout.tsx` (Penyesuaian wrapper)
* `src/app/(dashboard)/kelas/[teachingContextId]/akademik/page.tsx` (Pembersihan duplikasi)
* `src/app/(dashboard)/kelas/[teachingContextId]/laporan/page.tsx` (Pembersihan duplikasi)
* `src/app/(dashboard)/kelas/[teachingContextId]/orang-tua/page.tsx` (Pembersihan duplikasi)

#### D. Kriteria Keberhasilan (*Quality Gate*):
*  Semua 13 URL sub-halaman tetap dapat diakses langsung (*100% backward compatible*).
*  Tidak ada tab yang terpotong di layar standar 13 inch (1280px) maupun mobile.
*  Sub-pills aktif otomatis menyesuaikan dengan rute yang sedang dibuka.
*  `npm run test` lolos 100%.

---

### ⚡ FASE 2: Daily Command Center & Unified Grading Inbox

#### A. Latar Belakang & Masalah
* Beranda saat ini belum menampilkan jadwal harian secara interaktif.
* Menu `/hari-ini` menduplikasi fungsi Beranda.
* Tugas yang belum dinilai dan esai kuis yang butuh koreksi manual tersembunyi jauh di dalam masing-masing kelas.

#### B. Solusi Desain:
1. **Interactive Schedule Stream (Timeline Sesi Mengajar Hari Ini):**
   * Menampilkan seluruh sesi mengajar hari ini dengan status (*Sedang Berlangsung / Selesai / Terjadwal*).
   * Tombol aksi langsung: `[ ▶ Buka Sesi & Presensi ]`, `[ ✨ Slide PPT ]`.
   * Mode refleksi ramah jika tidak ada jadwal aktif di hari tersebut.
2. **Unified Grading Inbox (Kotak Masuk Penilaian Terpadu):**
   * Mengagregasi seluruh asesmen yang masih memiliki nilai berstatus `PENDING` di semua kelas.
   * Mengintegrasikan alert kuis esai berstatus `NEEDS_GRADING`.
   * Menampilkan *progress bar* penilaian (misal: `22/32 Siswa Dinilai`) dan tombol jalan pintas `[ Input Nilai Cepat → ]`.
3. **Penyelarasan Hari Ini (`HariIniClient.tsx`):**
   * Memperbarui visual `/hari-ini` agar selaras 100% dengan token v2 (*Deep Navy & AI Purple*).

#### C. File yang Terdampak:
* `src/app/(dashboard)/page.tsx` (Integrasi Schedule Timeline & Grading Inbox)
* `src/app/(dashboard)/hari-ini/HariIniClient.tsx` (Refactor visual v2)

#### D. Kriteria Keberhasilan (*Quality Gate*):
*  Guru melihat daftar tugas yang belum dinilai dari seluruh kelas dalam 1 layar.
*  Klik tombol *Input Nilai Cepat* langsung membuka lembar nilai kelas terkait dalam 1 klik.
*  Timeline sesi hari ini menampilkan status kehadiran siswa secara real-time.
*  `npm run test` & `npm run build` lolos tanpa error.

---

### 📲 FASE 3: WhatsApp-First Parent Access (Magic Link + Digital Report Card)

#### A. Latar Belakang & Masalah
Alur undangan orang tua saat ini mengharuskan guru memasukkan email 36 siswa satu per satu dan memaksa orang tua membuat akun email baru. Ini menyebabkan tingkat kegagalan/drop-off > 70% di lapangan.

#### B. Solusi Desain:
1. **Teacher Side (`TeacherParentAccessManager.tsx`):**
   * Menambahkan tombol **`[ ⚡ Generate Tautan Semua Siswa (Batch WA) ]`**.
   * Menambahkan tombol **`[ 📲 Salin Pesan WA ]`** per siswa dengan template siap kirim ke WhatsApp wali murid.
   * Menambahkan tombol **`[ 📥 Salin Semua Link ]`** untuk rekap wali kelas.
2. **Public Parent Route (`/p/[token]`):**
   * Rute publik yang cepat dan ramah mobile.
   * Menampilkan **Digital Student Report Card**:
     * Identitas Siswa & Mata Pelajaran.
     * Rekap Kehadiran (Hadir %, Sakit, Izin, Alpa).
     * Nilai Asesmen & Ujian Resmi yang telah berstatus `GRADED` (dengan badge Tuntas/Remedial).
     * Pesan dukungan untuk orang tua.
   * Menjaga privasi penuh: catatan refleksi internal guru dan draf AI tetap disembunyikan.

#### C. File yang Terdampak:
* `src/modules/parent/parent.service.ts` (Fungsi `getPublicStudentReportByToken` & `batchCreateParentInvitations`)
* `src/modules/parent/parent.actions.ts` (Server actions baru)
* `src/app/(dashboard)/kelas/[teachingContextId]/orang-tua/TeacherParentAccessManager.tsx` (Tab WhatsApp Batch)
* `src/app/p/[token]/page.tsx` (Rute publik baru)
* `src/app/p/[token]/ParentStudentReportClient.tsx` (Komponen kartu laporan digital mobile-first)

#### D. Kriteria Keberhasilan (*Quality Gate*):
*  Guru bisa membuat tautan untuk 36 siswa hanya dalam **1 klik (< 5 detik)**.
*  Format pesan WhatsApp otomatis menyertakan nama siswa dan link yang valid.
*  Orang tua dapat membuka link di handphone langsung melihat kehadiran dan nilai tanpa harus mendaftar email.
*  Data privat internal guru tetap terisolasi dengan aman.

---

### 🤖 FASE 4: In-Situ AI Co-Pilot Integration

#### A. Latar Belakang & Masalah
Saat ini AI hanya bisa diakses dengan membuka halaman terpisah `/ai-studio`. Guru harus menyalin-tempel teks secara manual ke lembar tugas atau catatan pertemuan.

#### B. Solusi Desain:
1. **AI di Lembar Tugas (`src/app/(dashboard)/kelas/[id]/tugas`):**
   * Tombol *`[ ✨ AI: Buat Rubrik & Kriteria Penilaian ]`* langsung di modal pembuatan tugas baru.
2. **AI di Jurnal Pertemuan (`src/app/(dashboard)/kelas/[id]/pertemuan/[sessionId]`):**
   * Tombol *`[ ✨ AI: Rangkum Jurnal Mengajar ]`* yang otomatis menyusun deskripsi ketercapaian materi dari topik yang diajarkan.

#### C. File yang Terdampak:
* `src/app/(dashboard)/kelas/[teachingContextId]/tugas/TugasClient.tsx`
* `src/app/(dashboard)/kelas/[teachingContextId]/pertemuan/[sessionId]/SessionClient.tsx`

#### D. Kriteria Keberhasilan (*Quality Gate*):
*  Guru dapat menghasilkan rubrik penilaian langsung di form tugas tanpa keluar dari halaman kelas.
*  Hasil AI terisi langsung ke input form tanpa perlu copy-paste manual.

---

## 4. Protokol Keamanan & Mitigasi Risiko Eksekusi

Untuk memastikan pengerjaan berjalan mulus tanpa merusak stabilitas kode:

1. **Atomic Commits Per Phase:**
   Setiap fase diselesaikan dengan commit lokal mandiri sehingga riwayat git bersih dan dapat di-*rollback* per modul jika diperlukan:
   * `feat(ux): fase 1 - consolidate class tabs into 4 workspaces`
   * `feat(ux): fase 2 - unified grading inbox & daily command center`
   * `feat(parent): fase 3 - whatsapp-first magic link & batch student report`
   * `feat(ai): fase 4 - in-situ ai copilot in assignments and sessions`
2. **Zero Breaking Schema Policy:**
   Semua perubahan memanfaatkan skema Prisma dan tabel relasi yang sudah ada tanpa melakukan *destructive migration*.
3. **Automated Verification Loop:**
   Setiap fase wajib lolos:
   * `npm run test` (449 unit & integration tests)
   * `npm run build` (Next.js 16 production build)
   * `npm run lint`

---

## 5. Matriks Dampak Sebelum vs Sesudah

| Indikator Kerja Guru | Kondisi Saat Ini (Sebelum) | Kondisi Target (Sesudah) | Dampak Nyata |
| :--- | :--- | :--- | :---: |
| **Navigasi Tab di Detail Kelas** | 13 Tab berjejal & terpotong di layar | 4 Ruang Kerja Inti terstruktur | 📉 **Beban Kognitif Turun 75%** |
| **Pengecekan Nilai Tertunda** | Harus klik 5-8 kelas satu per satu | Terlihat langsung di Beranda (Grading Inbox) | ⚡ **Pangkas waktu dari 15 mnt $\rightarrow$ 5 dtk** |
| **Distribusi Laporan ke Orang Tua** | Ketik email 36 siswa $\rightarrow$ Ortu wajib login | 1-Klik Salin Format WA Sekelas $\rightarrow$ Buka instan | 📈 **Adopsi Ortu Naik dari 20% $\rightarrow$ >85%** |
| **Pemanfaatan Asisten AI** | Harus bolak-balik ke menu AI Studio | Tertanam langsung di modul tugas & pertemuan | ⏱️ **Efisiensi Persiapan Guru 3x Lipat** |

---

*Dokumen ini merupakan acuan resmi pengembangan antarmuka OS Teacher v2.*
