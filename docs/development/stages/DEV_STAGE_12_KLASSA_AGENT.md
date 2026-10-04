# Stage 12: Klassa Agent (Guru AI Assistant & Superadmin Pulse)

## 1. Ikhtisar Stage
Stage 12 menghadirkan **Klassa Agent**, asisten kecerdasan buatan cerdas yang terintegrasi penuh ke dalam sistem operasi sekolah Klassa. Klassa Agent bukan sekadar bot tanya-jawab biasa, melainkan asisten cerdas yang:
1. **Admin Ber-Data**: Menjawab kueri analitik berbasis data presensi, nilai, dan rekapitulasi rombel menggunakan komputasi deterministik murni (zero-hallucination math).
2. **Pedagogi Solutif**: Memberikan saran diferensiasi pembelajaran dan strategi kelas tanpa membuat diagnosis medis/klinis.
3. **Aksi Terkonfirmasi (Human-in-the-Loop)**: Mampu menyiapkan proposal mutasi resmi (presensi, tugas, pengumuman, nilai) yang hanya dieksekusi setelah dikonfirmasi guru melalui kartu interaktif.
4. **Memori Mengingat**: Mempelajari gaya mengajar, preferensi ringkasan, dan konteks spesifik guru dari waktu ke waktu dengan sanitasi injeksi XML.
5. **Klassa Pulse (Zero-PII UU PDP)**: Agregasi wawasan makro untuk Superadmin guna mendeteksi beban lembur guru (burnout index), isu ruang kelas terbanyak, dan titik rawan materi kurikulum tanpa menyentuh obrolan perorangan guru.

---

## 2. Struktur Cerita Pengguna (Stories) & Status Implementasi

| Story | Fitur | Lingkup / Modul | Status |
|:---:|---|---|:---:|
| **Story 1** | Core Runtime, Config, & Router | `src/modules/agent/agent.router.ts`, `agent.config.ts`, `agent.types.ts` | ✅ **DONE** |
| **Story 2** | Deterministic Tools & Scope Rombel B2 | `src/modules/agent/tools/agent-query.tools.ts`, `agent-deterministic-math.ts` | ✅ **DONE** |
| **Story 3** | Human-in-the-Loop Confirmation Engine | `src/modules/agent/tools/agent-action.tools.ts`, `agent-action.actions.ts` | ✅ **DONE** |
| **Story 4** | Teacher Memory & Personalization | `src/modules/agent/memory/agent-memory.tools.ts`, `agent-memory.actions.ts` | ✅ **DONE** |
| **Story 5** | Guru Chat Interface & Floating Launcher | `src/app/(dashboard)/asisten/page.tsx`, `AsistenClient.tsx`, `ActionConfirmCard.tsx` | ✅ **DONE** |
| **Story 6** | Klassa Pulse Aggregation & Cockpit Superadmin | `src/modules/agent/pulse/`, `src/components/admin/KlassaPulseTab.tsx` | ✅ **DONE** |

---

## 3. Rincian Arsitektur Teknis

### A. Universal Multi-Model Adapter
- Mendukung model komersial (Google Gemini, Anthropic Claude, OpenAI GPT) dan model lokal open-weights via OpenAI-compatible endpoint (vLLM / Ollama) tanpa vendor lock-in.

### B. Two-Tier HITL Safety Gate (Anti-TOCTOU)
- Setiap aksi mutasi diajukan melalui status `PENDING` pada model `AgentActionProposal`.
- Eksekusi aksi diamankan oleh Atomic Gate Lock:
  ```ts
  const affected = await tx.agentActionProposal.updateMany({
    where: { id: proposalId, status: "PENDING" },
    data: { status: "EXECUTED", executedAt: new Date() }
  });
  if (affected.count === 0) throw new Error("Aksi sudah pernah dieksekusi atau dibatalkan.");
  ```

### C. Jaminan Privasi UU PDP (Zero-PII Klassa Pulse)
- Agregasi makro pada tabel `agent_insight_aggregate` tidak pernah menyimpan relasi `teacherProfileId`, `studentId`, `userId`, atau `nisn`.
- Sanitasi regex otomatis menyingkirkan pola email dan nomor identitas/NIK dari teks wawasan.
- Sanitasi rekursif memblokir properti identitas personal pada objek metadata JSON.
- Akses dashboard analitik makro dilindungi secara mutlak oleh gerbang `requireSuperAdmin()`.

---

## 4. Hasil Verifikasi Akhir
- **TypeScript Static Check (`tsc --noEmit`)**: 0 error.
- **Agent Suite (`src/modules/agent/__tests__`)**: 55/55 passed (6 test suites).
- **Full Regression Test Suite**: 910/910 tests passing across 80 test files (0 regresi).
