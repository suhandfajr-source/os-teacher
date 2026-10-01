# Module: Schedule

Jadwal mengajar guru: konfigurasi jadwal & alur "hari ini".

## Struktur

```
schedule/
  components/
    ScheduleConfigDialog.tsx     ← dialog atur jadwal mengajar
    TodayScheduleStream.tsx      ← alur kegiatan hari ini
  __tests__/                     ← unit test (15 test)
  schedule.actions.ts
  schedule.schema.ts
```

## Cara Pakai (untuk AI & manusia)

- UI dipakai oleh 5 halaman (modul paling banyak konsumen):
  - `src/app/(dashboard)/page.tsx` (dashboard utama)
  - `src/app/(dashboard)/hari-ini/page.tsx`
  - `src/app/(dashboard)/kelas/KelasOverviewClient.tsx`
  - `src/app/(dashboard)/kelas/[teachingContextId]/RuangMengajarClient.tsx`
  - `src/app/(dashboard)/pengaturan/setup/SetupManager.tsx`
- Import UI dari luar modul: `@/modules/schedule/components/<nama>`

## Gotcha

- ⚠️ **Utang lama (pre-existing):** `ScheduleConfigDialog.tsx:90` — setState sinkron dalam effect (eslint error react-hooks). Ada sejak sebelum reorganisasi; perlu perbaikan terpisah
- Test wajib hijau: `npx vitest run src/modules/schedule`
- Blueprint jadwal (product): `docs/product/TEACHING_SCHEDULE_MASTER_BLUEPRINT_V2.md`
