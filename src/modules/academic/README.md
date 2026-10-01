# Module: Academic

Manajemen akademik: grid rencana pembelajaran interaktif + wizard generate rencana berbasis AI.

## Struktur

```
academic/
  components/
    InteractiveProsemGrid.tsx        ← editor grid rencana (interaktif)
    PlanGenerationWizardModal.tsx    ← modal wizard generate rencana (AI)
  __tests__/                        ← 4 file test (35 test total)
  academic.service.ts / .actions.ts / .types.ts
  academic-ai.service.ts / .actions.ts / .types.ts   ← layer AI
  academic.export.ts
```

## Cara Pakai (untuk AI & manusia)

- UI dipakai oleh: `src/app/(dashboard)/akademik/AcademicClient.tsx` (satu-satunya konsumen)
- Logika inti: `academic.service.ts`; fitur AI: `academic-ai.service.ts`
- Import UI dari luar modul: `@/modules/academic/components/<nama>`

## Gotcha

- ⚠️ **Utang lama (pre-existing):** `InteractiveProsemGrid.tsx:86` — setState sinkron dalam effect (eslint error react-hooks). Ada sejak sebelum reorganisasi; perlu perbaikan terpisah, jangan dicampur dengan refactor folder
- Test wajib hijau: `npx vitest run src/modules/academic`
