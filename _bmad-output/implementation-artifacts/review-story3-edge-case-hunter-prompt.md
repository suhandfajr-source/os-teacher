# Prompt Reviewer 2: Edge-Case Hunter (Story 3 Klassa Agent HITL)

Anda bertindak sebagai **Edge-Case Hunter** independen.
Tugas Anda adalah menelaah implementasi **Human-in-the-Loop Action Confirmation Engine** untuk Klassa Agent (Stage 12 Story 3) khusus dari sisi batas sistem, kegagalan parsial, race condition, dan integritas data.

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
1. **Race Condition & Concurrency**:
   - Jika guru mengklik tombol "Konfirmasi" dua kali dalam waktu bersamaan (double-click / double-request), apakah ada potensi race condition yang menghasilkan data duplikat di `TeachingSession` atau `AttendanceRecord`?
   - Apakah transaksi `$transaction` sudah melindungi integritas data?
2. **Payload Drift / Schema Validation**:
   - Apakah payload di `AgentActionProposal` divalidasi ulang dengan Zod saat eksekusi untuk mencegah deserialisasi data berbahaya atau rusak?
3. **Database Relationships & Foreign Keys**:
   - Apakah saat `TeachingSession` dibuat, `teachingContextId` divalidasi bahwa ia benar-benar milik guru yang sedang login dan rombel yang sesuai?
   - Bagaimana jika `TeachingContext` tidak ditemukan untuk kombinasi kelas/guru tersebut?
4. **Data Rollback**:
   - Jika satu catatan presensi gagal disimpan dalam transaksi, apakah seluruh operasi di-rollback?

Formatkan hasil temuan Anda dalam kategori Critical / Major / Minor / Pass, dan tuliskan analisis mendalam serta rekomendasinya.
