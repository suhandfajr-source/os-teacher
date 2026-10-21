# Multi-Lens Code Review Findings: Story 3 (Portal Siswa Dual-Mode Tugas, Daftar Kuis & CBT Exam Engine)

**Target Commit:** `e5d3499` (`feat(portal-siswa): dual-mode assignments, quiz list, and cbt exam runner`)  
**Diff Path:** `_bmad-output/implementation-artifacts/review-diff-story3.diff`  
**Date:** 2026-10-04  
**Review Status:** Completed (No Defect / Clean Review)

---

## 1. Blind Hunter Review
- **Daftar Tugas (`src/app/siswa/portal/tugas/page.tsx`):**
  - Mengubah susunan baris tunggal memanjang menjadi **Grid Responsif 2 Kolom** (`grid grid-cols-1 md:grid-cols-2 gap-4 items-start`).
  - Form pengumpulan tugas mandiri, informasi tenggat waktu, dan deretan lampiran file tertata proporsional tanpa ruang kosong berlebihan di layar PC lab.
- **Pusat Kuis (`src/app/siswa/portal/quiz/page.tsx`):**
  - Tab *Tersedia* dan *Selesai* kini tersusun dalam Grid 2 Kolom di desktop, menyajikan kartu kuis dengan status pengerjaan (*Sedang Berjalan* / *Belum Dikerjakan* / *Nilai*) dan tombol aksi langsung secara teratur.
- **Ruang Ujian CBT Siswa (`QuizRunnerClient.tsx`):**
  - **Layout Split Dual-Panel di Desktop (>= 1024px):**
    - *Panel Kiri (2/3 width / `lg:col-span-8`):* Lembar soal aktif, opsi pilihan ganda / textarea esai, dan navigasi Sebelum / Sesudah.
    - *Panel Kanan (1/3 width / `lg:col-span-4 sticky top-20`):* Panel kisi nomor soal (5 kolom) dengan warna status (Aktif, Terjawab, Belum), persentase progres, dan tombol kumpul ujian mengambang.
  - **Di Mobile (< 1024px):** Navigator nomor soal horizontal yang dapat digeser tetap aktif seperti sebelumnya.

## 2. Edge Case Hunter Review
- **Kuis dengan Jumlah Soal Banyak (misal 40-50 butir):**
  - Kisi nomor soal di panel samping dibatasi oleh `max-h-[340px] overflow-y-auto pr-1` sehingga panel tetap ringkas (*sticky*) dan tidak memanjang ke bawah melewati batas pandang layar komputer.
- **Integritas Ujian:**
  - Timer wall-clock (`timeLeftSec`), peringatan proteksi `beforeunload`, autosave debounce 600ms, serta auto-submit saat waktu habis tetap bekerja tanpa gangguan.
- **Dialog Konfirmasi Pengumpulan:**
  - Tetap memberikan peringatan jika ada butir soal yang belum terisi sebelum siswa melakukan finalisasi kuis.

## 3. Verification Gap Review
- **Verifikasi TypeScript:** `npx tsc --noEmit` lolos tanpa kesalahan tipe (0 error).
- **Verifikasi Vitest:** `src/modules/student-portal` 8/8 test files passed (111/111 passing).
- **Regresi:** 0 regresi fungsional.

---

## Kesimpulan Triage
- **High Severity:** 0
- **Medium Severity:** 0
- **Low Severity:** 0
- **False / Rejected:** 0
- **Status Akhir:** ✅ **Clean review — all layers passed.**
