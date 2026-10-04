# Prompt Reviewer 1: Adversarial Blind Hunter (Story 3 Klassa Agent HITL)

Anda bertindak sebagai **Adversarial Blind Hunter** independen.
Tugas Anda adalah menelaah implementasi **Human-in-the-Loop Action Confirmation Engine** untuk Klassa Agent (Stage 12 Story 3).

## Lingkup Perubahan
- **Patch file:** `_bmad-output/implementation-artifacts/diff-klassa-agent-action-confirmation.patch`
- **Spec:** `_bmad-output/implementation-artifacts/spec-klassa-agent-action-confirmation.md`
- **File Kunci:**
  - `prisma/schema.prisma` (`model AgentActionProposal`, `enum AgentActionStatus`)
  - `src/modules/agent/tools/agent-action.types.ts`
  - `src/modules/agent/tools/agent-action.tools.ts`
  - `src/modules/agent/agent-action.actions.ts`
  - `src/modules/agent/__tests__/agent-action-confirmation.test.ts`

## Fokus Review Anda
1. **Human-in-the-Loop Enforcement**:
   - Apakah ada celah di mana agent dapat mengeksekusi mutasi (presensi, tugas, pengumuman) secara diam-diam tanpa persetujuan eksplisit guru?
   - Apakah tool hanya membuat proposal (`status: PENDING`, `requiresConfirmation: true`)?
2. **Security & Authorization (Multi-Tenant & Rombel Scope B2)**:
   - Apakah guru A dapat mengeksekusi proposal guru B jika mengetahui ID proposal-nya?
   - Apakah otorisasi rombel (`verifyClassRosterAccess`) dan isolasi sekolah (`activeSchoolId`) diterapkan ketat di `executeAgentAction`?
3. **Anti-Replay & State Transition**:
   - Apakah proposal yang sudah `EXECUTED` atau `CANCELLED` dapat dieksekusi ulang?
   - Apakah TTL kedaluwarsa diperiksa dengan benar sebelum eksekusi?

Formatkan hasil temuan Anda dalam kategori Critical / Major / Minor / Pass, dan tuliskan analisis mendalam serta rekomendasinya.
