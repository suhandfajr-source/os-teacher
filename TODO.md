# Daftar Rencana Tugas / Backlog (TODO)

Berikut adalah daftar tugas terencana yang akan dikerjakan:

---

## 1. Modul Tugas: Pengiriman via File
- **Deskripsi:** Menambahkan kemampuan agar tugas bisa dikirim/dikumpulkan melalui file (semua jenis kecuali program/makro, maks 25 MB × 5 file) ke dua arah: jawaban siswa dan lampiran guru.
- **Status:** ✅ Selesai
  - ✅ **Story 1 — File jawaban siswa**: skema `submission_file`, adapter S3-compatible (R2/MinIO/SeaweedFS), presigned upload direct-browser, route akses terautentikasi, UI portal siswa + koreksi guru.
  - ✅ **Story 2 — Lampiran guru**: skema `assignment_attachment`, upload presign guru, dialog kelola lampiran di portal guru (ubah kapan saja), tampilan chip lampiran di portal siswa.
  - ✅ **Pengujian Lokal**: didukung SeaweedFS lokal di `127.0.0.1:8333`, 857/857 unit & integration test passing.
  - Blueprint: `docs/product/assignment-file-blueprint.md`

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
