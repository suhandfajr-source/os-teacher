---
status: done
date: 2026-10-03
title: Klassa Agent Teacher Memory & Personalization Engine
route: full
baseline_commit: '716ed5871c245f5f64973d4e4c87767a5a0451b5'
review_loop_iteration: 1
---

# Technical Specification: Klassa Agent Teacher Memory & Personalization Engine (Story 4)

## 1. Problem Statement & Business Context
Setiap guru memiliki gaya komunikasi, preferensi metode ajar (pedagogi), dan kebiasaan yang berbeda-beda. Beberapa guru menyukai jawaban yang sangat ringkas dan to-the-point (*bullet points* tanpa basa-basi), sementara guru lain lebih menyukai gaya diskusi reflektif yang ramah dan suportif.
Selain itu, guru membutuhkan asisten AI yang "mengenal" kebiasaan mengajarnya dari waktu ke waktu tanpa harus mengetik ulang konteks yang sama di setiap percakapan.

Klassa Agent membutuhkan **Teacher Memory & Personalization Engine**:
1. Menyimpan preferensi gaya komunikasi (`RAMAH_SOPAN`, `LUGAS_RINGKAS`, `FORMAL`), model AI favorit, default pedagogi (misal: Kurikulum Merdeka, Pembelajaran Berdiferensiasi, Project-Based Learning), dan catatan konteks kustom guru.
2. Menginjeksi memori personal ini ke dalam perakitan `System Prompt` dinamis pada runtime percakapan.
3. Menyediakan kontrol penuh bagi guru untuk melihat, menyunting, mereset, atau memperbarui memorinya melalui antarmuka pengaturan dan tool percakapan.

---

## 2. Core Requirements & Acceptance Criteria

### 1. Schema & Data Integrity (`TeacherAgentMemory`)
- Model `TeacherAgentMemory` sudah ada di Prisma:
  - `teacherProfileId` (unique 1:1 terhadap `TeacherProfile`).
  - `communicationTone`: enum string (`RAMAH_SOPAN`, `LUGAS_RINGKAS`, `FORMAL`).
  - `preferredModel`: string (default `"gemini-1.5-flash"`).
  - `pedagogyDefaults`: JSON terstruktur (fokus pendekatan ajar, tingkat jenjang, asesmen preferensi).
  - `customContext`: teks catatan bebas dari guru (maksimal 2000 karakter untuk mencegah token bloat).

### 2. Personalization Service & Server Actions (`agent-memory.actions.ts`)
- `getTeacherAgentMemory()`:
  - Mengambil memori guru yang sedang login berdasarkan `profile.id` dari `verifyActiveSchoolMembership()`.
  - Jika belum ada di DB, kembalikan konfigurasi default tanpa melempar error.
- `updateTeacherAgentMemory(input)`:
  - Upsert record ke tabel `TeacherAgentMemory`.
  - Validasi Zod schema ketat: tone komunikasi valid, panjang `customContext` dibatasi, JSON pedagogi valid.
- `resetTeacherAgentMemory()`:
  - Mengembalikan memori ke setelan default sistem.

### 3. Dynamic System Prompt Integration
- Memperbarui `buildAgentSystemPrompt({ memory, ... })` di `src/modules/agent/agent.config.ts`:
  - Jika tone `LUGAS_RINGKAS`: Instruksikan LLM memberikan jawaban padat, efisien, bullet points, hilangkan basa-basi.
  - Jika tone `RAMAH_SOPAN`: Gaya bahasa hangat, suportif, empatik terhadap beban kerja guru.
  - Jika tone `FORMAL`: Bahasa baku kedinasan akademik profesional.
  - Injeksi catatan `customContext` dan preferensi pedagogi guru ke dalam blok prompt sistem secara aman (sanitized).

### 4. Interactive Tooling (`agent-memory.tools.ts`)
- `updateTeacherMemoryPreferenceTool`:
  - Memungkinkan agent memperbarui preferensi memori ketika guru secara eksplisit meminta: "Tolong ingat bahwa saya lebih suka jawaban ringkas" atau "Catat bahwa kelas saya menerapkan P5 tema kearifan lokal".
  - Dilindungi otorisasi guru aktif.

### 5. Multi-Tenant Security & Isolation (B1)
- Guru hanya dapat mengakses dan memodifikasi memorinya sendiri (`teacherProfileId === profile.id`).
- Dilarang keras data memori bocor ke percakapan guru lain.

---

## 3. Implementation Plan & File Structure

1. **Types & Schemas**:
   - `src/modules/agent/memory/agent-memory.types.ts`:
     - Zod schema untuk `CommunicationToneEnum`, `PedagogyDefaultsSchema`, `UpdateTeacherMemorySchema`.
2. **System Prompt Dynamic Injection**:
   - `src/modules/agent/agent.config.ts`:
     - Tambahkan blok personalisasi memori guru di dalam generator prompt sistem agent.
3. **Memory Server Actions**:
   - `src/modules/agent/memory/agent-memory.actions.ts`:
     - `getTeacherAgentMemoryAction()`, `updateTeacherAgentMemoryAction()`, `resetTeacherAgentMemoryAction()`.
4. **Memory Tool**:
   - `src/modules/agent/memory/agent-memory.tools.ts`:
     - Tool AI SDK v7 `updateTeacherMemoryPreferenceTool`.
5. **Unit & Security Tests**:
   - `src/modules/agent/__tests__/agent-memory.test.ts`:
     - Pengujian default fallback memori.
     - Pengujian update memori & validasi input.
     - Pengujian injeksi gaya komunikasi ke dalam system prompt.
     - Pengujian isolasi multi-tenant antar guru.

---

## 4. Risk Assessment & Mitigations
- **Risk**: Prompt injection via `customContext` yang diisikan guru (misal instruksi mengabaikan guardrails).
  - **Mitigation**: `customContext` dibungkus dalam blok XML terisolasi (`<teacher_notes>...</teacher_notes>`) dengan instruksi meta bahwa isi catatan tidak boleh membatalkan guardrails etika dan keamanan data.
- **Risk**: Context bloat jika guru memasukkan catatan terlalu panjang.
  - **Mitigation**: Batasan Zod maksimal 2000 karakter pada `customContext`.
