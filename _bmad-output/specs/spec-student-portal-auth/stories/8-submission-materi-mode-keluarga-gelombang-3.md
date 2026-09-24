---
title: 'Story 8 — Submission, Materi & Mode Keluarga (Gelombang 3)'
type: 'feature'
created: '2026-09-23'
status: 'in-review'
route: 'full'
review_loop_iteration: 0
baseline_commit: 'd39e3ff067dfb6ae06c7383914e75bd0dca1d261'
context:
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/SPEC.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/execution-stages.md'
  - '{project-root}/_bmad-output/specs/spec-student-portal-auth/portal-modules.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** CAP-10 belum terwujud — siswa belum bisa mengumpulkan tugas (teks/tautan) ke antrean koreksi guru dengan umpan balik, belum bisa membaca materi yang dipublish guru dari draf AI, dan orang tua belum punya tab pantauan read-only (Mode Keluarga) di portal siswa.

**Approach:** Tambah model `AssignmentSubmission` (teks/tautan, 1 per siswa per tugas) + action submit siswa & antrean koreksi guru (feedback wajib, skor opsional); flag publish (`publishedAt`) pada `AiContentDraft` untuk tampilan baca "Materi"; halaman Mode Keluarga read-only yang mereuse layanan baca progress Story 7. Unggah berkas out of scope.

## Boundaries & Constraints

**Always:**
- Submission teks/tautan saja — unggah berkas dilarang; minimal salah satu dari `textContent`/`linkUrl` terisi, link wajib URL valid.
- `studentId` selalu di-derive dari `verifyStudentSession()`; semua query portal di-scope ke periode aktif rombel (pola resolusi membership Story 4/7).
- Guru memberi umpan balik: feedback wajib, skor opsional (0–100); setelah REVIEWED, siswa tidak bisa resubmit.
- Materi siswa = `AiContentDraft` `contentType LEARNING_MATERIAL`, `status ACTIVE`, `publishedAt != null`, dan `teachingContextId` cocok rombel siswa periode aktif — tampil read-only.
- Mode Keluarga: reuse layanan baca (`getStudentProgressDataAction` + status submission) — TANPA jalur tulis apa pun dari portal siswa.
- Resubmit diizinkan hanya selama status SUBMITTED (belum direview); submit lewat `dueDate` diizinkan dan ditandai "terlambat" (computed, tanpa kolom skema).
- N9 regresi nol: `/q/[token]` & `/parent/*` tetap hijau.

**Never:**
- Tanpa unggah berkas/file upload, tanpa notifikasi push baru.
- Tanpa mengubah tampilan/flow `/parent/*` existing (dipertahankan paralel; sunset pasca-Tahap 8).
- Draf AI non-LEARNING_MATERIAL (LESSON_PLAN/TASK_INSTRUCTION/RUBRIC) tidak tampil di portal meski dipublish; draf ARCHIVED tidak tampil.
- Tanpa penilaian otomatis/skor wajib; tanpa edit tugas dari sisi siswa.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH submit | Siswa sesi valid, tugas ACTIVE rombelnya, teks/tautan terisi | Submission `SUBMITTED` tersimpan (upsert saat SUBMITTED), muncul di antrean guru | — |
| Submit kosong | `textContent` & `linkUrl` kosong/space | Ditolak | Error validasi generik |
| Link invalid | Bukan URL http(s) | Ditolak | Error validasi generik |
| Resubmit setelah REVIEWED | Status submission REVIEWED | Ditolak — terkunci, feedback tampil | Pesan terkunci |
| Submit terlambat | `submittedAt > dueDate` | Tersimpan, badge "terlambat" | — |
| Tugas ARCHIVED | Assignment non-ACTIVE | Tak tampil & submit ditolak | Pesan tugas tidak tersedia |
| Feedback guru | Submission SUBMITTED, feedback terisi, skor opsional | Status REVIEWED, `reviewedAt`/`reviewedBy` terisi, siswa lihat umpan balik | — |
| Materi tanpa publish / non-LEARNING_MATERIAL / ARCHIVED / konteks lain | Kombinasi filter gagal | Tak tampil di Materi | — |
| Mode Keluarga | Sesi siswa, ada data progress | Ringkasan nilai+presensi+status tugas read-only | Tanpa error; empty state aman tanpa periode aktif |

</frozen-after-approval>

## Code Map

- `prisma/schema.prisma` — `Assignment` (teachingContextId, title, description, dueDate, status ACTIVE/ARCHIVED) baris 512; `AiContentDraft` (contentType, status, teachingContextId nullable) baris 678; tempat model `AssignmentSubmission` + enum baru + `publishedAt` menempel. Relasi balik `submissions Assignment[]`/`Submission[] Student[]`.
- `src/modules/student-auth/student-session.ts` — `verifyStudentSession()` satu-satunya sumber identitas siswa.
- `src/modules/student-portal/student-portal.actions.ts` — pola resolusi membership periode aktif (`getStudentDashboardDataAction`) — REUSE untuk query tugas/materi; jangan ubah action Story 4.
- `src/modules/student-portal/student-progress.actions.ts` — `getStudentProgressDataAction()` — sumber data Mode Keluarga (nilai+presensi), read-only.
- `src/app/siswa/portal/tugas/page.tsx` — daftar tugas read-only existing → upgrade: tombol submit + status/feedback siswa.
- `src/app/siswa/portal/profil/page.tsx` + `src/components/student/StudentBottomNav.tsx` — titik masuk Mode Keluarga (kartu/link di Profil; nav tetap 6 item sesuai keputusan terkunci Story 7).
- `src/modules/assignments/assignment.actions.ts` — `createAssignment` existing; tambah action sisi guru: antrean koreksi + `reviewSubmission`.
- `src/app/(dashboard)/kelas/[teachingContextId]/tugas/` — `page.tsx` + `TugasClient.tsx` guru; tambah tautan detail per tugas → halaman koreksi baru `[assignmentId]/page.tsx`.
- `src/modules/ai/ai.actions.ts` — `saveAiDraftAction`/`archiveAiDraftAction` pola aksi draf; tambah `publishAiDraftAction`/`unpublish` + tampilan status publish di `(dashboard)/ai-studio/`.
- `src/modules/student-portal/__tests__/story-7-progress.int.test.ts` — pola suite real-db (fixture sekolah+rombel+siswa) untuk suite rantai Story 8.
- `prisma/migrations/` — konvensi penamaan folder timestamp (contoh `20260923000000_story5_...`).

## Tasks & Acceptance

**Execution:**
- [x] `prisma/schema.prisma` + migrasi BARU — model `AssignmentSubmission` (assignmentId, studentId, textContent?, linkUrl?, status SUBMITTED/REVIEWED, feedback?, score?, submittedAt, reviewedAt?, reviewedByProfileId?, @@unique([assignmentId, studentId])), enum `AssignmentSubmissionStatus`, kolom `AiContentDraft.publishedAt DateTime?` (nullable — patuh N1); relasi balik di Assignment/Student/TeacherProfile.
- [x] `src/modules/assignments/submission.service.ts` (BARU) — validasi murni (min 1 isi, URL http(s), skor 0–100) + query antrean guru & status siswa; unit-testable tanpa DB.
- [x] `src/modules/student-portal/student-submission.actions.ts` (BARU) — `submitAssignmentAction` (sesi → scope rombel/periode aktif → tugas ACTIVE → upsert selama belum REVIEWED → badge terlambat) + `getStudentSubmissionStatusAction`.
- [x] `src/modules/assignments/assignment.actions.ts` — tambah `getSubmissionQueueAction(teachingContextId, assignmentId)` (otorisasi guru konteks) + `reviewSubmissionAction` (feedback wajib, skor opsional → REVIEWED).
- [x] `src/app/siswa/portal/tugas/page.tsx` + komponen client submit BARU — daftar tugas + form submit (teks/tautan) + status & feedback guru; terkunci setelah REVIEWED.
- [x] `src/app/(dashboard)/kelas/[teachingContextId]/tugas/[assignmentId]/page.tsx` (BARU) — antrean koreksi guru: daftar submission (terlambat ditandai) + form umpan balik.
- [x] `src/modules/ai/ai.actions.ts` + `(dashboard)/ai-studio/` — `publishAiDraftAction`/`unpublishAiDraftAction` (guru pemilik draf) + indikator publish di UI draf.
- [x] `src/app/siswa/portal/materi/page.tsx` (BARU) + aksi baca — daftar LEARNING_MATERIAL published scoped rombel periode aktif; baca full konten read-only.
- [x] `src/app/siswa/portal/keluarga/page.tsx` (BARU) + kartu masuk di `profil/page.tsx` — Mode Keluarga: reuse `getStudentProgressDataAction` + status tugas/submission, read-only.
- [x] `src/modules/student-portal/__tests__/submission.service.test.ts` (BARU) — unit test matriks validasi.
- [x] `src/modules/student-portal/__tests__/story-8-submission-materi.int.test.ts` (BARU) — real-db rantai DoD: guru buat tugas → siswa submit → guru review → siswa lihat feedback; materi published terlihat & non-publish/LEARNING_MATERIAL-lain tak bocor; resubmit terkunci; submit tugas rombel lain ditolak.

**Acceptance Criteria:**
- Given tugas ACTIVE di rombel siswa, when siswa submit teks/tautan, then submission SUBMITTED muncul di antrean guru untuk rombel itu.
- Given submission SUBMITTED, when guru mengirim feedback (skor opsional), then status REVIEWED dan siswa melihat umpan balik; resubmit ditolak.
- Given draf LEARNING_MATERIAL milik teachingContext rombel, when guru publish, then siswa melihat materi; draf tanpa publish/non-LEARNING_MATERIAL/ARCHIVED tidak pernah tampil.
- Given halaman Mode Keluarga, then semua data berasal dari layanan baca existing — tidak ada action tulis baru dari sesi siswa.
- `tsc` bersih; seluruh test hijau; `/q/[token]` & `/parent/*` tetap hijau (N9).

## Implementation Notes

## Spec Change Log

- 2026-09-24: Ditemukan & dibuang drift skema dari draft sebelumnya — `teachingContextId` di `AssignmentSubmission` + relasi balik `reviewedSubmissions` di `TeachingContext` tidak diminta spec, tidak ada di migration.sql, dan tidak dipakai kode mana pun (scope konteks selalu di-derive via `assignment.teachingContextId`). Skema & migrasi kini 1:1.
- 2026-09-24: Int test `story-8` mock `next/cache.revalidatePath` (invariant di luar runtime Next — pola sama dengan action test lain) dan `@/lib/authorization` (auth gate di-stub; logika bisnis + DB nyata, pola story-5).
- 2026-09-24 (loop-2): Ekstrak query materi ke `src/modules/student-portal/student-materi.actions.ts` (`getPublishedMaterialsAction`) — halaman `/siswa/portal/materi` dan int test kini memakai action yang sama (melunasi temuan verification-gap: query halaman sebelumnya diverifikasi via salinan di test).

## Review Triage Log

Review loop 1 (blind-hunter, 15 temuan; edge-case & verification-gap gagal 2× karena 502 provider — triage dilanjutkan dengan verifikasi manual):

- TOCTOU `submitAssignmentAction` (findUnique → upsert tanpa guard status) — **high** (medium): race nyata — review guru di antara cek & upsert mengembalikan status SUBMITTED dengan feedback tersisa; siswa regains edit pada jawaban terkunci. → patch: `updateMany` kondisional `status: "SUBMITTED"` + create fallback.
- `getSubmissionQueueAction` dead-code produksi (halaman antrean query inline duplikat) — **medium** (developer): dua sumber kebenaran ordering/mapping antrean. → patch: halaman antrean memanggil action.
- `getStudentSubmissionStatusAction` tanpa konsumen UI — **low, reject**: spec secara eksplisit meminta action ini (deliverable); konsumsi UI Mode Keluarga memakai query server langsung demi hindari N+1; fix (panggil per-tugas) menambah round-trip, bukan koreksi langsung.
- Tidak ada jalur guru revisi feedback REVIEWED (UI disable permanen, action tanpa guard — kontradiksi) — **medium**: guru salah ketik tak bisa koreksi. Spec tak melarang re-review. → patch: form tetap editable setelah REVIEWED ("Perbarui").
- `reviewSubmissionAction` tak revalidate `/kelas/{id}/tugas` → badge pending basi — **low** (trivial) → patch: tambah revalidatePath.
- `SubmitAssignmentForm` override `isLate` pakai jam browser, toast pakai server — **low** (trivial) → patch: percayai `res.submission.isLate`.
- `linkUrl` tanpa batas panjang — **medium** (input hygiene) → patch: cap 2.048 + unit test.
- Duplikasi resolusi membership aktif 3× (submission/keluarga/materi) — **defer**: pola pre-existing (story 4/7 sama); ekstraksi helper lintas modul di luar scope story ini.
- Keluarga `take: 10` senyap memotong daftar tugas — **low** (trivial) → patch: hapus take.
- Test tak mencakup materi lintas-rombel (published di kelas lain tak terlihat) — **medium** (test gap vs boundary spec) → patch: tambah fixture + assertion di int test.
- `orderBy status "desc"` mengandalkan urutan leksikografis enum — **low** → patch: komentar pin asumsi di action (satu-satunya sumber setelah #2 dipatch).
- Client form `try/finally` tanpa `catch` → network throw tanpa feedback — **low** (trivial) → patch: catch + toast di 2 form.
- `submission.service.test.ts` "salah lokasi" — **false**: spec mem mandate path `student-portal/__tests__/submission.service.test.ts` verbatim.
- Artefak `docs/PANDUAN-*` ikut diff — **false**: file untracked milik user, tidak di-stage untuk commit story 8 (hanya ikut file diff review karena generator diff memuat semua untracked).
- Migrasi tanpa indeks query materi — **false**: `@@index([contentType])` + `@@index([teachingContextId])` sudah ada di `AiContentDraft`; query selektif.

Review loop 2 (edge-case-hunter 1 temuan + verification-gap 5 temuan — kedua lens yang gagal 502 di loop-1; artefak `review-8-edge-case-hunter-findings.json` + `review-8-verification-gap-findings.md`):

- `getSubmissionQueueAction` melempar Error mentah (assignment hilang / cross-context) — **accept (known-risk)**: halaman antrean pre-check `findFirst` berkonteks, jadi lemparan hanya terjangkau via race hapus-tugas antar-query atau panggilan langsung; konsisten dengan pola dashboard existing (`verify*` melempar). Tanpa patch.
- Query halaman Materi diverifikasi via salinan di int test (broken-verification) — **patch**: ekstrak `getPublishedMaterialsAction`; int test beralih ke action (+ tolak tanpa sesi); duplikasi where hilang.
- Re-review REVIEWED tak dipin test (regresi patch loop-1 diam-diam) — **patch**: int test review kedua — feedback/skor baru tersimpan, skor opsional bisa dikosongkan.
- Guard race TOCTOU `updateMany` tak terverifikasi — **patch**: injeksi Proxy level modul atas `@/lib/auth` (delegate model Prisma 7 dibuat segar per akses — `vi.spyOn` tak menjangkau, dibuktikan test gagal loud); mutation check: hapus `status: "SUBMITTED"` dari where → test merah. Non-vacuous.
- Dua cabang tolak publish (ARCHIVED; tanpa `teachingContextId`) tanpa test — **patch**: fixture + assertion di int test materi.
- Badge `pendingSubmissions` (`_count` where SUBMITTED) tanpa verifikasi — **patch**: int test _count pada fixture rantai (REVIEWED=0, SUBMITTED=1). Residual: where halaman tetap inline — konsisten pola halaman server lain di repo.

## Design Notes

- **Mode Keluarga via Profil, bukan bottom nav**: nav siswa dikunci 6 item (keputusan Story 7); item ke-7 terlalu padat untuk mobile. Kartu "Mode Keluarga" di Profil + rute `/siswa/portal/keluarga` dengan tombol kembali.
- **Publish = `publishedAt` timestamp** (bukan boolean): idempoten untuk unpublish (set null) dan kunci urutan "terbaru dipublish" gratis.
- **Terlambat = computed** (`submittedAt > dueDate`) — tanpa kolom skema agar tak bisa drift dari sumber kebenaran.
- **1 submission per siswa per tugas** (`@@unique`) — upsert mencegah duplikat race; edit sebelum review = update konten + `submittedAt` baru.
- Antrean koreksi menempel di tab Tugas guru (sub-halaman per tugas), bukan tab baru — kohesif dengan alur buat-tugas existing.

## Verification

**Commands:**
- `npx tsc --noEmit` — expected: bersih tanpa error.
- `npm test` — expected: semua suite hijau termasuk unit & int test baru (DoD Tahap 8: rantai guru buat → siswa submit → guru feedback; materi publish terlihat; Mode Keluarga read-only aman).
