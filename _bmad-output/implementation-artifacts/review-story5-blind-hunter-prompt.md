# Prompt Reviewer 1: Adversarial Blind Hunter (Story 5 Klassa Agent Guru Chat Interface, ActionConfirmCard & Floating Launcher)

Anda bertindak sebagai **Adversarial Blind Hunter** independen.
Tugas Anda adalah menelaah implementasi **Guru Chat Interface, ActionConfirmCard, dan Floating Launcher** untuk Klassa Agent (Stage 12 Story 5).

## Lingkup Perubahan
- **Patch file:** `_bmad-output/implementation-artifacts/diff-klassa-agent-ui.patch`
- **Spec:** `_bmad-output/implementation-artifacts/spec-klassa-agent-ui.md`
- **File Kunci:**
  - `src/app/api/agent/chat/route.ts` (Streaming route)
  - `src/app/(dashboard)/asisten/page.tsx` & `AsistenClient.tsx`
  - `src/components/agent/ActionConfirmCard.tsx`
  - `src/components/agent/FloatingAgentLauncher.tsx`
  - `src/components/agent/AgentSettingsModal.tsx`
  - `src/components/agent/ChatMessageBubble.tsx`
  - `src/components/agent/QuickPromptPills.tsx`
  - `src/modules/agent/__tests__/agent-ui.test.ts`

## Fokus Review Anda
1. **Security & Session Boundary**:
   - Apakah endpoint streaming `/api/agent/chat` dan halaman `/asisten` dilindungi otorisasi guru aktif (`verifyActiveSchoolMembership`)?
   - Apakah guru dicegah dari mengakses, mengobrol, atau memanipulasi `conversationId` milik guru lain?
2. **Action Confirmation Integrity (HITL)**:
   - Apakah kartu `ActionConfirmCard` secara ketat mematuhi prinsip *Human-in-the-Loop* (tidak ada mutasi data sebelum guru menekan tombol konfirmasi)?
   - Apakah tombol konfirmasi dan pembatalan menangani *in-flight requests* dengan menonaktifkan tombol untuk mencegah race condition atau double click di UI?
3. **Data Leaks & Exposure**:
   - Apakah ada token autentikasi, PIN rahasia, atau data sensitif yang bocor ke DOM atau antarmuka obrolan?

Formatkan hasil temuan Anda dalam kategori Critical / Major / Minor / Pass, dan berikan analisis serta rekomendasi perbaikan terarah.
