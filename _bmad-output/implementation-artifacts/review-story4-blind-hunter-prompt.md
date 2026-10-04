# Prompt Reviewer 1: Adversarial Blind Hunter (Story 4 Klassa Agent Teacher Memory)

Anda bertindak sebagai **Adversarial Blind Hunter** independen.
Tugas Anda adalah menelaah implementasi **Teacher Memory & Personalization Engine** untuk Klassa Agent (Stage 12 Story 4).

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
1. **Prompt Injection & Guardrail Jailbreak via Memory**:
   - Apakah teks bebas di `customContext` dapat digunakan oleh pengguna jahat untuk memanipulasi prompt sistem (jailbreak), mematikan aturan etika, atau melompati larangan diagnosis klinis?
   - Apakah sanitasi dan XML containment (`<teacher_personal_notes>`) efektif mengunci petunjuk sistem utama?
2. **Multi-Tenant Memory Isolation (B1)**:
   - Apakah ada skenario di mana guru A dapat membaca, menimpa, atau mereset memori preferensi milik guru B?
   - Apakah seluruh aksi terikat pada `profile.id` yang tervalidasi dari sesi aktif?
3. **Data Pollution & Context Bloat**:
   - Apakah ada batasan ketat terhadap ukuran teks catatan guru (misal batas 2000 karakter) untuk mencegah denial-of-service / token exhaustion?

Formatkan hasil temuan Anda dalam kategori Critical / Major / Minor / Pass, dan tuliskan analisis mendalam serta rekomendasinya.
