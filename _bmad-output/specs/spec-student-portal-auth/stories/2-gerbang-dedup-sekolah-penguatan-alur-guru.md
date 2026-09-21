---
title: 'Story 2 — Gerbang Dedup Sekolah & Penguatan Alur Guru'
type: 'feature'
created: '2026-09-21'
status: 'done'
baseline_commit: 'ff3a0bfe139ef6d2adbd04f2f6935452be67f76c'
route: 'full'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/execution-stages.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/architecture-diagrams.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/glossary.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Guru dapat membuat sekolah duplikat di `createSchool`/`submitOnboarding` tanpa validasi NPSN maupun kesamaan nama (G1), pencarian sekolah belum mendukung NPSN dan metadata rombel/guru (G2), belum ada transparansi anggota guru dan proteksi otorisasi revoke (G3), serta query siswa masih mengekspos field `accessPinHash` ke klien (VG-other2).

**Approach:** Bangun utilitas `school-dedup.ts` (normalisasi v2 + alias jenjang, konversi romawi/leading-zero, number-aware token similarity, dan candidate pre-filtering); pasang gerbang dedup 4 skenario (a: NPSN match, b: nama exact, c: kemiripan ≥85% dengan nomor identik, d: lolos/force) di `createSchool` dan `submitOnboarding` dengan UI "Maksud Anda?"; cegah re-aktivasi sepihak via `joinSchool` untuk user `REVOKED`; perkuat otorisasi Mode Santai (anti-hostile takeover: `MEMBER` dilarang me-revoke `OWNER`); sediakan backfill N2 `School.normalizedName`; serta amankan seluruh query siswa dengan proyeksi `select` eksplisit tanpa `accessPinHash` dan sanitasi NIS kanonik.

## Boundaries & Constraints

**Always:**
- Gerbang dedup 4 skenario berurutan dengan Candidate Pre-filtering (maksimal 50 kandidat per wilayah/token untuk efisiensi query DB): (a) NPSN match -> tolak, tawarkan gabung; (b) `normalizedName` v2 exact -> tolak, tawarkan gabung; (c) kemiripan ≥85% dengan nomor sekolah identik -> minta konfirmasi; (d) lolos / `forceCreate: true` -> buat sekolah + OWNER.
- Normalisasi v2 (`normalizeSchoolName`): trim, lowercase, buang tanda baca, ekspansi alias jenjang kata (`smpn`/`smp n` -> `smp negeri`, `sdn`/`sd n` -> `sd negeri`, `sman`/`sma n` -> `sma negeri`, `smkn`/`smk n` -> `smk negeri`, `mtsn`/`mts n` -> `mts negeri`, `man`/`ma n` -> `ma negeri`, `min`/`mi n` -> `mi negeri`), normalisasi angka romawi (`i`->`1`, `ii`->`2`, `iii`->`3`, `iv`->`4`, `v`->`5`, `vi`->`6`, `vii`->`7`, `viii`->`8`, `ix`->`9`, `x`->`10`), buang leading zero pada digit (`01` -> `1`), dan kolaps spasi.
- **Number-Aware Fuzzy Matching**: Jika dua nama sekolah memiliki token angka/nomor yang **berbeda** (misal `"SMP Negeri 1 Surabaya"` vs `"SMP Negeri 2 Surabaya"`), similarity rasio langsung **dibatalkan / di-veto ke 0%** (mereka adalah sekolah berbeda, bukan duplikat/typo).
- `joinSchool` **MUTLAK menolak** permohonan gabung jika guru memiliki catatan keanggotaan berstatus `REVOKED` di sekolah target (`throw new Error("Keanggotaan Anda di sekolah ini telah dinonaktifkan.")`).
- Panel guru sekolah ("Guru di Sekolah Kita") menampilkan rekan guru aktif dan aksi `revoke`:
  - `MEMBER` **DILARANG** me-revoke `OWNER` (`throw new Error("Hanya SuperAdmin atau pengelola sekolah yang dapat mengubah status Owner.")`).
  - Dilarang me-revoke diri sendiri (`throw new Error("Tidak dapat me-revoke diri sendiri.")`).
  - Mencatat `AuditLog` (`actorType: "USER"`, `action: "TEACHER_MEMBERSHIP_REVOKED"`, `targetType: "TEACHER_SCHOOL_MEMBERSHIP"`, `targetId: membership.id`, metadata: `{ schoolId, targetTeacherProfileId, targetWorkspaceRole }`).
- Script backfill N2 idempotent, memperbarui seluruh baris `school.normalizedName` yang belum sesuai v2 dengan metode batching (chunk size 100).
- `searchSchools` v2 mencari nama ATAU NPSN (contains / insensitive) + metadata `_count` (`memberships` aktif dan `classes`).
- `updateStudent`, `addStudent`, dan `findOrCreateStudent`:
  - Sanitasi NIS kanonik: trim + uppercase, string kosong `""` dinormalisasi menjadi `null`.
  - Tangkap Prisma error `P2002` pada `[schoolId, nis]` dan `[npsn]` dengan response ramah pengguna.
  - Proyeksi `select` aman di seluruh action/query siswa tanpa menyertakan `accessPinHash` (VG-other2).

**Never:**
- Mengizinkan bypass `forceCreate` jika NPSN atau `normalizedName` v2 sudah ada (skenario a & b mutlak tolak).
- Mengizinkan guru berstatus `REVOKED` mengaktifkan kembali keanggotaannya via `joinSchool`.
- Mengizinkan `MEMBER` me-revoke `OWNER` sekolah.
- Menganggap dua sekolah bernomor berbeda ("1" vs "2") sebagai kembar/fuzzy duplicate (skenario c).
- Mengubah skema basis data (`schema.prisma`) — model existing sudah mencukupi.
- Menghapus baris membership fisik saat revoke (hanya ubah status ke `REVOKED`).
- Membiarkan query/action siswa mengekspos field `accessPinHash` ke klien.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Skenario A (NPSN Duplikat) | NPSN terdaftar dimasukkan di `createSchool` | `{ success: false, code: "NPSN_EXISTS", existingSchool }` | Tolak buat, arahkan gabung |
| Skenario B (Nama Persis v2) | `"SMPN 1 Surabaya"` vs DB `"SMP Negeri 1 Surabaya"` | `{ success: false, code: "EXACT_NAME_EXISTS", existingSchool }` | Normalisasi v2 cocok exact -> tolak, tawarkan gabung |
| Skenario C (Kemiripan ≥85%) | `"SMP Negeri 01 Sby"` vs DB `"SMP Negeri 1 Surabaya"` | `{ success: false, code: "SIMILAR_NAME_FOUND", matchedSchool, similarity }` | Dialog "Maksud Anda?" (Gabung / Tetap Buat Baru) |
| Beda Nomor Sekolah | `"SMPN 1 Surabaya"` vs DB `"SMPN 2 Surabaya"` | `{ success: true, school }` (Lolos Skenario D, Similarity 0%) | Tidak memicu dialog kembar palsu |
| Skenario C Bypass (Force) | Kemiripan ≥85% dengan `forceCreate: true` | `{ success: true, school }` (role OWNER) | Pembuatan sekolah baru diizinkan |
| Skenario D (Lolos Dedup) | Nama dan NPSN baru unik | `{ success: true, school }` (role OWNER) | Sukses tanpa peringatan |
| Re-join Pasca Revoke | Guru `REVOKED` panggil `joinSchool(schoolId)` | Throw error `REVOKED_CANNOT_REJOIN` | Akses ditolak permanen tanpa auto-reactivate |
| Revoke OWNER oleh MEMBER | Guru MEMBER panggil `revokeTeacherMembership` target OWNER | Throw error `FORBIDDEN_CANNOT_REVOKE_OWNER` | Transaksi dibatalkan |
| Revoke Guru Lain (Sah) | Guru OWNER/MEMBER revoke MEMBER B | Status B -> `REVOKED`, `AuditLog` tersimpan | Revoke diri sendiri -> throw Error |
| Edit NIS Siswa Duplikat | NIS baru sudah dipakai siswa lain di sekolah sama | `{ success: false, code: "NIS_EXISTS" }` | Tangkap P2002, pesan validasi ramah |
| Edit NIS Format Kosong | Input `"   "` | Disimpan `null`, `select` aman tanpa `accessPinHash` | Tidak melanggar unique constraint |

</frozen-after-approval>

## Code Map

- `src/lib/school-dedup.ts` — Utilitas pure: `normalizeSchoolName` (v2 + alias + romawi + leading zero), `extractSchoolNumbers`, `calculateSchoolSimilarity` (Number-Aware Levenshtein), fungsi evaluasi 4 skenario dedup.
- `src/modules/schools/schools.actions.ts` — Server actions: `searchSchools` v2 (nama/NPSN + counts), `createSchool` (dedup 4 skenario + pre-filtering max 50 + tangkap P2002 NPSN), `joinSchool` (block membership REVOKED), `getSchoolTeachers`, `revokeTeacherMembership` (role guard anti-owner revoke + AuditLog).
- `src/modules/teachers/teachers.actions.ts` — Integrasi dedup pada alur buat sekolah baru di `submitOnboarding`; verifikasi `switchActiveSchool`.
- `src/modules/students/students.actions.ts` — Sanitasi NIS kanonik (trim+uppercase, `""` -> `null`), penanganan graceful P2002, dan proyeksi `select` aman tanpa `accessPinHash` di `getStudents`, `updateStudent`, `archiveStudent`, `addStudent`, dan `findOrCreateStudent`.
- `scripts/backfill-school-normalized-names.ts` — Script CLI backfill N2 untuk sinkronisasi `normalizedName` v2 dengan chunk batching (100 baris per iterasi).
- `src/app/(onboarding)/onboarding/page.tsx` — Wizard onboarding: hasil cari dengan badge konteks dan dialog "Maksud Anda?".
- `src/app/(dashboard)/pengaturan/setup/SetupManager.tsx` — Tab "Guru Sekolah": daftar guru, badge role/status, aksi revoke, dan saklar sekolah aktif.
- `src/app/(dashboard)/siswa/[studentId]/page.tsx` — UI edit NIS dan nama siswa oleh guru pengampu.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/school-dedup.ts` & `src/lib/__tests__/school-dedup.test.ts` — Bangun normalisasi v2, tokenizer angka (Number-Aware), kalkulator kemiripan dengan veto nomor beda, fungsi evaluasi 4 skenario dedup, dan unit test komprehensif (termasuk kasus "SMPN 1" vs "SMPN 2").
- [x] `scripts/backfill-school-normalized-names.ts` & `package.json` — Buat script backfill N2 ber-batch, pasang script `backfill:schools`, dan jalankan ke database.
- [x] `src/modules/schools/schools.actions.ts` & `src/modules/schools/__tests__/schools.actions.test.ts` — Perbarui `searchSchools` v2 dan `createSchool` (dedup a–d + candidate pre-filtering + tangkap P2002); amankan `joinSchool` (tolak REVOKED); buat `getSchoolTeachers` & `revokeTeacherMembership` (role guard anti-owner revoke + AuditLog).
- [x] `src/modules/teachers/teachers.actions.ts` — Terapkan gerbang dedup pada alur buat sekolah baru di `submitOnboarding`.
- [x] `src/modules/students/students.actions.ts` & `src/modules/students/__tests__/students.actions.test.ts` — Amankan `updateStudent`, `getStudents`, `archiveStudent`, `addStudent`, dan `findOrCreateStudent` dengan proyeksi `select` (tanpa `accessPinHash`), sanitasi NIS kanonik (`""` -> `null`), dan penanganan graceful P2002.
- [x] `src/app/(onboarding)/onboarding/page.tsx` — Hubungkan UI onboarding dengan `searchSchools` v2 dan modal konfirmasi "Maksud Anda?".
- [x] `src/app/(dashboard)/pengaturan/setup/SetupManager.tsx` — Buat tab "Guru Sekolah" untuk transparansi anggota, aksi revoke, dan switch active school.
- [x] `src/app/(dashboard)/siswa/[studentId]/` — Sediakan UI dialog edit NIS & Nama siswa untuk guru.

**Acceptance Criteria:**
- Given nama sekolah bervariasi singkatan dan nomor (mis. `"SMPN 1"`, `"SMP Negeri 1"`, `"SMPN 01"`, `"SMPN I"`), when dinormalisasi v2, then menghasilkan string identik.
- Given dua sekolah dengan nomor berbeda (mis. `"SMP Negeri 1 Surabaya"` dan `"SMP Negeri 2 Surabaya"`), when dihitung kemiripannya, then kemiripan bernilai 0% (veto nomor beda) dan lolos sebagai sekolah baru tanpa false duplicate warning.
- Given database sekolah, when `npm run backfill:schools` dijalankan, then seluruh `normalizedName` terupdate konsisten dan proses bersifat idempotent dalam batch aman.
- Given registrasi sekolah dengan NPSN duplikat atau `normalizedName` persis, when `createSchool`/`submitOnboarding` dipanggil, then tolak pembuatan dan kembalikan data sekolah existing.
- Given guru yang telah di-revoke, when memanggil `joinSchool()`, then sistem melempar error dan menolak re-aktivasi sepihak.
- Given guru dengan role `MEMBER`, when mencoba me-revoke guru dengan role `OWNER`, then sistem menolak aksi tersebut.
- Given guru di sekolah aktif yang sama me-revoke rekan `MEMBER`, when dieksekusi, then status target menjadi `REVOKED` dan `AuditLog` tersimpan lengkap.
- Given seluruh pemanggilan server action siswa, when data diterima klien, then `accessPinHash` tidak pernah ada dalam payload.
- Given pengujian keseluruhan, when `npm test` dan `npm run verify:migrations` dijalankan, then 100% hijau.

## Implementation Notes

- **Number-Aware Tokenizer**: Fungsi `extractSchoolNumbers(str)` mengekstrak angka integer/romawi dari nama sekolah. Jika kedua nama memiliki angka dan angkanya tidak identik, similarity diskor `0`.
- **Pre-filtering Kandidat**: `createSchool` mengambil kandidat sekolah via `prisma.school.findMany({ where: { OR: [{ city: data.city }, { name: { contains: firstToken, mode: 'insensitive' } }] }, take: 50 })` sebelum kalkulasi similarity in-memory, mencegah pemborosan CPU pada database besar.
- **Sanitasi NIS & Unique Nulls**: Input NIS kosong (`""` atau whitespace saja) dikonversi ke `null` sebelum query/mutasi DB agar Postgres mengizinkan banyak siswa tanpa NIS tanpa melanggar `@@unique([schoolId, nis])`.

## Spec Change Log

- 2026-09-21 — **Elicitation Refinement (All-Categories Synthesis: F1–F8)**:
  - **[F1 Critical]** Menutup celah bypass `joinSchool` bagi keanggotaan `REVOKED`.
  - **[F2 Critical]** Memasang guard otorisasi anti-hostile-takeover: `MEMBER` dilarang me-revoke `OWNER`.
  - **[F3 Critical]** Memperbaiki cacat algoritma fuzzy Levenshtein: menambahkan Number-Aware Tokenizer & Veto jika nomor sekolah berbeda (menghindari False Duplicate "SMPN 1" vs "SMPN 2").
  - **[F4 Medium]** Menambahkan Candidate Pre-filtering (max 50 kandidat) untuk efisiensi CPU server saat DB berskala besar.
  - **[F5 Medium]** Memperketat penanganan NIS (`""` -> `null`, trim+uppercase, tangkap P2002) dan menegaskan klausul `select` aman di seluruh action siswa.
  - **[F6-F8 Low]** Format metadata AuditLog dan penanganan state switch school pasca-revoke.

## Review Triage Log

| ID | Severity | Finding & Action Taken | Disposition |
|----|----------|------------------------|-------------|
| F1 | CRITICAL | Celah bypass `joinSchool` mengaktifkan kembali keanggotaan REVOKED → diblokir mutlak di Always/Never & AC. | Applied |
| F2 | CRITICAL | Privilege Inversion: `MEMBER` bisa revoke `OWNER` → dipasang guard otorisasi di Always/Never & AC. | Applied |
| F3 | CRITICAL | False Duplicate pada nama panjang bernomor beda ("SMPN 1" vs "SMPN 2") → dibuat Number-Aware Tokenizer + Veto. | Applied |
| F4 | MEDIUM | Potensi CPU freeze / memory bloat pada DB skala besar → diterapkan Candidate Pre-filtering (max 50). | Applied |
| F5 | MEDIUM | Input NIS kosong `""` bentrok unique index & kebocoran `accessPinHash` → normalisasi `null` + `select` wajib. | Applied |
| F6-F8 | LOW | Metadata AuditLog dan penanganan cascading state revoke diperjelas di Code Map & Implementation Notes. | Applied |

## Design Notes

- **Algoritma Kemiripan:** Menggunakan Levenshtein distance ratio pada string ternormalisasi v2 dengan Number-Aware Veto: `if (numbersA !== numbersB) return 0; return 1 - (distance(a, b) / max(a.length, b.length))`. Ambang 85% menangkap typo kecil dan perbedaan angka pembuka ("01" vs "1") tanpa memicu false-alarm pada sekolah berbeda nomor.
- **Transparansi Mode Santai Terproteksi (CAP-3):** Kolaborasi terbuka di sekolah yang sama dengan batasan hierarki: `OWNER` terlindungi dari revoke oleh `MEMBER`, dan pengguna `REVOKED` tidak dapat mengaktifkan diri sendiri.
- **Proyeksi Kolom Eksplisit (VG-other2):** Seluruh query siswa menggunakan `select` eksplisit, menjamin `accessPinHash` tidak bocor ke klien sebelum Story 3 dimulai.

## Verification

**Commands:**
- `npm test` -- expected: seluruh unit test dedup, schools actions, dan suite lama lulus 100%.
- `npx tsc --noEmit` -- expected: exit code 0 tanpa error tipe.
- `npm run verify:migrations` -- expected: rantai migrasi tetap sinkron 100%.
- `npm run backfill:schools` -- expected: eksekusi sukses memperbarui record sekolah yang ada.
