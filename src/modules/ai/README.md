# Module: AI

Inti layanan AI: koneksi provider, service generasi, dan form-form AI Studio.

## Struktur

```
ai/
  components/
    forms/                  ← form-form halaman AI Studio
  providers/                ← koneksi provider AI
  __tests__/
  ai.service.ts / .actions.ts / .types.ts
```

## Cara Pakai (untuk AI & manusia)

- Halaman pemakai: `src/app/(dashboard)/ai-studio/AiStudioClient.tsx`
- Fitur AI lain memanggil service dari sini: quiz (`quiz-ai.service`), academic (`academic-ai.*`)
- Import dari luar modul: `@/modules/ai/...`

## Gotcha

- Test wajib hijau: `npx vitest run src/modules/ai`
- `providers/` menyimpan konfigurasi koneksi — jangan commit API key
