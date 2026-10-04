---
status: done
date: 2026-10-03
title: Klassa Agent Core Runtime & Schema
route: full
baseline_commit: '716ed5871c245f5f64973d4e4c87767a5a0451b5'
review_loop_iteration: 0
---

# Spec: Klassa Agent Core Runtime & Schema

<frozen-after-approval>
## Goal
Membangun fondasi data dan runtime perpipaan untuk modul baru `Klassa Agent` di dalam ekosistem Klassa OS. Fitur ini mencakup skema persistensi percakapan/pesan/memori guru di database PostgreSQL (Prisma), Universal Multi-Model Router (Google Gemini & OpenAI-compatible), implementasi batasan topik (pendidikan 100% dijawab, non-pendidikan ditolak santun, penolakan diagnosis medis anak), serta rangkaian Server Actions untuk manajemen obrolan asisten guru.

## Scope & Constraints
- **Scope**:
  - Model Prisma: `AgentConversation`, `AgentMessage`, `TeacherAgentMemory`, `AgentInsightAggregate`.
  - Migrasi skema database aman via `npx prisma migrate dev`.
  - Paket Vercel AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/openai-compatible`).
  - Runtime router: `getAgentLanguageModel(modelId)` yang memetakan string model ke provider yang tepat secara dinamis.
  - System prompt dasar: mendefinisikan persona Klassa Agent, aturan pembatasan topik, larangan menghitung matematika secara mandiri (deterministic delegation), dan batasan konseling/medis.
  - Server actions manajemen percakapan dan preferensi memori guru dengan scoping otorisasi ke `TeacherProfile`.
  - Unit tests komprehensif untuk runtime router, konfigurasi prompt, dan guardrail rules.
- **Out of Scope (Deferred to Next Stories)**:
  - Eksekusi tools operasional database (Query & Mutation tools) -> Story 2 & 3.
  - Antarmuka chat UI, widget floating bubble, dan komponen streaming -> Story 4.
  - Engine Klassa Pulse aggregations & Superadmin dashboard -> Story 6.
- **Security & Architectural Invariants**:
  - Multi-tenant / Teacher isolation: Setiap percakapan dan pesan hanya boleh diakses oleh guru pemilik (`teacherProfileId` yang valid dari sesi aktif).
  - Deterministik: Tidak ada logic agregasi nilai atau statistik di dalam LLM; LLM dilarang berhitung matematika secara langsung.
  - Penolakan diagnosis klinis: Larangan keras mendiagnosis gangguan psikologis anak (ADHD, autisme, depresi klinis).
</frozen-after-approval>

## Code Map
- `prisma/schema.prisma`:
  - Tambah relasi di `TeacherProfile`: `agentConversations`, `agentMemory`.
  - Tambah model `AgentConversation`, `AgentMessage`, `TeacherAgentMemory`, `AgentInsightAggregate`.
- `package.json`:
  - Tambah dependensi `ai`, `@ai-sdk/google`, `@ai-sdk/openai-compatible`.
- `src/modules/agent/`:
  - `agent.types.ts`: DTO pesan, role, status proposal aksi, interface preferensi memori.
  - `agent.config.ts`: Daftar model terdaftar, default model, system prompt dasar dan guardrail text.
  - `agent.router.ts`: Factory fungsi pemilih model AI SDK (Gemini / OpenAI-compatible).
  - `agent.actions.ts`: Server Actions (`getOrCreateConversationAction`, `listConversationsAction`, `getConversationMessagesAction`, `saveUserMessageAction`, `saveAssistantMessageAction`, `deleteConversationAction`, `getTeacherMemoryAction`, `updateTeacherMemoryAction`).
  - `README.md`: Dokumentasi modul sesuai arsitektur monorepo Klassa.
- `src/modules/agent/__tests__/`:
  - `agent-core.test.ts`: Pengujian unit untuk konfigurasi, router model, pencegahan kegagalan environment variable, dan integritas system prompt.

## Tasks & Acceptance
- [x] **Task 1: Skema Prisma & Migrasi DB**
  - Given perubahan pada `prisma/schema.prisma`
  - When perintah `prisma format` dan `prisma migrate dev` dijalankan
  - Then skema termigrasi tanpa drift dan tabel `agent_conversation`, `agent_message`, `teacher_agent_memory`, `agent_insight_aggregate` terbentuk di Neon DB.
- [x] **Task 2: AI SDK Dependencies & Types Definition**
  - Given instalasi `ai`, `@ai-sdk/google`, `@ai-sdk/openai-compatible`
  - When types di `src/modules/agent/agent.types.ts` diimpor oleh aplikasi
  - Then seluruh tipe data DTO terkompilasi tanpa error TypeScript.
- [x] **Task 3: Universal Router & Guardrail System Prompt**
  - Given konfigurasi model di `agent.config.ts` dan fungsi `getAgentLanguageModel` di `agent.router.ts`
  - When dipanggil dengan model default (`gemini-1.5-flash`), ia mengembalikan instance provider Google Generative AI
  - When dipanggil dengan model open-weights (`hermes-local`), ia mengembalikan instance OpenAI-compatible provider
  - When `GEMINI_API_KEY` tidak tersedia dan model gemini diminta, ia melempar error deskriptif yang aman.
- [x] **Task 4: Server Actions Otorisasi Guru**
  - Given pengguna terautentikasi sebagai guru dengan profil aktif
  - When memanggil action percakapan (buat, baca, simpan pesan, hapus), aksi berhasil dan terikat pada `teacherProfileId` guru tersebut
  - When pengguna mencoba membaca/menghapus percakapan guru lain, permintaan ditolak dengan pesan error yang aman.
- [x] **Task 5: Automated Testing & Verifikasi Regresi**
  - Given test suite di `src/modules/agent/__tests__/agent-core.test.ts`
  - When `npx vitest run src/modules/agent` dijalankan
  - Then seluruh pengujian lulus 100% dan verifikasi seluruh test suite (`npm test`) tidak mengalami regresi.

## I/O & Edge-Case Matrix
| Skenario | Input | Output / Perilaku yang Diharapkan |
|---|---|---|
| Inisialisasi model Gemini tanpa API key | `getAgentLanguageModel("gemini-1.5-flash")` tanpa `GEMINI_API_KEY` | Throws error deskriptif "GEMINI_API_KEY belum dikonfigurasi..." |
| Inisialisasi model Gemini valid | `getAgentLanguageModel("gemini-1.5-flash")` dengan key terpasang | Mengembalikan model instance dengan `modelId === "gemini-1.5-flash"` |
| Inisialisasi model mandiri (Hermes/Ollama) | `getAgentLanguageModel("hermes-local")` | Mengembalikan model instance OpenAI-compatible dengan target endpoint |
| Validasi Guardrail Prompts | Pemeriksaan teks `BASE_SYSTEM_PROMPT` | Mengandung larangan diagnosis medis spesifik, pembatasan topik non-pendidikan, dan larangan berhitung langsung |
| Isolasi Kepemilikan Percakapan | Guru A mencoba mengakses `conversationId` milik Guru B | Mengembalikan `{ success: false, error: "...akses ditolak" }` |

## Review Triage Log
| Finding / Claim | Layer | Verdict | Evidence / Status |
|---|---|---|---|
| Guru A tidak boleh membaca obrolan Guru B | Security | PASS | Seluruh percakapan dan pesan di-guard dengan `teacherProfileId === profile.id` |
| LLM dilarang berhitung matematika dan wajib menolak diagnosis psikologis anak | Architecture | PASS | Diatur secara ketat dalam `BASE_SYSTEM_PROMPT` dan diuji unit test |
| Provider universal mendukung Gemini dan model mandiri lokal | Architecture | PASS | Menggunakan Vercel AI SDK dengan `@ai-sdk/google` dan `@ai-sdk/openai-compatible` |
| Seluruh skenario edge case matrix lulus uji | Verification | PASS | 8 unit tests passing, full suite 865 tests green tanpa regresi |

## Completion Summary
Spesifikasi `spec-klassa-agent-core-runtime.md` telah diimplementasikan, diverifikasi, dan direview sesuai standar BMAD Build. Seluruh task selesai, diff tervalidasi, dan status ditandai `done`.
