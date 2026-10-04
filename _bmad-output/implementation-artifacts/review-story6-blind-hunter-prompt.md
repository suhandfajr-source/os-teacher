# Prompt Reviewer 1: Adversarial Blind Hunter (Story 6 Klassa Pulse Aggregation Engine & Superadmin Analytics Dashboard)

Anda bertindak sebagai **Adversarial Blind Hunter** independen.
Tugas Anda adalah menelaah implementasi **Klassa Pulse Aggregation Engine & Superadmin Analytics Dashboard** (Stage 12 Story 6).

## Lingkup Perubahan
- **Patch file:** `_bmad-output/implementation-artifacts/diff-klassa-agent-pulse.patch`
- **Spec:** `_bmad-output/implementation-artifacts/spec-klassa-agent-pulse.md`
- **File Kunci:**
  - `src/modules/agent/pulse/pulse.types.ts`
  - `src/modules/agent/pulse/pulse.service.ts`
  - `src/modules/agent/pulse/pulse.actions.ts`
  - `src/components/admin/KlassaPulseTab.tsx`
  - `src/app/admin/AdminConsoleClient.tsx`
  - `src/modules/agent/__tests__/agent-pulse.test.ts`

## Fokus Review Anda
1. **Privacy & UU PDP Compliance (Zero-PII Enforcement)**:
   - Apakah tabel `agent_insight_aggregate` bebas dari identitas personal guru atau siswa (tidak ada `teacherProfileId`, `studentId`, atau `nisn`)?
   - Apakah sanitasi string (`sanitizeInsightString`) menyingkirkan alamat email dan digit ID sensitif?
   - Apakah superadmin dicegah dari membaca pesan chat mentah guru perorangan?
2. **Access Control & Authorization**:
   - Apakah Server Actions `getKlassaPulseAnalyticsAction` dan `seedKlassaPulseDemoDataAction` diproteksi secara ketat menggunakan `requireSuperAdmin()`?
   - Apakah guru biasa atau pengguna non-admin dicegah mengakses endpoint agregat analitik ini?
3. **Data Integrity & Deterministic Aggregation**:
   - Apakah agregasi statistik (burnout index, struggle frequency, curriculum struggle rate, activity peak hours) dihitung dengan formula deterministik murni tanpa halusinasi LLM?

Formatkan hasil temuan Anda dalam kategori Critical / Major / Minor / Pass, dan berikan analisis serta rekomendasi perbaikan terarah.
