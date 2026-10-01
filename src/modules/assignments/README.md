# Module: Assignments

Penugasan siswa per pertemuan: pembuatan tugas, pengumpulan, dan penilaian submission.

## Struktur

```
assignments/
  components/
    SaveAsAssessmentDialog.tsx    ← dialog simpan tugas jadi penilaian
  assignment.actions.ts           ← server actions tugas
  submission.service.ts           ← logika pengumpulan & penilaian
```

## Cara Pakai (untuk AI & manusia)

- UI dipakai oleh 2 halaman:
  - `src/app/(dashboard)/kelas/[teachingContextId]/pertemuan/[sessionId]/SessionClient.tsx` (sesi mengajar)
  - `src/app/(dashboard)/kelas/[teachingContextId]/tugas/[assignmentId]/page.tsx` (detail tugas)
- Import UI dari luar modul: `@/modules/assignments/components/<nama>`

## Gotcha

- ⚠️ Modul ini **belum punya unit test** — hati-hati mengubah `submission.service.ts`; andalkan typecheck (`npx tsc --noEmit`) + testing manual di halaman kelas
- Terhubung erat dengan modul `assessment` (via SaveAsAssessmentDialog)
