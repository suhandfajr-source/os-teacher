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
- **Deskripsi:** Agent kustom di dalam ekosistem Klassa yang membantu mengerjakan tugas-tugas guru dan menjadi ruang diskusi interaktif mengenai berbagai masalah di kelas.
- **Status:** ✅ Selesai (Semua Story 1–6 Selesai & Terverifikasi Penuh via BMAD Build)
- **Stage Dokumentasi:** `docs/development/stages/DEV_STAGE_12_KLASSA_AGENT.md`
- **Ringkasan Arsitektur & Keputusan:**
  - **Universal Multi-Model:** 100% bebas lock-in vendor, bebas dipasang model komersial (Gemini, Claude, GPT) maupun model lokal (Hermes/vLLM) via protokol standar.
  - **3 Kapabilitas Utama:** Admin Ber-Data (kalkulasi deterministik untuk SEMUA hal yang bisa dihitung), Pedagogi Solutif (non-klinis), Operasional (semua fitur Klassa).
  - **Matriks Aksi (Human-in-the-Loop):** Aksi baca/draf langsung jalan; aksi tulis resmi/sensitif wajib persetujuan guru via kartu interaktif di chat dengan Atomic Gate Lock anti-TOCTOU.
  - **Memori Komprehensif:** Mengingat preferensi ajar dan merangkum intisari percakapan umum guru agar agen selalu nyambung dari waktu ke waktu dengan sanitasi tag XML.
  - **Klassa Pulse (Admin Console):** Visualisasi makro isu guru Indonesia, kurikulum tersulit, beban stres, dan jam lembur guru secara teranonimkan (Zero-PII UU PDP).
  - Blueprint: `docs/product/klassa-agent-blueprint.md` (+ versi web: `klassa-agent-blueprint.html`)
  - Hasil forge & laporan visual: `_bmad-output/forge/klassa-agent/` (`forged-idea.md` & `forge-report.html`)
  - Patch & Artefak Review: `_bmad-output/implementation-artifacts/diff-klassa-agent-*.patch`
  - Hasil Pengujian: 55/55 agent tests passing, 910/910 full suite regression passing (0 regressions).

---

## 3. Perapihan Mode PC & Mobile Masing-Masing Portal
- **Deskripsi:** Pembenahan tampilan dan pengalaman responsif (PC/Desktop vs Mobile) pada setiap portal agar nyaman dan rapi di semua perangkat.
- **Status:** 📋 Direncanakan (Pending)
- **Cakupan Portal:**
  - **Portal Guru** (Dashboard, Manajemen Kelas, KBM, Penilaian, Jadwal, dsb.)
  - **Portal Siswa** (Halaman tugas, kuis, nilai, presensi, jadwal)
  - **Portal Orang Tua / Wali**
  - **Portal Superadmin**
