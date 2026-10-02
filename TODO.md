# Daftar Rencana Tugas / Backlog (TODO)

Berikut adalah daftar tugas terencana yang akan dikerjakan:

---

## 1. Modul Tugas: Pengiriman via File
- **Deskripsi:** Menambahkan kemampuan agar tugas dapat dikirim/dikumpulkan melalui file (semua jenis kecuali program/makro, maks 25 MB × 5 file).
- **Status:** 🔨 Dikerjakan
  - ✅ **Story 1 — File jawaban siswa** (2 Okt 2025): skema `submission_file`, adapter S3-compatible (R2/MinIO), presigned upload direct-browser, route akses terautentikasi, UI portal siswa + koreksi guru, 52 test baru. Menunggu: akun R2 untuk uji manual production-like. Blueprint: `docs/product/assignment-file-blueprint.md`
  - ⏳ **Story 2 — Lampiran guru** (soal/LKPD di tugas): tertunda di `_bmad-output/implementation-artifacts/deferred-work.md`

---

## 2. Klassa Agent
- **Deskripsi:** Agent di dalam ekosistem Klassa yang membantu mengerjakan tugas-tugas guru dan menjadi ruang diskusi interaktif mengenai berbagai masalah di kelas.
- **Status:** ⏳ Menunggu detailing lebih lanjut dari user
- **Rincian Awal:**
  - Integrasi AI agent dengan konteks data kelas (profil siswa, catatan akademik, presensi, masalah perilaku).
  - Asistensi pengerjaan tugas rutin guru.
  - Fitur konsultasi / diskusi problem-solving masalah kelas.

---

## 3. Perapihan Mode PC & Mobile Masing-Masing Portal
- **Deskripsi:** Pembenahan tampilan dan pengalaman responsif (PC/Desktop vs Mobile) pada setiap portal agar nyaman dan rapi di semua perangkat.
- **Status:** 📋 Direncanakan (Pending)
- **Cakupan Portal:**
  - **Portal Guru** (Dashboard, Manajemen Kelas, KBM, Penilaian, Jadwal, dsb.)
  - **Portal Siswa** (Halaman tugas, kuis, nilai, presensi, jadwal)
  - **Portal Orang Tua / Wali**
  - **Portal Superadmin**
