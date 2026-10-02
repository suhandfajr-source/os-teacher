# Module: Assignments

Penugasan siswa per pertemuan: pembuatan tugas, pengumpulan, dan penilaian submission.

## Struktur

```
assignments/
  components/
    SaveAsAssessmentDialog.tsx    ← dialog simpan tugas jadi penilaian
  assignment.actions.ts           ← server actions tugas (+queue koreksi dgn file)
  submission.service.ts           ← logika validasi & shaping submission (+kanal file)

(storage file jawaban: src/modules/storage/ — adapter S3 + validasi K1–K3;
 route akses: src/app/api/assignments/files/*)
```

## Cara Pakai (untuk AI & manusia)

- UI dipakai oleh 2 halaman:
  - `src/app/(dashboard)/kelas/[teachingContextId]/pertemuan/[sessionId]/SessionClient.tsx` (sesi mengajar)
  - `src/app/(dashboard)/kelas/[teachingContextId]/tugas/[assignmentId]/page.tsx` (detail tugas)
- Import UI dari luar modul: `@/modules/assignments/components/<nama>`

## Gotcha

- ⚠️ Modul ini **belum punya unit test** — hati-hati mengubah `submission.service.ts`; andalkan typecheck (`npx tsc --noEmit`) + testing manual di halaman kelas
- Terhubung erat dengan modul `assessment` (via SaveAsAssessmentDialog)

## File Jawaban (Story 1)

- Byte file TIDAK lewat server — browser siswa upload langsung ke S3-compatible (R2/MinIO) via presigned POST (`/api/assignments/files/upload-url`)
- Klaim & penghapusan objek terjadi di `submitAssignmentAction` (prefix `submissions/tmp/`, guard `isClaimableSubmissionKey`)
- Tanpa env `S3_*`, kanal file mati anggun — teks/link tetap jalan
- Keputusan produk lengkap: `docs/product/assignment-file-blueprint.md`
- Story 2 (lampiran guru) menunggu di `_bmad-output/implementation-artifacts/deferred-work.md`
