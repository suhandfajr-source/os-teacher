---
title: 'Portal Siswa Bento Grid Dashboard & Jadwal Mingguan PC/Mobile'
type: 'feature'
created: '2026-10-04'
status: 'done'
baseline_commit: '3e5efc4fe0e36929d385c965c5cf9bcbab0ef5ef'
route: 'full'
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Halaman Beranda (`/siswa/portal`) dan Jadwal (`/siswa/portal/jadwal`) saat ini hanya dirancang dengan pola tumpukan vertikal 1 kolom mobile. Di monitor PC desktop, widget capaian belajar, materi, jadwal hari ini, dan kuis mendesak saling bertumpuk panjang ke bawah sehingga menyia-nyiakan ruang horizontal, dan halaman jadwal memaksa siswa mengklik satu per satu tab hari daripada melihat gambaran jadwal mingguan secara menyeluruh.

**Approach:** Rancang antarmuka *dual-mode layout* untuk Dashboard dan Jadwal:
1. Beranda Siswa (`/siswa/portal`): Di PC (`lg:`), gunakan struktur **Bento Grid 2 Kolom** (kolom utama: Pelajaran Hari Ini & Kuis Mendesak; kolom pendamping: Widget Capaian Belajar & Materi Belajar). Di mobile (`< lg`), tetap 1 kolom vertikal rapi.
2. Jadwal Siswa (`/siswa/portal/jadwal`): Di PC (`md:`/`lg:`), sediakan **Tampilan Grid Mingguan (Weekly Timetable Grid)** yang menampilkan seluruh hari (Senin s.d. Sabtu) secara berdampingan dalam satu pandangan, sekaligus menyediakan saklar tampilan (*View Mode Toggle*: Tab Harian vs Grid Mingguan). Di mobile, tetap default ke tab harian yang nyaman disentuh jempol.

## Boundaries & Constraints

**Always:**
- Pertahankan kompatibilitas fungsional 100%: fetch data menggunakan action yang sudah ada (`getStudentDashboardDataAction`, `getStudentProgressWidgetAction`, `getStudentWeeklyScheduleAction`).
- Mode Mobile (< 768px): Pengalaman genggaman smartphone tidak boleh terdegradasi. Tab harian dan kartu stream tetap bekerja cepat tanpa horizontal scrolling yang tidak diinginkan.
- Desain mengikuti prinsip visual Klassa Modern Edu-Teal: card surface putih bersih (`bg-white rounded-2xl md:rounded-3xl border border-slate-200/80`), penanda sesi aktif (*LIVE badge*), dan tipografi Figtree/Plus Jakarta Sans.
- Seluruh tautan navigasi dan tombol aksi (`Kerjakan`, `Pembahasan`, `Lihat Detail`, `Buka Materi`) harus tetap berfungsi normal di desktop maupun mobile.

**Never:**
- Dilarang mengubah *action* backend atau memodifikasi format response data `StudentDashboardData`, `StudentProgressWidgetData`, maupun `DayWeeklySchedule`.
- Dilarang menghapus informasi yang sudah ada di halaman (seperti NIS, nama rombel, guru pengampu, ruang kelas, batas waktu kuis, status tuntas TP).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Beranda di Desktop Monitor (>= 1024px) | Data dashboard & widget berhasil dimuat | Header sambutan full-width, diikuti Bento Grid: Kolom kiri (2 span) berisi Jadwal Hari Ini & Kuis Mendesak, Kolom kanan (1 span) berisi Capaian Belajar & Materi. | Jika salah satu widget gagal, fallback kartu error tetap terisolasi tanpa merusak kolom lainnya. |
| Beranda di Mobile (< 1024px) | Layar HP 375px - 414px | Tumpukan 1 kolom vertikal berurutan dari atas ke bawah secara alami dengan spacing `space-y-4`. | Tidak ada clipping atau overflow horizontal. |
| Jadwal di Desktop (>= 768px) | 6 hari pelajaran (Senin-Sabtu) | Tampilan Grid Mingguan: 5-6 kolom sejajar per hari dengan kartu sesi teratur, atau toggle ke tampilan harian. | Hari tanpa jadwal menampilkan kartu kosong yang proporsional (*Tidak ada jam pelajaran*). |
| Jadwal Hari Minggu / Hari Libur | Akses pada hari Minggu | Di tab harian default ke Senin; di grid mingguan menampilkan seluruh hari dengan status jelas. | Tanggal dinormalisasi dengan benar via `getNormalizedDayOfWeek`. |
| Sesi Pelajaran Berlangsung (LIVE) | Jadwal hari ini memiliki item dengan `isLive: true` | Kartu pelajaran di-highlight dengan border teal, ring indicator, dan badge `LIVE` berkedip di desktop & mobile. | Waktu dicek terhadap jam lokal WIB. |

</frozen-after-approval>

## Code Map

- `src/app/siswa/portal/page.tsx` -- Halaman Beranda Siswa: transformasi ke Bento Grid responsif (Hero header full-width, grid `grid-cols-1 lg:grid-cols-3 gap-5`, kolom utama `lg:col-span-2`, kolom samping `lg:col-span-1`).
- `src/app/siswa/portal/jadwal/page.tsx` -- Halaman Jadwal Mingguan Siswa: penambahan mode saklar (*Tab Harian* vs *Grid Mingguan*), komponen kartu grid mingguan 5–6 kolom di desktop (`hidden md:grid md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3`), serta optimalisasi tab harian di mobile.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/siswa/portal/page.tsx` -- Terapkan arsitektur Bento Grid 2 Kolom pada resolusi desktop (`lg:grid-cols-3`) tanpa merusak alur kartu mobile -- Memaksimalkan kenyamanan pemantauan informasi harian siswa di monitor PC lab.
- [x] `src/app/siswa/portal/jadwal/page.tsx` -- Tambahkan Tampilan Kalender/Grid Mingguan berdampingan untuk desktop dan sediakan toggle mode tampilan -- Mempermudah siswa dan guru melihat peta jadwal 1 minggu penuh dalam sekali lihat di komputer sekolah.

**Acceptance Criteria:**
- Given siswa membuka Beranda di laptop/PC (>= 1024px), when halaman dimuat, then kartu Pelajaran Hari Ini dan Kuis Mendesak tersusun rapi di kolom kiri, sedangkan Capaian Belajar dan Materi tersusun di kolom kanan.
- Given siswa membuka Jadwal di laptop/PC (>= 768px), when halaman dimuat, then tersedia tampilan Grid Mingguan yang memperlihatkan jadwal hari Senin s.d. Sabtu secara berdampingan tanpa harus berganti tab satu per satu.
- Given siswa membuka halaman dari smartphone (< 768px), when halaman dimuat, then tata letak tetap dalam 1 kolom vertikal dan tab harian yang nyaman digeser dengan jari.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Design Notes

- **Bento Grid Ratios:**
  - Container: `grid grid-cols-1 lg:grid-cols-3 gap-5 items-start`
  - Kolom Utama: `lg:col-span-2 space-y-5`
  - Kolom Samping: `lg:col-span-1 space-y-5`
- **Weekly Schedule Grid:**
  - Layout: `grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3`
  - Header hari dengan badge jumlah jam/mapel.
  - Kartu per jam mata pelajaran dengan waktu, mapel, nama guru, dan ruang.

## Verification

**Commands:**
- `npx tsc --noEmit` -- expected: TypeScript typecheck bersih tanpa error.
- `npm test -- src/modules/student-portal` -- expected: Seluruh 111 test student portal tetap 100% passing.
