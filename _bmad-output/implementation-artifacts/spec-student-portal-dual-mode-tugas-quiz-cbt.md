---
title: 'Portal Siswa Dual-Mode Tugas, Daftar Kuis & CBT Exam Engine'
type: 'feature'
created: '2026-10-04'
status: 'done'
baseline_commit: '6a667ac'
route: 'full'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Halaman Tugas (`/siswa/portal/tugas`), Pusat Kuis (`/siswa/portal/quiz`), dan Ruang Ujian CBT (`QuizRunnerClient` & `/quiz/[shareToken]/review`) dirancang dengan lebar sempit mobile. Di monitor komputer lab (PC/Laptop), kartu tugas melebar tidak proporsional seperti balok panjang, daftar kuis memanjang ke bawah, dan ruang ujian CBT tidak memiliki panel kisi navigator soal khas ujian sekolah (seperti UNBK/ANBK) yang memisahkan lembar soal dan navigator nomor di samping layar.

**Approach:** Tingkatkan pengalaman *Dual-Mode PC & Mobile*:
1. **Daftar Tugas (`/siswa/portal/tugas`)**: Terapkan grid responsif multi-kolom di desktop (`grid-cols-1 md:grid-cols-2 gap-4 items-start`) agar setiap kartu tugas tampil seimbang dengan informasi tenggat waktu, lampiran file, dan formulir pengumpulan yang rapi.
2. **Pusat Kuis (`/siswa/portal/quiz`)**: Terapkan grid responsif 2 kolom di desktop (`grid-cols-1 md:grid-cols-2 gap-4 items-start`) untuk tab Kuis Tersedia dan Riwayat Selesai.
3. **Ruang Ujian CBT (`QuizRunnerClient`)**:
   - **Mode PC (>= lg / 1024px)**: Tata letak *Split Dual-Panel*:
     - *Panel Kiri / Lembar Soal (2/3 width / flex-1)*: Nomor butir soal aktif, teks soal, pilihan ganda / esai, serta tombol navigasi Soal Sebelumnya / Selanjutnya.
     - *Panel Kanan / Kisi Navigator Soal (1/3 width / w-72 sm:w-80)*: Timer ujian mengambang (sticky), status autosave, kisi nomor soal 1..N (5 kolom) dengan indikator warna (Terjawab = Teal, Belum = Slate, Aktif = Ring Teal), ringkasan progres, dan tombol Kumpulkan Ujian.
   - **Mode Mobile (< 1024px)**: Tetap mempertahankan susunan vertikal dengan strip navigator horizontal geser yang sudah teruji nyaman.

## Boundaries & Constraints

**Always:**
- Pertahankan seluruh logika ujian: timer wall-clock, peringatan `beforeunload`, debounce autosave (600ms), auto-submit saat waktu habis, dan proteksi navigasi kuis.
- Pertahankan kompatibilitas pengumpulan tugas: upload file, input teks/link, dan verifikasi keterlambatan tugas (`isSubmissionLate`).
- Desain visual konsisten dengan tema Klassa Edu-Teal.

**Never:**
- Dilarang mengubah skema database Prisma, auth action kuis (`saveQuizAnswerFromSessionAction`, `submitQuizAttemptFromSessionAction`), maupun API lampiran tugas.
- Dilarang menghilangkan tombol atau fungsionalitas esensial siswa di HP maupun PC.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Ujian CBT di PC Lab (>= 1024px) | Siswa mengerjakan kuis 20-50 butir soal | Panel lembar soal di kiri dan panel kisi navigator di kanan secara berdampingan. Siswa bisa lompat ke nomor berapa pun dengan 1 klik pada kisi kanan. | Jika koneksi terputus saat autosave, badge status di kanan menampilkan "Gagal simpan" merah. |
| Ujian CBT di Smartphone (< 1024px) | Layar HP sempit | Strip nomor horizontal scroll di atas, lembar soal di bawah, tombol Previous/Next di bawah. | Tetap tidak ada clipping; form esai dan tombol radio responsif. |
| Daftar Tugas di PC | Beberapa tugas aktif | Grid 2 kolom rapi. Form upload file muat proporsional di dalam kartu. | Kartu tugas kosong tetap terpusat rapi. |
| Daftar Kuis di PC | Tab Tersedia & Selesai | Grid 2 kolom kartu kuis dengan status jelas (*Belum Dikerjakan*, *Sedang Berjalan*, *Selesai*). | Empty state kuis tetap elegan dan terisolasi. |

</frozen-after-approval>

## Code Map

- `src/app/siswa/portal/tugas/page.tsx` -- Daftar tugas mandiri: responsive 2-column grid di desktop (`grid-cols-1 md:grid-cols-2 gap-4`).
- `src/app/siswa/portal/quiz/page.tsx` -- Pusat kuis: responsive 2-column grid di desktop untuk kuis aktif & selesai.
- `src/modules/student-portal/components/QuizRunnerClient.tsx` -- CBT Exam Runner: Split Dual-Panel di desktop (Lembar Soal di kiri + Kisi Navigator & Timer di kanan) dan strip horizontal di mobile.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/siswa/portal/tugas/page.tsx` -- Buat kartu tugas responsif dual-mode (1 kolom mobile, 2 kolom desktop)
- [x] `src/app/siswa/portal/quiz/page.tsx` -- Buat kartu daftar kuis responsif dual-mode (1 kolom mobile, 2 kolom desktop)
- [x] `src/modules/student-portal/components/QuizRunnerClient.tsx` -- Hadirkan layout CBT Split Dual-Panel di desktop dengan kisi nomor soal lengkap di panel samping

**Acceptance Criteria:**
- Given siswa mengakses Tugas di PC desktop (>= 768px), then daftar tugas tertata dalam grid 2 kolom yang proporsional.
- Given siswa mengakses Pusat Kuis di PC desktop (>= 768px), then daftar kuis tersusun dalam grid 2 kolom.
- Given siswa mengerjakan kuis CBT di PC desktop (>= 1024px), then lembar pertanyaan berada di sisi kiri dan kisi nomor soal serta timer berada di sisi kanan seperti simulasi ujian komputer sekolah.
- Given siswa mengakses dari HP, then seluruh fitur tetap ramping dalam tampilan 1 kolom.

## Verification

**Commands:**
- `npx tsc --noEmit` -- TypeScript typecheck bersih tanpa error.
- `npm test -- src/modules/student-portal` -- 111/111 passing tests.
