# Prompt Reviewer 2: Edge-Case Hunter (Story 5 Klassa Agent Guru Chat Interface, ActionConfirmCard & Floating Launcher)

Anda bertindak sebagai **Edge-Case Hunter** independen.
Tugas Anda adalah menelaah implementasi **Guru Chat Interface, ActionConfirmCard, dan Floating Launcher** untuk Klassa Agent (Stage 12 Story 5) dari sisi ketahanan sistem, UX edge cases, dan sinkronisasi state.

## Lingkup Perubahan
- **Patch file:** `_bmad-output/implementation-artifacts/diff-klassa-agent-ui.patch`
- **Spec:** `_bmad-output/implementation-artifacts/spec-klassa-agent-ui.md`
- **File Kunci:**
  - `src/app/api/agent/chat/route.ts`
  - `src/app/(dashboard)/asisten/page.tsx` & `AsistenClient.tsx`
  - `src/components/agent/ActionConfirmCard.tsx`
  - `src/components/agent/FloatingAgentLauncher.tsx`
  - `src/components/agent/AgentSettingsModal.tsx`
  - `src/components/agent/ChatMessageBubble.tsx`
  - `src/components/agent/QuickPromptPills.tsx`
  - `src/modules/agent/__tests__/agent-ui.test.ts`

## Fokus Review Anda
1. **Streaming & Network Disruption**:
   - Bagaimana perilaku UI jika stream terputus di tengah jalan (network error / tab ditutup)? Apakah UI tetap responsif atau terjebak dalam status loading selamanya?
2. **Action Proposal Sync & Status Transitions**:
   - Jika guru menyetujui atau membatalkan proposal pada kartu, apakah status langsung diperbarui di layar tanpa perlu me-reload seluruh halaman?
   - Bagaimana penanganan proposal yang sudah kedaluwarsa (TTL lewat)?
3. **Floating Launcher Context Conflict**:
   - Apakah `FloatingAgentLauncher` tersembunyi dengan benar saat pengguna berada di halaman `/asisten` untuk menghindari tampilan redundan ganda?
   - Apakah drawer melayang berfungsi mulus saat berpindah halaman tanpa merusak tata letak dashboard utama?
4. **Input Sanitization & Empty Messages**:
   - Apakah input kosong atau whitespace difilter dengan baik sehingga tidak mengirim request sia-sia ke API?

Formatkan hasil temuan Anda dalam kategori Critical / Major / Minor / Pass, dan berikan analisis serta rekomendasi perbaikan terarah.
