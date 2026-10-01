# Module: Quiz

Kuis online: pembuatan soal, editor bank soal, dan konversi AI.

## Struktur

```
quiz/
  components/
    QuestionListEditor.tsx    ← editor daftar soal
  __tests__/                  ← unit test (40 test)
  quiz.service.ts / .actions.ts / .types.ts
  quiz-ai.service.ts          ← generate soal via AI
  quiz-convert.action.ts      ← konversi kertas→digital
```

## Cara Pakai (untuk AI & manusia)

- UI dipakai oleh 2 halaman:
  - `src/app/(dashboard)/quiz/new/NewQuizClient.tsx` (buat kuis baru)
  - `src/app/(dashboard)/quiz/[quizId]/QuizDetailClient.tsx` (detail kuis)
- Sisi siswa (mengerjakan kuis) ada di modul terpisah: `src/modules/student-portal` + `src/components/student`
- Import UI dari luar modul: `@/modules/quiz/components/<nama>`

## Gotcha

- Test wajib hijau: `npx vitest run src/modules/quiz`
- Fitur quiz menyentuh banyak modul lain (assessment, student-portal, templates) — cek `docs/reports/REPORT-QUIZ-ONLINE.md` untuk konteks historis
