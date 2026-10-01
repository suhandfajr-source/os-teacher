# Module: Student Portal

Seluruh sisi siswa: autentikasi, navigasi, mengerjakan kuis, dan pengumpulan tugas.

## Struktur

```
student-portal/
  components/
    StudentBottomNav.tsx / StudentHeader.tsx    ← kerangka navigasi portal
    QuizRunnerClient.tsx                        ← runner kuis siswa
    SubmitAssignmentForm.tsx                    ← form kumpul tugas
    ChangePinModal.tsx / StudentInactivityGuard.tsx
  __tests__/
  student-portal.actions.ts / student-family.actions.ts / student-materi.actions.ts
  student-progress.actions.ts + .service.ts
  student-submission.actions.ts
```

## Cara Pakai (untuk AI & manusia)

- Semua UI dipakai oleh halaman di `src/app/siswa/portal/**`
- Autentikasi siswa ada di modul terpisah: `src/modules/student-auth`
- Import UI dari luar modul: `@/modules/student-portal/components/<nama>`

## Gotcha

- Test wajib hijau: `npx vitest run src/modules/student-portal`
- Perhatikan `StudentInactivityGuard` — keamanan sesi siswa; ubah hati-hati
