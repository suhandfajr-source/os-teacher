# Checklist Fitur Komprehensif — KLASSA (Berbasis Alur / End-to-End User Journey)

Panduan pengujian manual lokal yang disusun secara kronologis mengikuti alur hidup aplikasi dari inisialisasi, registrasi guru, verifikasi superadmin, pendaftaran & approval siswa, proses KBM harian, penilaian, portal siswa & keluarga, hingga pelaporan dan rollover tahun ajaran.

Prasyarat env: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GEMINI_API_KEY` (`.env`); `SUPERADMIN_EMAILS` untuk seeding superadmin.

---

## 🏁 TAHAP 1: Inisialisasi & Setup Awal Platform
*Persiapan environment dan kesiapan akun pengelola platform.*

- [ ] `npx prisma migrate dev` — Skema database sinkron (seluruh chain migrasi diterapkan)
- [ ] `npm run seed:superadmin` — Superadmin ter-seed otomatis dari `SUPERADMIN_EMAILS`
- [ ] `npm run dev` — Server lokal berjalan di `http://localhost:3000`
- [ ] `npm test` — Seluruh unit & integration test hijau (770/770 test pass)
- [ ] Login akun Superadmin — Otomatis diarahkan ke `/admin` (Single-Admin Lane, bukan wizard onboarding guru)
- [ ] Akses Guard Superadmin: Superadmin diblok dari jalur publik/guru (`/dashboard`, `/onboarding` otomatis redirect ke `/admin`)

---

## 👨‍🏫 TAHAP 2: Registrasi & Onboarding Guru Baru
*Guru mendaftarkan diri secara mandiri dan menyiapkan ekosistem mengajarnya.*

- [ ] Guru membuka `/register` → Isi Nama, Email, dan Password baru
- [ ] Setelah register, guru otomatis masuk ke wizard onboarding 4 langkah (`/onboarding`):
  - [ ] **Langkah 1 (Sekolah):** Pilih sekolah yang ada atau daftarkan nama sekolah baru (misal: *SMP Negeri 1 Contoh*)
  - [ ] **Langkah 2 (Periode Akademik):** Konfirmasi tahun ajaran aktif (misal: *2024/2025 Ganjil*)
  - [ ] **Langkah 3 (Mata Pelajaran):** Pilih mapel yang tersedia atau input mata pelajaran baru (misal: *Informatika*)
  - [ ] **Langkah 4 (Rombel/Kelas):** Buat rombel baru (misal: *8-B*, tingkat *8*) → Sistem otomatis membuat **Kode Gabung Rombel 6 Karakter** (misal: `X8K2P9`)
- [ ] Selesai onboarding → Guru berhasil diarahkan ke dashboard utama guru (`/dashboard`) dengan metrik awal

---

## 🛡️ TAHAP 3: Verifikasi & Pengawasan Superadmin Pasca-Register Guru
*Superadmin memvalidasi data guru, sekolah, dan rombel yang baru terbentuk.*

- [ ] Superadmin membuka konsol pengawasan di `/admin`:
  - [ ] **Tab Sekolah:** Sekolah baru muncul dalam daftar. Klik nama sekolah / rincian → Nama guru yang baru mendaftar tampil di bagian detail anggota guru sekolah tersebut.
  - [ ] **Tab Guru:** Guru baru muncul di daftar akun guru dengan status `Aktif`, menampilkan nama sekolah asal dan emailnya.
  - [ ] **Tab Rombel / Kelas:** Rombel yang baru dibuat oleh guru muncul di tabel, lengkap dengan nama rombel, tingkat, nama sekolah, dan kode gabung kelas.
- [ ] **Uji Sortir Header Kolom:** Klik header kolom (Sekolah, Guru, Rombel, Siswa) untuk mengurutkan data (A-Z / Z-A) secara interaktif.
- [ ] **Uji Pencarian Luas:** Cari nama sekolah di tab Rombel/Kelas → Data rombel di sekolah tersebut berhasil difilter dengan tepat.
- [ ] **Uji Kontrol Akun:** Cek ketersediaan tombol Ban/Unban guru, Reset Password guru, dan status AuditLog di `/admin/audit`.

---

## 📚 TAHAP 4: Manajemen Kelas & Penjadwalan Mengajar (Guru)
*Guru mengelola kelas, mengoreksi data kelas jika salah input, dan mengatur jadwal.*

- [ ] Guru membuka menu **Kelas Mengajar** di `/kelas` → Muncul kartu rombel kelas yang diampu
- [ ] **Edit Mandiri Data Kelas:**
  - [ ] Klik tombol **Edit** pada kartu kelas
  - [ ] Ubah Nama Kelas atau Tingkat / Jenjang Kelas (misal: mengoreksi dari tingkat *7* menjadi *8*)
  - [ ] Simpan → Kartu kelas langsung ter-update menampilkan badge tingkatan yang benar (`Tingkat 8`)
- [ ] **Pengaturan Jadwal Mengajar:**
  - [ ] Klik tombol **Jadwal** pada kartu kelas
  - [ ] Atur hari mengajar (misal: *Senin*), jam mulai, jam selesai, dan ruangan
  - [ ] Simpan → Jadwal tersimpan untuk rombel tersebut
- [ ] **Salin Kode Gabung Rombel:** Ambil kode gabung 6 karakter dari kartu kelas untuk dibagikan ke siswa
- [ ] **Impor Roster Siswa (Opsional):** Guru membuka `/kelas/[id]/import` untuk mencoba unggah template Excel data siswa jika ingin pre-populate NIS

---

## 🎒 TAHAP 5: Registrasi & Klaim Akun Siswa
*Siswa atau orang tua mendaftarkan akun siswa pertama kali menggunakan kode rombel.*

- [ ] Siswa / Orang Tua membuka `/portal-siswa`
- [ ] Klik opsi pendaftaran / klaim akun siswa:
  - [ ] Masukkan **Kode Gabung Rombel** (6 karakter dari guru di Tahap 4)
  - [ ] Masukkan **NIS** (Nomor Induk Siswa) dan **Nama Lengkap Siswa**
  - [ ] Buat **PIN 4 Digit** (misal: `1234`)
- [ ] Kirim formulir pendaftaran → Muncul notifikasi bahwa akun berhasil diajukan dan berstatus `PENDING` (menunggu persetujuan guru pengampu)

---

## ✅ TAHAP 6: Persetujuan Siswa (Approval Flow)
*Guru menyetujui akun siswa agar aktif dan bisa masuk ke portal.*

- [ ] **Guru Menyetujui:**
  - [ ] Guru membuka menu **Persetujuan Siswa** di `/persetujuan`
  - [ ] Nama siswa yang baru mendaftar muncul dalam daftar antrean `PENDING`
  - [ ] Klik tombol **Setujui (Approve)** (atau uji fitur *Batch Approve*)
  - [ ] Status siswa berubah menjadi `ACTIVE`
- [ ] **Fitur Manajemen Siswa Tambahan oleh Guru:**
  - [ ] Uji tombol **Pindah Rombel** di `/persetujuan` jika siswa salah memilih kelas
  - [ ] Uji tombol **Reset PIN Siswa** jika siswa lupa PIN 4 digitnya
- [ ] **Superadmin Backstop (L3):** Buka `/admin` tab Siswa → Superadmin juga memiliki tombol darurat untuk force approve / reject akun siswa jika dibutuhkan

---

## 📖 TAHAP 7: Aktivitas Pembelajaran Harian (Guru)
*Guru melaksanakan pembelajaran, mencatat kehadiran, membuat materi, kuis, dan tugas.*

- [ ] **Pertemuan & Presensi:**
  - [ ] Buka `/kelas/[id]/pertemuan` → Buat Sesi Pertemuan baru (isi Topik Rencana & Aktual)
  - [ ] Buka `/kelas/[id]/absensi` → Catat presensi siswa (Hadir / Terlambat / Sakit / Izin / Alpa)
  - [ ] Tandai sesi sebagai **COMPLETED** (Selesai)
- [ ] **AI Studio & Publikasi Materi:**
  - [ ] Buka `/ai-studio` → Generate bahan ajar atau ringkasan materi menggunakan Gemini AI
  - [ ] Simpan sebagai draf bahan ajar (`LEARNING_MATERIAL`)
  - [ ] Klik **Publish ke Rombel** → Materi berstatus dipublikasikan
- [ ] **Pembuatan Kuis Interaktif:**
  - [ ] Buka `/quiz/new` → Buat kuis dengan beberapa butir pertanyaan pilihan ganda
  - [ ] Buka kuis dan salin tautan berbagi kuis (`/q/[token]`)
- [ ] **Pembuatan Tugas Kelas:**
  - [ ] Buka `/kelas/[id]/tugas` → Buat tugas baru (Judul, Instruksi pengerjaan, dan Batas Waktu / Tenggat)

---

## 📱 TAHAP 8: Aktivitas Belajar di Portal Siswa (Siswa)
*Siswa login dan mengakses seluruh materi, jadwal, kuis, serta tugas kelas.*

- [ ] **Login Siswa:** Siswa membuka `/portal-siswa` → Masukkan NIS dan PIN 4 digit → Berhasil masuk ke `/siswa/portal`
- [ ] **Cek Jadwal Pelajaran:** Buka `/siswa/portal/jadwal` → Jadwal yang telah diatur guru di Tahap 4 tampil rapi
- [ ] **Baca Materi Ajar:** Buka `/siswa/portal/materi` → Materi yang di-publish guru di Tahap 7 dapat dibaca langsung
- [ ] **Kerjakan Kuis Interaktif:** Buka tautan kuis `/q/[token]` atau menu kuis → Kerjakan kuis dan lihat pembahasan soal di `/quiz/[token]/review`
- [ ] **Kumpulkan Tugas:**
  - [ ] Buka menu `/siswa/portal/tugas` → Pilih tugas yang aktif
  - [ ] Klik **Kumpulkan Tugas** → Masukkan jawaban (teks jawaban atau tautan Google Drive / dokumen)
  - [ ] Submit tugas → Status tugas berubah menjadi *Sudah Dikumpulkan*
- [ ] **Kelola Profil Siswa:** Buka `/siswa/portal/profil` → Cek informasi akun dan coba fitur ganti PIN

---

## 📝 TAHAP 9: Penilaian & Umpan Balik Guru
*Guru mengoreksi tugas siswa dan melakukan penilaian sumatif/formatif.*

- [ ] **Koreksi & Umpan Balik Tugas:**
  - [ ] Guru membuka `/kelas/[id]/tugas` → Muncul badge counter *Antrean Koreksi*
  - [ ] Klik detail tugas `/kelas/[id]/tugas/[assignmentId]`
  - [ ] Periksa jawaban siswa → Masukkan **Feedback / Catatan Guru** (wajib) dan **Nilai Skor 0–100** (opsional)
  - [ ] Simpan koreksi → Status submission siswa menjadi *Reviewed*
  - [ ] Cek di sisi siswa: Jawaban siswa terkunci dan siswa dapat membaca feedback serta skor dari guru
- [ ] **Asesmen & Pengaturan Nilai:**
  - [ ] Buka `/kelas/[id]/pengaturan-nilai` → Atur bobot nilai dan Kriteria Ketercapaian Tujuan Pembelajaran (KKTP)
  - [ ] Buka `/kelas/[id]/penilaian` → Buat asesmen baru (misal: *Ulangan Harian 1*) dan input nilai siswa
  - [ ] Lakukan **Finalisasi Nilai** (Ubah status ke `FINAL` / `GRADED`)

---

## 👨‍👩‍👧 TAHAP 10: Pemantauan Siswa & Mode Transparansi Keluarga
*Orang tua dan guru memantau perkembangan akademik serta rekap kehadiran siswa.*

- [ ] **Mode Keluarga (Transparan & Read-Only):**
  - [ ] Melalui portal siswa, buka **Mode Keluarga** di `/siswa/portal/keluarga`
  - [ ] Cek ringkasan kehadiran bulanan siswa (persentase Hadir, Sakit, Izin, Alpa)
  - [ ] Cek **Rincian Penilaian**: Nilai yang sudah berstatus `FINAL` tampil dengan indikator KKM (nilai di bawah KKM berwarna merah)
  - [ ] Cek **Aktivitas Belajar**: Rekap topik pertemuan yang statusnya sudah `COMPLETED` beserta status kehadiran siswa di sesi tersebut
  - [ ] Cek **Status Tugas**: Menampilkan daftar tugas beserta umpan balik/catatan dari guru
  - [ ] Verifikasi aspek keamanan: Seluruh halaman Mode Keluarga bersifat *read-only* (tanpa tombol manipulasi data)
- [ ] **Monitoring Kemajuan Siswa (Sisi Guru):**
  - [ ] Guru membuka `/kelas/[id]/monitoring` dan `/monitoring/[studentId]`
  - [ ] Memeriksa grafik ketuntasan TP, tren nilai, dan rekomendasi siswa yang memerlukan program remedial

---

## 📊 TAHAP 11: Pelaporan, Ekspor & Rollover Tahun Ajaran
*Pencetakan dokumen rekapitulasi serta transisi ke periode akademik berikutnya.*

- [ ] **Jurnal & Laporan Pembelajaran:**
  - [ ] Buka `/kelas/[id]/jurnal` → Tinjau dan cetak Jurnal Mengajar berkala
  - [ ] Buka `/laporan` dan `/laporan/print` → Ekspor rekap nilai siswa ke format cetak / dokumen
  - [ ] Buka menu ekspor presentasi → Uji unduh slide ringkasan materi/pembelajaran (PPT/HTML)
- [ ] **Rollover Tahun Ajaran Baru (Ganti Semester / Tahun Ajaran):**
  - [ ] Guru/Admin mengaktifkan Tahun Ajaran baru (misal: *2024/2025 Genap*)
  - [ ] Sistem secara otomatis mengarsipkan periode sebelumnya
  - [ ] Siswa login kembali ke `/portal-siswa` dengan NIS dan PIN yang sama, lalu mengklaim kode rombel baru tanpa perlu registrasi ulang dari awal
