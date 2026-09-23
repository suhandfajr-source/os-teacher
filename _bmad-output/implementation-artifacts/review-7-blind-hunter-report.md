# Review Report — Blind Hunter, Story 7 (Student Progress, Gelombang 2)

- **Reviewed:** unified diff in `review-7-blind-hunter-prompt.md` (memlog, story spec, `nilai/page.tsx`, `portal/page.tsx`, `StudentBottomNav.tsx`, `story-7-progress.int.test.ts`, `student-progress.service.test.ts`, `student-progress.actions.ts`, `student-progress.service.ts`)
- **Finding floor:** diff = 82,418 bytes ≈ 82.4 kB → N = min(⌊√82.4⌋ + 1, 10) = min(9 + 1, 10) = **10**

## Findings

- **Navigasi bulan presensi terbalik label–ikon–perilaku.** Di `AttendanceTab` (`src/app/siswa/portal/nilai/page.tsx` ~baris 195–215), rekap diurutkan terbaru-dulu, jadi `idx + 1` = bulan **lebih lama**. Tombol ber-`aria-label="Bulan berikutnya"` (ikon `ChevronLeft`) justru berpindah ke bulan lebih lama dan disabled di ujung array; tombol `"Bulan sebelumnya"` (`ChevronRight`) berpindah ke bulan lebih baru. Arah ikon, label aksesibilitas, dan efek klik semuanya saling bertentangan — penyiswa tunanetra/dunia akan tersesat. Perbaiki mapping: tombol "sebelumnya" = `idx - 1` di-disable di bulan terbaru, dsb.

- **Impor tak terpakai di `nilai/page.tsx`.** `Award` dan `ArrowRight` diimpor (baris 13 & 15) tetapi tidak pernah dipakai di body file (keduanya hanya dipakai di widget beranda `portal/page.tsx`). Akan tertangkap `next lint` — yang justru tidak ada di Verification (lihat temuan terkait lint).

- **Widget beranda `slice(0, 4)` bisa menyembunyikan mapel yang punya nilai.** `visibleSubjects` di `portal/page.tsx` (baris 87) memotong 4 mapel pertama yang diurutkan `subject.name asc` tanpa mempertimbangkan `hasFinalData`. Jika siswa punya ≥5 mapel dan mapel yang bernilai final urutan abjad ke-5+, siswa melihat empat kartu "belum ada nilai" sementara nilainya tidak tampil sama sekali di beranda. Urutkan berdasar `hasFinalData` dulu, atau tandai "N mapel lainnya".

- **Duplikasi hampir total antara `getStudentProgressWidgetAction` dan `getStudentProgressDataAction`.** Setelah flag `includeTpTree` diflip ke `true` (dicatat di Implementation Notes), kedua action menjalankan rantai identik: `verifyStudentSession` → `resolveActiveMembership` → `loadSubjects(..., true)`; satu-satunya beda hanya pemuatan presensi. Parameter `includeTpTree` kini mati (selalu `true` dari kedua pemanggil). Refactor jadi satu loader internal dengan opsi, atau satu action yang mengembalikan kedua shape, supaya dua salinan ~50 baris tidak berdrift.

- **Pola N+1 query di `loadSubjects`.** Per teaching context dijalankan 3 query Prisma berurutan (`gradePolicy.findUnique`, `assessment.findMany`, `learningObjective.findMany`). Siswa dengan 10 mapel → ~31 round-trip per load halaman nilai **dan** per load widget beranda. Batching dengan `where: { teachingContextId: { in: [...] } }` + group-by di memori akan memangkasnya drastis.

- **Beranda menjalankan resolusi sesi + membership dua kali per render.** `portal/page.tsx` memanggil `getStudentDashboardDataAction()` dan `getStudentProgressWidgetAction()` via `Promise.all`; masing-masing memverifikasi sesi dan menjalankan `resolveActiveMembership` (findUnique student + memberships + class + period) secara independen — duplikasi kerja server setiap kunjungan beranda. Gabungkan server-side atau cache per-request.

- **Pesan error internal bocor ke UI siswa.** Catch block kedua action mengembalikan `err.message` apa adanya; error Prisma/engine bisa mengekspos nama tabel, constraint, atau detail koneksi ke klien. Log detail di server, kembalikan pesan generik.

- **Assessment `ARCHIVED` menghapus nilai final secara diam-diam.** Query assessment memfilter `status: "COMPLETED"` saja; jika assessment yang sudah COMPLETED lalu di-ARCHIVE (disembunyikan/dipensiunkan), nilai final yang sudah pernah terbit lenyap dari pohon/tren/widget siswa tanpa jejak. `AssessmentStatusLite` bahkan mendeklarasikan `"ARCHIVED"`, tapi matriks I/O, Design Notes, maupun test tidak mendefinisikan semantiknya — putuskan eksplisit (tetap tampil / dikecualikan) dan uji.

- **Pengelompokan bulan presensi bergantung timezone server.** `summarizeMonthlyAttendance` memakai `new Date(r.date).getFullYear()/getMonth()` (TZ lokal proses), dan int test membuat tanggal via `new Date(2026, 8, day)` (tengah malam lokal). Di server/kelompok tes UTC, 1 Sept waktu Jakarta menjadi 31 Agu → bucket bulan salah dan `expect(sept.hadir).toBe(2)` gagal. Gunakan strategi tanggal deterministik (UTC atau util tanggal aplikasi) di service maupun fixture.

- **Tren bar mengabaikan `maxScore` per penilaian.** Bar diskalakan terhadap `Math.max(100, ...scores)`; penilaian berskala 50 atau 10 poin dirender sebagai bar pendek yang terlihat "buruk", dan perbandingan visual lintas penilaian menjadi tidak apple-to-apple (keputusan terkunci hanya bicara skor, bukan skala). Normalisasi per `maxScore` penilaian atau tampilkan konteks skala.

- **Pemilihan snapshot fallback non-deterministik.** `snapshotByLo` (actions) mengambil link pertama yang ditemui, tetapi `assessment.findMany` **tanpa `orderBy`** — jika satu LO dilink >1 assessment dengan snapshot berbeda, snapshot yang menang tergantung urutan balasan DB. Tambahkan `orderBy` deterministik (mis. `assessmentDate desc`) dan dokumentasikan pilihan "snapshot terbaru".

- **Kegagalan widget ditelan diam-diam di beranda.** Jika `widgetRes` gagal, `widget` tetap `null` dan seluruh seksi menghilang; dikombinasikan dengan guard `widget?.hasActivePeriod`, error tak terbedakan dari "tidak ada periode aktif". Minimal tampilkan state error/retry atau log — saat ini debugging produksi jadi buta.

- **Copy empty-state widget mengaburkan "belum ada mapel" vs "belum ada nilai final".** Halaman nilai membedakan dua kondisi itu ("Belum Ada Mapel" vs "Belum ada nilai final"), widget hanya punya satu pesan "Belum ada nilai final… setelah guru memfinalisasi penilaian" — menyesatkan saat rombel memang belum punya teaching context sama sekali.

- **Rekap presensi tidak memfilter `TeachingSession.status`.** Query attendance menyertakan semua record sesi periode aktif terlepas status sesinya; int test hanya membuat sesi `COMPLETED`. Jika record presensi bisa menempel pada sesi CANCELLED/rescheduled, hitungan H/S/I/A menggelembung. Samakan dengan asumsi status sesi valid, atau filter di query.

- **Kriteria acceptance "parameter identitas klien diabaikan" tidak punya test yang benar-benar mengujinya.** Int test hanya membuktikan "tanpa sesi → error". Secara struktural actions memang tanpa parameter (garantinya implisit), tapi kriteria seperti tertulis menjanjikan pengujian input identitas klien yang diabaikan — tidak ada test demikian; pertegas formulasinya atau tambahkan test kontraktual.

- **Definisi FINAL kanonik kini punya dua salinan.** `isFinalScore` (student-progress.service) menduplikasi gate `COMPLETED && GRADED && finalScore !== null` yang juga tertanam inline di `calculateStudentRunningPerformance` (assessment.service) dan konsep yang sama di `monitoring.service`. Jika definisi FINAL berubah (status baru, aturan skor null), tiga tempat bisa berdrift. Ekspor satu predikat bersama dari assessment.service dan reuse di semuanya.

- **Verification tidak menyertakan lint/build.** Hanya `tsc --noEmit` + `npm test`. `next lint`/`npm run build` akan menangkap impor tak terpakai (temuan di atas), pelanggaran export "use server", dan masalah RSC — murah dan relevan untuk file baru sebanyak ini; tambahkan ke Commands.

- **Amendemen CAP-5 (bottom nav 5→6) tidak tercatat di Spec Change Log story.** Keputusan terkunci #3 dan memlog mencatat amendemen ringan constraint CAP-5, tetapi seksi `## Spec Change Log` pada file story kosong — jejak audit amendemen konstraint spec seharusnya hidup di sana sesuai template story, bukan hanya di memlog.

- **`AttendanceTab` tidak benar-benar "default bulan berjalan".** Design Notes menyatakan "default bulan berjalan + navigasi bulan", namun implementasi membuka `idx = 0` = bulan **terbaru yang punya record** — awal bulan sebelum presensi tercatat, tab terbuka di bulan lalu tanpa penanda bahwa itu bukan bulan ini. Selaraskan dengan catatan desain atau perbaiki catatannya.
