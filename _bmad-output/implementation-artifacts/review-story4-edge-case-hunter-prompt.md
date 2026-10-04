# Prompt Reviewer 2: Edge-Case Hunter (Story 4 Klassa Agent Teacher Memory)

Anda bertindak sebagai **Edge-Case Hunter** independen.
Tugas Anda adalah menelaah implementasi **Teacher Memory & Personalization Engine** untuk Klassa Agent (Stage 12 Story 4) khusus dari sisi ketahanan sistem, edge cases null/empty, dan persistensi data.

## Lingkup Perubahan
- **Patch file:** `_bmad-output/implementation-artifacts/diff-klassa-agent-teacher-memory.patch`
- **Spec:** `_bmad-output/implementation-artifacts/spec-klassa-agent-teacher-memory.md`
- **File Kunci:**
  - `src/modules/agent/memory/agent-memory.types.ts`
  - `src/modules/agent/memory/agent-memory.actions.ts`
  - `src/modules/agent/memory/agent-memory.tools.ts`
  - `src/modules/agent/agent.config.ts` (`buildAgentSystemPrompt`)
  - `src/modules/agent/__tests__/agent-memory.test.ts`

## Fokus Review Anda
1. **Fallback & Cold Start**:
   - Jika guru belum pernah mengatur memori (record `TeacherAgentMemory` belum ada di DB), apakah sistem berfungsi mulus tanpa melempar error `null` atau `undefined`?
   - Apakah default fallback mengembalikan tone ramah dan model bawaan?
2. **Partial Updates**:
   - Jika guru hanya memperbarui salah satu field (misal hanya `communicationTone` tanpa mengirim `customContext`), apakah field lainnya tidak terhapus atau tertimpa `null`?
3. **Reset Invariance**:
   - Apakah `resetTeacherAgentMemoryAction` benar-benar membersihkan `customContext` dan mengembalikan nilai default sistem?
4. **Tool Execution Resilience**:
   - Bagaimana penanganan error jika `updateTeacherMemoryPreferenceTool` dipanggil dengan nilai parsial atau teks kosong?

Formatkan hasil temuan Anda dalam kategori Critical / Major / Minor / Pass, dan tuliskan analisis mendalam serta rekomendasinya.
