---
title: 'Story 7 — Student Progress (Gelombang 2)'
type: 'feature'
created: '2026-09-23'
status: 'done'
route: 'full'
review_loop_iteration: 0
baseline_commit: '4a4d347b1d2f07bbba5a590d26b09ed43c51787b'
context:
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/glossary.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/execution-stages.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/portal-modules.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** CAP-9 belum terwujud — siswa belum bisa melihat capaian belajarnya: nilai FINAL per mapel & pohon ketuntasan TP, rekap presensi bulanan, dan widget ketuntasan di beranda (daftar tugas read-only modul 2.3 sudah terbangun di Story 4).

**Approach:** Bangun service agregasi murni (FINAL-only) + action portal berbasis sesi, halaman "Nilai" (pohon ketuntasan TP per mapel + tren + tab presensi bulanan), dan widget ketuntasan ringkas di beranda. Tanpa skema baru — murni agregasi atas tabel existing.

## Boundaries & Constraints

**Always:**
- Nilai FINAL kanonik (glossary.md): `AssessmentResult.status === 'GRADED'` **DAN** parent `Assessment.status === 'COMPLETED'` — query wajib join keduanya; memfilter `AssessmentResult` saja tidak cukup.
- Semua query di-scope ke periode aktif rombel (pola resolusi membership `student-portal.actions.ts`); `studentId` selalu di-derive dari `verifyStudentSession()`.
- Skor null/ABSENT/EXCUSED/PENDING dikecualikan, tidak pernah dikonversi jadi 0 (amandemen 2–4; pola `summarizeStudentAssessments`).
- Unit test membuktikan nilai non-FINAL tidak bocor ke agregasi mana pun (pohon, tren, widget).
- N9 regresi nol: `/q/[token]` & `/parent/*` tetap hijau.

**Keputusan terkunci (human, 2026-09-23):**
1. **Nilai berjalan per mapel + tren** = reuse bobot `GradePolicy` (status ACTIVE) via `calculateStudentRunningPerformance()` — angka siswa identik dengan leger guru. Policy DRAFT/tidak ada → fallback rata-rata flat semua nilai FINAL dengan label kecil "rata-rata sederhana — bobot belum diatur guru".
2. **Pohon ketuntasan TP** = proporsi KKTP per penilaian: tiap penilaian FINAL dengan `minimumPassingScore` dinilai tuntas bila `finalScore` ≥ KKTP-nya; TP menampilkan "x dari y penilaian tuntas", status TUNTAS bila semua tuntas; penilaian tanpa KKTP hanya menyumbang skor/tren, dikecualikan dari proporsi ketuntasan.
3. **Bottom nav 6 item** — tambah item "Nilai" (amendemen ringan constraint CAP-5 yang 5 item).
4. **Presensi `LATE`** dihitung sebagai H (hadir); jumlah telat tampil sebagai keterangan.

**Never:**
- Tanpa migrasi/skema baru (termasuk TIDAK membuat model GradePolicy baru — agregasi memakai kolom existing).
- Tanpa jalur tulis apa pun dari sisi siswa (modul 2.1/2.2/2.4 bersifat pasif).
- `StudentMonitoringNote`, Prota/Prosem, dan identitas sunting mandiri tidak tampil (§4.4).
- Tidak mengubah signature `startQuizAttemptAction` maupun action quiz Story 4.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Siswa ACTIVE, enrollment periode aktif, ada assessment FINAL terkait TP | Nilai berbobot per mapel (GradePolicy ACTIVE; fallback flat berlabel), pohon ketuntasan per TP "x dari y tuntas" (KKTP per penilaian), tren nilai, info remedial | — |
| NON-FINAL leak | `AssessmentResult` GRADED pada `Assessment` IN_PROGRESS/DRAFT | Tidak muncul di pohon/tren/widget mana pun | Unit test wajib membuktikan |
| Skor null / ABSENT / EXCUSED / PENDING | Result non-GRADED | Dikecualikan dari agregasi; bukan 0 | — |
| TP tanpa penilaian FINAL | LO tanpa link assessment FINAL | Tampil "belum dinilai", bukan 0% | — |
| Assessment tanpa `minimumPassingScore` | KKTP null | Hanya menyumbang skor/tren; dikecualikan dari proporsi ketuntasan TP (keputusan terkunci #2) | — |
| Siswa tanpa periode aktif / PENDING | Membership hanya periode lama / belum disetujui | Keadaan kosong aman (pola `hasActivePeriod`) | Tanpa error |
| Presensi bulanan tanpa record | Bulan tanpa `AttendanceRecord` | Rekap H/S/I/A = 0; `LATE` dipetakan sesuai keputusan ③ | — |
| Widget beranda | Mapel tanpa data FINAL | Mapel di-skip/ditandai "belum ada nilai" (bukan 0%) | — |

</frozen-after-approval>

## Code Map

- `src/modules/student-portal/student-portal.actions.ts` — pola referensi: resolusi membership prioritas periode ACTIVE, action berbasis `verifyStudentSession()`; dashboard action = tempat widget 2.4 menempel.
- `src/modules/monitoring/monitoring.service.ts` — `summarizeStudentAssessments`: logika FINAL kanonik + KKTP (`finalScore < minimumPassingScore` per assessment); pola referensi, JANGAN diubah.
- `src/modules/assessment/assessment.service.ts` — `calculateStudentRunningPerformance()`: nilai berjalan berbobot (GradePolicy) dengan gating FINAL kanonik + `availableWeight` data parsial — REUSE untuk nilai per mapel; jangan tulis ulang logika bobot.
- `src/modules/reporting/reporting.actions.ts` (`getScoreRecapReport`) — pola pemuatan GradePolicy (`findUnique` + items, `hasActiveGradePolicy`) — referensi cara query policy.
- `prisma/schema.prisma` — `Assessment` (status, `minimumPassingScore` nullable), `AssessmentResult` (finalScore, status, `@@unique[assessmentId,studentId]`), `AssessmentLearningObjective` (snapshotCode/Description), `LearningObjective` (code, description, orderIndex, targetSemester), `RemedialAttempt` (score), `AttendanceRecord` (status: PRESENT/SICK/PERMISSION/ABSENT/LATE), `Assignment`, `GradePolicy`/`GradePolicyItem` (bobot per jenis penilaian, status DRAFT/ACTIVE).
- `src/app/siswa/portal/*` — halaman existing (layout + `StudentBottomNav`); `tugas/page.tsx` = modul 2.3 sudah jadi (read-only, scope periode aktif).
- `src/components/student/StudentBottomNav.tsx` — kini 5 item (Hari Ini, Jadwal, Kuis, Tugas, Profil); tambah item "Nilai" jadi 6 (keputusan terkunci #3).
- `src/modules/student-portal/__tests__/story-4-full-audit.int.test.ts` + `student-portal.actions.test.ts` — pola suite real-db & unit test.
- `src/modules/attendance/`, `TeachingSession` — sumber data presensi per sesi.

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/student-portal/student-progress.service.ts` (BARU) — agregasi murni tanpa DB: pohon ketuntasan per mapel (LO ⇄ `AssessmentLearningObjective` ⇄ result FINAL-only, proporsi KKTP per penilaian), nilai berjalan via reuse `calculateStudentRunningPerformance` + fallback flat berlabel, tren, ringkasan widget, rekap presensi bulanan (LATE→H + keterangan) — unit-testable.
- [x] `src/modules/student-portal/student-progress.actions.ts` (BARU) — action berbasis sesi: verifikasi → scope periode aktif → query Prisma (termasuk GradePolicy per mapel) → delegasi ke service; return shape untuk halaman Nilai + widget beranda.
- [x] `src/app/siswa/portal/nilai/page.tsx` (BARU) — UI pohon ketuntasan per mapel + nilai berjalan + tren + info remedial + tab Presensi; empty state aman tanpa periode aktif.
- [x] `src/components/student/StudentBottomNav.tsx` + beranda — nav 6 item (tambah "Nilai") & widget ketuntasan ringkas (2.4).
- [x] `src/modules/student-portal/__tests__/student-progress.service.test.ts` (BARU) — unit test matriks di atas: non-FINAL tak bocor, null≠0, TP kosong, KKTP null dikecualikan dari proporsi, fallback flat saat policy non-ACTIVE, LATE→H.
- [x] `src/modules/student-portal/__tests__/story-7-progress.int.test.ts` (BARU) — suite real-db rantai DoD: guru finalisasi assessment (COMPLETED + GRADED) → siswa (sesi) melihat nilai di pohon; regresi titik FINAL ganda.

**Acceptance Criteria:**
- Given assessment masih IN_PROGRESS dengan result GRADED, when siswa membuka Nilai/widget, then nilai itu tidak tampil di agregasi mana pun.
- Given guru finalisasi assessment (COMPLETED + result GRADED) untuk TP tertentu, when siswa membuka halaman Nilai, then nilai muncul pada TP terkait (rantai int-test).
- Given request data progress, then `studentId` berasal dari sesi — parameter identitas klien diabaikan.
- `tsc` bersih; seluruh test hijau; `/q/[token]` & `/parent/*` tetap hijau (N9).

## Implementation Notes

- Widget action awalnya skip pemuatan TP tree (`includeTpTree: false`), tapi widget beranda menampilkan "TP tuntas x/y" — diubah ke `true` (ditemukan via int test gagal `tuntasTpCount`).
- Query assessment difilter `status: COMPLETED` di level Prisma (proteksi pertama); gating FINAL ganda tetap ditegakkan di service via `isFinalScore` (proteksi kedua) — sesuai boundary "join keduanya".
- Baris matriks "siswa tanpa periode aktif" diuji dengan 2 siswa tambahan di int test: tanpa membership rombel & hanya membership periode INACTIVE — keduanya kembali keadaan kosong aman.
- `pinUpdatedAt` dihitung non-null via `!` pada student test fixtures (schema selalu terisi pada jalur klaim/login).

**Patch pass 1 (hasil review):** aria-label bulan presensi ditukar; impor mati (`Award`, `ArrowRight`) dihapus; widget beranda mengurutkan mapel ber-nilai dulu + hint "+N mapel lainnya"; kedua action digabung ke `loadProgressCore` (duplikasi & flag mati hilang) dengan query batched `teachingContextId in [...]` (N+1 hilang, 31→5 query); error kini generik + `console.error` server (pesan internal tak bocor); grouping bulan presensi memakai `Intl` zona Asia/Jakarta + fixture ISO UTC; bar tren dinormalisasi `score/maxScore` (field `percent`); snapshot LO deterministik via `orderBy assessmentDate desc`; beranda `Promise.allSettled` + hint kegagalan widget + copy "belum ada mapel" vs "belum ada nilai final" dipisah; `summarizeMonthlyAttendance` mensintesis bulan nol dari record pertama s.d. bulan berjalan (kepatuhan matriks); int test + fixture isolasi antar-periode untuk siswa utama (mapel+nilai+presensi periode lama tidak bocor).

## Spec Change Log

## Review Triage Log

**Pass 1 (2026-09-23):** blind-hunter 19 + edge-case-hunter 7 + verification-gap 3 gap + 2 other = 31 temuan → verdict: 10 medium, 13 low (2 di antaranya rejected), 6 false, 2 gap-defer; 0 high; 0 bad_spec/intent_gap. Patch dijalankan langsung (runtime tanpa subagent); verifikasi ulang: tsc bersih, 773/773 test hijau.

| # | Temuan | Verdict | Route | Bukti/putusan |
|---|---|---|---|---|
| BH1 | aria-label bulan terbalik | low | patch | label tertukar vs arah ikon; ditukar (nilai/page.tsx) |
| BH2 | impor `Award`/`ArrowRight` tak terpakai | low | patch | hanya dipakai portal/page.tsx; dihapus |
| BH3 | widget `slice(0,4)` menyembunyikan mapel bernilai | medium | patch | urutan alfabetis + slice bisa memunculkan 4 kartu kosong; sort `hasFinalData` dulu + hint "+N" |
| BH4 | duplikasi ~50 baris dua action; flag `includeTpTree` mati | medium | patch | digabung `loadProgressCore`; flag dihapus |
| BH5 | N+1 (3 query × mapel) di `loadSubjects` | medium | patch | 10 mapel → ±31 query; dibatch `in: contextIds` → 5 query total |
| BH6 | beranda resolve sesi+membership 2× | low | reject | biaya 1 findUnique ekstra per load, negligible; fix = merge lintas kontrak action story-4 |
| BH7 | `err.message` bocor ke UI siswa | low | patch | pesan generik + `console.error` server (2 catch) |
| BH8 | ARCHIVED menghapus nilai final diam-diam | false | — | glossary mengikat: FINAL = COMPLETED+GRADED; ARCHIVED memang bukan FINAL — perilaku sesuai kontrak |
| BH9 | grouping bulan presensi ikut TZ server | medium | patch | kunci bulan `Intl` Asia/Jakarta; fixture ISO UTC; test batas 31-Agu-UTC→1-Sep-WIB |
| BH10 | bar tren abaikan `maxScore` | low | patch | `TrendPoint.percent = score/maxScore×100`; bar pakai percent; test 40/50=80% |
| BH11 | snapshot fallback non-deterministik | low | patch | `orderBy assessmentDate desc` → snapshot terbaru menang |
| BH12 | kegagalan widget ditelan diam-diam | low | patch | lihat ECH1/2 |
| BH13 | copy widget mengaburkan tanpa-mapel vs tanpa-nilai | low | patch | dua pesan berbeda |
| BH14 | presensi tak filter status sesi | false | — | `SessionStatus` hanya IN_PROGRESS|COMPLETED — sesi CANCELLED tak ada di schema |
| BH15 | kriteria "param identitas diabaikan" tanpa test | false | — | action tanpa parameter identitas sama sekali (jaminan struktural); jalur sesi teruji int |
| BH16 | gate FINAL terduplikasi 3 modul | low | reject | semantik ter-pin test di 3 suite (assessment/monitoring/story-7); refactor lintas modul > koreksi |
| BH17 | Verification tanpa lint/build | false | — | fix-nya = edit spec (dilarang triage); lint dijalankan manual sebagai verifikasi tambahan |
| BH18 | amendemen CAP-5 tak di Spec Change Log | false | — | fix-nya = edit spec; sudah tercatat di frozen Keputusan terkunci #3 + memlog |
| BH19 | default tab presensi ≠ bulan berjalan | medium | patch | digabung sintesis bulan nol: idx0 kini = bulan berjalan |
| ECH1 | `Promise.all` buang hasil saat satu reject | low | patch | `Promise.allSettled` di beranda |
| ECH2 | widget gagal tanpa umpan balik | low | patch | hint kecil "widget gagal dimuat" + console.warn |
| ECH3 | idem BH3 | medium | patch | idem BH3 |
| ECH4 | dua periode ACTIVE → membership arbitrer | false | — | story-6 saklar periode atomik menegakkan ≤1 ACTIVE/sekolah (updateMany + test rollover) |
| ECH5 | idem BH7 | low | patch | idem BH7 |
| ECH6 | idem BH9 | medium | patch | idem BH9 |
| ECH7 | claim: matriks "rekap 0" vs tanpa baris | medium | patch | sintesis bulan nol Juli→Sept diuji unit; kepatuhan matriks dipulihkan |
| VG1 | isolasi antar-periode tanpa fixture berdata | medium (gap) | patch | fixture: siswa utama + mapel/nilai/presensi periode lama → assert tak tercampur (8 test int) |
| VG2 | suite int pass diam tanpa DB | gap | defer | konvensi 4 suite int (S4–S7); perubahan = keputusan test-infra lintas-suite |
| VG3 | UI baru tanpa test render | gap | defer | repo tanpa infra komponen (nol `*.test.tsx`); data di bawah UI ter-cover level action |
| VGO1 | idem ECH7/BH19 | medium | patch | idem |
| VGO2 | idem BH2 | low | patch | idem |

## Design Notes

- Snapshot fallback: render pakai `LearningObjective` live (status ACTIVE); bila LO terhapus/non-ACTIVE, fallback ke `snapshotCode`/`snapshotDescription` di `AssessmentLearningObjective`.
- `RemedialAttempt` tampil sebagai info tambahan (skor percobaan terakhir) — TIDAK mengubah `finalScore` maupun status ketuntasan (konsisten sisi guru yang hanya menghitung `remedialCount`).
- Agregasi presensi: group by bulan kalender dari `TeachingSession` periode aktif; default bulan berjalan + navigasi bulan.

## Verification

**Commands:**
- `npx tsc --noEmit` — expected: bersih tanpa error.
- `npm test` — expected: semua suite hijau termasuk unit & int test baru (DoD Tahap 7: unit test agregasi + non-FINAL tak bocor + rantai finalisasi→siswa).

