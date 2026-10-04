# BMAD Code Review: Edge-Case Hunter

Jalankan prompt ini di context window / sesi LLM terpisah untuk menguji boundary conditions dan edge cases terhadap spesifikasi.

---

## Peran Anda
Anda adalah **Lead QA & Reliability Engineer** yang bertindak sebagai **Edge-Case Hunter**.
Tugas Anda adalah membandingkan klaim **Spesifikasi & Kriteria Penerimaan** terhadap **Kode Implementasi**, lalu mencari kondisi batas (*boundary conditions*), skenario null/empty, concurrency collision, dan celah verifikasi.

---

## 1. Klaim Spesifikasi (Spec Summary)
- **Goal:** Fondasi Klassa Agent: Prisma model, universal router (Gemini & OpenAI-compatible), otorisasi per-guru, system prompt guardrails (larangan diagnosis medis, topik pendidikan vs non-pendidikan).
- **Invariants:**
  - Isolasi Guru: Guru hanya dapat mengakses dan memutasi obrolan miliknya sendiri (`teacherProfileId`).
  - Deterministik: Tidak ada hitungan matematika langsung oleh LLM.
  - Guardrail: Larangan keras diagnosis klinis/medis anak (ADHD, autisme).
  - Multi-model: Fallback aman jika model tidak ditemukan atau API key kosong.

---

## 2. Implementasi yang Diuji

### A. Universal Router (`src/modules/agent/agent.router.ts`)
```ts
export function getAgentLanguageModel(modelId?: string): LanguageModel {
  const targetModel = modelId || DEFAULT_AGENT_MODEL;

  if (targetModel.startsWith("gemini")) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY belum dikonfigurasi di environment variable.");
    }
    const google = createGoogleGenerativeAI({ apiKey });
    return google(targetModel);
  }

  if (
    targetModel.includes("hermes") ||
    targetModel.includes("ollama") ||
    targetModel.includes("vllm") ||
    targetModel.includes("local")
  ) {
    const baseURL = process.env.AGENT_LOCAL_LLM_BASE_URL || "http://127.0.0.1:11434/v1";
    const apiKey = process.env.AGENT_LOCAL_LLM_API_KEY || "local-no-key-required";
    const openaiCompatible = createOpenAICompatible({
      name: "local-hermes",
      baseURL,
      apiKey,
    });
    return openaiCompatible(targetModel);
  }

  const fallbackKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!fallbackKey) {
    throw new Error("API Key untuk model agen belum dikonfigurasi.");
  }
  const google = createGoogleGenerativeAI({ apiKey: fallbackKey });
  return google(DEFAULT_AGENT_MODEL);
}
```

### B. Conversation Management (`src/modules/agent/agent.actions.ts`)
- Fungsi `getOrCreateConversationAction`: Mengecek percakapan aktif berdasarkan `teacherProfileId` dan `classContextId`.
- Fungsi `getConversationMessagesAction`: Memvalidasi `conversation.teacherProfileId === profile.id`.
- Fungsi `saveUserMessageAction`: Mengupdate title otomatis pada pesan awal (maks 40 karakter).
- Fungsi `saveAssistantMessageAction`: Menyimpan `pendingAction` dan `actionStatus: "PENDING"`.
- Fungsi `updateTeacherMemoryAction`: Upsert memori preferensi nada & custom context guru.

---

## Panduan Pemeriksaan Edge Case
Periksa apakah ada skenario berikut yang berpotensi menimbulkan bug:
1. **Model ID Tak Dikenal:** Apa yang terjadi jika user me-request model string sembarang seperti `"claude-3-5"` atau string kosong `""`? Apakah router melempar error tak tertangani atau jatuh ke fallback aman?
2. **Karakter Panjang pada Judul:** Pada pesan pertama yang sangat panjang dengan emoji atau unicode multi-byte, apakah pemotongan `.slice(0, 40)` aman?
3. **Race Condition Pembuatan Percakapan:** Jika dua request `getOrCreateConversationAction` terjadi simultan pada tab browser yang berbeda, apakah ada error unik di database?
4. **Custom Context Memori Sangat Besar:** Apakah ada sanitasi atau batasan ukuran teks `customContext` pada `updateTeacherMemoryAction`?

---

## Format Laporan yang Diharapkan
1. **Edge Case Vulnerabilities**: Skenario yang dapat memicu crash atau hasil tidak terduga.
2. **Missing Input Validations**: Parameter yang belum divalidasi dengan Zod atau batas ukuran string.
3. **Verdict**: `ACCEPTABLE` atau `NEEDS_HARDENING`.
