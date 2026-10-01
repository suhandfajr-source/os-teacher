# Module: Templates

Generator dokumen DOCX/XLSX dari template — jantung fitur ekspor laporan & konten.

## Struktur

```
templates/
  components/
    TemplateManagerDialog.tsx    ← UI kelola template (dialog)
    DocumentPreviewModal.tsx     ← UI preview hasil render + PreviewFormat
  __tests__/                    ← 5 file test (86 test total di modul ini)
  template.service.ts           ← logika utama
  template.actions.ts           ← server actions
  template-registry.ts
  template.types.ts
  docx-*.ts / xlsx-*.ts         ← renderer, placeholder-parser, security-validator per format
```

## Cara Pakai (untuk AI & manusia)

- UI dipakai oleh: `src/app/(dashboard)/ai-studio/AiStudioClient.tsx` (satu-satunya konsumen)
- Render dokumen: `template.service.ts` → renderer per format (`docx-template-renderer.ts` / `xlsx-template-renderer.ts`)
- Placeholder dijaga oleh security-validator — jangan bypass saat menambah placeholder baru

## Gotcha

- Test modul ini (`npx vitest run src/modules/templates`) wajib hijau sebelum ubah renderer/validator
- Import UI dari luar modul: `@/modules/templates/components/<nama>`
