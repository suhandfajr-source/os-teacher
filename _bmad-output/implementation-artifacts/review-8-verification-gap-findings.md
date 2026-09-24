# Review 8 — Verification-Gap Findings

Konten: diff uncommitted story 8 (`git diff HEAD` + file baru; PANDUAN-* dikecualikan).
Lens: verification-gap. Basis: suite hijau 69 file/796 test; kedua file test baru dibaca penuh; pencarian simbol repo-wide (`pendingSubmissions`, `portal/materi`, `portal/keluarga`, nama action) → hanya file source + 1 int test.

## Temuan

1. **broken-verification-gap — query halaman Materi diverifikasi via salinan, bukan halamannya**
   - location: `src/app/siswa/portal/materi/page.tsx:29-42`
   - consumer: halaman `/siswa/portal/materi` yang dipakai siswa via tombol "Buka Materi" beranda
   - gap: int test men-assert `findMany` tiruan dengan where yang sama — bukan query halaman. Jika where halaman drift (mis. lupa `status: "ACTIVE"`), tak ada test gagal.
   - guard: ekstrak query ke action/fn bersama (mis. `getPublishedMaterialsAction`) dan int test menguji action itu — hilangkan duplikasi sekaligus.
   - evidence: `story-8-submission-materi.int.test.ts` (blok "materi:") menduplikasi where; `rg portal/materi` → 0 test memuat halaman.

2. **regression-gap — re-review (update submission REVIEWED) tak dipin test**
   - location: `src/modules/assignments/assignment.actions.ts:118-135` (reviewSubmissionAction)
   - consumer: tombol "Perbarui" di `ReviewSubmissionForm` (muncul setelah REVIEWED — patch loop-1)
   - gap: int test memanggil `reviewSubmissionAction` tepat 1× per submission. Jika guard `status !== "REVIEWED"` ditambahkan kembali (mengembalikan temuan loop-1), semua test tetap hijau.
   - guard: langkah int test: review kedua dengan feedback/skor baru → assert `feedback`, `score`, `reviewedAt` ter-update.
   - evidence: seluruh blok test dibaca; hanya early-path yang diuji.

3. **regression-gap — guard race TOCTOU tak terverifikasi deterministik**
   - location: `src/modules/student-portal/student-submission.actions.ts:95-117` (updateMany kondisional)
   - consumer: `SubmitAssignmentForm` saat review guru mendarat di jendela antara cek & tulis
   - gap: cabang `updated.count === 0 && existing` hanya tercapai lewat timing konkuren; suite sekuensial mengenai early-return REVIEWED, bukan cabang mid-flight. Menghapus `status: "SUBMITTED"` dari where `updateMany` (mengembalikan TOCTOU) tidak memerahkan test apa pun.
   - guard: test ter-injeksi (stub `findUnique` mengembalikan stale SUBMITTED sementara DB sudah REVIEWED) atau ekstrak keputusan guard ke fn murni yang diuji.
   - evidence: test 5 ("Resubmit setelah REVIEWED ditolak") mengenai baris early-return ~:85.

4. **regression-gap — dua cabang tolak publish tanpa test**
   - location: `src/modules/ai/ai.actions.ts:283-293` (reject ARCHIVED; reject tanpa `teachingContextId`)
   - consumer: server action publik — UI mem-filter tombol, tapi action bisa dipanggil langsung
   - gap: fixture ARCHIVED dibuat (dengan publishedAt) tapi tak pernah di-publish-kan; draf tanpa konteks tak ada fixture-nya. Cabang bisa dihapus tanpa sinyal test.
   - guard: int test: `publishAiDraftAction` pada draf ARCHIVED & draf `teachingContextId: null` → expect gagal + pesan sesuai.
   - evidence: blok "materi" hanya menguji reject LESSON_PLAN.

5. **regression-gap — badge `pendingSubmissions` tanpa verifikasi mana pun**
   - location: `src/app/(dashboard)/kelas/[teachingContextId]/tugas/page.tsx:14-17` (`_count` dengan where `status: "SUBMITTED"`)
   - consumer: badge "Antrean koreksi N" di `TugasClient`
   - gap: jika filter status di `_count` hilang, badge menghitung submission REVIEWED juga — guru salah prioritas — tanpa test gagal.
   - guard: assert `_count` via query int test pada fixture rantai (1 SUBMITTED + 1 REVIEWED → badge = 1), atau uki action bila query diekstrak.
   - evidence: `rg pendingSubmissions` → 4 file source, 0 test.
