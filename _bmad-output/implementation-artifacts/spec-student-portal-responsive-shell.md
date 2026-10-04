---
title: 'Portal Siswa Responsive Shell & Dual-Mode Navigation'
type: 'feature'
created: '2026-10-04'
status: 'done'
baseline_commit: '353a92293879d565450936845a58abbfcdc03e38'
route: 'full'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Layout Portal Siswa (`/siswa/portal/*`) saat ini di-hardcode dengan lebar mobile sempit `max-w-md mx-auto` dan navigasi bawah permanen (`StudentBottomNav`). Saat diakses dari komputer lab sekolah atau laptop, tampilan terlihat terhimpit di tengah dengan ruang kosong ~75% layar, serta navigasi bawah canggung digunakan di layar desktop.

**Approach:** Implementasikan arsitektur *dual-mode responsive shell* untuk Portal Siswa: di layar desktop (`>= md`), kontainer melebar secara elegan (`max-w-6xl`) dengan navigasi horizontal terintegrasi di header atas (`StudentHeader`), sementara di layar mobile (`< md`) mempertahankan pengalaman *thumb-friendly* dengan kontainer ramping dan navigasi bawah (`StudentBottomNav`).

## Boundaries & Constraints

**Always:**
- Tetap pertahankan kompatibilitas 100% pada layar *mobile* (resolusi 360px–414px) termasuk safe-area inset pada iPhone dan Android modern.
- Pada resolusi desktop (`md:` ke atas / `>= 768px`), navigasi utama siswa (Hari Ini, Jadwal, Kuis, Nilai, Tugas, Profil) wajib muncul di header atas dengan penanda rute aktif (*active state*) yang kontras dan jelas (Klassa Edu-Teal theme).
- Pada resolusi desktop, sembunyikan bilah `StudentBottomNav` (`hidden md:hidden`) agar tidak menumpuk di layar bawah monitor PC.
- Tombol logout instan (*lab-ready 1-tap logout*) dan status perlindungan sesi inaktivitas (`StudentInactivityGuard`) harus tetap berfungsi di semua ukuran layar.
- Tetap sembunyikan navigasi (baik header nav maupun bottom nav) saat siswa sedang berada dalam ruang pengerjaan kuis aktif (`/siswa/portal/quiz/[shareToken]` non-review) untuk mencegah distraksi dan perpindahan halaman yang tidak disengaja.

**Never:**
- Dilarang mengubah skema database, API auth siswa, maupun logika session verification (`verifyStudentSession`).
- Dilarang merusak rute fungsional siswa yang sudah ada (`/siswa/portal`, `/jadwal`, `/quiz`, `/nilai`, `/tugas`, `/profil`, `/keluarga`).
- Dilarang memperkenalkan dependensi pihak ketiga baru yang tidak terdaftar di `package.json`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Akses Mobile Phone (< 768px) | Viewport 375×667 (iPhone SE / Android) | Kontainer `max-w-md mx-auto`, `StudentHeader` ringkas tanpa tab horizontal desktop, `StudentBottomNav` melayang di bawah dengan padding `pb-24`. | Tata letak tidak terpotong horizontal (overflow-x-hidden / safe container). |
| Akses Desktop / Lab PC (>= 768px) | Viewport 1366×768 atau 1920×1080 | Kontainer melebar hingga `max-w-6xl mx-auto`, `StudentHeader` menampilkan tab navigasi horizontal, `StudentBottomNav` tersembunyi (`md:hidden`), padding bawah berkurang (`pb-12`). | Tidak ada layout squishing atau stretch yang merusak konten anak. |
| Nama Siswa / Sekolah Sangat Panjang | Nama 50+ karakter, Sekolah panjang | Header merespons dengan truncate dan tooltip/elipsis elegan di mobile maupun desktop tanpa merusak layout logout button. | Kontainer tombol logout tetap memiliki min-width aman dan tidak terdorong keluar layar. |
| Mode Ujian Kuis Aktif | Rute `/siswa/portal/quiz/token123` | Baik di mobile maupun desktop, navigasi navigasi bottom nav tidak ditampilkan; header menampilkan indikator fokus ujian. | Sesi kuis terlindungi dari klik navigasi tidak sengaja. |
| Logout dari Komputer Lab | Siswa klik tombol "Keluar" di header | Sesi dihapus, dialihkan ke `/portal-siswa` dengan toast notifikasi sukses. | Gagal logout menampilkan pesan error dan tidak mengubah state halaman. |

</frozen-after-approval>

## Code Map

- `src/app/siswa/portal/layout.tsx` -- Shell layout utama portal siswa: penyesuaian kontainer responsif `w-full max-w-md md:max-w-6xl mx-auto`, padding responsif (`p-4 pb-24 md:p-6 md:pb-12`), dan integrasi komponen shell.
- `src/modules/student-portal/components/StudentHeader.tsx` -- Header siswa: perluasan kontainer header (`max-w-6xl`), integrasi tab navigasi desktop horizontal (`hidden md:flex items-center gap-1`), identitas siswa & rombel, serta tombol logout aman.
- `src/modules/student-portal/components/StudentBottomNav.tsx` -- Navigasi bawah mobile: penambahan kelas utilitas responsif `md:hidden` agar otomatis tersembunyi di layar PC desktop.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/siswa/portal/layout.tsx` -- Update layout kontainer agar responsif multi-breakpoint (`max-w-md md:max-w-6xl mx-auto px-4 md:px-6`) -- Menghilangkan masalah *desktop squishing* pada monitor PC tanpa mengubah pengalaman mobile.
- [x] `src/modules/student-portal/components/StudentHeader.tsx` -- Tambahkan desktop navigation bar terpadu, perluas lebar header, dan rapikan identitas siswa -- Menyediakan navigasi sejajar mata di layar PC yang mudah diakses dengan mouse/keyboard.
- [x] `src/modules/student-portal/components/StudentBottomNav.tsx` -- Pastikan bilah navigasi bawah hanya aktif di mobile (`md:hidden`) -- Mencegah redundansi navigasi ganda di layar PC.

**Acceptance Criteria:**
- Given siswa mengakses portal dari layar monitor PC (>= 768px), when halaman dimuat, then kontainer halaman melebar hingga batas proporsional desktop (`max-w-6xl`), tab navigasi muncul di header atas dengan status aktif yang sesuai rute, dan navigasi bawah mobile tidak ditampilkan.
- Given siswa mengakses portal dari layar HP (< 768px), when halaman dimuat, then kontainer tetap dalam format mobile ramping (`max-w-md`), navigasi bawah 6 menu melayang di bawah layar dengan padding aman, dan tab horizontal di header tidak ditampilkan.
- Given siswa berada di rute kuis aktif, when halaman ditampilkan, then bottom nav tetap tersembunyi di mobile dan desktop sesuai aturan keamanan ujian.

## Implementation Notes

- Modifikasi `src/app/siswa/portal/layout.tsx` mengganti batas `max-w-md` menjadi `max-w-md md:max-w-6xl mx-auto px-4 md:px-6 py-4 md:py-6 pb-24 md:pb-12`, serta menambahkan footer desktop yang rapi.
- Modifikasi `src/modules/student-portal/components/StudentHeader.tsx` mengadopsi desktop top nav bar (Hari Ini, Jadwal, Kuis, Nilai, Tugas, Profil) dengan state aktif tema Klassa Edu-Teal. Mode pengerjaan kuis terlindungi dengan peringatan "Mode Ujian Aktif" yang menonaktifkan link navigasi.
- Modifikasi `src/modules/student-portal/components/StudentBottomNav.tsx` menambahkan kelas `md:hidden` agar bilah bawah otomatis tersembunyi di layar PC desktop.
- 111/111 unit & integration tests pada `src/modules/student-portal` passing dengan sukses. Zero TypeScript errors.

## Spec Change Log

## Review Triage Log

- Total findings: 0 defect findings, 0 gaps.
- Verdicts: All criteria satisfied (high: 0, medium: 0, low: 0, false: 0, maybe-false: 0).
- Traced scenarios:
  1. Desktop (>= 768px): Header desktop navigation aktif, bottom nav disembunyikan (`md:hidden`), kontainer melebar ke `max-w-6xl`, footer desktop muncul.
  2. Mobile (< 768px): Kontainer `max-w-md`, bottom nav melayang dengan padding aman `pb-24`, header ringkas tanpa tab horizontal desktop.
  3. Active Quiz Lock: Mode ujian mendeteksi rute kuis aktif dan menonaktifkan bilah navigasi desktop serta menyembunyikan bottom nav.
  4. Typecheck & Unit Tests: 0 type errors, 111/111 student portal vitest tests passing.

## Design Notes

- **Header Desktop Navigation Styling:**
  Gunakan pill tabs dengan warna tema Klassa:
  - Aktif: `bg-teal-700 text-white font-bold shadow-xs`
  - Inaktif: `text-slate-600 hover:text-teal-800 hover:bg-teal-50/70 font-semibold transition-colors`
- **Header Mobile Styling:**
  Pertahankan kekompakan dengan flexbox items-center justify-between, avatar ikon `GraduationCap`, nama siswa dengan teks tebal, dan tombol logout `bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-700`.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: Clean typecheck tanpa error kompilasi TypeScript.
- `npm test -- src/modules/student-portal` -- expected: Seluruh 111 test student portal tetap 100% passing.
