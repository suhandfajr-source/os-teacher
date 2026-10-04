# Module: Agent

Inti layanan Klassa Agent: Universal Multi-Model router, deterministic tools registry, memori preferensi guru, dan runtime perpipaan Vercel AI SDK.

## Struktur

```
agent/
  agent.types.ts             ← tipe data DTO, peran, proposal aksi, dan provider
  agent.config.ts            ← model acuan, base system prompt, dan panduan ruang lingkup
  agent.router.ts            ← Universal Multi-Model Dispatcher (Gemini, OpenAI-compatible, vLLM)
  agent.actions.ts           ← Server Actions (percakapan, pesan, ingatan guru)
  README.md                  ← dokumentasi modul
```

## Cara Pakai (untuk AI & manusia)

- Halaman pemakai: `src/app/(dashboard)/asisten/` (jendela chat utama & pengaturan memori)
- Widget peluncur: `FloatingAgentLauncher.tsx` di layout dashboard guru
- Import dari luar modul: `@/modules/agent/...`

## Gotcha

- **Keamanan Rombel (B2):** Seluruh tools query WAJIB memvalidasi kepemilikan kelas via `isPengampuRombel`. Dilarang mengekspos data rombel lain.
- **Kalkulasi Deterministik:** LLM dilarang berhitung matematika sendiri. Angka rekap dan statistik selalu dihitung oleh kode program Next.js.
- **Human-in-the-Loop:** Aksi tulis permanen (absen, nilai, tugas) tidak boleh langsung disimpan ke DB tanpa status `CONFIRMED` dari kartu interaktif guru.
- Test wajib hijau: `npx vitest run src/modules/agent`
