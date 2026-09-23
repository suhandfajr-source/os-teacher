---
title: 'Story 6 — Pengerasan, Rollover TA & Dokumentasi'
type: 'feature'
created: '2026-09-23'
status: 'done'
route: 'full'
review_loop_iteration: 1
baseline_commit: '4f9f8703242db399ad46a8f9d7274f1384564d00'
context:
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/glossary.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/security-amendum.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/stories/5-panel-persetujuan-guru-superadmin.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** CAP-8 belum tertutup dan investigasi menemukan rollover tidak bisa jalan end-to-end: (1) tak ada mekanisme menutup periode lama — buat kelas TA baru menciptakan periode ACTIVE kedua → approvals hard-fail `MULTIPLE_ACTIVE_PERIODS` dan resolusi rombel portal bisa mendarat di periode lama; (2) `loginStudent` memilih enrollment `createdAt desc` tanpa prioritas periode aktif → sesi bisa membawa periode lama; (3) siswa ACTIVE ber-PIN (klaim tahun lalu) yang gabung rombel baru via kode join terblok F1 dengan pesan menyesatkan — jalur "klaim ulang; NIS & PIN tetap" mustahil. Playbook rollover (langkah N8), update MASTER_CONTEXT.md, smoke test, dan review keamanan akhir juga belum ada.

**Approach:** Tutup 3 gap dengan pengerasan minimal (saklar periode atomik, resolusi enrollment prioritas periode aktif, cabang klaim ulang ber-verifikasi PIN), buktikan dengan integration test real-db "klaim ulang dengan NIS & PIN lama teruji", tulis playbook rollover (N8), perbarui MASTER_CONTEXT.md, lalu smoke test penuh + review keamanan lintas Story 1–6 sebagai artefak dokumen. Cabang klaim ulang berlaku hanya bila periode rombel target ACTIVE (RC-3).

## Boundaries & Constraints

**Keputusan terkunci (human, 2026-09-23):**
1. **Penutupan periode = auto-close atomik** pada jalur buat-kelas periode baru (termasuk reuse periode non-aktif dan fallback default-period) — semua periode ACTIVE lain sekolah menjadi INACTIVE dalam transaksi yang sama, ter-audit via `redactMetadata()`; TANPA UI terpisah.
2. **Klaim ulang nama tidak exact → PENDING L1** (+ `accountRequestedAt`, F2) — konsisten skenario (b); verifikasi identitas oleh guru via panel persetujuan.
3. **RC-1/RC-2/RC-3 disetujui dan digabung ke blok frozen** (hasil elicitation 5 metode; lihat Spec Change Log).
4. **Approval PENDING periode lama pasca-saklar tetap sah** (konsisten G-7); re-attachment siswa hasil approve HANYA via jalur klaim ulang — tanpa logika blok baru.

**Always:**
- Invariant §9.4: maksimal SATU periode ACTIVE per sekolah — jalur yang meng-ACTIVE-kan periode wajib menonaktifkan periode ACTIVE lain dalam transaksi yang sama.
- Klaim ulang: PIN lama wajib diverifikasi `verifyPin` sebelum mutasi apa pun; PIN salah → pesan generik + `failedAttempts`/eskalasi lockout B3 (15m→1j→24j) tanpa membocorkan status akun.
- Nama exact-match kanonik (trim/collapse/case-insensitive) → ACTIVE; nama beda → PENDING L1 + `accountRequestedAt` (F2).
- Semua `AuditLog` lewat `redactMetadata()`; klaim ulang sukses/gagal ter-audit.
- Semua kegagalan cabang klaim ulang (NIS+nama tak cocok maupun PIN salah) satu bentuk pesan generik identik — hanya AuditLog yang membedakan (anti user-enumeration) (RC-2).
- Event saklar periode (mass ACTIVE→INACTIVE + pembuatan periode ACTIVE baru, termasuk remediasi data legacy) ter-audit via `redactMetadata()` (RC-2).
- Enrollment via `classStudent.upsert` pada `studentId_academicPeriodId` (pola N5), tanpa delete-insert.
- Regresi nol N9: `/q/[token]`, `/parent/*`, alur Story 3–5 tetap hijau; `tsc` bersih.
- Playbook memuat N8 eksplisit: guru isi NIS siswa belum ber-NIS **sebelum** klaim ulang L0.

**Never:**
- Tidak mengubah signature `registerStudent`/`loginStudent`/`startQuizAttemptAction` (kontrak B1/F1).
- Tidak memindahkan siswa yang SUDAH enroll periode aktif di rombel lain via kode join — tetap kuasa guru (N5); blok dengan arahan ke guru.
- Tidak auto-close periode pada jalur `academicPeriodId` eksplisit (semantik backfill historis).
- Nol migrasi schema; tidak menyentuh parent portal dan alur quiz publik.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected | Error Handling |
|----------|--------------|----------|----------------|
| Klaim ulang sukses | ACTIVE ber-PIN, enrollment hanya periode lama; kode rombel periode baru; nama exact; PIN benar | Tetap ACTIVE; `ClassStudent` periode baru (upsert); sesi baru + auto-login; AuditLog | — |
| Klaim ulang nama beda | State di atas, nama tidak exact | PENDING L1 + `accountRequestedAt`; pesan menunggu persetujuan | — |
| Klaim ulang PIN salah | State di atas, PIN salah | Pesan generik; lockout eskalasi; AuditLog; row tak berubah | Konsisten B3 |
| Enroll periode aktif rombel lain | Enrollment aktif di rombel X; kode rombel Y periode sama | Tolak + arahan pindah rombel via guru (N5) | Pesan eksplisit |
| Enroll periode aktif rombel sama | Enrollment aktif di rombel kode ini | Pesan "login langsung" (F1 existing) | — |
| REJECTED daftar ulang | accountStatus REJECTED | Jalur G-1 existing tidak berubah | — |
| Login pasca-rollover | Row periode lama + baru | Sesi pakai enrollment periode ACTIVE; fallback row terbaru | — |
| Kelas TA baru | Jalur `newAcademicYear`+`newAcademicSemester` (termasuk reuse periode non-aktif) | Periode baru ACTIVE + semua ACTIVE lain → INACTIVE, satu transaksi | Invariant tak bisa dilanggar |
| Klaim ulang ke periode INACTIVE | ACTIVE ber-PIN, belum enroll periode aktif; kode join periode INACTIVE | Tolak + arahan guru; enrollment & status tak berubah | Gate periode target ACTIVE (RC-1) |
| Klaim ulang saat LOCKED | State klaim ulang; `lockedUntil` masih aktif | Pesan generik; nol mutasi; AuditLog | Konsisten B3 (RC-1) |
| PENDING ber-PIN submit kode join periode baru | accountStatus PENDING, ber-PIN, belum enroll periode aktif | Jalur F1 existing: pesan statis "sudah terdaftar" — tanpa cabang baru (anti-enumerasi); pasca-approve masuk jalur klaim ulang | Keputusan terkunci #4 (RC-1) |
| Login pasca-impor (jalur mayoritas) | ACTIVE ber-PIN; enrollment periode baru terlampir via reuse-NIS impor; submit kode join | Pesan "login langsung" + PIN lama tetap berlaku; login → sesi periode baru | E2E wajib (RC-1) |
| Approve pending periode lama pasca-saklar | PENDING periode INACTIVE di-approve guru | Approve sah (G-7); siswa ACTIVE ber-PIN belum enroll periode aktif → jalur klaim ulang menempel ke rombel baru | Test komposisi (keputusan #4) |

</frozen-after-approval>

## Code Map

- `src/modules/classes/classes.actions.ts` (~123–176) -- resolusi/pembuatan AcademicPeriod di create-class; titik saklar: sebelum set periode ACTIVE, `updateMany` ACTIVE→INACTIVE sekolah sama dalam `tx` sama; jalur reuse periode non-aktif ikut aturan sama. CATATAN elicitation: ada jalur KETIGA pen-set ACTIVE — fallback pembuatan default period (hardcoded `2024/2025`) saat sekolah tanpa periode aktif; wajib ikut saklar + audit, bukan pengecualian.
- `src/modules/student-auth/student-auth.actions.ts` -- `loginStudent` (~553): ganti pemilihan membership → prioritas periode ACTIVE, fallback terbaru (pola `getStudentEnrollment` approvals). `registerStudent` blok F1 (~156): pecah — siswa ber-PIN non-REJECTED yang belum enroll periode aktif diarahkan ke cabang klaim ulang; urutan cabang: G-1 → EC-11 → **klaim ulang [BARU]** → F1 → (a)(b)(c). CATATAN elicitation: cabang klaim ulang hanya berlaku bila periode rombel target ACTIVE (kode join periode INACTIVE → tolak + arahan guru); auto-login sukses wajib regenerasi sesi + invalidasi sesi lama.
- `src/modules/approvals/approvals.actions.ts` (~80–110) -- `getActivePeriod` (hard-fail) + `getStudentEnrollment` = pola referensi; jangan diubah.
- `src/modules/imports/import.service.ts` (~249–320) -- reuse deterministik by-NIS + ClassStudent check: jalur rollover sisi guru; jangan diubah, cukup tercakup test.
- `src/modules/student-portal/student-portal.actions.ts` (~86–89) -- resolusi membership ACTIVE + fallback; tidak diubah (akar ditangani saklar periode); tercatat sebagai dependensi invariant. CATATAN elicitation: fallback `classMemberships[0]` tanpa orderBy eksplisit → urutan arbitrer untuk siswa yang belum enroll periode baru; beri `orderBy: { createdAt: "desc" }` (non-kontraktual) sebagai pengaman murah.
- `src/modules/student-auth/__tests__/story-3-full-audit.int.test.ts` -- pola suite real-db yang ditiru.
- `MASTER_CONTEXT.md` -- update bag. 13 (dev map + Dev Stage 11) & 14 (baseline sesi siswa/NIS+PIN/superadmin allowlist) + pointer playbook.
- `docs/PLAYBOOK-ROLLOVER-TA.md` (BARU) -- playbook operator: prasyarat, N8, saklar periode, impor roster, distribusi kode join, matriks edge case, checklist verifikasi, rollback, jendela rollover + drain check kuis in-flight, langkah verifikasi antara saklar & impor (recovery state parsial), validasi NIS unik impor, daftar pengecualian jalur pen-set ACTIVE.

## Tasks & Acceptance

**Execution:**
- [x] `src/modules/classes/classes.actions.ts` -- saklar periode atomik jalur periode baru/reuse-nonaktif -- tutup akar `MULTIPLE_ACTIVE_PERIODS` & portal salah periode.
- [x] `src/modules/student-auth/student-auth.actions.ts` -- `loginStudent` resolusi enrollment prioritas periode ACTIVE -- sesi tak bawa periode lama.
- [x] `src/modules/student-auth/student-auth.actions.ts` -- cabang klaim ulang `registerStudent` (PIN wajib; gate `accountStatus === "ACTIVE"` + periode target ACTIVE; exact→ACTIVE / beda→PENDING; audit; lockout) -- wujud "klaim ulang; NIS & PIN tetap" CAP-8.
- [x] `src/modules/student-auth/__tests__/story-6-rollover.int.test.ts` (BARU) -- suite real-db matriks I/O + klaim ulang via impor roster end-to-end -- bukti CAP-8 "teruji". 16 test (A1–A5, B1–B11).
- [x] `docs/PLAYBOOK-ROLLOVER-TA.md` -- playbook lengkap dengan N8 -- DoD "playbook tertulis".
- [x] `MASTER_CONTEXT.md` -- refleksikan Stage 11 + baseline auth siswa -- orientasi agen tetap akurat.
- [x] `_bmad-output/implementation-artifacts/final-security-review-story-6.md` (BARU) -- review keamanan lintas CAP-1..8, B1–B5, N1–N9 dengan bukti test -- DoD "review keamanan lolos".
- [x] `src/modules/classes/classes.actions.ts` -- audit `AuditLog` event saklar (mass ACTIVE→INACTIVE + pembuatan periode ACTIVE baru + aktor) via `redactMetadata()` -- jejak remediasi legacy `MULTIPLE_ACTIVE_PERIODS` (RC-2 tergabung frozen).
- [x] `src/modules/classes/classes.actions.ts` -- saklar + audit mencakup SEMUA jalur pen-set ACTIVE: periode baru, reuse non-aktif, dan fallback default-period -- bukti cakupan: grep dilampirkan di final-security-review-story-6.md §3.
- [x] `src/modules/student-auth/student-auth.actions.ts` -- cabang klaim ulang gate periode target ACTIVE (kode join periode INACTIVE → tolak + arahan guru) + semua kegagalan cabang satu bentuk pesan generik (anti user-enumeration) -- baris matriks RC-1/RC-2 tergabung frozen.
- [x] `src/modules/student-auth/student-auth.actions.ts` -- auto-login klaim ulang: regenerasi sesi + invalidasi sesi lama. KOREKSI pasca-review (EC-9/BH-2): `student-portal.actions.ts` tidak perlu diubah -- `orderBy: { createdAt: "desc" }` pada kedua query classMemberships ternyata sudah ada di baseline `4f9f870`; temuan elicitation A5 sudah terpenuhi sejak awal.
- [x] UI form pendaftaran -- tanpa perubahan: cabang klaim ulang memakai bentuk hasil existing (`ACTIVE`+redirect / `PENDING`+notice / `false`+message) yang sudah ditangani `src/app/portal-siswa/page.tsx` — tidak ada diskriminan baru; diverifikasi baris 247–275.
- [x] `src/modules/student-auth/__tests__/story-6-rollover.int.test.ts` -- test komposisi: approve pending periode lama pasca-saklar tetap sah (G-7) → siswa ACTIVE ber-PIN re-attach via klaim ulang ke rombel baru -- keputusan terkunci #4, tanpa logika blok baru (test B5).
- [x] `docs/PLAYBOOK-ROLLOVER-TA.md` -- tambahan elicitation: jendela rollover + drain check kuis in-flight sebelum saklar; langkah verifikasi antara saklar & impor (recovery state parsial); validasi NIS unik + review daftar reuse saat impor; daftar pengecualian jalur pen-set ACTIVE (§0–§6, §10).
- [x] `src/modules/student-auth/__tests__/story-6-rollover.int.test.ts` -- test tambahan elicitation: idempotensi saklar (A2), race upsert klaim ulang simultan (B10), E2E login pasca-impor (B9), asersi visibilitas historis `/parent/*` pasca-saklar (B11).

**Acceptance Criteria:**
- Given sekolah periode lama ACTIVE dan siswa ACTIVE ber-PIN dari TA lalu, when guru buat rombel TA baru lalu siswa submit kode join + NIS + nama exact + PIN lama, then siswa ACTIVE di rombel baru dengan sesi periode baru, identitas & PIN utuh, ter-audit; approvals tanpa `MULTIPLE_ACTIVE_PERIODS`.
- Given siswa yang sama salah PIN 5x, when coba lagi, then terkunci 15 menit, enrollment tak berubah.
- Given siswa imporan tanpa PIN (belum klaim), when daftar via kode join nama exact, then jalur L0 existing tetap auto-ACTIVE (regresi terlindungi test).
- Given suite penuh Story 1–5, when `verify:migrations` + `tsc` + `vitest` dijalankan, then 100% hijau; playbook & review keamanan tertulis sebagai artefak.
- Given ACTIVE ber-PIN menerima kode join rombel periode INACTIVE, when submit klaim ulang, then ditolak dengan arahan ke guru; enrollment & status tak berubah.
- Given guru impor roster berisi siswa ACTIVE ber-PIN periode lama, when siswa login dengan NIS + PIN lama, then sesi periode baru tanpa perlu klaim ulang — jalur mayoritas rollover teruji.
- Given saklar periode dijalankan (termasuk remediasi legacy), when AuditLog diperiksa, then event tercatat dengan aktor & bebas metadata sensitif.

## Implementation Notes

- **Review pass 1 (step-04, 3 layer eksternal) -- 28 temuan: 11 grup patch di-apply, 3 defer, sisanya false/reject.** Patch keamanan-material: gate klaim deterministik multi-periode (BH-5/EC-3), guard stale-hash vs reset PIN guru (EC-5), create+P2002 pengganti upsert untuk mencegah bypass N5 (EC-4), gate `status === "ACTIVE"` untuk siswa archived (EC-6), collapse kanonik nama (BH-4/EC-8), pesan khusus gate periode INACTIVE (EC-10), `FOR UPDATE` row school (BH-7/EC-2), remediasi legacy reuse-ACTIVE (EC-1), await assertion floating (EC-7), assert payload sesi (VG-1), test fallback helper (VG-2), test remediasi A6. Detail: final-security-review-story-6.md paragraf 8b.
- **Koreksi klaim dokumen (EC-9/BH-2/BH-3):** portal orderBy ternyata pre-existing di baseline; jumlah test final 744/744 dengan 18 test rollover (bukan 740/14); diff yang diterima reviewer pertama adalah varian parsial (BH-1) -- diff final memuat playbook + test.
- **Ekstraksi `resolveStudentSessionMembership()`** ke `student-session.ts` (bukan file actions — `"use server"` membuat export jadi server action): loginStudent jadi konsumen tipis; helper dites langsung (B8/B9) tanpa mengubah signature action.
- **UI tanpa perubahan:** bentuk hasil klaim ulang reuse union existing (`ACTIVE`/`PENDING`/`false`) — task "UI form" dipenuhi lewat verifikasi, bukan diff.
- **Akurasi lint:** 36 pelanggaran pasca-perubahan = identik baseline (diverifikasi `git stash`→lint→`git stash pop`); dua pelanggaran yang sempat tertambah (prefer-const, `as any` baru) sudah diperbaiki — nol utang baru.
- **`verify:migrations` Windows:** start engine prisma-dev butuh >10s pada run pertama (timeout script) — run kedua setelah `npx prisma dev start default` sukses exit 0. Isu lingkungan, bukan drift.
- **Simulasi jalur impor:** B9/B11 membuat row `ClassStudent` end-state yang sama dengan commit `import.service` (reuse by-NIS) — kontrak reuse itu sendiri sudah terlindungi `import.*.test.ts` (tidak diubah).
- **Cleanup test:** entitas parent memakai `onDelete: Restrict` terhadap student — afterAll menghapus rantai parent sebelum delete school.
- **Lingkungan lokal (Windows):** `npm run build`/`npx playwright test` tetap terblokir isu pra-existing Turbopack CSS worker (dibuktikan Story 5 juga gagal di baseline bersih); regresi dikcover vitest penuh 742/742 + tsc + verify:migrations.

## Spec Change Log

- 2026-09-23 — Elicitation pass 5 metode (BMad Advanced Elicitation): tambah task/AC/Design Notes non-frozen; usulan perubahan frozen dicatat di Renegotiation Candidates. Tanpa perubahan frozen.
- 2026-09-23 — **Human menyetujui semua RC + keputusan lintas-rollover**: RC-1 (4 baris matriks), RC-2 (2 poin Always), RC-3 (gate periode target ACTIVE) digabung ke blok frozen; keputusan approval PENDING periode lama = tetap sah, re-attachment via klaim ulang. Bagian Renegotiation Candidates dihapus karena tergabung. Known-bad yang dihindari: klaim ulang mendarat di periode INACTIVE; enumerasi status via pesan berbeda; saklar tanpa jejak audit; blok baru yang kontradiktif dengan G-7.
- 2026-09-23 — **Review pass 1 (review-driven amendemen mekanisme)**: Always "Enrollment via `classStudent.upsert`" dijalankan sebagai `create` + tangkap P2002 → gagal generik. Trigger: EC-4 — cabang `update` upsert dapat memindahkan siswa yang kalah race ke rombel kode join secara diam-diam (bypass kuasa pindah rombel guru, N5). Known-bad yang dihindari: mutasi enrollment lintas rombel tanpa kuasa guru. Intent Always tetap utuh: tanpa delete-insert, `@@unique([studentId, academicPeriodId])` terhormat, tidak ada duplikat. KEEP: gate klaim deterministik, guard stale-hash, pesan statis anti-enumerasi, saklar + audit, dan seluruh test A1–A6/B1–B12 harus survive re-derivation.

## Review Triage Log

**Elicitation pass 2026-09-23 — Advanced Elicitation BMad (5 metode: Pre-mortem, Security Audit Personas, Boundary & Edge Case Sweep, Assumption Audit, Second-Order Thinking). Klaim teknis diverifikasi read-only ke kode sumber. Semua temuan diterima; blok frozen tidak diedit (usulan → Renegotiation Candidates).**

| # | Temuan | Metode asal | Tindakan |
|---|--------|-------------|----------|
| 1 | Cabang klaim ulang bisa mendarat di periode INACTIVE bila kode join rombel lama tersebar | Boundary Sweep | Gate periode target ACTIVE — task + RC-1 |
| 2 | Tidak ada task UI untuk diskriminan respon klaim ulang baru | Assumption Audit | Task UI baru |
| 3 | Saklar periode tidak wajib ter-audit | Security Personas | Task audit + RC-2 |
| 4 | Jalur ketiga pen-set ACTIVE (fallback default-period hardcoded) di luar cakupan saklar | Assumption Audit | Task cakupan + grep bukti |
| 5 | Baris matriks hilang: LOCKED, PENDING ber-PIN (semantik EC-11), approval lintas rollover, jalur mayoritas impor→login | Boundary Sweep + Second-Order | RC-1 + task keputusan approval |
| 6 | Playbook belum memuat jendela rollover, drain check, recovery parsial, validasi NIS impor | Pre-mortem | Task playbook tambahan |
| 7 | Kegagalan klaim ulang belum dijamin satu bentuk pesan (anti-enumerasi) | Security Personas | Task + RC-2 |
| 8 | Fallback portal `classMemberships[0]` urutan arbitrer | Assumption Audit | orderBy + Design Notes |
| 9 | Sesi lama tidak di-invalidasi saat auto-login klaim ulang | Security Personas | Task + Design Notes |
| 10 | Idempotensi saklar, race upsert, visibilitas parent pasca-saklar belum teruji | Pre-mortem + Second-Order | Task test tambahan |
| 11 | DoS lockout belum dinyatakan sebagai trade-off sadar | Security Personas | Design Notes |

**Review pass 1 (step-04) -- 3 layer eksternal (blind-hunter 14, edge-case-hunter 11, verification-gap 2+1). Semua temuan diverifikasi baris-per-baris ke kode sebelum verdict. Hasil: 11 grup patch (di-apply), 3 defer, sisanya false/reject.**

| # | Layer | Temuan | Verdict | Route | Evidence |
|---|---|---|---|---|---|
| 1 | BH-1 | Playbook + test "hilang dari diff" | false | -- | Diff final (192KB) memuat keduanya (14 referensi); reviewer menerima varian parsial 111KB (artefak file temp orkestrator) |
| 2 | BH-2 + EC-9 | Portal orderBy diklaim diubah; ternyata pre-existing di baseline (baris 77 & 264) | medium (klaim dokumen) | patch | `git show 4f9f870` memverifikasi; koreksi task + Implementation Notes + security review -- kode memang tak perlu diubah |
| 3 | BH-3 + EC-11 | Jumlah test kontradiktif (740 vs 742; 14 vs 16) | low | patch | True saat ditulis; final 744/744 & 18 test -- security review dikoreksi |
| 4 | BH-4 + EC-8 | Kanonik nama tanpa collapse whitespace internal | high (klaim frozen) | patch | frozen Always "trim/collapse/case-insensitive"; kode lama hanya trim -- `canonicalStudentName()` ditambahkan; test B1 pakai input double-space |
| 5 | BH-5 + EC-3 | `teachingContexts take:1` tanpa orderBy -> gate & periode target arbitrer di class multi-periode | high | patch | Class entity di-reuse lintas periode (createClass reuse path); resolusi `find(ACTIVE) ?? [0]` + semua cabang pakai periode target sama |
| 6 | BH-6 | JSDoc helper menimpa doc `clearStudentSessionCookie` | low | patch | Posisi disusun ulang -- helper kini setelah fungsi logout |
| 7 | BH-7 + EC-2 | Dua createClassAction konkuren -> dua ACTIVE (tanpa enforcement DB) | medium | patch | Race nyata READ COMMITTED; `SELECT ... FOR UPDATE` row school di awal tx |
| 8 | BH-8 | Hardcode 2024/2025 "dicuci" ke audit | false | -- | Metadata audit MENULIS nilai aktual row yang dibuat (konstanta itu sendiri); hardcode pre-existing baseline, dipertahankan sadar |
| 9 | BH-9 | Lockout ladder diduplikasi + increment non-kondisional | low | defer | Pola pre-existing `loginStudent` (baseline); ekstraksi = refactor lintas modul; komentar mem-pin "identik B3/F6" |
| 10 | BH-10 + EC-5 | Re-hash PIN + race reset PIN guru menimpa hash baru | medium | patch | EC-5 terverifikasi: verifyPin -> reset guru -> commit menimpa hash; guard `accessPinHash` di where updateMany; re-hash = refresh salt nilai sama (komentar ditambah) |
| 11 | BH-11 | Komentar urutan cabang kontradiktif layout | low | patch | Komentar ditulis ulang sesuai layout aktual (KLAIM-GATE -> KLAIM -> F1 -> G-1 -> EC-11 -> abc) |
| 12 | BH-12 | Elicitation summary masih bilang RC pending | low | patch | Appendix status RESOLVED ditambahkan ke file elicitation (artefak historis, bukan frozen) |
| 13 | BH-13 | Security review self-attested | low | patch | Header + paragraf 8b kini merujuk 3 layer review independen + temuan yang memperbaiki kode |
| 14 | BH-14 | Status spec kontradiktif | false | -- | `in-review` = state workflow yang benar saat review; iterasi tercatat |
| 15 | BH-15 | Fallback sesi masih bisa periode INACTIVE di jendela transisi | false | -- | Frozen matrix baris 7 ("fallback row terbaru") + playbook paragraf 5 mendokumentasikan jendela ini eksplisit |
| 16 | VG-1 | Payload sesi `loginStudent` tak pernah diobservasi test | medium (pre-verified) | patch | Assert `toHaveBeenCalledWith(objectContaining({classId, academicPeriodId}))` ditambah ke unit test existing |
| 17 | VG-2 | Fallback helper (tanpa enrollment ACTIVE) tak tertutup test | medium (pre-verified) | patch | Test B12: siswa hanya-enrollment-lama -> helper kembalikan row tsb |
| 18 | VG-Other | Suite real-db lulus vakum tanpa DB; klaim branch tanpa coverage unit | low | defer | Konvensi 9 suite (preseden defer VG-Other-2 Story 5); loud-failure harness = hygiene lintas file |
| 19 | EC-1 | Reuse periode sudah-ACTIVE melewatkan remediasi legacy | medium | patch | Saklar selalu jalan di jalur tahun-ajaran baru; source `reuse_active_remediation`; test A6 |
| 20 | EC-4 | Enrollment lahir di antara count dan upsert -> `update` memindahkan siswa (bypass N5) | medium | patch | `create` + P2002 -> generic fail; Change Log mencatat amendemen mekanisme; B10 tetap hijau |
| 21 | EC-5 | (digrup dengan #10) | -- | -- | -- |
| 22 | EC-6 | Siswa archived (status != ACTIVE) bisa ter-klaim | medium | patch | `Student.status EntityStatus` ada, `verifyStudentSession` mengeceknya; gate + where update ditambah |
| 23 | EC-7 | `expect(verifyPin(...)).resolves` tanpa await -- floating assertion | medium | patch | `await expect(...)` -- bukti CAP-8 jadi sound |
| 24 | EC-10 | Pesan gate periode INACTIVE = "login langsung" (kontradiksi playbook) | medium | patch | Pesan khusus "Minta kode join rombel yang baru"; test B4 diupdate |
| 25 | EC-2 | (digrup dengan #7) | -- | -- | -- |
| 26 | EC-3 | (digrup dengan #5) | -- | -- | -- |
| 27 | EC-8 | (digrup dengan #4) | -- | -- | -- |
| 28 | EC-11 | (digrup dengan #3) | -- | -- | -- |

## Design Notes

- **PIN sebagai bukti kepemilikan klaim ulang:** akun ber-PIN tanpa bukti tidak boleh dimutasi (preseden EC-11 dan G-1) — PIN lama adalah bukti tersebut.
- **Auto-close di jalur periode baru, bukan UI terpisah:** guru yang buat rombel TA/semester baru eksplisit menyatakan pergantian periode; invariant satu-ACTIVE tak mungkin dilanggar dari UI manapun; jalur `academicPeriodId` eksplisit dipertahankan untuk backfill.
- **Klaim ulang hanya untuk yang belum enroll periode aktif:** yang sudah enroll (rombel sama/lain) tetap pakai pesan F1/arah guru — mencegah bypass kuasa pindah rombel (N5).
- **DoS lockout adalah trade-off yang disadari (elicitation):** NIS + nama bersifat semi-publik; penyerang dapat mengunci akun korban lewat PIN salah berulang (B3). Diterima karena lockout adalah kontrol yang sama yang melindungi take-over; mitigasi operator: reset PIN oleh guru (jalur existing).
- **Fallback portal dibuat deterministik (elicitation):** tanpa membership periode aktif, `classMemberships[0]` urutannya arbitrer; saklar menutup akar utama, `orderBy createdAt desc` adalah pengaman murah untuk siswa yang belum enroll periode baru.
- **Sesi lama saat klaim ulang sukses (elicitation):** token sesi diregenerasi dan sesi perangkat lain di-invalidasi — tidak ada sesi ganda lintas periode.

## Verification

**Commands:**
- `npm run verify:migrations` -- exit 0 (chain tak berubah).
- `npx tsc --noEmit` -- 0 error.
- `npx vitest run` -- semua hijau termasuk `story-6-rollover.int.test.ts`.

**Manual checks:**
- `AuditLog` klaim ulang: metadata bebas PIN/hash.
- Playbook: tiap langkah punya aktor, prasyarat, bukti verifikasi; N8 sebelum langkah klaim ulang.
