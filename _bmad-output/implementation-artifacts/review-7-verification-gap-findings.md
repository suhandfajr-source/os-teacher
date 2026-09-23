# Verification Gap Review — Findings (Story 7)

**Lens:** verification-gap · **Target:** diff Story 7 — Student Progress Gelombang 2 (`student-progress.service.ts`, `student-progress.actions.ts`, `nilai/page.tsx`, widget beranda, nav 6 item, 2 suite test baru) · **Tanggal:** 2026-09-23
**Basis verifikasi repo:** working tree di atas `baseline_commit 4a4d347` (perubahan belum di-commit), `npm test` = `vitest run` (`src/**/*.test.ts`), tanpa CI workflow (`.github/workflows` tidak ada).

## Screening

Bagian diff yang non-behavioral dan di-skip: `.memlog.md` dan `stories/7-student-progress-gelombang-2.md` — metadata perencanaan, tanpa konsumen runtime.

Bagian behavioral: service agregasi murni baru, 2 server action baru, halaman `/siswa/portal/nilai` baru, widget beranda + fetch paralel di `portal/page.tsx`, item nav ke-6 di `StudentBottomNav.tsx`.

**Yang sudah terverifikasi (bukan temuan):**

- Gating FINAL ganda (COMPLETED **dan** GRADED **dan** skor non-null) dipindai di unit test (`isFinalScore`, `buildSubjectProgress` — termasuk GRADED-pada-IN_PROGRESS, null-score, ABSENT/EXCUSED/PENDING) **dan** di jalur real-query int test (a3 IN_PROGRESS + GRADED 99 → `finalCount 2`, trend tak memuat, `averageScore 85`).
- Jalur WEIGHTED tetap mematuhi gating: reuse `calculateStudentRunningPerformance` digerakkan dengan policy ACTIVE + a3 non-final di int test — `runningScore 72.5` gagal jika 99 bocor ((85+60+99)/3 = 81.33); gating helper itu sendiri juga dipindai independen di `src/modules/assessment/__tests__/assessment.test.ts:207-228` (exclude IN_PROGRESS/DRAFT).
- LATE→H + `lateCount` (unit + int), TANPA_KKTP dikecualikan dari proporsi widget & pohon (unit), fallback flat berlabel saat policy non-ACTIVE (unit), remedial info-only tidak menaikkan ketuntasan (unit), snapshot fallback LO non-ACTIVE (unit), gerbang sesi (int: tanpa cookie → error), keadaan kosong loner & INACTIVE-only (int), konsistensi widget vs halaman (int).
- N9: suite `/q/[token]` & `/parent/*` (`story-5-full-audit`, `story5-session-guards`, `story-6-rollover`, `parent.*`) ada dan berjalan di `vitest run`; diff tidak menyentuh jalur tersebut.

## Findings

### Isolasi data antar-periode (prioritas membership ACTIVE + scope `academicPeriodId` pada query mapel & presensi) tidak punya fixture dengan data periode lama bagi siswa AKTIF

- **Changed surface:** `src/modules/student-portal/student-progress.actions.ts:53` — `student.classMemberships.find((cm) => cm.academicPeriod.status === "ACTIVE") ?? student.classMemberships[0]`; `:70-71` — `prisma.teachingContext.findMany({ where: { classId, academicPeriodId } })`; `:224-227` — filter presensi `teachingSession: { teachingContext: { classId, academicPeriodId } }`.
- **Impacted consumer or site:** siswa yang naik kelas / lanjut tahun ajaran (bentuk produksi normal: membership INACTIVE tahun lalu + membership ACTIVE tahun ini, sesi presensi & teachingContext periode lama tetap ada di DB) memanggil `getStudentProgressDataAction` / `getStudentProgressWidgetAction`.
- **Existing test evidence:** fixture int story-7: siswa utama punya **tepat satu** membership ACTIVE (`story-7-progress.int.test.ts:182`), satu teachingContext dan ketiga sesi presensi semuanya di periode aktif (`:251-254`); dua siswa tambahan hanya mencakup tanpa-membership (`:271`) dan membership INACTIVE-saja (`:294-313`, ditegaskan kosong pada `:409-421`) — **tidak ada** yang memberi siswa AKTIF data periode lama. Pencarian simbol/status: `rg "INACTIVE"` di `src/modules/student-portal/__tests__/` → nol hit di `story-4-full-audit.int.test.ts` dan `student-portal.actions.test.ts`; mock unit di sana hanya membangun periode ACTIVE (`student-portal.actions.test.ts:104,175`). Tidak ada fixture membership campuran ACTIVE+INACTIVE di mana pun dalam repo.
- **Missing verification:** fixture int di mana siswa AKTIF juga punya membership periode INACTIVE + minimal satu `teachingSession`/`AttendanceRecord` periode lama (idealnya satu teachingContext periode lama), dengan assertion bahwa rekap/pohon/widget hanya memuat data periode aktif dan membership ACTIVE yang menang.
- **Demonstration:** hapus `academicPeriodId` dari `where` di `:71` atau dari filter konteks presensi di `:227`, atau ganti `find((cm) => …ACTIVE)` di `:53` dengan `student.classMemberships[0]` — seluruh 7 test story-7 tetap hijau karena tidak ada fixture berisi data out-of-scope; di produksi, siswa lanjut tahun mendapat mapel/presensi periode lama tercampur ke rekap, atau resolusi jatuh ke rombel lama.
- **Consequence:** kebocoran data antar-periode (tahun ajaran sebelumnya) ter ship hijau tanpa ada test yang gagal.
- **Disposition:** `patch` — baris `oldAp`/`oldCls` sudah ada di `beforeAll` (`:294-297`); tambahkan satu `teachingSession`+`AttendanceRecord` periode lama untuk siswa utama dan satu `classStudent` periode lama untuknya, lalu assert rekap September dan daftar mapel tetap ter-scope. Satu fixture menutup ketiga call site sekaligus, mengikuti pola fixture int yang sudah ada.

### Suite int real-DB story-7 lolos diam-diam (test PASS tanpa mengeksekusi) saat DB tidak terjangkau

- **Changed surface:** `src/modules/student-portal/__tests__/story-7-progress.int.test.ts:62` (`dbAvailable = false`), `:326-328` (catch koneksi → `console.warn` → `dbAvailable = false`), dan early-return `if (!dbAvailable) return;` di setiap `it` (`:333,344,355,368,377,387,398,409`) — tanpa DB, setiap test **PASS**.
- **Impacted consumer or site:** seluruh rantai DoD story-7 (finalisasi→siswa, kebocoran non-FINAL via query nyata, LATE→H end-to-end, gerbang sesi, keadaan kosong) — suite ini adalah satu-satunya yang mengeksekusi `getStudentProgressDataAction`/`getStudentProgressWidgetAction` terhadap Prisma sungguhan.
- **Existing test evidence (Broken-verification):** jalur verifikasi normal = `npm test` → `vitest run` (package.json), tanpa CI — hijau bergantung pada DB lokal terjangkau; saat gagal koneksi, suite tetap melaporkan hijau hanya dengan `console.warn` yang mudah terlewat di antara output vitest. Pola yang sama dipakai story-4 (`story-4-full-audit.int.test.ts:50`), story-5 (`story-5-full-audit.int.test.ts:101`), story-6 (`story-6-rollover.int.test.ts:43`) — jadi ini konvensi repo, bukan penyimpangan story-7.
- **Missing verification:** sinyal fail-loud: gerbang env var (skip eksplisit), `ctx.skip()`/`it.skipIf` agar vitest mencatat "skipped" (bukan pass), atau assert koneksi di `beforeAll` dan lempar.
- **Demonstration:** jalankan `npm test` dengan `DATABASE_URL` kosong/tidak terjangkau — seluruh 7 test story-7 (dan sister suite lain) hijau tanpa satu pun query dieksekusi; regresi apa pun pada rantai DoD ter ship bersama build "hijau" tersebut.
- **Consequence:** hasil hijau bukan bukti rantai DoD pernah berjalan; perlindungan int hilang diam-diam persis pada lingkungan tanpa DB.
- **Disposition:** `defer` — konvensi lintas 4 suite int yang sudah ada; mengubah semantik skip adalah keputusan test-infra lintas-suite, bukan bagian diff story-7 ini.

### Layer UI baru (rute `/siswa/portal/nilai`, item nav ke-6, widget beranda) tidak punya cakupan otomatis apa pun

- **Changed surface:** `src/components/student/StudentBottomNav.tsx:47-51` (item nav "Nilai" → `/siswa/portal/nilai`), `src/app/siswa/portal/nilai/page.tsx` (halaman baru, 364 baris), `src/app/siswa/portal/page.tsx:87,278-338` (fetch widget paralel + render seksi "Capaian Belajar").
- **Impacted consumer or site:** navigasi siswa — satu-satunya titik masuk ke halaman Nilai dari shell portal; halaman & widget yang mengonsumsi `StudentProgressPageData`/`StudentProgressWidgetData`.
- **Existing test evidence:** pencarian `*.test.tsx`/`*.spec.tsx` di seluruh `src` → nol hasil; `devDependencies` tidak memuat `@testing-library/*`, `jsdom`, atau `happy-dom` (package.json diperiksa); `rg -l "StudentBottomNav"` → hanya komponen + `layout.tsx`. Tidak ada test yang mereferensikan rute, halaman, atau widget baru.
- **Missing verification:** cek otomatis apa pun bahwa nav merender 6 item dan tautannya resolve (atau halaman merender data action).
- **Demonstration:** hapus blok item nav (`:47-51`) atau salah ketik href (`/siswa/portal/nilia`) — `tsc` bersih, seluruh suite unit/int hijau; halaman tak terjangkau dari nav sampai manusia mengkliknya.
- **Consequence:** regresi navigasi/rendering ter ship hijau; fitur CAP-9 tak terjangkau meski semua test hijau.
- **Disposition:** `defer` — repo tidak punya infrastruktur test komponen sama sekali; memperkenalkannya demi satu item nav tidak proporsional dengan story ini. Ketepatan data di bawah UI sudah dipindai di level action oleh int test; residual risiko dibatasi pada rendering murni.

## Other findings

- Ketidaksesuaian matriks story vs implementasi untuk presensi: baris matriks "Presensi bulanan tanpa record → Rekap H/S/I/A = 0" (`stories/7-student-progress-gelombang-2.md`, I/O & Edge-Case Matrix) — implementasi justru **tidak menghasilkan baris** untuk bulan tanpa record (`summarizeMonthlyAttendance([]) → []`, dipinkan unit test `student-progress.service.test.ts:297`), dan `AttendanceTab` (`nilai/page.tsx`) default ke bulan **terbaru yang punya record** (`idx = 0`), bukan "rekap 0" untuk bulan kosong dan bukan "default bulan berjalan" seperti Design Notes. Siswa dengan data September tapi Oktober kosong tidak melihat baris Oktober sama sekali. Item triage kesesuaian-spec, bukan gap verifikasi.
- Import tak terpakai di `src/app/siswa/portal/nilai/page.tsx:13,15` — `Award` dan `ArrowRight` hanya muncul di baris import (ikon tersebut dipakai di `portal/page.tsx`, bukan di file ini); `tsc` tetap bersih, `eslint` akan menandai tergantung konfigurasi.
